/* TradeHub — Bonds Tracker + Portfolio page. */
window.TH = window.TH || {};
TH.pages = TH.pages || {};

(function () {
  const U = TH.util;

  function yearsToMaturity(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    return Math.max((d - now) / (365.25 * 24 * 3600 * 1000), 0.1);
  }

  // Approximate YTM: YTM ≈ [C + (F − P) / n] / [(F + P) / 2]
  function approxYTM(faceValue, couponPct, price, years) {
    const C = (couponPct / 100) * faceValue;
    return ((C + (faceValue - price) / years) / ((faceValue + price) / 2)) * 100;
  }

  function renderBondTable(host) {
    const rows = TH.data.bonds.map((b) => ({ ...b, yrs: yearsToMaturity(b.maturity) }));
    host.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th class="left">Bond</th><th class="left">Type</th><th>Coupon %</th>
              <th class="left">Maturity</th><th>YTM %</th><th class="left">Rating</th><th>Price</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((b) => `
              <tr>
                <td class="left"><strong>${b.name}</strong><div style="color:var(--muted);font-size:11px;">${b.isin}</div></td>
                <td class="left">${b.type}</td>
                <td>${b.coupon.toFixed(2)}</td>
                <td class="left">${b.maturity} <span style="color:var(--muted);">(${b.yrs.toFixed(1)}y)</span></td>
                <td>${b.ytm.toFixed(2)}</td>
                <td class="left">${b.rating}</td>
                <td>${U.fmtNum(b.price)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderCalculator(host) {
    host.innerHTML = `
      <div class="form-row"><label>Face Value (₹)</label><input type="number" id="calcFace" value="100" /></div>
      <div class="form-row"><label>Coupon Rate (% p.a.)</label><input type="number" id="calcCoupon" value="7.5" step="0.01" /></div>
      <div class="form-row"><label>Years to Maturity</label><input type="number" id="calcYears" value="5" step="0.1" /></div>
      <div class="form-row"><label>Current Market Price (₹)</label><input type="number" id="calcPrice" value="98.5" step="0.01" /></div>
      <div class="btn-row"><button class="btn" id="calcBtn">Calculate YTM</button></div>
      <div id="calcResult" class="card stat-card" style="margin-top:14px;"></div>
    `;
    const resultEl = host.querySelector("#calcResult");
    function calc() {
      const face = Number(host.querySelector("#calcFace").value) || 0;
      const coupon = Number(host.querySelector("#calcCoupon").value) || 0;
      const years = Number(host.querySelector("#calcYears").value) || 0.1;
      const price = Number(host.querySelector("#calcPrice").value) || 0;
      const ytm = approxYTM(face, coupon, price, years);
      const annualCoupon = (coupon / 100) * face;
      resultEl.innerHTML = `
        <div class="stat-label">Approximate Yield to Maturity</div>
        <div class="stat-value ${U.changeClass(ytm - coupon)}">${ytm.toFixed(2)}%</div>
        <div class="stat-change flat">Annual coupon: ₹${annualCoupon.toFixed(2)} • ${price < face ? "Trading at a discount" : price > face ? "Trading at a premium" : "Trading at par"}</div>
      `;
    }
    host.querySelector("#calcBtn").addEventListener("click", calc);
    calc();
  }

  function renderPortfolio(container) {
    const rows = TH.data.portfolio.map((h) => {
      const value = h.qty * h.ltp;
      const cost = h.qty * h.avgPrice;
      const pnl = value - cost;
      const pnlPct = cost ? (pnl / cost) * 100 : 0;
      return { ...h, value, cost, pnl, pnlPct };
    });
    const totalValue = rows.reduce((s, r) => s + r.value, 0);
    const totalCost = rows.reduce((s, r) => s + r.cost, 0);
    const totalPnl = totalValue - totalCost;
    const totalPnlPct = totalCost ? (totalPnl / totalCost) * 100 : 0;

    const byClass = {};
    rows.forEach((r) => { byClass[r.class] = (byClass[r.class] || 0) + r.value; });
    const classColors = { Equity: "#6366f1", Bond: "#16c784", Option: "#f0b90b" };

    container.innerHTML = `
      <div class="grid grid-4" style="margin-bottom:14px;">
        <div class="card stat-card">
          <div class="stat-label">Total Portfolio Value</div>
          <div class="stat-value">₹${U.fmtNum(totalValue, 0)}</div>
        </div>
        <div class="card stat-card">
          <div class="stat-label">Total Invested</div>
          <div class="stat-value">₹${U.fmtNum(totalCost, 0)}</div>
        </div>
        <div class="card stat-card">
          <div class="stat-label">Total P&amp;L</div>
          <div class="stat-value ${U.changeClass(totalPnl)}">₹${U.fmtSigned(totalPnl, 0)}</div>
        </div>
        <div class="card stat-card">
          <div class="stat-label">Total P&amp;L %</div>
          <div class="stat-value ${U.changeClass(totalPnlPct)}">${U.fmtPct(totalPnlPct)}</div>
        </div>
      </div>

      <div class="two-col">
        <div class="card">
          <div class="card-title">Holdings</div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th class="left">Asset</th><th class="left">Class</th><th>Qty</th><th>Avg Price</th><th>LTP</th><th>Value</th><th>P&amp;L</th><th>P&amp;L %</th></tr>
              </thead>
              <tbody>
                ${rows.map((r) => `
                  <tr>
                    <td class="left"><strong>${r.asset}</strong></td>
                    <td class="left">${r.class}</td>
                    <td>${U.fmtInt(r.qty)}</td>
                    <td>${U.fmtNum(r.avgPrice)}</td>
                    <td>${U.fmtNum(r.ltp)}</td>
                    <td>${U.fmtNum(r.value, 0)}</td>
                    <td class="${U.changeClass(r.pnl)}">${U.fmtSigned(r.pnl, 0)}</td>
                    <td class="${U.changeClass(r.pnlPct)}">${U.fmtPct(r.pnlPct)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
        <div class="card">
          <div class="card-title">Allocation by Asset Class</div>
          <div style="display:flex;justify-content:center;" id="allocDonut"></div>
          <div class="legend" style="justify-content:center;">
            ${Object.keys(byClass).map((c) => `<div class="legend-item"><span class="legend-dot" style="background:${classColors[c] || "#8b93a7"}"></span>${c} — ${((byClass[c] / totalValue) * 100).toFixed(1)}%</div>`).join("")}
          </div>
        </div>
      </div>
    `;

    TH.charts.donut(container.querySelector("#allocDonut"), Object.keys(byClass).map((c) => ({
      value: byClass[c], color: classColors[c] || "#8b93a7"
    })), { size: 170, stroke: 24 });
  }

  function render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Bonds &amp; Portfolio</h1>
          <div class="page-sub">Bond tracker with YTM calculator, plus cross-asset holdings</div>
        </div>
      </div>

      <div class="two-col" style="margin-bottom:20px;">
        <div class="card">
          <div class="card-title">Bond Tracker</div>
          <div id="bondTable"></div>
        </div>
        <div class="card">
          <div class="card-title">YTM Calculator</div>
          <div id="bondCalc"></div>
        </div>
      </div>

      <h2 style="font-size:16px;margin:0 0 12px;">Portfolio</h2>
      <div id="portfolioHost"></div>
    `;
    renderBondTable(container.querySelector("#bondTable"));
    renderCalculator(container.querySelector("#bondCalc"));
    renderPortfolio(container.querySelector("#portfolioHost"));
  }

  TH.pages.bonds = { render: render };
})();
