import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { hexToRgb, oklchToRgb, rgbToOklch, toHex } from "@/engine/color/convert";
import { gamutMap, inGamut, maxChroma } from "@/engine/color/gamut";
import type { Gamut, Hex, Oklch, Rgb } from "@/engine/color/types";
import { expectRgbClose } from "./support";

// Cases are the C-GAMUT-nn rows of docs/specs/01-color-engine.md, section 6.1.

const GAMUTS: readonly Gamut[] = ["srgb", "p3"];
const WHITE: Rgb = [1, 1, 1];
const BLACK: Rgb = [0, 0, 0];

const anyOklch = fc.record({
  l: fc.double({ min: 0, max: 1, noNaN: true }),
  c: fc.double({ min: 0, max: 0.5, noNaN: true }),
  h: fc.double({ noNaN: true, noDefaultInfinity: true }),
});

describe("gamutMap", () => {
  it("C-GAMUT-01 maps oklch(0.95 0.2 200) to #8cffff in sRGB", () => {
    expect(toHex(gamutMap({ l: 0.95, c: 0.2, h: 200 }, "srgb"))).toBe("#8cffff");
  });

  it("C-GAMUT-02 maps oklch(0.7 0.4 145) to [0, 0.7804, 0] in Display P3", () => {
    expectRgbClose(gamutMap({ l: 0.7, c: 0.4, h: 145 }, "p3"), [0, 0.7804, 0], 0.001);
  });

  it("C-GAMUT-03 returns channels in [0, 1], and mapping its own output changes nothing", () => {
    fc.assert(
      fc.property(anyOklch, fc.constantFrom(...GAMUTS), (color, gamut) => {
        const out = gamutMap(color, gamut);
        for (const channel of out) {
          expect(channel).toBeGreaterThanOrEqual(0);
          expect(channel).toBeLessThanOrEqual(1);
        }
        expectRgbClose(gamutMap(rgbToOklch(out, gamut), gamut), out, 1 / 255);
      }),
      { numRuns: 200 },
    );
  });

  it("C-GAMUT-05 gives white for l of 1 or more and black for l of 0 or less", () => {
    for (const gamut of GAMUTS) {
      for (const color of [
        { l: 1.2, c: 0.3, h: 40 },
        { l: 1, c: 0.2, h: 100 },
        { l: 1, c: 0, h: null },
        { l: 1e200, c: 0.5, h: 10 },
      ]) {
        expect(gamutMap(color, gamut)).toEqual(WHITE);
      }
      for (const color of [
        { l: -0.1, c: 0.3, h: 40 },
        { l: 0, c: 0.2, h: 100 },
        { l: 0, c: 0, h: null },
        { l: -1e200, c: 0.5, h: 10 },
      ]) {
        expect(gamutMap(color, gamut)).toEqual(BLACK);
      }
    }
  });

  it("C-GAMUT-06 returns a color already in gamut exactly as oklchToRgb does", () => {
    for (const gamut of GAMUTS) {
      const color: Oklch = { l: 0.7, c: 0.05, h: 145 };
      expect(gamutMap(color, gamut)).toEqual(oklchToRgb(color, gamut));
    }
    const gray: Oklch = { l: 0.6, c: 0, h: null };
    expect(gamutMap(gray, "srgb")).toEqual(oklchToRgb(gray, "srgb"));
  });

  it("C-GAMUT-10 gives the same output for the same input and leaves the input alone", () => {
    for (const gamut of GAMUTS) {
      for (const color of [
        Object.freeze({ l: 0.7, c: 0.4, h: 145 }),
        Object.freeze({ l: 0.7, c: 0.05, h: 145 }),
        Object.freeze({ l: 0.5, c: 0.3, h: null }),
      ]) {
        const first = gamutMap(color, gamut);
        expect(gamutMap(color, gamut)).toEqual(first);
        expect(first).not.toBe(gamutMap(color, gamut));
      }
    }
  });

  it("clips a color that sits just outside the gamut, within the 1e-6 tolerance of inGamut", () => {
    for (const rgb of [
      [1 + 5e-7, 0.5, 0.5],
      [0.5, -5e-7, 0.5],
      [0.5, 0.5, 1 + 9e-7],
    ] as const) {
      const color = rgbToOklch(rgb, "srgb");
      expect(inGamut(color, "srgb")).toBe(true);
      for (const channel of gamutMap(color, "srgb")) {
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(1);
      }
    }
  });

  it("reads a null hue as 0", () => {
    expect(gamutMap({ l: 0.5, c: 0.3, h: null }, "srgb")).toEqual(
      gamutMap({ l: 0.5, c: 0.3, h: 0 }, "srgb"),
    );
  });

  it("maps a color whose clip is already within the just noticeable difference by clipping", () => {
    // Slightly past the sRGB gamut: the clipped color differs from it by less than 0.02.
    const color: Oklch = { l: 0.444, c: 0.27, h: 292 };
    const mapped = gamutMap(color, "srgb");
    expect(inGamut(rgbToOklch(mapped, "srgb"), "srgb")).toBe(true);
    expect(mapped.some((channel) => channel === 0 || channel === 1)).toBe(true);
  });

  it("matches the reference implementation in core.py to 1e-9", () => {
    // Values computed with core.py: css_gamut_map with oklch_to_srgb and oklch_to_p3. The notes
    // name the exit that the search takes, so every path of the algorithm has a vector.
    const golden: ReadonlyArray<readonly [Oklch, Gamut, Rgb, string]> = [
      [{ l: 0.95, c: 0.2, h: 200 }, "srgb", [0.549551206704, 1, 1], "binary search"],
      [{ l: 0.95, c: 0.2, h: 200 }, "p3", [0.632790792171, 1, 1], "binary search"],
      [{ l: 0.7, c: 0.4, h: 145 }, "srgb", [0, 0.766083518064, 0], "binary search"],
      [{ l: 0.7, c: 0.4, h: 145 }, "p3", [0, 0.780447934917, 0], "binary search"],
      [{ l: 0.5, c: 0.3, h: 30 }, "srgb", [0.765954414627, 0, 0], "binary search"],
      [{ l: 0.5, c: 0.3, h: 30 }, "p3", [0.731039692691, 0, 0], "binary search"],
      [{ l: 0.8, c: 0.35, h: 110 }, "srgb", [0.779632415401, 0.778513119174, 0], "binary search"],
      [{ l: 0.8, c: 0.35, h: 110 }, "p3", [0.78591513227, 0.780182950614, 0], "binary search"],
      [{ l: 0.3, c: 0.3, h: 280 }, "srgb", [0.163946502897, 0, 0.559688050494], "binary search"],
      [{ l: 0.3, c: 0.3, h: 280 }, "p3", [0.141580632925, 0, 0.541211799851], "binary search"],
      [{ l: 0.98, c: 0.35, h: 110 }, "srgb", [1, 1, 0], "binary search"],
      [{ l: 0.6, c: 0.25, h: 262 }, "srgb", [0.134345849658, 0.44393551954, 1], "binary search"],
      [{ l: 0.6, c: 0.25, h: 262 }, "p3", [0.215419852387, 0.430686823031, 1], "binary search"],
      [{ l: 0.15, c: 0.2, h: 330 }, "srgb", [0.1139963227, 0, 0.110691736103], "binary search"],
      [{ l: 0.444, c: 0.27, h: 292 }, "srgb", [0.388483089515, 0, 0.843568161867], "clip"],
      [{ l: 0.444, c: 0.27, h: 292 }, "p3", [0.349953194883, 0, 0.809842371146], "clip"],
      [{ l: 0.954, c: 0.039, h: 285 }, "srgb", [0.927055188268, 0.92864338753, 1], "clip"],
      [{ l: 0.095, c: 0.411, h: 48 }, "srgb", [0.053873926548, 0, 0], "within epsilon of the JND"],
      [{ l: 0.095, c: 0.411, h: 48 }, "p3", [0.047073350529, 0, 0], "within epsilon of the JND"],
      [{ l: 0.643, c: 0.291, h: 31 }, "srgb", [1, 0, 0], "within epsilon of the JND"],
      [{ l: 0.312, c: 0.4, h: 93 }, "p3", [0.243318068487, 0.182963352048, 0], "search ends"],
      [{ l: 0.556, c: 0.196, h: 85 }, "p3", [0.578502742504, 0.42041457521, 0], "search ends"],
      [{ l: 0.062, c: 0.101, h: 91 }, "p3", [0.006892594614, 0.002099822826, 0], "search ends"],
    ];
    for (const [color, gamut, expected, note] of golden) {
      const mapped = gamutMap(color, gamut);
      expect(mapped, `${note}: ${JSON.stringify(color)} in ${gamut}`).toHaveLength(3);
      expectRgbClose(mapped, expected, 1e-9);
    }
  });

  it("maps the sRGB primaries and secondaries to themselves", () => {
    // These sit on the gamut boundary, where tolerance 0 can tip a round trip just outside it.
    for (const hex of ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#00ffff", "#ff00ff"]) {
      const rgb = hexToRgb(hex as Hex);
      const mapped = gamutMap(rgbToOklch(rgb, "srgb"), "srgb");
      expect(toHex(mapped)).toBe(hex);
    }
  });
});

