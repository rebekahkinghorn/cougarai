const METRICS_TABLE = "chatbot_answer_validity_summary";
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

document.addEventListener("DOMContentLoaded", async () => {
  await window.siteLayoutReady;

  const tableBody = document.querySelector("#metrics-table-body");
  const status = document.querySelector("#metrics-status");
  const refreshAllButton = document.querySelector("#refresh-all-metrics");
  const feedbackHead = document.querySelector("#feedback-metrics-head");
  const feedbackBody = document.querySelector("#feedback-metrics-body");
  const feedbackStatus = document.querySelector("#feedback-metrics-status");
  const client = window.cougarAuth?.client;

  const setTableMessage = (message) => {
    tableBody.replaceChildren();
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.className = "metrics-placeholder";
    cell.colSpan = METRIC_COLUMNS.length;
    cell.textContent = message;
    row.appendChild(cell);
    tableBody.appendChild(row);
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
      const { data, error } = await client
        .from(METRICS_TABLE)
        .select(METRIC_COLUMNS.join(","));

      if (error) throw error;

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

      status.textContent = `Showing ${data.length} ${data.length === 1 ? "summary row" : "summary rows"}.`;
    } catch (error) {
      console.error("Metrics load error:", error);
      status.textContent = "Could not load metrics. Check the table’s Data API access, SELECT grant, and RLS policy.";
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
      const { data, error } = await client
        .from("chat_feedback_summary")
        .select(FEEDBACK_COLUMNS.join(","));

      if (error) throw error;

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
      feedbackStatus.textContent = `Showing ${data.length} ${data.length === 1 ? "feedback summary row" : "feedback summary rows"}.`;
    } catch (error) {
      console.error("Feedback metrics load error:", error);
      feedbackStatus.textContent = "Could not load feedback metrics. Check the table’s Data API access, SELECT grant, and RLS policy.";
      setFeedbackMessage("Feedback metrics are unavailable. Check the browser console for details.");
    }
  };

  const refreshAllMetrics = async () => {
    refreshAllButton.disabled = true;
    refreshAllButton.textContent = "Refreshing…";
    try {
      await Promise.all([loadMetrics(), loadFeedbackMetrics()]);
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
