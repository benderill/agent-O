# Adding an acquisition function

An acquisition function turns the surrogate's predictions into a score for every candidate point. The point with the highest score is evaluated next.

## The interface

```js
{
  id: 'my-rule',
  label: 'My rule',
  description: 'One or two sentences for newcomers.',
  params: [                      // sliders the UI builds for you; use [] for none
    { id: 'beta', label: 'Exploration β', min: 0, max: 4, step: 0.1, default: 1 },
  ],
  score({ mean, std, best, scale, params }) {
    return mean.map((m, i) => /* a number, higher is better */);
  },
}
```

The argument to `score` has:

| Field | Meaning |
| --- | --- |
| `mean`, `std` | Arrays with the surrogate's prediction and uncertainty at each candidate. |
| `best` | The lowest value observed so far. |
| `scale` | The standard deviation of the observed values. Multiply exploration settings by it so they mean the same thing on every problem. |
| `params` | Current slider values, keyed by `id`. |

All problems are minimized, so a low `mean` is good. Return scores where **higher is better**.

## Example: greedy exploitation

This rule ignores uncertainty entirely. It is useful as a baseline that shows what goes wrong without exploration.

```js
export const greedy = {
  id: 'greedy',
  label: 'Greedy (exploit only)',
  description: 'Always picks the point the model thinks is best, ignoring uncertainty. Prone to getting stuck.',
  params: [],
  score: ({ mean }) => mean.map((m) => -m),
};
```

Add it to the list at the bottom of `src/acquisition/index.js`:

```js
export const ACQUISITIONS = [expectedImprovement, probabilityOfImprovement, upperConfidenceBound, greedy];
```

The menu, the slider area (empty when there are no params), the score plots and the run controls all work without further changes.

## Test it

`tests/surrogate-acquisition.test.js` already checks that every registered function has a label, a description and complete parameter definitions. Add a test for behavior specific to your function, such as how its scores change with `std`.
