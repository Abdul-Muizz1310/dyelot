import type { Gamut, Hex, Mode, Oklch, Rgb } from "./types";

/**
 * How far outside 0 to 1 a channel may sit and still count as in gamut. `toHex` and `inGamut`
 * share it, so a color is in gamut exactly when `toHex` accepts it.
 */
export const RGB_TOLERANCE = 1e-6;

/**
 * How far outside 0 to 1 a stored color's channel may sit (spec R-10, lint rule G1). `round6`
 * moves a stored seed at most 1.347e-4 outside (`#00fd1b`, the worst 8-bit color), so a locked
 * seed counts as gamut-mapped only when its stored form lies further out than this.
 */
export const STORED_GAMUT_TOLERANCE = 2e-4;

/**
 * The largest chroma any color here carries: the ceiling of a parsed color, a seed, a peak chroma
 * and the stored `c` of the schema. One definition; every other module imports it.
 */
export const CHROMA_CEILING = 0.5;

/** The type of `value` as an error message names it: `null` and an array are not "object". */
export function describeType(value: unknown): string {
  if (value === null) return "null";
  return Array.isArray(value) ? "array" : typeof value;
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

/** The two gamuts and the two modes, as lists for `assertOneOf`. */
export const GAMUTS = Object.freeze(["srgb", "p3"] as const);
export const MODES = ["light", "dark"] as const;

/** A gamut is the string "srgb" or "p3": another type is a TypeError, another string a RangeError. */
export function assertGamut(gamut: Gamut, name: string): void {
  assertOneOf(gamut, GAMUTS, name);
}

/** A mode is the string "light" or "dark": another type is a TypeError, another string a RangeError. */
export function assertMode(mode: Mode, name: string): void {
  assertOneOf(mode, MODES, name);
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

/**
 * One of a field's listed strings (spec R-05): a value that is not a string is a TypeError, and a
 * string outside the list is a RangeError. Both name the field.
 */
export function assertOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  name: string,
): asserts value is T {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a string, got ${describeType(value)}`);
  }
  if (!(allowed as readonly string[]).includes(value)) {
    const list = allowed.map((item) => JSON.stringify(item)).join(", ");
    throw new RangeError(`${name} must be one of ${list}, got ${JSON.stringify(value)}`);
  }
}

const HEX = /^#[0-9a-f]{6}$/;

/**
 * Whether a value is a `Hex`: a string of `#` and six lowercase hex digits (spec I-08). The spec
 * schema uses it to turn a parsed string into a `Hex` (R-05).
 */
export function isHex(value: unknown): value is Hex {
  return typeof value === "string" && HEX.test(value);
}

/**
 * A `Hex`: `#` and six lowercase hex digits (spec I-08). A value that is not a string is a
 * TypeError, and a string of another form is a RangeError (R-05).
 */
export function assertHex(value: unknown, name: string): asserts value is Hex {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a string, got ${describeType(value)}`);
  }
  if (!isHex(value)) {
    throw new RangeError(`${name} must be a lowercase #rrggbb hex, got ${JSON.stringify(value)}`);
  }
}
