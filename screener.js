/* TradeHub — Equity Screener / Watchlist page.
   Sortable, filterable table styled after Stage-analysis / RS-rating style screeners. */
window.TH = window.TH || {};
TH.pages = TH.pages || {};

(function () {
  const U = TH.util;
  const starred = new Set(["RELIANCE", "SBIN", "BAJFINANCE"]); // demo starting watchlist

  const state = {
    search: "",
    sector: "All",
    stage: "All",
    minRS: 0,
    onlyWatch: false,
    sortKey: "rsRating",
    sortDir: "desc"
  };

  function stagePill(stage) {
    return `<span class="pill pill-stage${stage}">Stage ${stage}</span>`;
  }

  function rsBar(rs) {
    return `<span class="rs-bar"><span class="rs-bar-fill" style="width:${rs}%"></span></span>${rs}`;
  }

  function getFiltered() {
    let rows = TH.data.watchlist.filter((s) => {
      if (state.search && !(s.symbol.toLowerCase().includes(state.search) || s.name.toLowerCase().includes(state.search))) return false;
      if (state.sector !== "All" && s.sector !== state.sector) return false;
      if (state.stage !== "All" && String(s.stage) !== state.stage) return false;
      if (s.rsRating < state.minRS) return false;
      if (state.onlyWatch && !starred.has(s.symbol)) return false;
      return true;
    });
    rows.sort((a, b) => {
      const dir = state.sortDir === "asc" ? 1 : -1;
      const av = a[state.sortKey], bv = b[state.sortKey];
      if (typeof av === "string") return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
    return rows;
  }

  function renderTable(container) {
    const rows = getFiltered();
    const cols = [
      { key: "symbol", label: "Symbol", align: "left" },
      { key: "sector", label: "Sector", align: "left" },
      { key: "ltp", label: "LTP" },
      { key: "changePct", label: "Chg %" },
      { key: "volume", label: "Volume" },
      { key: "rsRating", label: "RS Rating" },
      { key: "stage", label: "Stage" },
      { key: "high52w", label: "52W High" },
      { key: "low52w", label: "52W Low" }
    ];

    const thead = `<tr>
      <th></th>
      ${cols.map((c) => `<th class="sortable ${c.align === "left" ? "left" : ""}" data-sort="${c.key}">${c.label}${state.sortKey === c.key ? (state.sortDir === "asc" ? " ▲" : " ▼") : ""}</th>`).join("")}
    </tr>`;

    const tbody = rows.map((s) => `
      <tr>
        <td><button class="star-btn ${starred.has(s.symbol) ? "active" : ""}" data-star="${s.symbol}">★</button></td>
        <td class="left"><strong>${s.symbol}</strong><div style="color:var(--muted);font-size:11px;">${s.name}</div></td>
        <td class="left">${s.sector}</td>
        <td>${U.fmtNum(s.ltp)}</td>
        <td class="${U.changeClass(s.changePct)}">${U.fmtPct(s.changePct)}</td>
        <td>${U.fmtInt(s.volume)}</td>
        <td>${rsBar(s.rsRating)}</td>
        <td>${stagePill(s.stage)}</td>
        <td>${U.fmtNum(s.high52w)}</td>
        <td>${U.fmtNum(s.low52w)}</td>
      </tr>
    `).join("");

    container.innerHTML = `<div class="table-wrap"><table><thead>${thead}</thead><tbody>${tbody || `<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:24px;">No matches</td></tr>`}</tbody></table></div>`;

    container.querySelectorAll("th[data-sort]").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.getAttribute("data-sort");
        if (state.sortKey === key) state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
        else { state.sortKey = key; state.sortDir = "desc"; }
        renderTable(container);
      });
    });

    container.querySelectorAll("[data-star]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sym = btn.getAttribute("data-star");
        if (starred.has(sym)) starred.delete(sym); else starred.add(sym);
        renderTable(container);
      });
    });
  }

  function render(container) {
    const sectors = TH.data.sectors;
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Equity Screener</h1>
          <div class="page-sub">Filter and rank stocks by RS rating, stage, sector &amp; more</div>
        </div>
      </div>

      <div class="toolbar">
        <input type="text" id="scrSearch" placeholder="Search symbol or name…" style="min-width:200px;" />
        <select id="scrSector">${sectors.map((s) => `<option value="${s}">${s}</option>`).join("")}</select>
        <select id="scrStage">
          <option value="All">All Stages</option>
          <option value="1">Stage 1 — Basing</option>
          <option value="2">Stage 2 — Advancing</option>
          <option value="3">Stage 3 — Topping</option>
          <option value="4">Stage 4 — Declining</option>
        </select>
        <select id="scrMinRS">
          <option value="0">Any RS Rating</option>
          <option value="70">RS ≥ 70</option>
          <option value="80">RS ≥ 80</option>
          <option value="90">RS ≥ 90</option>
        </select>
        <div class="chip" id="scrWatchToggle">★ Watchlist only</div>
      </div>

      <div class="note">Demo screener over a fixed 18-stock sample universe. Extend <code>TH.data.watchlist</code> or wire this table up to a live screener API/NSE bhavcopy feed for the full market.</div>

      <div id="scrTable"></div>
    `;

    const tableHost = container.querySelector("#scrTable");
    renderTable(tableHost);

    container.querySelector("#scrSearch").addEventListener("input", (e) => {
      state.search = e.target.value.trim().toLowerCase();
      renderTable(tableHost);
    });
    container.querySelector("#scrSector").addEventListener("change", (e) => {
      state.sector = e.target.value;
      renderTable(tableHost);
    });
    container.querySelector("#scrStage").addEventListener("change", (e) => {
      state.stage = e.target.value;
      renderTable(tableHost);
    });
    container.querySelector("#scrMinRS").addEventListener("change", (e) => {
      state.minRS = Number(e.target.value);
      renderTable(tableHost);
    });
    const watchChip = container.querySelector("#scrWatchToggle");
    watchChip.addEventListener("click", () => {
      state.onlyWatch = !state.onlyWatch;
      watchChip.classList.toggle("active", state.onlyWatch);
      renderTable(tableHost);
    });
  }

  TH.pages.screener = { render: render };
})();
