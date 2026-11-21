# Honegumi and Ax: notes

Checked on 2026-11-21 for the "Take it to Ax" pages. Re-check these before building pages for new problems.

## Environment

- Python 3.12.10 in `.venv`, with `pip install -r ax/requirements.txt`.
- Honegumi 0.4.1 and ax-platform 0.4.3. These are the versions Honegumi's own Colab examples pin. Its `setup.cfg` requires `ax-platform<1`.
- **Ax 0.4.3 fails under pandas 3** with `ValueError: assignment destination is read-only` in `ax/modelbridge/transforms/winsorize.py`, on the first model-based trial. `pandas<3` fixes it, and pandas 2.3.3 works with numpy 2.5.5. The requirements file and the notebook's install cell pin `pandas<3`.
- A Honegumi-generated script runs end to end with these versions. The check used the stock Branin example: 19 trials, all completed.

## Generating scripts

Honegumi has a Python API, so scripts can be generated without a browser (see `scripts/build_ax.py`):

```python
from honegumi.core._honegumi import Honegumi
from honegumi.ax.utils import constants as cst
from honegumi.ax._ax import option_rows
hg = Honegumi(cst, option_rows, script_template_dir=honegumi.ax.__path__[0], core_template_dir=honegumi.core.__path__[0],
              script_template_name="main.py.jinja", core_template_name="honegumi.html.jinja")
script = hg.generate(hg.OptionsModel(objective="single", model="Default", ...))
```

Generated scripts use the older service API, `ax.service.ax_client.AxClient`, not `ax.api.client.Client` from Ax 1.x. That is why the Ax version is pinned.

## Options in Honegumi's grid

| Row (API key) | Values |
| --- | --- |
| Objective (`objective`) | single, multi |
| Model (`model`) | Default, Custom, Fully Bayesian |
| Task (`task`) | Single, Multi |
| Categorical parameter (`categorical`) | False, True |
| Sum constraint (`sum_constraint`) | False, True |
| Order constraint (`order_constraint`) | False, True |
| Linear constraint (`linear_constraint`) | False, True |
| Composition constraint (`composition_constraint`) | False, True |
| Custom threshold (`custom_threshold`) | False, True |
| Existing data (`existing_data`) | False, True |
| Synchrony (`synchrony`) | Single, Batch |
| Visualize results (`visualize`) | False, True |

There is also a hidden `custom_gen` key.

**Linear constraints exist.** Ax takes them as strings, for example `parameter_constraints=["16.32*x3 - 3.73*x4 <= 13.0"]` in Honegumi's 3D-printing tutorial. A separate sum constraint also exists. The two-dye page should render both and use whichever produces `blue + yellow <= V`.

## Dilution: browser versus Ax

Budget 8 mixes, seeds 1 to 10, median best ΔE (lower is better):

| Run | Median best ΔE |
| --- | --- |
| Browser, GP (Matérn 5/2) + expected improvement, the default | 0.206 (beat random search on 10 of 10 seeds) |
| Browser, random search | 1.899 |
| Ax 0.4.3 defaults (Sobol, then BoTorch GP), `ax/dilution.py` | see `ax/run-status.json` (0.283 in the first run) |

The two are similar. Ax spends its first 5 trials on quasi-random Sobol points before the model takes over. The browser starts with 2 Latin-hypercube points. That explains most of the difference at this small budget. Reproduce with `node scripts/benchmark.mjs` and `python scripts/build_ax.py --compare 10`.

## Licenses and credit

- Honegumi: MIT license, © 2023 sgbaird (<https://github.com/sgbaird/honegumi/blob/main/LICENSE.txt>). Its documentation site states no separate license, so we link to its guides and do not copy their text.
- Ax: MIT license (<https://github.com/facebook/Ax>).
- Citation: Baird, Falkowski and Sparks, "Honegumi: An Interface for Accelerating the Adoption of Bayesian Optimization in the Experimental Sciences", *npj Computational Materials*, 2026, doi:10.1038/s41524-026-02156-0. Preprint: arXiv:2502.06815.

## Learning material that exists (for "Keep learning" links)

- Concept guides (<https://honegumi.readthedocs.io/en/latest/concepts.html>): single vs. multi-objective, frequentist vs. fully Bayesian GPs, single vs. batch, multitask.
- Tutorials (<https://honegumi.readthedocs.io/en/latest/tutorials.html>): single-objective 3D printing (with a linear constraint), multi-objective polymers, batch coatings, MAX-phase featurization, multitask ceramics, benchmarking acquisition functions.
- There are **no** Honegumi guides on acquisition functions, constraints or high-dimensional problems as such. The mockup's link names were changed to real pages.
