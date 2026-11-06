import Color from "colorjs.io";
import { describe, expect, it } from "vitest";
import { maxChroma } from "@/engine/color/gamut";
import { gamutSlice, SOLID_GAMUTS } from "@/engine/color/solid";
import { round6 } from "@/engine/round";

// Cases are the C-SLICE-nn rows of docs/specs/05-motion-3d.md, section 14.1.

describe("gamutSlice", () => {
  it("C-SLICE-01 holds 360 frozen points, each the round6 of M1's maxChroma", () => {
    for (const gamut of ["srgb", "p3"] as const) {
      const slice = gamutSlice(gamut, 0.6);
      expect(slice).toHaveLength(360);
      expect(Object.isFrozen(slice)).toBe(true);
      slice.forEach((point, h) => {
        expect(point.h).toBe(h);
        expect(point.c).toBe(round6(maxChroma(0.6, h, gamut, 24)));
      });
    }
    expect(() => maxChroma(0.6, 0, "rec2020" as never)).toThrow(RangeError);
  });

  it("C-SLICE-02 nests sRGB inside P3 and Rec. 2020, and P3 inside Rec. 2020 bar its red corner", () => {
    for (const l of [0.3, 0.5, 0.7, 0.9]) {
      const [srgb, p3, rec] = SOLID_GAMUTS.map((gamut) => gamutSlice(gamut, l));
      for (let h = 0; h < 360; h++) {
        expect(srgb[h].c).toBeLessThanOrEqual(p3[h].c + 1e-6);
        expect(srgb[h].c).toBeLessThanOrEqual(rec[h].c + 1e-6);
        // P3's red primary lies 0.002 outside Rec. 2020 in xy, so the P3 edge passes the Rec. 2020
        // edge by up to 1.6e-3 of chroma near hues 29 to 35 and 194 to 197.
        expect(p3[h].c).toBeLessThanOrEqual(rec[h].c + 2e-3);
      }
    }
  });

  it("C-SLICE-03 closes at black and at white", () => {
    for (const gamut of SOLID_GAMUTS) {
      for (const l of [0, 1]) {
        for (const point of gamutSlice(gamut, l)) expect(point.c).toBeLessThanOrEqual(1e-6);
      }
    }
  });

  it("C-SLICE-04 puts the Rec. 2020 edge on colorjs.io's gamut boundary", () => {
    const slice = gamutSlice("rec2020", 0.6);
    for (const h of [0, 90, 180, 270]) {
      const c = slice[h].c;
      // round6 can move c up by 5e-7, and the 2.4 power reads that as 1e-3 of a channel at 0.
      const inside = new Color("oklch", [0.6, c - 1e-6, h]);
      const outside = new Color("oklch", [0.6, c + 0.001, h]);
      expect(inside.inGamut("rec2020", { epsilon: 1e-6 })).toBe(true);
      expect(outside.inGamut("rec2020", { epsilon: 1e-6 })).toBe(false);
    }
  });

  it("C-SLICE-05 checks types first, then the domains, each naming gamutSlice", () => {
    const call = (gamut: unknown, l: unknown) => () => gamutSlice(gamut as never, l as never);
    for (const l of [-0.01, 1.01, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(call("srgb", l)).toThrow(RangeError);
      expect(call("srgb", l)).toThrow(/^gamutSlice/);
    }
    for (const args of [
      ["srgb", "1"],
      [3, 0.5],
    ] as const) {
      expect(call(args[0], args[1])).toThrow(TypeError);
      expect(call(args[0], args[1])).toThrow(/^gamutSlice/);
    }
    expect(call("rec709", 0.5)).toThrow(RangeError);
    expect(call("rec709", 0.5)).toThrow(/^gamutSlice/);
  });
});
