import { assertFinite } from "../color/guards";

/** The spec's spacing steps, in units of the base. */
const UNITS = [0, 1, 2, 3, 4, 6, 8, 12, 16, 20, 24, 32] as const;

/**
 * The spacing scale: `0 1 2 3 4 6 8 12 16 20 24 32` times the base. M1 has one base, 4 px, and
 * any other value throws. Each call returns a new array.
 */
export function spaceScale(basePx: 4): readonly number[] {
  assertFinite(basePx, "spaceScale: basePx");
  if (basePx !== 4) {
    throw new RangeError(`spaceScale: basePx must be 4, got ${basePx}`);
  }
  return UNITS.map((unit) => unit * basePx);
}
