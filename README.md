# TradeHub

A base dashboard for an equity, bond & options trading platform, styled after WealthLab's
dark, widget-driven layout. Built as a dependency-free static site (plain HTML/CSS/JS) so it
runs anywhere with zero build step, and is structured so new features are easy to bolt on.

## Running it

Because the pages load as ES-friendly plain `<script>` files (not modules), you can just
double-click **index.html** to open it in a browser. For the live-quote fetches to work
(rather than silently falling back to demo data), it's better to serve it over local HTTP:

```bash
npx serve .
# or
python3 -m http.server 8080
```

Then open the printed local address.

## What's included

- **Dashboard** — NIFTY/SENSEX/BANK NIFTY/INDIA VIX index cards (live-updating where possible), market breadth, top gainers/losers, watchlist snapshot.
- **Equity Screener** — sortable, filterable table (sector, stage, RS rating, watchlist star) over a sample 18-stock universe.
- **Option Chain & Analytics** — synthetic option chain per underlying (NIFTY/BANKNIFTY/RELIANCE/TCS), PCR, and an interactive single-leg payoff diagram.
- **Bonds & Portfolio** — bond tracker table, a YTM calculator, and a cross-asset (equity/bond/option) holdings table with P&L and allocation chart.

## Live data

`marketdata.js` pulls live index/stock quotes from Yahoo Finance's public chart endpoint
(no API key needed), with a CORS-relay fallback, and falls back to the bundled demo data in
`data.js` if both fail (offline, rate-limited, relay down, etc.) — the topbar badge shows
**LIVE** or **DEMO DATA** accordingly. Only the dashboard's index cards are wired to this
live path in the base build; everything else (screener, option chain, bonds) runs on the
demo dataset in `data.js`, since:

- NSE's real option-chain and bhavcopy endpoints block direct browser calls (no CORS, need session cookies) — you'll want a small backend or a licensed data vendor for those.
- Bond pricing/yield data generally requires a paid feed (CCIL, RBI retail direct APIs are limited, most bond data vendors are paid).

To wire up more live data, extend `TH.marketData` in `marketdata.js` and call it from the
relevant page module (`screener.js`, `options.js`, `bonds.js`) the same way `dashboard.js`
does with `TH.marketData.pollQuotes`.

## Project structure

```
index.html      Shell: topbar, sidebar nav, one <section> per page
styles.css       Dark theme, shared card/table/form styles
data.js          Demo/fallback data + shared formatting utilities (TH.util)
marketdata.js    Live quote fetching with fallback (TH.marketData)
charts.js        Tiny dependency-free SVG chart helpers (TH.charts)
dashboard.js     Dashboard page module (TH.pages.dashboard)
screener.js      Equity screener page module (TH.pages.screener)
options.js       Option chain & payoff page module (TH.pages.options)
bonds.js         Bonds + portfolio page module (TH.pages.bonds)
app.js           Routing between pages, sidebar/topbar behavior
```

## Adding a new page/feature

1. Add a nav button in `index.html`: `<button class="nav-item" data-page="myPage">…</button>`
2. Add a matching section: `<section id="page-myPage" class="page"></section>`
3. Create `mypage.js` exposing `TH.pages.myPage = { render(container) { ... } }` (return a
   function from `render` if you start any polling/timers, so `app.js` can stop it on navigation).
4. Add `<script src="mypage.js"></script>` to `index.html` before `app.js`.

Some natural next features given the WealthLab-style base: RS rating vs. Nifty/sector line
charts, alerts/scans, a real broker API integration for portfolio sync, saved/multiple
watchlists, and a backtesting module (all stubbed as "Coming soon" in the sidebar footer).

## Notes

- All figures across the screener, option chain, bond tracker and portfolio are **illustrative
  sample data**, not real market data or investment advice.
- No trades, orders, or money movement happen anywhere in this app — it's a read-only
  dashboard base for you to build broker integrations on top of later.
