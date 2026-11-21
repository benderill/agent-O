// Gaussian process surrogate with a selectable kernel.
//
// Inputs are points in the unit cube. Targets are standardized internally, and the length scale is chosen
// from a small grid by marginal likelihood. predict() returns means and standard deviations in the
// original units of y.

import { cholesky, choleskySolve, solveLower, logDet } from '../core/linalg.js';
import { mean, std } from '../core/stats.js';

const BASE_LENGTHSCALES = [0.04, 0.07, 0.1, 0.15, 0.22, 0.35, 0.6, 1.0];
const JITTER = 1e-4;

const KERNELS = {
  // Very smooth functions.
  rbf: (r2, l) => Math.exp((-0.5 * r2) / (l * l)),
  // Rougher functions, a common default in Bayesian optimization.
  matern52: (r2, l) => {
    const s = Math.sqrt(5 * r2) / l;
    return (1 + s + (s * s) / 3) * Math.exp(-s);
  },
};

function sqDist(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const t = a[i] - b[i];
    s += t * t;
  }
  return s;
}

export function createGP({ id, label, kernel, description }) {
  const k = KERNELS[kernel];
  if (!k) throw new Error(`Unknown kernel: ${kernel}`);
  return {
    id,
    label,
    description,
    /**
     * @param {number[][]} X training inputs in the unit cube
     * @param {number[]} y observed values
     * @param {{noiseSd?: number}} opts observation noise standard deviation, in units of y
     */
    fit(X, y, { noiseSd = 0 } = {}) {
      const n = X.length;
      const d = X[0].length;
      const ym = mean(y);
      let ys = std(y);
      if (!(ys > 1e-9)) ys = 1;
      const yn = y.map((v) => (v - ym) / ys);
      const noiseVar = (noiseSd / ys) ** 2;
      const r2 = X.map((a) => X.map((b) => sqDist(a, b)));

      let best = null;
      for (const base of BASE_LENGTHSCALES) {
        const l = base * Math.sqrt(d);
        const K = r2.map((row, i) => row.map((v, j) => k(v, l) + (i === j ? noiseVar + JITTER : 0)));
        const L = cholesky(K);
        const alpha = choleskySolve(L, yn);
        let quad = 0;
        for (let i = 0; i < n; i++) quad += yn[i] * alpha[i];
        const ll = -0.5 * quad - 0.5 * logDet(L);
        if (!best || ll > best.ll) best = { ll, l, L, alpha };
      }

      return {
        lengthscale: best.l,
        predict(Xq) {
          const meanOut = new Array(Xq.length);
          const stdOut = new Array(Xq.length);
          const ks = new Float64Array(n);
          for (let q = 0; q < Xq.length; q++) {
            let mu = 0;
            for (let i = 0; i < n; i++) {
              ks[i] = k(sqDist(Xq[q], X[i]), best.l);
              mu += ks[i] * best.alpha[i];
            }
            const v = solveLower(best.L, ks);
            let vv = 0;
            for (let i = 0; i < n; i++) vv += v[i] * v[i];
            meanOut[q] = mu * ys + ym;
            stdOut[q] = Math.sqrt(Math.max(1 - vv, 1e-12)) * ys;
          }
          return { mean: meanOut, std: stdOut };
        },
      };
    },
  };
}
