import { describeType } from "@/features/studio/guards";

// The preview's number formats (spec section 6.14): the signed change in meters that the dashboard's
// gauge table and the mobile detail screen write. Pure.

/**
 * A change in meters to one decimal with its sign: a true minus sign (U+2212) or "+", and no sign
 * for a change that rounds to zero ("0.0"). A value that is not a number is a TypeError, `NaN` or an
 * infinity a RangeError (R-05).
 */
export function signed(meters: number): string {
  if (typeof meters !== "number") {
    throw new TypeError(`signed: meters must be a number, got ${describeType(meters)}`);
  }
  if (!Number.isFinite(meters)) {
    throw new RangeError(`signed: meters must be finite, got ${meters}`);
  }
  const rounded = Math.abs(meters).toFixed(1);
  if (Number(rounded) === 0) return "0.0";
  return `${meters > 0 ? "+" : "−"}${rounded}`;
}
