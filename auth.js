// Shared auth helper: switches the signed-out header to the signed-in header
// whenever a Supabase user session exists.
// Load AFTER the Supabase CDN script and app.js on every page.
(() => {
  const SUPABASE_URL = "https://xyyhccpivxxgiatptwko.supabase.co";
  const SUPABASE_KEY = "sb_publishable_t0KWbxH_-fm7OfklTKJ40A_9IjQCumg";

  const client = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

  // Prefer the username chosen at sign up; fall back to the part of the email before the @.
  const getDisplayName = (user) =>
    (user?.user_metadata?.username || user?.email?.split("@")[0] || "friend").trim();

  const showGreeting = (user) => {
    const actions = document.querySelector(".nav-actions");
    if (!actions || !user) return;

    const greeting = document.createElement("span");
    greeting.className = "nav-greeting";
    greeting.textContent = `Hello, ${getDisplayName(user)}!`; // textContent keeps usernames from injecting HTML

    const signOut = document.createElement("button");
    signOut.type = "button";
    signOut.className = "button ghost small";
    signOut.textContent = "Sign out";
    signOut.addEventListener("click", async () => {
      if (client) await client.auth.signOut();
      location.reload();
    });

    const signedInActions = [greeting, signOut];
    if (document.body.dataset.page !== "chatbot") {
      const chatbotLink = document.createElement("a");
      chatbotLink.className = "button primary small";
      chatbotLink.href = "chatbot.html";
      chatbotLink.textContent = "Ask the guide";
      signedInActions.push(chatbotLink);
    }

    actions.replaceChildren(...signedInActions);
  };

  // If someone is already signed in (e.g. they navigated from another page), greet them right away.
  document.addEventListener("DOMContentLoaded", async () => {
    await window.siteLayoutReady;
    if (!client) return;
    const { data } = await client.auth.getSession();
    if (data?.session?.user) showGreeting(data.session.user);
  });

  window.cougarAuth = { client, showGreeting };



    document.addEventListener("DOMContentLoaded", async () => {
    await window.siteLayoutReady;
    const backdrop = document.querySelector(".signin-backdrop");
    const form = document.querySelector("#signin-form");
    const message = document.querySelector("#signin-message");
    const openButton = document.querySelector("[data-open-signin]");
    const closeButton = document.querySelector("[data-close-signin]");

    if (!backdrop || !form || !message || !openButton || !closeButton) return;

    const showMessage = (text, isError = false) => {
      message.textContent = text;
      message.style.color = isError ? "#b42318" : "#16794a";
    };

    const closeSignin = () => {
      backdrop.classList.remove("show");
      backdrop.setAttribute("aria-hidden", "true");
      form.reset();
      showMessage("");
    };

    openButton.addEventListener("click", () => {
      backdrop.classList.add("show");
      backdrop.setAttribute("aria-hidden", "false");
      document.querySelector("#signin-email").focus();
    });

    closeButton.addEventListener("click", closeSignin);

    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) closeSignin();
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!client) {
        showMessage("Sign-in is unavailable. Check the Supabase connection.", true);
        return;
      }

      const submitButton = form.querySelector('button[type="submit"]');
      submitButton.disabled = true;
      showMessage("Signing in…");

      try {
        const email = form.elements.email.value.trim();
        const password = form.elements.password.value;

        const { data, error } = await client.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        closeSignin();
        showGreeting(data.user);
      } catch (error) {
        console.error("Sign-in error:", error);
        showMessage(error.message || "Could not sign in. Check your email and password.", true);
      } finally {
        submitButton.disabled = false;
      }
    });
  });
})();
