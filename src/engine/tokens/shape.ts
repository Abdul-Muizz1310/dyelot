import { assertFinite, assertOneOf } from "../color/guards";

export type RadiusSet = "sharp" | "soft" | "round";
export type RadiusScale = {
  sm: number;
  md: number;
  lg: number;
  xl: number;
  "2xl": number;
  full: 9999;
};

const RADIUS_SETS = {
  sharp: [0, 2, 4, 6, 8],
  soft: [4, 8, 12, 16, 24],
  round: [8, 12, 16, 24, 32],
} as const satisfies Record<RadiusSet, readonly number[]>;

const SET_NAMES = Object.keys(RADIUS_SETS) as RadiusSet[];

/** The radii of a set in px, `sm` to `2xl`, plus `full` (a pill). Each call returns a new object. */
export function radiusScale(set: RadiusSet): RadiusScale {
  assertOneOf(set, SET_NAMES, "radiusScale: set");
  const [sm, md, lg, xl, xxl] = RADIUS_SETS[set];
  return { sm, md, lg, xl, "2xl": xxl, full: 9999 };
}

function assertPixels(value: unknown, name: string): asserts value is number {
  assertFinite(value, name);
  if (value < 0) throw new RangeError(`${name} must not be negative, got ${value}`);
}

/**
 * The radius of a child that sits `paddingPx` inside a parent of radius `outerPx`:
 * `max(0, outer - padding)`. Its curve then shares a center with the parent's.
 */
export function nestedRadius(outerPx: number, paddingPx: number): number {
  assertPixels(outerPx, "nestedRadius: outerPx");
  assertPixels(paddingPx, "nestedRadius: paddingPx");
  // Math.max(0, -0) is +0, so a result of negative zero never leaves this function.
  return Math.max(0, outerPx - paddingPx);
}
