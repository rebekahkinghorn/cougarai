const formatFaqMetric = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? new Intl.NumberFormat().format(numericValue) : String(value);
};

document.addEventListener("DOMContentLoaded", async () => {
  await window.siteLayoutReady;

  const client = window.cougarAuth?.client;
  const dashboard = document.querySelector("#approvals-dashboard");
  const pendingFaqStatus = document.querySelector("#faq-pending-status");
  const generationStatus = document.querySelector("#faq-generation-status");
  const generateButton = document.querySelector("#generate-faq-suggestions");
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
  const coveredList = document.querySelector("#faq-covered-list");
  const coveredCount = document.querySelector("#faq-covered-count");
  const coveredStatus = document.querySelector("#faq-covered-status");
  const issueReportsBody = document.querySelector("#issue-reports-body");
  const resolvedIssueReportsBody = document.querySelector("#resolved-issue-reports-body");
  const issueReportsStatus = document.querySelector("#issue-reports-status");
  const eventSubmissionsBody = document.querySelector("#event-submissions-body");
  const eventSubmissionsStatus = document.querySelector("#event-submissions-status");
  const refreshEventSubmissionsButton = document.querySelector("#refresh-event-submissions");
  const eventReviewModal = document.querySelector("#event-review-modal");
  const eventReviewApproveButton = document.querySelector("#approve-event-submission");
  const eventReviewStatus = document.querySelector("#event-review-status");
  const eventReviewForm = document.querySelector("#event-review-form");
  const eventReviewView = document.querySelector("#event-review-readonly");
  const editEventButton = document.querySelector("#edit-event-submission");
  const cancelEventEditButton = document.querySelector("#cancel-event-edit");
  const saveEventEditButton = document.querySelector("#save-event-edit");
  const refreshIssueReportsButton = document.querySelector("#refresh-issue-reports");
  const openIssuesTab = document.querySelector("#open-issues-tab");
  const resolvedIssuesTab = document.querySelector("#resolved-issues-tab");
  const openIssuesPanel = document.querySelector("#open-issues-panel");
  const resolvedIssuesPanel = document.querySelector("#resolved-issues-panel");
  const resolutionModal = document.querySelector("#resolve-report-modal");
  const resolutionForm = document.querySelector("#resolve-report-form");
  const resolutionComment = document.querySelector("#resolution-comment");
  const resolutionDescription = document.querySelector("#resolve-report-description");
  const resolutionFormStatus = document.querySelector("#resolution-form-status");
  const resolutionSubmitButton = resolutionForm.querySelector('button[type="submit"]');

  const requestAdminSignIn = (reason) => {
    document.dispatchEvent(new CustomEvent("cougar:admin-auth-required", {
      detail: { reason, redirectTo: "approvals.html" },
    }));
  };

  if (!client) {
    requestAdminSignIn();
    return;
  }

  try {
    const { data, error } = await client.auth.getUser();
    if (error || !data?.user) {
      requestAdminSignIn();
      return;
    }
    if (data.user.app_metadata?.role !== "admin") {
      requestAdminSignIn("admin-required");
      return;
    }
    dashboard.hidden = false;
  } catch (error) {
    console.error("Admin access check failed:", error);
    requestAdminSignIn();
    return;
  }

  let pendingSuggestions = [];
  let coveredSuggestions = [];
  let faqCategories = [];
  let currentSuggestionIndex = 0;
  const faqSuggestionCacheKey = "byu-guide-faq-suggestions-v1";
  const faqSuggestionCacheTtl = 5 * 60 * 1000;

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
      ? `${formatFaqMetric(suggestion.similar_question_count)} similar question${Number(suggestion.similar_question_count) === 1 ? "" : "s"}`
      : "New suggestions will appear here when available.";
    reviewPrev.disabled = !total || currentSuggestionIndex === 0;
    reviewNext.disabled = !total || currentSuggestionIndex >= total - 1;
    reviewApprove.disabled = !suggestion;
    reviewReject.disabled = !suggestion;
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
    coveredCount.textContent = `(${coveredSuggestions.length})`;
    coveredList.replaceChildren();
    coveredSuggestions.forEach((suggestion) => {
      const item = document.createElement("li");
      item.textContent = suggestion.question;
      coveredList.appendChild(item);
    });
    coveredStatus.textContent = coveredSuggestions.length
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
    coveredStatus.textContent = "Loading covered questions…";
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
      coveredStatus.textContent = "Could not load covered questions.";
    }
  };

  let issueReports = [];
  let reportBeingResolved = null;

  const setIssueReportsMessage = (tbody, message, colspan = 4) => {
    tbody.replaceChildren();
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.className = "metrics-placeholder";
    cell.colSpan = colspan;
    cell.textContent = message;
    row.appendChild(cell);
    tbody.appendChild(row);
    applyResponsiveTableLabels(tbody);
  };

  // Label table values so the mobile card layout remains easy to scan.
  const applyResponsiveTableLabels = (tbody) => {
    const labels = [...tbody.closest("table").querySelectorAll("thead th")]
      .map((header) => header.textContent.trim());
    tbody.querySelectorAll("tr").forEach((row) => {
      [...row.cells].forEach((cell, index) => {
        if (cell.colSpan === 1 && labels[index]) cell.dataset.label = labels[index];
      });
    });
  };

  const formatIssueReportDate = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "—"
      : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
  };

  const appendReporter = (row, userId) => {
    const reporter = document.createElement("td");
    if (userId) {
      const id = String(userId);
      reporter.textContent = `${id.slice(0, 8)}…`;
      reporter.title = id;
      reporter.setAttribute("aria-label", `Submitter user ID: ${id}`);
    } else {
      reporter.textContent = "Guest / not linked";
    }
    row.appendChild(reporter);
  };

  const renderIssueReports = () => {
    const openReports = issueReports.filter((report) => String(report.status).toLowerCase() !== "resolved");
    const resolvedReports = issueReports.filter((report) => String(report.status).toLowerCase() === "resolved");
    document.querySelector("#open-issues-count").textContent = String(openReports.length);
    document.querySelector("#resolved-issues-count").textContent = String(resolvedReports.length);

    if (!openReports.length) {
      setIssueReportsMessage(issueReportsBody, "No open issue reports.", 5);
    } else {
      issueReportsBody.replaceChildren(...openReports.map((report) => {
        const row = document.createElement("tr");
        const description = document.createElement("td");
        description.textContent = report.description || "No description provided.";
        row.appendChild(description);

        const submittedDate = document.createElement("td");
        submittedDate.textContent = formatIssueReportDate(report.submitted_at);
        row.appendChild(submittedDate);

        const status = document.createElement("td");
        status.textContent = report.status || "Pending";
        row.appendChild(status);
        appendReporter(row, report.user_id);

        const actionCell = document.createElement("td");
        const resolveButton = document.createElement("button");
        resolveButton.className = "button secondary issue-report-action";
        resolveButton.type = "button";
        resolveButton.textContent = "Mark as resolved";
        resolveButton.addEventListener("click", () => {
          if (!report.issue_report_admin_id) {
            issueReportsStatus.textContent = "Resolution is not enabled yet. Run the issue-report SQL migration and deploy the updated admin-issue-reports Edge Function.";
            return;
          }
          reportBeingResolved = report.issue_report_admin_id;
          resolutionDescription.textContent = report.description || "No description provided.";
          resolutionFormStatus.textContent = "";
          resolutionForm.reset();
          resolutionModal.classList.add("show");
          resolutionModal.setAttribute("aria-hidden", "false");
          resolutionComment.focus();
        });
        actionCell.appendChild(resolveButton);
        row.appendChild(actionCell);
        return row;
      }));
      applyResponsiveTableLabels(issueReportsBody);
    }

    if (!resolvedReports.length) {
      setIssueReportsMessage(resolvedIssueReportsBody, "No resolved issue reports.");
    } else {
      resolvedIssueReportsBody.replaceChildren(...resolvedReports.map((report) => {
        const row = document.createElement("tr");
        const description = document.createElement("td");
        description.textContent = report.description || "No description provided.";
        row.appendChild(description);

        const comment = document.createElement("td");
        comment.textContent = report.resolution_comment?.trim() || "—";
        row.appendChild(comment);

        const resolvedDate = document.createElement("td");
        const date = report.resolved_at ? new Date(report.resolved_at) : null;
        resolvedDate.textContent = date && !Number.isNaN(date.getTime())
          ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date)
          : "—";
        row.appendChild(resolvedDate);
        appendReporter(row, report.user_id);
        return row;
      }));
      applyResponsiveTableLabels(resolvedIssueReportsBody);
    }

    issueReportsStatus.textContent = `${openReports.length} open · ${resolvedReports.length} resolved`;
  };

  const loadIssueReports = async () => {
    issueReportsStatus.textContent = "Loading issue reports…";
    setIssueReportsMessage(issueReportsBody, "Loading issue reports…", 5);
    setIssueReportsMessage(resolvedIssueReportsBody, "Loading issue reports…");
    refreshIssueReportsButton.disabled = true;

    try {
      const { data, error } = await client.functions.invoke("admin-issue-reports", {
        body: { action: "list" },
      });
      if (error) throw error;
      issueReports = data?.reports ?? [];
      renderIssueReports();
    } catch (error) {
      console.error("Issue reports load error:", error);
      issueReportsStatus.textContent = "Could not load issue reports. Check that the admin-issue-reports Edge Function is deployed.";
      setIssueReportsMessage(issueReportsBody, "Issue reports are unavailable. Check the Supabase function logs for details.", 5);
      setIssueReportsMessage(resolvedIssueReportsBody, "Issue reports are unavailable. Check the Supabase function logs for details.");
    } finally {
      refreshIssueReportsButton.disabled = false;
    }
  };

  const switchIssueReportTab = (showResolved) => {
    openIssuesPanel.hidden = showResolved;
    resolvedIssuesPanel.hidden = !showResolved;
    openIssuesTab.setAttribute("aria-selected", String(!showResolved));
    resolvedIssuesTab.setAttribute("aria-selected", String(showResolved));
    openIssuesTab.classList.toggle("active", !showResolved);
    resolvedIssuesTab.classList.toggle("active", showResolved);
  };

  const closeResolutionModal = () => {
    resolutionModal.classList.remove("show");
    resolutionModal.setAttribute("aria-hidden", "true");
    resolutionForm.reset();
    resolutionFormStatus.textContent = "";
    reportBeingResolved = null;
  };

  openIssuesTab.addEventListener("click", () => switchIssueReportTab(false));
  resolvedIssuesTab.addEventListener("click", () => switchIssueReportTab(true));
  resolutionModal.querySelectorAll("[data-close-resolution]").forEach((button) => {
    button.addEventListener("click", closeResolutionModal);
  });
  resolutionModal.addEventListener("click", (event) => {
    if (event.target === resolutionModal) closeResolutionModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && resolutionModal.classList.contains("show")) closeResolutionModal();
  });
  resolutionForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!reportBeingResolved) return;
    resolutionSubmitButton.disabled = true;
    resolutionFormStatus.textContent = "Saving resolution…";
    try {
      const { data, error } = await client.functions.invoke("admin-issue-reports", {
        body: {
          action: "resolve",
          reportId: reportBeingResolved,
          resolutionComment: resolutionComment.value.trim(),
        },
      });
      if (error) throw error;
      if (!data?.report?.issue_report_admin_id) {
        throw new Error("The deployed admin-issue-reports function does not support resolving reports yet.");
      }
      closeResolutionModal();
      await loadIssueReports();
    } catch (error) {
      console.error("Issue report resolution error:", error);
      resolutionFormStatus.textContent = "Could not save this resolution. Run the issue-report SQL migration and deploy the updated admin-issue-reports Edge Function, then try again.";
    } finally {
      resolutionSubmitButton.disabled = false;
    }
  });

  let eventSubmissions = [];

  const setEventSubmissionsMessage = (message) => {
    eventSubmissionsBody.replaceChildren();
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.className = "metrics-placeholder";
    cell.colSpan = 5;
    cell.textContent = message;
    row.appendChild(cell);
    eventSubmissionsBody.appendChild(row);
    applyResponsiveTableLabels(eventSubmissionsBody);
  };

  const formatEventDateTime = (startValue, endValue) => {
    if (!startValue) return "—";
    const start = new Date(startValue);
    const end = endValue ? new Date(endValue) : null;
    if (Number.isNaN(start.getTime())) return "—";
    const dateText = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(start);
    const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
    if (!end || Number.isNaN(end.getTime())) return `${dateText}, ${timeFormat.format(start)}`;
    return `${dateText}, ${timeFormat.format(start)}–${timeFormat.format(end)}`;
  };

  const getEventCategoryLabel = (categoryId) => ({
    1: "BYU",
    2: "Community",
    3: "Arts & Culture",
    4: "Wellness",
  }[Number(categoryId)] || "—");

  let eventSubmissionBeingReviewed = null;

  const setReviewField = (id, value) => {
    document.querySelector(`#${id}`).textContent = value || "Not provided";
  };

  const localDatePart = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };

  const localTimePart = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  };

  const setEditingMode = (isEditing) => {
    eventReviewForm.hidden = !isEditing;
    eventReviewView.hidden = isEditing;
    editEventButton.hidden = isEditing;
    cancelEventEditButton.hidden = !isEditing;
    saveEventEditButton.hidden = !isEditing;
    eventReviewApproveButton.hidden = isEditing;
  };

  const fillEventEditForm = (submission) => {
    document.querySelector("#event-edit-name").value = submission.event_name ?? "";
    document.querySelector("#event-edit-date").value = localDatePart(submission.start_at);
    document.querySelector("#event-edit-start").value = localTimePart(submission.start_at);
    document.querySelector("#event-edit-end").value = localTimePart(submission.end_at);
    document.querySelector("#event-edit-category").value = submission.event_category_id == null ? "" : String(submission.event_category_id);
    document.querySelector("#event-edit-address").value = submission.street_address ?? "";
    document.querySelector("#event-edit-city").value = submission.city ?? "";
    document.querySelector("#event-edit-zip").value = submission.zip_code ?? "";
  };

  const openEventReview = (submission) => {
    eventSubmissionBeingReviewed = submission;
    const start = submission.start_at ? new Date(submission.start_at) : null;
    const end = submission.end_at ? new Date(submission.end_at) : null;
    const submitted = submission.submitted_at ? new Date(submission.submitted_at) : null;
    const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "full" });
    const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

    setReviewField("event-review-name", submission.event_name);
    setReviewField("event-review-category", getEventCategoryLabel(submission.event_category_id));
    setReviewField("event-review-category-value", submission.event_category_id == null ? "Not provided" : getEventCategoryLabel(submission.event_category_id));
    setReviewField("event-review-submitted", submitted && !Number.isNaN(submitted.getTime())
      ? `Submitted ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(submitted)}`
      : "Submission details");
    setReviewField("event-review-date", start && !Number.isNaN(start.getTime()) ? dateFormat.format(start) : "Not provided");
    setReviewField("event-review-start", start && !Number.isNaN(start.getTime()) ? timeFormat.format(start) : "Not provided");
    setReviewField("event-review-end", end && !Number.isNaN(end.getTime()) ? timeFormat.format(end) : "Not provided");
    setReviewField("event-review-address", submission.street_address);
    setReviewField("event-review-city", submission.city);
    setReviewField("event-review-zip", submission.zip_code);
    fillEventEditForm(submission);
    setEditingMode(false);
    eventReviewStatus.textContent = "Review the submitted details before approving this event.";
    eventReviewApproveButton.disabled = !submission.submission_id || !submission.submission_id_column;
    eventReviewApproveButton.textContent = "Approve event";
    eventReviewModal.classList.add("show");
    eventReviewModal.setAttribute("aria-hidden", "false");
    eventReviewApproveButton.focus();
  };

  const closeEventReview = () => {
    eventReviewModal.classList.remove("show");
    eventReviewModal.setAttribute("aria-hidden", "true");
    eventSubmissionBeingReviewed = null;
    setEditingMode(false);
  };

  const getEditedEventDetails = () => {
    const date = document.querySelector("#event-edit-date").value;
    const startTime = document.querySelector("#event-edit-start").value;
    const endTime = document.querySelector("#event-edit-end").value;
    const streetAddress = document.querySelector("#event-edit-address").value.trim();
    const city = document.querySelector("#event-edit-city").value;
    const zipCode = document.querySelector("#event-edit-zip").value.trim();
    return {
      event_name: document.querySelector("#event-edit-name").value.trim(),
      start_at: new Date(`${date}T${startTime}`).toISOString(),
      end_at: new Date(`${date}T${endTime}`).toISOString(),
      street_address: streetAddress,
      city,
      zip_code: zipCode,
      location: `${streetAddress}, ${city}, UT ${zipCode}`,
      event_category_id: Number(document.querySelector("#event-edit-category").value),
    };
  };

  const getEventFunctionErrorMessage = async (error) => {
    const response = error?.context;
    if (response && typeof response.clone === "function") {
      try {
        const body = await response.clone().json();
        if (typeof body?.error === "string") {
          return typeof body.detail === "string" ? `${body.error}: ${body.detail}` : body.error;
        }
      } catch {
        // Fall back to the SDK error message when the response is not JSON.
      }
    }
    return error?.message || "Unknown error";
  };

  const saveEventEdits = async () => {
    if (!eventSubmissionBeingReviewed || !eventReviewForm.reportValidity()) return;
    saveEventEditButton.disabled = true;
    eventReviewStatus.textContent = "Saving event edits…";
    try {
      const { data, error } = await client.functions.invoke("admin-event-submissions", {
        body: {
          action: "update",
          submissionId: eventSubmissionBeingReviewed.submission_id,
          idColumn: eventSubmissionBeingReviewed.submission_id_column,
          event: getEditedEventDetails(),
        },
      });
      if (error) throw error;
      if (!data?.submission) throw new Error("The event edits were not confirmed.");
      eventSubmissionBeingReviewed = data.submission;
      eventSubmissions = eventSubmissions.map((submission) =>
        String(submission.submission_id) === String(data.submission.submission_id) ? data.submission : submission
      );
      renderEventSubmissions();
      openEventReview(data.submission);
      eventReviewStatus.textContent = "Edits saved. You can keep reviewing or approve the updated event.";
    } catch (error) {
      const detail = await getEventFunctionErrorMessage(error);
      console.error("Event edit error:", error);
      eventReviewStatus.textContent = detail.toLowerCase().includes("unsupported action")
        ? "This deployed admin-event-submissions function is an older version. Deploy the updated function, then try saving again."
        : `Could not save edits: ${detail}`;
    } finally {
      saveEventEditButton.disabled = false;
    }
  };

  const renderEventSubmissions = () => {
    if (!eventSubmissions.length) {
      setEventSubmissionsMessage("No pending event submissions.");
      eventSubmissionsStatus.textContent = "No pending event submissions.";
      return;
    }

    eventSubmissionsBody.replaceChildren(...eventSubmissions.map((submission) => {
      const row = document.createElement("tr");
      row.className = "event-submission-row";

      const nameCell = document.createElement("td");
      const nameButton = document.createElement("button");
      nameButton.type = "button";
      nameButton.className = "event-submission-name";
      nameButton.textContent = submission.event_name || "Untitled event";
      nameButton.addEventListener("click", () => openEventReview(submission));
      nameCell.appendChild(nameButton);
      row.appendChild(nameCell);

      const dateCell = document.createElement("td");
      dateCell.textContent = formatEventDateTime(submission.start_at, submission.end_at);
      row.appendChild(dateCell);

      const locationCell = document.createElement("td");
      locationCell.textContent = submission.location || [submission.street_address, submission.city, submission.zip_code].filter(Boolean).join(", ") || "—";
      row.appendChild(locationCell);

      const categoryCell = document.createElement("td");
      categoryCell.textContent = getEventCategoryLabel(submission.event_category_id);
      row.appendChild(categoryCell);

      const actionCell = document.createElement("td");
      const reviewButton = document.createElement("button");
      reviewButton.className = "button primary issue-report-action";
      reviewButton.type = "button";
      reviewButton.textContent = "Review";
      reviewButton.addEventListener("click", () => openEventReview(submission));
      actionCell.appendChild(reviewButton);
      row.appendChild(actionCell);
      return row;
    }));
    applyResponsiveTableLabels(eventSubmissionsBody);
    eventSubmissionsStatus.textContent = `${eventSubmissions.length} pending event submission${eventSubmissions.length === 1 ? "" : "s"}.`;
  };

  const loadEventSubmissions = async () => {
    eventSubmissionsStatus.textContent = "Loading event submissions…";
    setEventSubmissionsMessage("Loading event submissions…");
    refreshEventSubmissionsButton.disabled = true;
    try {
      const { data, error } = await client.functions.invoke("admin-event-submissions", {
        body: { action: "list" },
      });
      if (error) throw error;
      eventSubmissions = data?.submissions ?? [];
      renderEventSubmissions();
    } catch (error) {
      console.error("Event submissions load error:", error);
      eventSubmissionsStatus.textContent = "Could not load event submissions. Check that admin-event-submissions is deployed and the event tables are available.";
      setEventSubmissionsMessage("Event submissions are unavailable. Check the browser console and Supabase function logs.");
    } finally {
      refreshEventSubmissionsButton.disabled = false;
    }
  };

  const approveEventSubmission = async (submission, button) => {
    button.disabled = true;
    button.textContent = "Approving…";
    eventReviewStatus.textContent = `Approving ${submission.event_name || "event"}…`;
    eventSubmissionsStatus.textContent = `Approving ${submission.event_name || "event"}…`;
    try {
      const { data, error } = await client.functions.invoke("admin-event-submissions", {
        body: {
          action: "approve",
          submissionId: submission.submission_id,
          idColumn: submission.submission_id_column,
        },
      });
      if (error) throw error;
      if (!data?.approved) throw new Error("The event approval was not confirmed.");
      eventSubmissions = eventSubmissions.filter((item) =>
        String(item.submission_id) !== String(submission.submission_id)
      );
      closeEventReview();
      renderEventSubmissions();
      eventSubmissionsStatus.textContent = `${submission.event_name || "Event"} approved and moved to Events.`;
    } catch (error) {
      console.error("Event approval error:", error);
      const detail = await getEventFunctionErrorMessage(error);
      const message = `Could not approve this event: ${detail}`;
      eventSubmissionsStatus.textContent = message;
      eventReviewStatus.textContent = message;
      button.disabled = false;
      button.textContent = "Approve event";
    }
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

  const generateFaqDrafts = async () => {
    generateButton.disabled = true;
    generateButton.textContent = "Generating drafts…";
    generationStatus.textContent = "Checking recent answered chats and generating FAQ drafts. This may take a little while…";
    try {
      const { data, error } = await client.functions.invoke("dynamic-function", { body: {} });
      if (error) throw error;

      const saved = Number(data?.suggestions_saved ?? 0);
      const covered = Number(data?.already_covered_inserted ?? 0) + Number(data?.already_covered_updated ?? 0);
      generationStatus.textContent = data?.message
        ? `${data.message} Refreshing the review list…`
        : `Generation finished. ${saved} new draft${saved === 1 ? "" : "s"} saved; ${covered} already-covered question${covered === 1 ? "" : "s"} recorded. Refreshing the review list…`;
      await loadFaqSuggestions({ forceFresh: true });
      if (!data?.message) {
        generationStatus.textContent = `Generation finished. ${saved} new draft${saved === 1 ? "" : "s"} saved; ${covered} already-covered question${covered === 1 ? "" : "s"} recorded.`;
      }
    } catch (error) {
      console.error("FAQ draft generation error:", error);
      generationStatus.textContent = error?.context?.status === 403
        ? "Admin access is required to generate FAQ drafts."
        : "Could not generate FAQ drafts. Check that the dynamic-function Edge Function is deployed and review its Supabase logs.";
    } finally {
      generateButton.disabled = false;
      generateButton.textContent = "Generate FAQ drafts";
    }
  };

  generateButton.addEventListener("click", generateFaqDrafts);
  refreshIssueReportsButton.addEventListener("click", loadIssueReports);
  refreshEventSubmissionsButton.addEventListener("click", loadEventSubmissions);
  eventReviewApproveButton.addEventListener("click", () => {
    if (eventSubmissionBeingReviewed) approveEventSubmission(eventSubmissionBeingReviewed, eventReviewApproveButton);
  });
  editEventButton.addEventListener("click", () => {
    if (!eventSubmissionBeingReviewed) return;
    fillEventEditForm(eventSubmissionBeingReviewed);
    setEditingMode(true);
    document.querySelector("#event-edit-name").focus();
  });
  cancelEventEditButton.addEventListener("click", () => {
    if (eventSubmissionBeingReviewed) fillEventEditForm(eventSubmissionBeingReviewed);
    setEditingMode(false);
    eventReviewStatus.textContent = "Edits canceled.";
  });
  saveEventEditButton.addEventListener("click", saveEventEdits);
  eventReviewModal.querySelectorAll("[data-close-event-review]").forEach((button) => {
    button.addEventListener("click", closeEventReview);
  });
  eventReviewModal.addEventListener("click", (event) => {
    if (event.target === eventReviewModal) closeEventReview();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && eventReviewModal.classList.contains("show")) closeEventReview();
  });
  await Promise.all([loadFaqSuggestions(), loadIssueReports(), loadEventSubmissions()]);
});
