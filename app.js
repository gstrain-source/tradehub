/* TradeHub — app shell: auth gating, routing between pages, sidebar/topbar behavior, live clock & badge. */
window.TH = window.TH || {};

(function () {
  let currentStop = null;
  let liveBadgeEl, clockEl, sidebarEl, overlayEl;
  let shellBound = false;
  let pagesShown = false;
  let clockTimer = null;

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

  function updateUserMenu(session) {
    const avatar = document.getElementById("userAvatar");
    const emailEl = document.getElementById("userMenuEmail");
    if (!avatar) return;
    const email = session && session.user ? (session.user.email || "") : "";
    avatar.textContent = email ? email[0].toUpperCase() : "?";
    avatar.title = email || "Not signed in (setup mode)";
    if (emailEl) emailEl.textContent = email || "Not signed in — auth not configured yet";
  }

  function bindShellOnce() {
    if (shellBound) return;
    shellBound = true;

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

    const avatar = document.getElementById("userAvatar");
    const dropdown = document.getElementById("userMenuDropdown");
    if (avatar && dropdown) {
      avatar.addEventListener("click", (e) => {
        e.stopPropagation();
        dropdown.classList.toggle("open");
      });
      document.addEventListener("click", () => dropdown.classList.remove("open"));
    }

    const signOutBtn = document.getElementById("signOutBtn");
    if (signOutBtn) {
      signOutBtn.addEventListener("click", async () => {
        if (TH.auth && TH.auth.isConfigured()) {
          try { await TH.auth.signOut(); } catch (e) { console.error(e); }
        } else {
          hideApp();
        }
      });
    }
  }

  function revealApp(session) {
    document.getElementById("authScreen").style.display = "none";
    document.getElementById("appRoot").style.display = "";
    bindShellOnce();
    updateUserMenu(session);
    if (!clockTimer) { tickClock(); clockTimer = setInterval(tickClock, 1000); }
    if (!pagesShown) { pagesShown = true; showPage("dashboard"); }
  }

  function hideApp() {
    if (typeof currentStop === "function") { currentStop(); currentStop = null; }
    document.getElementById("appRoot").style.display = "none";
    document.getElementById("authScreen").style.display = "";
    if (TH.authUI) TH.authUI.render();
  }

  function init() {
    liveBadgeEl = document.getElementById("liveBadge");
    clockEl = document.getElementById("clock");
    sidebarEl = document.getElementById("sidebar");
    overlayEl = document.getElementById("sidebar-overlay");

    if (TH.auth && TH.auth.isConfigured()) {
      TH.auth.onAuthStateChange((session) => {
        if (session) revealApp(session);
        else hideApp();
      });
      TH.auth.getSession().then((session) => {
        if (session) revealApp(session);
        else if (TH.authUI) TH.authUI.render();
      });
    } else if (TH.authUI) {
      // Not configured — show the setup notice with a "continue without signing in" escape hatch.
      TH.authUI.render();
    } else {
      // auth-ui.js missing entirely; fail open so the dashboard still loads.
      revealApp(null);
    }
  }

  TH.app = { setLive: setLive, showPage: showPage, revealApp: revealApp, hideApp: hideApp };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
