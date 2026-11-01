import { srgbToLinear } from "./convert";
import { assertFinite, clampedSrgb, describeType } from "./guards";
import type { Rgb } from "./types";

// WCAG 2.2: the weights of the linear channels in relative luminance, and the offset that the
// contrast ratio adds to both luminances.
const WEIGHT_RED = 0.2126;
const WEIGHT_GREEN = 0.7152;
const WEIGHT_BLUE = 0.0722;
const FLARE = 0.05;

/** The thresholds of WCAG 2.2 that `meets` knows: large text and UI, body text, enhanced text. */
const THRESHOLDS: readonly number[] = [3, 4.5, 7];

/**
 * The relative luminance of channels that `clampedSrgb` has checked: 0 for black, 1 for white. The
 * weights add to 1, so the luminance stays within 0 to 1. The `min` keeps a rounding error from
 * lifting it above 1, which would let a ratio pass 21.
 */
function luminance(rgb: Rgb): number {
  const y =
    WEIGHT_RED * srgbToLinear(rgb[0]) +
    WEIGHT_GREEN * srgbToLinear(rgb[1]) +
    WEIGHT_BLUE * srgbToLinear(rgb[2]);
  return Math.min(1, y);
}

/**
 * The WCAG 2.2 relative luminance of an sRGB color: each channel decoded to linear light
 * (threshold 0.04045), then weighted 0.2126, 0.7152 and 0.0722. A channel may sit up to 1e-6
 * outside 0 to 1 and is clamped into it; anything else throws a RangeError.
 */
export function relativeLuminance(rgb: Rgb): number {
  return luminance(clampedSrgb(rgb, "relativeLuminance: rgb"));
}

/**
 * The WCAG 2.2 contrast ratio of two sRGB colors: the lighter luminance plus 0.05 over the darker
 * luminance plus 0.05. It is symmetric, lies in [1, 21] and is never rounded, so a caller compares
 * it with a threshold as it comes (see `meets`). Channel rules as in `relativeLuminance`.
 */
export function wcagRatio(a: Rgb, b: Rgb): number {
  const ya = luminance(clampedSrgb(a, "wcagRatio: a"));
  const yb = luminance(clampedSrgb(b, "wcagRatio: b"));
  return (Math.max(ya, yb) + FLARE) / (Math.min(ya, yb) + FLARE);
}

/**
 * Whether `ratio` reaches a WCAG threshold, compared on the full float: 4.4999999 does not meet
 * 4.5. The threshold is 3, 4.5 or 7. A ratio that is not finite, or another threshold, throws.
 */
export function meets(ratio: number, threshold: 3 | 4.5 | 7): boolean {
  assertFinite(ratio, "meets: ratio");
  if (typeof threshold !== "number") {
    throw new TypeError(`meets: threshold must be a number, got ${describeType(threshold)}`);
  }
  if (!THRESHOLDS.includes(threshold)) {
    throw new RangeError(`meets: threshold must be 3, 4.5 or 7, got ${threshold}`);
  }
  return ratio >= threshold;
}

// The constants of the perceptual contrast formula published as version 0.0.98G-4g: the `A` table
// in core.py. Its luminance is its own, not the WCAG one: a plain 2.4 power of each encoded
// channel, with these weights.
const LC = {
  exponent: 2.4,
  red: 0.2126729,
  green: 0.7151522,
  blue: 0.072175,
  // Exponents that shape the score: dark text on a light background, then light text on a dark one.
  darkOnLightBackground: 0.56,
  darkOnLightText: 0.57,
  lightOnDarkBackground: 0.65,
  lightOnDarkText: 0.62,
  // Below this luminance a color is lifted by (threshold - luminance) ^ clamp, which softens black.
  blackThreshold: 0.022,
  // biome-ignore lint/suspicious/noApproximativeNumericConstant: the published value is 1.414, not the square root of 2
  blackClamp: 1.414,
  scaleDarkOnLight: 1.14,
  scaleLightOnDark: 1.14,
  offsetDarkOnLight: 0.027,
  offsetLightOnDark: 0.027,
  // Two luminances closer than this score 0, and so does a raw score under the low clip.
  minLuminanceGap: 0.0005,
  lowClip: 0.1,
} as const;

/** The luminance of the perceptual score, for channels that `clampedSrgb` has checked. */
function perceptualLuminance(rgb: Rgb): number {
  return (
    LC.red * rgb[0] ** LC.exponent +
    LC.green * rgb[1] ** LC.exponent +
    LC.blue * rgb[2] ** LC.exponent
  );
}

/** Lifts a luminance under the black threshold, so near-black colors do not score as black. */
function softenBlack(y: number): number {
  return y > LC.blackThreshold ? y : y + (LC.blackThreshold - y) ** LC.blackClamp;
}

/**
 * The perceptual contrast (advisory) of `text` on `background`, signed. Dark text on a lighter
 * background scores above 0 and light text on a darker background scores below 0. It is `+0` when
 * the two luminances differ by less than 0.0005 or the raw score falls under the low clip. The
 * score is advisory: WCAG 2.2 decides conformance (see `wcagRatio` and `meets`), and this score
 * helps choose between colors that pass. Channel rules as in `relativeLuminance`.
 */
export function perceptualLc(text: Rgb, background: Rgb): number {
  const textY = softenBlack(perceptualLuminance(clampedSrgb(text, "perceptualLc: text")));
  const backgroundY = softenBlack(
    perceptualLuminance(clampedSrgb(background, "perceptualLc: background")),
  );
  if (Math.abs(backgroundY - textY) < LC.minLuminanceGap) return 0;
  if (backgroundY > textY) {
    const raw =
      (backgroundY ** LC.darkOnLightBackground - textY ** LC.darkOnLightText) * LC.scaleDarkOnLight;
    return raw < LC.lowClip ? 0 : (raw - LC.offsetDarkOnLight) * 100;
  }
  const raw =
    (backgroundY ** LC.lightOnDarkBackground - textY ** LC.lightOnDarkText) * LC.scaleLightOnDark;
  return raw > -LC.lowClip ? 0 : (raw + LC.offsetLightOnDark) * 100;
}
