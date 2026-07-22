/* TradeHub — demo/fallback data.
   Everything here is illustrative sample data, not real-time market data.
   Replace/extend with a real data provider (broker API, NSE feed, etc.) as you build features. */
window.TH = window.TH || {};

TH.data = {

  indices: [
    { symbol: "^NSEI",     name: "NIFTY 50",    price: 24812.30, change: 148.65,  changePct: 0.60  },
    { symbol: "^BSESN",    name: "SENSEX",      price: 81523.44, change: 452.10,  changePct: 0.56  },
    { symbol: "^NSEBANK",  name: "BANK NIFTY",  price: 52340.15, change: -120.35, changePct: -0.23 },
    { symbol: "^INDIAVIX", name: "INDIA VIX",   price: 13.42,    change: -0.38,   changePct: -2.75 }
  ],

  watchlist: [
    { symbol: "RELIANCE",   name: "Reliance Industries", sector: "Energy",       ltp: 2947.60, changePct: 1.82,  volume: 8423000, rsRating: 87, stage: 2, high52w: 3021.90, low52w: 2221.00 },
    { symbol: "TCS",        name: "Tata Consultancy Svcs", sector: "IT",         ltp: 3812.15, changePct: -0.44, volume: 1932000, rsRating: 61, stage: 3, high52w: 4592.25, low52w: 3591.00 },
    { symbol: "HDFCBANK",   name: "HDFC Bank",          sector: "Banking",       ltp: 1712.80, changePct: 0.95,  volume: 9871000, rsRating: 78, stage: 2, high52w: 1795.90, low52w: 1363.45 },
    { symbol: "INFY",       name: "Infosys",            sector: "IT",            ltp: 1548.30, changePct: -1.12, volume: 4210000, rsRating: 55, stage: 3, high52w: 1953.90, low52w: 1358.35 },
    { symbol: "ICICIBANK",  name: "ICICI Bank",         sector: "Banking",       ltp: 1289.45, changePct: 1.34,  volume: 7612000, rsRating: 82, stage: 2, high52w: 1362.35, low52w: 1000.10 },
    { symbol: "ITC",        name: "ITC Ltd",            sector: "FMCG",          ltp: 431.20,  changePct: 0.18,  volume: 6120000, rsRating: 48, stage: 1, high52w: 528.00,  low52w: 401.50 },
    { symbol: "SBIN",       name: "State Bank of India",sector: "Banking",       ltp: 824.35,  changePct: 2.41,  volume: 11230000,rsRating: 91, stage: 2, high52w: 912.10,  low52w: 680.00 },
    { symbol: "BHARTIARTL", name: "Bharti Airtel",      sector: "Telecom",       ltp: 1615.90, changePct: 0.62,  volume: 3120000, rsRating: 76, stage: 2, high52w: 1779.00, low52w: 1211.30 },
    { symbol: "LT",         name: "Larsen & Toubro",    sector: "Infrastructure",ltp: 3541.75, changePct: -0.28, volume: 1540000, rsRating: 66, stage: 2, high52w: 3948.00, low52w: 3100.00 },
    { symbol: "KOTAKBANK",  name: "Kotak Mahindra Bank",sector: "Banking",       ltp: 1782.40, changePct: -0.85, volume: 2100000, rsRating: 44, stage: 3, high52w: 1953.00, low52w: 1544.15 },
    { symbol: "AXISBANK",   name: "Axis Bank",          sector: "Banking",       ltp: 1148.60, changePct: 1.05,  volume: 5310000, rsRating: 73, stage: 2, high52w: 1339.65, low52w: 933.50 },
    { symbol: "HINDUNILVR", name: "Hindustan Unilever", sector: "FMCG",          ltp: 2402.10, changePct: -0.51, volume: 980000,  rsRating: 39, stage: 4, high52w: 3035.00, low52w: 2172.05 },
    { symbol: "BAJFINANCE", name: "Bajaj Finance",      sector: "Financial Svcs",ltp: 7124.50, changePct: 2.86,  volume: 1650000, rsRating: 94, stage: 2, high52w: 7480.00, low52w: 6187.00 },
    { symbol: "MARUTI",     name: "Maruti Suzuki",      sector: "Auto",          ltp: 12480.25,changePct: 0.34,  volume: 410000,  rsRating: 58, stage: 2, high52w: 13680.00,low52w: 10620.00 },
    { symbol: "SUNPHARMA",  name: "Sun Pharma",         sector: "Pharma",        ltp: 1789.60, changePct: -0.19, volume: 1120000, rsRating: 52, stage: 3, high52w: 1962.00, low52w: 1377.05 },
    { symbol: "TITAN",      name: "Titan Company",      sector: "Consumer",      ltp: 3412.90, changePct: 1.67,  volume: 890000,  rsRating: 84, stage: 2, high52w: 3798.00, low52w: 3056.60 },
    { symbol: "ADANIENT",   name: "Adani Enterprises",  sector: "Metals/Infra",  ltp: 2891.35, changePct: -2.14, volume: 2340000, rsRating: 33, stage: 4, high52w: 3743.90, low52w: 2025.35 },
    { symbol: "ULTRACEMCO", name: "UltraTech Cement",   sector: "Cement",        ltp: 11340.75,changePct: 0.71,  volume: 210000,  rsRating: 69, stage: 2, high52w: 12148.00,low52w: 9251.00 }
  ],

  bonds: [
    { name: "7.18% GS 2033",              isin: "IN0020230012", type: "G-Sec",     coupon: 7.18, maturity: "2033-07-14", ytm: 7.02, rating: "Sovereign", price: 101.35 },
    { name: "7.10% GS 2029",              isin: "IN0020190045", type: "G-Sec",     coupon: 7.10, maturity: "2029-04-08", ytm: 6.95, rating: "Sovereign", price: 100.62 },
    { name: "8.35% Maharashtra SDL 2030", isin: "IN2320300067", type: "SDL",       coupon: 8.35, maturity: "2030-11-22", ytm: 7.41, rating: "Sovereign", price: 104.80 },
    { name: "HDFC Ltd NCD 7.95% 2027",    isin: "INE001A07XY3", type: "Corporate", coupon: 7.95, maturity: "2027-02-18", ytm: 7.62, rating: "AAA",       price: 101.90 },
    { name: "REC Ltd 7.35% 2031",         isin: "INE020B07HT4", type: "Corporate", coupon: 7.35, maturity: "2031-09-01", ytm: 7.28, rating: "AAA",       price: 100.44 },
    { name: "PFC 7.50% 2028",             isin: "INE134E07AS9", type: "Corporate", coupon: 7.50, maturity: "2028-06-27", ytm: 7.33, rating: "AAA",       price: 101.10 },
    { name: "Tata Capital NCD 8.10% 2026",isin: "INE306N07892", type: "Corporate", coupon: 8.10, maturity: "2026-12-05", ytm: 7.85, rating: "AAA",       price: 100.95 }
  ],

  portfolio: [
    { asset: "RELIANCE",        class: "Equity", qty: 50,  avgPrice: 2450.00, ltp: 2947.60 },
    { asset: "TCS",              class: "Equity", qty: 20,  avgPrice: 3800.00, ltp: 3812.15 },
    { asset: "SBIN",             class: "Equity", qty: 100, avgPrice: 705.20,  ltp: 824.35 },
    { asset: "7.18% GS 2033",    class: "Bond",   qty: 100, avgPrice: 99.10,   ltp: 101.35 },
    { asset: "HDFC NCD 7.95%",   class: "Bond",   qty: 50,  avgPrice: 100.50,  ltp: 101.90 },
    { asset: "NIFTY 24800 CE",   class: "Option", qty: 75,  avgPrice: 180.00,  ltp: 214.50 },
    { asset: "BANKNIFTY 52000 PE",class:"Option", qty: 30,  avgPrice: 260.00,  ltp: 198.20 }
  ],

  sectors: ["All", "Banking", "IT", "Energy", "FMCG", "Telecom", "Infrastructure", "Financial Svcs", "Auto", "Pharma", "Consumer", "Metals/Infra", "Cement"],

  optionUnderlyings: {
    "NIFTY":     { spot: 24812.30, step: 50,  lotSize: 75 },
    "BANKNIFTY": { spot: 52340.15, step: 100, lotSize: 30 },
    "RELIANCE":  { spot: 2947.60,  step: 20,  lotSize: 500 },
    "TCS":       { spot: 3812.15,  step: 20,  lotSize: 175 }
  }
};