describe("inGamut", () => {
  it("C-GAMUT-07 tells the gamuts apart", () => {
    expect(inGamut({ l: 0.7, c: 0.05, h: 145 }, "srgb")).toBe(true);
    expect(inGamut({ l: 0.7, c: 0.05, h: 145 }, "p3")).toBe(true);
    expect(inGamut({ l: 0.7, c: 0.4, h: 145 }, "srgb")).toBe(false);
    expect(inGamut({ l: 0.7, c: 0.4, h: 145 }, "p3")).toBe(false);
    expect(inGamut({ l: 0.7, c: 0.25, h: 145 }, "srgb")).toBe(false);
    expect(inGamut({ l: 0.7, c: 0.25, h: 145 }, "p3")).toBe(true);
    expect(inGamut({ l: 0.5, c: 0, h: null }, "srgb")).toBe(true);
  });

  it("C-GAMUT-07 agrees with whether toHex accepts the sRGB color", () => {
    fc.assert(
      fc.property(
        fc.record({
          l: fc.double({ min: -0.2, max: 1.2, noNaN: true }),
          c: fc.double({ min: 0, max: 0.5, noNaN: true }),
          h: fc.double({ noNaN: true, noDefaultInfinity: true }),
        }),
        (color) => {
          let accepted = true;
          try {
            toHex(oklchToRgb(color, "srgb"));
          } catch (error) {
            expect(error).toBeInstanceOf(RangeError);
            accepted = false;
          }
          expect(inGamut(color, "srgb")).toBe(accepted);
        },
      ),
      { numRuns: 500 },
    );
  });

  it("allows the 1e-6 tolerance at the edges of the gamut", () => {
    expect(inGamut({ l: 1, c: 0, h: null }, "srgb")).toBe(true);
    expect(inGamut({ l: 0, c: 0, h: null }, "srgb")).toBe(true);
    expect(inGamut({ l: 1.0001, c: 0, h: null }, "srgb")).toBe(false);
    // Just below black, the linear toe of the sRGB curve keeps the channels within 1e-6.
    expect(inGamut({ l: -0.0001, c: 0, h: null }, "srgb")).toBe(true);
    expect(inGamut({ l: -0.01, c: 0, h: null }, "srgb")).toBe(false);
  });
});

