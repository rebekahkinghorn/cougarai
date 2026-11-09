document.addEventListener("DOMContentLoaded", () => {
  // Highlight the current page and control the mobile navigation.
  const currentPage = document.body.dataset.page;
  document.querySelectorAll(".nav-link").forEach((link) => {
    if (link.dataset.page === currentPage) link.classList.add("active");
  });

  const menuToggle = document.querySelector(".menu-toggle");
  const mainNav = document.querySelector(".main-nav");
  menuToggle?.addEventListener("click", () => {
    const isOpen = mainNav.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });

  // Show brief status messages throughout the app.
  const toast = document.querySelector(".toast");
  let toastTimer;
  const showToast = (message) => {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 3600);
  };
  window.showToast = showToast;

  document.querySelectorAll("[data-toast]").forEach((button) => {
    button.addEventListener("click", () => showToast(button.dataset.toast));
  });

  // Open and close the shared report-an-issue modal.
  const modalBackdrop = document.querySelector(".modal-backdrop");
  const openModal = () => modalBackdrop?.classList.add("show");
  const closeModal = () => modalBackdrop?.classList.remove("show");

  document.querySelectorAll("[data-open-modal]").forEach((button) =>
    button.addEventListener("click", openModal)
  );
  document.querySelectorAll("[data-close-modal]").forEach((button) =>
    button.addEventListener("click", closeModal)
  );

  modalBackdrop?.addEventListener("click", (event) => {
    if (event.target === modalBackdrop) closeModal();
  });

  // Save issue reports to Supabase, from all pages. 
  const issueModal = document.querySelector(".modal-backdrop[aria-labelledby=\"issue-title\"]");
  const issueForm = issueModal?.querySelector(".modal-form");
  issueForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();

    const description = issueForm.querySelector("#issue-description")?.value.trim();
    if (!description) return;

    const client = window.cougarAuth?.client;
    if (!client) {
      showToast("Database connection not available.");
      return;
    }

    const submitButton = issueForm.querySelector("button[type=\"submit\"]");
    if (submitButton) submitButton.disabled = true;

    try {
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      const userId = sessionData?.session?.user?.id || null;
      if (!userId) {
        showToast("You must be logged in to report an issue.");
        return;
      }

      const submittedAt = new Date();
      const mountainParts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
        timeZoneName: "longOffset"
      }).formatToParts(submittedAt);
      const mountainTime = Object.fromEntries(mountainParts.map(({ type, value }) => [type, value]));
      const mountainOffset = mountainTime.timeZoneName.replace("GMT", "");
      const dateSubmitted = `${mountainTime.year}-${mountainTime.month}-${mountainTime.day}T${mountainTime.hour}:${mountainTime.minute}:${mountainTime.second}${mountainOffset}`;

      const { error } = await client.from("issue_report").insert({
        description, user_id: userId, status: "Pending", date_submitted: dateSubmitted
      });
      if (error) throw error;

      issueForm.reset();
      issueModal.classList.remove("show");
      showToast("Your issue report was successfully submitted!");
    } catch (error) {
      console.error("Issue submission error:", error);
      showToast("Error: " + error.message);
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  }, true);

  // Expand and collapse individual FAQ answers.
  document.querySelectorAll(".faq-question").forEach((button) => {
    button.addEventListener("click", () => {
      const item = button.closest(".faq-item");
      const isOpen = item.classList.toggle("open");
      button.setAttribute("aria-expanded", String(isOpen));
    });
  });

  // Search and filter FAQ entries by text or category.
  const faqSearch = document.querySelector("#faq-search");
  const faqItems = [...document.querySelectorAll(".faq-item")];
  const faqEmpty = document.querySelector(".faq-empty");

  const filterFaqs = () => {
    if (!faqSearch) return;

    const query = faqSearch.value.trim().toLowerCase();
    let visibleCount = 0;

    faqItems.forEach((item) => {
      const matches = !query || item.textContent.toLowerCase().includes(query);
      item.hidden = !matches;
      if (matches) visibleCount += 1;
    });

    faqEmpty?.classList.toggle("show", visibleCount === 0);
  };

  faqSearch?.addEventListener("input", filterFaqs);

  document.querySelectorAll(".filter[data-filter]").forEach((filter) => {
    filter.addEventListener("click", () => {
      document
        .querySelectorAll(".filter[data-filter]")
        .forEach((button) => button.classList.remove("active"));

      filter.classList.add("active");

      const category = filter.dataset.filter;
      faqItems.forEach((item) => {
        const matches = category === "all" || item.dataset.category === category;
        item.hidden = !matches;
      });

      if (faqEmpty) {
        faqEmpty.classList.toggle(
          "show",
          !faqItems.some((item) => !item.hidden)
        );
      }
    });
  });

  // Set up chatbot elements and common example responses.
  const chatMessages = document.querySelector("#chat-messages");
  const chatForm = document.querySelector("#chat-form");
  const chatInput = document.querySelector("#chat-input");
  const chatHistory = document.querySelector("#chat-history");
  const chatHistoryStatus = document.querySelector("#chat-history-status");
  let historyStorageKey = null;
  let historyLoadVersion = 0;
  let chatRequestVersion = 0;
  let savedConversations = [];
  const NEW_CHAT_SESSION_MARKER = "__cougarai_new_chat__";

  // Ask for a one-time star rating after two chatbot answers or 30 seconds.
  // Track the active chat so the selected rating can be linked to its conversation.
  const satisfactionSurvey = document.querySelector("#chat-satisfaction");
  const satisfactionStatus = document.querySelector("#satisfaction-status");
  const satisfactionRatings = satisfactionSurvey?.querySelectorAll('input[name="chat-satisfaction"]') ?? [];
  let surveyShown = false;
  let botAnswerCount = 0;
  let surveyTimer;
  let activeConversationId = null;
  let pendingFeedbackRating = null;
  let feedbackSaved = false;
  let feedbackSaving = false;

  const highlightSatisfactionStars = (ratingValue = 0) => {
    satisfactionRatings.forEach((rating) => {
      rating.closest("label")?.classList.toggle(
        "selected",
        Number(rating.value) <= ratingValue
      );
    });
  };

  // Insert the selected rating once a conversation ID is available.
  const saveConversationFeedback = async () => {
    if (!pendingFeedbackRating || !activeConversationId || feedbackSaved || feedbackSaving) return;

    const client = window.cougarAuth?.client;
    if (!client) {
      pendingFeedbackRating = null;
      satisfactionSurvey.dataset.rating = "";
      satisfactionRatings.forEach((rating) => {
        rating.checked = false;
        rating.disabled = false;
      });
      highlightSatisfactionStars();
      if (satisfactionStatus) {
        satisfactionStatus.textContent = "Database connection unavailable. Please choose a star to try again.";
      }
      return;
    }

    feedbackSaving = true;
    if (satisfactionStatus) satisfactionStatus.textContent = "Saving your feedback…";

    try {
      const { error } = await client.from("chat_feedback").insert({
        conversation_id: activeConversationId,
        rating: pendingFeedbackRating
      });
      if (error) throw error;

      feedbackSaved = true;
      if (satisfactionStatus) satisfactionStatus.textContent = "Thanks for your feedback!";
    } catch (error) {
      console.error("Feedback submission error:", error);
      pendingFeedbackRating = null;
      satisfactionSurvey.dataset.rating = "";
      satisfactionRatings.forEach((rating) => {
        rating.checked = false;
        rating.disabled = false;
      });
      highlightSatisfactionStars();
      if (satisfactionStatus) {
        satisfactionStatus.textContent = "Could not save your rating. Please choose a star to try again.";
      }
    } finally {
      feedbackSaving = false;
    }
  };

  // Reveal the survey only once and cancel the timer if an answer triggered it first.
  const showSatisfactionSurvey = () => {
    if (surveyShown || !satisfactionSurvey) return;
    surveyShown = true;
    clearTimeout(surveyTimer);
    satisfactionSurvey.hidden = false;
  };

  const startSatisfactionTimer = () => {
    if (!satisfactionSurvey || surveyTimer) return;
    // Start the 30-second fallback when the user sends their first question.
    surveyTimer = window.setTimeout(showSatisfactionSurvey, 30000);
  };

  if (satisfactionSurvey) {
    const satisfactionStarGroup = satisfactionSurvey.querySelector(".satisfaction-stars");

    satisfactionRatings.forEach((input) => {
      input.closest("label")?.addEventListener("mouseenter", () => {
        const hoveredRating = Number(input.value);
        satisfactionRatings.forEach((star) => {
          star.closest("label")?.classList.toggle(
            "preview",
            Number(star.value) <= hoveredRating
          );
        });
      });
    });

    satisfactionStarGroup?.addEventListener("mouseleave", () => {
      satisfactionRatings.forEach((input) => {
        input.closest("label")?.classList.remove("preview");
      });
    });

    satisfactionRatings.forEach((input) => {
      // Keep the selected value locally until it can be saved to Supabase.
      input.addEventListener("change", () => {
        if (!input.checked || feedbackSaved) return;
        pendingFeedbackRating = Number(input.value);
        highlightSatisfactionStars(pendingFeedbackRating);
        satisfactionSurvey.dataset.rating = input.value;
        satisfactionRatings.forEach((rating) => {
          rating.disabled = true;
        });
        if (!activeConversationId && satisfactionStatus) {
          satisfactionStatus.textContent = "Saving your feedback when this chat is ready…";
        }
        saveConversationFeedback();
      });
    });
  }

  const responseMap = {
    housing:
      "A good first step is to review the housing timeline and apply for on-campus housing as soon as your application opens. If you are waitlisted, compare off-campus options before the semester gets close.",
    mymap:
      "MyMap lets you build a class schedule. Add classes to your cart, check for conflicts, and submit when registration opens. It is normal for a few classes to fill, so review your schedule right after submission.",
    advisor:
      "You can connect with an academic advisor through BYU’s advising directory. Start with your college or intended major so you reach the right office.",
    events:
      "The calendar shows BYU and Provo events. Use the filters to narrow the list, then select an event for details and registration links.",
  };

  // Add a user or bot message to the chat window.
  const formatChatTime = (value) => {
    if (!value) return "just now";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  };

  const addMessage = (text, type = "bot", timestamp = null) => {
    if (!chatMessages) return;

    const message = document.createElement("div");
    message.className = `message${type === "user" ? " user" : ""}`;
    message.textContent = text;

    const details = document.createElement("small");
    const time = formatChatTime(timestamp);
    details.textContent = `${type === "user" ? "You" : "BYU Guide"}${time ? ` · ${time}` : ""}`;
    message.appendChild(details);

    chatMessages.appendChild(message);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  };

  const showWelcomeMessage = () => {
    if (!chatMessages) return;
    chatMessages.replaceChildren();
    addMessage(
      "Hi! I’m your BYU Guide. Ask me anything about getting ready for campus, finding resources, or exploring Provo."
    );
  };

  const renderChatHistory = (conversations = []) => {
    if (!chatHistory) return;
    chatHistory.replaceChildren();

    conversations.forEach((conversation) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "chat-history-item";
      item.classList.toggle(
        "active",
        conversation.conversation_id === activeConversationId
      );
      item.setAttribute("aria-current", conversation.conversation_id === activeConversationId ? "true" : "false");

      const title = document.createElement("span");
      title.className = "chat-history-title";
      title.textContent = conversation.conversation_title?.trim() || "Untitled conversation";
      item.appendChild(title);

      const updated = document.createElement("span");
      updated.className = "chat-history-date";
      updated.textContent = formatChatTime(conversation.updated_at);
      item.appendChild(updated);

      item.addEventListener("click", () => openConversation(conversation));
      chatHistory.appendChild(item);
    });
  };

  const loadChatHistory = async (client) => {
    if (!chatHistory || !chatHistoryStatus) return;

    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) {
      chatHistory.replaceChildren();
      chatHistoryStatus.textContent = "Could not check your sign-in status.";
      console.error("Chat history session error:", sessionError);
      return;
    }

    if (!sessionData?.session?.user) {
      savedConversations = [];
      chatHistory.replaceChildren();
      chatHistoryStatus.textContent = "Sign in to see saved chats. Guest chats are only available in this session.";
      return;
    }

    chatHistoryStatus.textContent = "Loading your chats…";
    const { data, error } = await client
      .from("chat_conversations")
      .select("conversation_id, conversation_title, updated_at")
      .order("updated_at", { ascending: false });

    if (error) {
      savedConversations = [];
      chatHistory.replaceChildren();
      chatHistoryStatus.textContent = "Could not load chats. Check the chat_conversations SELECT policy.";
      console.error("Chat history error:", error);
      return;
    }

    savedConversations = data ?? [];
    renderChatHistory(savedConversations);
    chatHistoryStatus.textContent = data?.length
      ? "Select a chat to reopen it."
      : "No saved chats yet. Start a chat and it will appear here.";
  };

  const openConversation = async (conversation) => {
    const client = window.cougarAuth?.client;
    if (!client || !historyStorageKey) return;

    chatRequestVersion += 1;
    const loadVersion = ++historyLoadVersion;
    activeConversationId = conversation.conversation_id;
    sessionStorage.setItem(historyStorageKey, activeConversationId);
    renderChatHistory(savedConversations);

    if (chatMessages) chatMessages.replaceChildren();
    addMessage("Loading conversation…");

    const { data, error } = await client
      .from("chat_messages")
      .select("sender, content, created_at")
      .eq("conversation_id", activeConversationId)
      .order("created_at", { ascending: true });

    if (loadVersion !== historyLoadVersion) return;

    if (error) {
      console.error("Conversation messages error:", error);
      if (chatMessages) chatMessages.replaceChildren();
      addMessage("Could not load this conversation. Check the chat_messages SELECT policy and created_at column.");
      return;
    }

    if (chatMessages) chatMessages.replaceChildren();
    if (!data?.length) {
      showWelcomeMessage();
    } else {
      data.forEach((message) => {
        addMessage(
          message.content,
          message.sender === "user" ? "user" : "bot",
          message.created_at
        );
      });
    }

    renderChatHistory(savedConversations);
  };

  // Choose a built-in response for supported topics.
  const getResponse = (question) => {
    const normalized = question.toLowerCase();

    if (normalized.includes("hous")) return responseMap.housing;
    if (
      normalized.includes("mymap") ||
      normalized.includes("class") ||
      normalized.includes("schedule")
    ) {
      return responseMap.mymap;
    }
    if (normalized.includes("advisor") || normalized.includes("major")) {
      return responseMap.advisor;
    }
    if (normalized.includes("event") || normalized.includes("around provo")) {
      return responseMap.events;
    }

    return "I can help with housing, MyMap and class registration, academic advising, BYU requirements, and events around Provo. Try asking about one of those topics.";
  };

  // Keep each signed-in user or guest conversation under a separate key.
  const getConversationStorageKey = async (client) => {
    const { data } = await client.auth.getSession();
    const userId = data?.session?.user?.id || "guest";
    return `cougarai_conversation_${userId}`;
  };

  // Send a chat question to the Supabase chatbot function and display its reply.
  const submitChat = async (value) => {
    const question = value.trim();
    if (!question) return;

    const requestVersion = ++chatRequestVersion;
    addMessage(question, "user");
    startSatisfactionTimer();
    if (chatInput) chatInput.value = "";

    const client = window.cougarAuth?.client;
    if (!client) {
      addMessage("Chat connection is not set up on this page yet.");
      return;
    }

    const storageKey = await getConversationStorageKey(client);
    historyStorageKey = storageKey;
    const storedConversationId = sessionStorage.getItem(storageKey);
    const conversationId = storedConversationId === NEW_CHAT_SESSION_MARKER
      ? null
      : storedConversationId;
    activeConversationId = conversationId;

    const { data: authData, error: authError } = await client.auth.getSession();
    if (authError) console.error("Could not read the current auth session:", authError);
    const accessToken = authData?.session?.access_token;

    const { data, error } = await client.functions.invoke("chatbot", {
      body: {
        message: question,
        conversation_id: conversationId,
      },
      ...(accessToken
        ? { headers: { Authorization: `Bearer ${accessToken}` } }
        : {}),
    });

    if (requestVersion !== chatRequestVersion) {
      await loadChatHistory(client);
      return;
    }

    if (error || !data?.reply) {
      // The Edge Function may have saved the conversation before answer
      // generation failed, so still refresh the history list on errors.
      await loadChatHistory(client);
      addMessage("Sorry, I couldn't get an answer right now.");
      console.error("Chat function error:", error || data);
      return;
    }

    if (data.conversation_id) {
      activeConversationId = data.conversation_id;
      sessionStorage.setItem(storageKey, data.conversation_id);
      // Save a rating that was selected before this conversation ID arrived.
      saveConversationFeedback();
    }

    await loadChatHistory(client);
    addMessage(data.reply);
    // Show the survey as soon as the second chatbot answer is displayed.
    botAnswerCount += 1;
    if (botAnswerCount >= 2) showSatisfactionSurvey();
  };

  chatForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    submitChat(chatInput?.value ?? "");
  });

  document.querySelectorAll("[data-question]").forEach((button) => {
    button.addEventListener("click", () => {
      submitChat(button.dataset.question);
    });
  });

  const resetSurveyForNewChat = () => {
    clearTimeout(surveyTimer);
    surveyTimer = null;
    surveyShown = false;
    botAnswerCount = 0;
    pendingFeedbackRating = null;
    feedbackSaved = false;
    feedbackSaving = false;
    if (satisfactionSurvey) {
      satisfactionSurvey.hidden = true;
      satisfactionSurvey.dataset.rating = "";
    }
    satisfactionRatings.forEach((rating) => {
      rating.checked = false;
      rating.disabled = false;
    });
    highlightSatisfactionStars();
    if (satisfactionStatus) satisfactionStatus.textContent = "";
  };

  const startNewChat = async () => {
    chatRequestVersion += 1;
    historyLoadVersion += 1;
    activeConversationId = null;
    resetSurveyForNewChat();

    const client = window.cougarAuth?.client;
    if (client) {
      historyStorageKey = await getConversationStorageKey(client);
      // Keep an explicit blank-chat marker so a page reload doesn't reopen
      // the previous conversation before the user sends the first message.
      sessionStorage.setItem(historyStorageKey, NEW_CHAT_SESSION_MARKER);
    }

    showWelcomeMessage();
    renderChatHistory(savedConversations);
    chatInput?.focus();
    showToast("Started a new chat.");
  };

  document.querySelectorAll("[data-new-chat]").forEach((button) => {
    button.addEventListener("click", startNewChat);
  });

  const initializeChatHistory = async () => {
    const client = window.cougarAuth?.client;
    showWelcomeMessage();

    if (!client) {
      if (chatHistoryStatus) chatHistoryStatus.textContent = "Chat history is unavailable right now.";
      return;
    }

    historyStorageKey = await getConversationStorageKey(client);
    const { data: sessionData, error } = await client.auth.getSession();
    if (error) {
      if (chatHistoryStatus) chatHistoryStatus.textContent = "Could not check your sign-in status.";
      console.error("Chat history session error:", error);
      return;
    }

    if (!sessionData?.session?.user) {
      // Guest conversations are not listed or restored from the database.
      sessionStorage.removeItem(historyStorageKey);
      activeConversationId = null;
      await loadChatHistory(client);
      return;
    }

    const storedConversationId = sessionStorage.getItem(historyStorageKey);
    if (storedConversationId === NEW_CHAT_SESSION_MARKER) {
      activeConversationId = null;
      await loadChatHistory(client);
      return;
    }

    await loadChatHistory(client);

    // Resume the last active conversation, or the latest saved one if its ID
    // was lost before the function response reached the browser.
    const savedConversation = savedConversations.find(
      (conversation) => conversation.conversation_id === storedConversationId
    ) ?? savedConversations[0];

    if (savedConversation) {
      activeConversationId = savedConversation.conversation_id;
      sessionStorage.setItem(historyStorageKey, activeConversationId);
      await openConversation(savedConversation);
    } else {
      sessionStorage.removeItem(historyStorageKey);
      activeConversationId = null;
      showWelcomeMessage();
    }
  };

  if (chatMessages && chatHistory) initializeChatHistory();

  // Filter calendar event cards by the selected category.
  const categoryButtons = document.querySelectorAll(".category-filter");
  const eventCards = document.querySelectorAll(".event-card");

  categoryButtons.forEach((button) => {
    button.addEventListener("click", () => {
      categoryButtons.forEach((item) => item.classList.remove("active"));
      button.classList.add("active");

      const category = button.dataset.category;
      eventCards.forEach((card) => {
        card.hidden = category !== "all" && card.dataset.category !== category;
      });
    });
  });

  // Show a confirmation toast when an event card is selected.
  document.querySelectorAll("[data-event]").forEach((event) => {
    event.addEventListener("click", () => {
      showToast(`${event.dataset.event} selected. Event details would open here.`);
    });
  });
});
