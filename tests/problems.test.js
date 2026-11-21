import test from 'node:test';
import assert from 'node:assert/strict';
import { PROBLEMS, getProblem, instantiate, validateDefinition } from '../src/problems/index.js';
import ackley, { shiftOf } from '../src/problems/ackley.js';
import { dilutionRGB, labOf, deltaE76 } from '../src/problems/color-model.js';

test('problem ids are unique and every definition follows the interface', () => {
  assert.equal(new Set(PROBLEMS.map((p) => p.id)).size, PROBLEMS.length);
  for (const def of PROBLEMS) assert.deepEqual(validateDefinition(def), [], `problems in ${def.id}`);
  assert.throws(() => getProblem('missing'));
});

test('validateDefinition reports broken definitions', () => {
  const errors = validateDefinition({ id: 'x', kind: 'weird', create: () => ({ inputs: [], evaluate: () => 0 }) });
  assert.ok(errors.length >= 3);
});

test('every problem reaches its documented optimum value at its documented optimum point', () => {
  for (const def of PROBLEMS) {
    const p = instantiate(def);
    if (!p.optimum || !p.optimum.x) continue;
    assert.ok(Math.abs(p.evaluate(p.optimum.x) - p.optimum.y) < 1e-6, `${def.id} at optimum`);
  }
});

test('dilution: ΔE is zero at the target and grows toward both extremes', () => {
  const p = instantiate(getProblem('dilution'));
  assert.equal(p.dim, 1);
  assert.ok(p.evaluate([11]) < 1e-9);
  assert.ok(p.evaluate([0]) > 30, 'pure dye is far from the pale target');
  assert.ok(p.evaluate([5]) > p.evaluate([9]) && p.evaluate([9]) > p.evaluate([11]));
  assert.ok(p.evaluate([30]) > p.evaluate([15]) && p.evaluate([15]) > p.evaluate([11]));
  assert.match(p.visual.targetColor, /^rgb\(\d+,\d+,\d+\)$/);
  assert.match(p.visual.colorOf([5]), /^rgb\(\d+,\d+,\d+\)$/);
});

test('color model: more water gives a lighter color and identical colors have zero ΔE', () => {
  const lightness = (w) => labOf(dilutionRGB(w))[0];
  assert.ok(lightness(0) < lightness(4) && lightness(4) < lightness(20));
  assert.equal(deltaE76(labOf(dilutionRGB(3)), labOf(dilutionRGB(3))), 0);
});

test('ackley: adjustable dimension, shifted optimum, and a dent-covered landscape', () => {
  for (const dim of [1, 2, 7, 20]) {
    const p = instantiate(ackley, { dim });
    assert.equal(p.dim, dim);
    assert.equal(p.inputs.length, dim);
    assert.ok(p.evaluate(p.optimum.x) < 1e-9);
    assert.ok(p.evaluate(p.inputs.map(() => 0)) > 0.5, 'the domain center is not the optimum');
  }
  assert.equal(instantiate(ackley, { dim: 99 }).dim, 20, 'dimension is clamped');
  const p = instantiate(ackley, { dim: 1 });
  const opt = shiftOf(0);
  assert.ok(p.evaluate([opt + 0.5]) > 1, 'moving off the optimum raises the value');
  assert.ok(p.evaluate([opt + 1]) > 1 && p.evaluate([opt + 1]) < p.evaluate([opt + 3]), 'dents near, higher far');
});
