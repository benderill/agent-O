import test from 'node:test';
import assert from 'node:assert/strict';
import { cholesky, solveLower, solveUpperT, choleskySolve } from '../src/core/linalg.js';
import { normalCdf, normalPdf, mean, std } from '../src/core/stats.js';
import { mulberry32, randn } from '../src/core/rng.js';
import { toUnit, fromUnit, toUnitCoord, fromUnitCoord } from '../src/core/space.js';

const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} is not within ${tol} of ${b}`);

test('cholesky matches a known factorization', () => {
  const L = cholesky([
    [4, 12, -16],
    [12, 37, -43],
    [-16, -43, 98],
  ]);
  const expected = [
    [2, 0, 0],
    [6, 1, 0],
    [-8, 5, 3],
  ];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) close(L[i][j], expected[i][j], 1e-6);
});

test('choleskySolve solves A x = b', () => {
  const A = [
    [4, 12, -16],
    [12, 37, -43],
    [-16, -43, 98],
  ];
  const b = [1, 2, 3];
  const x = choleskySolve(cholesky(A), b);
  for (let i = 0; i < 3; i++) {
    let s = 0;
    for (let j = 0; j < 3; j++) s += A[i][j] * x[j];
    close(s, b[i], 1e-6);
  }
});

test('triangular solves invert each other', () => {
  const L = cholesky([
    [2, 1],
    [1, 2],
  ]);
  const y = solveLower(L, [1, 1]);
  const x = solveUpperT(L, y);
  close(2 * x[0] + 1 * x[1], 1, 1e-6);
  close(1 * x[0] + 2 * x[1], 1, 1e-6);
});

test('normal distribution helpers', () => {
  close(normalCdf(0), 0.5, 1e-7);
  close(normalCdf(1.96), 0.975, 1e-4);
  close(normalCdf(-1.3) + normalCdf(1.3), 1, 1e-7);
  close(normalPdf(0), 0.3989422804, 1e-9);
  close(mean([1, 2, 3, 4]), 2.5);
  close(std([2, 4, 4, 4, 5, 5, 7, 9]), 2);
});

test('seeded rng is reproducible and in range', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 100; i++) {
    const v = a();
    assert.equal(v, b());
    assert.ok(v >= 0 && v < 1);
  }
  const r = mulberry32(7);
  const samples = Array.from({ length: 4000 }, () => randn(r));
  close(mean(samples), 0, 0.08);
  close(std(samples), 1, 0.08);
});

test('unit cube conversion round-trips for linear and log1p inputs', () => {
  const problem = {
    inputs: [
      { name: 'a', min: -5, max: 5, scale: 'linear' },
      { name: 'w', min: 0, max: 30, scale: 'log1p' },
    ],
  };
  for (const x of [
    [-5, 0],
    [0, 11],
    [3.3, 30],
  ]) {
    const back = fromUnit(problem, toUnit(problem, x));
    close(back[0], x[0], 1e-9);
    close(back[1], x[1], 1e-9);
  }
  close(toUnitCoord(problem.inputs[1], 0), 0);
  close(toUnitCoord(problem.inputs[1], 30), 1);
  close(fromUnitCoord(problem.inputs[0], 0.5), 0);
});
