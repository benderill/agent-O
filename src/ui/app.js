// Wires the page to the engine. Everything the user sees is derived from `state`.
// Problems, surrogates and acquisition functions come from their registries, so adding one needs no change here.

import { PROBLEMS, instantiate } from '../problems/index.js';
import { SURROGATES, getSurrogate } from '../surrogates/index.js';
import { ACQUISITIONS, getAcquisition, defaultParams } from '../acquisition/index.js';
import { Optimizer, randomSearch, gridPoints } from '../optimizer.js';
import { fromUnit } from '../core/space.js';
import * as plots from './plots.js';

const $ = (id) => document.getElementById(id);

const state = {
  def: PROBLEMS[0],
  dim: null,
  problem: null,
  opt: null,
  baseline: [],
  surrogate: 'gp-matern',
  acquisition: 'ei',
  params: defaultParams(getAcquisition('ei')),
  budget: 8,
  seed: 1,
  showTruth: false,
  running: false,
  timer: null,
  cache: {},
};

function fmtNum(v) {
  if (!Number.isFinite(v)) return '-';
  const a = Math.abs(v);
  if (a >= 100) return v.toFixed(1);
  if (a >= 1) return v.toFixed(2);
  return v.toFixed(3);
}

const inputLabel = (inp) => (inp.unit ? `${inp.name} (${inp.unit})` : inp.name);

// ---------- Setup ----------

function buildCatalog() {
  const c = $('catalog');
  c.innerHTML = '';
  for (const def of PROBLEMS) {
    const a = document.createElement('a');
    a.href = `?problem=${encodeURIComponent(def.id)}`;
    a.dataset.id = def.id;
    const n = def.dims ? `${def.dims.min} to ${def.dims.max} inputs` : `${instantiate(def).dim} input`;
    a.innerHTML = `<span>${def.title}</span><span class="m">${n}</span>`;
    c.append(a);
  }
}

function syncCatalog() {
  for (const a of $('catalog').children) {
    if (a.dataset.id === state.def.id) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
}

/** Keeps the address bar in step with the problem and dimension, so a link reopens the same setup. */
function syncUrl() {
  const q = new URLSearchParams();
  if (state.def !== PROBLEMS[0]) q.set('problem', state.def.id);
  if (state.def.dims && state.dim !== state.def.dims.default) q.set('dim', String(state.dim));
  const qs = q.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

const trialName = () => (state.problem && state.problem.visual && state.problem.visual.trialName) || 'Evaluation';
const plural = (w) => w.toLowerCase() + (w.endsWith('x') ? 'es' : 's');

function buildStrategyControls() {
  $('surrogate').innerHTML = SURROGATES.map((s) => `<option value="${s.id}">${s.label}</option>`).join('');
  $('acquisition').innerHTML = ACQUISITIONS.map((a) => `<option value="${a.id}">${a.label}</option>`).join('');
  $('surrogate').value = state.surrogate;
  $('acquisition').value = state.acquisition;
  renderParams();
}

function renderParams() {
  const acq = getAcquisition(state.acquisition);
  const box = $('acqParams');
  box.innerHTML = '';
  const isRandom = getSurrogate(state.surrogate).random;
  for (const p of acq.params) {
    const f = document.createElement('div');
    f.className = 'field';
    const val = state.params[p.id];
    const label = p.label.replace(/[Ͱ-Ͽ]/g, (g) => `<span class="greek">${g}</span>`);
    f.innerHTML = `<label for="param-${p.id}"><span>${label}</span><span class="val" id="paramVal-${p.id}">${Number(val).toFixed(p.step < 0.1 ? 2 : 1)}</span></label>
      <input id="param-${p.id}" type="range" min="${p.min}" max="${p.max}" step="${p.step}" value="${val}" ${isRandom ? 'disabled' : ''}>`;
    box.append(f);
    f.querySelector('input').addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      state.params[p.id] = v;
      $(`paramVal-${p.id}`).textContent = v.toFixed(p.step < 0.1 ? 2 : 1);
      state.opt.setStrategy({ params: { [p.id]: v } });
      render();
    });
  }
  $('acquisition').disabled = isRandom;
  const note = isRandom
    ? getSurrogate(state.surrogate).description
    : `${getSurrogate(state.surrogate).description} ${acq.description}`;
  $('strategyNote').textContent = note;
}

