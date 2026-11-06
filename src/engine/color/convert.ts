import { ColorParseError } from "./errors";
import {
  assertFinite,
  assertGamut,
  assertOklch,
  assertRgb,
  describeType,
  RGB_TOLERANCE,
} from "./guards";
import type { Gamut, Hex, Oklab, Oklch, Rgb } from "./types";

/** A color with chroma at or below this has no hue, and carries `h: null` (spec R-03). */
export const ACHROMATIC_CHROMA = 4e-6;

export type Vec3 = readonly [number, number, number];
export type Mat3 = readonly [Vec3, Vec3, Vec3];

// The matrices of the CSS Color 4 sample code, written as in core.py.
const SRGB_TO_XYZ: Mat3 = [
  [506752 / 1228815, 87881 / 245763, 12673 / 70218],
  [87098 / 409605, 175762 / 245763, 12673 / 175545],
  [7918 / 409605, 87881 / 737289, 1001167 / 1053270],
];
const XYZ_TO_SRGB: Mat3 = [
  [12831 / 3959, -329 / 214, -1974 / 3959],
  [-851781 / 878810, 1648619 / 878810, 36519 / 878810],
  [705 / 12673, -2585 / 12673, 705 / 667],
];
const P3_TO_XYZ: Mat3 = [
  [608311 / 1250200, 189793 / 714400, 198249 / 1000160],
  [35783 / 156275, 247089 / 357200, 198249 / 2500400],
  [0 / 1, 32229 / 714400, 5220557 / 5000800],
];
const XYZ_TO_P3: Mat3 = [
  [446124 / 178915, -333277 / 357830, -72051 / 178915],
  [-14852 / 17905, 63121 / 35810, 423 / 17905],
  [11844 / 330415, -50337 / 660830, 316169 / 330415],
];
export const XYZ_TO_LMS: Mat3 = [
  [0.819022437996703, 0.3619062600528904, -0.1288737815209879],
  [0.0329836539323885, 0.9292868615863434, 0.0361446663506424],
  [0.0481771893596242, 0.2642395317527308, 0.6335478284694309],
];
export const LMS_TO_OKLAB: Mat3 = [
  [0.210454268309314, 0.7936177747023054, -0.0040720430116193],
  [1.9779985324311684, -2.42859224204858, 0.450593709617411],
  [0.0259040424655478, 0.7827717124575296, -0.8086757549230774],
];
export const LMS_TO_XYZ: Mat3 = [
  [1.2268798758459243, -0.5578149944602171, 0.2813910456659647],
  [-0.0405757452148008, 1.112286803280317, -0.0717110580655164],
  [-0.0763729366746601, -0.4214933324022432, 1.5869240198367816],
];
export const OKLAB_TO_LMS: Mat3 = [
  [1.0, 0.3963377773761749, 0.2158037573099136],
  [1.0, -0.1055613458156586, -0.0638541728258133],
  [1.0, -0.0894841775298119, -1.2914855480194092],
];

/**
 * A 3 by 3 matrix times a column vector. An unchecked kernel: it validates nothing, so callers
 * pass it only vectors they have already checked (finite, three components).
 */
