// Converts between a problem's real inputs and the unit cube [0, 1]^d that the surrogate models work in.
//
// Each input has: { name, min, max, unit?, scale? }.
// scale 'linear' (default) maps evenly. scale 'log1p' spaces values by log(1 + value - min), which suits
// quantities that act multiplicatively, such as dilution.

export function toUnitCoord(input, v) {
  const span = input.max - input.min;
  if (input.scale === 'log1p') return Math.log(1 + (v - input.min)) / Math.log(1 + span);
  return (v - input.min) / span;
}

export function fromUnitCoord(input, u) {
  const span = input.max - input.min;
  if (input.scale === 'log1p') return input.min + Math.exp(u * Math.log(1 + span)) - 1;
  return input.min + u * span;
}

export function toUnit(problem, x) {
  return problem.inputs.map((inp, i) => toUnitCoord(inp, x[i]));
}

export function fromUnit(problem, u) {
  return problem.inputs.map((inp, i) => fromUnitCoord(inp, u[i]));
}
