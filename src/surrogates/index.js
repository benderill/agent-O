// Surrogate model registry.
//
// A surrogate is an object { id, label, description, fit(X, y, opts) }.
// fit returns a model with predict(Xq) -> { mean: number[], std: number[] }.
// Inputs X and Xq are points in the unit cube [0, 1]^d. See docs/adding-a-surrogate.md.
//
// The special surrogate { random: true } has no model. The optimizer proposes uniformly random points.

import { createGP } from './gp.js';

export const SURROGATES = [
  createGP({
    id: 'gp-rbf',
    label: 'Gaussian process (RBF)',
    kernel: 'rbf',
    description: 'Assumes the objective is very smooth. Fast to learn from a few points, but can be overconfident on rough functions.',
  }),
  createGP({
    id: 'gp-matern',
    label: 'Gaussian process (Matérn 5/2)',
    kernel: 'matern52',
    description: 'Allows rougher curves than the RBF kernel. A common default for real experiments.',
  }),
  {
    id: 'random',
    label: 'No model (random search)',
    random: true,
    description: 'Picks every new point at random. This is the baseline any model-based method should beat.',
  },
];

export function getSurrogate(id) {
  const s = SURROGATES.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown surrogate: ${id}`);
  return s;
}
