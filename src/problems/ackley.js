// Benchmark problem: the Ackley function.
// An almost flat outer region with many small dents (local minima) around one deep hole.
// Greedy strategies get trapped in the dents. The number of inputs is adjustable.
//
// The domain is [-5, 5] on every axis (the textbook domain of [-32.768, 32.768] is almost flat and
// too hard for small budgets). The textbook minimum sits at the origin, which is also the exact center of
// the domain. Candidate grids contain the center, so a centered optimum would be found by geometry rather
// than by search. The function is therefore shifted: the global minimum f = 0 is at x_i = SHIFT(i).

/** Offset of the optimum along axis i, deterministic and away from any grid point. */
export const shiftOf = (i) => 3.1 * Math.sin(1.7 * (i + 1));

export default {
  id: 'ackley',
  title: 'Ackley function',
  kind: 'benchmark',
  summary: 'Many local minima around one deep global minimum. Choose how many inputs.',
  story:
    'A standard test function. The surface is covered in small dents, with one deep hole somewhere in the domain. A strategy that only exploits will settle in the first dent it finds. Try raising the number of inputs and watch how the problem gets harder.',
  dims: { min: 1, max: 20, default: 2 },
  defaultBudget: (dim) => Math.min(80, 10 + 8 * dim),

  create({ dim = 2 } = {}) {
    const inputs = Array.from({ length: dim }, (_, i) => ({ name: `x${i + 1}`, min: -5, max: 5, scale: 'linear' }));
    const shift = Array.from({ length: dim }, (_, i) => shiftOf(i));
    const evaluate = (x) => {
      const d = x.length;
      let sumSq = 0;
      let sumCos = 0;
      for (let i = 0; i < d; i++) {
        const v = x[i] - shift[i];
        sumSq += v * v;
        sumCos += Math.cos(2 * Math.PI * v);
      }
      return -20 * Math.exp(-0.2 * Math.sqrt(sumSq / d)) - Math.exp(sumCos / d) + 20 + Math.E;
    };
    return {
      inputs,
      objective: { name: 'f(x)' },
      evaluate,
      optimum: { x: shift, y: 0 },
    };
  },
};
