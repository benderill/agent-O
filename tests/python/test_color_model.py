"""The Python color model (ax/color_model.py) must match the browser's, so the Ax notebook optimizes the same problem."""
import json
import pathlib
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "ax"))
import color_model as cm  # noqa: E402

FIXTURE = json.loads((ROOT / "tests" / "fixtures" / "color-model.json").read_text(encoding="utf-8"))


@pytest.mark.parametrize("pt", FIXTURE["points"], ids=lambda p: f"water={p['water']}")
def test_matches_browser_model(pt):
    assert cm.dilution_rgb(pt["water"]) == pytest.approx(pt["rgb"], abs=1e-12)
    assert cm.lab_of(cm.dilution_rgb(pt["water"])) == pytest.approx(pt["lab"], abs=1e-9)
    assert cm.measure_delta_e(pt["water"]) == pytest.approx(pt["deltaE"], abs=1e-9)


def test_optimum_is_at_target():
    assert cm.measure_delta_e(cm.TARGET_WATER_ML) == pytest.approx(0.0, abs=1e-12)


def test_notebook_script_inlines_this_model():
    """ax/dilution.py carries a copy of the model so it runs alone in Colab. It must be the same code."""
    script = (ROOT / "ax" / "dilution.py").read_text(encoding="utf-8")
    body = (ROOT / "ax" / "color_model.py").read_text(encoding="utf-8")
    body = body[body.index("import math"):].strip()
    assert body in script, "ax/dilution.py is stale. Run: python scripts/build_ax.py"
