import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { meets, perceptualLc, relativeLuminance, wcagRatio } from "@/engine/color/contrast";
import type { Rgb } from "@/engine/color/types";
import { anyRgb, BAD_CHANNELS, edgeRgb, rgbOfHex, withChannel } from "./support";

// Cases are the C-CONTRAST-nn rows of docs/specs/01-color-engine.md, section 6.2.

const WHITE = rgbOfHex("#ffffff");
const BLACK = rgbOfHex("#000000");
const GRAY = rgbOfHex("#808080");
const THRESHOLDS = [3, 4.5, 7] as const;

/** `[text, background, ratio]`, computed with `wcag` in core.py. */
const WCAG_GOLDEN: ReadonlyArray<readonly [string, string, number]> = [
  ["#000000", "#ffffff", 21.0],
  ["#ffffff", "#ffffff", 1.0],
  ["#777777", "#ffffff", 4.478089453577214],
  ["#767676", "#ffffff", 4.542224959605253],
  ["#f5deb3", "#006400", 5.661595680344927],
  ["#0a0a0a", "#12121a", 1.0626498305026844],
  ["#f66c6d", "#0a0a0a", 6.867520682387571],
  ["#f66c6d", "#ffffff", 2.882866557839293],
  ["#0b0b0b", "#000000", 1.0669307152779832],
  ["#0a0b0c", "#0a0b0d", 1.0004716466472576],
  ["#4775ca", "#ffffff", 4.501329721500253],
  ["#4775ca", "#000000", 4.665288103578622],
  ["#ff0000", "#00ff00", 2.9139375476009137],
  ["#0000ff", "#ffff00", 8.00163666121113],
  ["#0a0a0a", "#050505", 1.0294585518175925],
];

/**
 * `[text, background, Lc, exit]`, computed with `apca_hex` in core.py. The exit names the branch
 * of the formula that the pair takes, so every branch has a vector.
 */
const LC_GOLDEN: ReadonlyArray<readonly [string, string, number, string]> = [
  ["#888888", "#ffffff", 63.056469930209424, "dark on light"],
  ["#ffffff", "#888888", -68.54146436644962, "light on dark"],
  ["#112233", "#ddeeff", 91.66830811481631, "dark on light, text soft-clamped"],
  ["#000000", "#ffffff", 106.04067321268862, "dark on light, text soft-clamped"],
  ["#ffffff", "#000000", -107.88473318309848, "light on dark, background soft-clamped"],
  ["#030303", "#ffffff", 106.0297026889441, "dark on light, text soft-clamped"],
  ["#ffffff", "#030303", -107.87660816670692, "light on dark, background soft-clamped"],
  ["#f66c6d", "#0a0a0a", -47.2722512129512, "light on dark, background soft-clamped"],
  ["#0a0a0a", "#f66c6d", 49.44078698806502, "dark on light, text soft-clamped"],
  ["#4775ca", "#ffffff", 70.99184091830836, "dark on light"],
  ["#ffffff", "#4775ca", -76.46443452062668, "light on dark"],
  ["#777777", "#ffffff", 71.11110332561125, "dark on light"],
  ["#ff0000", "#00ff00", 44.61232555629825, "dark on light"],
  ["#00ff00", "#ff0000", -48.22541681494661, "light on dark"],
  ["#1a1a1a", "#e6e6e6", 89.50864281530046, "dark on light, text soft-clamped"],
  ["#e6e6e6", "#1a1a1a", -90.31996006568627, "light on dark, background soft-clamped"],
  ["#202020", "#ffffff", 103.26248452493829, "dark on light, text soft-clamped"],
  ["#ffffff", "#202020", -105.76053397788247, "light on dark, background soft-clamped"],
  ["#ffffff", "#f0f0f0", -7.587356127782225, "light on dark, past the low clip"],
  ["#f0f0f0", "#ffffff", 0, "low clip, dark on light"],
  ["#ffffff", "#f4f4f4", 0, "low clip, light on dark"],
  ["#808080", "#8a8a8a", 0, "low clip, dark on light"],
  ["#2a2a2a", "#303030", 0, "low clip, both soft-clamped"],
  ["#303030", "#2a2a2a", 0, "low clip, both soft-clamped"],
  ["#202020", "#101010", 0, "low clip, light on dark, both soft-clamped"],
  ["#010101", "#000000", 0, "luminances within 0.0005"],
  ["#000000", "#010101", 0, "luminances within 0.0005"],
  ["#808080", "#808081", 0, "luminances within 0.0005"],
];

