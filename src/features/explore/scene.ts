import {
  type Hex,
  type Mode,
  type Oklch,
  PALETTE_NAMES,
  type PaletteName,
  type SlicePoint,
  SOLID_GAMUTS,
  type SolidGamut,
  STEPS,
  type Step,
  solidPosition,
} from "@/engine";
import {
  assertFinite,
  assertOneOf,
  assertRecord,
  assertString,
  describeType,
} from "@/features/studio/guards";
import type { DesignSpec } from "@/spec";

// The explorer's scene math (R5-36 to R5-39, spec 8.2 to 8.4). Pure, so the 3D page and the flat
// view share it and a test reads it in Node.

const MODES = ["light", "dark"] as const satisfies readonly Mode[];

/** One step of the design as the explorer places it (R5-36). */
export type ScenePoint = {
  readonly palette: PaletteName;
  readonly step: Step;
  readonly hex: Hex;
  readonly oklch: Oklch;
  readonly position: readonly [number, number, number];
  readonly seed: boolean;
};

/** The 88 steps of the design in `mode`, palette by palette and step by step (R5-36). */
export function scenePoints(spec: DesignSpec, mode: Mode): readonly ScenePoint[] {
  assertRecord(spec, "scenePoints: spec");
  assertOneOf(mode, MODES, "scenePoints: mode");
  const points: ScenePoint[] = [];
  for (const palette of PALETTE_NAMES) {
    const source = spec.color.palettes[palette];
    const seed = source.seedStep?.[mode];
    for (const entry of source[mode]) {
      points.push(
        Object.freeze({
          palette,
          step: entry.step,
          hex: entry.hex,
          oklch: entry.oklch,
          position: solidPosition(entry.oklch),
          seed: seed === entry.step,
        }),
      );
    }
  }
  return Object.freeze(points);
}

/** How far a step's lightness may sit from the slice and still show in the flat view (R5-37). */
const SLICE_BAND = 0.04;
/** Absorbs the rounding of a subtraction such as 0.64 - 0.6, which is 0.04000000000000004. */
const BAND_EPSILON = 1e-9;

function assertLightness(l: unknown, name: string): asserts l is number {
  assertFinite(l, name);
  if (l < 0 || l > 1) throw new RangeError(`${name} must be within [0, 1], got ${l}`);
}

/** The points whose lightness is within 0.04 of `l`, in their order (R5-37). */
export function sliceSteps(points: readonly ScenePoint[], l: number): readonly ScenePoint[] {
  if (!Array.isArray(points)) {
    throw new TypeError(`sliceSteps: points must be an array, got ${describeType(points)}`);
  }
  assertLightness(l, "sliceSteps: l");
  return points.filter((point) => Math.abs(point.oklch.l - l) <= SLICE_BAND + BAND_EPSILON);
}

/** The explorer's camera as its sliders hold it (R5-38): degrees around, degrees above, a factor. */
export type Camera = { readonly turn: number; readonly tilt: number; readonly zoom: number };

export const DEFAULT_CAMERA: Camera = Object.freeze({ turn: 35, tilt: 25, zoom: 1 });

const CAMERA_DISTANCE = 3.2;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;
const ZOOM_PER_UNIT = 20; // a zoom step is 0.05
const POLE_EPSILON = 1e-9;
const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Where the camera sits, `3.2 / zoom` from the origin (8.2). */
export function cameraPosition(camera: Camera): readonly [number, number, number] {
  assertRecord(camera, "cameraPosition: camera");
  const { turn, tilt, zoom } = camera;
  assertFinite(turn, "cameraPosition: turn");
  assertFinite(tilt, "cameraPosition: tilt");
  assertFinite(zoom, "cameraPosition: zoom");
  if (turn < -180 || turn > 180) {
    throw new RangeError(`cameraPosition: turn must be within [-180, 180], got ${turn}`);
  }
  if (tilt < 0 || tilt > 90) {
    throw new RangeError(`cameraPosition: tilt must be within [0, 90], got ${tilt}`);
  }
  if (zoom < ZOOM_MIN || zoom > ZOOM_MAX) {
    throw new RangeError(`cameraPosition: zoom must be within [0.5, 2], got ${zoom}`);
  }
  const distance = CAMERA_DISTANCE / zoom;
  const flat = Math.cos(toRad(tilt));
  return [
    distance * flat * Math.sin(toRad(turn)),
    distance * Math.sin(toRad(tilt)),
    distance * flat * Math.cos(toRad(turn)),
  ];
}

/** `value` rounded to the nearest whole degree, with no negative zero. */
const whole = (value: number) => Math.round(value) || 0;

/** A turn in degrees as a whole number from -180 to 180. */
function wrapTurn(turn: number): number {
  const rounded = whole(turn);
  const wrapped = ((((rounded + 180) % 360) + 360) % 360) - 180;
  // 180 and -180 name one direction; keep the one the input was nearer to.
  return wrapped === -180 && rounded > 0 ? 180 : wrapped || 0;
}

/**
 * The camera at `position`, the inverse of `cameraPosition`: whole degrees (turn wrapped into
 * -180 to 180, tilt clamped to 0 to 90) and a zoom in steps of 0.05 within 0.5 to 2. On the axis a
 * position names no turn, so `heldTurn` stays (8.2).
 */