export function multiply(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

/** sRGB decode: linear below 0.04045, a power above it, and the sign of the input kept. */
function decode(channel: number): number {
  const magnitude = Math.abs(channel);
  if (magnitude <= 0.04045) return channel / 12.92;
  const linear = ((magnitude + 0.055) / 1.055) ** 2.4;
  return channel < 0 ? -linear : linear;
}

/** sRGB encode: a power above 0.0031308, linear below it, and the sign of the input kept. */
function encode(linear: number): number {
  const magnitude = Math.abs(linear);
  if (magnitude <= 0.0031308) return 12.92 * linear;
  const channel = 1.055 * magnitude ** (1 / 2.4) - 0.055;
  return linear < 0 ? -channel : channel;
}

/** The sRGB (and Display P3) transfer function, from encoded to linear light. */
export function srgbToLinear(channel: number): number {
  assertFinite(channel, "srgbToLinear: channel");
  return decode(channel);
}

/** The inverse of `srgbToLinear`, from linear light to encoded. */
export function linearToSrgb(linear: number): number {
  assertFinite(linear, "linearToSrgb: linear");
  return encode(linear);
}

/**
 * Wraps an angle into [0, 360), for any finite input. A tiny negative angle would round up to
 * exactly 360 and negative zero would stay negative, so both are written as 0.
 */
export function normalizeHue(degrees: number): number {
  assertFinite(degrees, "normalizeHue: degrees");
  return wrapHue(degrees);
}

function wrapHue(degrees: number): number {
  const wrapped = degrees % 360;
  const hue = wrapped < 0 ? wrapped + 360 : wrapped;
  return hue >= 360 || hue === 0 ? 0 : hue;
}

function allFinite(values: Vec3): boolean {
  return Number.isFinite(values[0]) && Number.isFinite(values[1]) && Number.isFinite(values[2]);
}

/** Throws when a conversion overflowed: finite input must never give a non-finite result. */
function assertConverted(values: Vec3, name: string): void {
  if (!allFinite(values)) throw new RangeError(`${name} is too large to convert`);
}

function toOklab(rgb: Rgb, gamut: Gamut): Vec3 {
  const xyz = multiply(gamut === "srgb" ? SRGB_TO_XYZ : P3_TO_XYZ, [
    decode(rgb[0]),
    decode(rgb[1]),
    decode(rgb[2]),
  ]);
  const lms = multiply(XYZ_TO_LMS, xyz);
  return multiply(LMS_TO_OKLAB, [Math.cbrt(lms[0]), Math.cbrt(lms[1]), Math.cbrt(lms[2])]);
}

function fromOklab(lab: Vec3, gamut: Gamut): Rgb {
  const lms = multiply(OKLAB_TO_LMS, lab);
  const xyz = multiply(LMS_TO_XYZ, [lms[0] ** 3, lms[1] ** 3, lms[2] ** 3]);
  const linear = multiply(gamut === "srgb" ? XYZ_TO_SRGB : XYZ_TO_P3, xyz);
  return [encode(linear[0]), encode(linear[1]), encode(linear[2])];
}

/** The OKLab of an OKLCH color. A null hue reads as 0, as in a CSS conversion. */
function oklchToLab(color: Oklch): Vec3 {
  const radians = (wrapHue(color.h ?? 0) * Math.PI) / 180;
  return [color.l, color.c * Math.cos(radians), color.c * Math.sin(radians)];
}

/** RGB to OKLab. Channels outside 0 to 1 are read as they are, without clamping. */
export function rgbToOklab(rgb: Rgb, gamut: Gamut): Oklab {
  assertRgb(rgb, "rgbToOklab: rgb");
  assertGamut(gamut, "rgbToOklab: gamut");
  const lab = toOklab(rgb, gamut);
  assertConverted(lab, "rgbToOklab: rgb");
  return lab;
}

/** OKLCH to OKLab. A null hue reads as 0. */
export function oklchToOklab(color: Oklch): Oklab {
  assertOklch(color, "oklchToOklab: c");
  return oklchToLab(color);
}

/**
 * RGB to OKLCH. Hue is in degrees in [0, 360), and `null` when chroma is at or below 4e-6.
 * Channels outside 0 to 1 are read as they are, without clamping.
 */
export function rgbToOklch(rgb: Rgb, gamut: Gamut): Oklch {
  assertRgb(rgb, "rgbToOklch: rgb");
  assertGamut(gamut, "rgbToOklch: gamut");
  const lab = toOklab(rgb, gamut);
  assertConverted(lab, "rgbToOklch: rgb");
  const [l, a, b] = lab;
  const c = Math.sqrt(a * a + b * b);
  const h = c <= ACHROMATIC_CHROMA ? null : wrapHue((Math.atan2(b, a) * 180) / Math.PI);
  return { l, c, h };
}

/** The conversion of `oklchToRgb`, or null where it overflows. The caller has checked `color`. */
function convertOklch(color: Oklch, gamut: Gamut): Rgb | null {
  const rgb = fromOklab(oklchToLab(color), gamut);
  return allFinite(rgb) ? rgb : null;
}

/**
 * OKLCH to RGB in the named gamut. The result is not clamped: a channel outside 0 to 1 marks an
 * out-of-gamut color. A null hue reads as 0. A color too large to convert throws a RangeError.
 */
export function oklchToRgb(color: Oklch, gamut: Gamut): Rgb {
  assertOklch(color, "oklchToRgb: c");
  assertGamut(gamut, "oklchToRgb: gamut");
  const rgb = convertOklch(color, gamut);
  if (rgb === null) throw new RangeError("oklchToRgb: c is too large to convert");
  return rgb;
}

/**
 * `oklchToRgb` that returns null, not a RangeError, for a color too large to convert. Such a
 * color is far outside every gamut, which is how `maxChroma` reads it. Other bad input still
 * throws.
 */
export function tryOklchToRgb(color: Oklch, gamut: Gamut): Rgb | null {
  assertOklch(color, "tryOklchToRgb: c");
  assertGamut(gamut, "tryOklchToRgb: gamut");
  return convertOklch(color, gamut);
}

/**
 * sRGB to `#rrggbb`. A channel within 1e-6 of the range 0 to 1 is clamped into it, then
 * multiplied by 255 and rounded half up. A Display P3 triple needs `gamutMap(c, "srgb")` first.
 */
export function toHex(rgb: Rgb): Hex {
  assertRgb(rgb, "toHex: rgb");
  let hex = "#";
  for (let i = 0; i < 3; i++) {
    const channel = rgb[i];
    if (channel < -RGB_TOLERANCE || channel > 1 + RGB_TOLERANCE) {
      throw new RangeError(
        `toHex: rgb[${i}] must be within ${RGB_TOLERANCE.toExponential(0)} of [0, 1], got ${channel}`,
      );
    }
    hex += Math.round(Math.min(1, Math.max(0, channel)) * 255)
      .toString(16)
      .padStart(2, "0");
  }
  return hex as Hex;
}

const SIX_HEX_DIGITS = /^[0-9a-f]{6}$/i;

/** Six hex digits with no `#`, in either case, to sRGB channels. Anything else is a ColorParseError. */
export function hexDigitsToRgb(digits: string): Rgb {
  if (typeof digits !== "string") {
    throw new TypeError(`hexDigitsToRgb: digits must be a string, got ${describeType(digits)}`);
  }
  if (!SIX_HEX_DIGITS.test(digits)) {
    throw new ColorParseError(digits, "Write six hex digits, as in f66c6d.");
  }
  const channel = (at: number) => Number.parseInt(digits.slice(at, at + 2), 16) / 255;
  return [channel(0), channel(2), channel(4)];
}

const SIX_DIGIT_HEX = /^#([0-9a-f]{6})$/i;

/** `#rrggbb` in either case to sRGB channels. Short forms and alpha pairs are rejected. */
export function hexToRgb(hex: Hex): Rgb {
  if (typeof hex !== "string") {
    throw new TypeError(`hexToRgb: hex must be a string, got ${describeType(hex)}`);
  }
  const match = SIX_DIGIT_HEX.exec(hex);
  if (match === null) throw new ColorParseError(hex, "Write six hex digits, as in #f66c6d.");
  return hexDigitsToRgb(match[1]);
}

/** `oklch(0.7003 0.1701 22.06)`: L and C to 4 decimals, H to 2, and `none` for a null hue. */
export function formatOklch(color: Oklch): string {
  assertOklch(color, "formatOklch: c");
  const hue = color.h === null ? "none" : color.h.toFixed(2);
  return `oklch(${color.l.toFixed(4)} ${color.c.toFixed(4)} ${hue})`;
}
