import type { Mat3, Vec3 } from "./convert";
import { LMS_TO_OKLAB, LMS_TO_XYZ, multiply, OKLAB_TO_LMS, XYZ_TO_LMS } from "./convert";
import { assertOklch, assertRgb } from "./guards";
import type { Oklab, Oklch, Rgb } from "./types";

// The matrices of colorjs.io 0.7.1's `rec2020-linear` (the CSS Color 4 values), spec R5-06.
const REC2020_TO_XYZ: Mat3 = [
  [0.6369580483012914, 0.14461690358620832, 0.1688809751641721],
  [0.2627002120112671, 0.6779980715188708, 0.05930171646986196],
  [0.0, 0.028072693049087428, 1.060985057710791],
];
const XYZ_TO_REC2020: Mat3 = [
  [1.716651187971268, -0.355670783776392, -0.25336628137366],
  [-0.666684351832489, 1.616481236634939, 0.0157685458139111],
  [0.017639857445311, -0.042770613257809, 0.942103121235474],
];

/** The reference EOTF with gamma 2.4, the sign of the input kept. */
function decode(channel: number): number {
  const linear = Math.abs(channel) ** 2.4;
  return channel < 0 ? -linear : linear;
}

/** The inverse of `decode`, the sign of the input kept. */
function encode(linear: number): number {
  const channel = Math.abs(linear) ** (1 / 2.4);
  return linear < 0 ? -channel : channel;
}

function allFinite(values: Vec3): boolean {
  return Number.isFinite(values[0]) && Number.isFinite(values[1]) && Number.isFinite(values[2]);
}

/**
 * Encoded Rec. 2020 channels to OKLab, for the explorer's solid and slice only. Channels are read
 * as they are, never clamped. Spec R5-06.
 */
export function rec2020ToOklab(rgb: Rgb): Oklab {
  assertRgb(rgb, "rec2020ToOklab: rgb");
  const xyz = multiply(REC2020_TO_XYZ, [decode(rgb[0]), decode(rgb[1]), decode(rgb[2])]);
  const lms = multiply(XYZ_TO_LMS, xyz);
  const lab = multiply(LMS_TO_OKLAB, [Math.cbrt(lms[0]), Math.cbrt(lms[1]), Math.cbrt(lms[2])]);
  if (!allFinite(lab)) throw new RangeError("rec2020ToOklab: rgb is too large to convert");
  return lab;
}

/** OKLCH to encoded Rec. 2020 channels, unclamped; null where the conversion overflows. */
export function oklchToRec2020(color: Oklch): Rgb | null {
  assertOklch(color, "oklchToRec2020: color");
  const radians = (((color.h ?? 0) % 360) * Math.PI) / 180;
  const lms = multiply(OKLAB_TO_LMS, [
    color.l,
    color.c * Math.cos(radians),
    color.c * Math.sin(radians),
  ]);
  const xyz = multiply(LMS_TO_XYZ, [lms[0] ** 3, lms[1] ** 3, lms[2] ** 3]);
  const linear = multiply(XYZ_TO_REC2020, xyz);
  const rgb: Rgb = [encode(linear[0]), encode(linear[1]), encode(linear[2])];
  return allFinite(rgb) ? rgb : null;
}