export function cameraOf(position: readonly [number, number, number], heldTurn: number): Camera {
  if (!Array.isArray(position)) {
    throw new TypeError(`cameraOf: position must be an array, got ${describeType(position)}`);
  }
  if (position.length !== 3) {
    throw new RangeError(`cameraOf: position must hold 3 numbers, got ${position.length}`);
  }
  for (const [index, value] of position.entries()) {
    assertFinite(value, `cameraOf: position[${index}]`);
  }
  assertFinite(heldTurn, "cameraOf: heldTurn");
  const [x, y, z] = position;
  const distance = Math.hypot(x, y, z);
  if (distance === 0) throw new RangeError("cameraOf: position must not be the origin");
  const horizontal = Math.hypot(x, z);
  const turn = horizontal < POLE_EPSILON * distance ? heldTurn : toDeg(Math.atan2(x, z));
  const tilt = Math.min(90, Math.max(0, whole(toDeg(Math.atan2(y, horizontal)))));
  const zoom = Math.round((CAMERA_DISTANCE / distance) * ZOOM_PER_UNIT) / ZOOM_PER_UNIT;
  return {
    turn: wrapTurn(turn),
    tilt,
    zoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom)),
  };
}

/** The flat view's plot: its center, and the radius at which chroma 0.5 sits, on a 320 box (8.3). */
const PLOT_BOX = 320;
const PLOT_CENTER = 160;
const PLOT_RADIUS = 150;
const PLOT_CHROMA = 0.5;

const round2 = (value: number) => Math.round(value * 100) / 100 || 0;

function assertSize(size: unknown, name: string): asserts size is number {
  assertFinite(size, name);
  if (size <= 0) throw new RangeError(`${name} must be above 0, got ${size}`);
}

/** The place of hue `h` (degrees, or null) and chroma `c` in a `size` box, to 2 decimals. */
function plot(h: number | null, c: number, size: number): readonly [number, number] {
  const scale = size / PLOT_BOX;
  const center = PLOT_CENTER * scale;
  if (h === null) return [round2(center), round2(center)];
  const radius = (c / PLOT_CHROMA) * PLOT_RADIUS * scale;
  return [
    round2(center + radius * Math.cos(toRad(h))),
    round2(center - radius * Math.sin(toRad(h))),
  ];
}

/** The SVG path of one gamut's outline at a slice, in a `size` box (R5-37, 8.3). */
export function slicePath(points: readonly SlicePoint[], size: number): string {
  if (!Array.isArray(points)) {
    throw new TypeError(`slicePath: points must be an array, got ${describeType(points)}`);
  }
  points.forEach((point, index) => {
    assertRecord(point, `slicePath: points[${index}]`);
    assertFinite(point.h, `slicePath: points[${index}].h`);
    assertFinite(point.c, `slicePath: points[${index}].c`);
  });
  assertSize(size, "slicePath: size");
  const vertices = points.map((point, index) => {
    const [x, y] = plot(point.h, point.c, size);
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  });
  return `${vertices.join("")}Z`;
}

/** Where a step sits in a `size` box; an achromatic step (hue null) sits at the center (R5-37). */
export function dotAt(oklch: Oklch, size: number): readonly [x: number, y: number] {
  assertRecord(oklch, "dotAt: oklch");
  if (oklch.h !== null) assertFinite(oklch.h, "dotAt: oklch.h");
  assertFinite(oklch.c, "dotAt: oklch.c");
  assertSize(size, "dotAt: size");
  return plot(oklch.h, oklch.c, size);
}

/** The gamuts' names as a person reads them. */
export const GAMUT_NAMES: Readonly<Record<SolidGamut, string>> = Object.freeze({
  srgb: "sRGB",
  p3: "Display P3",
  rec2020: "Rec. 2020",
});

/** The one line under the 3D panel (8.3). */
export function sceneSummary(name: string, mode: Mode, gamut: SolidGamut, l: number): string {
  assertString(name, "sceneSummary: name");
  assertString(mode, "sceneSummary: mode");
  assertString(gamut, "sceneSummary: gamut");
  assertFinite(l, "sceneSummary: l");
  assertOneOf(mode, MODES, "sceneSummary: mode");
  assertOneOf(gamut, SOLID_GAMUTS, "sceneSummary: gamut");
  assertLightness(l, "sceneSummary: l");
  const count = PALETTE_NAMES.length * STEPS.length;
  return `${name}: ${count} steps of the ${mode} scales in OKLab, inside the ${GAMUT_NAMES[gamut]} gamut solid, cut at L ${l.toFixed(2)}.`;
}

/** The explorer's sentences (8.4). */
export const EXPLORE_LINES = Object.freeze({
  loading: "Loading the 3D view…",
  "no-webgl2": "This browser cannot draw the 3D view, so the flat view below shows the same slice.",
  "context-lost": "The 3D view stopped, so the flat view shows the same slice.",
  restart: "Restart the 3D view",
  "load-failed": "The 3D view could not load. Reload the page to try again.",
  "bad-link": "The explorer shows the default design instead.",
  "bad-link-kept": "The explorer keeps the current design.",
} as const);
