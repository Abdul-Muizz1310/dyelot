import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { rgbToOklch } from "@/engine/color/convert";
import { deltaEOK, minPairwiseDeltaE } from "@/engine/color/deltae";
import type { Oklch, Rgb } from "@/engine/color/types";
import { anyRgb, BAD_CHANNELS, rgbOfHex, withChannel } from "./support";

// Cases are the C-DELTAE-nn rows of docs/specs/01-color-engine.md, section 6.2.

const VIEWS = ["none", "protan", "deutan", "tritan"] as const;
const BLACK = rgbOfHex("#000000");
const WHITE = rgbOfHex("#ffffff");

const oklchOf = (hex: string): Oklch => rgbToOklch(rgbOfHex(hex), "srgb");

const anyOklch: fc.Arbitrary<Oklch> = fc.record({
  l: fc.double({ min: 0, max: 1, noNaN: true }),
  c: fc.double({ min: 0, max: 0.5, noNaN: true }),
  h: fc.oneof(fc.double({ noNaN: true, noDefaultInfinity: true }), fc.constant(null)),
});

/** `[a, b, ΔEOK]`, computed with `deltaEOK` and `srgb_to_oklch` in core.py. */
const DELTA_GOLDEN: ReadonlyArray<readonly [string, string, number]> = [
  ["#000000", "#ffffff", 1.0000000000000002],
  ["#ff0000", "#fe0000", 0.0020192104612125512],
  ["#ff0000", "#00ff00", 0.5198129015519161],
  ["#f66c6d", "#4775ca", 0.2993353367973896],
  ["#808080", "#818181", 0.0033765864924207856],
  ["#e69f00", "#56b4e9", 0.27125909598251163],
];

type Views = Record<(typeof VIEWS)[number], number>;

/** The smallest pairwise ΔEOK of each set under each view, computed with `sim` in cvd.py. */
const MIN_PAIRWISE_GOLDEN: ReadonlyArray<readonly [string, readonly string[], Views]> = [
  [
    "Okabe-Ito without black",
    ["#e69f00", "#56b4e9", "#009e73", "#f0e442", "#0072b2", "#d55e00", "#cc79a7"],
    {
      none: 0.15582058400486537,
      protan: 0.09036449846467344,
      deutan: 0.07904807031782118,
      tritan: 0.084044251531955,
    },
  ],
  [
    "status colors",
    ["#e7000b", "#00a63e", "#fe9a00", "#155dfc"],
    {
      none: 0.23814079165961222,
      protan: 0.04936058998229984,
      deutan: 0.046700660749289226,
      tritan: 0.09072376818897833,
    },
  ],
  [
    "red and green",
    ["#e7000b", "#00a63e"],
    {
      none: 0.3699101757239001,
      protan: 0.2455595946668831,
      deutan: 0.046700660749289226,
      tritan: 0.3212921797667593,
    },
  ],
  [
    "a close pair and a distant color",
    ["#ff0000", "#fe0000", "#0000ff"],
    {
      none: 0.0020192104612125512,
      protan: 0.0014205109663677482,
      deutan: 0.0019569191466850193,
      tritan: 0.0004040539784818695,
    },
  ],
];

