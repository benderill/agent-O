# Contributing

Thanks for helping to grow Optimization Live. This guide covers how to run things, what conventions to follow, and how to submit a change.

## Set up

You need Node 18 or newer. There is nothing to install.

```
npm start    # app at http://localhost:8000
npm test     # all tests
```

## Ground rules

- **No dependencies and no build step.** Everything is plain ES modules that run directly in the browser and in Node. If you think a dependency is needed, open an issue to discuss it first.
- **Everything is minimized.** Problems return a number where lower is better. Acquisition functions return scores where higher is better.
- **Models work in the unit cube.** Surrogates and the optimizer see inputs scaled to `[0, 1]`. Problems work in real units. `src/core/space.js` converts between them.
- **Runs are reproducible.** Randomness comes from a seeded generator (`src/core/rng.js`). Do not call `Math.random()` in the engine. The UI may use it only to pick a new seed.
- **The engine does not touch the page.** Anything in `src/core`, `src/surrogates`, `src/acquisition`, `src/problems` and `src/optimizer.js` must run in plain Node. Browser code belongs in `src/ui`.
- **Registries drive the UI.** New problems, surrogates and acquisition functions are added to a registry. Do not hard-code them in `src/ui/app.js`.

## Adding things

| I want to add | Read |
| --- | --- |
| A problem or benchmark function | [docs/adding-a-problem.md](docs/adding-a-problem.md) |
| A surrogate model | [docs/adding-a-surrogate.md](docs/adding-a-surrogate.md) |
| An acquisition function | [docs/adding-an-acquisition-function.md](docs/adding-an-acquisition-function.md) |

## Tests

Tests use the built-in `node:test` runner and live in `tests/`. Add a test file named `*.test.js` and it runs automatically.

- New problems are checked by `validateDefinition` and by the "documented optimum" test, which evaluates the problem at the optimum you declare. Declare `optimum.x` and `optimum.y` honestly.
- New surrogates and acquisition functions are covered by the generic registry tests. Add a specific test for any behavior that is particular to yours.
- Prefer tests that assert behavior with fixed seeds over tests that rely on luck.

## Submitting a change

1. Fork the repository and create a branch.
2. Make your change and add or update tests.
3. Run `npm test` and check the app in a browser, including a narrow phone-width window and dark mode.
4. Open a pull request that says what changed and why. For a new problem, include a short note on what it teaches.

## Style

- Two-space indentation, semicolons, single quotes.
- Short comments that say why, not what. Each source file starts with a comment on its purpose.
- User-facing text is plain and direct. Avoid jargon unless the app explains it.
