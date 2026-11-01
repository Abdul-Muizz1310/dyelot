import { normalizeHue } from "./convert";
import { assertFinite, assertOneOf } from "./guards";

/** The harmonies of the spec's hue table, in the order of the spec's `Harmony` union. */
export const HARMONIES = [
  "monochrome",
  "analogous",
  "complementary",
  "split",
  "triadic",
  "tetradic",
] as const;

export type Harmony = (typeof HARMONIES)[number];

/**
 * Degrees from the primary hue to the secondary and to the accent, per harmony (spec section 2
 * and R-12). Tetradic also has `h0 + 240`, which has no slot in M1.
 */
const OFFSETS: Readonly<Record<Harmony, readonly [secondary: number, accent: number]>> = {
  monochrome: [0, 0],
  analogous: [-30, 30],
  complementary: [0, 180],
  split: [210, 150],
  triadic: [120, 240],
  tetradic: [60, 180],
};

/**
 * The secondary and accent hues for a primary OKLCH hue `h0`, in degrees. Both lie in [0, 360)
 * whatever finite `h0` is, and monochrome returns `h0` (normalized) for both slots. A hue that is
 * not finite, or a harmony string outside the union, throws a RangeError; an `h0` that is not a
 * number, or a harmony that is not a string, throws a TypeError (R-05).
 */
export function harmonyHues(h0: number, harmony: Harmony): { secondary: number; accent: number } {
  assertFinite(h0, "harmonyHues: h0");
  assertOneOf(harmony, HARMONIES, "harmonyHues: harmony");
  const [secondary, accent] = OFFSETS[harmony];
  return { secondary: normalizeHue(h0 + secondary), accent: normalizeHue(h0 + accent) };
}
