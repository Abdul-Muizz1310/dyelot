import { oklchToOklab, oklchToRgb, rgbToOklab, tryOklchToRgb } from "./convert";
import { assertFinite, assertGamut, assertOklch, RGB_TOLERANCE, withinUnitCube } from "./guards";
import type { Gamut, Oklch, Rgb } from "./types";

// CSS Color 4, section 14.2.2: the JND (the smallest difference in OKLab that the eye notices)
// and the precision of the chroma search. `css_gamut_map` in core.py uses the same two numbers.
const JND = 0.02;
const EPSILON = 1e-4;

// `max_chroma` in core.py: bisection on [0, 0.5], 40 iterations.
const MAX_CHROMA_SEARCH = 0.5;
const MAX_CHROMA_ITERATIONS = 40;
// Past 53 halvings of [0, 0.5] a double cannot move, so 64 is more than any caller needs.
const MAX_ITERATIONS_ALLOWED = 64;

const clamp01 = (channel: number): number => Math.min(1, Math.max(0, channel));

function clip(rgb: Rgb): Rgb {
  return [clamp01(rgb[0]), clamp01(rgb[1]), clamp01(rgb[2])];
}

/** Whether the color is in the gamut, within 1e-6 per channel: the tolerance of `toHex`. */
export function inGamut(c: Oklch, gamut: Gamut): boolean {
  assertOklch(c, "inGamut: c");
  assertGamut(gamut, "inGamut: gamut");
  return withinUnitCube(oklchToRgb(c, gamut), RGB_TOLERANCE);
}

/**
 * Maps a color into the gamut by the CSS Color 4 algorithm: keep L and H, search for the largest
 * chroma whose clipped color stays within the JND of the candidate, and return that clipped
 * color. A color already in gamut comes back as `oklchToRgb` returns it, and
 * every channel of the result lies in [0, 1].
 */
export function gamutMap(c: Oklch, gamut: Gamut): Rgb {
  assertOklch(c, "gamutMap: c");
  assertGamut(gamut, "gamutMap: gamut");
  const { l } = c;
  if (l >= 1) return [1, 1, 1];
  if (l <= 0) return [0, 0, 0];
  // The search runs over [0, c], so a negative chroma has no range to search.
  if (c.c < 0) throw new RangeError(`gamutMap: c.c must be at least 0, got ${c.c}`);

  const hue = c.h ?? 0;
  const candidate = (chroma: number): Oklch => ({ l, c: chroma, h: hue });
  // How far clipping moved the candidate, as the distance between the two in OKLab.
  const shift = (chroma: number, clipped: Rgb): number => {
    const [l1, a1, b1] = rgbToOklab(clipped, gamut);
    const [l2, a2, b2] = oklchToOklab(candidate(chroma));
    return Math.sqrt((l1 - l2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2);
  };

  const origin = oklchToRgb(candidate(c.c), gamut);
  if (withinUnitCube(origin, 0)) return origin;
  let result = clip(origin);
  if (shift(c.c, result) < JND) return result;

  let low = 0;
  let high = c.c;
  let belowGamutEdge = true;
  while (high - low > EPSILON) {
    const chroma = (low + high) / 2;
    const rgb = oklchToRgb(candidate(chroma), gamut);
    if (belowGamutEdge && withinUnitCube(rgb, 0)) {
      low = chroma;
      continue;
    }
    result = clip(rgb);
    const moved = shift(chroma, result);
    if (moved < JND) {
      if (JND - moved < EPSILON) return result;
      belowGamutEdge = false;
      low = chroma;
    } else {
      high = chroma;
    }
  }
  return result;
}

/**
 * The largest chroma that stays in the gamut at lightness `l` and hue `h` (degrees), found by
 * bisection on [0, 0.5], returning the lower bound. It is 0 when the gray at `l` is out of gamut,
 * which includes an `l` too large to convert. `iterations` is 40 unless the caller trades
 * precision for speed: 24 iterations land within 0.5 / 2^24 of the same edge.
 */
export function maxChroma(
  l: number,
  h: number,
  gamut: Gamut,
  iterations = MAX_CHROMA_ITERATIONS,
): number {
  assertFinite(l, "maxChroma: l");
  assertFinite(h, "maxChroma: h");
  assertGamut(gamut, "maxChroma: gamut");
  assertFinite(iterations, "maxChroma: iterations");
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > MAX_ITERATIONS_ALLOWED) {
    throw new RangeError(
      `maxChroma: iterations must be a whole number from 1 to ${MAX_ITERATIONS_ALLOWED}, got ${iterations}`,
    );
  }
  const fits = (chroma: number): boolean => {
    const rgb = tryOklchToRgb({ l, c: chroma, h }, gamut);
    return rgb !== null && withinUnitCube(rgb, RGB_TOLERANCE);
  };
  if (!fits(0)) return 0;
  let low = 0;
  let high = MAX_CHROMA_SEARCH;
  for (let i = 0; i < iterations; i++) {
    const middle = (low + high) / 2;
    if (fits(middle)) low = middle;
    else high = middle;
  }
  return low;
}
