import Color from "colorjs.io";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  formatOklch,
  hexToRgb,
  linearToSrgb,
  normalizeHue,
  oklchToRgb,
  rgbToOklab,
  rgbToOklch,
  srgbToLinear,
  toHex,
} from "@/engine/color/convert";
import { ColorParseError } from "@/engine/color/parse";
import type { Gamut, Hex, Oklch, Rgb } from "@/engine/color/types";
import {
  ACHROMATIC_CHROMA,
  expectOklchClose,
  expectRgbClose,
  hexOf,
  hueDistance,
  rgb8,
} from "./support";

// Cases are the C-CONV-nn rows of docs/specs/01-color-engine.md, section 6.1.

const srgbOf = (hex: string): Oklch => rgbToOklch(hexToRgb(hex as Hex), "srgb");

describe("rgbToOklch", () => {
  it("C-CONV-01 gives #808080 a lightness of 0.599871 and no hue", () => {
    const gray = srgbOf("#808080");
    expect(gray.l).toBeCloseTo(0.599871, 6);
    expect(gray.c).toBeLessThan(ACHROMATIC_CHROMA);
    expect(gray.h).toBeNull();
  });

  it("C-CONV-13 gives every achromatic color no hue and every other color one", () => {
    const grays: Oklch[] = [];
    for (let v = 0; v <= 255; v++) grays.push(rgbToOklch([v / 255, v / 255, v / 255], "srgb"));
    expect(grays.every((gray) => gray.h === null && gray.c <= ACHROMATIC_CHROMA)).toBe(true);

    // The chroma of a color grows with its distance from the gray axis, so the smallest chroma of
    // a non-gray 8-bit color sits among the colors one or two codes off gray.
    let smallest = { chroma: Number.POSITIVE_INFINITY, hex: "" };
    for (let v = 0; v <= 255; v++) {
      for (let dr = 0; dr <= 2; dr++) {
        for (let dg = 0; dg <= 2; dg++) {
          for (let db = 0; db <= 2; db++) {
            const triple = [v + dr, v + dg, v + db] as const;
            if (Math.max(...triple) > 255 || (dr === dg && dg === db)) continue;
            const color = rgbToOklch([triple[0] / 255, triple[1] / 255, triple[2] / 255], "srgb");
            expect(color.h).not.toBeNull();
            if (color.c < smallest.chroma) smallest = { chroma: color.c, hex: hexOf(triple) };
          }
        }
      }
    }
    expect(smallest.hex).toBe("#feffff");
    expect(smallest.chroma).toBeCloseTo(0.00106, 5);
    expect(smallest.chroma).toBeGreaterThan(100 * ACHROMATIC_CHROMA);

    fc.assert(
      fc.property(rgb8, (triple) => {
        const color = rgbToOklch(hexToRgb(hexOf(triple)), "srgb");
        expect(color.h === null).toBe(color.c <= ACHROMATIC_CHROMA);
        if (color.h !== null) {
          expect(Number.isFinite(color.h)).toBe(true);
          expect(color.h).toBeGreaterThanOrEqual(0);
          expect(color.h).toBeLessThan(360);
        }
      }),
      { numRuns: 500 },
    );
  });

  it("C-CONV-03 matches colorjs.io for any 8-bit sRGB color", () => {
    const compare = (hex: Hex) => {
      const ours = rgbToOklch(hexToRgb(hex), "srgb");
      const [l, c, h] = new Color(hex).to("oklch").coords as [number, number, number | null];
      expect(Math.abs(ours.l - l)).toBeLessThan(0.001);
      expect(Math.abs(ours.c - c)).toBeLessThan(0.001);
      if (h === null) {
        // colorjs.io 0.7.1 gives every achromatic color a null hue.
        expect(ours.h).toBeNull();
      } else if (c > ACHROMATIC_CHROMA) {
        expect(ours.h).not.toBeNull();
        expect(hueDistance(ours.h as number, h)).toBeLessThan(0.1);
      }
    };
    fc.assert(
      fc.property(rgb8, (triple) => compare(hexOf(triple))),
      { numRuns: 500 },
    );
    // The properties rarely draw a gray, so check all of them, and the colors next to them.
    for (let v = 0; v <= 255; v++) {
      compare(hexOf([v, v, v]));
      compare(hexOf([v, v, Math.min(255, v + 1)]));
      compare(hexOf([Math.min(255, v + 1), v, v]));
    }
  });

  it("matches the reference implementation in core.py to 1e-9", () => {
    // Values computed with core.py: srgb_to_oklch for sRGB, and P3_TO_XYZ with the same
    // transfer function for Display P3.
    const golden: ReadonlyArray<readonly [Rgb, Gamut, readonly [number, number, number]]> = [
      [hexToRgb("#f66c6d" as Hex), "srgb", [0.700250834669, 0.170054985541, 22.0638415289]],
      [hexToRgb("#0000ff" as Hex), "srgb", [0.452013718174, 0.313214388634, 264.052022616]],
      [hexToRgb("#00ff00" as Hex), "srgb", [0.866439617523, 0.294827224543, 142.495345041]],
      [hexToRgb("#ff0000" as Hex), "srgb", [0.627955363921, 0.257683303805, 29.2338802796]],
      [hexToRgb("#ffff00" as Hex), "srgb", [0.967982726793, 0.21100587375, 109.769236128]],
      [hexToRgb("#123456" as Hex), "srgb", [0.319168422385, 0.0724545308983, 251.168452262]],
      [hexToRgb("#abcdef" as Hex), "srgb", [0.83497888978, 0.0601534538704, 248.55039038]],
      [hexToRgb("#010203" as Hex), "srgb", [0.0823091376484, 0.0080352147329, 240.750922799]],
      [[1, 0, 0], "p3", [0.648574075144, 0.299485286338, 28.9581327308]],
      [[0, 1, 0], "p3", [0.848829292853, 0.368527797681, 145.644955587]],
      [[0.2, 0.5, 0.9], "p3", [0.604042263292, 0.188939672513, 252.010507725]],
      [[0.9, 0.7, 0.1], "p3", [0.792687229226, 0.181521205082, 85.7177869483]],
    ];
    for (const [rgb, gamut, [l, c, h]] of golden) {
      const color = rgbToOklch(rgb, gamut);
      expect(color.l).toBeCloseTo(l, 9);
      expect(color.c).toBeCloseTo(c, 9);
      expect(color.h).toBeCloseTo(h, 7);
    }
  });

  it("exposes OKLab, which rgbToOklch turns into chroma and hue", () => {
    const [l, a, b] = rgbToOklab(hexToRgb("#f66c6d" as Hex), "srgb");
    const color = srgbOf("#f66c6d");
    expect(l).toBe(color.l);
    expect(Math.hypot(a, b)).toBeCloseTo(color.c, 15);
    expect(Math.atan2(b, a) * (180 / Math.PI)).toBeCloseTo(color.h as number, 9);
    const [whiteL, whiteA, whiteB] = rgbToOklab([1, 1, 1], "srgb");
    expect(whiteL).toBeCloseTo(1, 9);
    expect(Math.abs(whiteA) + Math.abs(whiteB)).toBeLessThan(ACHROMATIC_CHROMA);
  });

  it("reads out-of-gamut channels without clamping them", () => {
    const color = rgbToOklch([1.2, -0.1, 0.5], "srgb");
    expect(Number.isFinite(color.l) && Number.isFinite(color.c)).toBe(true);
    const back = oklchToRgb(color, "srgb");
    expectRgbClose(back, [1.2, -0.1, 0.5], 1e-9);
  });
});

