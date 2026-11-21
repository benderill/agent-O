# Adding a problem

A problem is a small file in `src/problems/` that describes a black-box function. The app picks it up from the registry.

## 1. Write the file

Create `src/problems/sphere.js`. This example is a simple bowl, with its minimum shifted away from the center of the domain.

```js
export default {
  id: 'sphere',                       // unique, used in code
  title: 'Shifted sphere',            // shown in the app
  kind: 'benchmark',                  // 'lab' or 'benchmark'
  summary: 'A smooth bowl with one minimum.',
  story: 'The easiest landscape there is. Every strategy should do well here.',
  dims: { min: 1, max: 10, default: 2 },       // omit if the number of inputs is fixed
  defaultBudget: (dim) => 8 + 4 * dim,         // optional suggested budget

  create({ dim = 2 } = {}) {
    const inputs = Array.from({ length: dim }, (_, i) => ({ name: `x${i + 1}`, min: -5, max: 5 }));
    const center = inputs.map((_, i) => 1.3 * Math.sin(i + 1));
    return {
      inputs,
      objective: { name: 'f(x)' },
      evaluate: (x) => x.reduce((s, v, i) => s + (v - center[i]) ** 2, 0),
      optimum: { x: center, y: 0 },
    };
  },
};
```

## 2. Register it

In `src/problems/index.js`, import it and add it to the list:

```js
import sphere from './sphere.js';
export const PROBLEMS = [dilution, ackley, sphere];
```

That is all the UI needs. The catalog, the dimension slider, the plots and the comparison with random search all appear automatically.

## 3. Test it

Run `npm test`. The existing tests check that every registered problem follows the interface (`validateDefinition`) and that it reaches its declared optimum at the declared point.

## The interface

A definition has:

| Field | Meaning |
| --- | --- |
| `id`, `title`, `summary`, `story` | Text. `story` explains the problem to a newcomer. |
| `kind` | `'lab'` for a physical-style problem, `'benchmark'` for a math function. |
| `dims` | Optional `{ min, max, default }` when the number of inputs can be changed. |
| `defaultBudget(dim)` | Optional. Suggested number of evaluations. |
| `maxBudget` | Optional. Upper end of the budget slider. Default: 3 times the default budget, between 30 and 200. |
| `axPage` | Optional. Relative link to a "Take it to Ax" page, such as `ax/dilution.html`. The workspace then shows a "Take it to Ax" button. See `scripts/build_ax.py` for how the dilution page's notebook is built. |
| `create({ dim })` | Returns an instance. |

An instance has:

| Field | Meaning |
| --- | --- |
| `inputs` | `[{ name, min, max, unit?, scale? }]`. `scale` is `'linear'` (default) or `'log1p'`. |
| `objective` | `{ name }`, used as the axis label. |
| `evaluate(x)` | Takes an array in real units and returns a number. **Lower is better.** |
| `optimum` | Optional `{ x?, y }`. Shown as a reference and used by the tests. |
| `visual` | Optional, for lab problems that show colors: `{ targetColor, colorOf(x) }`, plus optional `trialName` (for example `'Mix'`), `describe(x)` (for example `'1 ml dye + 4.0 ml water'`), and `volumeOf(x)` with `maxVolume` for the beaker drawing. |

## Tips

- **Do not put the optimum at the center of the domain.** The 1-D and 2-D candidate grids contain the center, so a centered optimum is found by geometry. Ackley is shifted for this reason.
- **Use `scale: 'log1p'`** for inputs that act multiplicatively, like concentrations and dilutions.
- **Keep `evaluate` fast.** The UI evaluates it on a grid to draw the true function.
- **Higher-dimensional lab problems** (several dyes, for example) can follow `dilution.js` and reuse `color-model.js`.
