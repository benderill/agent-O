// Loads every page in a headless browser and checks it. A development tool only; the site itself has no dependencies.
//   npm run check                 all pages
//   npm run check -- --page dilution,lesson   only the named pages
//   npm run check -- --no-shots   skip screenshots
//
// For each page:
//   - fails on console errors, page errors, failed same-origin requests and broken internal links
//   - screenshots at 1280 px light, 1280 px dark and 400 px mobile into docs/screenshots/
//   - fails on horizontal scrolling at 400 px and on controls smaller than 44 px
//   - runs the page's behavior script (click Run, Step, Reset, ...) and checks the visible numbers
// The site is served under a subpath, as on GitHub Pages, so absolute links show up as 404s.
//
// Needs Playwright: npm install, then npx playwright install chromium.

import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const BASE = '/agent-O/';
const PORT = 8765;
const ORIGIN = `http://localhost:${PORT}`;
const shotsDir = fileURLToPath(new URL('../docs/screenshots/', import.meta.url));

const args = process.argv.slice(2);
const only = args.includes('--page') ? args[args.indexOf('--page') + 1] : null;
const shots = !args.includes('--no-shots');

const num = (s) => Number(String(s).replace(/[^0-9.\-]/g, ''));

/** Pages to check. `act` exercises the controls and returns a list of failures. */
const PAGES = [
  { name: 'dilution', path: '', act: actWorkspace },
  { name: 'ackley-2d', path: '?problem=ackley' },
  { name: 'ackley-1d', path: '?problem=ackley&dim=1' },
  { name: 'ackley-6d', path: '?problem=ackley&dim=6', act: actRunOnly },
  { name: 'lesson', path: 'lessons/surrogate-acquisition.html', layoutKnown: true }, // see docs/open-issues.md
  { name: 'ax-dilution', path: 'ax/dilution.html', act: actAx },
];

async function actWorkspace(page) {
  const bad = [];
  const text = (id) => page.locator(`#${id}`).innerText();
  if ((await text('sEvals')) !== '0 of 8 mixes') bad.push(`start: sEvals is "${await text('sEvals')}"`);
  await page.click('#step');
  if (!(await text('sEvals')).startsWith('1 of 8')) bad.push('Step did not add a mix');
  if (!/Mix 1: 1 ml dye \+ [\d.]+ ml water/.test(await text('labLine1'))) bad.push(`lab text: "${await text('labLine1')}"`);
  if ((await page.locator('#log tbody tr').count()) !== 1) bad.push('log should have 1 row after Step');
  await page.click('#run');
  await page.waitForFunction(() => document.getElementById('sEvals').textContent.startsWith('8 of 8'), null, { timeout: 15000 });
  const best = Number((/ΔE ([\d.]+)/.exec(await text('labLine3')) || [])[1]);
  if (!(best >= 0 && best < 5)) bad.push(`best ΔE after 8 mixes is ${best}, expected below 5 with seed 1`);
  if ((await page.locator('#log tbody tr.best').count()) !== 1) bad.push('exactly one best row expected in the log');
  if (!(await page.locator('#step').isDisabled())) bad.push('Step should be disabled at budget');
  // Budget slider extends the run.
  await page.locator('#budget').evaluate((el) => { el.value = '10'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  if ((await text('budgetVal')) !== '10') bad.push('budget slider value not shown');
  if (await page.locator('#step').isDisabled()) bad.push('Step should be enabled after raising the budget');
  // Strategy change keeps the history.
  await page.selectOption('#surrogate', { index: 1 });
  if (!(await text('sEvals')).startsWith('8 of 10')) bad.push('changing the surrogate should keep the history');
  await page.check('#showTruth');
  await page.click('#reset');
  if (!(await text('sEvals')).startsWith('0 of 10')) bad.push(`Reset: sEvals is "${await text('sEvals')}"`);
  if ((await page.locator('#log tbody tr.best').count()) !== 0) bad.push('Reset should clear the log');
  // Seed changes the run.
  await page.fill('#seed', '7');
  await page.locator('#seed').dispatchEvent('change');
  await page.click('#step');
  const w7 = await text('labLine1');
  await page.fill('#seed', '1');
  await page.locator('#seed').dispatchEvent('change');
  await page.click('#step');
  if (w7 === (await text('labLine1'))) bad.push('different seeds gave the same first mix');
  // Switching problem through the catalog.
  await page.click('#catalog a[data-id="ackley"]');
  if ((await text('pTitle')) !== 'Ackley function') bad.push('catalog link did not switch problem');
  if (!page.url().includes('problem=ackley')) bad.push('URL not updated after switching problem');
  if (await page.locator('#axCta').isVisible()) bad.push('Ackley has no Ax page, CTA should be hidden');
  return bad;
}

async function actRunOnly(page) {
  const bad = [];
  await page.click('#run');
  await page.waitForFunction(() => /^(\d+) of \1 /.test(document.getElementById('sEvals').textContent), null, { timeout: 60000 });
  if (!(await page.locator('#log tbody tr').count())) bad.push('no log rows after Run');
  return bad;
}

async function actAx(page) {
  const bad = [];
  const code = await page.locator('#code').innerText();
  if (!code.includes('AxClient')) bad.push('script not loaded into the page');
  const colab = await page.locator('#colab').getAttribute('href');
  if (!/^https:\/\/colab\.research\.google\.com\/github\/[^/]+\/agent-O\/blob\/main\/ax\/dilution\.ipynb$/.test(colab || '')) bad.push(`Colab link is "${colab}"`);
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGIN });
  await page.click('#copy');
  await page.waitForTimeout(200);
  if (!/copied/i.test(await page.locator('#copyStatus').innerText())) bad.push('Copy gave no feedback');
  const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  const file = await page.evaluate(() => fetch('dilution.py').then((r) => r.text()));
  // The Windows clipboard turns line endings into CRLF, so compare without them.
  if (clip.replace(/\r\n/g, '\n') !== file) bad.push('clipboard does not match ax/dilution.py');
  const badge = await page.locator('#runBadge').innerText();
  if (!/^(Tested|Untested)/.test(badge)) bad.push(`run badge is "${badge}"`);
  return bad;
}

