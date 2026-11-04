import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { fmt4, round1, trunc4 } from "@/export/format";

// C-FMT-01 to 03 of docs/specs/03-export.md, section 10.3 (R3-10).

describe("C-FMT-01 fmt4, trunc4 and round1", () => {
  it.each([
    [0.1, "0.1"],
    [1 / 3, "0.3333"],
    [2 / 3, "0.6667"],
    [0.00005, "0.0001"],
    [-0.00005, "-0.0001"],
    [1e-7, "0"],
    [-1e-7, "0"],
    [-0, "0"],
    [1e21, "1000000000000000000000"],
    [1.13, "1.13"],
    [12, "12"],
    [0.99996, "1"],
    [-9.99995, "-10"],
  ])("fmt4(%s) is %s", (x, expected) => {
    expect(fmt4(x)).toBe(expected);
  });

  it.each([
    [4.49999, "4.4999"],
    [2.99999999, "2.9999"],
    [-1.23456, "-1.2345"],
    [21, "21"],
    [1.13, "1.13"],
    [-0.00001, "0"],
    [1e-7, "0"],
    [1e21, "1000000000000000000000"],
    [-0, "0"],
  ])("trunc4(%s) is %s", (x, expected) => {
    expect(trunc4(x)).toBe(expected);
  });

  it.each([
    [2.25, 2.3],
    [-2.25, -2.3],
    [12.04, 12],
    [-0.04, 0],
    [0.05, 0.1],
  ])("round1(%s) is %s", (x, expected) => {
    expect(round1(x)).toBe(expected);
    expect(Object.is(round1(x), -0)).toBe(false);
  });
});

describe("C-FMT-02 trunc4 never reads as passing", () => {
  const THRESHOLDS = [0.05, 0.08, 0.1, 3, 4.5, 7];
  const near = fc.oneof(
    ...THRESHOLDS.map((t) => fc.double({ min: t - 0.001, max: t + 0.001, noNaN: true })),
    fc.double({ min: 0, max: 25, noNaN: true }),
  );

  it("holds over 10,000 runs", () => {
    fc.assert(
      fc.property(near, (x) => {
        for (const t of THRESHOLDS) if (Number(trunc4(x)) >= t) expect(x).toBeGreaterThanOrEqual(t);
        expect(Number(trunc4(x))).toBeLessThanOrEqual(x);
        expect(Math.abs(Number(fmt4(x)) - x)).toBeLessThanOrEqual(0.00005 + 1e-12);
        expect(fmt4(x)).not.toMatch(/e/);
        expect(trunc4(x)).not.toMatch(/e/);
      }),
      { numRuns: 10_000, seed: 3006 },
    );
  });
});

describe("C-FMT-03 the helpers guard their input", () => {
  const helpers = { fmt4, trunc4, round1 };
  for (const [name, fn] of Object.entries(helpers)) {
    it(`${name} throws RangeError for a number that is not finite`, () => {
      for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
        expect(() => fn(bad)).toThrow(RangeError);
        expect(() => fn(bad)).toThrow(name);
      }
    });
    it(`${name} throws TypeError for a non-number`, () => {
      for (const bad of ["1", null, undefined, BigInt(1)]) {
        expect(() => fn(bad as unknown as number)).toThrow(TypeError);
        expect(() => fn(bad as unknown as number)).toThrow(name);
      }
    });
  }
});
