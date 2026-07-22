/* TradeHub — Dashboard page: index snapshot, market breadth, gainers/losers, watchlist. */
window.TH = window.TH || {};
TH.pages = TH.pages || {};

(function () {
  const U = TH.util;

  function render(container) {
    const data = TH.data;
    const gainers = [...data.watchlist].sort((a, b) => b.changePct - a.changePct).slice(0, 5);
    const losers = [...data.watchlist].sort((a, b) => a.changePct - b.changePct).slice(0, 5);
    const advances = data.watchlist.filter((s) => s.changePct > 0).length;
    const declines = data.watchlist.filter((s) => s.changePct < 0).length;
    const unchanged = data.watchlist.length - advances - declines;

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Market Dashboard</h1>
          <div class="page-sub">Overview across equity, bond &amp; derivatives markets</div>
        </div>
      </div>

      <div class="grid grid-4" id="indexCards"></div>

      <div class="two-col" style="margin-top:14px;">
        <div class="card">
          <div class="card-title">Market Breadth (watchlist universe)</div>
          <div id="breadthBar"></div>
          <div class="legend">
            <div class="legend-item"><span class="legend-dot" style="background:var(--green)"></span>${advances} Advances</div>
            <div class="legend-item"><span class="legend-dot" style="background:var(--red)"></span>${declines} Declines</div>
            <div class="legend-item"><span class="legend-dot" style="background:var(--muted)"></span>${unchanged} Unchanged</div>
          </div>
          <div class="note" style="margin-top:14px;">Demo breadth computed from the 18-stock sample watchlist. Wire this up to full NSE/BSE advance-decline data for a real breadth indicator.</div>
        </div>

        <div class="card">
          <div class="card-title">Watchlist Snapshot</div>
          <div class="table-wrap">
            <table>
              <thead><tr><th class="left">Symbol</th><th>LTP</th><th>Chg %</th></tr></thead>
              <tbody>
                ${data.watchlist.slice(0, 6).map((s) => `
                  <tr>
                    <td class="left">${s.symbol}</td>
                    <td>${U.fmtNum(s.ltp)}</td>
                    <td class="${U.changeClass(s.changePct)}">${U.fmtPct(s.changePct)}</td>
                  </tr>`).join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="two-col" style="margin-top:14px;">
        <div class="card">
          <div class="card-title">Top Gainers</div>
          <div class="table-wrap">
            <table>
              <thead><tr><th class="left">Symbol</th><th>LTP</th><th>Chg %</th></tr></thead>
              <tbody>
                ${gainers.map((s) => `
                  <tr>
                    <td class="left">${s.symbol}</td>
                    <td>${U.fmtNum(s.ltp)}</td>
                    <td class="up">${U.fmtPct(s.changePct)}</td>
                  </tr>`).join("")}
              </tbody>
            </table>
          </div>
        </div>
        <div class="card">
          <div class="card-title">Top Losers</div>
          <div class="table-wrap">
            <table>
              <thead><tr><th class="left">Symbol</th><th>LTP</th><th>Chg %</th></tr></thead>
              <tbody>
                ${losers.map((s) => `
                  <tr>
                    <td class="left">${s.symbol}</td>
                    <td>${U.fmtNum(s.ltp)}</td>
                    <td class="down">${U.fmtPct(s.changePct)}</td>
                  </tr>`).join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // Breadth bar chart
    TH.charts.stackedBar(container.querySelector("#breadthBar"), [
      { value: advances, color: "#16c784" },
      { value: unchanged, color: "#3a4054" },
      { value: declines, color: "#ea3943" }
    ], { height: 16 });

    // Index cards — build once, then keep live via polling
    const cardHost = container.querySelector("#indexCards");
    const symbols = data.indices.map((ix) => ix.symbol);
    const fallbackMap = {};
    data.indices.forEach((ix) => { fallbackMap[ix.symbol] = { price: ix.price, change: ix.change, changePct: ix.changePct }; });

    data.indices.forEach((ix) => {
      const card = U.el("div", { class: "card stat-card", id: "idx-" + ix.symbol.replace(/[^a-zA-Z0-9]/g, "") }, [
        U.el("div", { class: "stat-label" }, [ix.name]),
        U.el("div", { class: "stat-value", "data-field": "price" }, [U.fmtNum(ix.price)]),
        U.el("div", { class: "stat-change " + U.changeClass(ix.changePct), "data-field": "change" }, [
          U.fmtSigned(ix.change) + "  (" + U.fmtPct(ix.changePct) + ")"
        ])
      ]);
      cardHost.appendChild(card);
    });

    const stop = TH.marketData.pollQuotes(symbols, fallbackMap, (merged, anyLive) => {
      TH.app.setLive(anyLive);
      data.indices.forEach((ix) => {
        const q = merged[ix.symbol];
        if (!q) return;
        const card = document.getElementById("idx-" + ix.symbol.replace(/[^a-zA-Z0-9]/g, ""));
        if (!card) return;
        card.querySelector('[data-field="price"]').textContent = U.fmtNum(q.price);
        const chEl = card.querySelector('[data-field="change"]');
        chEl.textContent = U.fmtSigned(q.change) + "  (" + U.fmtPct(q.changePct) + ")";
        chEl.className = "stat-change " + U.changeClass(q.changePct);
      });
    }, 30000);

    return stop;
  }

  TH.pages.dashboard = { render: render };
})();