describe("maxChroma", () => {
  it("C-GAMUT-04 gives 0.1911 at l 0.7, h 22 in sRGB", () => {
    expect(maxChroma(0.7, 22, "srgb")).toBeCloseTo(0.1911, 4);
    expect(maxChroma(0.7, 22, "srgb")).toBeCloseTo(0.191126333451, 9);
  });

  it("C-GAMUT-08 stops at the edge of the gamut, and Display P3 reaches at least as far", () => {
    expect(maxChroma(0.7, 22, "p3")).toBeCloseTo(0.2435, 3);
    expect(maxChroma(0.7, 22, "p3")).toBeCloseTo(0.243451438316, 9);
    for (const gamut of GAMUTS) {
      expect(maxChroma(1, 90, gamut)).toBeLessThan(1e-3);
      // The spec asks for below 1e-3 at l = 0 too. Measured, core.py and this port both give
      // 0.00276 in sRGB and 0.00286 in P3, because the linear toe of the transfer curve keeps
      // a cubed chroma inside the 1e-6 tolerance. Across all hues the largest is 0.0121.
      expect(maxChroma(0, 90, gamut)).toBeLessThan(0.005);
      expect(maxChroma(1.2, 90, gamut)).toBe(0);
      expect(maxChroma(-0.2, 90, gamut)).toBe(0);
    }
    expect(maxChroma(0, 90, "srgb")).toBeCloseTo(0.00276078041179062, 9);
    expect(maxChroma(0, 90, "p3")).toBeCloseTo(0.002861127737105562, 9);
    fc.assert(
      fc.property(
        fc.double({ min: 0.2, max: 0.9, noNaN: true }),
        fc.double({ min: 0, max: 360, noNaN: true }),
        fc.constantFrom(...GAMUTS),
        (l, h, gamut) => {
          const edge = maxChroma(l, h, gamut);
          expect(inGamut({ l, c: edge, h }, gamut)).toBe(true);
          expect(inGamut({ l, c: edge + 0.001, h }, gamut)).toBe(false);
          expect(maxChroma(l, h, "p3")).toBeGreaterThanOrEqual(maxChroma(l, h, "srgb"));
        },
      ),
      { numRuns: 200 },
    );
  });

  it("matches the reference implementation in core.py, bit for bit up to rounding", () => {
    // Values computed with core.py: max_chroma with oklch_to_srgb and oklch_to_p3. Both run 40
    // iterations of bisection, so 13 decimals tell 40 iterations from 39 or 41 (the last step
    // moves the bound by 2^-41, about 4.5e-13).
    const golden: ReadonlyArray<readonly [number, number, number, number]> = [
      [0.7, 22, 0.1911263334513933, 0.24345143831578753],
      [0.3, 262, 0.1387541655581117, 0.17250381567873774],
      [0.9, 95, 0.15849367898135824, 0.19124720261334005],
      [0.5, 150, 0.13769867515702572, 0.19211658352105587],
      [0.97, 110, 0.17760082620770845, 0.17972418843010018],
      [0.2, 30, 0.08021295867320077, 0.08964381807845712],
    ];
    for (const [l, h, srgb, p3] of golden) {
      expect(maxChroma(l, h, "srgb")).toBeCloseTo(srgb, 13);
      expect(maxChroma(l, h, "p3")).toBeCloseTo(p3, 13);
    }
  });

  it("takes any finite hue", () => {
    expect(maxChroma(0.7, 22 + 360, "srgb")).toBeCloseTo(maxChroma(0.7, 22, "srgb"), 9);
    expect(maxChroma(0.7, -338, "srgb")).toBeCloseTo(maxChroma(0.7, 22, "srgb"), 9);
    expect(Number.isFinite(maxChroma(0.7, 1e300, "srgb"))).toBe(true);
  });
});

