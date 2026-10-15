document.addEventListener("DOMContentLoaded", () => {
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

  const modalBackdrop = document.querySelector(".modal-backdrop");
  const openModal = () => modalBackdrop?.classList.add("show");
  const closeModal = () => modalBackdrop?.classList.remove("show");
  document.querySelectorAll("[data-open-modal]").forEach((button) => button.addEventListener("click", openModal));
  document.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", closeModal));
  modalBackdrop?.addEventListener("click", (event) => {
    if (event.target === modalBackdrop) closeModal();
  });
  document.querySelector(".modal-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    closeModal();
    showToast("Thanks—your issue was recorded for the prototype.");
    event.target.reset();
  });

  document.querySelectorAll(".faq-question").forEach((button) => {
    button.addEventListener("click", () => {
      const item = button.closest(".faq-item");
      const isOpen = item.classList.toggle("open");
      button.setAttribute("aria-expanded", String(isOpen));
    });
  });

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
      document.querySelectorAll(".filter[data-filter]").forEach((button) => button.classList.remove("active"));
      filter.classList.add("active");
      const category = filter.dataset.filter;
      faqItems.forEach((item) => {
        const matches = category === "all" || item.dataset.category === category;
        item.hidden = !matches;
      });
      if (faqEmpty) faqEmpty.classList.toggle("show", !faqItems.some((item) => !item.hidden));
    });
  });

  const chatMessages = document.querySelector("#chat-messages");
  const chatForm = document.querySelector("#chat-form");
  const chatInput = document.querySelector("#chat-input");
  const responseMap = {
    housing: "A good first step is to review the housing timeline and apply for on-campus housing as soon as your application opens. If you are waitlisted, compare off-campus options before the semester gets close.",
    mymap: "MyMap lets you build a class schedule. Add classes to your cart, check for conflicts, and submit when registration opens. It is normal for a few classes to fill, so review your schedule right after submission.",
    advisor: "You can connect with an academic advisor through BYU’s advising directory. Start with your college or intended major so you reach the right office.",
    events: "The calendar shows BYU and Provo events. Use the filters to narrow the list, then select an event for details and registration links.",
  };
  const addMessage = (text, type = "bot") => {
    if (!chatMessages) return;
    const message = document.createElement("div");
    message.className = `message${type === "user" ? " user" : ""}`;
    message.innerHTML = `${text}<small>${type === "user" ? "You" : "BYU Guide"} · just now</small>`;
    chatMessages.appendChild(message);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  };
  const getResponse = (question) => {
    const normalized = question.toLowerCase();
    if (normalized.includes("hous")) return responseMap.housing;
    if (normalized.includes("mymap") || normalized.includes("class") || normalized.includes("schedule")) return responseMap.mymap;
    if (normalized.includes("advisor") || normalized.includes("major")) return responseMap.advisor;
    if (normalized.includes("event") || normalized.includes("around provo")) return responseMap.events;
    return "I can help with housing, MyMap and class registration, academic advising, BYU requirements, and events around Provo. Try asking about one of those topics.";
  };
  const submitChat = (value) => {
    const question = value.trim();
    if (!question) return;
    addMessage(question, "user");
    if (chatInput) chatInput.value = "";
    setTimeout(() => addMessage(getResponse(question)), 350);
  };
  chatForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    submitChat(chatInput.value);
  });
  document.querySelectorAll("[data-question]").forEach((button) => button.addEventListener("click", () => submitChat(button.dataset.question)));
  document.querySelector("[data-clear-chat]")?.addEventListener("click", () => {
    if (chatMessages) chatMessages.innerHTML = '<div class="message">Hi! I’m your BYU Guide. Ask me anything about getting ready for campus, finding resources, or exploring Provo.<small>BYU Guide · just now</small></div>';
    showToast("Conversation cleared.");
  });

  const categoryButtons = document.querySelectorAll(".category-filter");
  const eventCards = document.querySelectorAll(".event-card");
  categoryButtons.forEach((button) => button.addEventListener("click", () => {
    categoryButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    const category = button.dataset.category;
    eventCards.forEach((card) => { card.hidden = category !== "all" && card.dataset.category !== category; });
  }));
  document.querySelectorAll("[data-event]").forEach((event) => event.addEventListener("click", () => {
    showToast(`${event.dataset.event} selected. Event details would open here.`);
  }));
});
