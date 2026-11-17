import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const authorization = request.headers.get("Authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return jsonResponse({ error: "Authentication required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("Admin issue reports function is missing Supabase environment variables.");
    return jsonResponse({ error: "Issue reports service is not configured" }, 500);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) {
    return jsonResponse({ error: "Authentication required" }, 401);
  }
  if (authData.user.app_metadata?.role !== "admin") {
    return jsonResponse({ error: "Admin access required" }, 403);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const requestBody = await request.json().catch(() => ({}));
  const action = requestBody?.action ?? "list";
  const reportFields = "issue_report_admin_id,description,status,user_id,submitted_at,resolved_at,resolution_comment";

  if (action === "resolve") {
    const reportId = requestBody?.reportId;
    const resolutionComment = typeof requestBody?.resolutionComment === "string"
      ? requestBody.resolutionComment.trim()
      : "";
    if (typeof reportId !== "string" || !reportId) {
      return jsonResponse({ error: "A report ID is required" }, 400);
    }
    if (resolutionComment.length > 2000) {
      return jsonResponse({ error: "Resolution comments must be 2,000 characters or fewer" }, 400);
    }

    const { data, error } = await adminClient
      .from("issue_report")
      .update({
        status: "Resolved",
        resolved_at: new Date().toISOString(),
        resolution_comment: resolutionComment || null,
      })
      .eq("issue_report_admin_id", reportId)
      .neq("status", "Resolved")
      .select(reportFields)
      .maybeSingle();

    if (error) {
      console.error("Could not resolve issue report:", error.message);
      return jsonResponse({ error: "Could not resolve issue report" }, 500);
    }
    if (!data) return jsonResponse({ error: "Issue report was not found or is already resolved" }, 404);
    return jsonResponse({ report: data });
  }

  if (action !== "list") {
    return jsonResponse({ error: "Unsupported action" }, 400);
  }

  const { data, error } = await adminClient
    .from("issue_report")
    .select(reportFields);

  if (error) {
    console.error("Could not read issue_report table:", error.message);
    return jsonResponse({ error: "Could not load issue reports" }, 500);
  }

  return jsonResponse({ reports: data ?? [] });
});
