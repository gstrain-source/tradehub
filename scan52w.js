/* TradeHub — 52-Week High Scanner. Two modes:

   QUICK SCAN — a 50-stock sample, scanned live in your browser right now. Pulls ~1 year of
   weekly candles per stock from Yahoo Finance and approximates 52-week high/low, a genuine-
   breakout flag, an RS score (percentile 6-month return vs. this sample), and volume surge.
   Zero setup — this is what auto-runs on first visit.

   FULL NSE — reads a daily precomputed scan of NSE's *entire* new-52-week-high list for that
   trading day, produced by a scheduled Supabase Edge Function (see supabase-scan52w/README.md).
   That function reads NSE's own "new 52-week high" feed directly (the API behind
   https://www.nseindia.com/market-data/52-week-high-equity-market) — so unlike Quick Scan,
   this doesn't approximate anything: every row here is a 52-week high NSE itself confirmed
   for that day, with the exact previous high it broke. It won't have RS Score or Volume Surge
   (NSE's feed doesn't include those), but it covers the whole market, not just a 50-stock
   sample, and needs no client-side scanning at all.

   Both modes score ROE % and YoY Profit Growth % as demo placeholders — no free, live,
   CORS-friendly fundamentals source exists. Replace demoFundamentals() (browser) or
   generateDemoFundamentals() (supabase-scan52w/functions/scan-52w-high/index.ts) with a real
   vendor when you have one. */
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
    mode: "quick", // "quick" | "full"

    // Quick Scan state
    rows: null,
    scanning: false,
    progress: { done: 0, total: 0 },
    lastScanAt: null,
    threshold: "10",
    sector: "All",
    newHighOnly: false,
    sortKey: "compositeScore",
    sortDir: "desc",
    expanded: null,
    autoScanTried: false,

    // Full NSE state
    fullRows: null,
    fullLoading: false,
    fullLoadError: null,
    fullLoadedAt: null,
    fullScanDate: null,
    fullSeries: "All",
    fullSortKey: "compositeScore",
    fullSortDir: "desc",
    fullExpanded: null
  };

  /* ---------------------------- Quick Scan (unchanged logic) ---------------------------- */

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
    const nearHigh = hashSeed(item.symbol + "bias") % 4 === 0;
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
      if (r.isNewHigh) score = Math.min(100, score + 5);
      r.compositeScore = Math.round(score);
    });
  }

  async function runScan(container) {
    state.scanning = true;
    state.expanded = null;
    state.progress = { done: 0, total: TH.data.scanUniverse.length };
    renderMode(container);

    const symbols = TH.data.scanUniverse.map((i) => i.symbol);
    const histories = await TH.marketData.fetchHistoryBatch(symbols, 6, (done, total) => {
      state.progress = { done, total };
      renderMode(container);
    });

    const rows = TH.data.scanUniverse.map((item, i) => {
      const hist = histories[i];
      const price = hist || fallbackPriceData(item);
      const fund = demoFundamentals(item.symbol);
      const pctFromHigh = price.high52w ? ((price.currentPrice - price.high52w) / price.high52w) * 100 : null;
      const volumeSurge = price.avgVolume ? price.latestVolume / price.avgVolume : null;

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
    renderMode(container);
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

  function renderQuickBody(container) {
    const host = container.querySelector("#scanBody");
    if (!host) return;

    if (state.scanning) {
      const pct = state.progress.total ? Math.round((state.progress.done / state.progress.total) * 100) : 0;
      host.innerHTML = `
        <div class="card" style="text-align:center;padding:40px;">
          <div style="font-size:14px;margin-bottom:12px;">Scanning ${state.progress.total} stocks for live 52-week-high data… ${state.progress.done}/${state.progress.total}</div>
          <div style="height:8px;background:var(--panel-2);border-radius:4px;overflow:hidden;max-width:420px;margin:0 auto;">
            <div style="height:100%;background:var(--accent);width:${pct}%;transition:width .2s;"></div>
          </div>
        </div>
      `;
      return;
    }

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
        RS Score marked <strong>*</strong> is demo (no live history for that row). ROE/Profit Growth are always demo. Click a row for a mini chart and more detail.
      </div>
      <div class="card">
        <div class="table-wrap">
          <table><thead>${thead}</thead><tbody>${tbody || `<tr><td colspan="${colCount}" style="text-align:center;color:var(--muted);padding:24px;">
            No stocks in this 50-stock universe are within your threshold today — that's a real market read (not a bug), but try widening it.
            <br/><button class="btn btn-ghost" id="scanShowAllBtn" style="margin-top:10px;">Show all, no threshold</button>
          </td></tr>`}</tbody></table>
        </div>
      </div>
    `;

    const showAllBtn = host.querySelector("#scanShowAllBtn");
    if (showAllBtn) {
      showAllBtn.addEventListener("click", () => {
        state.threshold = "all";
        const thresholdSelect = container.querySelector("#scanThreshold");
        if (thresholdSelect) thresholdSelect.value = "all";
        renderQuickBody(container);
      });
    }

    host.querySelectorAll("th[data-sort]").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.getAttribute("data-sort");
        if (state.sortKey === key) state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
        else { state.sortKey = key; state.sortDir = "desc"; }
        renderQuickBody(container);
      });
    });

    host.querySelectorAll("tr.scan-row").forEach((tr) => {
      tr.addEventListener("click", () => {
        const sym = tr.getAttribute("data-symbol");
        state.expanded = state.expanded === sym ? null : sym;
        renderQuickBody(container);
      });
    });

    mountDetailCharts(host);
  }

  /* ------------------------------------ Full NSE ----------------------------------------- */

  function mapDbRow(row) {
    return {
      symbol: row.symbol,
      display: row.nse_code,
      name: row.name,
      series: row.series || "—",
      ltp: row.ltp,
      new52wHigh: row.new_52w_high,
      prev52wHigh: row.prev_52w_high,
      prevHighDate: row.prev_high_date,
      prevClose: row.prev_close,
      change: row.change,
      pctChange: row.pct_change,
      highMomentumPct: row.high_momentum_pct,
      roe: row.roe,
      profitGrowthYoY: row.profit_growth_yoy,
      compositeScore: row.composite_score
    };
  }

  async function loadFullNse(container) {
    state.fullLoading = true;
    state.fullLoadError = null;
    state.fullExpanded = null;
    renderMode(container);

    const client = TH.auth && TH.auth.getClient && TH.auth.getClient();
    if (!client) {
      state.fullLoading = false;
      state.fullLoadError = "Sign-in isn't configured (auth-config.js), so there's no Supabase connection to read the full-NSE results from.";
      renderMode(container);
      return;
    }

    try {
      const { data, error } = await client
        .from("scan_results")
        .select("*")
        .order("composite_score", { ascending: false });
      if (error) throw error;
      if (!data || !data.length) {
        state.fullLoadError = "No rows in scan_results yet. Deploy and run the scan-52w-high Edge Function at least once — see supabase-scan52w/README.md.";
        state.fullRows = [];
      } else {
        state.fullRows = data.map(mapDbRow);
        state.fullScanDate = data[0].scan_date || null;
      }
    } catch (err) {
      state.fullLoadError = (err && err.message) || "Couldn't reach the scan_results table. Has the backend been deployed? See supabase-scan52w/README.md.";
      state.fullRows = null;
    }

    state.fullLoading = false;
    state.fullLoadedAt = new Date();
    renderMode(container);
  }

  function getFullFilteredSorted() {
    let rows = (state.fullRows || []).filter((r) => state.fullSeries === "All" || r.series === state.fullSeries);
    rows.sort((a, b) => {
      const dir = state.fullSortDir === "asc" ? 1 : -1;
      const av = a[state.fullSortKey], bv = b[state.fullSortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string") return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
    return rows;
  }

  function renderFullDetailRow(r, colCount) {
    return `
      <tr class="expand-row">
        <td colspan="${colCount}" style="text-align:left;background:var(--panel-2);">
          <div style="padding:12px 6px;font-size:12.5px;line-height:1.9;">
            Previous 52W high: <strong>${r.prev52wHigh != null ? U.fmtNum(r.prev52wHigh) : "—"}</strong>
            ${r.prevHighDate && r.prevHighDate !== "-" ? ` (set ${U.escapeHtml(r.prevHighDate)})` : " (none on record — e.g. recently listed)"}<br/>
            Previous close: <strong>${r.prevClose != null ? U.fmtNum(r.prevClose) : "—"}</strong><br/>
            Change today: <strong class="${U.changeClass(r.change)}">${r.change != null ? U.fmtSigned(r.change) : "—"}</strong><br/>
            No mini chart in Full NSE mode — NSE's feed doesn't include price history, only today's confirmed new high.
          </div>
        </td>
      </tr>
    `;
  }

  function renderFullBody(container) {
    const host = container.querySelector("#scanBody");
    if (!host) return;

    if (state.fullLoading) {
      host.innerHTML = `
        <div class="card" style="text-align:center;padding:40px;">
          <div style="font-size:14px;">Loading the full-NSE scan from the database…</div>
        </div>
      `;
      return;
    }

    if (state.fullLoadError) {
      host.innerHTML = `
        <div class="card" style="text-align:center;padding:40px;color:var(--muted);">
          ${U.escapeHtml(state.fullLoadError)}
          <br/><br/>
          <button class="btn btn-ghost" id="scanRetryBtn">Retry</button>
        </div>
      `;
      const retryBtn = host.querySelector("#scanRetryBtn");
      if (retryBtn) retryBtn.addEventListener("click", () => loadFullNse(container));
      return;
    }

    if (!state.fullRows) {
      host.innerHTML = `
        <div class="card" style="text-align:center;padding:40px;color:var(--muted);">
          Click <strong style="color:var(--text);">Load Full NSE</strong> above to read the latest server-side daily scan.
        </div>
      `;
      return;
    }

    const rows = getFullFilteredSorted();
    const colCount = 9;

    const cols = [
      { key: "display", label: "Symbol", align: "left" },
      { key: "series", label: "Series", align: "left" },
      { key: "ltp", label: "LTP" },
      { key: "new52wHigh", label: "New 52W High" },
      { key: "pctChange", label: "% Chg Today" },
      { key: "highMomentumPct", label: "vs Prior High" },
      { key: "roe", label: "ROE %" },
      { key: "profitGrowthYoY", label: "Profit Gr. YoY" },
      { key: "compositeScore", label: "Score" }
    ];

    const thead = `<tr>
      ${cols.map((c) => `<th class="sortable ${c.align === "left" ? "left" : ""}" data-sort="${c.key}">${c.label}${state.fullSortKey === c.key ? (state.fullSortDir === "asc" ? " ▲" : " ▼") : ""}</th>`).join("")}
    </tr>`;

    const tbody = rows.map((r) => {
      const mainRow = `
        <tr class="scan-row" data-symbol="${r.symbol}" style="cursor:pointer;">
          <td class="left">
            <strong>${r.display}</strong> <span class="pill pill-stage2" title="Confirmed new 52-week high today">NEW HIGH</span>
            <div style="color:var(--muted);font-size:11px;">${U.escapeHtml(r.name)}</div>
          </td>
          <td class="left">${r.series}</td>
          <td>${U.fmtNum(r.ltp)}</td>
          <td>${U.fmtNum(r.new52wHigh)}</td>
          <td class="${U.changeClass(r.pctChange)}">${r.pctChange != null ? U.fmtPct(r.pctChange, 2) : "—"}</td>
          <td class="${r.highMomentumPct != null ? U.changeClass(r.highMomentumPct) : ""}">${r.highMomentumPct != null ? U.fmtPct(r.highMomentumPct, 2) : "—"}</td>
          <td>${r.roe.toFixed(1)}</td>
          <td class="${U.changeClass(r.profitGrowthYoY)}">${U.fmtPct(r.profitGrowthYoY, 1)}</td>
          <td><strong>${r.compositeScore}</strong></td>
        </tr>
      `;
      return state.fullExpanded === r.symbol ? mainRow + renderFullDetailRow(r, colCount) : mainRow;
    }).join("");

    host.innerHTML = `
      <div class="note">
        NSE confirmed <strong class="up">${state.fullRows.length} stocks</strong> hit a new 52-week high${state.fullScanDate ? ` on ${state.fullScanDate}` : ""} — every row here is real, not approximated.
        <strong>vs Prior High</strong> is how much higher today's high is than the 52-week high it just broke. ROE/Profit Growth are demo placeholders (see file header for why).
        Loaded: ${state.fullLoadedAt ? state.fullLoadedAt.toLocaleTimeString("en-IN") : "—"}. Click a row for more detail.
      </div>
      <div class="card">
        <div class="table-wrap">
          <table><thead>${thead}</thead><tbody>${tbody || `<tr><td colspan="${colCount}" style="text-align:center;color:var(--muted);padding:24px;">No stocks match this filter.</td></tr>`}</tbody></table>
        </div>
      </div>
    `;

    host.querySelectorAll("th[data-sort]").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.getAttribute("data-sort");
        if (state.fullSortKey === key) state.fullSortDir = state.fullSortDir === "asc" ? "desc" : "asc";
        else { state.fullSortKey = key; state.fullSortDir = "desc"; }
        renderFullBody(container);
      });
    });

    host.querySelectorAll("tr.scan-row").forEach((tr) => {
      tr.addEventListener("click", () => {
        const sym = tr.getAttribute("data-symbol");
        state.fullExpanded = state.fullExpanded === sym ? null : sym;
        renderFullBody(container);
      });
    });
  }

  /* -------------------------------------- Shell ------------------------------------------- */

  function renderMode(container) {
    if (state.mode === "full") renderFullBody(container);
    else renderQuickBody(container);
  }

  function renderToolbar(container) {
    const sectors = ["All", ...Array.from(new Set(TH.data.scanUniverse.map((i) => i.sector))).sort()];
    const seriesOptions = ["All", ...Array.from(new Set((state.fullRows || []).map((r) => r.series))).sort()];
    const toolbarHost = container.querySelector("#scanToolbar");

    if (state.mode === "quick") {
      toolbarHost.innerHTML = `
        <select id="scanThreshold">
          <option value="1">Within 1% of 52W high</option>
          <option value="3">Within 3% of 52W high</option>
          <option value="5">Within 5% of 52W high</option>
          <option value="10" ${state.threshold === "10" ? "selected" : ""}>Within 10% of 52W high</option>
          <option value="all">Show all (no threshold)</option>
        </select>
        <select id="scanSector">${sectors.map((s) => `<option value="${s}" ${state.sector === s ? "selected" : ""}>${s}</option>`).join("")}</select>
        <div class="chip ${state.newHighOnly ? "active" : ""}" id="scanNewHighToggle">🔺 Fresh breakouts only</div>
      `;
      container.querySelector("#scanThreshold").value = state.threshold;
      container.querySelector("#scanThreshold").addEventListener("change", (e) => { state.threshold = e.target.value; renderQuickBody(container); });
      container.querySelector("#scanSector").addEventListener("change", (e) => { state.sector = e.target.value; renderQuickBody(container); });
      const newHighChip = container.querySelector("#scanNewHighToggle");
      newHighChip.addEventListener("click", () => {
        state.newHighOnly = !state.newHighOnly;
        newHighChip.classList.toggle("active", state.newHighOnly);
        renderQuickBody(container);
      });
    } else {
      toolbarHost.innerHTML = `
        <select id="scanSeries">${seriesOptions.map((s) => `<option value="${s}" ${state.fullSeries === s ? "selected" : ""}>${s === "All" ? "All series" : s}</option>`).join("")}</select>
      `;
      const seriesSelect = container.querySelector("#scanSeries");
      if (seriesSelect) seriesSelect.addEventListener("change", (e) => { state.fullSeries = e.target.value; renderFullBody(container); });
    }
  }

  function render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">52-Week High Scanner</h1>
          <div class="page-sub">Stocks at/near their 52-week high — quick browser sample, or the full NSE list from a daily server-side job</div>
        </div>
        <button class="btn" id="scanBtn">${state.mode === "full" ? "Load Full NSE" : "Rescan"}</button>
      </div>

      <div class="toolbar">
        <div class="chip ${state.mode === "quick" ? "active" : ""}" id="modeQuickBtn">Quick Scan (50, live)</div>
        <div class="chip ${state.mode === "full" ? "active" : ""}" id="modeFullBtn">Full NSE (daily job)</div>
      </div>

      <div class="toolbar" id="scanToolbar"></div>

      <div class="note">
        <strong>Strategy:</strong> stocks making genuine new 52-week highs tend to keep outperforming for a while — the market is often slow to price in the good news behind the breakout.
        ${state.mode === "full"
          ? `<strong>Full NSE mode</strong> reads NSE's own daily "new 52-week high" feed (the API behind nseindia.com's 52-week-high page) via a scheduled Supabase Edge Function — see <code>supabase-scan52w/README.md</code> to deploy it. Every row is a real, NSE-confirmed new high, across the whole market, not an approximation.`
          : `<strong>Quick Scan</strong> pulls ~1 year of weekly price history straight from Yahoo Finance for a 50-stock sample, live in your browser, right now, and approximates the 52-week high/breakout itself.`}
      </div>

      <div id="scanBody"></div>
    `;

    function runForMode() {
      if (state.mode === "full") loadFullNse(container);
      else runScan(container);
    }
    container.querySelector("#scanBtn").addEventListener("click", runForMode);

    container.querySelector("#modeQuickBtn").addEventListener("click", () => {
      if (state.mode === "quick") return;
      state.mode = "quick";
      render(container);
    });
    container.querySelector("#modeFullBtn").addEventListener("click", () => {
      if (state.mode === "full") return;
      state.mode = "full";
      render(container);
      if (!state.fullRows && !state.fullLoading) loadFullNse(container);
    });

    renderToolbar(container);
    renderMode(container);

    // Auto-run the first Quick Scan on first visit so the page isn't empty by default.
    if (state.mode === "quick" && !state.rows && !state.scanning && !state.autoScanTried) {
      state.autoScanTried = true;
      runScan(container);
    }
  }

  TH.pages.scan52w = { render: render };
})();
