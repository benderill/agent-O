# Optimization Live

An interactive playground for Bayesian optimization. Pick a problem, pick a surrogate model and an acquisition function, and watch the optimizer search with a small budget. Every run is compared with random search. When you are ready for real code, each lab problem has a "Take it to Ax" page with a runnable notebook generated with [Honegumi](https://honegumi.readthedocs.io/en/latest/).

Live site: <https://benderill.github.io/agent-O/> (once GitHub Pages is enabled, see below).

The problems are framed as an automated lab: a pipette adds water to blue dye, a camera reads the color, and the optimizer decides what to try next. Classic benchmark functions are included too.

It is plain JavaScript (ES modules) with no dependencies and no build step. It runs in the browser and its core also runs in Node, which is how the tests work.

## Quick start

You need Node 18 or newer.

```
git clone <this repository>
cd optimization-live
npm start      # serves the app at http://localhost:8000
npm test       # runs the test suite
```

Optional checks:

```
npm install                      # Playwright, a development tool only
npx playwright install chromium
npm run check                    # loads every page in a headless browser: errors, links, layout, controls, screenshots

python -m venv .venv
.venv/Scripts/pip install -r ax/requirements.txt      # on macOS/Linux: .venv/bin/pip
.venv/Scripts/python scripts/build_ax.py --compare 10   # regenerate and run the Ax notebook
.venv/Scripts/python -m pytest tests/python
```

The app uses ES modules, which browsers will not load from `file://` URLs, so open it through `npm start` or any static file server.

## What is inside

```
index.html            The workspace (dilution by default; ?problem=ackley&dim=3 for others)
ax/                   "Take it to Ax" pages, scripts and notebooks generated with Honegumi
  generated/          Honegumi's unedited output, kept for comparison
css/style.css         Styles and color tokens (light and dark)
src/
  optimizer.js        The Bayesian optimization loop, plus a random-search baseline
  core/               Seeded random numbers, linear algebra, statistics, input scaling
  surrogates/         Models that predict a value and an uncertainty (Gaussian processes)
  acquisition/        Rules that score where to evaluate next (EI, PI, UCB)
  problems/           The problems you can test on, one file each
  ui/                 Browser code: app.js wires the page, plots.js draws
lessons/              Standalone lesson pages
tests/                Tests, run with node:test
docs/                 Architecture notes and how-to guides
scripts/              Local server, browser checks, benchmarks, and the Ax notebook builder
```

## Problems included

| Problem | Kind | Inputs | What it shows |
| --- | --- | --- | --- |
| Dilution | Lab | 1 | Add water to 1 ml of blue dye to match a pale target. The simplest case. [Take it to Ax](ax/dilution.html). |
| Ackley function | Benchmark | 1 to 20 | Many local minima around one deep hole. Gets harder as inputs grow. |

Planned problems are listed in the roadmap below.

## Grow it

Each building block is a registry entry, so most additions touch one new file:

- [Add a problem](docs/adding-a-problem.md)
- [Add a surrogate model](docs/adding-a-surrogate.md)
- [Add an acquisition function](docs/adding-an-acquisition-function.md)
- [How the pieces fit together](docs/architecture.md)
- [Contributing](CONTRIBUTING.md)

The page builds its menus from the registries, so a new problem, surrogate or acquisition function appears in the app without editing the UI.

## Publish with GitHub Pages

This is a static site, so it works on GitHub Pages as is.

1. Push the repository to GitHub (public, or a paid plan for private).
2. Open Settings, then Pages.
3. Set Source to "Deploy from a branch", choose `main` and `/ (root)`, and save.
4. The site goes live at `https://<user>.github.io/<repository>/` after a minute or two. Every link is relative, so the subpath works.

## Take it to Ax

The site teaches the ideas. [Ax](https://ax.dev/) runs real experiments. Each "Take it to Ax" page:

1. Maps the problem onto Ax: parameters, objective, budget.
2. Shows a script generated with Honegumi and adapted to the problem. Every edit is marked `# MOD:`, and the unedited output is in `ax/generated/`.
3. Opens the same script as a notebook in Colab, ready to run.
4. Says whether the notebook was run, with which versions, and what it found. This comes from `ax/run-status.json`, written when `scripts/build_ax.py` executes the notebook.

## Where Honegumi fits

[Honegumi](https://honegumi.readthedocs.io/en/latest/) is a grid of options (one or several objectives, constraints, batches, existing data, and more) that writes the matching Ax script. This site stays small on purpose: one objective, continuous inputs, one evaluation at a time, all simulated. The harder variants are better served by Ax, and Honegumi is the shortest path from "I understand the idea" to a working Ax script:

| You want | Go to |
| --- | --- |
| Intuition for surrogates, acquisition functions and budgets | This site |
| Several objectives (for example color and cost) | Honegumi: Objective = multi |
| Constraints such as a total-volume limit | Honegumi: linear or sum constraint |
| Several experiments at once | Honegumi: Synchrony = batch |
| Many inputs (10 and up) | Ax, with Honegumi's fully Bayesian model option |

## Roadmap

Planned for this site (see [docs/build-plan.md](docs/build-plan.md)):

- A home page with the problem library and a learning path
- Color mixing with two dyes (blue and yellow to green), with a total-volume limit, and its Ax page
- Color matching with 3 to 10 dyes, showing where the edge of BO over random search shrinks
- Rosenbrock and ridge-function benchmarks

Left to Honegumi and Ax rather than built here: multi-objective optimization, constraints beyond a linear limit, batch optimization, and high-dimensional methods.

## Credits

- [Honegumi](https://github.com/sgbaird/honegumi), MIT license, © 2023 sgbaird. Baird, Falkowski and Sparks, "Honegumi: An Interface for Accelerating the Adoption of Bayesian Optimization in the Experimental Sciences", *npj Computational Materials*, 2026, doi:[10.1038/s41524-026-02156-0](https://doi.org/10.1038/s41524-026-02156-0). The Ax scripts in `ax/` start from its output.
- [Ax](https://github.com/facebook/Ax) and [BoTorch](https://github.com/pytorch/botorch), MIT license, Meta Platforms.

Optimization Live is not affiliated with either project.

## License

MIT. See [LICENSE](LICENSE).
