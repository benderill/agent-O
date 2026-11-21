import test from 'node:test';
import assert from 'node:assert/strict';
import { SURROGATES, getSurrogate } from '../src/surrogates/index.js';
import { ACQUISITIONS, getAcquisition, defaultParams } from '../src/acquisition/index.js';

const gps = SURROGATES.filter((s) => !s.random);

test('registries expose unique ids and can be looked up', () => {
  assert.equal(new Set(SURROGATES.map((s) => s.id)).size, SURROGATES.length);
  assert.equal(new Set(ACQUISITIONS.map((a) => a.id)).size, ACQUISITIONS.length);
  for (const s of SURROGATES) assert.equal(getSurrogate(s.id), s);
  for (const a of ACQUISITIONS) assert.equal(getAcquisition(a.id), a);
  assert.throws(() => getSurrogate('nope'));
  assert.throws(() => getAcquisition('nope'));
});

for (const gp of gps) {
  test(`${gp.id}: reproduces training points and is certain there`, () => {
    const X = [[0.1], [0.4], [0.7], [0.95]];
    const y = X.map(([u]) => Math.sin(6 * u));
    const model = gp.fit(X, y);
    const { mean, std } = model.predict(X);
    for (let i = 0; i < X.length; i++) {
      assert.ok(Math.abs(mean[i] - y[i]) < 0.05, `mean at training point ${i}`);
      assert.ok(std[i] < 0.1, `std at training point ${i}`);
    }
  });

  test(`${gp.id}: uncertainty grows away from the data`, () => {
    const X = [[0.1], [0.15], [0.2]];
    const y = [1, 1.2, 0.9];
    const { std } = gp.fit(X, y).predict([[0.15], [0.9]]);
    assert.ok(std[1] > 3 * std[0], `far std ${std[1]} should exceed near std ${std[0]}`);
  });

  test(`${gp.id}: works in several dimensions`, () => {
    const X = [];
    const y = [];
    for (let i = 0; i < 12; i++) {
      const p = [i / 12, ((i * 5) % 12) / 12, ((i * 7) % 12) / 12, 0.5];
      X.push(p);
      y.push(p[0] + 2 * p[1] - p[2]);
    }
    const { mean, std } = gp.fit(X, y).predict([[0.3, 0.3, 0.3, 0.5]]);
    assert.ok(Number.isFinite(mean[0]) && Number.isFinite(std[0]) && std[0] > 0);
  });
}

const ctxFor = (acq, over = {}) => ({
  mean: [1.0, 1.0, 3.0, 0.2],
  std: [0.1, 1.0, 0.001, 0.5],
  best: 1.0,
  scale: 1,
  params: defaultParams(acq),
  ...over,
});

test('expected improvement is non-negative, ignores hopeless certain points, and rewards uncertainty', () => {
  const ei = getAcquisition('ei');
  const s = ei.score(ctxFor(ei));
  for (const v of s) assert.ok(v >= 0);
  assert.ok(s[2] < 1e-6, 'a certainly-worse point has no improvement');
  assert.ok(s[1] > s[0], 'same mean, more uncertainty, higher score');
  assert.ok(s[3] > s[0], 'a lower predicted value scores higher');
});

test('probability of improvement stays between 0 and 1', () => {
  const pi = getAcquisition('pi');
  for (const v of pi.score(ctxFor(pi))) assert.ok(v >= 0 && v <= 1);
});

test('upper confidence bound prefers low means and rises with kappa where uncertainty exists', () => {
  const ucb = getAcquisition('ucb');
  const low = ucb.score(ctxFor(ucb, { params: { kappa: 0 } }));
  const high = ucb.score(ctxFor(ucb, { params: { kappa: 3 } }));
  assert.ok(low[3] > low[0] && low[0] > low[2]);
  assert.ok(high[1] > low[1]);
});

test('every acquisition function declares complete parameters', () => {
  for (const a of ACQUISITIONS) {
    assert.ok(a.label && a.description);
    for (const p of a.params) {
      assert.ok(p.id && p.label);
      assert.ok(p.min <= p.default && p.default <= p.max);
      assert.ok(p.step > 0);
    }
  }
});
