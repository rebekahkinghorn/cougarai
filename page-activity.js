// Measures anonymous, engaged time for one visit to chatbot, FAQ, or Calendar.
// Time accrues only while the tab is visible and the visitor has been active
// within the last 30 seconds. No account IDs or page content are collected.
(() => {
  const pageKey = document.body.dataset.page;
  if (!["chatbot", "faq", "calendar"].includes(pageKey)) return;

  const client = window.cougarAuth?.client;
  if (!client || !globalThis.crypto?.randomUUID) return;

  const getOrCreateId = (storage, key) => {
    try {
      let id = storage.getItem(key);
      if (!id) {
        id = crypto.randomUUID();
        storage.setItem(key, id);
      }
      return id;
    } catch (error) {
      console.warn("Page activity storage is unavailable:", error);
      return crypto.randomUUID();
    }
  };

  const visitorId = getOrCreateId(localStorage, "byu-guide-visitor-id");
  const navigationType = performance.getEntriesByType("navigation")[0]?.type;
  const previousPage = sessionStorage.getItem("byu-guide-current-activity-page");
  const visitIdKey = `byu-guide-activity-visit:${pageKey}`;
  const stateKey = `byu-guide-activity-state:${pageKey}`;
  const reuseVisit = navigationType === "reload" && previousPage === pageKey;
  const visitId = reuseVisit
    ? getOrCreateId(sessionStorage, visitIdKey)
    : crypto.randomUUID();
  sessionStorage.setItem("byu-guide-current-activity-page", pageKey);
  sessionStorage.setItem(visitIdKey, visitId);

  let savedState = null;
  if (reuseVisit) {
    try {
      savedState = JSON.parse(sessionStorage.getItem(stateKey) || "null");
    } catch {
      savedState = null;
    }
  }

  const startedAt = savedState?.startedAt || new Date().toISOString();
  let engagedSeconds = Number.isInteger(savedState?.engagedSeconds) ? savedState.engagedSeconds : 0;
  let lastSavedSeconds = -1;
  let lastActivityAt = Date.now();
  let flushInFlight = false;
  const idleLimitMs = 30_000;

  const persistVisitState = () => {
    try {
      sessionStorage.setItem(stateKey, JSON.stringify({ startedAt, engagedSeconds }));
    } catch (error) {
      console.warn("Could not save page activity in this tab:", error);
    }
  };

  const flushActivity = async () => {
    if (flushInFlight || engagedSeconds <= lastSavedSeconds) return;
    flushInFlight = true;
    const secondsToSave = engagedSeconds;
    try {
      const { error } = await client.functions.invoke("track-page-activity", {
        body: {
          visitorId,
          sessionId: visitId,
          page: pageKey,
          startedAt,
          engagedSeconds: secondsToSave,
        },
      });
      if (error) throw error;
      lastSavedSeconds = Math.max(lastSavedSeconds, secondsToSave);
    } catch (error) {
      console.warn("Page activity could not be saved:", error);
    } finally {
      flushInFlight = false;
    }
  };

  // Insert a zero-second visit immediately so very short visits are represented.
  void flushActivity();

  const markActive = () => { lastActivityAt = Date.now(); };
  ["pointerdown", "keydown", "scroll", "touchstart"].forEach((eventName) => {
    document.addEventListener(eventName, markActive, { passive: true });
  });

  window.setInterval(() => {
    if (document.visibilityState === "visible" && Date.now() - lastActivityAt < idleLimitMs) {
      engagedSeconds += 1;
      persistVisitState();
    }
    if (engagedSeconds > 0 && engagedSeconds % 15 === 0) void flushActivity();
  }, 1000);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      persistVisitState();
      void flushActivity();
    } else {
      markActive();
    }
  });
  window.addEventListener("pagehide", () => {
    persistVisitState();
    void flushActivity();
  });
})();
