/* TradeHub — app shell: routing between pages, sidebar/topbar behavior, live clock & badge,
   and optional sign-in (dashboard works without an account; the auth modal is opt-in). */
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

  // ---- Optional auth: sign-in button <-> user menu, modal open/close ----

  function updateAuthUI(session) {
    const signInBtn = document.getElementById("signInBtn");
    const userMenuWrap = document.getElementById("userMenuWrap");
    const avatar = document.getElementById("userAvatar");
    const emailEl = document.getElementById("userMenuEmail");
    const signedIn = !!(session && session.user);

    if (signInBtn) signInBtn.style.display = signedIn ? "none" : "";
    if (userMenuWrap) userMenuWrap.style.display = signedIn ? "" : "none";

    if (signedIn && avatar) {
      const email = session.user.email || "";
      avatar.textContent = email ? email[0].toUpperCase() : "U";
      avatar.title = email;
      if (emailEl) emailEl.textContent = email;
    }
  }

  function openAuthModal() {
    const el = document.getElementById("authScreen");
    if (!el) return;
    el.classList.add("open");
    if (TH.authUI) TH.authUI.render();
  }

  function closeAuthModal() {
    const el = document.getElementById("authScreen");
    if (el) el.classList.remove("open");
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

    const signInBtn = document.getElementById("signInBtn");
    if (signInBtn) signInBtn.addEventListener("click", openAuthModal);

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
        }
        updateAuthUI(null);
      });
    }

    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAuthModal(); });

    // Dashboard is visible immediately — sign-in is opt-in, not a gate.
    tickClock();
    setInterval(tickClock, 1000);
    showPage("dashboard");

    if (TH.auth && TH.auth.isConfigured()) {
      TH.auth.onAuthStateChange((session) => {
        updateAuthUI(session);
        if (session) closeAuthModal();
      });
      TH.auth.getSession().then((session) => updateAuthUI(session));
    } else {
      updateAuthUI(null);
    }
  }

  TH.app = {
    setLive: setLive,
    showPage: showPage,
    openAuthModal: openAuthModal,
    closeAuthModal: closeAuthModal
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
