import { oklchToOklab, rgbToOklab } from "./convert";
import { type Deficiency, simulate } from "./cvd";
import { assertOklch, clampedSrgb, describeType } from "./guards";
import type { Oklab, Oklch, Rgb } from "./types";

/** The Euclidean distance between two OKLab colors. */
function distance(p: Oklab, q: Oklab): number {
  const dl = p[0] - q[0];
  const da = p[1] - q[1];
  const db = p[2] - q[2];
  return Math.sqrt(dl * dl + da * da + db * db);
}

/**
 * The OKLab of a color for `deltaEOK`. A null hue has no direction, so the color contributes
 * a = b = 0 whatever its chroma. The engine keeps a null hue to colors with chroma at or below
 * 4e-6 (spec I-04), so the two readings agree on every color it makes.
 */
function labOf(color: Oklch, name: string): Oklab {
  assertOklch(color, name);
  return color.h === null ? [color.l, 0, 0] : oklchToOklab(color);
}

/**
 * The color difference ΔEOK of CSS Color 4 section 20.3: the Euclidean distance in OKLab, not the
 * ΔEOK2 variant. Black against white is 1. The result is symmetric, and 0 for a color against
 * itself. Two finite colors so far apart that the distance overflows throw a RangeError, so the
 * result is always finite.
 */
export function deltaEOK(a: Oklch, b: Oklch): number {
  const result = distance(labOf(a, "deltaEOK: a"), labOf(b, "deltaEOK: b"));
  if (!Number.isFinite(result)) {
    throw new RangeError("deltaEOK: the colors are too far apart to measure");
  }
  return result;
}

/** The smallest ΔEOK over every unordered pair of the colors, which `clampedSrgb` has checked. */
function smallestDistance(colors: readonly Rgb[]): number {
  const labs = colors.map((color) => rgbToOklab(color, "srgb"));
  let smallest = Number.POSITIVE_INFINITY;
  for (let i = 0; i < labs.length; i++) {
    for (let j = i + 1; j < labs.length; j++) {
      smallest = Math.min(smallest, distance(labs[i], labs[j]));
    }
  }
  return smallest;
}

/**
 * The smallest ΔEOK between any two of `colors`, as seen with normal vision (`none`) and under
 * each color vision deficiency. Every color is simulated first, then compared in OKLab. It needs
 * at least two colors. A channel may sit up to 1e-6 outside 0 to 1, as in `simulate`.
 */
export function minPairwiseDeltaE(colors: readonly Rgb[]): Record<"none" | Deficiency, number> {
  if (!Array.isArray(colors)) {
    throw new TypeError(
      `minPairwiseDeltaE: colors must be an array of colors, got ${describeType(colors)}`,
    );
  }
  if (colors.length < 2) {
    throw new RangeError(
      `minPairwiseDeltaE: colors needs at least two colors, got ${colors.length}`,
    );
  }
  const checked = colors.map((color, i) => clampedSrgb(color, `minPairwiseDeltaE: colors[${i}]`));
  const seenBy = (deficiency: Deficiency): number =>
    smallestDistance(checked.map((color) => simulate(color, deficiency)));
  return {
    none: smallestDistance(checked),
    protan: seenBy("protan"),
    deutan: seenBy("deutan"),
    tritan: seenBy("tritan"),
  };
}
