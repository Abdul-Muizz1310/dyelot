import { round6 } from "../round";
import { oklchToOklab, rgbToOklab } from "./convert";
import { gamutMap, maxChroma } from "./gamut";
import {
  assertFinite,
  assertOklch,
  assertOneOf,
  CHROMA_CEILING,
  describeType,
  RGB_TOLERANCE,
  withinUnitCube,
} from "./guards";
import { oklchToRec2020, rec2020ToOklab } from "./rec2020";
import type { Oklab, Oklch, Rgb } from "./types";

/** The gamuts the explorer draws as solids and slices (spec R5-06). */
export const SOLID_GAMUTS = Object.freeze(["srgb", "p3", "rec2020"] as const);
export type SolidGamut = (typeof SOLID_GAMUTS)[number];

export type GamutSolid = {
  readonly gamut: SolidGamut;
  readonly steps: number;
  readonly positions: Float32Array;
  readonly colors: Float32Array;
  readonly indices: Uint16Array;
};

export type SlicePoint = { readonly h: number; readonly c: number };

const MAX_STEPS = 64;
const SLICE_POINTS = 360;
const SLICE_ITERATIONS = 24;
const ACHROMATIC = 4e-6;

function labOf(gamut: SolidGamut, rgb: Rgb): Oklab {
  return gamut === "rec2020" ? rec2020ToOklab(rgb) : rgbToOklab(rgb, gamut);
}

/** The explorer's space: x = 2a, y = L - 0.5, z = 2b (spec R5-08). */
function positionOfLab(lab: Oklab): readonly [number, number, number] {
  return [2 * lab[1], lab[0] - 0.5, 2 * lab[2]];
}

/** The encoded channels of face `face` at `(u, v)`, in the face order of R5-07. */
function faceChannels(face: number, u: number, v: number): Rgb {
  const fixed = face % 2;
  switch (face >> 1) {
    case 0:
      return [fixed, u, v];
    case 1:
      return [u, fixed, v];
    default:
      return [u, v, fixed];
  }
}

/**
 * The six faces of the gamut's RGB cube as grids of `steps` by `steps` cells (spec R5-07). Vertex
 * `(i, j)` of face `f` has the index `f * (steps + 1)^2 + j * (steps + 1) + i`.
 */
export function gamutSolid(gamut: SolidGamut, steps: number): GamutSolid {
  if (typeof gamut !== "string") {
    throw new TypeError(`gamutSolid: gamut must be a string, got ${describeType(gamut)}`);
  }
  if (typeof steps !== "number") {
    throw new TypeError(`gamutSolid: steps must be a number, got ${describeType(steps)}`);
  }
  assertOneOf(gamut, SOLID_GAMUTS, "gamutSolid: gamut");
  if (!Number.isInteger(steps) || steps < 1 || steps > MAX_STEPS) {
    throw new RangeError(
      `gamutSolid: steps must be a whole number from 1 to ${MAX_STEPS}, got ${steps}`,
    );
  }
  const side = steps + 1;
  const perFace = side * side;
  const positions = new Float32Array(6 * perFace * 3);
  const colors = new Float32Array(6 * perFace * 3);
  const indices = new Uint16Array(6 * steps * steps * 6);

  for (let face = 0; face < 6; face++) {
    for (let j = 0; j <= steps; j++) {
      for (let i = 0; i <= steps; i++) {
        const vertex = face * perFace + j * side + i;
        const channels = faceChannels(face, i / steps, j / steps);
        const lab = labOf(gamut, channels);
        positions.set(positionOfLab(lab), vertex * 3);
        let display = channels;
        if (gamut !== "srgb") {
          const c = Math.hypot(lab[1], lab[2]);
          const h = c <= ACHROMATIC ? null : (Math.atan2(lab[2], lab[1]) * 180) / Math.PI;
          display = gamutMap({ l: lab[0], c, h }, "srgb");
        }
        colors.set(display, vertex * 3);
      }
    }
    let k = face * steps * steps * 6;
    for (let j = 0; j < steps; j++) {
      for (let i = 0; i < steps; i++) {
        const a = face * perFace + j * side + i;
        const b = a + 1;
        const c = a + side;
        const d = c + 1;
        indices.set([a, b, c, b, d, c], k);
        k += 6;
      }
    }
  }
  return Object.freeze({ gamut, steps, positions, colors, indices });
}

/** The largest in-gamut chroma for Rec. 2020: `maxChroma`'s bisection over `oklchToRec2020`. */
function rec2020MaxChroma(l: number, h: number): number {
  const fits = (c: number): boolean => {
    const rgb = oklchToRec2020({ l, c, h });
    return rgb !== null && withinUnitCube(rgb, RGB_TOLERANCE);
  };
  if (!fits(0)) return 0;
  let low = 0;
  let high = CHROMA_CEILING;
  for (let i = 0; i < SLICE_ITERATIONS; i++) {
    const middle = (low + high) / 2;
    if (fits(middle)) low = middle;
    else high = middle;
  }
  return low;
}

/** The gamut's edge at lightness `l`: 360 points, `h` 0 to 359 (spec R5-08). */
export function gamutSlice(gamut: SolidGamut, l: number): readonly SlicePoint[] {
  if (typeof gamut !== "string") {
    throw new TypeError(`gamutSlice: gamut must be a string, got ${describeType(gamut)}`);
  }
  if (typeof l !== "number") {
    throw new TypeError(`gamutSlice: l must be a number, got ${describeType(l)}`);
  }
  assertOneOf(gamut, SOLID_GAMUTS, "gamutSlice: gamut");
  assertFinite(l, "gamutSlice: l");
  if (l < 0 || l > 1) throw new RangeError(`gamutSlice: l must be within [0, 1], got ${l}`);
  const points: SlicePoint[] = [];
  // The gamut closes at black and at white. `maxChroma`'s tolerance would leave up to 0.012 of
  // chroma at black, where a cube root turns a tiny linear channel into a visible OKLab offset.
  const closed = l === 0 || l === 1;
  for (let h = 0; h < SLICE_POINTS; h++) {
    let c = 0;
    if (!closed) {
      c = gamut === "rec2020" ? rec2020MaxChroma(l, h) : maxChroma(l, h, gamut, SLICE_ITERATIONS);
    }
    points.push(Object.freeze({ h, c: round6(c) }));
  }
  return Object.freeze(points);
}

/** An OKLCH color in the explorer's space: `[2a, L - 0.5, 2b]` (spec R5-08). */
export function solidPosition(color: Oklch): readonly [x: number, y: number, z: number] {
  assertOklch(color, "solidPosition: color");
  return positionOfLab(oklchToOklab(color));
}