/** `base` raised, channel by channel, to at least the channels of `other`. */
function lifted(base: Rgb, other: Rgb): Rgb {
  return [Math.max(base[0], other[0]), Math.max(base[1], other[1]), Math.max(base[2], other[2])];
}

const withinTolerance = (actual: number, expected: number, tolerance: number): void => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
};

describe("relativeLuminance", () => {
  it("C-CONTRAST-13 gives white 1, black 0 and #808080 about 0.2159", () => {
    withinTolerance(relativeLuminance(WHITE), 1, 1e-12);
    expect(relativeLuminance(BLACK)).toBe(0);
    withinTolerance(relativeLuminance(GRAY), 0.2159, 1e-4);
  });

  it("weights the channels 0.2126, 0.7152 and 0.0722", () => {
    withinTolerance(relativeLuminance([1, 0, 0]), 0.2126, 1e-12);
    withinTolerance(relativeLuminance([0, 1, 0]), 0.7152, 1e-12);
    withinTolerance(relativeLuminance([0, 0, 1]), 0.0722, 1e-12);
  });

  it("C-CONTRAST-13 is continuous at the transfer threshold of 0.04045", () => {
    const below = relativeLuminance([0.04045, 0.04045, 0.04045]);
    const above = relativeLuminance([0.04046, 0.04046, 0.04046]);
    expect(above).toBeGreaterThan(below);
    expect(above - below).toBeLessThan(1e-5);
  });

  it("C-CONTRAST-14 throws a RangeError for a channel outside the tolerance or not finite", () => {
    for (const bad of BAD_CHANNELS) {
      for (const index of [0, 1, 2] as const) {
        expect(() => relativeLuminance(withChannel(GRAY, index, bad))).toThrow(RangeError);
      }
    }
  });

  it("accepts a channel exactly 1e-6 outside 0 to 1 and reads it as the edge", () => {
    expect(relativeLuminance([-1e-6, -1e-6, -1e-6])).toBe(0);
    expect(relativeLuminance([1 + 1e-6, 1 + 1e-6, 1 + 1e-6])).toBe(relativeLuminance(WHITE));
  });

  it("names the function and the argument in its error", () => {
    expect(() => relativeLuminance([0, 2, 0])).toThrow(/relativeLuminance: rgb/);
  });

  it("throws a TypeError for a value that is not three channels", () => {
    expect(() => relativeLuminance(null as unknown as Rgb)).toThrow(TypeError);
    expect(() => relativeLuminance([0.5, 0.5] as unknown as Rgb)).toThrow(TypeError);
    expect(() => relativeLuminance([0.5, "0.5", 0.5] as unknown as Rgb)).toThrow(TypeError);
  });

  it("does not change its argument", () => {
    const color = Object.freeze([0.2, 0.4, 0.6]) as unknown as Rgb;
    expect(relativeLuminance(color)).toBe(relativeLuminance([0.2, 0.4, 0.6]));
  });
});