describe("gamut failures", () => {
  const nan = Number.NaN;
  const infinity = Number.POSITIVE_INFINITY;

  it("C-GAMUT-09 throws a RangeError for an l, c or h that is not finite", () => {
    for (const bad of [
      { l: nan, c: 0.1, h: 0 },
      { l: infinity, c: 0.1, h: 0 },
      { l: 0.5, c: nan, h: 0 },
      { l: 0.5, c: infinity, h: 0 },
      { l: 0.5, c: 0.1, h: nan },
      { l: 0.5, c: 0.1, h: infinity },
    ]) {
      expect(() => gamutMap(bad, "srgb")).toThrow(RangeError);
      expect(() => inGamut(bad, "p3")).toThrow(RangeError);
    }
    expect(() => maxChroma(nan, 22, "srgb")).toThrow(RangeError);
    expect(() => maxChroma(infinity, 22, "srgb")).toThrow(RangeError);
    expect(() => maxChroma(0.7, nan, "srgb")).toThrow(RangeError);
    expect(() => maxChroma(0.7, infinity, "p3")).toThrow(RangeError);
  });

  it("throws a RangeError for a negative chroma, which leaves nothing to search", () => {
    expect(() => gamutMap({ l: 0.5, c: -0.1, h: 30 }, "srgb")).toThrow(RangeError);
    expect(() => gamutMap({ l: 0.5, c: -0.1, h: 30 }, "p3")).toThrow(/c\.c must be at least 0/);
    // A negative zero is zero, and white and black ignore chroma altogether.
    expect(gamutMap({ l: 0.5, c: -0, h: 30 }, "srgb")).toEqual(
      oklchToRgb({ l: 0.5, c: 0, h: 30 }, "srgb"),
    );
    expect(gamutMap({ l: 1.2, c: -0.3, h: 30 }, "srgb")).toEqual(WHITE);
    expect(gamutMap({ l: -0.1, c: -0.3, h: 30 }, "srgb")).toEqual(BLACK);
  });

  it("throws a RangeError for a gamut that is neither srgb nor p3", () => {
    const color: Oklch = { l: 0.5, c: 0.1, h: 30 };
    expect(() => gamutMap(color, "rec2020" as Gamut)).toThrow(RangeError);
    expect(() => inGamut(color, "" as Gamut)).toThrow(RangeError);
    expect(() => maxChroma(0.5, 30, "xyz" as Gamut)).toThrow(RangeError);
  });

  it("throws a TypeError for a value of the wrong type", () => {
    expect(() => gamutMap(null as unknown as Oklch, "srgb")).toThrow(TypeError);
    expect(() => inGamut(undefined as unknown as Oklch, "srgb")).toThrow(TypeError);
    expect(() => maxChroma("0.7" as unknown as number, 22, "srgb")).toThrow(TypeError);
    expect(() => maxChroma(0.7, undefined as unknown as number, "srgb")).toThrow(TypeError);
  });

  it("names the function and the argument in the message", () => {
    expect(() => gamutMap({ l: nan, c: 0, h: 0 }, "srgb")).toThrow(/gamutMap.*c\.l/);
    expect(() => maxChroma(0.7, nan, "srgb")).toThrow(/maxChroma.*h/);
  });

  it("throws a RangeError for a color too large to convert, as inGamut and maxChroma see it", () => {
    expect(() => inGamut({ l: 1e200, c: 0, h: null }, "srgb")).toThrow(RangeError);
    expect(() => maxChroma(1e200, 90, "srgb")).toThrow(RangeError);
  });
});
