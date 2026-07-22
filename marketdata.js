/* TradeHub — live market data layer.
   Tries to pull real quotes from Yahoo Finance's public chart endpoint (no API key required).
   Yahoo does not reliably send CORS headers for browser fetches, so we also try a public
   CORS relay as a second attempt. If both fail (offline, blocked, rate-limited, relay down),
   callers fall back to the bundled demo data in data.js — the UI keeps working either way
   and shows a DEMO DATA / LIVE badge so it's always clear which one you're looking at.

   Swap this file out for your real data provider (broker API, NSE feed, Bloomberg, etc.)
   when you're ready — every page reads through the functions below, not straight from data.js. */
window.TH = window.TH || {};

(function () {
  const YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart/";
  const CORS_RELAY = "https://api.allorigins.win/raw?url=";
  const TIMEOUT_MS = 6000;

  function fetchWithTimeout(url, ms) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    return fetch(url, { signal: controller.signal, cache: "no-store" }).finally(() => clearTimeout(id));
  }

  function parseYahoo(json, symbol) {
    const result = json && json.chart && json.chart.result && json.chart.result[0];
    if (!result || !result.meta) return null;
    const meta = result.meta;
    const price = meta.regularMarketPrice;
    const prevClose = meta.previousClose != null ? meta.previousClose : meta.chartPreviousClose;
    if (price == null || prevClose == null) return null;
    const change = price - prevClose;
    const changePct = prevClose ? (change / prevClose) * 100 : 0;
    return {
      symbol: symbol,
      price: price,
      change: change,
      changePct: changePct,
      dayHigh: meta.regularMarketDayHigh,
      dayLow: meta.regularMarketDayLow,
      volume: meta.regularMarketVolume,
      currency: meta.currency,
      marketTime: meta.regularMarketTime,
      live: true
    };
  }

  async function fetchYahooQuote(symbol) {
    const url = YAHOO_CHART + encodeURIComponent(symbol) + "?interval=1d&range=1d";
    try {
      const res = await fetchWithTimeout(url, TIMEOUT_MS);
      if (!res.ok) throw new Error("bad response " + res.status);
      const json = await res.json();
      const parsed = parseYahoo(json, symbol);
      if (parsed) return parsed;
      throw new Error("unparsable response");
    } catch (directErr) {
      try {
        const res = await fetchWithTimeout(CORS_RELAY + encodeURIComponent(url), TIMEOUT_MS + 2000);
        if (!res.ok) throw new Error("relay bad response " + res.status);
        const json = await res.json();
        return parseYahoo(json, symbol);
      } catch (relayErr) {
        return null;
      }
    }
  }

  async function fetchQuotes(symbols) {
    const results = await Promise.all(symbols.map(fetchYahooQuote));
    const map = {};
    symbols.forEach((s, i) => { map[s] = results[i]; });
    return map;
  }

  /**
   * Poll a set of symbols on an interval, merging live quotes over a fallback map.
   * onUpdate(mergedMap, anyLive) is called after every poll (including the first, immediate one).
   * Returns a stop() function.
   */
  function pollQuotes(symbols, fallbackMap, onUpdate, intervalMs) {
    intervalMs = intervalMs || 30000;
    let stopped = false;
    let timer = null;

    async function tick() {
      if (stopped) return;
      const live = await fetchQuotes(symbols);
      if (stopped) return;
      let anyLive = false;
      const merged = {};
      symbols.forEach((s) => {
        if (live[s]) { merged[s] = live[s]; anyLive = true; }
        else { merged[s] = fallbackMap[s] || null; }
      });
      onUpdate(merged, anyLive);
      timer = setTimeout(tick, intervalMs);
    }

    tick();
    return function stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }

  TH.marketData = {
    fetchYahooQuote: fetchYahooQuote,
    fetchQuotes: fetchQuotes,
    pollQuotes: pollQuotes
  };
})();
