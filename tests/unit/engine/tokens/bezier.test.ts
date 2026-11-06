import { describe, expect, it } from "vitest";
import { type Bezier, bezierPoints } from "@/engine/tokens/bezier";

// Cases C-MOT5-11 and C-MOT5-12 of docs/specs/05-motion-3d.md, section 14.2 (R5-13).

describe("bezierPoints", () => {
  it("C-MOT5-11 samples the curve at t = i / segments", () => {
    expect(bezierPoints([0.2, 0, 0, 1], 2)).toEqual([
      [0, 0],
      [0.2, 0.5],
      [1, 1],
    ]);
  });

  it("C-MOT5-11 gives a straight line for a linear curve", () => {
    const points = bezierPoints([0, 0, 1, 1], 4);
    expect(points).toHaveLength(5);
    for (const [x, y] of points) expect(x).toBe(y);
  });

  it("C-MOT5-11 writes a y that rounds to negative zero as 0", () => {
    // At t = 1/256 this curve's y is about -2.3e-6, which rounds to -0 at 4 decimals.
    const points = bezierPoints([0.5, -0.0002, 0.5, 1], 256);
    const [, y] = points[1] as readonly [number, number];
    expect(Object.is(y, 0)).toBe(true);
    for (const point of points) for (const value of point) expect(Object.is(value, -0)).toBe(false);
  });

  it("C-MOT5-11 starts at [0, 0], ends at [1, 1] and rounds to 4 decimals", () => {
    const points = bezierPoints([0.05, 0.7, 0.1, 1], 64);
    expect(points).toHaveLength(65);
    expect(points[0]).toEqual([0, 0]);
    expect(points[64]).toEqual([1, 1]);
    for (const [x, y] of points) {
      expect(x).toBe(Number(x.toFixed(4)));
      expect(y).toBe(Number(y.toFixed(4)));
    }
  });

  it.each([
    ["an easing that is a string", "x", 4, TypeError],
    ["segments that is a string", [0.2, 0, 0, 1], "4", TypeError],
    ["three numbers", [0.2, 0, 0], 4, RangeError],
    ["an x1 of 1.2", [1.2, 0, 0, 1], 4, RangeError],
    ["a NaN", [0.2, Number.NaN, 0, 1], 4, RangeError],
    ["segments of 1", [0.2, 0, 0, 1], 1, RangeError],
    ["segments of 257", [0.2, 0, 0, 1], 257, RangeError],
    ["segments of 2.5", [0.2, 0, 0, 1], 2.5, RangeError],
  ])("C-MOT5-12 rejects %s", (_, easing, segments, kind) => {
    const run = () => bezierPoints(easing as unknown as Bezier, segments as number);
    expect(run).toThrow(kind);
    expect(run).toThrow(/^bezierPoints/);
  });
});
