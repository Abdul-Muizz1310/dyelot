import fc from "fast-check";
import { expect } from "vitest";
import { hexToRgb } from "@/engine/color/convert";
import type { Hex, Oklch, Rgb } from "@/engine/color/types";

export type Tolerance = { readonly l: number; readonly c: number; readonly h: number };

/** Spec section 5: "≈" means L and C within 0.001 and H within 0.1 degrees. */
export const TOLERANCE: Tolerance = { l: 0.001, c: 0.001, h: 0.1 };

/** A color with chroma at or below this has no hue (R-03). */
export const ACHROMATIC_CHROMA = 4e-6;

/** The shorter way round the hue circle between two angles, in degrees (0 to 180). */
export function hueDistance(a: number, b: number): number {
  const gap = Math.abs(a - b) % 360;
  return Math.min(gap, 360 - gap);
}

/** Asserts two colors agree within the spec's tolerances. Hue is compared when both have one. */
export function expectOklchClose(
  actual: Oklch,
  expected: Oklch,
  tolerance: Tolerance = TOLERANCE,
): void {
  expect(Math.abs(actual.l - expected.l)).toBeLessThanOrEqual(tolerance.l);
  expect(Math.abs(actual.c - expected.c)).toBeLessThanOrEqual(tolerance.c);
  if (actual.h !== null && expected.h !== null) {
    expect(hueDistance(actual.h, expected.h)).toBeLessThanOrEqual(tolerance.h);
  }
}

/** Asserts every channel of `actual` is within `tolerance` of `expected`. */
export function expectRgbClose(actual: Rgb, expected: Rgb, tolerance: number): void {
  for (let i = 0; i < 3; i++) {
    expect(Math.abs(actual[i] - expected[i])).toBeLessThanOrEqual(tolerance);
  }
}

const byte = fc.integer({ min: 0, max: 255 });

/** Any 8-bit sRGB triple. */
export const rgb8: fc.Arbitrary<readonly [number, number, number]> = fc.tuple(byte, byte, byte);

/** The lowercase `#rrggbb` of an 8-bit triple. Tests may cast a literal to `Hex` (R-05). */
export function hexOf([r, g, b]: readonly [number, number, number]): Hex {
  const part = (value: number) => value.toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}` as Hex;
}

/** The sRGB channels of a `#rrggbb` literal. */
export function rgbOfHex(hex: string): Rgb {
  return hexToRgb(hex as Hex);
}

/** The three 8-bit channels of a `#rrggbb` string. */
function bytesOf(hex: string): readonly [number, number, number] {
  const byteAt = (at: number) => Number.parseInt(hex.slice(at, at + 2), 16);
  return [byteAt(1), byteAt(3), byteAt(5)];
}

/** Asserts two hexes agree within `tolerance` codes per channel (the spec's "±1 per channel"). */
export function expectHexClose(actual: string, expected: string, tolerance = 1): void {
  const got = bytesOf(actual);
  const want = bytesOf(expected);
  for (let i = 0; i < 3; i++) {
    expect(
      Math.abs(got[i] - want[i]),
      `channel ${i} of ${actual}, expected ${expected} within ${tolerance}`,
    ).toBeLessThanOrEqual(tolerance);
  }
}

const unit = fc.double({ min: 0, max: 1, noNaN: true });
const grid = fc.integer({ min: 0, max: 255 }).map((value) => value / 255);
const channel = fc.oneof(unit, grid);

/** Any color in gamut: each channel from the continuum or from the 8-bit grid. */
export const anyRgb: fc.Arbitrary<Rgb> = fc.tuple(channel, channel, channel);

const tolerated = fc.double({ min: -1e-6, max: 1 + 1e-6, noNaN: true });

/** A color whose channels may sit up to 1e-6 outside 0 to 1, the tolerance of `toHex`. */
export const edgeRgb: fc.Arbitrary<Rgb> = fc.tuple(tolerated, tolerated, tolerated);

/** Channel values that every measuring function must reject, whatever their position. */
export const BAD_CHANNELS: readonly number[] = [
  -1.1e-6,
  1 + 1.1e-6,
  -0.5,
  1.5,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
];

/** `base` with `value` written into channel `index`. */
export function withChannel(base: Rgb, index: 0 | 1 | 2, value: number): Rgb {
  const channels: [number, number, number] = [base[0], base[1], base[2]];
  channels[index] = value;
  return channels;
}

/** C-SCALE-02: every non-threshold step within its band, steps 500 to 700 above their thresholds. */
const STEP_TARGETS = [1.06, 1.15, 1.32, 1.65, 2.2, 3.0, 4.5, 7.0, 9.5, 12.5, 15.5];
const STEP_THRESHOLDS: Readonly<Record<number, number>> = { 5: 3, 6: 4.5, 7: 7 };

/** Asserts the contrast checks of C-SCALE-02 on the hex of step index `i`. */
export function expectStepContrast(
  hex: string,
  i: number,
  page: Rgb,
  ratioOf: (a: Rgb, b: Rgb) => number,
): void {
  const ratio = ratioOf(rgbOfHex(hex), page);
  const target = STEP_TARGETS[i];
  const threshold = STEP_THRESHOLDS[i];
  if (threshold === undefined) {
    expect(Math.abs(ratio - target), `step index ${i} ${hex} ${ratio}`).toBeLessThanOrEqual(
      Math.max(0.05, 0.01 * target),
    );
  } else {
    expect(ratio >= threshold, `step index ${i} ${hex} ${ratio}`).toBe(true);
    expect(ratio - target, `step index ${i} ${hex} ${ratio}`).toBeLessThanOrEqual(0.12);
  }
}

/** Freezes an object and everything inside it, so a mutation throws. */
export function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const inner of Object.values(value)) deepFreeze(inner);
    Object.freeze(value);
  }
  return value;
}