describe("deltaEOK", () => {
  it("C-DELTAE-01 gives exactly 0 for a color against itself", () => {
    fc.assert(
      fc.property(anyOklch, (color) => {
        expect(deltaEOK(color, color)).toBe(0);
      }),
      { numRuns: 500 },
    );
  });

  it("C-DELTAE-02 is symmetric, with exact equality", () => {
    fc.assert(
      fc.property(anyOklch, anyOklch, (a, b) => {
        expect(deltaEOK(a, b)).toBe(deltaEOK(b, a));
      }),
      { numRuns: 500 },
    );
  });

  it("C-DELTAE-03 gives black against white 1.0", () => {
    expect(Math.abs(deltaEOK(oklchOf("#000000"), oklchOf("#ffffff")) - 1)).toBeLessThanOrEqual(
      1e-3,
    );
  });

  it("C-DELTAE-04 obeys the triangle inequality", () => {
    fc.assert(
      fc.property(anyOklch, anyOklch, anyOklch, (a, b, c) => {
        expect(deltaEOK(a, c)).toBeLessThanOrEqual(deltaEOK(a, b) + deltaEOK(b, c) + 1e-12);
      }),
      { numRuns: 500 },
    );
  });

  it("C-DELTAE-05 reads a null hue as no chroma direction", () => {
    const chromatic: Oklch = { l: 0.5, c: 0.1, h: 90 };
    const gray: Oklch = { l: 0.5, c: 0, h: null };
    expect(Math.abs(deltaEOK(chromatic, gray) - 0.1)).toBeLessThanOrEqual(1e-9);
    expect(deltaEOK(gray, gray)).toBe(0);
    expect(deltaEOK(gray, { l: 0.5, c: 0, h: null })).toBe(0);
  });

  it("C-DELTAE-05 contributes a = b = 0 for a null hue whatever its chroma", () => {
    expect(deltaEOK({ l: 0.5, c: 0.1, h: null }, { l: 0.5, c: 0, h: null })).toBe(0);
    expect(deltaEOK({ l: 0.9, c: 0.3, h: null }, { l: 0.5, c: 0, h: 120 })).toBe(
      deltaEOK({ l: 0.9, c: 0, h: null }, { l: 0.5, c: 0, h: 120 }),
    );
  });

  it("measures lightness, chroma and hue together, in OKLab", () => {
    // Opposite hues at equal lightness and chroma sit 2C apart on the a axis.
    expect(deltaEOK({ l: 0.5, c: 0.1, h: 0 }, { l: 0.5, c: 0.1, h: 180 })).toBeCloseTo(0.2, 12);
    // A quarter turn makes the right angle of a 3-4-5 triangle: 0.03 on a, 0.04 on b.
    expect(deltaEOK({ l: 0.5, c: 0.03, h: 0 }, { l: 0.5, c: 0.04, h: 90 })).toBeCloseTo(0.05, 12);
    expect(deltaEOK({ l: 0.2, c: 0, h: null }, { l: 0.5, c: 0, h: null })).toBeCloseTo(0.3, 12);
  });

  it("reads a hue by its angle, so 0 and 360 are the same color", () => {
    const base: Oklch = { l: 0.6, c: 0.15, h: 0 };
    expect(deltaEOK(base, { l: 0.6, c: 0.15, h: 360 })).toBeLessThan(1e-12);
    expect(deltaEOK(base, { l: 0.6, c: 0.15, h: -720 })).toBeLessThan(1e-12);
  });

  it("C-DELTAE-06 throws a RangeError for an l, c or h that is not finite", () => {
    const good: Oklch = { l: 0.5, c: 0.1, h: 90 };
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      for (const color of [
        { ...good, l: bad },
        { ...good, c: bad },
        { ...good, h: bad },
      ]) {
        expect(() => deltaEOK(color, good)).toThrow(RangeError);
        expect(() => deltaEOK(good, color)).toThrow(RangeError);
      }
    }
  });

  it("names the argument that is not finite", () => {
    const good: Oklch = { l: 0.5, c: 0.1, h: 90 };
    expect(() => deltaEOK({ ...good, l: Number.NaN }, good)).toThrow(/deltaEOK: a\.l/);
    expect(() => deltaEOK(good, { ...good, h: Number.NaN })).toThrow(/deltaEOK: b\.h/);
  });

  it("throws a TypeError for a value that is not a color", () => {
    const good: Oklch = { l: 0.5, c: 0.1, h: 90 };
    expect(() => deltaEOK(null as unknown as Oklch, good)).toThrow(TypeError);
    expect(() => deltaEOK(good, undefined as unknown as Oklch)).toThrow(TypeError);
    expect(() => deltaEOK({ l: "0.5", c: 0.1, h: 90 } as unknown as Oklch, good)).toThrow(
      TypeError,
    );
  });

  it("throws a RangeError, never returns Infinity, when the colors are too far apart to measure", () => {
    const far = { l: 1e200, c: 0, h: null };
    const farther = { l: -1e200, c: 0, h: null };
    expect(() => deltaEOK(far, farther)).toThrow(RangeError);
    expect(() => deltaEOK(far, farther)).toThrow(/too far apart/);
  });

  it("matches the reference implementation in core.py to 1e-9", () => {
    for (const [a, b, expected] of DELTA_GOLDEN) {
      const distance = deltaEOK(oklchOf(a), oklchOf(b));
      expect(Math.abs(distance - expected), `${a} against ${b}`).toBeLessThanOrEqual(1e-9);
    }
  });

  it("does not change its arguments", () => {
    const a = Object.freeze({ l: 0.5, c: 0.1, h: 90 });
    const b = Object.freeze({ l: 0.6, c: 0.2, h: null });
    expect(deltaEOK(a, b)).toBe(deltaEOK(a, b));
    expect(a).toEqual({ l: 0.5, c: 0.1, h: 90 });
    expect(b).toEqual({ l: 0.6, c: 0.2, h: null });
  });
});

