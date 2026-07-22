/* TradeHub — tiny dependency-free SVG chart helpers.
   Kept intentionally simple so the base project has zero external chart-library dependency.
   Swap in Chart.js/Recharts/D3 later if you need richer visuals. */
window.TH = window.TH || {};

(function () {

  function svg(tag, attrs) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  /** Horizontal stacked bar, e.g. advances vs declines. segments: [{value,color,label}] */
  function stackedBar(container, segments, opts) {
    opts = opts || {};
    const width = opts.width || container.clientWidth || 300;
    const height = opts.height || 14;
    const total = segments.reduce((s, x) => s + x.value, 0) || 1;
    const root = svg("svg", { width: "100%", height: height, viewBox: "0 0 " + width + " " + height });
    let x = 0;
    segments.forEach((seg) => {
      const w = (seg.value / total) * width;
      root.appendChild(svg("rect", { x: x, y: 0, width: Math.max(w, 0), height: height, fill: seg.color, rx: 2 }));
      x += w;
    });
    container.innerHTML = "";
    container.appendChild(root);
  }

  /** Donut/pie chart. segments: [{value,color,label}] */
  function donut(container, segments, opts) {
    opts = opts || {};
    const size = opts.size || 160;
    const stroke = opts.stroke || 22;
    const r = (size - stroke) / 2;
    const c = size / 2;
    const circumference = 2 * Math.PI * r;
    const total = segments.reduce((s, x) => s + x.value, 0) || 1;
    const root = svg("svg", { width: size, height: size, viewBox: "0 0 " + size + " " + size });
    root.appendChild(svg("circle", { cx: c, cy: c, r: r, fill: "none", stroke: "#1c2130", "stroke-width": stroke }));
    let offset = 0;
    segments.forEach((seg) => {
      const frac = seg.value / total;
      const len = frac * circumference;
      const circle = svg("circle", {
        cx: c, cy: c, r: r, fill: "none", stroke: seg.color, "stroke-width": stroke,
        "stroke-dasharray": len + " " + (circumference - len),
        "stroke-dashoffset": -offset,
        transform: "rotate(-90 " + c + " " + c + ")"
      });
      root.appendChild(circle);
      offset += len;
    });
    container.innerHTML = "";
    container.appendChild(root);
  }

  /** Simple line/area chart. points: [{x,y}] (y can be negative). */
  function lineChart(container, points, opts) {
    opts = opts || {};
    const width = opts.width || container.clientWidth || 500;
    const height = opts.height || 220;
    const pad = 30;
    if (!points.length) { container.innerHTML = ""; return; }

    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const xMin = Math.min.apply(null, xs), xMax = Math.max.apply(null, xs);
    const yMin = Math.min(0, Math.min.apply(null, ys));
    const yMax = Math.max(0, Math.max.apply(null, ys));

    const sx = (x) => pad + ((x - xMin) / (xMax - xMin || 1)) * (width - pad * 2);
    const sy = (y) => height - pad - ((y - yMin) / (yMax - yMin || 1)) * (height - pad * 2);

    const root = svg("svg", { width: "100%", height: height, viewBox: "0 0 " + width + " " + height });

    // zero line
    const zeroY = sy(0);
    root.appendChild(svg("line", { x1: pad, y1: zeroY, x2: width - pad, y2: zeroY, stroke: "#3a4054", "stroke-width": 1, "stroke-dasharray": "4,4" }));

    // build path, split into profit (green) / loss (red) segments via area fills
    let d = "M " + sx(points[0].x) + " " + sy(points[0].y);
    for (let i = 1; i < points.length; i++) d += " L " + sx(points[i].x) + " " + sy(points[i].y);
    root.appendChild(svg("path", { d: d, fill: "none", stroke: opts.stroke || "#818cf8", "stroke-width": 2 }));

    // fill under curve, colored by sign at each point (approx via two clipped areas)
    let posD = "M " + sx(points[0].x) + " " + zeroY;
    points.forEach((p) => { posD += " L " + sx(p.x) + " " + sy(Math.max(p.y, 0)); });
    posD += " L " + sx(points[points.length - 1].x) + " " + zeroY + " Z";
    root.appendChild(svg("path", { d: posD, fill: "#16c78422", stroke: "none" }));

    let negD = "M " + sx(points[0].x) + " " + zeroY;
    points.forEach((p) => { negD += " L " + sx(p.x) + " " + sy(Math.min(p.y, 0)); });
    negD += " L " + sx(points[points.length - 1].x) + " " + zeroY + " Z";
    root.appendChild(svg("path", { d: negD, fill: "#ea394322", stroke: "none" }));

    // axis labels (min/max x)
    const label1 = svg("text", { x: pad, y: height - 8, fill: "#8b93a7", "font-size": 10 });
    label1.textContent = opts.xFormat ? opts.xFormat(xMin) : xMin;
    root.appendChild(label1);
    const label2 = svg("text", { x: width - pad, y: height - 8, fill: "#8b93a7", "font-size": 10, "text-anchor": "end" });
    label2.textContent = opts.xFormat ? opts.xFormat(xMax) : xMax;
    root.appendChild(label2);

    container.innerHTML = "";
    container.appendChild(root);
  }

  TH.charts = { stackedBar: stackedBar, donut: donut, lineChart: lineChart };
})();
