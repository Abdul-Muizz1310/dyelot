import fc from "fast-check";
import { expect } from "vitest";
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
