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
    const body: unknown = await request.json();
    if (!isRecord(body)) {
      return Response.json({ error: "Invalid ID or password." }, { status: 400, headers: corsHeaders });
    }
    const studentNumber = typeof body.studentNumber === "string" ? body.studentNumber.trim().toUpperCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!/^[A-Z0-9][A-Z0-9/._-]{0,63}$/.test(studentNumber) || !password || password.length > 256) {
      return Response.json({ error: "Invalid ID or password." }, { status: 400, headers: corsHeaders });
    }

    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !serviceKey) throw new Error("Supabase function secrets are not configured.");

    const adminClient = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: student, error: studentError } = await adminClient
      .from("student_profiles")
      .select("user_id")
      .ilike("student_number", studentNumber)
      .maybeSingle();

    if (studentError) {
      console.error("Student ID lookup failed:", studentError);
      return Response.json({ error: "Sign-in is temporarily unavailable." }, { status: 500, headers: corsHeaders });
    }
    if (!student) {
      return Response.json({ error: "Invalid ID or password." }, { status: 401, headers: corsHeaders });
    }

    const { data: studentProfile, error: studentProfileError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", student.user_id)
      .maybeSingle();
    if (studentProfileError) {
      console.error("Student role lookup failed:", studentProfileError);
      return Response.json({ error: "Sign-in is temporarily unavailable." }, { status: 500, headers: corsHeaders });
    }
    if (studentProfile?.role !== "student") {
      return Response.json({ error: "Invalid ID or password." }, { status: 401, headers: corsHeaders });
    }

    const { data: authUser, error: authUserError } = await adminClient.auth.admin.getUserById(student.user_id);
    const email = authUser.user?.email;
    if (authUserError || !email) {
      console.error("Could not resolve the student's authentication account:", authUserError);
      return Response.json({ error: "Invalid ID or password." }, { status: 401, headers: corsHeaders });
    }

    const signInClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await signInClient.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      return Response.json({ error: "Invalid ID or password." }, { status: 401, headers: corsHeaders });
    }

    return Response.json({ session: data.session }, { headers: corsHeaders });
  } catch (error) {
    console.error("Student ID sign-in failed:", error);
    return Response.json({ error: "Sign-in is temporarily unavailable." }, { status: 500, headers: corsHeaders });
  }
});
