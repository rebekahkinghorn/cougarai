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
const METRIC_LABELS = {
  valid_answers: "Valid answers",
  no_answers: "No answers",
  classified_answers: "Classified answers",
  valid_answer_percent: "Valid answer percent",
  no_answer_percent: "No answer percent",
};
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
  const answerHead = document.querySelector("#answer-metrics-head");
  const status = document.querySelector("#metrics-status");
  const refreshAllButton = document.querySelector("#refresh-all-metrics");
  const feedbackHead = document.querySelector("#feedback-metrics-head");
  const feedbackBody = document.querySelector("#feedback-metrics-body");
  const feedbackStatus = document.querySelector("#feedback-metrics-status");
  const repeatUsageBody = document.querySelector("#repeat-usage-body");
  const repeatUsageStatus = document.querySelector("#repeat-usage-status");
  const sessionMetricsBody = document.querySelector("#session-metrics-body");
  const sessionMetricsStatus = document.querySelector("#session-metrics-status");
  const repeatUsageMonthOptions = document.querySelector("#repeat-usage-month-options");
  const selectAllUsageMonths = document.querySelector("#select-all-usage-months");
  const includeMonthToDate = document.querySelector("#include-month-to-date");
  const includeLast30Days = document.querySelector("#include-last-30-days");
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
  let answerValidityRows = null;
  let feedbackRows = null;
  let repeatUsageRows = null;
  let sessionActivityRows = null;
  let selectedUsageMonths = null;
  let knownUsageMonths = new Set();
  let availableUsageMonths = new Set();

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

  const setTableMessage = (message, colspan = 1) => {
    tableBody.replaceChildren();
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.className = "metrics-placeholder";
    cell.colSpan = colspan;
    cell.textContent = message;
    row.appendChild(cell);
    tableBody.appendChild(row);
    applyResponsiveTableLabels(tableBody);
  };

  const selectedAnswerColumns = () => METRIC_COLUMNS;

  const renderAnswerMetrics = () => {
    if (!answerValidityRows) return;
    const columns = selectedAnswerColumns();
    answerHead.replaceChildren();
    if (!columns.length) {
      status.textContent = "Select at least one metric to display.";
      setTableMessage("Choose a metric above to show its data.");
      return;
    }
    const headerRow = document.createElement("tr");
    columns.forEach((column) => {
      const header = document.createElement("th");
      header.scope = "col";
      header.textContent = METRIC_LABELS[column];
      headerRow.appendChild(header);
    });
    answerHead.replaceChildren(headerRow);
    if (!answerValidityRows.length) {
      status.textContent = "The summary table returned no rows.";
      setTableMessage("No metrics are available yet.", columns.length);
      return;
    }
    const rows = answerValidityRows.map((record) => {
      const row = document.createElement("tr");
      columns.forEach((column) => {
        const cell = document.createElement("td");
        cell.textContent = formatMetric(record[column], column.includes("percent"));
        row.appendChild(cell);
      });
      return row;
    });
    tableBody.replaceChildren(...rows);
    applyResponsiveTableLabels(tableBody);
    status.textContent = `Showing ${answerValidityRows.length} ${answerValidityRows.length === 1 ? "summary row" : "summary rows"} with ${columns.length} selected metrics.`;
  };

  const loadMetrics = async () => {
    answerValidityRows = null;
    status.textContent = "Loading metrics…";
    answerHead.replaceChildren();
    setTableMessage("Loading metrics…");
    try {
      const { data: result, error } = await getAdminMetrics();
      if (error) throw error;
      answerValidityRows = result?.answerValidity ?? [];
      renderAnswerMetrics();
    } catch (error) {
      console.error("Metrics load error:", error);
      status.textContent = error?.context?.status === 403
        ? "Admin access is required to load these metrics."
        : "Could not load metrics. Check that the admin-metrics Edge Function is deployed and the summary views are available.";
      setTableMessage("Metrics are unavailable. Check the browser console for details.");
    }
  };

  const setFeedbackMessage = (message, colspan = 1) => {
    feedbackHead.replaceChildren();
    feedbackBody.replaceChildren();
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.className = "metrics-placeholder";
    cell.colSpan = colspan;
    cell.textContent = message;
    row.appendChild(cell);
    feedbackBody.appendChild(row);
    applyResponsiveTableLabels(feedbackBody);
  };

  const selectedFeedbackColumns = () => FEEDBACK_COLUMNS;

  const renderFeedbackMetrics = () => {
    if (!feedbackRows) return;
    const columns = selectedFeedbackColumns();
    feedbackHead.replaceChildren();
    if (!columns.length) {
      feedbackStatus.textContent = "Select at least one metric to display.";
      setFeedbackMessage("Choose a metric above to show its data.");
      return;
    }
    const headerRow = document.createElement("tr");
    columns.forEach((column) => {
      const header = document.createElement("th");
      header.scope = "col";
      header.textContent = FEEDBACK_LABELS[column];
      headerRow.appendChild(header);
    });
    feedbackHead.replaceChildren(headerRow);
    if (!feedbackRows.length) {
      feedbackStatus.textContent = "The feedback summary table returned no rows.";
      setFeedbackMessage("No feedback metrics are available yet.", columns.length);
      return;
    }
    const rows = feedbackRows.map((record) => {
      const row = document.createElement("tr");
      columns.forEach((column) => {
        const cell = document.createElement("td");
        cell.textContent = formatMetric(record[column], /percent|percentage|rate/i.test(column));
        row.appendChild(cell);
      });
      return row;
    });
    feedbackBody.replaceChildren(...rows);
    applyResponsiveTableLabels(feedbackBody);
    feedbackStatus.textContent = `Showing ${feedbackRows.length} ${feedbackRows.length === 1 ? "feedback summary row" : "feedback summary rows"} with ${columns.length} selected metrics.`;
  };

  const loadFeedbackMetrics = async () => {
    feedbackRows = null;
    feedbackStatus.textContent = "Loading feedback metrics…";
    setFeedbackMessage("Loading feedback metrics…");
    try {
      const { data: result, error } = await getAdminMetrics();
      if (error) throw error;
      feedbackRows = result?.chatFeedback ?? [];
      renderFeedbackMetrics();
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

  const getUsagePeriodType = (record) => {
    const label = String(record.period_label ?? "").toLowerCase();
    if (label.includes("month to date")) return "month-to-date";
    if (/30\s*days?/.test(label)) return "last-30-days";
    return "calendar-month";
  };

  const getUsageMonthKey = (record) => String(record.period_start ?? record.period_label ?? "");

  const updateUsageMonthFilters = (rows) => {
    const monthRows = rows.filter((record) => getUsagePeriodType(record) === "calendar-month");
    availableUsageMonths = new Set(monthRows.map(getUsageMonthKey));
    if (selectedUsageMonths === null) {
      selectedUsageMonths = new Set(availableUsageMonths);
    } else {
      availableUsageMonths.forEach((key) => {
        if (!knownUsageMonths.has(key)) selectedUsageMonths.add(key);
      });
      selectedUsageMonths = new Set([...selectedUsageMonths].filter((key) => availableUsageMonths.has(key)));
    }
    knownUsageMonths = new Set(availableUsageMonths);
    repeatUsageMonthOptions.replaceChildren();
    monthRows.forEach((record) => {
      const key = getUsageMonthKey(record);
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.dataset.usageMonth = key;
      checkbox.checked = selectedUsageMonths.has(key);
      label.append(checkbox, document.createTextNode(` ${record.period_label}`));
      repeatUsageMonthOptions.appendChild(label);
    });
    selectAllUsageMonths.checked = availableUsageMonths.size > 0 &&
      selectedUsageMonths.size === availableUsageMonths.size;
  };

  const renderRepeatUsageMetrics = () => {
    if (!repeatUsageRows) return;
    const visibleRows = repeatUsageRows.filter((record) => {
      const periodType = getUsagePeriodType(record);
      if (periodType === "month-to-date") return includeMonthToDate.checked;
      if (periodType === "last-30-days") return includeLast30Days.checked;
      return selectedUsageMonths.has(getUsageMonthKey(record));
    });
    if (!visibleRows.length) {
      repeatUsageStatus.textContent = "No periods match the selected filters.";
      setRepeatUsageMessage("Choose one or more months or time periods above.");
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
    const renderedRows = visibleRows.map((record) => {
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
    repeatUsageStatus.textContent = `Showing ${visibleRows.length} of ${repeatUsageRows.length} periods. Green meets the 50% goal; red is below it.`;
  };

  const loadRepeatUsageMetrics = async () => {
    repeatUsageRows = null;
    repeatUsageStatus.textContent = "Loading repeat usage…";
    setRepeatUsageMessage("Loading repeat usage…");
    try {
      const { data: result, error } = await getAdminMetrics();
      if (error) throw error;
      const rows = result?.repeatUsage ?? [];
      if (!rows.length) {
        repeatUsageStatus.textContent = result?.repeatUsageError
          ? "The monthly repeat-use view is not available yet. Create it in Supabase, then redeploy the Edge Function."
          : "The monthly repeat-use view has no rows yet.";
        setRepeatUsageMessage(result?.repeatUsageError
          ? "The repeat-use summary view could not be read."
          : "No repeat-use metrics are available yet.");
        return;
      }
      repeatUsageRows = rows;
      updateUsageMonthFilters(rows);
      renderRepeatUsageMetrics();
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

  const renderSessionActivityMetrics = () => {
    if (!sessionActivityRows) return;
    const selectedPages = new Set(["chatbot", "faq", "calendar"]);
    const weekLimit = 12;
    const weeks = [...new Set(sessionActivityRows.map((record) => record.week_start))]
      .sort((a, b) => b.localeCompare(a))
      .slice(0, weekLimit);
    const selectedWeeks = new Set(weeks);
    const visibleRows = sessionActivityRows.filter((record) =>
      selectedPages.has(record.page_key) && selectedWeeks.has(record.week_start)
    );
    if (!visibleRows.length) {
      sessionMetricsStatus.textContent = "No session activity matches the selected filters.";
      setSessionActivityMessage("Choose one or more pages and weeks above.");
      return;
    }
    const pageLabels = { chatbot: "Chatbot", faq: "FAQ", calendar: "Calendar" };
    const formatWeek = (value) => value
      ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`))
      : "—";
    const renderedRows = visibleRows.map((record) => {
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
    sessionMetricsStatus.textContent = `Showing ${visibleRows.length} of ${sessionActivityRows.length} weekly page summaries across the latest ${weeks.length} weeks.`;
  };

  const loadSessionActivityMetrics = async () => {
    sessionActivityRows = null;
    sessionMetricsStatus.textContent = "Loading session activity…";
    setSessionActivityMessage("Loading session activity…");
    try {
      const { data: result, error } = await getAdminMetrics();
      if (error) throw error;
      const rows = result?.sessionActivity ?? [];
      if (!rows.length) {
        sessionMetricsStatus.textContent = result?.sessionActivityError
          ? "The session activity summary is unavailable. Apply its SQL migration and deploy the updated admin-metrics function."
          : "No visits have been recorded yet.";
        setSessionActivityMessage(result?.sessionActivityError
          ? "Session activity is unavailable. Check the Supabase function logs."
          : "There is no session activity for the last 12 weeks yet.");
        return;
      }
      sessionActivityRows = rows;
      renderSessionActivityMetrics();
    } catch (error) {
      console.error("Session activity metrics load error:", error);
      sessionMetricsStatus.textContent = "Could not load session activity. Check the page_engagement_weekly_summary view and deployed admin-metrics function.";
      setSessionActivityMessage("Session activity is unavailable. Check the Supabase function logs.");
    }
  };

  repeatUsageMonthOptions.addEventListener("change", (event) => {
    const input = event.target.closest("[data-usage-month]");
    if (!input) return;
    if (input.checked) selectedUsageMonths.add(input.dataset.usageMonth);
    else selectedUsageMonths.delete(input.dataset.usageMonth);
    selectAllUsageMonths.checked = availableUsageMonths.size > 0 &&
      selectedUsageMonths.size === availableUsageMonths.size;
    renderRepeatUsageMetrics();
  });
  selectAllUsageMonths.addEventListener("change", () => {
    selectedUsageMonths = selectAllUsageMonths.checked
      ? new Set(availableUsageMonths)
      : new Set();
    repeatUsageMonthOptions.querySelectorAll("[data-usage-month]").forEach((input) => {
      input.checked = selectAllUsageMonths.checked;
    });
    renderRepeatUsageMetrics();
  });
  includeMonthToDate.addEventListener("change", renderRepeatUsageMetrics);
  includeLast30Days.addEventListener("change", renderRepeatUsageMetrics);

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
