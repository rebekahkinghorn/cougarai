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

document.addEventListener("DOMContentLoaded", async () => {
  await window.siteLayoutReady;

  const tableBody = document.querySelector("#metrics-table-body");
  const status = document.querySelector("#metrics-status");
  const refreshAllButton = document.querySelector("#refresh-all-metrics");
  const generateFaqButton = document.querySelector("#generate-faq-suggestions");
  const faqGenerationStatus = document.querySelector("#faq-generation-status");
  const feedbackHead = document.querySelector("#feedback-metrics-head");
  const feedbackBody = document.querySelector("#feedback-metrics-body");
  const feedbackStatus = document.querySelector("#feedback-metrics-status");
  const repeatUsageBody = document.querySelector("#repeat-usage-body");
  const repeatUsageStatus = document.querySelector("#repeat-usage-status");
  const pendingFaqStatus = document.querySelector("#faq-pending-status");
  const reviewCount = document.querySelector("#faq-review-count");
  const reviewQuestion = document.querySelector("#faq-review-question");
  const reviewAnswer = document.querySelector("#faq-review-answer");
  const reviewSimilar = document.querySelector("#faq-review-similar");
  const categoryRecommendation = document.querySelector("#faq-category-recommendation");
  const categorySelect = document.querySelector("#faq-category-select");
  const newCategoryName = document.querySelector("#faq-new-category-name");
  const reviewProgress = document.querySelector("#faq-review-progress");
  const reviewPrev = document.querySelector("#faq-review-prev");
  const reviewNext = document.querySelector("#faq-review-next");
  const reviewApprove = document.querySelector("#faq-review-approve");
  const reviewReject = document.querySelector("#faq-review-reject");
  const coveredFaqList = document.querySelector("#faq-covered-list");
  const coveredFaqCount = document.querySelector("#faq-covered-count");
  const coveredFaqStatus = document.querySelector("#faq-covered-status");
  let pendingSuggestions = [];
  let coveredSuggestions = [];
  let faqCategories = [];
  let currentSuggestionIndex = 0;
  const faqSuggestionCacheKey = "byu-guide-faq-suggestions-v1";
  const faqSuggestionCacheTtl = 5 * 60 * 1000;
  const client = window.cougarAuth?.client;
  const dashboard = document.querySelector("#metrics-dashboard");
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
      repeatUsageStatus.textContent = "Repeat users sent chatbot messages on at least two distinct UTC dates. Calendar months run oldest to newest; the current month is month to date, followed by the rolling last 30 days. Green meets the 50% goal; red is below it.";
    } catch (error) {
      console.error("Repeat-use metrics load error:", error);
      repeatUsageStatus.textContent = "Could not load repeat-use metrics. Check the monthly repeat-use view and deployed Edge Function.";
      setRepeatUsageMessage("Repeat-use metrics are unavailable. Check the Supabase function logs for details.");
    }
  };

  const renderFaqReview = () => {
    const total = pendingSuggestions.length;
    const suggestion = pendingSuggestions[currentSuggestionIndex];
    const currentCategoryValue = suggestion?.suggested_category_is_new
      ? "__new__"
      : suggestion?.suggested_category_id != null
      ? String(suggestion.suggested_category_id)
      : "";
    categorySelect.replaceChildren();
    const chooseOption = document.createElement("option");
    chooseOption.value = "";
    chooseOption.textContent = "Choose a category…";
    categorySelect.appendChild(chooseOption);
    faqCategories.forEach((category) => {
      const option = document.createElement("option");
      option.value = String(category.faq_category_id);
      option.textContent = category.faq_category_name;
      categorySelect.appendChild(option);
    });
    const newOption = document.createElement("option");
    newOption.value = "__new__";
    newOption.textContent = "＋ New category…";
    categorySelect.appendChild(newOption);
    categorySelect.value = currentCategoryValue;
    newCategoryName.value = suggestion?.suggested_category_is_new
      ? suggestion.suggested_category_name || ""
      : "";
    newCategoryName.hidden = categorySelect.value !== "__new__";
    categoryRecommendation.textContent = !suggestion
      ? ""
      : suggestion.suggested_category_is_new
      ? `Gemini suggests a new category: ${suggestion.suggested_category_name || "name not provided"}`
      : suggestion.suggested_category_id != null
      ? `Gemini suggests: ${suggestion.suggested_category_name || "an existing category"}`
      : "Gemini did not suggest a category. Choose one before approving.";
    pendingFaqStatus.textContent = `${total} pending suggestion${total === 1 ? "" : "s"}.`;
    reviewProgress.style.width = total ? `${((currentSuggestionIndex + 1) / total) * 100}%` : "0%";
    reviewCount.textContent = total ? `${currentSuggestionIndex + 1} of ${total} pending` : "Review complete";
    reviewQuestion.textContent = suggestion?.question || "You’re all caught up.";
    reviewAnswer.textContent = suggestion?.answer || (total ? "No suggested answer was provided." : "There are no pending FAQ suggestions to review.");
    reviewSimilar.textContent = suggestion
      ? `${formatMetric(suggestion.similar_question_count)} similar question${Number(suggestion.similar_question_count) === 1 ? "" : "s"}`
      : "New suggestions will appear here when available.";
    reviewPrev.disabled = !total || currentSuggestionIndex === 0;
    reviewNext.disabled = !total || currentSuggestionIndex >= total - 1;
    reviewApprove.disabled = !suggestion;
    reviewReject.disabled = !suggestion;
  };

  const setSuggestionStatus = async (status) => {
    const suggestion = pendingSuggestions[currentSuggestionIndex];
    if (!suggestion) return;
    const categoryChoice = categorySelect.value;
    const categoryName = newCategoryName.value.trim();
    if (status === "approved" && !categoryChoice) {
      pendingFaqStatus.textContent = "Choose a category before approving this FAQ.";
      categorySelect.focus();
      return;
    }
    if (status === "approved" && categoryChoice === "__new__" && !categoryName) {
      pendingFaqStatus.textContent = "Enter a name for the new category before approving.";
      newCategoryName.focus();
      return;
    }
    reviewApprove.disabled = true;
    reviewReject.disabled = true;
    pendingFaqStatus.textContent = `Saving ${status}…`;
    try {
      const { data, error } = await client.functions.invoke("admin-faq-suggestions", {
        body: {
          action: "set_status",
          id: suggestion.id,
          status,
          category_id: categoryChoice && categoryChoice !== "__new__"
            ? Number(categoryChoice)
            : null,
          new_category_name: categoryChoice === "__new__" ? categoryName : null,
        },
      });
      if (error) throw error;
      if (data?.category && !faqCategories.some((category) => Number(category.faq_category_id) === Number(data.category.faq_category_id))) {
        faqCategories.push(data.category);
        faqCategories.sort((a, b) => a.faq_category_name.localeCompare(b.faq_category_name));
      }
      pendingSuggestions.splice(currentSuggestionIndex, 1);
      if (currentSuggestionIndex >= pendingSuggestions.length) {
        currentSuggestionIndex = Math.max(0, pendingSuggestions.length - 1);
      }
      saveFaqSuggestionCache();
      renderFaqReview();
      pendingFaqStatus.textContent = `Suggestion ${status}. ${pendingSuggestions.length} remaining.`;
    } catch (error) {
      console.error("FAQ suggestion update error:", error);
      pendingFaqStatus.textContent = "Could not save the decision. Check the admin-faq-suggestions function and Supabase logs.";
      renderFaqReview();
    }
  };

  const saveFaqSuggestionCache = () => {
    try {
      sessionStorage.setItem(faqSuggestionCacheKey, JSON.stringify({
        savedAt: Date.now(),
        pending: pendingSuggestions,
        alreadyCovered: coveredSuggestions,
        categories: faqCategories,
      }));
    } catch (error) {
      console.warn("Could not cache FAQ suggestions in this browser session:", error);
    }
  };

  const renderCoveredSuggestions = () => {
    coveredFaqCount.textContent = `(${coveredSuggestions.length})`;
    coveredFaqList.replaceChildren();
    coveredSuggestions.forEach((suggestion) => {
      const item = document.createElement("li");
      item.textContent = suggestion.question;
      coveredFaqList.appendChild(item);
    });
    coveredFaqStatus.textContent = coveredSuggestions.length
      ? `${coveredSuggestions.length} already covered.`
      : "No already-covered questions.";
  };

  const renderFaqSuggestions = (data) => {
    pendingSuggestions = data?.pending ?? [];
    coveredSuggestions = data?.alreadyCovered ?? [];
    faqCategories = data?.categories ?? faqCategories;
    currentSuggestionIndex = 0;
    renderFaqReview();
    renderCoveredSuggestions();
  };

  const loadFaqSuggestions = async ({ forceFresh = false } = {}) => {
    if (!forceFresh) {
      try {
        const cached = JSON.parse(sessionStorage.getItem(faqSuggestionCacheKey) || "null");
        if (cached && Date.now() - cached.savedAt < faqSuggestionCacheTtl) {
          renderFaqSuggestions(cached);
          return;
        }
      } catch (error) {
        console.warn("Could not read FAQ suggestion cache:", error);
      }
    }

    pendingFaqStatus.textContent = "Loading suggestions…";
    coveredFaqStatus.textContent = "Loading covered questions…";
    try {
      const { data, error } = await client.functions.invoke("admin-faq-suggestions", {
        body: { action: "list" },
      });
      if (error) throw error;
      faqCategories = data?.categories ?? [];
      renderFaqSuggestions(data);
      saveFaqSuggestionCache();
    } catch (error) {
      console.error("FAQ suggestions load error:", error);
      pendingFaqStatus.textContent = "Could not load FAQ suggestions. Check that the admin-faq-suggestions Edge Function is deployed.";
      reviewQuestion.textContent = "Suggestions are unavailable.";
      reviewAnswer.textContent = "Check the browser console and Supabase function logs for details.";
      reviewSimilar.textContent = "";
      coveredFaqStatus.textContent = "Could not load covered questions.";
    }
  };

  reviewPrev.addEventListener("click", () => {
    if (currentSuggestionIndex > 0) currentSuggestionIndex -= 1;
    renderFaqReview();
  });
  reviewNext.addEventListener("click", () => {
    if (currentSuggestionIndex < pendingSuggestions.length - 1) currentSuggestionIndex += 1;
    renderFaqReview();
  });
  reviewApprove.addEventListener("click", () => setSuggestionStatus("approved"));
  reviewReject.addEventListener("click", () => setSuggestionStatus("rejected"));
  categorySelect.addEventListener("change", () => {
    newCategoryName.hidden = categorySelect.value !== "__new__";
    if (categorySelect.value === "__new__") newCategoryName.focus();
  });

  const refreshAllMetrics = async (forceFreshSuggestions = false) => {
    refreshAllButton.disabled = true;
    refreshAllButton.textContent = "Refreshing…";
    adminMetricsRequest = null;
    try {
      await Promise.all([loadMetrics(), loadFeedbackMetrics(), loadRepeatUsageMetrics(), loadFaqSuggestions({ forceFresh: forceFreshSuggestions })]);
    } finally {
      refreshAllButton.disabled = false;
      refreshAllButton.textContent = "Refresh all metrics";
    }
  };

  const generateFaqDrafts = async () => {
    generateFaqButton.disabled = true;
    generateFaqButton.textContent = "Generating drafts…";
    faqGenerationStatus.textContent = "Checking recent answered chats and generating FAQ drafts. This may take a little while…";
    try {
      const { data, error } = await client.functions.invoke("dynamic-function", {
        body: {},
      });
      if (error) throw error;

      const saved = Number(data?.suggestions_saved ?? 0);
      const covered = Number(data?.already_covered_inserted ?? 0) + Number(data?.already_covered_updated ?? 0);
      faqGenerationStatus.textContent = data?.message
        ? `${data.message} Refreshing the review list…`
        : `${data?.message || "Generation finished."} ${saved} new draft${saved === 1 ? "" : "s"} saved; ${covered} already-covered question${covered === 1 ? "" : "s"} recorded. Refreshing the review list…`;
      await loadFaqSuggestions({ forceFresh: true });
      if (!data?.message) {
        faqGenerationStatus.textContent = `${data?.message || "Generation finished."} ${saved} new draft${saved === 1 ? "" : "s"} saved; ${covered} already-covered question${covered === 1 ? "" : "s"} recorded.`;
      }
    } catch (error) {
      console.error("FAQ draft generation error:", error);
      faqGenerationStatus.textContent = error?.context?.status === 403
        ? "Admin access is required to generate FAQ drafts."
        : "Could not generate FAQ drafts. Check that the dynamic-function Edge Function is deployed and review its Supabase logs.";
    } finally {
      generateFaqButton.disabled = false;
      generateFaqButton.textContent = "Generate FAQ drafts";
    }
  };

  refreshAllButton.addEventListener("click", () => refreshAllMetrics(true));
  generateFaqButton.addEventListener("click", generateFaqDrafts);
  await refreshAllMetrics();

  // Refresh after sign-in so policies requiring an authenticated user can apply.
  client?.auth.onAuthStateChange((_event, session) => {
    if (session) {
      window.setTimeout(() => refreshAllMetrics(true), 0);
    }
  });
});