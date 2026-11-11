// Load the shared site header and footer into each page's placeholders.
(() => {
  const loadPartial = async (selector, path) => {
    const placeholder = document.querySelector(selector);
    if (!placeholder) return;

    const response = await fetch(new URL(path, document.currentScript.src));
    if (!response.ok) throw new Error(`Could not load ${path} (${response.status}).`);
    placeholder.innerHTML = await response.text();
  };

  window.siteLayoutReady = Promise.all([
    loadPartial("#site-header", "partials/header.html"),
    loadPartial("#site-footer", "partials/footer.html"),
  ]).catch((error) => {
    console.error("Shared page layout failed to load:", error);
    document.querySelectorAll("#site-header, #site-footer").forEach((element) => {
      element.textContent = "The shared page layout could not be loaded. Please refresh the page.";
    });
  });
})();