function selectProblem(def, dim) {
  state.def = def;
  state.dim = def.dims ? Math.max(def.dims.min, Math.min(def.dims.max, dim ?? def.dims.default)) : null;
  syncCatalog();
  const adjustable = Boolean(def.dims);
  $('dimField').hidden = !adjustable;
  if (adjustable) {
    $('dim').min = def.dims.min;
    $('dim').max = def.dims.max;
    $('dim').value = state.dim;
    $('dimVal').textContent = state.dim;
  }
  rebuildProblem();
}

function rebuildProblem() {
  state.problem = instantiate(state.def, { dim: state.dim ?? undefined });
  state.cache = {};
  state.budget = state.def.defaultBudget ? state.def.defaultBudget(state.problem.dim) : 20;
  const maxB = state.def.maxBudget ?? Math.min(200, Math.max(30, 3 * state.budget));
  $('budget').max = maxB;
  $('budget').value = state.budget;
  $('budgetVal').textContent = state.budget;
  $('budgetLabel').textContent = `${trialName()} budget`;
  $('pTitle').textContent = state.def.title;
  $('crumb').textContent = state.def.title;
  document.title = `${state.def.title} · Optimization Live`;
  $('pStory').textContent = state.def.story;
  const lab = Boolean(state.problem.visual);
  $('hLab').textContent = lab ? 'The lab' : 'Result';
  $('beaker').hidden = !lab || !state.problem.visual.volumeOf;
  $('swatches').hidden = !lab;
  $('axCta').hidden = !state.def.axPage;
  if (state.def.axPage) $('axLink').href = state.def.axPage;
  const d = state.problem.dim;
  const cols = [trialName(), ...(d <= 3 ? state.problem.inputs.map(inputLabel) : ['Inputs']), state.problem.objective.name, 'Picked by'];
  document.querySelector('#log thead tr').innerHTML = cols.map((c) => `<th scope="col">${c}</th>`).join('');
  syncUrl();
  rebuildViews();
  resetRun();
}

function resetRun() {
  stopRun();
  state.opt = new Optimizer({
    problem: state.problem,
    surrogate: state.surrogate,
    acquisition: state.acquisition,
    params: state.params,
    budget: state.budget,
    seed: state.seed,
  });
  state.baseline = randomSearch(state.problem, state.budget, state.seed);
  render();
}

function block(title, id) {
  const w = document.createElement('div');
  const s = document.createElement('div');
  s.className = 'sub';
  s.textContent = title;
  const c = document.createElement('canvas');
  c.id = id;
  w.append(s, c);
  return w;
}

function rebuildViews() {
  const v = $('views');
  v.innerHTML = '';
  const d = state.problem.dim;
  const inp0 = state.problem.inputs[0];
  $('hModel').textContent = d === 1
    ? `What the model believes (${inp0.unit ? `${inp0.name.toLowerCase()} in ${inp0.unit}` : inp0.name}, ${inp0.min} to ${inp0.max})`
    : d === 2 ? 'What the model believes' : 'What the optimizer sees';
  const verb = state.problem.visual ? trialName().toLowerCase() : 'evaluate';
  if (d === 1) {
    const legend = document.createElement('div');
    legend.className = 'legend';
    legend.innerHTML = `<span><i class="sw"></i>Model's guess</span><span><i class="sw band"></i>Uncertainty (±2σ)</span>
      <span><i class="sw dot"></i>Evaluations so far</span><span><i class="sw dash"></i>True function</span><span><i class="sw pickl"></i>Next pick</span>`;
    const what = state.problem.visual ? 'Color difference' : state.problem.objective.name;
    v.append(legend, block(`${what}, lower is better`, 'vBelief'), block(`Acquisition: where to ${verb} next (higher is more attractive)`, 'vAcq'));
  } else if (d === 2) {
    const legend = document.createElement('div');
    legend.className = 'legend';
    legend.innerHTML = `<span>Lowest values stand out in color, high values fade into the background</span><span>Dots: evaluations so far</span><span>Cross: next pick</span>`;
    const g = document.createElement('div');
    g.className = 'grid3';
    g.append(block('True function', 'vTrue'), block('Model mean', 'vMean'), block('Acquisition score', 'vScore'));
    v.append(legend, g);
  } else {
    const p = document.createElement('p');
    p.className = 'note';
    p.textContent = `With ${d} inputs the landscape cannot be drawn. Watch the progress plot and the evaluation log instead. Compare how far each strategy gets with the same budget.`;
    v.append(p);
  }
}

