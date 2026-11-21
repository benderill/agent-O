# Adding a surrogate model

A surrogate learns from the evaluations so far and predicts a value and an uncertainty anywhere in the search space.

## The interface

```js
{
  id: 'my-model',
  label: 'My model',            // shown in the menu
  description: 'One or two sentences for newcomers.',
  fit(X, y, { noiseSd }) {      // X: number[][] in the unit cube, y: number[]
    // ...learn from the data...
    return {
      predict(Xq) {             // Xq: number[][] in the unit cube
        return { mean: [...], std: [...] };   // in the units of y; std must be > 0
      },
    };
  },
}
```

- Inputs are scaled to `[0, 1]` on every axis. You never see real units.
- `std` is the model's uncertainty about the true value. Acquisition functions rely on it, so a model without a sensible `std` will not work well.
- `noiseSd` is the standard deviation of measurement noise, in the units of `y`. Use it or ignore it.

## Easiest: a new kernel

The Gaussian process in `src/surrogates/gp.js` is built from a kernel function of the squared distance `r2` and a length scale `l`. To add a kernel, add it to `KERNELS`:

```js
const KERNELS = {
  rbf: ...,
  matern52: ...,
  // Matérn 3/2: rougher than Matérn 5/2
  matern32: (r2, l) => {
    const s = Math.sqrt(3 * r2) / l;
    return (1 + s) * Math.exp(-s);
  },
};
```

Then register a model that uses it, in `src/surrogates/index.js`:

```js
createGP({ id: 'gp-matern32', label: 'Gaussian process (Matérn 3/2)', kernel: 'matern32', description: '...' }),
```

## A different kind of model

Write any object that follows the interface and add it to `SURROGATES`. Random forests, for example, can estimate `std` from the spread of their trees. Keep the model dependency-free and fast. The app refits it after every evaluation, and it is queried at thousands of points per step in higher dimensions.

## Test it

The generic tests in `tests/surrogate-acquisition.test.js` check that every non-random surrogate reproduces its training points, is more uncertain far from data, and works in several dimensions. They run automatically for a new registry entry.
