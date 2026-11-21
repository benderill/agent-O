# The simulated dilution lab from Optimization Live, ported from src/problems/color-model.js and
# src/problems/dilution.js. Made up for teaching; not real chemistry.
# 1 ml of blue dye is diluted with `water` ml of water. A camera reads the color, and the objective
# is the color difference delta E (CIE76) to a target shade, made with 11 ml of water. Lower is better.
import math

TARGET_WATER_ML = 11.0


def dilution_rgb(water):
    """Display color (r, g, b in 0..1) of 1 ml of blue dye diluted with `water` ml of water."""
    c = 1.0 / (1.0 + water)  # dye share of the total volume
    return (math.exp(-2.6 * c), math.exp(-1.5 * c), math.exp(-0.35 * c))


def _srgb_to_linear(v):
    return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4


def lab_of(rgb):
    """sRGB (0..1) to CIELAB, D65 white point."""
    r, g, b = (_srgb_to_linear(v) for v in rgb)
    X = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b
    Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b
    Z = 0.0193339 * r + 0.119192 * g + 0.9503041 * b

    def f(t):
        return t ** (1.0 / 3.0) if t > 0.008856 else 7.787 * t + 16.0 / 116.0

    fx, fy, fz = f(X / 0.95047), f(Y), f(Z / 1.08883)
    return (116.0 * fy - 16.0, 500.0 * (fx - fy), 200.0 * (fy - fz))


def delta_e76(lab_a, lab_b):
    """Perceived color difference. 0 is identical, below about 2 is hard to tell apart."""
    return math.sqrt(sum((p - q) ** 2 for p, q in zip(lab_a, lab_b)))


TARGET_LAB = lab_of(dilution_rgb(TARGET_WATER_ML))


def measure_delta_e(water):
    """The black box: mix 1 ml of dye with `water` ml of water and return delta E to the target."""
    return delta_e76(lab_of(dilution_rgb(water)), TARGET_LAB)