describe("wcagRatio", () => {
  it("C-CONTRAST-01 gives #f5deb3 on #006400 about 5.6616", () => {
    withinTolerance(wcagRatio(rgbOfHex("#f5deb3"), rgbOfHex("#006400")), 5.6616, 1e-4);
  });

  it("C-CONTRAST-02 gives #777777 on white about 4.4781, which misses 4.5", () => {
    const ratio = wcagRatio(rgbOfHex("#777777"), WHITE);
    withinTolerance(ratio, 4.4781, 1e-4);
    expect(meets(ratio, 4.5)).toBe(false);
  });

  it("C-CONTRAST-03 gives #767676 on white about 4.5422, which meets 4.5", () => {
    const ratio = wcagRatio(rgbOfHex("#767676"), WHITE);
    withinTolerance(ratio, 4.5422, 1e-4);
    expect(meets(ratio, 4.5)).toBe(true);
  });

  it("C-CONTRAST-04 is symmetric, with exact equality", () => {
    fc.assert(
      fc.property(anyRgb, anyRgb, (a, b) => {
        expect(wcagRatio(a, b)).toBe(wcagRatio(b, a));
      }),
      { numRuns: 500 },
    );
  });

  it("C-CONTRAST-05 gives exactly 1 for a color against itself", () => {
    fc.assert(
      fc.property(anyRgb, (color) => {
        expect(wcagRatio(color, color)).toBe(1);
      }),
      { numRuns: 500 },
    );
  });

  it("C-CONTRAST-13 gives black on white 21", () => {
    withinTolerance(wcagRatio(BLACK, WHITE), 21, 1e-9);
  });

  it("C-CONTRAST-16 stays in [1, 21] for channels within the tolerance", () => {
    fc.assert(
      fc.property(edgeRgb, edgeRgb, (a, b) => {
        const ratio = wcagRatio(a, b);
        expect(ratio).toBeGreaterThanOrEqual(1);
        expect(ratio).toBeLessThanOrEqual(21);
      }),
      { numRuns: 500 },
    );
  });

  it("C-CONTRAST-17 stays finite and at most 21 for channels slightly outside 0 to 1", () => {
    const ratio = wcagRatio([-1e-7, 0.5, 1 + 1e-7], WHITE);
    expect(Number.isFinite(ratio)).toBe(true);
    expect(ratio).toBeGreaterThanOrEqual(1);
    expect(wcagRatio([1 + 1e-6, 1 + 1e-6, 1 + 1e-6], BLACK)).toBeLessThanOrEqual(21);
    expect(wcagRatio(BLACK, [1 + 1e-6, 1 + 1e-6, 1 + 1e-6])).toBeLessThanOrEqual(21);
  });

  it("C-CONTRAST-14 throws a RangeError for a channel outside the tolerance or not finite", () => {
    for (const bad of BAD_CHANNELS) {
      for (const index of [0, 1, 2] as const) {
        const color = withChannel(GRAY, index, bad);
        expect(() => wcagRatio(color, WHITE)).toThrow(RangeError);
        expect(() => wcagRatio(WHITE, color)).toThrow(RangeError);
      }
    }
  });

  it("names the argument that is out of range", () => {
    expect(() => wcagRatio([2, 0, 0], WHITE)).toThrow(/wcagRatio: a/);
    expect(() => wcagRatio(WHITE, [0, 0, 2])).toThrow(/wcagRatio: b/);
  });

  it("throws a TypeError for a value that is not three channels", () => {
    expect(() => wcagRatio(undefined as unknown as Rgb, WHITE)).toThrow(TypeError);
    expect(() => wcagRatio(WHITE, [1, 1] as unknown as Rgb)).toThrow(TypeError);
  });

  it("matches the reference implementation in core.py", () => {
    for (const [text, background, expected] of WCAG_GOLDEN) {
      const ratio = wcagRatio(rgbOfHex(text), rgbOfHex(background));
      expect(Math.abs(ratio - expected), `${text} on ${background}`).toBeLessThanOrEqual(1e-12);
    }
  });
});

