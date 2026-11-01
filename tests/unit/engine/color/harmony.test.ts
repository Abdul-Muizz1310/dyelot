import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type Harmony, harmonyHues } from "@/engine/color/harmony";

// Cases are the C-HARM-nn rows of docs/specs/01-color-engine.md, section 6.3.

const HARMONIES: readonly Harmony[] = [
  "monochrome",
  "analogous",
  "complementary",
  "split",
  "triadic",
  "tetradic",
];

describe("harmonyHues", () => {
  it("C-HARM-01 puts the complement of 350 at 170", () => {
    expect(harmonyHues(350, "complementary").accent).toBe(170);
  });

  it("C-HARM-02 puts the analogous secondary of 10 at 340", () => {
    expect(harmonyHues(10, "analogous").secondary).toBe(340);
  });

  it("C-HARM-03 keeps every output in [0, 360) for any finite hue", () => {
    const hue = fc.oneof(
      fc.double({ min: 0, max: 360, maxExcluded: true, noNaN: true }),
      fc.constantFrom(-30, 720, 1e6, -1e-20, -0, 359.99999999999994),
      fc.double({ min: -1e9, max: 1e9, noNaN: true }),
    );
    fc.assert(
      fc.property(hue, fc.constantFrom(...HARMONIES), (h0, harmony) => {
        const { secondary, accent } = harmonyHues(h0, harmony);
        for (const out of [secondary, accent]) {
          expect(Number.isFinite(out)).toBe(true);
          expect(out).toBeGreaterThanOrEqual(0);
          expect(out).toBeLessThan(360);
          expect(Object.is(out, -0)).toBe(false);
        }
      }),
      { numRuns: 500 },
    );
  });

  it("C-HARM-04 follows the hue table for h0 = 100", () => {
    const table: ReadonlyArray<readonly [Harmony, number, number]> = [
      ["monochrome", 100, 100],
      ["analogous", 70, 130],
      ["complementary", 100, 280],
      ["split", 310, 250],
      ["triadic", 220, 340],
      ["tetradic", 160, 280],
    ];
    for (const [harmony, secondary, accent] of table) {
      expect(harmonyHues(100, harmony), harmony).toEqual({ secondary, accent });
    }
  });

  it("C-HARM-05 normalizes the hue of a monochrome pair", () => {
    expect(harmonyHues(370, "monochrome")).toEqual({ secondary: 10, accent: 10 });
  });

  it("C-HARM-06 throws a RangeError for a hue that is not finite", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      for (const harmony of HARMONIES) {
        expect(() => harmonyHues(bad, harmony)).toThrow(RangeError);
      }
    }
    expect(() => harmonyHues(Number.NaN, "split")).toThrow(/harmonyHues: h0/);
  });

  it("C-HARM-06 throws a RangeError for a harmony outside the union", () => {
    for (const bad of ["", "Split", "tetra", "analogue", "constructor", "toString"]) {
      expect(() => harmonyHues(10, bad as Harmony)).toThrow(RangeError);
    }
    expect(() => harmonyHues(10, "tetra" as Harmony)).toThrow(/harmonyHues: harmony/);
  });

  it("throws a TypeError for a value of the wrong type", () => {
    expect(() => harmonyHues("10" as unknown as number, "split")).toThrow(TypeError);
    expect(() => harmonyHues(10, undefined as unknown as Harmony)).toThrow(TypeError);
    expect(() => harmonyHues(10, 3 as unknown as Harmony)).toThrow(TypeError);
  });

  it("returns a fresh object each call", () => {
    expect(harmonyHues(10, "split")).not.toBe(harmonyHues(10, "split"));
  });
});
