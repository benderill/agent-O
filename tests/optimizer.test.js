import test from 'node:test';
import assert from 'node:assert/strict';
import { PROBLEMS, instantiate, getProblem } from '../src/problems/index.js';
import { Optimizer, randomSearch, latinHypercube, gridPoints, candidateSet } from '../src/optimizer.js';
import { mulberry32 } from '../src/core/rng.js';

const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const run = (def, opts, optimizerOpts) => {
  const problem = instantiate(def, opts);
  const opt = new Optimizer({ problem, ...optimizerOpts });
  opt.runToBudget();
  return { problem, opt };
};

test('latin hypercube uses every stratum exactly once per axis', () => {
  const n = 9;
  const pts = latinHypercube(n, 3, mulberry32(3));
  for (let j = 0; j < 3; j++) {
    const strata = pts.map((p) => Math.floor(p[j] * n)).sort((a, b) => a - b);
    assert.deepEqual(strata, Array.from({ length: n }, (_, i) => i));
  }
});

test('candidate sets stay in the unit cube', () => {
  const rng = mulberry32(1);
  for (const d of [1, 2, 5]) {
    const cand = candidateSet(d, rng, new Array(d).fill(0.99));
    assert.ok(cand.length > 100);
    for (const p of cand) for (const v of p) assert.ok(v >= 0 && v <= 1);
  }
  assert.equal(gridPoints(2, 5).length, 25);
});

test('the optimizer respects its budget and returns records in order', () => {
  const { opt } = run(getProblem('ackley'), { dim: 3 }, { budget: 14, seed: 3 });
  assert.equal(opt.history.length, 14);
  assert.equal(opt.done, true);
  assert.equal(opt.step(), null);
  opt.history.forEach((h, i) => assert.equal(h.iter, i + 1));
  assert.equal(opt.history.filter((h) => h.source === 'init').length, opt.nInit);
  for (const h of opt.history) for (const v of h.u) assert.ok(v >= 0 && v <= 1);
});

test('the same seed gives the same run, and different seeds differ', () => {
  const a = run(getProblem('dilution'), {}, { budget: 8, seed: 5 }).opt.history.map((h) => h.y);
  const b = run(getProblem('dilution'), {}, { budget: 8, seed: 5 }).opt.history.map((h) => h.y);
  const c = run(getProblem('dilution'), {}, { budget: 8, seed: 6 }).opt.history.map((h) => h.y);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test('best-so-far never gets worse', () => {
  const { opt } = run(getProblem('ackley'), { dim: 2 }, { budget: 20, seed: 2 });
  const curve = opt.bestSoFar();
  for (let i = 1; i < curve.length; i++) assert.ok(curve[i] <= curve[i - 1]);
  assert.equal(curve.at(-1), opt.best.y);
});

test('proposing is a pure preview: it does not change the run', () => {
  const problem = instantiate(getProblem('ackley'), { dim: 5 });
  const opt = new Optimizer({ problem, budget: 20, seed: 4 });
  while (opt.history.length < 8) opt.step();
  const first = opt.propose();
  const second = opt.propose();
  assert.deepEqual(first.u, second.u);
  assert.equal(opt.history.length, 8);
});

test('strategy can be switched mid-run without losing history', () => {
  const problem = instantiate(getProblem('dilution'));
  const opt = new Optimizer({ problem, budget: 8, seed: 1 });
  while (opt.history.length < 4) opt.step();
  opt.setStrategy({ acquisition: 'ucb', params: { kappa: 3 }, surrogate: 'gp-matern' });
  assert.equal(opt.history.length, 4);
  assert.equal(opt.acquisition.id, 'ucb');
  assert.equal(opt.params.kappa, 3);
  opt.runToBudget();
  assert.equal(opt.history.length, 8);
});

test('random search strategy runs and every problem works with every strategy', () => {
  for (const def of PROBLEMS) {
    for (const surrogate of ['gp-rbf', 'gp-matern', 'random']) {
      for (const acquisition of ['ei', 'pi', 'ucb']) {
        const { opt } = run(def, { dim: 2 }, { surrogate, acquisition, budget: 8, seed: 2 });
        assert.equal(opt.history.length, 8, `${def.id} ${surrogate} ${acquisition}`);
        assert.ok(opt.history.every((h) => Number.isFinite(h.y)));
      }
    }
  }
});

test('noisy observations are supported', () => {
  const { opt } = run(getProblem('dilution'), {}, { budget: 8, seed: 2, noise: 0.5 });
  assert.equal(opt.history.length, 8);
  assert.ok(opt.history.every((h) => Number.isFinite(h.y)));
});

test('dilution: Bayesian optimization gets close to the target within 8 mixes on every seed tried', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const { opt } = run(getProblem('dilution'), {}, { surrogate: 'gp-matern', acquisition: 'ei', budget: 8, seed });
    assert.ok(opt.best.y < 2, `seed ${seed} reached ΔE ${opt.best.y.toFixed(2)}`);
  }
});

test('ackley 2D: Bayesian optimization beats random search at the median over several seeds', () => {
  const seeds = [1, 2, 3, 4, 5, 6];
  const bo = [];
  const rnd = [];
  for (const seed of seeds) {
    const { problem, opt } = run(getProblem('ackley'), { dim: 2 }, { surrogate: 'gp-matern', acquisition: 'ei', budget: 26, seed });
    bo.push(opt.best.y);
    rnd.push(randomSearch(problem, 26, seed).at(-1));
  }
  assert.ok(median(bo) < median(rnd) / 2, `BO median ${median(bo).toFixed(2)} vs random median ${median(rnd).toFixed(2)}`);
});

test('randomSearch returns a non-increasing curve of the requested length', () => {
  const problem = instantiate(getProblem('ackley'), { dim: 4 });
  const curve = randomSearch(problem, 30, 9);
  assert.equal(curve.length, 30);
  for (let i = 1; i < curve.length; i++) assert.ok(curve[i] <= curve[i - 1]);
});
