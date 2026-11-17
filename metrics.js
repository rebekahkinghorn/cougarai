const METRIC_COLUMNS = [
  "valid_answers",
  "no_answers",
  "classified_answers",
  "valid_answer_percent",
  "no_answer_percent",
];
const FEEDBACK_COLUMNS = [
  "total_responses",
  "average_rating",
  "one_star",
  "two_stars",
  "three_stars",
  "four_stars",
  "five_stars",
];
const FEEDBACK_LABELS = {
  total_responses: "Total responses",
  average_rating: "Average rating",
  one_star: "One star",
  two_stars: "Two stars",
  three_stars: "Three stars",
  four_stars: "Four stars",
  five_stars: "Five stars",
};

const formatMetric = (value, isPercent = false) => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return String(value);

  if (isPercent) {
    const percent = numericValue >= 0 && numericValue <= 1
      ? numericValue * 100
      : numericValue;
    return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(percent)}%`;
  }

  return new Intl.NumberFormat().format(numericValue);
};

const formatPercentPoints = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return String(value);
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(numericValue)}%`;
};

const formatEngagedDuration = (value) => {
  const totalSeconds = Number(value);
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "—";
  const roundedSeconds = Math.round(totalSeconds);
  const minutes = Math.floor(roundedSeconds / 60);
  const seconds = roundedSeconds % 60;
  if (!minutes) return `${seconds} sec`;
  if (minutes < 60) return `${minutes} min ${seconds} sec`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hr ${minutes % 60} min`;
};

document.addEventListener("DOMContentLoaded", async () => {
  await window.siteLayoutReady;

  const tableBody = document.querySelector("#metrics-table-body");
  const status = document.querySelector("#metrics-status");
  const refreshAllButton = document.querySelector("#refresh-all-metrics");
  const feedbackHead = document.querySelector("#feedback-metrics-head");
  const feedbackBody = document.querySelector("#feedback-metrics-body");
  const feedbackStatus = document.querySelector("#feedback-metrics-status");
  const repeatUsageBody = document.querySelector("#repeat-usage-body");
  const repeatUsageStatus = document.querySelector("#repeat-usage-status");
  const sessionMetricsBody = document.querySelector("#session-metrics-body");
  const sessionMetricsStatus = document.querySelector("#session-metrics-status");
  const client = window.cougarAuth?.client;
  const dashboard = document.querySelector("#metrics-dashboard");
  // Mobile card rows use the column heading as a visible label for every value.
  const applyResponsiveTableLabels = (tbody) => {
    const labels = [...tbody.closest("table").querySelectorAll("thead th")]
      .map((header) => header.textContent.trim());
    tbody.querySelectorAll("tr").forEach((row) => {
      [...row.cells].forEach((cell, index) => {
        if (cell.colSpan === 1 && labels[index]) cell.dataset.label = labels[index];
      });
    });
  };
  let adminMetricsRequest;

  const getAdminMetrics = () => {
    if (!adminMetricsRequest) {
      adminMetricsRequest = client.functions.invoke("admin-metrics");
    }
    return adminMetricsRequest;
  };

  if (!client) {
    document.dispatchEvent(new CustomEvent("cougar:admin-auth-required"));
    return;
  }

  try {
    const { data, error } = await client.auth.getUser();
    if (error || !data?.user) {
      document.dispatchEvent(new CustomEvent("cougar:admin-auth-required"));
      return;
    }
    if (data.user.app_metadata?.role !== "admin") {
      document.dispatchEvent(new CustomEvent("cougar:admin-auth-required", {
        detail: { reason: "admin-required" },
      }));
      return;
    }
    if (dashboard) dashboard.hidden = false;
  } catch (error) {
    console.error("Admin access check failed:", error);
    document.dispatchEvent(new CustomEvent("cougar:admin-auth-required"));
    return;
  }

  const setTableMessage = (message) => {
    tableBody.replaceChildren();
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.className = "metrics-placeholder";
    cell.colSpan = METRIC_COLUMNS.length;
    cell.textContent = message;
    row.appendChild(cell);
    tableBody.appendChild(row);
    applyResponsiveTableLabels(tableBody);
  };

  const loadMetrics = async () => {
    if (!client) {
      status.textContent = "Supabase is unavailable. Check the page connection scripts.";
      setTableMessage("Metrics could not be loaded.");
      return;
    }

    status.textContent = "Loading metrics…";
    setTableMessage("Loading metrics…");

    try {
      const { data: result, error } = await getAdminMetrics();
      if (error) throw error;
      const data = result?.answerValidity;

      if (!data?.length) {
        status.textContent = "The summary table returned no rows.";
        setTableMessage("No metrics are available yet.");
        return;
      }

      tableBody.replaceChildren();
      data.forEach((record) => {
        const row = document.createElement("tr");
        METRIC_COLUMNS.forEach((column, index) => {
          const cell = document.createElement("td");
          cell.textContent = formatMetric(record[column], index >= 3);
          row.appendChild(cell);
        });
        tableBody.appendChild(row);
      });
      applyResponsiveTableLabels(tableBody);

      status.textContent = `Showing ${data.length} ${data.length === 1 ? "summary row" : "summary rows"}.`;
    } catch (error) {
      console.error("Metrics load error:", error);
      status.textContent = error?.context?.status === 403
        ? "Admin access is required to load these metrics."
        : "Could not load metrics. Check that the admin-metrics Edge Function is deployed and the summary views are available.";
      setTableMessage("Metrics are unavailable. Check the browser console for details.");
    }
  };

  const setFeedbackMessage = (message) => {
    feedbackHead.replaceChildren();
    feedbackBody.replaceChildren();
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.className = "metrics-placeholder";
    cell.colSpan = FEEDBACK_COLUMNS.length;
    cell.textContent = message;
    row.appendChild(cell);
    feedbackBody.appendChild(row);
    applyResponsiveTableLabels(feedbackBody);
  };

  const loadFeedbackMetrics = async () => {
    if (!client) {
      feedbackStatus.textContent = "Supabase is unavailable. Check the page connection scripts.";
      setFeedbackMessage("Feedback metrics could not be loaded.");
      return;
    }

    feedbackStatus.textContent = "Loading feedback metrics…";
    setFeedbackMessage("Loading feedback metrics…");

    try {
      const { data: result, error } = await getAdminMetrics();
      if (error) throw error;
      const data = result?.chatFeedback;

      if (!data?.length) {
        feedbackStatus.textContent = "The feedback summary table returned no rows.";
        setFeedbackMessage("No feedback metrics are available yet.");
        return;
      }

      const headerRow = document.createElement("tr");
      FEEDBACK_COLUMNS.forEach((column) => {
        const header = document.createElement("th");
        header.scope = "col";
        header.textContent = FEEDBACK_LABELS[column];
        headerRow.appendChild(header);
      });
      feedbackHead.replaceChildren(headerRow);

      const rows = data.map((record) => {
        const row = document.createElement("tr");
        FEEDBACK_COLUMNS.forEach((column) => {
          const cell = document.createElement("td");
          cell.textContent = formatMetric(record[column], /percent|percentage|rate/i.test(column));
          row.appendChild(cell);
        });
        return row;
      });
      feedbackBody.replaceChildren(...rows);
      applyResponsiveTableLabels(feedbackBody);
      feedbackStatus.textContent = `Showing ${data.length} ${data.length === 1 ? "feedback summary row" : "feedback summary rows"}.`;
    } catch (error) {
      console.error("Feedback metrics load error:", error);
      feedbackStatus.textContent = error?.context?.status === 403
        ? "Admin access is required to load these metrics."
        : "Could not load feedback metrics. Check that the admin-metrics Edge Function is deployed and the summary views are available.";
      setFeedbackMessage("Feedback metrics are unavailable. Check the browser console for details.");
    }
  };

  const setRepeatUsageMessage = (message) => {
    repeatUsageBody.replaceChildren();
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.className = "metrics-placeholder";
    cell.colSpan = 5;
    cell.textContent = message;
    row.appendChild(cell);
    repeatUsageBody.appendChild(row);
    applyResponsiveTableLabels(repeatUsageBody);
  };

  const loadRepeatUsageMetrics = async () => {
    repeatUsageStatus.textContent = "Loading repeat usage…";
    setRepeatUsageMessage("Loading repeat usage…");

    try {
      const { data: result, error } = await getAdminMetrics();
      if (error) throw error;
      const rows = result?.repeatUsage;
      if (!rows?.length) {
        repeatUsageStatus.textContent = result?.repeatUsageError
          ? "The monthly repeat-use view is not available yet. Create it in Supabase, then redeploy the Edge Function."
          : "The monthly repeat-use view has no rows yet.";
        setRepeatUsageMessage(result?.repeatUsageError
          ? "The repeat-use summary view could not be read."
          : "No repeat-use metrics are available yet.");
        return;
      }

      const formatDate = (value) => {
        if (!value) return "";
        return new Intl.DateTimeFormat(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        }).format(new Date(`${value}T00:00:00Z`));
      };

      const renderedRows = rows.map((record) => {
        const row = document.createElement("tr");
        const period = document.createElement("td");
        period.textContent = `${record.period_label} (${formatDate(record.period_start)}–${formatDate(record.period_end)})`;
        row.appendChild(period);
        [record.active_users, record.repeat_users].forEach((value) => {
          const cell = document.createElement("td");
          cell.textContent = formatMetric(value);
          row.appendChild(cell);
        });
        const repeatPercent = document.createElement("td");
        repeatPercent.textContent = formatPercentPoints(record.repeat_user_percent);
        const rate = Number(record.repeat_user_percent);
        const targetRate = Number(record.goal_percent);
        if (Number.isFinite(rate) && Number.isFinite(targetRate)) {
          repeatPercent.className = rate >= targetRate ? "okr-hit" : "okr-miss";
          repeatPercent.setAttribute(
            "aria-label",
            rate >= targetRate ? "OKR target met" : "OKR target not met",
          );
        }
        row.appendChild(repeatPercent);
        const target = document.createElement("td");
        target.textContent = formatPercentPoints(record.goal_percent);
        row.appendChild(target);
        return row;
      });
      repeatUsageBody.replaceChildren(...renderedRows);
      applyResponsiveTableLabels(repeatUsageBody);
      repeatUsageStatus.textContent = "Repeat users sent chatbot messages on at least two distinct UTC dates. Calendar months run oldest to newest; the current month is month to date, followed by the rolling last 30 days. Green meets the 50% goal; red is below it.";
    } catch (error) {
      console.error("Repeat-use metrics load error:", error);
      repeatUsageStatus.textContent = "Could not load repeat-use metrics. Check the monthly repeat-use view and deployed Edge Function.";
      setRepeatUsageMessage("Repeat-use metrics are unavailable. Check the Supabase function logs for details.");
    }
  };

  const setSessionActivityMessage = (message) => {
    sessionMetricsBody.replaceChildren();
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.className = "metrics-placeholder";
    cell.colSpan = 6;
    cell.textContent = message;
    row.appendChild(cell);
    sessionMetricsBody.appendChild(row);
    applyResponsiveTableLabels(sessionMetricsBody);
  };

  const loadSessionActivityMetrics = async () => {
    sessionMetricsStatus.textContent = "Loading session activity…";
    setSessionActivityMessage("Loading session activity…");
    try {
      const { data: result, error } = await getAdminMetrics();
      if (error) throw error;
      const rows = result?.sessionActivity;
      if (!rows?.length) {
        sessionMetricsStatus.textContent = result?.sessionActivityError
          ? "The session activity summary is unavailable. Apply its SQL migration and deploy the updated admin-metrics function."
          : "No visits have been recorded yet.";
        setSessionActivityMessage(result?.sessionActivityError
          ? "Session activity is unavailable. Check the Supabase function logs."
          : "There is no session activity for the last 12 weeks yet.");
        return;
      }

      const pageLabels = { chatbot: "Chatbot", faq: "FAQ", calendar: "Calendar" };
      const formatWeek = (value) => value
        ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`))
        : "—";
      const renderedRows = rows.map((record) => {
        const row = document.createElement("tr");
        [
          formatWeek(record.week_start),
          pageLabels[record.page_key] || record.page_key,
          formatMetric(record.total_visits),
          formatMetric(record.unique_visitors),
          formatEngagedDuration(record.median_engaged_seconds),
          formatEngagedDuration(record.average_engaged_seconds),
        ].forEach((value) => {
          const cell = document.createElement("td");
          cell.textContent = value;
          row.appendChild(cell);
        });
        return row;
      });
      sessionMetricsBody.replaceChildren(...renderedRows);
      applyResponsiveTableLabels(sessionMetricsBody);
      sessionMetricsStatus.textContent = `Showing ${rows.length} weekly page summaries from the last 12 weeks.`;
    } catch (error) {
      console.error("Session activity metrics load error:", error);
      sessionMetricsStatus.textContent = "Could not load session activity. Check the page_engagement_weekly_summary view and deployed admin-metrics function.";
      setSessionActivityMessage("Session activity is unavailable. Check the Supabase function logs.");
    }
  };

  const refreshAllMetrics = async () => {
    refreshAllButton.disabled = true;
    refreshAllButton.textContent = "Refreshing…";
    adminMetricsRequest = null;
    try {
      await Promise.all([loadMetrics(), loadFeedbackMetrics(), loadRepeatUsageMetrics(), loadSessionActivityMetrics()]);
    } finally {
      refreshAllButton.disabled = false;
      refreshAllButton.textContent = "Refresh all metrics";
    }
  };

  refreshAllButton.addEventListener("click", refreshAllMetrics);
  await refreshAllMetrics();

  // Refresh after sign-in so policies requiring an authenticated user can apply.
  client?.auth.onAuthStateChange((_event, session) => {
    if (session) {
      window.setTimeout(refreshAllMetrics, 0);
    }
  });
});
