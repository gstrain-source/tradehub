-- TradeHub — 52-Week High Scanner (full NSE), simplified schema.
-- Run this once in Supabase: Dashboard -> SQL Editor -> paste -> Run.
--
-- v2: NSE publishes its own daily "new 52-week high" list (the data behind
-- nseindia.com/market-data/52-week-high-equity-market), so this no longer needs a
-- symbol-master table or per-symbol price-history fetching — one table is enough.

create table if not exists public.scan_results (
  symbol             text primary key,          -- Yahoo Finance format, e.g. "AADHARHFC.NS"
  nse_code           text not null,              -- raw NSE trading symbol, e.g. "AADHARHFC"
  name               text not null,
  series             text,                       -- EQ, BE, SM, ST, etc. — NSE's list includes all of these
  scan_date          date not null,
  ltp                double precision,
  new_52w_high       double precision,           -- today's new 52-week high (NSE-confirmed)
  prev_52w_high      double precision,           -- the 52-week high it just broke (0/null if none on record)
  prev_high_date     text,                       -- NSE sends "-" for some rows (e.g. recently listed) — kept as text
  prev_close         double precision,
  change              double precision,
  pct_change         double precision,
  high_momentum_pct  double precision,           -- (new_52w_high - prev_52w_high) / prev_52w_high * 100
  roe                double precision,           -- demo — see function header for why
  profit_growth_yoy  double precision,           -- demo
  composite_score    integer,                    -- 0-100
  updated_at         timestamptz not null default now()
);

create index if not exists scan_results_composite_score_idx on public.scan_results (composite_score desc);
create index if not exists scan_results_scan_date_idx on public.scan_results (scan_date desc);

alter table public.scan_results enable row level security;

-- Public market data — anyone (including anonymous, unauthenticated visitors) can read it,
-- same as the rest of the dashboard.
drop policy if exists "Public read scan_results" on public.scan_results;
create policy "Public read scan_results" on public.scan_results for select using (true);

-- No insert/update/delete policy is defined for anon/authenticated roles, so only the
-- service_role key (used exclusively by the Edge Function, never the browser) can write here.
