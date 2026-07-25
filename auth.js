/* TradeHub — auth layer, thin wrapper around Supabase Auth.
   Handles email/password sign-up & sign-in, Google OAuth sign-in, session lookup, sign-out,
   and auth-state change subscription. Everything else in the app (auth-ui.js, app.js) talks
   to TH.auth, not to the Supabase client directly — swap providers later by rewriting this
   file only. */
window.TH = window.TH || {};

(function () {
  const cfg = TH.authConfig || {};
  let client = null;

  const looksConfigured = cfg.supabaseUrl && cfg.supabaseAnonKey &&
    !String(cfg.supabaseUrl).startsWith("YOUR_") && !String(cfg.supabaseAnonKey).startsWith("YOUR_");

  if (looksConfigured && window.supabase && typeof window.supabase.createClient === "function") {
    try {
      client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    } catch (e) {
      console.error("TradeHub auth: failed to create Supabase client", e);
      client = null;
    }
  }

  function isConfigured() {
    return !!client;
  }

  function requireClient() {
    if (!client) throw new Error("Auth isn't configured yet — add your Supabase URL/anon key to auth-config.js");
    return client;
  }

  async function signUpWithEmail(email, password) {
    const { data, error } = await requireClient().auth.signUp({ email, password });
    if (error) throw error;
    return data;
  }

  async function signInWithEmail(email, password) {
    const { data, error } = await requireClient().auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signInWithGoogle() {
    const { data, error } = await requireClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.href }
    });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    if (!client) return;
    const { error } = await client.auth.signOut();
    if (error) throw error;
  }

  async function getSession() {
    if (!client) return null;
    const { data, error } = await client.auth.getSession();
    if (error) { console.error("TradeHub auth: getSession error", error); return null; }
    return data.session;
  }

  /** cb(session|null) — fires immediately-ish and on every future auth change (sign in/out, token refresh). */
  function onAuthStateChange(cb) {
    if (!client) return function unsubscribe() {};
    const { data } = client.auth.onAuthStateChange((_event, session) => cb(session));
    return function unsubscribe() { data.subscription.unsubscribe(); };
  }

  TH.auth = {
    isConfigured,
    signUpWithEmail,
    signInWithEmail,
    signInWithGoogle,
    signOut,
    getSession,
    onAuthStateChange
  };
})();