describe("minPairwiseDeltaE", () => {
  it("C-DELTAE-07 gives black against white 1.0 in all four views", () => {
    const result = minPairwiseDeltaE([BLACK, WHITE]);
    for (const view of VIEWS) {
      expect(Math.abs(result[view] - 1), view).toBeLessThanOrEqual(1e-3);
    }
  });

  it("returns one finite number for each of none, protan, deutan and tritan", () => {
    const result = minPairwiseDeltaE([rgbOfHex("#e7000b"), rgbOfHex("#00a63e"), WHITE]);
    expect(Object.keys(result).sort()).toEqual(["deutan", "none", "protan", "tritan"]);
    for (const view of VIEWS) expect(Number.isFinite(result[view]), view).toBe(true);
  });

  it("C-DELTAE-08 finds the closest pair of [#ff0000, #fe0000, #0000ff]", () => {
    const red = rgbOfHex("#ff0000");
    const nearRed = rgbOfHex("#fe0000");
    const blue = rgbOfHex("#0000ff");
    const closest = deltaEOK(oklchOf("#ff0000"), oklchOf("#fe0000"));
    const result = minPairwiseDeltaE([red, nearRed, blue]);
    expect(Math.abs(result.none - closest)).toBeLessThanOrEqual(1e-12);
    // The other two pairs are farther apart, so the closest pair decides.
    expect(deltaEOK(oklchOf("#ff0000"), oklchOf("#0000ff"))).toBeGreaterThan(closest);
    expect(deltaEOK(oklchOf("#fe0000"), oklchOf("#0000ff"))).toBeGreaterThan(closest);
  });

  it("C-DELTAE-09 gives 0 in every view for identical colors", () => {
    const color = rgbOfHex("#f66c6d");
    for (const colors of [
      [color, color],
      [color, rgbOfHex("#4775ca"), color],
    ]) {
      const result = minPairwiseDeltaE(colors);
      for (const view of VIEWS) expect(result[view], view).toBe(0);
    }
  });

  it("C-DELTAE-09 never raises a view's minimum when a color joins the set", () => {
    fc.assert(
      fc.property(fc.array(anyRgb, { minLength: 2, maxLength: 5 }), anyRgb, (colors, extra) => {
        const before = minPairwiseDeltaE(colors);
        const after = minPairwiseDeltaE([...colors, extra]);
        for (const view of VIEWS) expect(after[view], view).toBeLessThanOrEqual(before[view]);
      }),
      { numRuns: 200 },
    );
  });

  it("does not depend on the order of the colors", () => {
    fc.assert(
      fc.property(fc.array(anyRgb, { minLength: 2, maxLength: 6 }), (colors) => {
        expect(minPairwiseDeltaE([...colors].reverse())).toEqual(minPairwiseDeltaE(colors));
      }),
      { numRuns: 200 },
    );
  });

  it("C-DELTAE-10 throws a RangeError for fewer than two colors", () => {
    expect(() => minPairwiseDeltaE([])).toThrow(RangeError);
    expect(() => minPairwiseDeltaE([WHITE])).toThrow(RangeError);
    expect(() => minPairwiseDeltaE([])).toThrow(/minPairwiseDeltaE: colors/);
  });

  it("throws a TypeError for a value that is not a list of colors", () => {
    expect(() => minPairwiseDeltaE(null as unknown as Rgb[])).toThrow(TypeError);
    expect(() => minPairwiseDeltaE("ab" as unknown as Rgb[])).toThrow(TypeError);
    expect(() => minPairwiseDeltaE([WHITE, [1, 1] as unknown as Rgb])).toThrow(TypeError);
  });

  it("throws a RangeError naming the color whose channel is out of range or not finite", () => {
    for (const bad of BAD_CHANNELS) {
      for (const index of [0, 1, 2] as const) {
        const color = withChannel(WHITE, index, bad);
        expect(() => minPairwiseDeltaE([BLACK, color])).toThrow(/minPairwiseDeltaE: colors\[1\]/);
        expect(() => minPairwiseDeltaE([color, BLACK])).toThrow(RangeError);
      }
    }
  });

  it("measures a color slightly outside 0 to 1 as the edge it would be emitted as", () => {
    const edge = minPairwiseDeltaE([BLACK, [1 + 1e-6, 1 + 1e-6, 1 + 1e-6]]);
    const exact = minPairwiseDeltaE([BLACK, WHITE]);
    expect(edge).toEqual(exact);
  });

  it("matches the reference implementation in core.py and cvd.py to 1e-9", () => {
    for (const [name, hexes, expected] of MIN_PAIRWISE_GOLDEN) {
      const result = minPairwiseDeltaE(hexes.map(rgbOfHex));
      for (const view of VIEWS) {
        expect(Math.abs(result[view] - expected[view]), `${name}, ${view}`).toBeLessThanOrEqual(
          1e-9,
        );
      }
    }
  });

  it("does not change its argument", () => {
    const colors: readonly Rgb[] = Object.freeze([
      Object.freeze([0.1, 0.2, 0.3]) as unknown as Rgb,
      Object.freeze([0.3, 0.2, 0.1]) as unknown as Rgb,
    ]);
    expect(minPairwiseDeltaE(colors)).toEqual(
      minPairwiseDeltaE([
        [0.1, 0.2, 0.3],
        [0.3, 0.2, 0.1],
      ]),
    );
  });
});
