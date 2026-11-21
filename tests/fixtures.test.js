import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { colorModelFixture } from './fixtures/make-fixture.js';

test('the color-model fixture used by the Python tests is current (run node scripts/export-fixtures.mjs)', () => {
  const saved = JSON.parse(readFileSync(new URL('./fixtures/color-model.json', import.meta.url), 'utf8'));
  assert.deepEqual(saved, JSON.parse(JSON.stringify(colorModelFixture())));
});
