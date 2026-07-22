/* TradeHub — app shell: routing between pages, sidebar/topbar behavior, live clock & badge. */
window.TH = window.TH || {};

(function () {
  let currentStop = null;
  let liveBadgeEl, clockEl, sidebarEl, overlayEl;

  function setLive(isLive) {
    if (!liveBadgeEl) return;
    if (isLive) {
      liveBadgeEl.textContent = "LIVE";
      liveBadgeEl.className = "badge badge-live";
    } else {
      liveBadgeEl.textContent = "DEMO DATA";
      liveBadgeEl.className = "badge badge-demo";
    }
  }

  function tickClock() {
    if (!clockEl) return;
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString("en-IN", { hour12: false });
  }

  function showPage(name) {
    if (typeof currentStop === "function") { currentStop(); currentStop = null; }

    document.querySelectorAll(".nav-item").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-page") === name);
    });
    document.querySelectorAll(".page").forEach((sec) => {
      sec.classList.toggle("active", sec.id === "page-" + name);
    });

    const container = document.getElementById("page-" + name);
    const pageModule = TH.pages && TH.pages[name];
    if (pageModule && container && !container.dataset.rendered) {
      const result = pageModule.render(container);
      if (typeof result === "function") currentStop = result;
      container.dataset.rendered = "1";
    } else if (pageModule && container) {
      // already rendered once; re-render fresh each visit to keep data current
      container.innerHTML = "";
      const result = pageModule.render(container);
      if (typeof result === "function") currentStop = result;
    }

    if (window.innerWidth <= 880) {
      sidebarEl.classList.remove("open");
      overlayEl.classList.remove("open");
    }
    window.scrollTo(0, 0);
  }

  function init() {
    liveBadgeEl = document.getElementById("liveBadge");
    clockEl = document.getElementById("clock");
    sidebarEl = document.getElementById("sidebar");
    overlayEl = document.getElementById("sidebar-overlay");

    document.querySelectorAll(".nav-item").forEach((btn) => {
      btn.addEventListener("click", () => showPage(btn.getAttribute("data-page")));
    });

    document.getElementById("menuToggle").addEventListener("click", () => {
      sidebarEl.classList.toggle("open");
      overlayEl.classList.toggle("open");
    });
    overlayEl.addEventListener("click", () => {
      sidebarEl.classList.remove("open");
      overlayEl.classList.remove("open");
    });

    tickClock();
    setInterval(tickClock, 1000);

    showPage("dashboard");
  }

  TH.app = { setLive: setLive, showPage: showPage };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
