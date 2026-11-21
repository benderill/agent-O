// Statistics helpers.

export function normalPdf(z) {
  return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
}

/** Standard normal CDF (Abramowitz and Stegun 26.2.17, absolute error below 1e-7). */
export function normalCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = normalPdf(z);
  const p =
    d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? 1 - p : p;
}

export function mean(a) {
  let s = 0;
  for (const v of a) s += v;
  return s / a.length;
}

/** Population standard deviation. */
export function std(a) {
  const m = mean(a);
  let s = 0;
  for (const v of a) s += (v - m) * (v - m);
  return Math.sqrt(s / a.length);
}
