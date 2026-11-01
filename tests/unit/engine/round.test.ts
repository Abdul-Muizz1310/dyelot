import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { round6, roundHue } from "@/engine/round";

// Cases are the C-ROUND-nn rows of docs/specs/01-color-engine.md, section 6.4 (R-02).

describe("round6", () => {
  it("C-ROUND-01 keeps six significant digits", () => {
    expect(round6(0.7002508346689501)).toBe(0.700251);
    expect(round6(22.0638415289496)).toBe(22.0638);
    expect(round6(1234567)).toBe(1234570);
    expect(round6(4e-7)).toBe(4e-7);
  });

  it("C-ROUND-02 writes zero and negative zero as 0", () => {
    expect(round6(0)).toBe(0);
    expect(Object.is(round6(-0), 0)).toBe(true);
    expect(Object.is(round6(-1e-30 * 0), 0)).toBe(true);
  });

  it("C-ROUND-03 is idempotent", () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true, noDefaultInfinity: true }), (x) => {
        expect(round6(round6(x))).toBe(round6(x));
      }),
      { numRuns: 500 },
    );
  });

  it("C-ROUND-04 throws RangeError on NaN and Infinity", () => {
    expect(() => round6(Number.NaN)).toThrow(RangeError);
    expect(() => round6(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => round6(Number.NEGATIVE_INFINITY)).toThrow(RangeError);
  });
});

describe("roundHue", () => {
  it("C-ROUND-05 writes a hue that rounds to 360 as 0", () => {
    expect(round6(359.99999999999994)).toBe(360);
    expect(roundHue(359.99999999999994)).toBe(0);
    expect(roundHue(359.9995)).toBe(0);
    expect(roundHue(359.9994999)).toBe(359.999);
    expect(roundHue(262.3456789)).toBe(262.346);
  });

  it("C-ROUND-06 throws RangeError on NaN and Infinity", () => {
    expect(() => roundHue(Number.NaN)).toThrow(RangeError);
    expect(() => roundHue(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});
