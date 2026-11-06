import Color from "colorjs.io";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { oklchToRec2020, rec2020ToOklab } from "@/engine/color/rec2020";
import type { Oklab } from "@/engine/color/types";

// Cases are the C-COL5-nn rows of docs/specs/05-motion-3d.md, section 14.1. colorjs.io 0.7.1's
// `rec2020` space (the CSS Color 4 one) is the oracle.

const oracle = (rgb: readonly [number, number, number]): Oklab =>
  new Color("rec2020", [...rgb]).to("oklab").coords as unknown as Oklab;

const closeLab = (ours: Oklab, theirs: Oklab, eps: number) => {
  for (let i = 0; i < 3; i++) {
    expect(Math.abs(ours[i] - theirs[i])).toBeLessThan(eps);
  }
};

describe("rec2020ToOklab", () => {
  it("C-COL5-01 matches colorjs.io for the corners, the mid gray and the red", () => {
    const red = rec2020ToOklab([1, 0, 0]);
    closeLab(red, [0.687089042, 0.3327304291, 0.1494382314], 1e-7);
    closeLab(red, oracle([1, 0, 0]), 1e-7);
    for (const rgb of [
      [0, 1, 0],
      [0, 0, 1],
      [0.5, 0.5, 0.5],
      [1, 1, 1],
      [0, 0, 0],
    ] as const) {
      closeLab(rec2020ToOklab(rgb), oracle(rgb), 1e-7);
    }
    const white = rec2020ToOklab([1, 1, 1]);
    expect(Math.abs(white[0] - 1)).toBeLessThan(1e-7);
    expect(Math.abs(white[1])).toBeLessThan(1e-7);
    expect(Math.abs(white[2])).toBeLessThan(1e-7);
  });

  it("C-COL5-02 matches colorjs.io and round-trips for encoded triples in [-0.2, 1.2]", () => {
    const channel = fc.double({ min: -0.2, max: 1.2, noNaN: true });
    fc.assert(
      fc.property(channel, channel, channel, (r, g, b) => {
        const lab = rec2020ToOklab([r, g, b]);
        closeLab(lab, oracle([r, g, b]), 1e-7);
        const c = Math.hypot(lab[1], lab[2]);
        const h = (Math.atan2(lab[2], lab[1]) * 180) / Math.PI;
        const back = oklchToRec2020({ l: lab[0], c, h });
        expect(back).not.toBeNull();
        const triple = back as readonly number[];
        expect(Math.abs(triple[0] - r)).toBeLessThan(1e-6);
        expect(Math.abs(triple[1] - g)).toBeLessThan(1e-6);
        expect(Math.abs(triple[2] - b)).toBeLessThan(1e-6);
      }),
      { numRuns: 1000, seed: 5001 },
    );
  });

  it("C-COL5-03 uses the 2.4 power with the sign kept, not BT.2020's OETF", () => {
    const linear = 0.5 ** 2.4;
    expect(linear).toBeCloseTo(0.1894645708, 9);
    const read = (v: number): Oklab =>
      new Color("rec2020-linear", [v, v, v]).to("oklab").coords as unknown as Oklab;
    closeLab(rec2020ToOklab([0.5, 0.5, 0.5]), read(linear), 1e-7);
    closeLab(rec2020ToOklab([-0.5, -0.5, -0.5]), read(-linear), 1e-7);
    // BT.2020's OETF reads 0.5 as 0.2597194 linear, a visibly different lightness.
    const oetf = read(0.2597194);
    expect(Math.abs(rec2020ToOklab([0.5, 0.5, 0.5])[0] - oetf[0])).toBeGreaterThan(0.01);
  });
});

describe("oklchToRec2020", () => {
  it("C-COL5-04 gives null for an overflow and three finite channels in range", () => {
    expect(oklchToRec2020({ l: 1e103, c: 0, h: null })).toBeNull();
    const rgb = oklchToRec2020({ l: 0.6, c: 0.1, h: 30 });
    expect(rgb).not.toBeNull();
    for (const v of rgb as readonly number[]) expect(Number.isFinite(v)).toBe(true);
  });
});

describe("the errors", () => {
  it("C-COL5-05 throws TypeError, then RangeError, each naming the function", () => {
    const bad = (value: unknown) => rec2020ToOklab(value as never);
    expect(() => bad("x")).toThrow(TypeError);
    expect(() => bad("x")).toThrow(/^rec2020ToOklab/);
    expect(() => bad([1, 2])).toThrow(TypeError);
    expect(() => bad([1, 2])).toThrow(/^rec2020ToOklab/);
    expect(() => bad([Number.NaN, 0, 0])).toThrow(RangeError);
    expect(() => bad([Number.NaN, 0, 0])).toThrow(/^rec2020ToOklab/);
    expect(() => oklchToRec2020(null as never)).toThrow(TypeError);
    expect(() => oklchToRec2020(null as never)).toThrow(/^oklchToRec2020/);
  });
});