describe("oklchToRgb", () => {
  it("C-CONV-02 returns the same hex after a trip through OKLCH, for any 8-bit color", () => {
    fc.assert(
      fc.property(rgb8, (triple) => {
        const hex = hexOf(triple);
        const color = rgbToOklch(hexToRgb(hex), "srgb");
        expect(toHex(oklchToRgb(color, "srgb"))).toBe(hex);
      }),
      { numRuns: 500 },
    );
  });

  it("C-CONV-10 round-trips through Display P3, which has a wider gamut than sRGB", () => {
    fc.assert(
      fc.property(
        fc.record({
          l: fc.double({ min: 0.1, max: 0.95, noNaN: true }),
          c: fc.double({ min: 0, max: 0.1, noNaN: true }),
          h: fc.double({ min: -720, max: 720, noNaN: true }),
        }),
        (color) => {
          const back = rgbToOklch(oklchToRgb(color, "p3"), "p3");
          expectOklchClose(back, color);
        },
      ),
      { numRuns: 200 },
    );
    const green: Oklch = { l: 0.7, c: 0.1, h: 145 };
    const p3 = oklchToRgb(green, "p3");
    const srgb = oklchToRgb(green, "srgb");
    expect(Math.max(...p3.map((channel, i) => Math.abs(channel - srgb[i])))).toBeGreaterThan(0.01);
  });

  it("C-CONV-11 reads a null hue as 0 and gives finite channels for any finite hue", () => {
    for (const gamut of ["srgb", "p3"] as const) {
      expect(oklchToRgb({ l: 0.6, c: 0.05, h: null }, gamut)).toEqual(
        oklchToRgb({ l: 0.6, c: 0.05, h: 0 }, gamut),
      );
    }
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 0.5, noNaN: true }),
        fc.double({ noNaN: true, noDefaultInfinity: true }),
        fc.constantFrom<Gamut>("srgb", "p3"),
        (l, c, h, gamut) => {
          for (const channel of oklchToRgb({ l, c, h }, gamut)) {
            expect(Number.isFinite(channel)).toBe(true);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it("C-CONV-12 returns an out-of-gamut color unclamped", () => {
    const rgb = oklchToRgb({ l: 0.7, c: 0.4, h: 145 }, "srgb");
    expect(rgb.every((channel) => Number.isFinite(channel))).toBe(true);
    expect(Math.min(...rgb)).toBeLessThan(0);
    expect(rgb[1]).toBeLessThanOrEqual(1);
  });

  it("matches the reference implementation in core.py to 1e-9", () => {
    // Values computed with core.py: oklch_to_srgb and oklch_to_p3.
    const golden: ReadonlyArray<readonly [Oklch, Gamut, Rgb]> = [
      [{ l: 0.7, c: 0.1, h: 145 }, "srgb", [0.462618561291, 0.686532185712, 0.468284518565]],
      [{ l: 0.7, c: 0.1, h: 145 }, "p3", [0.511757683321, 0.680570655804, 0.48830540557]],
      [{ l: 0.5, c: 0.2, h: 30 }, "srgb", [0.730978465676, 0.0523303097656, 0.00280819868475]],
      [{ l: 0.5, c: 0.2, h: 30 }, "p3", [0.670054102417, 0.153366985311, 0.0926960424791]],
      [{ l: 0.9, c: 0.05, h: 250 }, "srgb", [0.775477591649, 0.883709995469, 0.998815549352]],
      [{ l: 0.9, c: 0.05, h: 250 }, "p3", [0.796115629748, 0.880394540216, 0.987763153209]],
      [{ l: 0.7, c: 0.4, h: 145 }, "srgb", [-0.532714565655, 0.82344716184, -0.388333071896]],
      [{ l: 0.7, c: 0.4, h: 145 }, "p3", [-0.327473510969, 0.806436734319, -0.29587754856]],
      [{ l: 0.3, c: 0.3, h: 280 }, "srgb", [0.217909375025, -0.240239047701, 0.740534485469]],
      [{ l: 0.3, c: 0.3, h: 280 }, "p3", [0.166815008347, -0.232638058314, 0.708168595737]],
    ];
    for (const [color, gamut, expected] of golden) {
      expectRgbClose(oklchToRgb(color, gamut), expected, 1e-9);
    }
  });

  it("does not mutate its input and gives the same output for the same input", () => {
    const color = Object.freeze({ l: 0.7, c: 0.1, h: 145 });
    expect(oklchToRgb(color, "srgb")).toEqual(oklchToRgb(color, "srgb"));
    expect(color).toEqual({ l: 0.7, c: 0.1, h: 145 });
  });
});

describe("toHex", () => {
  it("C-CONV-06 rounds half up and writes lowercase #rrggbb", () => {
    expect(toHex([1, 0.5, 0])).toBe("#ff8000");
    expect(toHex([-1e-7, 1 + 1e-7, 0.5])).toBe("#00ff80");
    expect(toHex([0, 0, 0])).toBe("#000000");
    expect(toHex([1, 1, 1])).toBe("#ffffff");
    expect(toHex([246 / 255, 108 / 255, 109 / 255])).toBe("#f66c6d");
  });

  it("accepts the tolerance edges and rejects what lies beyond them", () => {
    expect(toHex([-1e-6, 1 + 1e-6, 0])).toBe("#00ff00");
    expect(() => toHex([-1.1e-6, 0, 0])).toThrow(RangeError);
    expect(() => toHex([0, 1 + 1.1e-6, 0])).toThrow(RangeError);
  });

  it("C-CONV-07 throws a RangeError for a channel out of range or not finite", () => {
    expect(() => toHex([1.1, 0, 0])).toThrow(RangeError);
    expect(() => toHex([-0.1, 0, 0])).toThrow(RangeError);
    expect(() => toHex([Number.NaN, 0, 0])).toThrow(RangeError);
    expect(() => toHex([Number.POSITIVE_INFINITY, 0, 0])).toThrow(RangeError);
    expect(() => toHex([0, 0, Number.NEGATIVE_INFINITY])).toThrow(RangeError);
  });

  it("writes a Hex that hexToRgb reads back to the same code", () => {
    fc.assert(
      fc.property(rgb8, (triple) => {
        const hex = hexOf(triple);
        expect(toHex(hexToRgb(hex))).toBe(hex);
      }),
      { numRuns: 500 },
    );
  });
});

describe("hexToRgb", () => {
  it("C-CONV-08 divides each pair by 255, in either case", () => {
    expect(hexToRgb("#f66c6d" as Hex)).toEqual([246 / 255, 108 / 255, 109 / 255]);
    expect(hexToRgb("#F66C6D" as Hex)).toEqual([246 / 255, 108 / 255, 109 / 255]);
    expect(hexToRgb("#000000" as Hex)).toEqual([0, 0, 0]);
    expect(hexToRgb("#ffffff" as Hex)).toEqual([1, 1, 1]);
  });

  it("C-CONV-09 throws a ColorParseError for anything but #rrggbb", () => {
    for (const bad of [
      "#f66c6",
      "f66c6d",
      "#gggggg",
      "",
      "#fff",
      "#f66c6dff",
      " #f66c6d",
      "#f66c6d ",
    ]) {
      let error: unknown;
      try {
        hexToRgb(bad as Hex);
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeInstanceOf(ColorParseError);
      expect((error as ColorParseError).input).toBe(bad);
    }
  });

  it("throws a TypeError for an argument that is not a string", () => {
    expect(() => hexToRgb(undefined as unknown as Hex)).toThrow(TypeError);
    expect(() => hexToRgb(0xf66c6d as unknown as Hex)).toThrow(TypeError);
  });
});

describe("formatOklch", () => {
  it("C-CONV-04 writes madder as oklch(0.7003 0.1701 22.06)", () => {
    expect(formatOklch(srgbOf("#f66c6d"))).toBe("oklch(0.7003 0.1701 22.06)");
  });

  it("C-CONV-05 writes none for a null hue and keeps trailing zeros", () => {
    expect(formatOklch({ l: 0.6, c: 0, h: null })).toBe("oklch(0.6000 0.0000 none)");
    expect(formatOklch({ l: 1, c: 0.25, h: 90 })).toBe("oklch(1.0000 0.2500 90.00)");
  });
});

describe("transfer function and hue helpers", () => {
  it("decodes below 0.04045 linearly, above it by a power, and keeps the sign", () => {
    expect(srgbToLinear(0)).toBe(0);
    expect(srgbToLinear(0.04045)).toBeCloseTo(0.04045 / 12.92, 15);
    expect(srgbToLinear(0.5)).toBeCloseTo(0.21404114048223255, 14);
    expect(srgbToLinear(1)).toBeCloseTo(1, 15);
    expect(srgbToLinear(-0.5)).toBe(-srgbToLinear(0.5));
    expect(srgbToLinear(-0.01)).toBeCloseTo(-0.01 / 12.92, 15);
  });

  it("encodes above 0.0031308 by a power, below it linearly, and keeps the sign", () => {
    expect(linearToSrgb(0)).toBe(0);
    expect(linearToSrgb(0.0031308)).toBeCloseTo(12.92 * 0.0031308, 15);
    expect(linearToSrgb(0.21404114048223255)).toBeCloseTo(0.5, 14);
    expect(linearToSrgb(-0.5)).toBe(-linearToSrgb(0.5));
  });

  it("round-trips, and stays continuous at both thresholds", () => {
    // The two published thresholds are not exact inverses of each other, so a value in the
    // 6e-8 gap just below 0.04045 comes back off by up to that much.
    fc.assert(
      fc.property(fc.double({ min: -2, max: 2, noNaN: true }), (value) => {
        expect(linearToSrgb(srgbToLinear(value))).toBeCloseTo(value, 6);
      }),
      { numRuns: 500 },
    );
    expect(Math.abs(srgbToLinear(0.04046) - srgbToLinear(0.04045))).toBeLessThan(1e-5);
    expect(Math.abs(linearToSrgb(0.0031309) - linearToSrgb(0.0031308))).toBeLessThan(1e-4);
  });

  it("normalizes a hue into [0, 360) and writes zero as +0", () => {
    expect(normalizeHue(-338)).toBeCloseTo(22, 12);
    expect(normalizeHue(382)).toBeCloseTo(22, 12);
    expect(normalizeHue(360)).toBe(0);
    expect(normalizeHue(-360)).toBe(0);
    expect(normalizeHue(-0)).toBe(0);
    expect(normalizeHue(-1e-20)).toBe(0);
    expect(normalizeHue(359.99999999999994)).toBe(359.99999999999994);
    expect(normalizeHue(22.0638415289496)).toBe(22.0638415289496);
    fc.assert(
      fc.property(fc.double({ noNaN: true, noDefaultInfinity: true }), (hue) => {
        const normalized = normalizeHue(hue);
        expect(normalized).toBeGreaterThanOrEqual(0);
        expect(normalized).toBeLessThan(360);
        expect(Object.is(normalized, -0)).toBe(false);
      }),
      { numRuns: 500 },
    );
  });
});

describe("conversion failures", () => {
  const INFINITY = Number.POSITIVE_INFINITY;

  it("C-CONV-14 throws a RangeError for a channel, l, c or h that is not finite", () => {
    expect(() => rgbToOklch([Number.NaN, 0, 0], "srgb")).toThrow(RangeError);
    expect(() => rgbToOklch([0, INFINITY, 0], "p3")).toThrow(RangeError);
    expect(() => rgbToOklab([0, 0, Number.NEGATIVE_INFINITY], "srgb")).toThrow(RangeError);
    for (const bad of [
      { l: Number.NaN, c: 0.1, h: 0 },
      { l: 0.5, c: Number.NaN, h: 0 },
      { l: 0.5, c: INFINITY, h: 0 },
      { l: 0.5, c: 0.1, h: Number.NaN },
      { l: 0.5, c: 0.1, h: INFINITY },
      { l: INFINITY, c: 0.1, h: 0 },
    ]) {
      expect(() => oklchToRgb(bad, "srgb")).toThrow(RangeError);
      expect(() => formatOklch(bad)).toThrow(RangeError);
    }
    expect(() => normalizeHue(Number.NaN)).toThrow(RangeError);
    expect(() => normalizeHue(INFINITY)).toThrow(RangeError);
  });

  it("names the argument in the message", () => {
    expect(() => rgbToOklch([0, Number.NaN, 0], "srgb")).toThrow(/rgb\[1\]/);
    expect(() => oklchToRgb({ l: 0.5, c: 0.1, h: Number.NaN }, "srgb")).toThrow(/c\.h/);
    expect(() => formatOklch({ l: 0.5, c: Number.POSITIVE_INFINITY, h: 0 })).toThrow(/c\.c/);
    expect(() => toHex([0, 0, 2])).toThrow(/rgb\[2\]/);
  });

  it("throws a RangeError for a gamut that is neither srgb nor p3", () => {
    expect(() => rgbToOklch([0, 0, 0], "rec2020" as Gamut)).toThrow(RangeError);
    expect(() => rgbToOklab([0, 0, 0], "xyz" as Gamut)).toThrow(RangeError);
    expect(() => oklchToRgb({ l: 0.5, c: 0.1, h: 0 }, "" as Gamut)).toThrow(RangeError);
    expect(() => oklchToRgb({ l: 0.5, c: 0.1, h: 0 }, undefined as unknown as Gamut)).toThrow(
      RangeError,
    );
  });

  it("says what it got when the type is wrong", () => {
    expect(() => oklchToRgb(null as unknown as Oklch, "srgb")).toThrow(/got null/);
    expect(() => formatOklch(undefined as unknown as Oklch)).toThrow(/got undefined/);
    expect(() => toHex([0, 0] as unknown as Rgb)).toThrow(
      /rgb\[2\] must be a number, got undefined/,
    );
    expect(() => toHex("#fff" as unknown as Rgb)).toThrow(/array of three channels, got string/);
    expect(() => hexToRgb(7 as unknown as Hex)).toThrow(/got number/);
  });

  it("throws a TypeError for a value of the wrong type", () => {
    expect(() => oklchToRgb(null as unknown as Oklch, "srgb")).toThrow(TypeError);
    expect(() => formatOklch(undefined as unknown as Oklch)).toThrow(TypeError);
    expect(() => oklchToRgb({ l: "0.5", c: 0.1, h: 0 } as unknown as Oklch, "srgb")).toThrow(
      TypeError,
    );
    expect(() => oklchToRgb({ l: 0.5, c: 0.1, h: undefined } as unknown as Oklch, "srgb")).toThrow(
      TypeError,
    );
    expect(() => rgbToOklch([0, "0", 0] as unknown as Rgb, "srgb")).toThrow(TypeError);
    expect(() => toHex(null as unknown as Rgb)).toThrow(TypeError);
  });

  it("throws a RangeError instead of returning an overflowed value", () => {
    expect(() => oklchToRgb({ l: 1e200, c: 0, h: null }, "srgb")).toThrow(RangeError);
    expect(() => oklchToRgb({ l: 0.5, c: 1e200, h: 30 }, "p3")).toThrow(RangeError);
    expect(() => rgbToOklch([1e200, 0, 0], "srgb")).toThrow(RangeError);
  });
});
