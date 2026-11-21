# Open issues

Problems found by the quality checks (`npm run check`) that are not fixed yet.

## Lesson page (`lessons/surrogate-acquisition.html`)

The lesson was not part of the dilution-page work, so it has not been restyled. `npm run check -- --page lesson` reports:

- The selects `#aModel` and `#bSel` are 37 px tall, and the "Show the true curve" checkbox labels are 24 px tall, at 400 px width. Tap targets should be about 44 px.
- The quiz and step buttons are 43 px tall, just under 44 px.
- The page has its own header and does not share the site header.

## Not built yet (from docs/build-plan.md)

- Home page, two-dye and ten-dye problems, Rosenbrock and ridge benchmarks, and their Ax pages.
- The header's "Take it to Ax" link goes straight to the dilution page, because there is only one Ax page.