// ---------- Rendering ----------

function nextPick() {
  const opt = state.opt;
  if (opt.done || opt.surrogate.random || opt.history.length < opt.nInit || !opt.model()) return null;
  return opt.propose();
}

function renderStats() {
  const { opt, problem, baseline } = state;
  const n = opt.history.length;
  $('sEvals').textContent = `${n} of ${opt.budget} ${plural(trialName())}`;
  $('sBest').textContent = opt.best ? fmtNum(opt.best.y) : '-';
  $('sOpt').textContent = problem.optimum ? fmtNum(problem.optimum.y) : 'unknown';
  $('sRand').textContent = n > 0 && baseline[n - 1] != null ? fmtNum(baseline[n - 1]) : '-';
}

function renderViews() {
  const { problem, opt } = state;
  const d = problem.dim;
  if (d === 1) {
    if (!state.cache.c1) {
      const U = gridPoints(1, 401);
      const xs = U.map((u) => fromUnit(problem, u)[0]);
      const truth = xs.map((x) => problem.evaluate([x]));
      const lo = Math.min(...truth);
      const hi = Math.max(...truth);
      const pad = (hi - lo) * 0.04 || 1;
      state.cache.c1 = { U, xs, truth, yr: [lo - pad, hi + pad], xr: [problem.inputs[0].min, problem.inputs[0].max] };
    }
    const c = state.cache.c1;
    const a = opt.analyze(c.U);
    const pick = nextPick();
    plots.drawCurve1D($('vBelief'), {
      xr: c.xr, yr: c.yr, xs: c.xs,
      mean: a ? a.mean : null, std: a ? a.std : null,
      truth: c.truth, showTruth: state.showTruth,
      pts: opt.history.map((h) => ({ x: h.x[0], y: h.y })),
      pickX: pick ? fromUnit(problem, pick.u)[0] : null,
      xTitle: inputLabel(problem.inputs[0]), yTitle: problem.objective.name,
    });
    plots.drawAcq1D($('vAcq'), {
      xs: c.xs, score: a ? a.score : null,
      pickIndex: pick ? Math.round(pick.u[0] * 400) : null,
      xr: c.xr, xTitle: inputLabel(problem.inputs[0]),
    });
  } else if (d === 2) {
    const n = 40;
    if (!state.cache.c2) state.cache.c2 = { U: gridPoints(2, n) };
    const c = state.cache.c2;
    if (state.showTruth && !c.truth) c.truth = c.U.map((u) => problem.evaluate(fromUnit(problem, u)));
    const a = opt.analyze(c.U);
    const pts = opt.history.map((h) => h.u);
    const pick = nextPick();
    const i0 = problem.inputs[0];
    const i1 = problem.inputs[1];
    const common = { n, pts, pickU: pick ? pick.u : null, xr: [i0.min, i0.max], yr: [i1.min, i1.max], xTitle: inputLabel(i0), yTitle: inputLabel(i1) };
    plots.drawHeat($('vTrue'), { ...common, values: state.showTruth ? c.truth : null, lowIsGood: true, message: 'Hidden. Tick "Show the true function".' });
    plots.drawHeat($('vMean'), {
      ...common, values: a ? a.mean : null, lowIsGood: true,
      message: opt.surrogate.random ? 'Random search has no model.' : 'Needs at least 2 evaluations.',
    });
    plots.drawHeat($('vScore'), {
      ...common, values: a ? a.score : null, lowIsGood: false,
      message: opt.surrogate.random ? 'Random search has no score.' : 'Needs at least 2 evaluations.',
    });
  }
}

