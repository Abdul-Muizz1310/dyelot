import { hexToRgb, rgbToOklab } from "./convert";
import { DEFICIENCIES, simulate } from "./cvd";
import { assertOneOf, describeType } from "./guards";
import { GAMUTS, MODES, type Palette, type PaletteName, pageFor } from "./palette";
import { type ScaleStep, STEPS, solveScale } from "./scale";
import type { Gamut, Hex, Mode, Oklab } from "./types";

// Section 2 and R-13: candidates are hues every 15° at steps 600 to 900, solved at chroma 0.14.
const CHART_SIZE = 5;
const HUE_STEP = 15;
const CANDIDATE_CHROMA = 0.14;
const CANDIDATE_INDEXES = [600, 700, 800, 900].map((step) =>
  STEPS.indexOf(step as (typeof STEPS)[number]),
);
const FIRST_INDEX = STEPS.indexOf(600);

/** A color and its OKLab under each view: none, then protan, deutan and tritan. */
type Seen = { readonly hex: Hex; readonly views: readonly Oklab[] };

function seen(hex: Hex): Seen {
  const rgb = hexToRgb(hex);
  return {
    hex,
    views: [
      rgbToOklab(rgb, "srgb"),
      ...DEFICIENCIES.map((deficiency) => rgbToOklab(simulate(rgb, deficiency), "srgb")),
    ],
  };
}

/**
 * The candidates of each (mode, page, gamut), in hue order then step order, the order that breaks
 * ties. A cache keeps them, because they depend on nothing else and cost 24 scale solves. Its size
 * is bounded by the domain: light mode has one page, and the dark pages, `oklch(0.18, c ≤ 0.012,
 * h)`, map to fewer than 150 hexes. The cache never changes an output.
 */
const CANDIDATES = new Map<string, readonly Seen[]>();

function candidatesFor(mode: Mode, page: Hex, gamut: Gamut): readonly Seen[] {
  const key = `${mode} ${page} ${gamut}`;
  const cached = CANDIDATES.get(key);
  if (cached !== undefined) return cached;
  const found: Seen[] = [];
  for (let hue = 0; hue < 360; hue += HUE_STEP) {
    const scale = solveScale({
      hue,
      peakChroma: CANDIDATE_CHROMA,
      mode,
      page: hexToRgb(page),
      gamut,
    });
    for (const index of CANDIDATE_INDEXES) found.push(seen(scale[index].hex));
  }
  CANDIDATES.set(key, found);
  return found;
}

function distance(p: Oklab, q: Oklab): number {
  return Math.sqrt((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2);
}

/** The smallest ΔEOK from `candidate` to any chosen color, under any of the four views. */
function separation(candidate: Seen, chosen: readonly Seen[]): number {
  let smallest = Number.POSITIVE_INFINITY;
  for (const other of chosen) {
    candidate.views.forEach((view, v) => {
      smallest = Math.min(smallest, distance(view, other.views[v]));
    });
  }
  return smallest;
}

/** The palette's scale in `mode`, checked: 11 steps in `STEPS` order. */
function scaleOf(
  p: Record<PaletteName, Palette>,
  name: PaletteName,
  mode: Mode,
): readonly ScaleStep[] {
  const palette = p[name];
  if (typeof palette !== "object" || palette === null) {
    throw new RangeError(`pickChartColors: p.${name} is missing`);
  }
  const scale = palette[mode];
  if (!Array.isArray(scale) || scale.length !== STEPS.length) {
    throw new RangeError(`pickChartColors: p.${name}.${mode} must hold ${STEPS.length} steps`);
  }
  return scale;
}

/**
 * Five chart colors for a mode (spec section 2, R-13). The first is primary-600. Each later pick
 * is the candidate whose smallest ΔEOK to the chosen colors, under normal vision and the three
 * simulated deficiencies, is largest; a tie goes to the lower hue, then the lower step. Every
 * candidate sits at step 600 or above on the mode's page, so every mark keeps 3:1 against the page
 * and the card. The set is checked against 0.08 by tests and by lint rule S1, not here.
 */
export function pickChartColors(
  p: Record<PaletteName, Palette>,
  mode: Mode,
  gamut: Gamut,
): readonly Hex[] {
  if (typeof p !== "object" || p === null) {
    throw new TypeError(`pickChartColors: p must be a palette record, got ${describeType(p)}`);
  }
  assertOneOf(mode, MODES, "pickChartColors: mode");
  assertOneOf(gamut, GAMUTS, "pickChartColors: gamut");
  const primary = scaleOf(p, "primary", mode);
  scaleOf(p, "neutral", mode);
  const candidates = candidatesFor(mode, pageFor(p.neutral, mode), gamut);
  const chosen: Seen[] = [seen(primary[FIRST_INDEX].hex)];
  while (chosen.length < CHART_SIZE) {
    let best = candidates[0];
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const candidate of candidates) {
      const score = separation(candidate, chosen);
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
    chosen.push(best);
  }
  return chosen.map((color) => color.hex);
}
