// Problem registry.
//
// A problem DEFINITION is a plain object:
//   id, title, summary, story          text shown in the app
//   kind                               'lab' or 'benchmark'
//   dims?                              { min, max, default } if the number of inputs is adjustable
//   defaultBudget?(dim)                suggested number of evaluations
//   maxBudget?                         upper end of the budget slider (default: max(30, 3 x default budget), at most 200)
//   axPage?                            relative link to a "Take it to Ax" page for this problem
//   create({ dim }) -> instance
//
// An INSTANCE returned by create() has:
//   inputs     [{ name, min, max, unit?, scale? }]   scale is 'linear' (default) or 'log1p'
//   objective  { name }
//   evaluate   (x: number[]) => number               the black box. Lower is better.
//   optimum?   { x?: number[], y: number }           shown as a reference when known
//   visual?    { targetColor, colorOf(x),            optional, used by lab problems
//                trialName?, describe?(x),           e.g. 'Mix' and '1 ml dye + 4.0 ml water'
//                volumeOf?(x), maxVolume? }          fill level of the beaker drawing
//
// To add a problem, create a file in this folder and add it to PROBLEMS below.
// See docs/adding-a-problem.md.

import dilution from './dilution.js';
import ackley from './ackley.js';

export const PROBLEMS = [dilution, ackley];

export function getProblem(id) {
  const p = PROBLEMS.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown problem: ${id}`);
  return p;
}

/** Builds a runnable instance of a problem definition. */
export function instantiate(def, opts = {}) {
  const dim = def.dims ? Math.max(def.dims.min, Math.min(def.dims.max, opts.dim ?? def.dims.default)) : undefined;
  const p = def.create({ dim });
  return { id: def.id, title: def.title, kind: def.kind, dim: p.inputs.length, ...p };
}

/** Returns a list of problems found with a definition. An empty list means it follows the interface. */
export function validateDefinition(def) {
  const errors = [];
  for (const key of ['id', 'title', 'summary', 'story']) {
    if (typeof def[key] !== 'string' || !def[key]) errors.push(`missing text field: ${key}`);
  }
  if (!['lab', 'benchmark'].includes(def.kind)) errors.push(`kind must be 'lab' or 'benchmark'`);
  if (def.axPage !== undefined && (typeof def.axPage !== 'string' || /^(\/|[a-z]+:)/i.test(def.axPage))) {
    errors.push('axPage must be a relative path such as ax/my-problem.html');
  }
  if (def.maxBudget !== undefined && !(Number.isInteger(def.maxBudget) && def.maxBudget >= 3)) {
    errors.push('maxBudget must be an integer of at least 3');
  }
  if (typeof def.create !== 'function') {
    errors.push('create must be a function');
    return errors;
  }
  let inst;
  try {
    inst = instantiate(def);
  } catch (e) {
    errors.push(`create threw: ${e.message}`);
    return errors;
  }
  if (!Array.isArray(inst.inputs) || inst.inputs.length === 0) errors.push('inputs must be a non-empty array');
  else {
    inst.inputs.forEach((inp, i) => {
      if (typeof inp.name !== 'string') errors.push(`inputs[${i}].name must be a string`);
      if (!(inp.max > inp.min)) errors.push(`inputs[${i}] needs max greater than min`);
      if (inp.scale && !['linear', 'log1p'].includes(inp.scale)) errors.push(`inputs[${i}].scale is not supported`);
    });
  }
  if (typeof inst.evaluate !== 'function') errors.push('evaluate must be a function');
  else if (Array.isArray(inst.inputs) && inst.inputs.length) {
    const mid = inst.inputs.map((inp) => (inp.min + inp.max) / 2);
    if (!Number.isFinite(inst.evaluate(mid))) errors.push('evaluate must return a finite number at the center of the domain');
  }
  if (inst.optimum && !Number.isFinite(inst.optimum.y)) errors.push('optimum.y must be a number');
  return errors;
}