describe("meets", () => {
  it("C-CONTRAST-06 never rounds: a ratio a hair under its threshold fails", () => {
    expect(meets(4.4999999, 4.5)).toBe(false);
    expect(meets(2.9999999, 3)).toBe(false);
    expect(meets(6.999999, 7)).toBe(false);
  });

  it("C-CONTRAST-06 fails the largest double under each threshold", () => {
    // 4.5 - 4 * EPSILON, 3 - 2 * EPSILON and 7 - 4 * EPSILON are one step below their thresholds.
    expect(4.5 - 4 * Number.EPSILON).toBeLessThan(4.5);
    expect(meets(4.5 - 4 * Number.EPSILON, 4.5)).toBe(false);
    expect(3 - 2 * Number.EPSILON).toBeLessThan(3);
    expect(meets(3 - 2 * Number.EPSILON, 3)).toBe(false);
    expect(7 - 4 * Number.EPSILON).toBeLessThan(7);
    expect(meets(7 - 4 * Number.EPSILON, 7)).toBe(false);
  });

  it("C-CONTRAST-06 passes a ratio at or over its threshold", () => {
    expect(meets(4.5, 4.5)).toBe(true);
    expect(meets(3, 3)).toBe(true);
    expect(meets(7, 7)).toBe(true);
    expect(meets(21, 7)).toBe(true);
    expect(meets(7.0000001, 7)).toBe(true);
  });

  it("holds each ratio to its own threshold", () => {
    expect(meets(5, 3)).toBe(true);
    expect(meets(5, 4.5)).toBe(true);
    expect(meets(5, 7)).toBe(false);
    expect(meets(1, 3)).toBe(false);
  });

  it("C-CONTRAST-15 throws a RangeError for a ratio that is not finite", () => {
    for (const threshold of THRESHOLDS) {
      expect(() => meets(Number.NaN, threshold)).toThrow(RangeError);
      expect(() => meets(Number.POSITIVE_INFINITY, threshold)).toThrow(RangeError);
      expect(() => meets(Number.NEGATIVE_INFINITY, threshold)).toThrow(RangeError);
    }
  });

  it("C-CONTRAST-15 throws a RangeError for a threshold other than 3, 4.5 or 7", () => {
    for (const threshold of [
      0,
      1,
      4.4999,
      4.5000001,
      5,
      21,
      -3,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ]) {
      expect(() => meets(5, threshold as 3)).toThrow(RangeError);
    }
  });

  it("names the argument in its error", () => {
    expect(() => meets(Number.NaN, 4.5)).toThrow(/meets: ratio/);
    expect(() => meets(5, 5 as 3)).toThrow(/meets: threshold/);
  });

  it("throws a TypeError for a ratio or a threshold of the wrong type", () => {
    expect(() => meets("5" as unknown as number, 4.5)).toThrow(TypeError);
    expect(() => meets(5, "4.5" as unknown as 4.5)).toThrow(TypeError);
    expect(() => meets(5, undefined as unknown as 3)).toThrow(TypeError);
  });
});

