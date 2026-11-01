import type { Gamut, Oklch, Rgb } from "./types";

/**
 * How far outside 0 to 1 a channel may sit and still count as in gamut. `toHex` and `inGamut`
 * share it, so a color is in gamut exactly when `toHex` accepts it.
 */
export const RGB_TOLERANCE = 1e-6;

/** The type of `value` as an error message names it: `null` is not "object". */
export function describeType(value: unknown): string {
  return value === null ? "null" : typeof value;
}

/** A number that is not finite is outside every domain here (spec I-03). */
export function assertFinite(value: unknown, name: string): asserts value is number {
  if (typeof value !== "number") {
    throw new TypeError(`${name} must be a number, got ${describeType(value)}`);
  }
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be finite, got ${value}`);
  }
}

/** Three finite channels. Channels outside 0 to 1 are allowed: they mark an out-of-gamut color. */
export function assertRgb(rgb: Rgb, name: string): void {
  if (!Array.isArray(rgb)) {
    throw new TypeError(`${name} must be an array of three channels, got ${describeType(rgb)}`);
  }
  const length: number = rgb.length;
  if (length !== 3) throw new TypeError(`${name} must have three channels, got ${length}`);
  for (let i = 0; i < 3; i++) assertFinite(rgb[i], `${name}[${i}]`);
}

/** An object with a finite `l`, a finite `c`, and an `h` that is finite or `null`. */
export function assertOklch(color: Oklch, name: string): void {
  if (typeof color !== "object" || color === null) {
    throw new TypeError(`${name} must be an object with l, c and h, got ${describeType(color)}`);
  }
  assertFinite(color.l, `${name}.l`);
  assertFinite(color.c, `${name}.c`);
  if (color.h !== null) assertFinite(color.h, `${name}.h`);
}

/** A gamut is the string "srgb" or "p3": another type is a TypeError, another string a RangeError. */
export function assertGamut(gamut: Gamut, name: string): void {
  if (typeof gamut !== "string") {
    throw new TypeError(`${name} must be a string, got ${describeType(gamut)}`);
  }
  if (gamut !== "srgb" && gamut !== "p3") {
    throw new RangeError(`${name} must be "srgb" or "p3", got ${JSON.stringify(gamut)}`);
  }
}

/** Whether every channel lies within `tolerance` of the range 0 to 1. */
export function withinUnitCube(rgb: Rgb, tolerance: number): boolean {
  const high = 1 + tolerance;
  return (
    rgb[0] >= -tolerance &&
    rgb[0] <= high &&
    rgb[1] >= -tolerance &&
    rgb[1] <= high &&
    rgb[2] >= -tolerance &&
    rgb[2] <= high
  );
}

/** A channel clamped into 0 to 1. */
export const clamp01 = (channel: number): number => Math.min(1, Math.max(0, channel));

/**
 * Checks an sRGB color for the functions that measure it, and returns it with every channel
 * clamped into 0 to 1. The color needs three finite channels, each within `RGB_TOLERANCE` of that
 * range, the tolerance of `toHex`: rounding at the edge of the gamut passes, and a color outside
 * the gamut throws. The clamp keeps a negative channel away from a fractional power, which is
 * NaN, and keeps a luminance ratio inside its range.
 */
export function clampedSrgb(rgb: Rgb, name: string): Rgb {
  assertRgb(rgb, name);
  if (!withinUnitCube(rgb, RGB_TOLERANCE)) {
    throw new RangeError(
      `${name} must have every channel within ${RGB_TOLERANCE.toExponential(0)} of [0, 1], got [${rgb.join(", ")}]`,
    );
  }
  return [clamp01(rgb[0]), clamp01(rgb[1]), clamp01(rgb[2])];
}
