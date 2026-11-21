import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { colorModelFixture } from './fixtures/make-fixture.js';

// Compared with a tolerance: Math.exp and Math.pow can differ in the last bits between platforms.
function close(a, b, path) {
  if (typeof a === 'number') {
    assert.ok(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), `${path}: ${a} vs ${b}`);
  } else if (Array.isArray(a)) {
    assert.equal(a.length, b.length, `${path}: length`);
    a.forEach((v, i) => close(v, b[i], `${path}[${i}]`));
  } else if (a && typeof a === 'object') {
    assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort(), `${path}: keys`);
    for (const k of Object.keys(a)) close(a[k], b[k], `${path}.${k}`);
  } else {
    assert.equal(a, b, path);
  }
}

test('the color-model fixture used by the Python tests is current (run node scripts/export-fixtures.mjs)', () => {
  const saved = JSON.parse(readFileSync(new URL('./fixtures/color-model.json', import.meta.url), 'utf8'));
  close(saved, colorModelFixture(), 'fixture');
});
