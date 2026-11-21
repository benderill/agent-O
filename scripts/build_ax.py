"""Builds the "Take it to Ax" script and notebook for the dilution problem, starting from Honegumi.

    .venv/Scripts/python scripts/build_ax.py              # generate, write, execute
    .venv/Scripts/python scripts/build_ax.py --no-run     # generate and write only
    .venv/Scripts/python scripts/build_ax.py --compare 10 # also run Ax over 10 seeds and report the median best delta E

Steps:
1. Render a script with Honegumi's Python API for: single objective, default model, no constraints, one trial at a time.
   It is saved word for word as ax/generated/dilution.honegumi.py, so anyone can see what was generated.
2. Apply a short list of edits, each marked with a "# MOD:" comment in the output: the parameter (water, 0 to 30 ml),
   the objective (delta E, minimized), the simulated color model from the browser in place of the test function,
   the budget (8 trials), a seed, and a summary printed at the end. Every edit checks that the text it replaces exists,
   so a change in Honegumi's template makes this script fail instead of producing something unverified.
3. Write ax/dilution.py and ax/dilution.ipynb (self-contained, so it runs in Colab).
4. Execute the notebook with nbclient, keep its outputs, and write ax/run-status.json for the web page.
"""
import argparse
import importlib.metadata
import datetime as dt
import json
import pathlib
import platform
import re
import statistics
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
AX_DIR = ROOT / "ax"
N_TRIALS = 8
SEED = 1
PIP_LINE = '%pip install ax-platform==0.4.3 "pandas<3"'
SITE = "https://github.com/benderill/agent-O"  # replaced by the real repository URL once it exists


def honegumi_script():
    import honegumi
    import honegumi.ax
    import honegumi.core
    from honegumi.ax._ax import option_rows
    from honegumi.ax.utils import constants as cst
    from honegumi.core._honegumi import Honegumi

    hg = Honegumi(
        cst,
        option_rows,
        script_template_dir=honegumi.ax.__path__[0],
        core_template_dir=honegumi.core.__path__[0],
        script_template_name="main.py.jinja",
        core_template_name="honegumi.html.jinja",
    )
    options = hg.OptionsModel(
        objective="single",
        model="Default",
        task="Single",
        categorical=False,
        sum_constraint=False,
        order_constraint=False,
        linear_constraint=False,
        composition_constraint=False,
        custom_threshold=False,
        existing_data=False,
        synchrony="Single",
        visualize=False,
    )
    return hg.generate(options), options.model_dump(), honegumi.__version__


def replace_once(text, old, new, what):
    if text.count(old) != 1:
        raise SystemExit(f"Honegumi output changed: expected exactly one match for {what!r}:\n{old}")
    return text.replace(old, new)


def adapt(generated):
    model = (AX_DIR / "color_model.py").read_text(encoding="utf-8")
    model = model[model.index("import math"):].strip()
    s = generated
    s = replace_once(
        s,
        "# %pip install ax-platform\n",
        f"# {PIP_LINE}  # MOD: versions this script was run with\n",
        "pip line",
    )
    s = re.sub(
        r'obj1_name = "branin"\n\n\ndef branin\(x1, x2\):\n.*?\n    return y\n',
        lambda _m: (
            '# MOD: the simulated dilution lab from Optimization Live replaces Honegumi\'s test function.\n'
            "# Same model as the browser (src/problems/color-model.js), not real chemistry.\n"
            f"{model}\n\n\n"
            'obj1_name = "delta_e"  # MOD: color difference to the target, lower is better\n'
            f"N_TRIALS = {N_TRIALS}  # MOD: the mix budget, as in the browser\n"
        ),
        s,
        count=1,
        flags=re.S,
    )
    if "branin" in s.split("ax_client = AxClient()")[0]:
        raise SystemExit("Honegumi output changed: could not replace the branin objective")
    s = replace_once(
        s,
        "ax_client = AxClient()",
        f"ax_client = AxClient(random_seed={SEED}, verbose_logging=False)  # MOD: fixed seed, quieter logs",
        "AxClient()",
    )
    s = replace_once(
        s,
        '        {"name": "x1", "type": "range", "bounds": [-5.0, 10.0]},\n'
        '        {"name": "x2", "type": "range", "bounds": [0.0, 10.0]},\n',
        '        # MOD: one input, the water added to 1 ml of dye, in ml\n'
        '        {"name": "water", "type": "range", "bounds": [0.0, 30.0]},\n',
        "parameters",
    )
    s = replace_once(s, "for i in range(19):", "for i in range(N_TRIALS):  # MOD: budget", "loop")
    s = replace_once(
        s,
        '    x1 = parameterization["x1"]\n    x2 = parameterization["x2"]\n',
        '    water = parameterization["water"]  # MOD: our parameter\n',
        "parameter extraction",
    )
    s = replace_once(
        s,
        "    results = branin(x1, x2)\n",
        "    results = measure_delta_e(water)  # MOD: run the (simulated) experiment\n"
        '    print(f"Mix {trial_index + 1}: 1 ml dye + {water:.1f} ml water -> delta E {results:.3f}")  # MOD\n',
        "objective call",
    )
    s = s.rstrip() + (
        "\n\n# MOD: report the best mix that was actually measured\n"
        "df = ax_client.get_trials_data_frame()\n"
        "best = df.loc[df[obj1_name].idxmin()]\n"
        'print(f"Best mix: 1 ml dye + {best[\'water\']:.2f} ml water, delta E {best[obj1_name]:.3f}"'
        ' f" (target: {TARGET_WATER_ML} ml, delta E 0)")\n'
    )
    return s


