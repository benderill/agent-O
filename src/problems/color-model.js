// A simulated color model shared by the lab problems. It is made up for teaching and is not real chemistry.
// Dye absorbs red and green more than blue, so a concentrated blue dye is deep blue and dilution makes it pale.

/** Display color (r, g, b each in 0..1) of 1 ml of blue dye diluted with `water` ml of water. */
export function dilutionRGB(water) {
  const c = 1 / (1 + water); // dye share of the total volume
  return [Math.exp(-2.6 * c), Math.exp(-1.5 * c), Math.exp(-0.35 * c)];
}

export function rgbCss(rgb) {
  return `rgb(${Math.round(rgb[0] * 255)},${Math.round(rgb[1] * 255)},${Math.round(rgb[2] * 255)})`;
}

function srgbToLinear(v) {
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/** sRGB (0..1) to CIELAB, D65 white point. */
export function labOf(rgb) {
  const r = srgbToLinear(rgb[0]);
  const g = srgbToLinear(rgb[1]);
  const b = srgbToLinear(rgb[2]);
  const X = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b;
  const Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const Z = 0.0193339 * r + 0.119192 * g + 0.9503041 * b;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X / 0.95047);
  const fy = f(Y);
  const fz = f(Z / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** Perceived color difference (CIE76). 0 is identical, below about 2 is hard to tell apart. */
export function deltaE76(labA, labB) {
  const d0 = labA[0] - labB[0];
  const d1 = labA[1] - labB[1];
  const d2 = labA[2] - labB[2];
  return Math.sqrt(d0 * d0 + d1 * d1 + d2 * d2);
}
