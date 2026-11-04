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
  const addMessage = (text, type = "bot") => {
    if (!chatMessages) return;

    const message = document.createElement("div");
    message.className = `message${type === "user" ? " user" : ""}`;
    message.textContent = text;

    const details = document.createElement("small");
    details.textContent = `${type === "user" ? "You" : "BYU Guide"} · just now`;
    message.appendChild(details);

    chatMessages.appendChild(message);
    chatMessages.scrollTop = chatMessages.scrollHeight;
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

    addMessage(question, "user");
    if (chatInput) chatInput.value = "";

    const client = window.cougarAuth?.client;
    if (!client) {
      addMessage("Chat connection is not set up on this page yet.");
      return;
    }

    const storageKey = await getConversationStorageKey(client);
    const conversationId = sessionStorage.getItem(storageKey);

    const { data, error } = await client.functions.invoke("chatbot", {
      body: {
        message: question,
        conversation_id: conversationId,
      },
    });

    if (error || !data?.reply) {
      addMessage("Sorry, I couldn't get an answer right now.");
      console.error("Chat function error:", error || data);
      return;
    }

    if (data.conversation_id) {
      sessionStorage.setItem(storageKey, data.conversation_id);
    }

    addMessage(data.reply);
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

  // Clear the saved conversation and restore the initial chat message.
  document
    .querySelector("[data-clear-chat]")
    ?.addEventListener("click", async () => {
      const client = window.cougarAuth?.client;

      if (client) {
        const storageKey = await getConversationStorageKey(client);
        sessionStorage.removeItem(storageKey);
      }

      if (chatMessages) {
        chatMessages.innerHTML =
          '<div class="message">Hi! I’m your BYU Guide. Ask me anything about getting ready for campus, finding resources, or exploring Provo.<small>BYU Guide · just now</small></div>';
      }

      showToast("Conversation cleared.");
    });

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