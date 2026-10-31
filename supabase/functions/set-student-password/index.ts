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
    if (!url || !anonKey || !serviceKey) throw new Error("Function secrets are not configured.");

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
    const { data: callerProfile, error: callerProfileError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", caller.user.id)
      .maybeSingle();
    if (callerProfileError) throw callerProfileError;
    if (callerProfile?.role !== "admin") {
      return Response.json({ error: "Only administrators can change student passwords." }, { status: 403, headers: corsHeaders });
    }

    const body: unknown = await request.json();
    if (!isRecord(body)) {
      return Response.json({ error: "Submit a valid student and password." }, { status: 400, headers: corsHeaders });
    }
    const studentUserId = typeof body.studentUserId === "string" ? body.studentUserId : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(studentUserId)) {
      return Response.json({ error: "Select a valid student account." }, { status: 400, headers: corsHeaders });
    }
    if (password.length < 8 || password.length > 256) {
      return Response.json({ error: "The password must be between 8 and 256 characters." }, { status: 400, headers: corsHeaders });
    }

    const { data: studentProfile, error: studentProfileError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", studentUserId)
      .maybeSingle();
    if (studentProfileError) throw studentProfileError;
    if (studentProfile?.role !== "student") {
      return Response.json({ error: "The selected account is not a student account." }, { status: 404, headers: corsHeaders });
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(studentUserId, { password });
    if (updateError) throw updateError;

    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    console.error("Student password update failed:", error);
    return Response.json({ error: "Could not update the student password. Try again later." }, { status: 500, headers: corsHeaders });
  }
});
