import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { nestedRadius, radiusScale } from "@/engine/tokens/shape";

// Cases are the C-SHAPE-nn rows of docs/specs/01-color-engine.md, section 6.6.

type RadiusSet = "sharp" | "soft" | "round";
const SETS: readonly RadiusSet[] = ["sharp", "soft", "round"];
const KEYS = ["sm", "md", "lg", "xl", "2xl"] as const;

describe("radiusScale", () => {
  it("C-SHAPE-01 gives the three radius sets and full 9999", () => {
    const expected: Record<RadiusSet, readonly number[]> = {
      sharp: [0, 2, 4, 6, 8],
      soft: [4, 8, 12, 16, 24],
      round: [8, 12, 16, 24, 32],
    };
    for (const set of SETS) {
      const scale = radiusScale(set);
      expect(
        KEYS.map((key) => scale[key]),
        set,
      ).toEqual(expected[set]);
      expect(scale.full, set).toBe(9999);
    }
  });

  it("C-SHAPE-04 orders sm <= md <= lg <= xl <= 2xl < full", () => {
    for (const set of SETS) {
      const s = radiusScale(set);
      expect(s.sm).toBeLessThanOrEqual(s.md);
      expect(s.md).toBeLessThanOrEqual(s.lg);
      expect(s.lg).toBeLessThanOrEqual(s.xl);
      expect(s.xl).toBeLessThanOrEqual(s["2xl"]);
      expect(s["2xl"]).toBeLessThan(s.full);
    }
  });

  it("returns a fresh object each call", () => {
    const first = radiusScale("soft") as { sm: number };
    first.sm = 99;
    expect(radiusScale("soft").sm).toBe(4);
  });

  it("C-SHAPE-05 throws RangeError for an unknown set", () => {
    for (const set of ["", "Soft", "square", "toString", "constructor"]) {
      expect(() => radiusScale(set as RadiusSet), set).toThrow(RangeError);
    }
    expect(() => radiusScale("square" as RadiusSet)).toThrow(/set/);
  });

  it("C-SHAPE-05 throws TypeError for a set that is not a string", () => {
    expect(() => radiusScale(1 as unknown as RadiusSet)).toThrow(TypeError);
  });
});

describe("nestedRadius", () => {
  it("C-SHAPE-02 subtracts the padding and floors at 0", () => {
    expect(nestedRadius(16, 20)).toBe(0);
    expect(nestedRadius(24, 8)).toBe(16);
  });

  it("C-SHAPE-03 keeps the outer radius for no padding", () => {
    expect(nestedRadius(8, 0)).toBe(8);
  });

  it("C-SHAPE-03 equals max(0, outer - padding) and lies in [0, outer]", () => {
    const px = fc.double({ min: 0, max: 10_000, noNaN: true });
    fc.assert(
      fc.property(px, px, (outer, padding) => {
        const result = nestedRadius(outer, padding);
        expect(result).toBe(Math.max(0, outer - padding));
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(outer);
        expect(Object.is(result, -0)).toBe(false);
      }),
      { numRuns: 500 },
    );
  });

  it("C-SHAPE-05 throws RangeError for a negative or non-finite pixel argument", () => {
    for (const bad of [
      -1,
      -0.001,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ]) {
      expect(() => nestedRadius(bad, 4), `outer ${bad}`).toThrow(RangeError);
      expect(() => nestedRadius(4, bad), `padding ${bad}`).toThrow(RangeError);
    }
    expect(() => nestedRadius(-1, 4)).toThrow(/outerPx/);
    expect(() => nestedRadius(4, -1)).toThrow(/paddingPx/);
  });

  it("C-SHAPE-05 throws TypeError for a pixel argument that is not a number", () => {
    expect(() => nestedRadius("8" as unknown as number, 4)).toThrow(TypeError);
    expect(() => nestedRadius(8, null as unknown as number)).toThrow(TypeError);
  });

  it("writes negative zero as 0", () => {
    expect(Object.is(nestedRadius(0, 0), 0)).toBe(true);
    expect(Object.is(nestedRadius(4, 4), 0)).toBe(true);
  });
});
