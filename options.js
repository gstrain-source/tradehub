/* TradeHub — Option Chain & Analytics page.
   Chain values are synthetically generated around each underlying's spot price (deterministic
   per strike, so the table doesn't jitter on re-render). This is illustrative only — swap in a
   real options data feed (broker API / NSE option-chain API via your own backend) for live data,
   since NSE's public option-chain endpoint blocks direct browser calls (no CORS, needs cookies). */
window.TH = window.TH || {};
TH.pages = TH.pages || {};

(function () {
  const U = TH.util;
  const state = { underlying: "NIFTY", strikesEachSide: 8, leg: "BUY_CE", legStrike: null, legPremium: null, lots: 1 };

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

  function buildChain(underlyingKey) {
    const u = TH.data.optionUnderlyings[underlyingKey];
    const spot = u.spot;
    const atmStrike = Math.round(spot / u.step) * u.step;
    const strikes = [];
    for (let i = -state.strikesEachSide; i <= state.strikesEachSide; i++) strikes.push(atmStrike + i * u.step);

    return strikes.map((strike) => {
      const distanceRatio = Math.abs(strike - spot) / spot;
      const bell = Math.exp(-Math.pow(distanceRatio * 12, 2));
      const intrinsicCE = Math.max(spot - strike, 0);
      const intrinsicPE = Math.max(strike - spot, 0);

      const rCE1 = seededRand(hashSeed(underlyingKey + strike + "CE1"));
      const rCE2 = seededRand(hashSeed(underlyingKey + strike + "CE2"));
      const rCE3 = seededRand(hashSeed(underlyingKey + strike + "CE3"));
      const rPE1 = seededRand(hashSeed(underlyingKey + strike + "PE1"));
      const rPE2 = seededRand(hashSeed(underlyingKey + strike + "PE2"));
      const rPE3 = seededRand(hashSeed(underlyingKey + strike + "PE3"));

      const ivCE = 13 + (1 - bell) * 9 + rCE3 * 3;
      const ivPE = 13 + (1 - bell) * 9 + rPE3 * 3;
      const timeValueCE = spot * 0.018 * bell * (0.6 + rCE3 * 0.8) + spot * 0.002;
      const timeValuePE = spot * 0.018 * bell * (0.6 + rPE3 * 0.8) + spot * 0.002;

      const oiBaseCE = Math.round((300 + bell * 4000) * (0.6 + rCE1));
      const oiBasePE = Math.round((300 + bell * 4000) * (0.6 + rPE1));

      return {
        strike,
        isATM: strike === atmStrike,
        ce: {
          oi: oiBaseCE,
          chgOi: Math.round(oiBaseCE * (rCE2 - 0.5) * 0.5),
          volume: Math.round(oiBaseCE * (0.15 + rCE1 * 0.4)),
          iv: ivCE,
          ltp: intrinsicCE + timeValueCE
        },
        pe: {
          oi: oiBasePE,
          chgOi: Math.round(oiBasePE * (rPE2 - 0.5) * 0.5),
          volume: Math.round(oiBasePE * (0.15 + rPE1 * 0.4)),
          iv: ivPE,
          ltp: intrinsicPE + timeValuePE
        }
      };
    });
  }

  function payoffPoints(spot, strike, premium, leg, lots, lotSize) {
    const range = spot * 0.12;
    const points = [];
    const steps = 60;
    for (let i = 0; i <= steps; i++) {
      const underlyingPrice = spot - range + (i / steps) * (range * 2);
      let intrinsic;
      if (leg === "BUY_CE" || leg === "SELL_CE") intrinsic = Math.max(underlyingPrice - strike, 0);
      else intrinsic = Math.max(strike - underlyingPrice, 0);
      let pnlPerUnit = intrinsic - premium;
      if (leg === "SELL_CE" || leg === "SELL_PE") pnlPerUnit = -pnlPerUnit;
      points.push({ x: Math.round(underlyingPrice), y: pnlPerUnit * lots * lotSize });
    }
    return points;
  }

  function render(container) {
    const underlyings = Object.keys(TH.data.optionUnderlyings);
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Option Chain &amp; Analytics</h1>
          <div class="page-sub">Chain view, PCR &amp; a single-leg payoff diagram</div>
        </div>
      </div>

      <div class="toolbar">
        <select id="optUnderlying">${underlyings.map((k) => `<option value="${k}">${k}</option>`).join("")}</select>
        <span id="optSpot" class="badge" style="background:#6366f122;color:var(--accent-2);border:1px solid #6366f144;"></span>
        <span id="optPCR" class="badge" style="background:#f0b90b22;color:var(--amber);border:1px solid #f0b90b44;"></span>
      </div>

      <div class="note">Illustrative chain — strikes are generated deterministically around each underlying's demo spot price. NSE's real option-chain API can't be called directly from a browser (no CORS, needs session cookies), so wire this up through your own backend or a licensed data vendor when you're ready.</div>

      <div class="card" style="margin-bottom:14px;">
        <div class="card-title">Option Chain</div>
        <div class="table-wrap" id="optChainTable"></div>
      </div>

      <div class="two-col">
        <div class="card">
          <div class="card-title">Payoff Diagram</div>
          <div class="toolbar" style="margin-bottom:10px;">
            <select id="payLeg">
              <option value="BUY_CE">Buy Call</option>
              <option value="SELL_CE">Sell Call</option>
              <option value="BUY_PE">Buy Put</option>
              <option value="SELL_PE">Sell Put</option>
            </select>
            <select id="payStrike"></select>
            <input type="number" id="payLots" value="1" min="1" style="width:70px;" title="Lots" />
          </div>
          <div id="payoffChart"></div>
          <div id="payoffSummary" style="margin-top:10px;font-size:12.5px;color:var(--muted);"></div>
        </div>
        <div class="card">
          <div class="card-title">Chain Summary</div>
          <div id="chainSummary"></div>
        </div>
      </div>
    `;

    const chainTableHost = container.querySelector("#optChainTable");
    const spotBadge = container.querySelector("#optSpot");
    const pcrBadge = container.querySelector("#optPCR");
    const strikeSelect = container.querySelector("#payStrike");
    const legSelect = container.querySelector("#payLeg");
    const lotsInput = container.querySelector("#payLots");
    const payoffHost = container.querySelector("#payoffChart");
    const payoffSummary = container.querySelector("#payoffSummary");
    const chainSummaryHost = container.querySelector("#chainSummary");

    function draw() {
      const key = state.underlying;
      const u = TH.data.optionUnderlyings[key];
      const chain = buildChain(key);
      const totalCallOI = chain.reduce((s, r) => s + r.ce.oi, 0);
      const totalPutOI = chain.reduce((s, r) => s + r.pe.oi, 0);
      const pcr = totalCallOI ? (totalPutOI / totalCallOI) : 0;

      spotBadge.textContent = "SPOT " + U.fmtNum(u.spot);
      pcrBadge.textContent = "PCR " + pcr.toFixed(2);

      chainTableHost.innerHTML = `
        <table>
          <thead>
            <tr>
              <th colspan="5" style="text-align:center;color:var(--green);">CALLS</th>
              <th style="background:var(--panel-2);">STRIKE</th>
              <th colspan="5" style="text-align:center;color:var(--red);">PUTS</th>
            </tr>
            <tr>
              <th>OI</th><th>Chg OI</th><th>Volume</th><th>IV</th><th>LTP</th>
              <th></th>
              <th>LTP</th><th>IV</th><th>Volume</th><th>Chg OI</th><th>OI</th>
            </tr>
          </thead>
          <tbody>
            ${chain.map((r) => `
              <tr style="${r.isATM ? "background:#6366f114;" : ""}">
                <td>${U.fmtInt(r.ce.oi)}</td>
                <td class="${U.changeClass(r.ce.chgOi)}">${U.fmtSigned(r.ce.chgOi, 0)}</td>
                <td>${U.fmtInt(r.ce.volume)}</td>
                <td>${r.ce.iv.toFixed(1)}</td>
                <td><strong>${U.fmtNum(r.ce.ltp)}</strong></td>
                <td style="text-align:center;font-weight:700;${r.isATM ? "color:var(--accent-2);" : ""}">${U.fmtInt(r.strike)}</td>
                <td><strong>${U.fmtNum(r.pe.ltp)}</strong></td>
                <td>${r.pe.iv.toFixed(1)}</td>
                <td>${U.fmtInt(r.pe.volume)}</td>
                <td class="${U.changeClass(r.pe.chgOi)}">${U.fmtSigned(r.pe.chgOi, 0)}</td>
                <td>${U.fmtInt(r.pe.oi)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;

      chainSummaryHost.innerHTML = `
        <div class="card stat-card" style="margin-bottom:14px;">
          <div class="stat-label">Total Call OI</div>
          <div class="stat-value">${U.fmtInt(totalCallOI)}</div>
        </div>
        <div class="card stat-card" style="margin-bottom:14px;">
          <div class="stat-label">Total Put OI</div>
          <div class="stat-value">${U.fmtInt(totalPutOI)}</div>
        </div>
        <div class="card stat-card">
          <div class="stat-label">Put/Call Ratio</div>
          <div class="stat-value">${pcr.toFixed(2)}</div>
          <div class="stat-change ${pcr >= 1 ? "up" : "down"}">${pcr >= 1 ? "Put-heavy (cautious/bullish contrarian)" : "Call-heavy (bullish/greedy)"}</div>
        </div>
      `;

      // populate strike selector for payoff diagram
      const prevStrike = strikeSelect.value;
      strikeSelect.innerHTML = chain.map((r) => `<option value="${r.strike}">${U.fmtInt(r.strike)}${r.isATM ? " (ATM)" : ""}</option>`).join("");
      if (prevStrike && chain.some((r) => String(r.strike) === prevStrike)) strikeSelect.value = prevStrike;
      else {
        const atm = chain.find((r) => r.isATM);
        if (atm) strikeSelect.value = String(atm.strike);
      }

      drawPayoff(chain, u);
    }

    function drawPayoff(chain, u) {
      const strike = Number(strikeSelect.value);
      const row = chain.find((r) => r.strike === strike) || chain[0];
      const leg = legSelect.value;
      const premium = leg.endsWith("CE") ? row.ce.ltp : row.pe.ltp;
      const lots = Math.max(1, Number(lotsInput.value) || 1);
      const points = payoffPoints(u.spot, strike, premium, leg, lots, u.lotSize);
      TH.charts.lineChart(payoffHost, points, { height: 220, xFormat: (v) => U.fmtInt(v) });

      const maxProfit = Math.max(...points.map((p) => p.y));
      const maxLoss = Math.min(...points.map((p) => p.y));
      const breakeven = leg.endsWith("CE")
        ? strike + premium
        : strike - premium;
      payoffSummary.innerHTML = `Premium: <strong>${U.fmtNum(premium)}</strong> &nbsp;•&nbsp; Breakeven: <strong>${U.fmtNum(breakeven)}</strong> &nbsp;•&nbsp; Lot size: <strong>${u.lotSize}</strong> × ${lots} lot(s)<br/>
      Max profit shown: <span class="up">${U.fmtSigned(maxProfit, 0)}</span> &nbsp;•&nbsp; Max loss shown: <span class="down">${U.fmtSigned(maxLoss, 0)}</span> (within ±12% of spot)`;
    }

    container.querySelector("#optUnderlying").addEventListener("change", (e) => {
      state.underlying = e.target.value;
      draw();
    });
    strikeSelect.addEventListener("change", () => drawPayoff(buildChain(state.underlying), TH.data.optionUnderlyings[state.underlying]));
    legSelect.addEventListener("change", () => drawPayoff(buildChain(state.underlying), TH.data.optionUnderlyings[state.underlying]));
    lotsInput.addEventListener("input", () => drawPayoff(buildChain(state.underlying), TH.data.optionUnderlyings[state.underlying]));

    draw();
  }

  TH.pages.options = { render: render };
})();
