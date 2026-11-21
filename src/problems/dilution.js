// Lab problem: dilute 1 ml of blue dye with water to match a pale target shade.
// One input (water volume), one objective (color distance ΔE, minimized).

import { dilutionRGB, labOf, deltaE76, rgbCss } from './color-model.js';

const TARGET_WATER_ML = 11;

export default {
  id: 'dilution',
  title: 'Dilution',
  kind: 'lab',
  summary: 'Add water to 1 ml of blue dye to match a pale target shade.',
  story:
    'You have 1 ml of blue dye and unlimited water. A pipette adds water, a camera compares each mix to the target shade, and reports the color difference ΔE. Find the amount of water that matches the target in as few mixes as you can.',
  defaultBudget: () => 8,
  maxBudget: 30,
  axPage: 'ax/dilution.html',

  create() {
    const target = labOf(dilutionRGB(TARGET_WATER_ML));
    return {
      inputs: [{ name: 'Water', unit: 'ml', min: 0, max: 30, scale: 'log1p' }],
      objective: { name: 'ΔE' },
      evaluate: (x) => deltaE76(labOf(dilutionRGB(x[0])), target),
      optimum: { x: [TARGET_WATER_ML], y: 0 },
      // Optional hook the UI uses to show target and mixed colors for lab problems.
      visual: {
        targetColor: rgbCss(dilutionRGB(TARGET_WATER_ML)),
        colorOf: (x) => rgbCss(dilutionRGB(x[0])),
        trialName: 'Mix',
        describe: (x) => `1 ml dye + ${x[0].toFixed(1)} ml water`,
        volumeOf: (x) => 1 + x[0],
        maxVolume: 31,
      },
    };
  },
};