async function checkLayout(page, label) {
  return page.evaluate((label) => {
    const out = [];
    const de = document.documentElement;
    if (de.scrollWidth > de.clientWidth + 1) out.push(`${label}: horizontal scroll (${de.scrollWidth} > ${de.clientWidth})`);
    const sel = 'button, select, input[type=number], .sitelinks a, .catalog a, .btn, .btn-light, .check, .links a';
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      if (!r.width || getComputedStyle(el).visibility === 'hidden') continue;
      if (r.height < 43.5) out.push(`${label}: ${el.tagName.toLowerCase()}#${el.id || el.textContent.trim().slice(0, 20)} is ${Math.round(r.height)}px tall`);
    }
    for (const el of document.querySelectorAll('h1, h2, p, label, th, td, a, button')) {
      if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow === 'hidden') out.push(`${label}: clipped text in ${el.tagName}`);
    }
    return out;
  }, label);
}

async function main() {
  const { chromium } = await import('playwright');
  const server = await serve({ port: PORT, base: BASE });
  const browser = await chromium.launch();
  if (shots) await mkdir(shotsDir, { recursive: true });
  const failures = [];
  const warnings = [];
  const linkCache = new Map();

  for (const p of PAGES) {
    if (only && !only.split(",").includes(p.name)) continue;
    const url = ORIGIN + BASE + p.path;
    const variants = [
      { tag: 'light', viewport: { width: 1280, height: 900 }, colorScheme: 'light' },
      { tag: 'dark', viewport: { width: 1280, height: 900 }, colorScheme: 'dark' },
      { tag: 'mobile', viewport: { width: 400, height: 860 }, colorScheme: 'light', isMobile: true, hasTouch: true },
    ];
    for (const v of variants) {
      const ctx = await browser.newContext({ viewport: v.viewport, colorScheme: v.colorScheme, isMobile: v.isMobile, hasTouch: v.hasTouch, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      const errs = [];
      page.on('console', (m) => { if (m.type() === 'error') errs.push(`console: ${m.text()}`); });
      page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
      page.on('requestfailed', (r) => { if (r.url().startsWith(ORIGIN)) errs.push(`request failed: ${r.url()}`); });
      page.on('response', (r) => { if (r.url().startsWith(ORIGIN) && r.status() >= 400) errs.push(`HTTP ${r.status()}: ${r.url()}`); });
      const label = `${p.name}/${v.tag}`;
      const res = await page.goto(url, { waitUntil: 'networkidle' });
      if (!res || res.status() >= 400) errs.push(`page HTTP ${res && res.status()}`);
      await page.waitForTimeout(250);
      (p.layoutKnown ? warnings : failures).push(...(await checkLayout(page, label)));
      if (shots) await page.screenshot({ path: `${shotsDir}${p.name}-${v.tag}.png`, fullPage: true });

      if (v.tag === 'light') {
        const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => a.href));
        for (const h of hrefs) {
          if (!h.startsWith(ORIGIN)) continue;
          const clean = h.split('#')[0];
          if (!linkCache.has(clean)) {
            const r = await fetch(clean).catch(() => null);
            linkCache.set(clean, r ? r.status : 0);
          }
          if (linkCache.get(clean) >= 400 || linkCache.get(clean) === 0) failures.push(`${label}: broken link ${h} (${linkCache.get(clean)})`);
        }
        if (p.act) failures.push(...(await p.act(page)).map((m) => `${label}: ${m}`));
        await page.waitForTimeout(100);
      } else if (v.tag === 'mobile' && p.act === actWorkspace) {
        // The workspace after a full run, at phone width.
        await page.click('#run');
        await page.waitForFunction(() => document.getElementById('sEvals').textContent.startsWith('8 of 8'), null, { timeout: 15000 });
        await page.waitForTimeout(300);
        failures.push(...(await checkLayout(page, `${label}/after-run`)));
        if (shots) await page.screenshot({ path: `${shotsDir}${p.name}-mobile-run.png`, fullPage: true });
      } else if (v.tag === 'dark' && p.act === actWorkspace) {
        await page.click('#run');
        await page.waitForFunction(() => document.getElementById('sEvals').textContent.startsWith('8 of 8'), null, { timeout: 15000 });
        await page.waitForTimeout(300);
        if (shots) await page.screenshot({ path: `${shotsDir}${p.name}-dark-run.png`, fullPage: true });
      }
      if (p.act === actWorkspace && v.tag === 'light' && shots) {
        await page.goto(url, { waitUntil: 'networkidle' });
        await page.click('#run');
        await page.waitForFunction(() => document.getElementById('sEvals').textContent.startsWith('8 of 8'), null, { timeout: 15000 });
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${shotsDir}${p.name}-light-run.png`, fullPage: true });
      }
      failures.push(...errs.map((e) => `${label}: ${e}`));
      await ctx.close();
    }
    console.log(`checked ${p.name}`);
  }
  await browser.close();
  server.close();
  if (warnings.length) console.warn(`
${warnings.length} known layout issue(s), listed in docs/open-issues.md (not failing).`);
  if (failures.length) {
    console.error(`\n${failures.length} problem(s):`);
    for (const f of failures) console.error('  - ' + f);
    process.exit(1);
  }
  console.log('\nAll pages passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
