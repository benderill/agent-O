// The Bayesian optimization loop. It works on any problem that follows the interface in src/problems/index.js.
//
//   const opt = new Optimizer({ problem, surrogate: 'gp-rbf', acquisition: 'ei', budget: 20, seed: 1 });
//   opt.step();          // evaluate one point (initial design first, then model-chosen points)
//   opt.runToBudget();   // or run everything
//   opt.history          // [{ x, u, y, source, iter }]
//
// All problems are minimized. Inputs are handled in the unit cube internally.

import { mulberry32, randn } from './core/rng.js';
import { fromUnit } from './core/space.js';
import { std } from './core/stats.js';
import { getSurrogate } from './surrogates/index.js';
import { getAcquisition, defaultParams } from './acquisition/index.js';

/** Space-filling random design: each axis is split into n strata and each stratum is used once. */
export function latinHypercube(n, d, rng) {
  const pts = Array.from({ length: n }, () => new Array(d));
  for (let j = 0; j < d; j++) {
    const perm = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const k = Math.floor(rng() * (i + 1));
      [perm[i], perm[k]] = [perm[k], perm[i]];
    }
    for (let i = 0; i < n; i++) pts[i][j] = (perm[i] + rng()) / n;
  }
  return pts;
}

/** Regular grid over the unit square (d = 2, row-major with x varying fastest) or unit interval (d = 1). */
export function gridPoints(d, n) {
  if (d === 1) return Array.from({ length: n }, (_, i) => [i / (n - 1)]);
  const out = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) out.push([c / (n - 1), r / (n - 1)]);
  return out;
}

/** Candidate points where the acquisition function is evaluated. Grids in 1-2 inputs, random search beyond. */
export function candidateSet(d, rng, bestU) {
  if (d === 1) return gridPoints(1, 401);
  if (d === 2) return gridPoints(2, 51);
  const out = [];
  for (let i = 0; i < 3000; i++) out.push(Array.from({ length: d }, () => rng()));
  if (bestU) {
    for (const s of [0.02, 0.05, 0.1, 0.2]) {
      for (let i = 0; i < 250; i++) {
        out.push(bestU.map((v) => Math.min(1, Math.max(0, v + s * randn(rng)))));
      }
    }
  }
  return out;
}

export class Optimizer {
  constructor({ problem, surrogate = 'gp-rbf', acquisition = 'ei', params, budget = 20, seed = 1, noise = 0, nInit }) {
    this.problem = problem;
    this.d = problem.inputs.length;
    this.seed = seed;
    this.noise = noise;
    this.budget = budget;
    this.history = [];
    this._rng = mulberry32(seed);
    this.nInit = nInit ?? Math.min(Math.max(2, this.d + 1), 10);
    this._initU = latinHypercube(this.nInit, this.d, this._rng);
    this.setStrategy({ surrogate, acquisition, params });
  }

  /** Changes the surrogate, acquisition function or its parameters. Past evaluations are kept. */
  setStrategy({ surrogate, acquisition, params } = {}) {
    if (surrogate) this.surrogate = getSurrogate(surrogate);
    if (acquisition) {
      this.acquisition = getAcquisition(acquisition);
      this.params = { ...defaultParams(this.acquisition), ...(params || {}) };
    } else if (params) {
      this.params = { ...this.params, ...params };
    }
    this._model = null;
    this._modelN = -1;
  }

  get done() {
    return this.history.length >= this.budget;
  }

  get best() {
    let b = null;
    for (const h of this.history) if (!b || h.y < b.y) b = h;
    return b;
  }

  /** Best observed value after each evaluation. */
  bestSoFar() {
    const out = [];
    let b = Infinity;
    for (const h of this.history) {
      b = Math.min(b, h.y);
      out.push(b);
    }
    return out;
  }

  _observe(u, source) {
    const x = fromUnit(this.problem, u);
    const y = this.problem.evaluate(x) + (this.noise > 0 ? this.noise * randn(this._rng) : 0);
    const rec = { x, u, y, source, iter: this.history.length + 1 };
    this.history.push(rec);
    return rec;
  }

  /** Evaluates one more point. Returns the record, or null once the budget is spent. */
  step() {
    if (this.done) return null;
    const n = this.history.length;
    if (n < this.nInit) return this._observe(this._initU[n], 'init');
    const { u } = this.propose();
    return this._observe(u, this.surrogate.random ? 'random' : 'model');
  }

  runToBudget() {
    while (!this.done) this.step();
  }

  /** The surrogate fitted to the current history, or null when there is no model or too little data. */
  model() {
    if (this.surrogate.random || this.history.length < 2) return null;
    if (this._modelN !== this.history.length) {
      this._model = this.surrogate.fit(
        this.history.map((h) => h.u),
        this.history.map((h) => h.y),
        { noiseSd: this.noise },
      );
      this._modelN = this.history.length;
    }
    return this._model;
  }

  /** Surrogate predictions and acquisition scores at points U in the unit cube. Null when there is no model. */
  analyze(U) {
    const model = this.model();
    if (!model) return null;
    const { mean, std: sd } = model.predict(U);
    let scale = std(this.history.map((h) => h.y));
    if (!(scale > 1e-9)) scale = 1;
    const score = this.acquisition.score({ mean, std: sd, best: this.best.y, scale, params: this.params });
    return { mean, std: sd, score };
  }

  /** The next point the strategy would evaluate. Depends only on the history and the seed, so it can be previewed. */
  propose() {
    const rng = mulberry32((this.seed * 1000003 + this.history.length * 7919) >>> 0);
    if (this.surrogate.random || !this.model()) {
      return { u: Array.from({ length: this.d }, () => rng()), score: null };
    }
    const cand = candidateSet(this.d, rng, this.best ? this.best.u : null);
    const a = this.analyze(cand);
    let pick = -1;
    for (let i = 0; i < cand.length; i++) {
      if (this._tooClose(cand[i])) continue;
      if (pick < 0 || a.score[i] > a.score[pick]) pick = i;
    }
    if (pick < 0) return { u: cand[0], score: null };
    return { u: cand[pick], score: a.score[pick] };
  }

  _tooClose(u) {
    for (const h of this.history) {
      let s = 0;
      for (let j = 0; j < u.length; j++) {
        const t = u[j] - h.u[j];
        s += t * t;
      }
      if (s < 1e-6) return true;
    }
    return false;
  }
}

/** Baseline: best observed value after each of `budget` uniformly random evaluations. */
export function randomSearch(problem, budget, seed, noise = 0) {
  const rng = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  const d = problem.inputs.length;
  const out = [];
  let best = Infinity;
  for (let i = 0; i < budget; i++) {
    const u = Array.from({ length: d }, () => rng());
    const y = problem.evaluate(fromUnit(problem, u)) + (noise > 0 ? noise * randn(rng) : 0);
    best = Math.min(best, y);
    out.push(best);
  }
  return out;
}
