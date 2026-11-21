# Quality log

One line per page: rounds of the quality loop (docs/build-plan.md), what changed, what remains.
Checks: `npm test`, `npm run check` (headless Chromium under /agent-O/), screenshots in `docs/screenshots/`
at 1280 px light, 1280 px dark and 400 px mobile, and the page's controls exercised by the check script.

| Page | Rounds | What changed between rounds | Remaining |
| --- | --- | --- | --- |
| Dilution workspace (`index.html`) | 3 | 1: Run showed "Pause" after the last mix (fixed in the run loop); first log row scrolled out of view (taller log); progress chart unreadable because the first ΔE (~88) flattened the rest (automatic log scale, with a note that the best possible 0 is off the axis); beaker caught mid-animation (shorter transition). 2: log-scale title overlapped the top tick (more top padding). 3: passes. | Beaker shows the mixed color rather than the board's two layers (deliberate: a mixed liquid has one color). |
| Ackley in the workspace (`?problem=ackley`, 1, 2 and 6 inputs) | 2 | Same layout; "Result" card instead of the lab; log columns adapt to the inputs. | None found. |
| Take it to Ax: dilution (`ax/dilution.html`) | 4 | 1: code double-spaced (line spans joined with newlines); 2: wrapped "Keep learning" links pushed the ↗ to the right edge, settings chips one per row at 400 px; 3: those links 1 px under 44 px; 4: code block had no visible edge in dark mode (border). | None found. |
| Lesson (`lessons/surrogate-acquisition.html`) | 0 | Not in scope; checked only. | Small tap targets, see docs/open-issues.md. |

## Measured behavior

- Dilution, budget 8, seeds 1 to 10 (`node scripts/benchmark.mjs`): GP Matérn 5/2 + EI median best ΔE 0.206, better than random search (median 1.899) on 10 of 10 seeds.
- The Ax notebook (`ax/dilution.ipynb`) ran end to end with Python 3.12.10, ax-platform 0.4.3 and Honegumi 0.4.1: best ΔE 0.991 with seed 1, median 0.283 over seeds 1 to 10 (`ax/run-status.json`).