describe("perceptualLc", () => {
  it("C-CONTRAST-07 gives #888888 on white about 63.056", () => {
    withinTolerance(perceptualLc(rgbOfHex("#888888"), WHITE), 63.056, 1e-3);
  });

  it("C-CONTRAST-08 gives white on #888888 about -68.541", () => {
    withinTolerance(perceptualLc(WHITE, rgbOfHex("#888888")), -68.541, 1e-3);
  });

  it("C-CONTRAST-09 gives #112233 on #ddeeff about 91.668", () => {
    withinTolerance(perceptualLc(rgbOfHex("#112233"), rgbOfHex("#ddeeff")), 91.668, 1e-3);
  });

  it("C-CONTRAST-10 gives +0 for a color against itself", () => {
    fc.assert(
      fc.property(anyRgb, (color) => {
        expect(perceptualLc(color, color)).toBe(0);
      }),
      { numRuns: 500 },
    );
  });

  it("C-CONTRAST-11 is positive or zero for darker text on a lighter background", () => {
    fc.assert(
      fc.property(anyRgb, anyRgb, (text, other) => {
        // The background is at least as light as the text in every channel, so it is at least as
        // light by any luminance that grows with each channel.
        const background = lifted(text, other);
        expect(perceptualLc(text, background)).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 500 },
    );
  });

  it("C-CONTRAST-11 is negative or zero for lighter text on a darker background", () => {
    fc.assert(
      fc.property(anyRgb, anyRgb, (background, other) => {
        const text = lifted(background, other);
        expect(perceptualLc(text, background)).toBeLessThanOrEqual(0);
      }),
      { numRuns: 500 },
    );
  });

  it("gives a score of the sign that its polarity says, never a signed zero", () => {
    expect(perceptualLc(rgbOfHex("#888888"), WHITE)).toBeGreaterThan(0);
    expect(perceptualLc(WHITE, rgbOfHex("#888888"))).toBeLessThan(0);
    // A clipped score is +0, and Object.is tells it from -0.
    expect(perceptualLc(rgbOfHex("#f0f0f0"), WHITE)).toBe(0);
    expect(perceptualLc(WHITE, rgbOfHex("#f4f4f4"))).toBe(0);
    expect(perceptualLc(rgbOfHex("#010101"), BLACK)).toBe(0);
  });

  it("C-CONTRAST-14 throws a RangeError for a channel outside the tolerance or not finite", () => {
    for (const bad of BAD_CHANNELS) {
      for (const index of [0, 1, 2] as const) {
        const color = withChannel(GRAY, index, bad);
        expect(() => perceptualLc(color, WHITE)).toThrow(RangeError);
        expect(() => perceptualLc(WHITE, color)).toThrow(RangeError);
      }
    }
  });

  it("names the argument that is out of range", () => {
    expect(() => perceptualLc([2, 0, 0], WHITE)).toThrow(/perceptualLc: text/);
    expect(() => perceptualLc(WHITE, [0, 0, 2])).toThrow(/perceptualLc: background/);
  });

  it("throws a TypeError for a value that is not three channels", () => {
    expect(() => perceptualLc(null as unknown as Rgb, WHITE)).toThrow(TypeError);
    expect(() => perceptualLc(WHITE, [1, 1, 1, 1] as unknown as Rgb)).toThrow(TypeError);
  });

  it("C-CONTRAST-17 stays finite for a channel slightly below 0", () => {
    const lc = perceptualLc([-1e-7, 0.5, 0.5], WHITE);
    expect(Number.isFinite(lc)).toBe(true);
    expect(Number.isFinite(perceptualLc(WHITE, [-1e-7, -1e-7, -1e-7]))).toBe(true);
  });

  it("stays finite for channels within the tolerance", () => {
    fc.assert(
      fc.property(edgeRgb, edgeRgb, (text, background) => {
        expect(Number.isFinite(perceptualLc(text, background))).toBe(true);
      }),
      { numRuns: 500 },
    );
  });

  it("matches the reference implementation in core.py to 1e-9 on every branch", () => {
    for (const [text, background, expected, exit] of LC_GOLDEN) {
      const lc = perceptualLc(rgbOfHex(text), rgbOfHex(background));
      expect(Math.abs(lc - expected), `${exit}: ${text} on ${background}`).toBeLessThanOrEqual(
        1e-9,
      );
    }
  });

  it("returns +0, not -0, for every clipped vector", () => {
    for (const [text, background, expected, exit] of LC_GOLDEN) {
      if (expected === 0) {
        expect(perceptualLc(rgbOfHex(text), rgbOfHex(background)), exit).toBe(0);
      }
    }
  });
});

describe("the name of the perceptual score", () => {
  const ROOT = path.resolve(import.meta.dirname, "../../../..");
  const SRC = path.join(ROOT, "src");
  // The brand of the published formula. The spec forbids it in code, comments and copy, in any case.
  const FORBIDDEN = /apca/i;

  const TEXT_EXTENSIONS = new Set([
    ".ts",
    ".tsx",
    ".js",
    ".mjs",
    ".css",
    ".svg",
    ".md",
    ".txt",
    ".json",
  ]);
  const filesUnder = (directory: string): string[] =>
    readdirSync(directory, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => path.join(entry.parentPath, entry.name));

  it("C-CONTRAST-12 appears in no file under src/, in any case", () => {
    const files = filesUnder(SRC);
    // The scan must reach real files, or it would pass by looking at nothing.
    expect(files.length).toBeGreaterThan(0);
    expect(files).toContain(path.join(SRC, "engine/color/contrast.ts"));
    // Text files only: a font or an image could hold the four letters by chance.
    const texts = files.filter((file) => TEXT_EXTENSIONS.has(path.extname(file)));
    expect(texts).toContain(path.join(SRC, "app/globals.css"));
    expect(texts).not.toContain(path.join(SRC, "app/favicon.ico"));
    const offenders = texts
      .filter((file) => FORBIDDEN.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(ROOT, file));
    expect(offenders).toEqual([]);
  });

  it("is a grep that catches the name however it is written", () => {
    for (const text of [
      "APCA",
      "apca",
      "Apca",
      "aPcA",
      "the APCA score",
      "// ported from apca-w3",
    ]) {
      expect(FORBIDDEN.test(text), text).toBe(true);
    }
    for (const text of ["perceptualLc", "perceptual contrast (advisory)", "apc a", ""]) {
      expect(FORBIDDEN.test(text), text).toBe(false);
    }
  });
});
