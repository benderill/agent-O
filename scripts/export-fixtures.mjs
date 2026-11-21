// Writes tests/fixtures/color-model.json: outputs of the browser color model at fixed points.
// tests/python/test_color_model.py checks that the Python port in ax/color_model.py gives the same numbers,
// and tests/fixtures.test.js checks that this file is current. Rerun after changing the color model:
//   node scripts/export-fixtures.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { colorModelFixture } from '../tests/fixtures/make-fixture.js';

const out = fileURLToPath(new URL('../tests/fixtures/color-model.json', import.meta.url));
writeFileSync(out, JSON.stringify(colorModelFixture(), null, 2) + '\n');
console.log(`wrote ${out}`);
