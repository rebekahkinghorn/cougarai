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

const submissionIdColumns = new Set([
  "id",
  "us_event_id",
  "user_submitted_event_id",
  "submission_id",
  "event_submission_id",
  "event_id",
]);

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
    console.error("Admin event submissions function is missing Supabase environment variables.");
    return jsonResponse({ error: "Event review service is not configured" }, 500);
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

  if (action === "update") {
    const submissionId = requestBody?.submissionId;
    const idColumn = typeof requestBody?.idColumn === "string" ? requestBody.idColumn : "";
    const event = requestBody?.event;
    if ((typeof submissionId !== "string" && typeof submissionId !== "number") || !submissionId) {
      return jsonResponse({ error: "A submission ID is required" }, 400);
    }
    if (!submissionIdColumns.has(idColumn.toLowerCase())) {
      return jsonResponse({ error: "The event submission ID column is not recognized" }, 400);
    }
    if (!event || typeof event !== "object") {
      return jsonResponse({ error: "Edited event details are required" }, 400);
    }

    const eventName = typeof event.event_name === "string" ? event.event_name.trim() : "";
    const streetAddress = typeof event.street_address === "string" ? event.street_address.trim() : "";
    const city = typeof event.city === "string" ? event.city : "";
    const zipCode = typeof event.zip_code === "string" ? event.zip_code.trim() : "";
    const startAt = typeof event.start_at === "string" ? event.start_at : "";
    const endAt = typeof event.end_at === "string" ? event.end_at : "";
    const categoryId = Number(event.event_category_id);
    if (
      !eventName || eventName.length > 120 || !streetAddress ||
      !["Provo", "Orem"].includes(city) || !/^\d{5}$/.test(zipCode) ||
      !Number.isInteger(categoryId) || categoryId < 1 || categoryId > 4 ||
      Number.isNaN(Date.parse(startAt)) || Number.isNaN(Date.parse(endAt)) ||
      Date.parse(endAt) <= Date.parse(startAt)
    ) {
      return jsonResponse({ error: "Complete valid event details are required" }, 422);
    }

    const location = `${streetAddress}, ${city}, UT ${zipCode}`;
    const { data: submission, error: updateError } = await adminClient
      .from("User_Submitted_Events")
      .update({
        event_name: eventName,
        start_at: startAt,
        end_at: endAt,
        location,
        street_address: streetAddress,
        city,
        zip_code: zipCode,
        event_category_id: categoryId,
      })
      .eq(idColumn, submissionId)
      .eq("is_published", false)
      .select("*")
      .maybeSingle();

    if (updateError) {
      console.error("Could not update event submission:", updateError.message);
      return jsonResponse({ error: "Could not save event edits" }, 500);
    }
    if (!submission) {
      return jsonResponse({ error: "Event submission was not found or is already approved" }, 404);
    }

    return jsonResponse({ submission: {
      submission_id: submission[idColumn],
      submission_id_column: idColumn,
      event_name: submission.event_name,
      start_at: submission.start_at,
      end_at: submission.end_at,
      location: submission.location,
      street_address: submission.street_address,
      city: submission.city,
      zip_code: submission.zip_code,
      event_category_id: submission.event_category_id,
      user_id: submission.user_id,
      submitted_at: submission.submitted_at ?? null,
    } });
  }

  if (action === "approve") {
    const submissionId = requestBody?.submissionId;
    const idColumn = typeof requestBody?.idColumn === "string"
      ? requestBody.idColumn
      : "";
    if ((typeof submissionId !== "string" && typeof submissionId !== "number") || !submissionId) {
      return jsonResponse({ error: "A submission ID is required" }, 400);
    }
    if (!submissionIdColumns.has(idColumn.toLowerCase())) {
      return jsonResponse({ error: "The event submission ID column is not recognized" }, 400);
    }

    // Claim the pending submission first so two admins cannot approve it twice.
    const { data: submission, error: claimError } = await adminClient
      .from("User_Submitted_Events")
      .update({ is_published: true })
      .eq(idColumn, submissionId)
      .eq("is_published", false)
      .select("*")
      .maybeSingle();

    if (claimError) {
      console.error("Could not claim event submission:", claimError.message);
      return jsonResponse({ error: "Could not approve this event submission" }, 500);
    }
    if (!submission) {
      return jsonResponse({ error: "Event submission was not found or is already approved" }, 404);
    }

    // The public."Event" table stores only the calendar fields shown in Supabase.
    // Address components and submitter ID remain on User_Submitted_Events.
    const approvedEvent = {
      event_name: submission.event_name,
      start_at: submission.start_at,
      end_at: submission.end_at,
      location: submission.location,
      event_category_id: submission.event_category_id,
      is_published: true,
    };
    if (
      typeof approvedEvent.event_name !== "string" || !approvedEvent.event_name.trim() ||
      !approvedEvent.start_at || !approvedEvent.end_at ||
      !approvedEvent.location || !approvedEvent.event_category_id
    ) {
      await adminClient
        .from("User_Submitted_Events")
        .update({ is_published: false })
        .eq(idColumn, submissionId)
        .eq("is_published", true);
      return jsonResponse({ error: "This submission is missing required event details" }, 422);
    }

    const { error: insertError } = await adminClient
      .from("Event")
      .insert(approvedEvent);
    if (insertError) {
      console.error("Could not copy approved event into Event:", insertError.message);
      const { error: rollbackError } = await adminClient
        .from("User_Submitted_Events")
        .update({ is_published: false })
        .eq(idColumn, submissionId)
        .eq("is_published", true);
      if (rollbackError) {
        console.error("Could not restore pending event submission:", rollbackError.message);
      }
      return jsonResponse({
        error: "Could not move this event into the Event table",
        detail: insertError.message,
      }, 500);
    }

    return jsonResponse({ approved: true, submissionId });
  }

  if (action !== "list") {
    return jsonResponse({ error: "Unsupported action" }, 400);
  }

  const { data, error } = await adminClient
    .from("User_Submitted_Events")
    .select("*")
    .eq("is_published", false)
    .order("start_at", { ascending: true });

  if (error) {
    console.error("Could not read User_Submitted_Events:", error.message);
    return jsonResponse({ error: "Could not load event submissions" }, 500);
  }

  const submissions = (data ?? []).map((submission) => {
    const idColumn = Object.keys(submission).find((column) =>
      submissionIdColumns.has(column.toLowerCase())
    ) ?? null;
    return {
      submission_id: idColumn ? submission[idColumn] : null,
      submission_id_column: idColumn,
      event_name: submission.event_name,
      start_at: submission.start_at,
      end_at: submission.end_at,
      location: submission.location,
      street_address: submission.street_address,
      city: submission.city,
      zip_code: submission.zip_code,
      event_category_id: submission.event_category_id,
      user_id: submission.user_id,
      submitted_at: submission.submitted_at ?? null,
    };
  });

  return jsonResponse({ submissions });
});
