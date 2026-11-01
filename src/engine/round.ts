import { assertFinite } from "./color/guards";

/**
 * A number cut to six significant digits, the precision of every number the engine stores
 * (spec R-02). Negative zero is written as 0. A number that is not finite throws a RangeError.
 */
export function round6(x: number): number {
  assertFinite(x, "round6: x");
  const rounded = Number(x.toPrecision(6));
  return rounded === 0 ? 0 : rounded;
}

/**
 * A hue in degrees through `round6`, with a result of 360 written as 0, so a stored hue stays in
 * [0, 360): `round6(359.99999999999994)` is 360 (spec R-02).
 */
export function roundHue(h: number): number {
  const rounded = round6(h);
  return rounded === 360 ? 0 : rounded;
}
