// Canvas drawing for the app. These functions take data and draw it. They hold no state.
// Colors come from the CSS tokens in css/style.css so both themes work.

const tok = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export function setupCanvas(canvas, height) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 600;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.height = height + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, height);
  return { ctx, w, h: height };
}

function niceTicks(lo, hi, count) {
  const span = hi - lo;
  if (!(span > 0)) return [lo];
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / mag;
  const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag;
  const out = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step) out.push(Number(v.toFixed(10)));
  return out;
}

const fmtTick = (v) => String(Number(v.toPrecision(4)));

function hexToRgb(hex) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [136, 136, 136];
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lerpColor(a, b, t) {
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));
}

function message(ctx, w, h, text) {
  ctx.fillStyle = tok('--muted');
  ctx.font = '13px ' + tok('--font-body');
  ctx.textAlign = 'center';
  ctx.fillText(text, w / 2, h / 2);
}

// Axes and grid. box = { l, t, pw, ph }. xr and yr are [min, max]. yr may be null.
function frame(ctx, box, xr, yr, xTitle, yTitle) {
  ctx.font = '11px ' + tok('--font-mono');
  ctx.lineWidth = 1;
  ctx.strokeStyle = tok('--grid');
  ctx.fillStyle = tok('--muted');
  ctx.textAlign = 'center';
  for (const v of niceTicks(xr[0], xr[1], 6)) {
    const px = Math.round(box.l + ((v - xr[0]) / (xr[1] - xr[0])) * box.pw) + 0.5;
    ctx.beginPath();
    ctx.moveTo(px, box.t);
    ctx.lineTo(px, box.t + box.ph);
    ctx.stroke();
    ctx.fillText(fmtTick(v), px, box.t + box.ph + 14);
  }
  if (xTitle) ctx.fillText(xTitle, box.l + box.pw / 2, box.t + box.ph + 30);
  if (yr) {
    ctx.textAlign = 'right';
    for (const v of niceTicks(yr[0], yr[1], 4)) {
      const py = Math.round(box.t + (1 - (v - yr[0]) / (yr[1] - yr[0])) * box.ph) + 0.5;
      ctx.beginPath();
      ctx.moveTo(box.l, py);
      ctx.lineTo(box.l + box.pw, py);
      ctx.stroke();
      ctx.fillText(fmtTick(v), box.l - 6, py + 4);
    }
    if (yTitle) {
      ctx.textAlign = 'left';
      ctx.fillText(yTitle, 4, 12);
    }
  }
}

/**
 * Model belief for a one-input problem.
 * o: { xr, yr, xs, mean|null, std|null, truth, showTruth, pts:[{x,y}], pickX|null, xTitle, yTitle }
 */
