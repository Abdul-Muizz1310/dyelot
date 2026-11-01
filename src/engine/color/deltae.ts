import { oklchToOklab, rgbToOklab } from "./convert";
import { DEFICIENCIES, simulate } from "./cvd";
import { assertOklch, assertRgb, clampedSrgb, describeType } from "./guards";
import type { Oklab, Oklch, Rgb } from "./types";

/**
 * The Euclidean distance between two OKLab colors, as a square root of the sum of squares. The
 * views compare clamped sRGB colors, whose OKLab components stay near [-0.5, 1], so the squares
 * cannot overflow; `deltaEOK` takes any finite color and uses `Math.hypot` instead.
 */
function distance(p: Oklab, q: Oklab): number {
  const dl = p[0] - q[0];
  const da = p[1] - q[1];
  const db = p[2] - q[2];
  return Math.sqrt(dl * dl + da * da + db * db);
}

/**
 * The OKLab of a color for `deltaEOK`. A null hue has no direction, so the color contributes
 * a = b = 0 whatever its chroma. The engine keeps a null hue to colors with chroma at or below
 * 4e-6 (spec I-04), so the two readings agree within 4e-6 on every color it makes.
 */
function labOf(color: Oklch, name: string): Oklab {
  assertOklch(color, name);
  return color.h === null ? [color.l, 0, 0] : oklchToOklab(color);
}

/**
 * The color difference ΔEOK of CSS Color 4 section 20.3: the Euclidean distance in OKLab, not the
 * ΔEOK2 variant. Black against white is 1. The result is symmetric, and 0 for a color against
 * itself. `Math.hypot` keeps a distance whose square would overflow; only two finite colors whose
 * distance itself exceeds the largest double throw a RangeError, so the result is always finite.
 */
export function deltaEOK(a: Oklch, b: Oklch): number {
  const p = labOf(a, "deltaEOK: a");
  const q = labOf(b, "deltaEOK: b");
  const result = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  if (!Number.isFinite(result)) {
    throw new RangeError("deltaEOK: the colors are too far apart to measure");
  }
  return result;
}

/** The four views in which colors are compared: normal vision, then each deficiency. */
export const VIEWS = ["none", ...DEFICIENCIES] as const;

export type View = (typeof VIEWS)[number];

/** A color's OKLab under each view. */
export type Views = Readonly<Record<View, Oklab>>;

/** `viewsOf` for a color that `clampedSrgb` has checked. */
function viewsOfChecked(rgb: Rgb): Views {
  return {
    none: rgbToOklab(rgb, "srgb"),
    protan: rgbToOklab(simulate(rgb, "protan"), "srgb"),
    deutan: rgbToOklab(simulate(rgb, "deutan"), "srgb"),
    tritan: rgbToOklab(simulate(rgb, "tritan"), "srgb"),
  };
}

/**
 * A color's OKLab as seen with normal vision (`none`) and under each simulated deficiency (spec
 * R-25). `minPairwiseDeltaE` and chart picking both measure on these, so the picker and lint rule
 * S1 cannot drift apart. A channel may sit up to 1e-6 outside 0 to 1, as in `simulate`.
 */
export function viewsOf(rgb: Rgb): Views {
  return viewsOfChecked(clampedSrgb(rgb, "viewsOf: rgb"));
}

function assertViews(views: Views, name: string): void {
  if (typeof views !== "object" || views === null) {
    throw new TypeError(`${name} must be the views of a color, got ${describeType(views)}`);
  }
  for (const view of VIEWS) assertRgb(views[view], `${name}.${view}`);
}

/** The smallest ΔEOK between two colors over the four views (spec R-25). */
export function minViewDeltaE(a: Views, b: Views): number {
  assertViews(a, "minViewDeltaE: a");
  assertViews(b, "minViewDeltaE: b");
  let smallest = Number.POSITIVE_INFINITY;
  for (const view of VIEWS) smallest = Math.min(smallest, distance(a[view], b[view]));
  return smallest;
}

/**
 * The smallest ΔEOK between any two of `colors`, as seen with normal vision (`none`) and under
 * each color vision deficiency. Every color is simulated first, then compared in OKLab. It needs
 * at least two colors. A channel may sit up to 1e-6 outside 0 to 1, as in `simulate`.
 */
export function minPairwiseDeltaE(colors: readonly Rgb[]): Record<View, number> {
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
  const views = colors.map((color, i) =>
    viewsOfChecked(clampedSrgb(color, `minPairwiseDeltaE: colors[${i}]`)),
  );
  const smallest = (view: View): number => {
    let found = Number.POSITIVE_INFINITY;
    for (let i = 0; i < views.length; i++) {
      for (let j = i + 1; j < views.length; j++) {
        found = Math.min(found, distance(views[i][view], views[j][view]));
      }
    }
    return found;
  };
  return {
    none: smallest("none"),
    protan: smallest("protan"),
    deutan: smallest("deutan"),
    tritan: smallest("tritan"),
  };
}
