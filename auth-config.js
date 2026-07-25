/* TradeHub — Supabase project config.
   Fill these in with your own project's values from:
   Supabase Dashboard → Project Settings → API

   The "anon public" key is NOT a secret — it's designed to be embedded in client-side code
   and is safe to commit to a public GitHub repo. Access control is enforced server-side by
   Supabase's Row Level Security (RLS) policies, not by hiding this key. Never put your
   "service_role" key here or anywhere in frontend code — that one IS secret. */
window.TH = window.TH || {};

TH.authConfig = {
  supabaseUrl: "https://hhvtlzrvvarytohmxqld.supabase.co",     // e.g. "https://abcdefghijk.supabase.co"
  supabaseAnonKey: "sb_publishable_vJ71VKpABwxK_iFnMkeqgQ_7ROuXf-u"
};
