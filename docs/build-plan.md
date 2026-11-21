# Build plan: the complete Optimization Live site

Goal: turn the current app (dilution + Ackley, one lesson) into the full site mocked up here:
https://claude.ai/artifact/MBadMBmqUg2e7BAbhShLMz
(Boards: Site map, Home, Dilution, Two-dye green, Ten-dye match, Take it to Ax.)
Read `docs/architecture.md` and the three `docs/adding-*.md` guides first. Follow them.

## Ground rules
- Keep it a static site: ES modules, no build step, no runtime dependencies, works on GitHub Pages.
- Everything on the site is simulated in the browser. No real chemistry claims.
- Every new problem, surrogate or acquisition function ships with tests. `npm test` must stay green (35 pass today).
- Do not invent Honegumi or Ax code. Generate it from Honegumi, then actually run it. If it cannot run in your environment, label the page "untested".
- Honegumi and Ax are credited on every Take-it-to-Ax page and in the README, with their licenses.
- Commit in small steps, one phase per commit or PR. Update README and docs as you go.

## Phase 0: checks (report findings before building)
1. Confirm `npm test` passes and the app runs.
2. Install Ax (`pip install ax-platform`) in a venv and confirm a minimal 1-D loop runs.
3. Open https://honegumi.readthedocs.io/en/latest/ and note which options exist, especially linear (sum) constraints. Check the docs license.
Write findings to `docs/honegumi-notes.md`.

## Phase 1: Home, lessons, Honegumi links
- New Home page matching the "Home" board: hero, problem cards (Built vs Planned badges), four-step path, GitHub link. Move the current app to `app.html` (or `/problems/`) and keep old links working.
- Header nav: Problems, Lessons, Take it to Ax, GitHub.
- Keep the Honegumi links already in the app header and footer.
- Rewrite the README roadmap: multi-objective, constraints, batch and high-dimensional methods are delegated to Honegumi/Ax. Add a "Where Honegumi fits" section.

## Phase 2: Take it to Ax for dilution
- Page `ax/dilution.html` matching the "Take it to Ax" board: mapping table (water range 0-30, minimize ΔE, trials = budget), the script, Copy and Open-in-Colab buttons, Honegumi settings (single objective, continuous, no constraints), keep-learning links, credit line.
- Notebook `ax/dilution.ipynb`: generate the base script with Honegumi, then replace the objective with the same dilution color model used in the browser (port `src/problems/color-model.js` and `dilution.js` to Python). Run it end to end. Check that it reaches a similar best ΔE to the browser app.
- Add a test or script that runs the notebook's Python cell(s) in CI (optional job; may be allowed to skip if Ax is not installed).

## Phase 3: more problems
1. Two-dye green: 2 inputs (blue ml, yellow ml), target green. Extend the color model to multiple dyes (absorbance-based mixing; document the model). Add an optional total-volume limit.
   - Engine: support constraints in `Optimizer` (infeasible candidates are filtered from the candidate set; infeasible proposals from the random baseline are rejected and redrawn). Add a `constraints` field to the problem definition and validate it in `validateDefinition`.
   - UI: two heatmaps with the feasibility diagonal, a "Limit total volume" toggle and slider (see board).
2. Ten-dye match: N dyes (3-10 selector), view switches to best-mix bars + progress + log; include the lesson callout about BO's edge shrinking with dimension.
3. Rosenbrock and ridge benchmarks, same pattern as Ackley.
4. A Take-it-to-Ax page and notebook for each of the first two, matching Phase 2. The two-dye page uses Honegumi's linear-constraint option if it exists (see Phase 0 notes).
Verify each new problem with measured runs (median over several seeds, BO vs random) before writing any lesson text that claims BO wins.

## Phase 4: optional
- Game mode: pick surrogate and acquisition, fresh target each round, scoreboard, noise toggle.
- Median-over-seeds comparison panel.
- Deployment: GitHub Actions workflow for Pages, README steps.

## Definition of done
All five board pages exist and are linked from Home; `npm test` passes; each Ax notebook runs; README and docs are updated; the site works from a plain static server at a subpath (relative URLs only).

## Quality loop (applies to every page and problem, every phase)
Do not stop at "it runs". For each new or changed page, repeat until it passes, with a hard cap of 4 rounds per page; if it still fails after round 4, write what is wrong in `docs/open-issues.md` and move on.

1. **Build** the page or problem.
2. **Check mechanically**: `npm test`; load the page in a headless browser (install Playwright as a dev tool only, not a runtime dependency) and fail on any console error, failed request, or broken link (internal links must resolve).
3. **Look at it**: take screenshots at 1280px light, 1280px dark, and 400px mobile. Open each screenshot and inspect it yourself. Check: no horizontal scroll at 400px, no clipped or overlapping text, labels not truncated, readable contrast, tap targets about 44px, charts and legends correct, layout matches the matching mockup board.
4. **Check behavior**: exercise the controls (Run, Step, Reset, strategy pickers, sliders, toggles) and confirm the visible numbers change correctly. For a new problem, run BO vs random search over at least 10 seeds and record medians. If BO does not beat random where the lesson text says it should, fix the model or the text; do not leave the claim.
5. **Critique**: write a short list of what is weak (visual, wording, behavior). Fix every item, then go back to step 2.
6. **Record**: keep final screenshots in `docs/screenshots/` and a one-line result per page in `docs/quality-log.md` (rounds taken, what changed, remaining issues).

Redo rather than patch when a page is structurally wrong (for example a heatmap that cannot show the constraint). Prefer simple, readable layouts over decoration.
