// Bayesian optimization against random search over many seeds, so claims on the site rest on medians, not one lucky run.
//   node scripts/benchmark.mjs                       dilution, budget 8, seeds 1-10, default strategy
//   node scripts/benchmark.mjs ackley 2 26 20        problem, dimension, budget, number of seeds
// Prints a Markdown table row set that can be pasted into docs.

import { getProblem, instantiate } from '../src/problems/index.js';
import { Optimizer, randomSearch } from '../src/optimizer.js';

const [id = 'dilution', dimArg, budgetArg, seedsArg] = process.argv.slice(2);
const def = getProblem(id);
const problem = instantiate(def, { dim: dimArg ? Number(dimArg) : undefined });
const budget = budgetArg ? Number(budgetArg) : def.defaultBudget ? def.defaultBudget(problem.dim) : 20;
const seeds = seedsArg ? Number(seedsArg) : 10;
const strategies = [
  ['gp-matern', 'ei'],
  ['gp-rbf', 'ei'],
  ['gp-matern', 'ucb'],
];

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

console.log(`${def.title}, ${problem.dim} input(s), budget ${budget}, seeds 1-${seeds}: median best value (lower is better)\n`);
console.log('| Strategy | Median best | Seeds where it beat random |');
console.log('| --- | --- | --- |');
const rnd = [];
for (let s = 1; s <= seeds; s++) rnd.push(randomSearch(problem, budget, s).at(-1));
for (const [surrogate, acquisition] of strategies) {
  const bests = [];
  let wins = 0;
  for (let s = 1; s <= seeds; s++) {
    const opt = new Optimizer({ problem, surrogate, acquisition, budget, seed: s });
    opt.runToBudget();
    bests.push(opt.best.y);
    if (opt.best.y < rnd[s - 1]) wins++;
  }
  console.log(`| ${surrogate} + ${acquisition} | ${median(bests).toFixed(3)} | ${wins} of ${seeds} |`);
}
console.log(`| random search | ${median(rnd).toFixed(3)} | - |`);
