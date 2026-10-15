// Shared auth helper: creates one Supabase client and swaps the Sign up / Sign in
// buttons in the header for a "Hello, [name]!" greeting once a user exists.
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

    actions.replaceChildren(greeting, signOut);
  };

  // If someone is already signed in (e.g. they navigated from another page), greet them right away.
  document.addEventListener("DOMContentLoaded", async () => {
    if (!client) return;
    const { data } = await client.auth.getSession();
    if (data?.session?.user) showGreeting(data.session.user);
  });

  window.cougarAuth = { client, showGreeting };
})();
