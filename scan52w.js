/* TradeHub — 52-Week High Scanner.

   Classic "52-week-high momentum" strategy: stocks making fresh 52-week highs tend to keep
   outperforming for a while (the market underreacts to good news near old highs — George &
   Hwang's 52-week-high effect). This page screens TH.data.scanUniverse (~50 NSE large/mid-caps)
   for stocks at/near their 52-week high and flags genuine breakouts, scored on 5 parameters:

     Technical (computed live from ~1y of Yahoo Finance weekly candles):
       1. % From 52-Week High  — how close the current price is to its 52w high
       2. RS Score             — percentile rank of 6-month price return within this universe
       3. Volume Surge         — latest volume vs. this stock's own 1y average volume
     A stock is also flagged NEW HIGH when its latest price exceeds every prior high in the
     fetched window — i.e. it just broke out, not just sitting near an old peak.

     Fundamental (demo — see note below):
       4. ROE %
       5. YoY Profit Growth %

   Fundamentals aren't available from any free, CORS-friendly, live source, so they're
   generated as clearly-labeled deterministic demo data per symbol. Swap in a real
   fundamentals feed (screener.in-style vendor, broker API, paid data provider) by replacing
   demoFundamentals() below — everything downstream (scoring, table, filters) stays the same.
   If a symbol's live price history fails to load, it falls back to deterministic demo price
   data too, so the table is always fully populated; each row is tagged LIVE or DEMO. */
window.TH = window.TH || {};
TH.pages = TH.pages || {};

