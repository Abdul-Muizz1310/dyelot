import { linearToSrgb, type Mat3, multiply, srgbToLinear, type Vec3 } from "./convert";
import { assertOneOf, clamp01, clampedSrgb } from "./guards";
import type { Rgb } from "./types";

/** The color vision deficiencies that `simulate` reproduces: no L cones, no M cones, no S cones. */
export const DEFICIENCIES = Object.freeze(["protan", "deutan", "tritan"] as const);

export type Deficiency = (typeof DEFICIENCIES)[number];

// The matrices of cvd.py, which takes them from libDaltonLens (Unlicense). They act on linear
// sRGB. Viénot (1999) gives protan and deutan one matrix each. Brettel (1997) gives tritan two
// matrices, one for each half of its reduced color plane, chosen by the sign of a dot product with
// the normal of the plane that splits them. cvd.py also holds the Machado matrices and the Brettel
// pairs for protan and deutan; M1 simulates full severity with the two methods above only.
const VIENOT: Readonly<Record<Exclude<Deficiency, "tritan">, Mat3>> = {
  protan: [
    [0.11238, 0.88762, 0.0],
    [0.11238, 0.88762, 0.0],
    [0.00401, -0.00401, 1.0],
  ],
  deutan: [
    [0.29275, 0.70725, 0.0],
    [0.29275, 0.70725, 0.0],
    [-0.02234, 0.02234, 1.0],
  ],
};

/** The Brettel matrix for a linear color whose dot product with `TRITAN_NORMAL` is 0 or more. */
const TRITAN_FIRST: Mat3 = [
  [1.01277, 0.13548, -0.14826],
  [-0.01243, 0.86812, 0.14431],
  [0.07589, 0.805, 0.11911],
];

/** The Brettel matrix for a linear color whose dot product with `TRITAN_NORMAL` is below 0. */
const TRITAN_SECOND: Mat3 = [
  [0.93678, 0.18979, -0.12657],
  [0.06154, 0.81526, 0.1232],
  [-0.37562, 1.12767, 0.24796],
];

/** The normal of the plane that splits the tritan simulation in two halves. */
const TRITAN_NORMAL: Vec3 = [0.03901, -0.02788, -0.01113];

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** The matrix that simulates `deficiency` for a color in linear light. */
function matrixFor(linear: Vec3, deficiency: Deficiency): Mat3 {
  if (deficiency === "tritan") {
    return dot(linear, TRITAN_NORMAL) >= 0 ? TRITAN_FIRST : TRITAN_SECOND;
  }
  return VIENOT[deficiency];
}

/** A linear channel clamped into 0 to 1, then encoded. The outer `min` keeps rounding below 1. */
function encodeChannel(linear: number): number {
  return Math.min(1, linearToSrgb(clamp01(linear)));
}

/**
 * How a person with a color vision deficiency sees an sRGB color, at full severity: decode to
 * linear light, multiply by the matrix of the deficiency, clamp to 0 to 1 and encode again. Protan
 * and deutan use the Viénot matrices. Tritan uses the Brettel pair: the first matrix when the dot
 * product of the linear color with the plane normal is 0 or more, the second otherwise. A channel
 * may sit up to 1e-6 outside 0 to 1 and is clamped into it; anything else throws a RangeError.
 */
export function simulate(rgb: Rgb, deficiency: Deficiency): Rgb {
  const [r, g, b] = clampedSrgb(rgb, "simulate: rgb");
  assertOneOf(deficiency, DEFICIENCIES, "simulate: deficiency");
  const linear: Vec3 = [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
  const [lr, lg, lb] = multiply(matrixFor(linear, deficiency), linear);
  return [encodeChannel(lr), encodeChannel(lg), encodeChannel(lb)];
}