function renderConvergence() {
  const { opt, problem, baseline } = state;
  const res = plots.drawConvergence($('conv'), {
    series: [
      { values: opt.bestSoFar(), color: '--accent' },
      { values: baseline.slice(0, opt.history.length), color: '--pick', dash: true },
    ],
    budget: opt.budget,
    optimumY: problem.optimum ? problem.optimum.y : null,
    yTitle: `Best ${problem.objective.name} so far`,
    xTitle: `${trialName()} number`,
  });
  const logY = Boolean(res && res.logY);
  $('legOpt').hidden = logY || !problem.optimum;
  $('logNote').textContent = logY && problem.optimum ? `. Log scale, so the best possible (${fmtNum(problem.optimum.y)}) is off the bottom.` : '';
}

const fmtX = (x) => x.slice(0, 4).map((v) => v.toFixed(2)).join(', ') + (x.length > 4 ? ', …' : '');

function renderLab() {
  const { problem, opt } = state;
  const vis = problem.visual;
  const last = opt.history[opt.history.length - 1];
  const best = opt.best;
  const obj = problem.objective.name;
  const t = trialName();
  if (!last) {
    $('labLine1').textContent = `No ${plural(t)} yet.`;
    $('labLine2').textContent = 'Press Step for one at a time, or Run to use the whole budget.';
    $('labLine3').textContent = '';
  } else if (vis) {
    const desc = vis.describe ? vis.describe(last.x) : fmtX(last.x);
    $('labLine1').textContent = `${t} ${last.iter}: ${desc}`;
    $('labLine2').innerHTML = `Camera reads a color difference (${obj}) of <b>${fmtNum(last.y)}</b> from target`;
    $('labLine3').textContent = `Best so far: ${obj} ${fmtNum(best.y)} (${t.toLowerCase()} ${best.iter}: ${vis.describe ? vis.describe(best.x) : fmtX(best.x)})`;
  } else {
    $('labLine1').textContent = `${t} ${last.iter}: x = (${fmtX(last.x)})`;
    $('labLine2').innerHTML = `${obj} = <b>${fmtNum(last.y)}</b>`;
    $('labLine3').textContent = `Best so far: ${fmtNum(best.y)} at (${fmtX(best.x)})`;
  }
  if (!vis) return;
  $('labTarget').style.background = vis.targetColor;
  $('labThis').style.background = last ? vis.colorOf(last.x) : '';
  $('labThis').classList.toggle('empty', !last);
  $('labThisCap').textContent = `This ${t.toLowerCase()}`;
  if (vis.volumeOf) {
    const vol = last ? vis.volumeOf(last.x) : 0;
    const max = vis.maxVolume || vol || 1;
    $('liquid').style.height = `${Math.max(0, Math.min(1, vol / max)) * 100}%`;
    $('liquid').style.background = last ? vis.colorOf(last.x) : 'transparent';
    $('beakerVol').textContent = last ? `${vol.toFixed(1)} ml` : 'empty';
    $('beaker').setAttribute('aria-label', last ? `Beaker holding ${vol.toFixed(1)} ml of the latest mix` : 'Empty beaker');
  }
}

