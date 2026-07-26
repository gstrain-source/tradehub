// TradeHub — 52-Week High Scanner, full NSE, daily server-side job. v2 (simplified).
//
// Deploy as a Supabase Edge Function, triggered once a day by an external scheduler (see
// this repo's README for a free GitHub Actions cron example).
//
// v2 uses NSE's own "new 52-week high" feed — the same API that backs
// https://www.nseindia.com/market-data/52-week-high-equity-market — instead of computing
// 52-week highs ourselves from a year of per-symbol history. NSE has already done that work;
// this just reads their answer. That means: one HTTP request instead of hundreds, no symbol
// master list to maintain, and every row in the result is a *confirmed* new high, not an
// approximation.
//
// This still can't be called directly from the browser (nseindia.com doesn't send
// Access-Control-Allow-Origin, so a browser fetch would be blocked by CORS) — that's the
// one thing that still needs a server. Everything else about this job is now simple enough
// that it should finish in a couple of seconds, well within any Edge Function time limit.
//
// What it does:
//   1. Fetch https://www.nseindia.com/api/live-analysis-data-52weekhighstock
//   2. For each stock in the list (every one is *already* a confirmed new 52-week high today):
//        - compute high_momentum_pct = how much higher today's high is vs. the high it broke
//        - fill in ROE / profit growth with the same deterministic demo-fundamentals
//          generator the (now-simplified) browser page description references — no free live
//          fundamentals source exists; replace generateDemoFundamentals() with a real vendor
//          when you have one.
//        - compute a composite score from: today's % change, high-momentum %, ROE, profit growth
//   3. Upsert everything into public.scan_results.
//
// Required secret (set via `supabase secrets set SCAN_SECRET=...`): protects this function's
// URL from being triggered by random visitors. Auto-provided by Supabase: SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const NSE_52WH_URL = "https://www.nseindia.com/api/live-analysis-data-52weekhighstock";
const FETCH_TIMEOUT_MS = 15000;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-scan-secret",
  };
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}
async function fetchWithTimeout(url: string, ms: number, init: RequestInit = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

// ---- Deterministic demo fundamentals (same algorithm as the browser Quick Scan) ----
// No free, live, CORS-friendly fundamentals source exists — see file header. Replace this
// function with a real vendor call when you have one; everything downstream is unaffected.
function hashSeed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return h >>> 0;
}
function seededRand(seed: number): number {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function generateDemoFundamentals(symbol: string) {
  const seed = hashSeed(symbol + "fund");
  return {
    roe: 6 + seededRand(seed + 1) * 30,
    profitGrowthYoY: -10 + seededRand(seed + 4) * 50,
  };
}
function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

interface NseRow {
  symbol: string;
  comapnyName: string; // sic — NSE's own field name
  series: string;
  ltp: number;
  new52WHL: number;
  prev52WHL: number;
  prevHLDate: string;
  prevClose: string | number;
  change: number;
  pChange: number;
}

async function fetchNse52wHighs(): Promise<NseRow[]> {
  const res = await fetchWithTimeout(NSE_52WH_URL, FETCH_TIMEOUT_MS, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Referer": "https://www.nseindia.com/market-data/52-week-high-equity-market",
    },
  });
  if (!res.ok) throw new Error(`NSE 52-week-high feed fetch failed: ${res.status}`);
  const body = await res.json();
  if (!body || !Array.isArray(body.data)) throw new Error("NSE 52-week-high feed returned an unexpected shape");
  return body.data as NseRow[];
}

async function runScan(supabase: ReturnType<typeof createClient>) {
  const rows = await fetchNse52wHighs();
  const today = new Date().toISOString().slice(0, 10);

  const upsertRows = rows.map((r) => {
    const fund = generateDemoFundamentals(r.symbol);
    const prevHigh = Number(r.prev52WHL) || 0;
    const highMomentumPct = prevHigh > 0 ? ((r.new52WHL - prevHigh) / prevHigh) * 100 : null;

    const pctChangeScore = clamp(50 + (r.pChange || 0) * 5, 0, 100);
    const momentumScore = highMomentumPct != null ? clamp(highMomentumPct * 20, 0, 100) : 50;
    const roeScore = clamp((fund.roe / 35) * 100, 0, 100);
    const growthScore = clamp(((fund.profitGrowthYoY + 10) / 50) * 100, 0, 100);
    const compositeScore = Math.round((pctChangeScore + momentumScore + roeScore + growthScore) / 4);

    return {
      symbol: `${r.symbol}.NS`,
      nse_code: r.symbol,
      name: r.comapnyName,
      series: r.series,
      scan_date: today,
      ltp: r.ltp,
      new_52w_high: r.new52WHL,
      prev_52w_high: prevHigh || null,
      prev_high_date: r.prevHLDate,
      prev_close: Number(r.prevClose) || null,
      change: r.change,
      pct_change: r.pChange,
      high_momentum_pct: highMomentumPct,
      roe: fund.roe,
      profit_growth_yoy: fund.profitGrowthYoY,
      composite_score: compositeScore,
      updated_at: new Date().toISOString(),
    };
  });

  const chunkSize = 300;
  for (let i = 0; i < upsertRows.length; i += chunkSize) {
    const chunk = upsertRows.slice(i, i + chunkSize);
    const { error } = await supabase.from("scan_results").upsert(chunk, { onConflict: "symbol" });
    if (error) throw new Error(`scan_results upsert failed: ${error.message}`);
  }

  return { scanned: upsertRows.length, scanDate: today };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders() });

  const url = new URL(req.url);
  const secretExpected = Deno.env.get("SCAN_SECRET");
  const secretGiven = url.searchParams.get("secret") || req.headers.get("x-scan-secret");
  if (secretExpected && secretGiven !== secretExpected) {
    return json({ error: "unauthorized" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const scan = await runScan(supabase);
    return json({ ok: true, scan, ranAt: new Date().toISOString() });
  } catch (err) {
    return json({ ok: false, error: String(err instanceof Error ? err.message : err) }, 500);
  }
});
