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
    console.error("Admin metrics function is missing Supabase environment variables.");
    return jsonResponse({ error: "Metrics service is not configured" }, 500);
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

  // This elevated client is used only after checking the signed-in user's trusted role.
  // It reads aggregate views only and never exposes its service-role key to the browser.
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const [validityResult, feedbackResult, repeatUsageResult] = await Promise.all([
    adminClient
      .from("chatbot_answer_validity_summary")
      .select("valid_answers,no_answers,classified_answers,valid_answer_percent,no_answer_percent"),
    adminClient
      .from("chat_feedback_summary")
      .select("total_responses,average_rating,one_star,two_stars,three_stars,four_stars,five_stars"),
    adminClient
      .from("chatbot_monthly_repeat_usage_summary")
      .select("period_label,period_start,period_end,active_users,repeat_users,repeat_user_percent,goal_percent,sort_order")
      .order("sort_order", { ascending: true }),
  ]);

  if (validityResult.error || feedbackResult.error) {
    console.error("Could not read admin summary views:", {
      validity: validityResult.error?.message,
      feedback: feedbackResult.error?.message,
    });
    return jsonResponse({ error: "Could not load metrics" }, 500);
  }
  if (repeatUsageResult.error) {
    console.error("Could not read monthly repeat-use view:", repeatUsageResult.error.message);
  }

  return jsonResponse({
    answerValidity: validityResult.data ?? [],
    chatFeedback: feedbackResult.data ?? [],
    repeatUsage: repeatUsageResult.error ? [] : repeatUsageResult.data ?? [],
    repeatUsageError: repeatUsageResult.error ? "Repeat-use summary view is unavailable" : null,
  });
});
