# Architecture

## Data flow

```
 problem definition          registries                     optimizer                    browser
┌──────────────────┐   ┌─────────────────────┐   ┌───────────────────────────┐   ┌──────────────────┐
│ src/problems/*   │   │ surrogates/index.js │   │ src/optimizer.js          │   │ src/ui/app.js    │
│ inputs, evaluate │──▶│ acquisition/index.js│──▶│ initial design (Latin     │──▶│ reads state,     │
│ optimum, visual  │   │ problems/index.js   │   │ hypercube), then loop:    │   │ draws with       │
└──────────────────┘   └─────────────────────┘   │ fit → score → pick → eval │   │ src/ui/plots.js  │
                                                 └───────────────────────────┘   └──────────────────┘
```

1. A **problem** describes its inputs (name, range, optional log scaling) and a black-box `evaluate(x)` that returns a number to minimize.
2. The **optimizer** converts inputs to the unit cube, evaluates a space-filling initial design, then repeats: fit the surrogate, score candidate points with the acquisition function, evaluate the best candidate, and record it.
3. The **UI** holds one `state` object and redraws everything from it. It never reaches into the engine's internals beyond the public methods listed below.

## The optimizer

`src/optimizer.js` exports:

- `Optimizer`: `step()`, `runToBudget()`, `setStrategy({ surrogate, acquisition, params })`, `analyze(U)`, `propose()`, and the read-only `history`, `best`, `bestSoFar()`, `done`.
- `randomSearch(problem, budget, seed)`: the baseline curve every run is compared with.
- `latinHypercube`, `gridPoints`, `candidateSet`: point generators.

Design decisions worth knowing:

- **Unit cube.** Surrogates see inputs in `[0, 1]^d`. An input with `scale: 'log1p'` is spaced by `log(1 + value - min)`, which suits quantities that act multiplicatively such as dilution. The surrogate then sees a smoother function.
- **Candidates, not gradients.** The acquisition function is evaluated at a set of candidate points: a dense grid for 1 or 2 inputs, and random points plus perturbations of the current best for more inputs. This is simple and works for any problem, at the cost of precision in high dimensions.
- **`propose()` is a pure preview.** It depends only on the history and the seed, so the UI can show "next pick" on every redraw without changing the run.
- **Switching strategy mid-run keeps the history.** `setStrategy` only clears the cached model.
- **Observed values include noise.** When `noise > 0`, the optimizer adds Gaussian noise to each evaluation and tells the surrogate the noise level.

## Surrogates

A surrogate has `fit(X, y, opts)` and returns a model with `predict(Xq)` giving `{ mean, std }` in the units of `y`. The Gaussian process in `src/surrogates/gp.js` standardizes `y`, picks a length scale from a small grid by marginal likelihood, and supports several kernels. A surrogate with `random: true` has no model and makes the optimizer pick random points.

## Acquisition functions

An acquisition function scores candidates from the surrogate's `mean` and `std`, the best value so far, and its own parameters. Higher scores are better. Its `params` array describes its sliders, and the UI builds the controls from that.

## The UI

- `src/ui/app.js` builds menus from the registries, owns `state`, and calls `render()` after any change. It adapts the views to the number of inputs: a curve for 1, heatmaps for 2, and progress plus a log beyond that.
- `src/ui/plots.js` contains drawing functions that take data and return nothing. Colors are read from the CSS tokens in `css/style.css`.
- Lab problems can supply a `visual` hook (`targetColor`, `colorOf(x)`). When present, the UI shows the target and mixed colors.

## Pages

- `index.html` is the workspace. It opens the dilution problem by default. `?problem=<id>&dim=<n>` opens another one, and the address bar follows the choice.
- `ax/<problem>.html` are "Take it to Ax" pages. `src/ui/ax-page.js` loads the script, run status and Honegumi options from files next to the page, so the page never shows code or results that were not generated. `scripts/build_ax.py` writes those files from Honegumi's output and executes the notebook.
- All URLs are relative, so the site works from a subpath such as GitHub Pages' `/<repository>/`. `tests/site.test.js` checks this, and `npm run check` serves the site under `/agent-O/` in a headless browser.

## Lessons

`lessons/` holds standalone pages. They duplicate a small amount of the engine so each page works on its own. They could be refactored to import from `src/`.

## Tests

`tests/site.test.js` checks the HTML pages: relative links, files that exist, one repository for GitHub and Colab links, and that the Ax script is Honegumi output plus marked edits. `tests/python/` checks that the Python port of the color model matches the browser's, through `tests/fixtures/color-model.json`.


`tests/` exercises the engine in Node: numerical helpers, the Gaussian process, the acquisition functions, the problem registry, and the optimizer end to end (including that Bayesian optimization beats random search on the included problems with fixed seeds).