/* Shared formatting/helper utilities used across all pages. */
TH.util = {
  fmtNum(n, decimals) {
    if (n == null || isNaN(n)) return "—";
    decimals = decimals == null ? 2 : decimals;
    return Number(n).toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  },
  fmtInt(n) {
    if (n == null || isNaN(n)) return "—";
    return Number(n).toLocaleString("en-IN");
  },
  fmtPct(n, decimals) {
    if (n == null || isNaN(n)) return "—";
    decimals = decimals == null ? 2 : decimals;
    const sign = n > 0 ? "+" : "";
    return sign + Number(n).toFixed(decimals) + "%";
  },
  fmtSigned(n, decimals) {
    if (n == null || isNaN(n)) return "—";
    decimals = decimals == null ? 2 : decimals;
    const sign = n > 0 ? "+" : "";
    return sign + Number(n).toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  },
  changeClass(n) {
    if (n == null || isNaN(n)) return "flat";
    return n > 0 ? "up" : n < 0 ? "down" : "flat";
  },
  el(tag, attrs, children) {
    const e = document.createElement(tag);
    attrs = attrs || {};
    for (const k in attrs) {
      if (k === "class") e.className = attrs[k];
      else if (k === "html") e.innerHTML = attrs[k];
      else if (k.startsWith("on") && typeof attrs[k] === "function") e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
    (children || []).forEach((c) => {
      if (c == null) return;
      e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return e;
  },
  escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  }
};