def notebook(script):
    import nbformat

    nb = nbformat.v4.new_notebook()
    nb.metadata["kernelspec"] = {"name": "python3", "display_name": "Python 3", "language": "python"}
    nb.metadata["colab"] = {"provenance": []}
    body = "\n".join(line for line in script.splitlines() if not line.startswith("# %pip")).strip() + "\n"
    nb.cells = [
        nbformat.v4.new_markdown_cell(
            "# Take the dilution problem to Ax\n\n"
            "The dilution problem from [Optimization Live](" + SITE + "): add water to 1 ml of blue dye until the color "
            "matches a pale target. The objective is the color difference ΔE, minimized, with a budget of 8 mixes.\n\n"
            "The script was generated with [Honegumi](https://honegumi.readthedocs.io/en/latest/) "
            "(single objective, default model, no constraints) and adapted. Every change is marked `# MOD:`. "
            "The unedited Honegumi output is in `ax/generated/dilution.honegumi.py` in the repository.\n\n"
            "The \"experiment\" here is the same simulated color model the website uses, so you can run it anywhere. "
            "For a real lab, replace `measure_delta_e(water)` with your measurement.\n\n"
            "Run all cells. The first one installs the versions this notebook was tested with."
        ),
        nbformat.v4.new_code_cell(PIP_LINE),
        nbformat.v4.new_code_cell(body),
        nbformat.v4.new_markdown_cell(
            "Built on [Honegumi](https://github.com/sgbaird/honegumi) (MIT license; Baird, Falkowski and Sparks, "
            "*npj Computational Materials*, 2026, doi:10.1038/s41524-026-02156-0) and "
            "[Ax](https://ax.dev/) (MIT license)."
        ),
    ]
    return nb


def execute(nb_path):
    import nbformat
    from nbclient import NotebookClient

    nb = nbformat.read(nb_path, as_version=4)
    NotebookClient(nb, timeout=1800, kernel_name="python3", resources={"metadata": {"path": str(AX_DIR)}}).execute()
    nbformat.write(nb, nb_path)
    out = "".join(
        o.get("text", "") for c in nb.cells if c.cell_type == "code" for o in c.get("outputs", []) if o.get("name") == "stdout"
    )
    m = re.search(r"Best mix: 1 ml dye \+ ([\d.]+) ml water, delta E ([\d.]+)", out)
    if not m:
        raise SystemExit("Notebook ran but printed no best mix:\n" + out[-2000:])
    return float(m.group(1)), float(m.group(2)), len(re.findall(r"^Mix \d+:", out, flags=re.M))


def compare(script, n):
    """Runs the script (without the pip line) for seeds 1..n, as separate processes, and returns the best delta E of each."""
    body = "\n".join(line for line in script.splitlines() if not line.startswith("# %pip"))
    bests = []
    for seed in range(1, n + 1):
        src = body.replace(f"AxClient(random_seed={SEED},", f"AxClient(random_seed={seed},")
        with tempfile.TemporaryDirectory() as d:
            f = pathlib.Path(d) / "run.py"
            f.write_text(src, encoding="utf-8")
            r = subprocess.run([sys.executable, "-I", str(f)], capture_output=True, text=True, cwd=d)
        m = re.search(r"delta E ([\d.]+) \(target", r.stdout)
        if r.returncode or not m:
            raise SystemExit(f"seed {seed} failed:\n{r.stdout[-1500:]}\n{r.stderr[-1500:]}")
        bests.append(float(m.group(1)))
        print(f"  seed {seed}: best delta E {bests[-1]:.3f}")
    return bests


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-run", action="store_true")
    ap.add_argument("--compare", type=int, default=0)
    a = ap.parse_args()

    generated, options, hg_version = honegumi_script()
    (AX_DIR / "generated").mkdir(parents=True, exist_ok=True)
    (AX_DIR / "generated" / "dilution.honegumi.py").write_text(generated, encoding="utf-8", newline="\n")
    (AX_DIR / "generated" / "dilution.options.json").write_text(
        json.dumps({"honegumi": hg_version, "options": options}, indent=2) + "\n", encoding="utf-8", newline="\n"
    )
    script = adapt(generated)
    (AX_DIR / "dilution.py").write_text(script, encoding="utf-8", newline="\n")

    import nbformat

    nb_path = AX_DIR / "dilution.ipynb"
    nbformat.write(notebook(script), nb_path)
    print("wrote ax/generated/dilution.honegumi.py, ax/dilution.py, ax/dilution.ipynb")
    if a.no_run:
        return


    water, best, trials = execute(nb_path)
    status = {
        "ran": True,
        "date": dt.date.today().isoformat(),
        "python": platform.python_version(),
        "ax_platform": importlib.metadata.version("ax-platform"),
        "honegumi": hg_version,
        "trials": trials,
        "seed": SEED,
        "best_water_ml": round(water, 2),
        "best_delta_e": round(best, 3),
    }
    if a.compare:
        print(f"Running Ax over {a.compare} seeds...")
        bests = compare(script, a.compare)
        status["compare"] = {"seeds": a.compare, "median_best_delta_e": round(statistics.median(bests), 3),
                             "all": [round(b, 3) for b in bests]}
    (AX_DIR / "run-status.json").write_text(json.dumps(status, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps(status, indent=2))


if __name__ == "__main__":
    main()