export function drawCurve1D(canvas, o) {
  const { ctx, w, h } = setupCanvas(canvas, 280);
  const pad = { l: 46, r: 10, t: 16, b: 40 };
  const box = { l: pad.l, t: pad.t, pw: w - pad.l - pad.r, ph: h - pad.t - pad.b };
  const sx = (x) => box.l + ((x - o.xr[0]) / (o.xr[1] - o.xr[0])) * box.pw;
  const sy = (y) => box.t + (1 - (Math.max(o.yr[0], Math.min(o.yr[1], y)) - o.yr[0]) / (o.yr[1] - o.yr[0])) * box.ph;
  frame(ctx, box, o.xr, o.yr, o.xTitle, o.yTitle);

  if (o.mean && o.std) {
    ctx.fillStyle = tok('--band');
    ctx.beginPath();
    o.xs.forEach((x, i) => {
      const px = sx(x);
      const py = sy(o.mean[i] - 2 * o.std[i]);
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    });
    for (let i = o.xs.length - 1; i >= 0; i--) ctx.lineTo(sx(o.xs[i]), sy(o.mean[i] + 2 * o.std[i]));
    ctx.closePath();
    ctx.fill();
  }
  if (o.showTruth) {
    ctx.strokeStyle = tok('--truth');
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    o.xs.forEach((x, i) => {
      if (i) ctx.lineTo(sx(x), sy(o.truth[i]));
      else ctx.moveTo(sx(x), sy(o.truth[i]));
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (o.mean) {
    ctx.strokeStyle = tok('--accent');
    ctx.lineWidth = 2;
    ctx.beginPath();
    o.xs.forEach((x, i) => {
      if (i) ctx.lineTo(sx(x), sy(o.mean[i]));
      else ctx.moveTo(sx(x), sy(o.mean[i]));
    });
    ctx.stroke();
  } else if (!o.pts.length) {
    message(ctx, w, h, 'No evaluations yet.');
  }
  if (o.pickX != null) {
    ctx.strokeStyle = tok('--pick');
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(sx(o.pickX), box.t);
    ctx.lineTo(sx(o.pickX), box.t + box.ph);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  o.pts.forEach((p, i) => {
    ctx.fillStyle = tok('--fg');
    ctx.beginPath();
    ctx.arc(sx(p.x), sy(p.y), 4, 0, 7);
    ctx.fill();
    if (i === o.pts.length - 1) {
      ctx.strokeStyle = tok('--accent');
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx(p.x), sy(p.y), 8, 0, 7);
      ctx.stroke();
    }
  });
}

/** Acquisition score for a one-input problem. o: { xs, score|null, pickIndex, xr, xTitle } */
export function drawAcq1D(canvas, o) {
  const { ctx, w, h } = setupCanvas(canvas, 130);
  const pad = { l: 46, r: 10, t: 8, b: 40 };
  const box = { l: pad.l, t: pad.t, pw: w - pad.l - pad.r, ph: h - pad.t - pad.b };
  frame(ctx, box, o.xr, null, o.xTitle, null);
  if (!o.score) {
    message(ctx, w, h - 20, 'No acquisition score yet (random search, or fewer than 2 evaluations).');
    return;
  }
  const lo = Math.min(...o.score);
  const hi = Math.max(...o.score);
  const span = hi - lo || 1;
  const sx = (x) => box.l + ((x - o.xr[0]) / (o.xr[1] - o.xr[0])) * box.pw;
  const sy = (v) => box.t + (1 - (v - lo) / span) * box.ph * 0.92 + box.ph * 0.08;
  ctx.beginPath();
  o.xs.forEach((x, i) => {
    if (i) ctx.lineTo(sx(x), sy(o.score[i]));
    else ctx.moveTo(sx(x), sy(o.score[i]));
  });
  ctx.strokeStyle = tok('--pick');
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.lineTo(sx(o.xs[o.xs.length - 1]), box.t + box.ph);
  ctx.lineTo(sx(o.xs[0]), box.t + box.ph);
  ctx.closePath();
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = tok('--pick');
  ctx.fill();
  ctx.globalAlpha = 1;
  if (o.pickIndex != null && o.pickIndex >= 0) {
    ctx.fillStyle = tok('--pick');
    ctx.beginPath();
    ctx.arc(sx(o.xs[o.pickIndex]), sy(o.score[o.pickIndex]), 5, 0, 7);
    ctx.fill();
  }
}

/**
 * Heatmap over the unit square for a two-input problem.
 * o: { values|null, n, lowIsGood, pts (unit coords), pickU|null, message, xr, yr, xTitle, yTitle }
 */
export function drawHeat(canvas, o) {
  const size = Math.max(180, Math.min(canvas.clientWidth || 300, 340));
  const { ctx, w, h } = setupCanvas(canvas, size);
  const pad = { l: 34, r: 6, t: 16, b: 24 };
  const pw = w - pad.l - pad.r;
  const ph = h - pad.t - pad.b;
  ctx.fillStyle = tok('--soft');
  ctx.fillRect(pad.l, pad.t, pw, ph);
  if (o.values) {
    const lo = Math.min(...o.values);
    const hi = Math.max(...o.values);
    const span = hi - lo || 1;
    const good = o.lowIsGood ? hexToRgb(tok('--heat-good')) : hexToRgb(tok('--pick'));
    const bad = o.lowIsGood ? hexToRgb(tok('--heat-bad')) : hexToRgb(tok('--surface'));
    const cw = pw / o.n;
    const ch = ph / o.n;
    for (let r = 0; r < o.n; r++) {
      for (let c = 0; c < o.n; c++) {
        const t = (o.values[r * o.n + c] - lo) / span;
        const rgb = o.lowIsGood ? lerpColor(good, bad, t) : lerpColor(bad, good, t);
        ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
        ctx.fillRect(pad.l + c * cw, pad.t + (o.n - 1 - r) * ch, cw + 0.5, ch + 0.5);
      }
    }
  } else {
    message(ctx, w, h, o.message || '');
  }
  const px = (u) => pad.l + u[0] * pw;
  const py = (u) => pad.t + (1 - u[1]) * ph;
  (o.pts || []).forEach((u, i, all) => {
    ctx.fillStyle = tok('--fg');
    ctx.strokeStyle = tok('--surface');
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(px(u), py(u), 3.5, 0, 7);
    ctx.fill();
    ctx.stroke();
    if (i === all.length - 1) {
      ctx.strokeStyle = tok('--accent');
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px(u), py(u), 7, 0, 7);
      ctx.stroke();
    }
  });
  if (o.pickU) {
    ctx.strokeStyle = tok('--pick');
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px(o.pickU) - 6, py(o.pickU) - 6);
    ctx.lineTo(px(o.pickU) + 6, py(o.pickU) + 6);
    ctx.moveTo(px(o.pickU) + 6, py(o.pickU) - 6);
    ctx.lineTo(px(o.pickU) - 6, py(o.pickU) + 6);
    ctx.stroke();
  }
  ctx.font = '11px ' + tok('--font-mono');
  ctx.fillStyle = tok('--muted');
  ctx.textAlign = 'left';
  ctx.fillText(fmtTick(o.xr[0]), pad.l, h - 8);
  ctx.textAlign = 'right';
  ctx.fillText(fmtTick(o.xr[1]), pad.l + pw, h - 8);
  ctx.textAlign = 'center';
  ctx.fillText(o.xTitle, pad.l + pw / 2, h - 8);
  ctx.textAlign = 'right';
  ctx.fillText(fmtTick(o.yr[0]), pad.l - 4, pad.t + ph);
  ctx.fillText(fmtTick(o.yr[1]), pad.l - 4, pad.t + 10);
  ctx.textAlign = 'left';
  ctx.fillText(o.yTitle, 4, 11);
}

/** Best value found against evaluation number. o: { series:[{values, color}], budget, optimumY|null, yTitle } */
export function drawConvergence(canvas, o) {
  const { ctx, w, h } = setupCanvas(canvas, 250);
  const pad = { l: 46, r: 12, t: 28, b: 40 };
  const box = { l: pad.l, t: pad.t, pw: w - pad.l - pad.r, ph: h - pad.t - pad.b };
  const all = o.series.flatMap((s) => s.values);
  const xr = [1, Math.max(2, o.budget)];
  const sx = (i) => box.l + ((i - xr[0]) / (xr[1] - xr[0])) * box.pw;
  // A log axis when values are non-negative and span more than a factor of 50, so the small
  // differences near the end of a run stay visible next to a large first value.
  const pos = all.filter((v) => v > 0);
  const logY = all.length > 1 && all.every((v) => v >= 0) && pos.length && Math.max(...pos) / Math.min(...pos) > 50;
  if (logY) {
    const lo = Math.floor(Math.log10(Math.min(...pos)));
    const hi = Math.ceil(Math.log10(Math.max(...pos)));
    const ly = (v) => Math.log10(Math.max(v, 10 ** lo));
    const sy = (v) => box.t + (1 - (ly(v) - lo) / Math.max(1, hi - lo)) * box.ph;
    frame(ctx, box, xr, null, o.xTitle || 'Evaluation number', null);
    ctx.font = '11px ' + tok('--font-mono');
    ctx.strokeStyle = tok('--grid');
    ctx.fillStyle = tok('--muted');
    ctx.textAlign = 'right';
    for (let e = lo; e <= hi; e++) {
      const py = Math.round(sy(10 ** e)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(box.l, py);
      ctx.lineTo(box.l + box.pw, py);
      ctx.stroke();
      ctx.fillText(fmtTick(10 ** e), box.l - 6, py + 4);
    }
    ctx.textAlign = 'left';
    if (o.yTitle) ctx.fillText(`${o.yTitle} (log scale)`, 4, 12);
    drawSeries(ctx, o.series, sx, sy);
    return { logY: true };
  }
  let lo = all.length ? Math.min(...all) : 0;
  let hi = all.length ? Math.max(...all) : 1;
  if (o.optimumY != null) {
    lo = Math.min(lo, o.optimumY);
    hi = Math.max(hi, o.optimumY);
  }
  if (!(hi > lo)) hi = lo + 1;
  const padY = (hi - lo) * 0.05;
  const yr = [lo - padY, hi + padY];
  frame(ctx, box, xr, yr, o.xTitle || 'Evaluation number', o.yTitle);
  const sy = (v) => box.t + (1 - (v - yr[0]) / (yr[1] - yr[0])) * box.ph;
  if (o.optimumY != null) {
    ctx.strokeStyle = tok('--truth');
    ctx.lineWidth = 1.5;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(box.l, sy(o.optimumY));
    ctx.lineTo(box.l + box.pw, sy(o.optimumY));
    ctx.stroke();
    ctx.setLineDash([]);
  }
  drawSeries(ctx, o.series, sx, sy);
  return { logY: false };
}

function drawSeries(ctx, series, sx, sy) {
  for (const s of series) {
    if (!s.values.length) continue;
    ctx.strokeStyle = tok(s.color);
    ctx.lineWidth = s.dash ? 2 : 3;
    ctx.setLineDash(s.dash ? [6, 4] : []);
    ctx.beginPath();
    s.values.forEach((v, i) => {
      if (i) ctx.lineTo(sx(i + 1), sy(v));
      else ctx.moveTo(sx(i + 1), sy(v));
    });
    ctx.stroke();
    ctx.setLineDash([]);
    const last = s.values.length;
    ctx.fillStyle = tok(s.color);
    ctx.beginPath();
    ctx.arc(sx(last), sy(s.values[last - 1]), 3.5, 0, 7);
    ctx.fill();
  }
}
