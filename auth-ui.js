/* TradeHub — login / sign-up screen. Renders into #authScreen.
   Talks only to TH.auth — once a sign-in/sign-up call succeeds, TH.auth's onAuthStateChange
   listener (wired up in app.js) is what actually reveals the dashboard. This file just owns
   the form UI, validation, and error/loading states. */
window.TH = window.TH || {};

(function () {
  const state = { mode: "signin", loading: false, error: "", info: "" };

  function googleIcon() {
    return `<svg width="18" height="18" viewBox="0 0 48 48" style="vertical-align:-4px;margin-right:8px;">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.6C29.6 35.4 27 36 24 36c-5.3 0-9.6-3.1-11.3-7.5l-6.6 5.1C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4 5.7l6.6 5.6C41.6 36 44 30.4 44 24c0-1.3-.1-2.7-.4-3.5z"/>
    </svg>`;
  }

  function render() {
    const host = document.getElementById("authScreen");
    if (!host) return;

    if (!TH.auth || !TH.auth.isConfigured()) {
      host.innerHTML = `
        <div class="auth-wrap">
          <div class="auth-card">
            <div class="auth-brand"><span class="brand-mark">TH</span><span class="brand-name">TradeHub</span></div>
            <h1 class="auth-title">Auth isn't set up yet</h1>
            <p class="auth-sub">Add your Supabase project URL and anon key to <code>auth-config.js</code> to turn on email &amp; Google sign-in. Until then you can preview the dashboard without logging in.</p>
            <button class="btn" id="authSkipBtn" style="width:100%;margin-top:10px;">Continue without signing in</button>
          </div>
        </div>
      `;
      host.querySelector("#authSkipBtn").addEventListener("click", () => {
        if (TH.app && TH.app.revealApp) TH.app.revealApp(null);
      });
      return;
    }

    host.innerHTML = `
      <div class="auth-wrap">
        <div class="auth-card">
          <div class="auth-brand"><span class="brand-mark">TH</span><span class="brand-name">TradeHub</span></div>

          <div class="auth-tabs">
            <button class="auth-tab ${state.mode === "signin" ? "active" : ""}" data-mode="signin">Sign in</button>
            <button class="auth-tab ${state.mode === "signup" ? "active" : ""}" data-mode="signup">Sign up</button>
          </div>

          <button class="btn-google" id="googleBtn">${googleIcon()}Continue with Google</button>
          <div class="auth-divider"><span>or with email</span></div>

          <form id="authForm">
            <div class="form-row"><label>Email</label><input type="email" id="authEmail" required autocomplete="email" /></div>
            <div class="form-row"><label>Password</label><input type="password" id="authPassword" required minlength="6" autocomplete="${state.mode === "signup" ? "new-password" : "current-password"}" /></div>
            ${state.error ? `<div class="auth-msg auth-msg-error">${TH.util.escapeHtml(state.error)}</div>` : ""}
            ${state.info ? `<div class="auth-msg auth-msg-info">${TH.util.escapeHtml(state.info)}</div>` : ""}
            <button type="submit" class="btn" style="width:100%;margin-top:6px;" ${state.loading ? "disabled" : ""}>
              ${state.loading ? "Please wait…" : state.mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <div class="auth-footnote">
            ${state.mode === "signin" ? `Don't have an account? <a href="#" id="switchToSignup">Sign up</a>` : `Already have an account? <a href="#" id="switchToSignin">Sign in</a>`}
          </div>
        </div>
      </div>
    `;

    host.querySelectorAll(".auth-tab").forEach((btn) => {
      btn.addEventListener("click", () => { state.mode = btn.getAttribute("data-mode"); state.error = ""; state.info = ""; render(); });
    });
    const switchLink = host.querySelector("#switchToSignup") || host.querySelector("#switchToSignin");
    if (switchLink) switchLink.addEventListener("click", (e) => {
      e.preventDefault();
      state.mode = state.mode === "signin" ? "signup" : "signin";
      state.error = ""; state.info = "";
      render();
    });

    host.querySelector("#googleBtn").addEventListener("click", async () => {
      state.error = "";
      try {
        await TH.auth.signInWithGoogle();
        // browser will redirect to Google; nothing more to do here
      } catch (err) {
        state.error = err.message || "Google sign-in failed.";
        render();
      }
    });

    host.querySelector("#authForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = host.querySelector("#authEmail").value.trim();
      const password = host.querySelector("#authPassword").value;
      state.error = ""; state.info = ""; state.loading = true;
      render();
      try {
        if (state.mode === "signin") {
          await TH.auth.signInWithEmail(email, password);
          // onAuthStateChange listener in app.js reveals the app from here
        } else {
          const result = await TH.auth.signUpWithEmail(email, password);
          state.loading = false;
          if (result && result.session) {
            // email confirmation disabled on this project — signed in immediately
          } else {
            state.info = "Account created. Check your email to confirm it, then sign in.";
            state.mode = "signin";
          }
          render();
        }
      } catch (err) {
        state.loading = false;
        state.error = err.message || "Something went wrong. Please try again.";
        render();
      }
    });
  }

  TH.authUI = { render: render };
})();