function renderLog() {
  const { opt, problem } = state;
  const best = opt.best;
  const d = problem.dim;
  const SRC = { init: 'start design', model: 'model', random: 'random' };
  const rows = opt.history.map((h) => {
    const xs = d <= 3 ? h.x.map((v) => `<td>${v.toFixed(d === 1 ? 1 : 2)}</td>`).join('') : `<td>${fmtX(h.x)}</td>`;
    return `<tr class="${h === best ? 'best' : ''}"><td>${h.iter}</td>${xs}<td>${fmtNum(h.y)}</td><td class="src">${SRC[h.source] || h.source}</td></tr>`;
  });
  const cols = (d <= 3 ? d : 1) + 3;
  document.querySelector('#log tbody').innerHTML = rows.join('') || `<tr><td colspan="${cols}">No ${plural(trialName())} yet.</td></tr>`;
  const wrap = document.querySelector('#log').parentElement;
  wrap.scrollTop = wrap.scrollHeight;
}

function renderButtons() {
  const done = state.opt ? state.opt.done : true;
  $('step').disabled = done;
  $('run').textContent = state.running ? 'Pause' : 'Run';
  $('run').disabled = done && !state.running;
}

function render() {
  renderStats();
  renderViews();
  renderConvergence();
  renderLab();
  renderLog();
  renderButtons();
}

// ---------- Running ----------

function stopRun() {
  state.running = false;
  clearTimeout(state.timer);
  if (state.opt) renderButtons();
}

function tick() {
  if (!state.running) return;
  if (state.opt.done) {
    stopRun();
    return;
  }
  state.opt.step();
  if (state.opt.done) state.running = false;
  render();
  if (state.running) state.timer = setTimeout(tick, 140);
}

function toggleRun() {
  if (state.running) {
    stopRun();
    return;
  }
  if (state.opt.done) return;
  state.running = true;
  tick();
}

// ---------- Events ----------

$('catalog').addEventListener('click', (e) => {
  const a = e.target.closest ? e.target.closest('a[data-id]') : null;
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  e.preventDefault();
  const def = PROBLEMS.find((p) => p.id === a.dataset.id);
  if (def && def !== state.def) selectProblem(def);
});

$('dim').addEventListener('input', (e) => {
  state.dim = Number(e.target.value);
  $('dimVal').textContent = state.dim;
  rebuildProblem();
});

$('surrogate').addEventListener('change', (e) => {
  state.surrogate = e.target.value;
  state.opt.setStrategy({ surrogate: state.surrogate });
  renderParams();
  render();
});

$('acquisition').addEventListener('change', (e) => {
  state.acquisition = e.target.value;
  state.params = defaultParams(getAcquisition(state.acquisition));
  state.opt.setStrategy({ acquisition: state.acquisition, params: state.params });
  renderParams();
  render();
});

$('budget').addEventListener('input', (e) => {
  const v = Math.max(3, Math.min(200, Math.round(Number(e.target.value) || state.budget)));
  state.budget = v;
  $('budgetVal').textContent = v;
  state.opt.budget = v;
  if (state.opt.done) stopRun();
  state.baseline = randomSearch(state.problem, v, state.seed);
  render();
});

$('seed').addEventListener('change', (e) => {
  state.seed = Math.max(0, Math.round(Number(e.target.value) || 0));
  e.target.value = state.seed;
  resetRun();
});

$('newSeed').addEventListener('click', () => {
  state.seed = 1 + Math.floor(Math.random() * 9999);
  $('seed').value = state.seed;
  resetRun();
});

$('showTruth').addEventListener('change', (e) => {
  state.showTruth = e.target.checked;
  render();
});

$('step').addEventListener('click', () => {
  state.opt.step();
  render();
});
$('run').addEventListener('click', () => {
  toggleRun();
  renderButtons();
});
$('reset').addEventListener('click', resetRun);

let frame = null;
const redraw = () => {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = null;
    render();
  });
};
window.addEventListener('resize', redraw);
if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redraw);

// ---------- Start ----------

buildCatalog();
buildStrategyControls();
{
  const q = new URLSearchParams(location.search);
  const def = PROBLEMS.find((p) => p.id === q.get('problem')) || PROBLEMS[0];
  const dim = q.has('dim') ? Number(q.get('dim')) : undefined;
  selectProblem(def, Number.isFinite(dim) ? dim : undefined);
}
