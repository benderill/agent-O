// "Take it to Ax" page: loads the script next to the page, highlights the lines changed from Honegumi's output,
// opens the notebook in Colab when the code is clicked, copies the script, and shows whether the notebook was run.
// The page reads the script and run status from files, so it never shows code or results that were not generated.

const $ = (id) => document.getElementById(id);
const name = document.location.pathname.split('/').pop().replace(/\.html$/, '') || 'dilution';

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

let scriptText = '';

async function loadScript() {
  try {
    const r = await fetch(`${name}.py`);
    if (!r.ok) throw new Error(r.status);
    scriptText = await r.text();
    $('code').innerHTML = scriptText
      .replace(/\n$/, '')
      .split('\n')
      .map((line) => {
        const cls = /# MOD\b/.test(line) ? 'ln mod' : /^\s*#/.test(line) ? 'ln cm' : 'ln';
        return `<span class="${cls}">${esc(line) || ' '}</span>`;
      })
      .join('');
  } catch {
    $('code').textContent = 'The script could not be loaded here. Use the download links below.';
  }
}

async function loadStatus() {
  const badge = $('runBadge');
  try {
    const r = await fetch('run-status.json');
    if (!r.ok) throw new Error(r.status);
    const s = await r.json();
    if (!s.ran) throw new Error('not run');
    badge.textContent = `Tested: ran end to end on ${s.date}`;
    badge.classList.add('ok');
    let detail = `The notebook was run with Python ${s.python}, ax-platform ${s.ax_platform} and Honegumi ${s.honegumi}. ` +
      `With seed ${s.seed}, its best of ${s.trials} mixes was ΔE ${s.best_delta_e} (${s.best_water_ml} ml water; the target is 11 ml).`;
    if (s.compare) {
      detail += ` Over seeds 1 to ${s.compare.seeds}, Ax's median best ΔE was ${s.compare.median_best_delta_e}.`;
    }
    $('runDetail').textContent = detail;
  } catch {
    badge.textContent = 'Untested: this script has not been run';
    badge.classList.add('warn');
  }
}

async function loadOptions() {
  try {
    const r = await fetch(`generated/${name}.options.json`);
    if (!r.ok) return;
    const { options: o } = await r.json();
    const yes = (v) => (v ? 'yes' : 'no');
    const cons = ['sum_constraint', 'order_constraint', 'linear_constraint', 'composition_constraint'].filter((k) => o[k]);
    const items = [
      `Objective: ${String(o.objective).toLowerCase()}`,
      `Model: ${String(o.model).toLowerCase()}`,
      `Task: ${String(o.task).toLowerCase()}`,
      `Categorical parameter: ${yes(o.categorical)}`,
      `Constraints: ${cons.length ? cons.map((k) => k.replace('_constraint', '')).join(', ') : 'none'}`,
      `Custom threshold: ${yes(o.custom_threshold)}`,
      `Existing data: ${yes(o.existing_data)}`,
      `Synchrony: ${String(o.synchrony).toLowerCase()}`,
    ];
    $('chips').innerHTML = items.map((t) => `<li>${esc(t)}</li>`).join('');
  } catch {
    /* keep the static list */
  }
}

$('codePre').addEventListener('click', () => {
  if (String(window.getSelection())) return; // selecting text should not navigate
  window.open($('colab').href, '_blank', 'noopener');
});

$('copy').addEventListener('click', async () => {
  const status = $('copyStatus');
  try {
    await navigator.clipboard.writeText(scriptText);
    status.textContent = 'Copied to the clipboard.';
  } catch {
    const range = document.createRange();
    range.selectNodeContents($('code'));
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    status.textContent = 'Selected. Press Ctrl+C (or ⌘C) to copy.';
  }
  setTimeout(() => (status.textContent = ''), 4000);
});

loadScript();
loadStatus();
loadOptions();