(function () {
  const U = TH.util;

  function hashSeed(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
    return h >>> 0;
  }
  function seededRand(seed) {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  const state = {
    rows: null,
    scanning: false,
    progress: { done: 0, total: 0 },
    lastScanAt: null,
    threshold: "5",
    sector: "All",
    newHighOnly: false,
    sortKey: "compositeScore",
    sortDir: "desc",
    expanded: null,
    autoScanTried: false
  };

  function demoFundamentals(symbol) {
    const seed = hashSeed(symbol + "fund");
    return {
      roe: 6 + seededRand(seed + 1) * 30,
      debtToEquity: seededRand(seed + 2) * 1.6,
      salesGrowthYoY: -5 + seededRand(seed + 3) * 35,
      profitGrowthYoY: -10 + seededRand(seed + 4) * 50,
      peRatio: 8 + seededRand(seed + 5) * 55
    };
  }

  function fallbackPriceData(item) {
    // Reuse the equity screener's demo row for the same symbol if there is one, for consistency.
    const wl = TH.data.watchlist.find((w) => w.symbol === item.display);
    if (wl) {
      return {
        currentPrice: wl.ltp, high52w: wl.high52w, low52w: wl.low52w,
        latestVolume: wl.volume, avgVolume: wl.volume * 0.85, return6m: null, closes: null
      };
    }
    const seed = hashSeed(item.symbol);
    const r1 = seededRand(seed + 1), r2 = seededRand(seed + 2), r3 = seededRand(seed + 3), r4 = seededRand(seed + 4);
    const basePrice = 80 + r1 * 3200;
    const high52w = basePrice * (1.08 + r2 * 0.45);
    const low52w = high52w * (0.55 + r3 * 0.25);
    const nearHigh = hashSeed(item.symbol + "bias") % 4 === 0; // seed ~1 in 4 near their high
    const currentPrice = nearHigh ? high52w * (0.965 + r4 * 0.035) : low52w + r4 * (high52w - low52w) * 0.85;
    const latestVolume = Math.round(200000 + r1 * 4000000);
    const avgVolume = Math.round(latestVolume * (0.6 + r2 * 0.5));
    return { currentPrice, high52w, low52w, latestVolume, avgVolume, return6m: null, closes: null, newHighBias: nearHigh };
  }

  function computeRSScores(rows) {
    const withReturn = rows.filter((r) => r.return6m != null).sort((a, b) => a.return6m - b.return6m);
    withReturn.forEach((r, i) => { r.rsScore = Math.max(1, Math.round(((i + 1) / withReturn.length) * 99)); r.rsLive = true; });
    rows.forEach((r) => {
      if (r.rsScore == null) { r.rsScore = 1 + Math.round(seededRand(hashSeed(r.symbol + "rs")) * 98); r.rsLive = false; }
    });
  }

  function computeCompositeScores(rows) {
    rows.forEach((r) => {
      const closeness = r.pctFromHigh != null ? clamp(100 + r.pctFromHigh * 8, 0, 100) : 0;
      const rs = r.rsScore || 0;
      const volScore = r.volumeSurge != null ? clamp((r.volumeSurge - 1) * 100, 0, 100) : 0;
      const roeScore = clamp((r.roe / 35) * 100, 0, 100);
      const growthScore = clamp(((r.profitGrowthYoY + 10) / 50) * 100, 0, 100);
      let score = (closeness + rs + volScore + roeScore + growthScore) / 5;
      if (r.isNewHigh) score = Math.min(100, score + 5); // small bonus for a genuine fresh breakout
      r.compositeScore = Math.round(score);
    });
  }

  async function runScan(container) {
    state.scanning = true;
    state.expanded = null;
    state.progress = { done: 0, total: TH.data.scanUniverse.length };
    renderBody(container);

    const symbols = TH.data.scanUniverse.map((i) => i.symbol);
    const histories = await TH.marketData.fetchHistoryBatch(symbols, 6, (done, total) => {
      state.progress = { done, total };
      renderProgress(container);
    });

    const rows = TH.data.scanUniverse.map((item, i) => {
      const hist = histories[i];
      const price = hist || fallbackPriceData(item);
      const fund = demoFundamentals(item.symbol);
      const pctFromHigh = price.high52w ? ((price.currentPrice - price.high52w) / price.high52w) * 100 : null;
      const volumeSurge = price.avgVolume ? price.latestVolume / price.avgVolume : null;

      // Breakout detection: is the latest price above every *prior* high in the window
      // (i.e. a fresh 52-week high), rather than just sitting near an old peak?
      let isNewHigh = false;
      if (hist && hist.highs && hist.highs.length > 1) {
        const priorHigh = Math.max.apply(null, hist.highs.slice(0, -1));
        isNewHigh = price.currentPrice >= priorHigh;
      } else if (!hist) {
        isNewHigh = !!price.newHighBias;
      }

      return Object.assign({}, item, {
        currentPrice: price.currentPrice,
        high52w: price.high52w,
        low52w: price.low52w,
        pctFromHigh: pctFromHigh,
        volumeSurge: volumeSurge,
        return6m: price.return6m,
        closes: price.closes || null,
        isNewHigh: isNewHigh,
        live: !!hist
      }, fund);
    });

    computeRSScores(rows);
    computeCompositeScores(rows);

    state.rows = rows;
    state.scanning = false;
    state.lastScanAt = new Date();
    renderBody(container);
  }

  function renderProgress(container) {
    const host = container.querySelector("#scanBody");
    if (!host || !state.scanning) return;
    const pct = state.progress.total ? Math.round((state.progress.done / state.progress.total) * 100) : 0;
    host.innerHTML = `
      <div class="card" style="text-align:center;padding:40px;">
        <div style="font-size:14px;margin-bottom:12px;">Scanning ${state.progress.total} stocks for live 52-week-high data… ${state.progress.done}/${state.progress.total}</div>
        <div style="height:8px;background:var(--panel-2);border-radius:4px;overflow:hidden;max-width:420px;margin:0 auto;">
          <div style="height:100%;background:var(--accent);width:${pct}%;transition:width .2s;"></div>
        </div>
      </div>
    `;
  }

  function getFilteredSorted() {
    const th = state.threshold === "all" ? null : Number(state.threshold);
    let rows = (state.rows || []).filter((r) => {
      if (th != null && (r.pctFromHigh == null || r.pctFromHigh < -th)) return false;
      if (state.sector !== "All" && r.sector !== state.sector) return false;
      if (state.newHighOnly && !r.isNewHigh) return false;
      return true;
    });
    rows.sort((a, b) => {
      const dir = state.sortDir === "asc" ? 1 : -1;
      const av = a[state.sortKey], bv = b[state.sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string") return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
    return rows;
  }

  function renderDetailRow(r, colCount) {
    const seriesId = "spark-" + r.symbol.replace(/[^a-zA-Z0-9]/g, "");
    return `
      <tr class="expand-row">
        <td colspan="${colCount}" style="text-align:left;background:var(--panel-2);">
          <div style="display:flex;gap:24px;flex-wrap:wrap;padding:12px 6px;">
            <div style="flex:1;min-width:260px;">
              <div style="font-size:11px;color:var(--muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.03em;">
                ${r.live ? "Live weekly price (1y) — dashed line = 52W high" : "No live chart data for this row (demo fallback)"}
              </div>
              <div id="${seriesId}"></div>
            </div>
            <div style="min-width:180px;">
              <div style="font-size:11px;color:var(--muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.03em;">Extra context</div>
              <div style="font-size:12.5px;line-height:1.9;">
                52W Low: <strong>${U.fmtNum(r.low52w)}</strong><br/>
                Debt/Equity: <strong>${r.debtToEquity.toFixed(2)}</strong> <span style="color:var(--muted);">(demo)</span><br/>
                P/E: <strong>${r.peRatio.toFixed(1)}</strong> <span style="color:var(--muted);">(demo)</span><br/>
                Sales Growth YoY: <strong class="${U.changeClass(r.salesGrowthYoY)}">${U.fmtPct(r.salesGrowthYoY, 1)}</strong> <span style="color:var(--muted);">(demo)</span><br/>
                6-Month Return: <strong class="${U.changeClass(r.return6m)}">${r.return6m != null ? U.fmtPct(r.return6m, 1) : "—"}</strong>
              </div>
            </div>
          </div>
        </td>
      </tr>
    `;
  }

  function mountDetailCharts(host) {
    if (!state.expanded || !state.rows) return;
    const r = state.rows.find((x) => x.symbol === state.expanded);
    if (!r || !r.closes || !r.closes.length) return;
    const seriesId = "spark-" + r.symbol.replace(/[^a-zA-Z0-9]/g, "");
    const el = host.querySelector("#" + seriesId);
    if (!el) return;
    const points = r.closes.map((c) => ({ y: c }));
    TH.charts.priceLine(el, points, { height: 140, refValue: r.high52w });
  }

  function renderBody(container) {
    const host = container.querySelector("#scanBody");
    if (!host) return;

    if (state.scanning) { renderProgress(container); return; }

    if (!state.rows) {
      host.innerHTML = `
        <div class="card" style="text-align:center;padding:40px;color:var(--muted);">
          Click <strong style="color:var(--text);">Scan Now</strong> above to fetch live prices for the 50-stock universe and screen for stocks at or near their 52-week high.
        </div>
      `;
      return;
    }

    const rows = getFilteredSorted();
    const liveCount = state.rows.filter((r) => r.live).length;
    const newHighCount = state.rows.filter((r) => r.isNewHigh).length;
    const colCount = 11;

    const cols = [
      { key: "display", label: "Symbol", align: "left" },
      { key: "sector", label: "Sector", align: "left" },
      { key: "currentPrice", label: "LTP" },
      { key: "high52w", label: "52W High" },
      { key: "pctFromHigh", label: "% From High" },
      { key: "rsScore", label: "RS Score" },
      { key: "volumeSurge", label: "Vol Surge" },
      { key: "roe", label: "ROE %" },
      { key: "profitGrowthYoY", label: "Profit Gr. YoY" },
      { key: "compositeScore", label: "Score" }
    ];

    const thead = `<tr>
      ${cols.map((c) => `<th class="sortable ${c.align === "left" ? "left" : ""}" data-sort="${c.key}">${c.label}${state.sortKey === c.key ? (state.sortDir === "asc" ? " ▲" : " ▼") : ""}</th>`).join("")}
      <th>Source</th>
    </tr>`;

    const tbody = rows.map((r) => {
      const mainRow = `
        <tr class="scan-row" data-symbol="${r.symbol}" style="cursor:pointer;">
          <td class="left">
            <strong>${r.display}</strong> ${r.isNewHigh ? `<span class="pill pill-stage2" title="Fresh 52-week high">NEW HIGH</span>` : ""}
            <div style="color:var(--muted);font-size:11px;">${r.name}</div>
          </td>
          <td class="left">${r.sector}</td>
          <td>${U.fmtNum(r.currentPrice)}</td>
          <td>${U.fmtNum(r.high52w)}</td>
          <td class="${r.pctFromHigh != null && r.pctFromHigh >= -0.5 ? "up" : ""}">${r.pctFromHigh != null ? U.fmtPct(r.pctFromHigh, 1) : "—"}</td>
          <td>${r.rsScore}${r.rsLive ? "" : "*"}</td>
          <td>${r.volumeSurge != null ? r.volumeSurge.toFixed(2) + "x" : "—"}</td>
          <td>${r.roe.toFixed(1)}</td>
          <td class="${U.changeClass(r.profitGrowthYoY)}">${U.fmtPct(r.profitGrowthYoY, 1)}</td>
          <td><strong>${r.compositeScore}</strong></td>
          <td><span class="badge ${r.live ? "badge-live" : "badge-demo"}" style="font-size:10px;">${r.live ? "LIVE" : "DEMO"}</span></td>
        </tr>
      `;
      return state.expanded === r.symbol ? mainRow + renderDetailRow(r, colCount) : mainRow;
    }).join("");

    host.innerHTML = `
      <div class="note">
        Scanned ${state.rows.length} stocks — <strong class="up">${liveCount} live</strong>, ${state.rows.length - liveCount} on demo fallback data (fetch failed or rate-limited).
        <strong class="up">${newHighCount} at a fresh 52-week high</strong> right now. Last scan: ${state.lastScanAt ? state.lastScanAt.toLocaleTimeString("en-IN") : "—"}.
        RS Score marked <strong>*</strong> is demo (no live history for that row). ROE/Profit Growth are always demo — see file header for why. Click a row for a mini chart and more detail.
      </div>
      <div class="card">
        <div class="table-wrap">
          <table><thead>${thead}</thead><tbody>${tbody || `<tr><td colspan="${colCount}" style="text-align:center;color:var(--muted);padding:24px;">No stocks match this filter</td></tr>`}</tbody></table>
        </div>
      </div>
    `;

    host.querySelectorAll("th[data-sort]").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.getAttribute("data-sort");
        if (state.sortKey === key) state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
        else { state.sortKey = key; state.sortDir = "desc"; }
        renderBody(container);
      });
    });

    host.querySelectorAll("tr.scan-row").forEach((tr) => {
      tr.addEventListener("click", () => {
        const sym = tr.getAttribute("data-symbol");
        state.expanded = state.expanded === sym ? null : sym;
        renderBody(container);
      });
    });

    mountDetailCharts(host);
  }

  function render(container) {
    const sectors = ["All", ...Array.from(new Set(TH.data.scanUniverse.map((i) => i.sector))).sort()];

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">52-Week High Scanner</h1>
          <div class="page-sub">Stocks at/near their 52-week high, ranked on 3 live technical + 2 fundamental parameters</div>
        </div>
        <button class="btn" id="scanBtn">Rescan</button>
      </div>

      <div class="toolbar">
        <select id="scanThreshold">
          <option value="1">Within 1% of 52W high</option>
          <option value="3">Within 3% of 52W high</option>
          <option value="5" selected>Within 5% of 52W high</option>
          <option value="10">Within 10% of 52W high</option>
          <option value="all">Show all (no threshold)</option>
        </select>
        <select id="scanSector">${sectors.map((s) => `<option value="${s}">${s}</option>`).join("")}</select>
        <div class="chip" id="scanNewHighToggle">🔺 Fresh breakouts only</div>
      </div>

      <div class="note">
        <strong>Strategy:</strong> stocks making genuine new 52-week highs tend to keep outperforming for a while — the market is often slow to price in the good news behind the breakout. NSE/BSE block direct browser scanning (no CORS, bot-detection), so this pulls ~1 year of weekly price history per stock straight from Yahoo Finance for a 50-stock NSE universe instead. <strong>% From High</strong>, <strong>RS Score</strong>, <strong>Vol Surge</strong> and the <strong>NEW HIGH</strong> flag are computed from that live data; <strong>ROE</strong> and <strong>Profit Growth</strong> are demo placeholders since free live fundamentals aren't available — swap in a real fundamentals vendor in <code>scan52w.js</code> when you have one.
      </div>

      <div id="scanBody"></div>
    `;

    container.querySelector("#scanBtn").addEventListener("click", () => runScan(container));
    container.querySelector("#scanThreshold").addEventListener("change", (e) => { state.threshold = e.target.value; renderBody(container); });
    container.querySelector("#scanSector").addEventListener("change", (e) => { state.sector = e.target.value; renderBody(container); });
    const newHighChip = container.querySelector("#scanNewHighToggle");
    newHighChip.addEventListener("click", () => {
      state.newHighOnly = !state.newHighOnly;
      newHighChip.classList.toggle("active", state.newHighOnly);
      renderBody(container);
    });

    renderBody(container);

    // Auto-run the first scan on first visit so the page isn't empty by default.
    if (!state.rows && !state.scanning && !state.autoScanTried) {
      state.autoScanTried = true;
      runScan(container);
    }
  }

  TH.pages.scan52w = { render: render };
})();
