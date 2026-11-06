import { assertFinite, describeType } from "../color/guards";

/** Cubic-bezier control points `[x1, y1, x2, y2]`, as `BezierSchema` stores them. */
export type Bezier = readonly [x1: number, y1: number, x2: number, y2: number];

const NAME = "bezierPoints";

const round4 = (value: number): number => {
  const rounded = Math.round(value * 10000) / 10000;
  return rounded === 0 ? 0 : rounded;
};

/**
 * The cubic Bezier with control points (0, 0), (x1, y1), (x2, y2) and (1, 1) sampled at
 * `t = i / segments` for i = 0 to `segments` (R5-13): `segments + 1` points `[x, y]`, each
 * coordinate to 4 decimals, negative zero written 0. `easing` follows `BezierSchema` and `segments`
 * is a whole number from 2 to 256.
 */
export function bezierPoints(
  easing: Bezier,
  segments: number,
): readonly (readonly [x: number, y: number])[] {
  if (!Array.isArray(easing)) {
    throw new TypeError(`${NAME}: easing must be an array, got ${describeType(easing)}`);
  }
  if (typeof segments !== "number") {
    throw new TypeError(`${NAME}: segments must be a number, got ${describeType(segments)}`);
  }
  if (easing.length !== 4) {
    throw new RangeError(`${NAME}: easing must hold 4 numbers, got ${easing.length}`);
  }
  const [x1, y1, x2, y2] = easing as readonly unknown[];
  assertFinite(x1, `${NAME}: easing[0]`);
  assertFinite(y1, `${NAME}: easing[1]`);
  assertFinite(x2, `${NAME}: easing[2]`);
  assertFinite(y2, `${NAME}: easing[3]`);
  for (const [index, x] of [
    [0, x1],
    [2, x2],
  ] as const) {
    if (x < 0 || x > 1) {
      throw new RangeError(`${NAME}: easing[${index}] must lie in [0, 1], got ${x}`);
    }
  }
  if (!Number.isInteger(segments) || segments < 2 || segments > 256) {
    throw new RangeError(`${NAME}: segments must be a whole number from 2 to 256, got ${segments}`);
  }
  const at = (t: number, p1: number, p2: number): number => {
    const u = 1 - t;
    return 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t;
  };
  const points: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    points.push([round4(at(t, x1, x2)), round4(at(t, y1, y2))]);
  }
  return points;
}
