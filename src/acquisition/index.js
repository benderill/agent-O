// Acquisition function registry.
//
// All problems are minimized, and every acquisition function returns scores where HIGHER IS BETTER.
// An acquisition function is an object:
//   { id, label, description, params: [{ id, label, min, max, step, default }], score(ctx) }
// where ctx = { mean, std, best, scale, params }:
//   mean, std  arrays from the surrogate at the candidate points
//   best       lowest value observed so far
//   scale      standard deviation of the observed values, for making exploration settings unit-free
//   params     current values of this function's parameters, keyed by id
// See docs/adding-an-acquisition-function.md.

import { normalCdf, normalPdf } from '../core/stats.js';

export const expectedImprovement = {
  id: 'ei',
  label: 'Expected improvement',
  description:
    'Scores each point by how much better than the best value so far it is expected to be. Favors points that could give a large gain.',
  params: [{ id: 'xi', label: 'Exploration ξ', min: 0, max: 0.5, step: 0.01, default: 0.01 }],
  score({ mean, std, best, scale, params }) {
    const xi = params.xi * scale;
    return mean.map((m, i) => {
      const s = std[i];
      const imp = best - m - xi;
      const z = imp / s;
      return imp * normalCdf(z) + s * normalPdf(z);
    });
  },
};

export const probabilityOfImprovement = {
  id: 'pi',
  label: 'Probability of improvement',
  description:
    'Scores each point by the chance that it beats the best value so far, however small the gain. Tends to play safe near the current best.',
  params: [{ id: 'xi', label: 'Exploration ξ', min: 0, max: 0.5, step: 0.01, default: 0.01 }],
  score({ mean, std, best, scale, params }) {
    const xi = params.xi * scale;
    return mean.map((m, i) => normalCdf((best - m - xi) / std[i]));
  },
};

export const upperConfidenceBound = {
  id: 'ucb',
  label: 'Upper confidence bound',
  description:
    'Scores each point by an optimistic guess: the predicted quality plus κ times the uncertainty. A larger κ rewards unexplored regions more.',
  params: [{ id: 'kappa', label: 'Exploration κ', min: 0, max: 4, step: 0.1, default: 2 }],
  score({ mean, std, params }) {
    return mean.map((m, i) => -m + params.kappa * std[i]);
  },
};

export const ACQUISITIONS = [expectedImprovement, probabilityOfImprovement, upperConfidenceBound];

export function getAcquisition(id) {
  const a = ACQUISITIONS.find((x) => x.id === id);
  if (!a) throw new Error(`Unknown acquisition function: ${id}`);
  return a;
}

export function defaultParams(acq) {
  return Object.fromEntries(acq.params.map((p) => [p.id, p.default]));
}
