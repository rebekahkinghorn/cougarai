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

const isUuid = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const body = await request.json().catch(() => null);
  if (!body || !isUuid(body.visitorId) || !isUuid(body.sessionId)) {
    return jsonResponse({ error: "Valid visitor and session IDs are required" }, 400);
  }
  if (!["chatbot", "faq", "calendar"].includes(body.page)) {
    return jsonResponse({ error: "Unsupported page" }, 400);
  }
  if (!Number.isInteger(body.engagedSeconds) || body.engagedSeconds < 0 || body.engagedSeconds > 86400) {
    return jsonResponse({ error: "Engaged time must be a whole number between 0 and 86,400 seconds" }, 400);
  }

  const startedAt = Date.parse(body.startedAt);
  const now = Date.now();
  if (!Number.isFinite(startedAt) || startedAt > now + 300000 || startedAt < now - 86400000) {
    return jsonResponse({ error: "Visit start time is invalid" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Page activity function is missing Supabase environment variables.");
    return jsonResponse({ error: "Page activity service is not configured" }, 500);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await adminClient
    .from("page_session_activity")
    .upsert({
      visitor_id: body.visitorId,
      session_id: body.sessionId,
      page_key: body.page,
      started_at: new Date(startedAt).toISOString(),
      engaged_seconds: body.engagedSeconds,
      updated_at: new Date(now).toISOString(),
    }, { onConflict: "session_id,page_key" });

  if (error) {
    console.error("Could not save page activity:", error.message);
    return jsonResponse({ error: "Could not save page activity" }, 500);
  }

  return jsonResponse({ success: true });
});
