import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed." }, { status: 405, headers: corsHeaders });
  }

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return Response.json({ error: "Administrator sign-in is required." }, { status: 401, headers: corsHeaders });
    }

    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !serviceKey) throw new Error("Supabase function secrets are not configured.");

    const callerClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: caller, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller.user) {
      return Response.json({ error: "Administrator sign-in is required." }, { status: 401, headers: corsHeaders });
    }

    const adminClient = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const removeCreatedAuthUser = async (userId: string) => {
      const { error } = await adminClient.auth.admin.deleteUser(userId);
      if (error) console.error("Could not roll back the newly created Auth user:", error);
    };
    const { data: callerProfile, error: profileError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", caller.user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (callerProfile?.role !== "admin") {
      return Response.json({ error: "Only administrators can create student accounts." }, { status: 403, headers: corsHeaders });
    }

    const body: unknown = await request.json();
    if (!isRecord(body)) {
      return Response.json({ error: "Submit valid student account details." }, { status: 400, headers: corsHeaders });
    }
    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const studentNumber = typeof body.studentNumber === "string" ? body.studentNumber.trim().toUpperCase() : "";
    const className = typeof body.className === "string" ? body.className.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (
      !fullName || fullName.length > 120 ||
      email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !/^[A-Z0-9][A-Z0-9/._-]{0,63}$/.test(studentNumber) ||
      !className || className.length > 80 ||
      password.length < 8 || password.length > 256
    ) {
      return Response.json({ error: "Enter a valid name, email, student ID, class, and password of at least 8 characters." }, { status: 400, headers: corsHeaders });
    }

    const { data: activeSession, error: sessionError } = await adminClient
      .from("academic_sessions")
      .select("id")
      .eq("is_active", true)
      .maybeSingle();
    if (sessionError) throw sessionError;
    if (!activeSession) {
      return Response.json({ error: "Set an active academic session before creating student accounts." }, { status: 409, headers: corsHeaders });
    }

    let { data: classRecord, error: classError } = await adminClient
      .from("classes")
      .select("id, is_active")
      .eq("name", className)
      .maybeSingle();
    if (classError) throw classError;
    if (classRecord && !classRecord.is_active) {
      const { error: restoreClassError } = await adminClient
        .from("classes")
        .update({ is_active: true })
        .eq("id", classRecord.id);
      if (restoreClassError) throw restoreClassError;
    } else if (!classRecord) {
      const createdClass = await adminClient.from("classes").insert({ name: className }).select("id").single();
      if (createdClass.error) throw createdClass.error;
      classRecord = { ...createdClass.data, is_active: true };
    }

    const { data: createdUser, error: createUserError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (createUserError || !createdUser.user) {
      return Response.json(
        { error: createUserError?.message ?? "Could not create the student account." },
        { status: 409, headers: corsHeaders },
      );
    }

    const userId = createdUser.user.id;
    const { error: profileInsertError } = await adminClient.from("profiles").insert({
      id: userId,
      role: "student",
      full_name: fullName,
    });
    if (profileInsertError) {
      await removeCreatedAuthUser(userId);
      return Response.json({ error: "Could not save the student profile." }, { status: 500, headers: corsHeaders });
    }

    const { error: studentInsertError } = await adminClient.from("student_profiles").insert({
      user_id: userId,
      student_number: studentNumber,
    });
    if (studentInsertError) {
      await removeCreatedAuthUser(userId);
      const duplicateStudentId = studentInsertError.code === "23505";
      return Response.json(
        { error: duplicateStudentId ? "That student ID is already in use." : "Could not save the student ID." },
        { status: duplicateStudentId ? 409 : 500, headers: corsHeaders },
      );
    }

    const { error: enrollmentError } = await adminClient.from("student_enrollments").insert({
      student_user_id: userId,
      class_id: classRecord.id,
      academic_session_id: activeSession.id,
    });
    if (enrollmentError) {
      await removeCreatedAuthUser(userId);
      return Response.json({ error: "Could not enroll the student in the active session." }, { status: 500, headers: corsHeaders });
    }

    return Response.json({ userId }, { status: 201, headers: corsHeaders });
  } catch (error) {
    console.error("Student account creation failed:", error);
    return Response.json({ error: "Student account creation failed. Check the school setup and try again." }, { status: 500, headers: corsHeaders });
  }
});
