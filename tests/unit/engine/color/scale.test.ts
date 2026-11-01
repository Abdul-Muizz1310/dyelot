import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { wcagRatio } from "@/engine/color/contrast";
import { toHex } from "@/engine/color/convert";
import { gamutMap, inGamut, maxChroma } from "@/engine/color/gamut";
import {
  pickHex,
  type ScaleStep,
  STEPS,
  solveEvenScales,
  solveScale,
  stepChroma,
  TARGETS,
  UnsatisfiableTargetError,
} from "@/engine/color/scale";
import type { Gamut, Mode, Rgb } from "@/engine/color/types";
import { round6 } from "@/engine/round";
import { expectHexClose, hueDistance, rgbOfHex } from "./support";

// Cases are the C-SCALE-nn and C-PICK-nn rows of docs/specs/01-color-engine.md, section 6.4.

const WHITE: Rgb = rgbOfHex("#ffffff");
/** The emitted hex of oklch(0.18 0.01 262), the spec's DARK_PAGE (section 5). */
const DARK_PAGE: Rgb = rgbOfHex("#0f1216");
const HUES = [27, 55, 95, 150, 210, 262, 295, 350] as const;
const PEAK = 0.2;
const MODES: readonly [Mode, Rgb][] = [
  ["light", WHITE],
  ["dark", DARK_PAGE],
];

// Section 2, written out here so the tests do not read the module's own tables.
const EXPECTED_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const EXPECTED_TARGETS = [1.06, 1.15, 1.32, 1.65, 2.2, 3.0, 4.5, 7.0, 9.5, 12.5, 15.5];
const ENVELOPE = [0.12, 0.22, 0.4, 0.62, 0.85, 1, 1, 0.9, 0.75, 0.6, 0.45];
const THRESHOLD: Readonly<Record<number, number>> = { 500: 3, 600: 4.5, 700: 7 };
const HEX = /^#[0-9a-f]{6}$/;
const PROPERTY_TIMEOUT = 120_000;

const driftOf = (hue: number) => 40 * Math.min(1, Math.max(0, 1 - Math.abs(hue - 90) / 35));
const wrap = (hue: number) => ((hue % 360) + 360) % 360;

/** C-SCALE-02: the band on non-threshold steps, the threshold and overshoot on 500 to 700. */
function expectContrastChecks(scale: readonly ScaleStep[], page: Rgb): void {
  scale.forEach((entry, i) => {
    const target = EXPECTED_TARGETS[i];
    const ratio = wcagRatio(rgbOfHex(entry.hex), page);
    const threshold = THRESHOLD[EXPECTED_STEPS[i]];
    const where = `step ${entry.step} (${entry.hex}, ${ratio})`;
    if (threshold === undefined) {
      expect(Math.abs(ratio - target), where).toBeLessThanOrEqual(Math.max(0.05, 0.01 * target));
    } else {
      expect(ratio >= threshold, where).toBe(true);
      expect(ratio - target, where).toBeLessThanOrEqual(0.12);
    }
  });
}

/** C-SCALE-01: shape, hex form and the stored contrast. */
function expectShape(scale: readonly ScaleStep[], page: Rgb): void {
  expect(scale.map((entry) => entry.step)).toEqual(EXPECTED_STEPS);
  for (const entry of scale) {
    expect(entry.hex).toMatch(HEX);
    expect(Math.abs(entry.contrast - wcagRatio(rgbOfHex(entry.hex), page))).toBeLessThanOrEqual(
      1e-4,
    );
  }
}

/** C-SCALE-03: strict lightness order away from the page, adjacent steps at least 0.008 apart. */
function expectOrder(scale: readonly ScaleStep[], mode: Mode): void {
  for (let i = 1; i < scale.length; i++) {
    const delta = scale[i].oklch.l - scale[i - 1].oklch.l;
    if (mode === "light") expect(delta).toBeLessThan(0);
    else expect(delta).toBeGreaterThan(0);
    expect(Math.abs(delta)).toBeGreaterThanOrEqual(0.008);
  }
}

/** C-SCALE-04: hexes decode in [0, 1] and every oklch is in the requested gamut. */
function expectInGamut(scale: readonly ScaleStep[], gamut: Gamut): void {
  for (const entry of scale) {
    for (const channel of rgbOfHex(entry.hex)) {
      expect(channel).toBeGreaterThanOrEqual(0);
      expect(channel).toBeLessThanOrEqual(1);
    }
    expect(inGamut(entry.oklch, gamut)).toBe(true);
  }
}

/** C-SCALE-06: the stored chroma follows the envelope and the gamut cap. */
function expectChroma(
  scale: readonly ScaleStep[],
  hue: number,
  peak: number,
  mode: Mode,
  gamut: Gamut,
): void {
  const k = mode === "dark" ? 0.85 : 1;
  scale.forEach((entry, i) => {
    const drifted = wrap(hue - (driftOf(wrap(hue)) * i) / 10);
    const expected = Math.min(
      peak * ENVELOPE[i] * k,
      0.97 * maxChroma(entry.oklch.l, drifted, gamut),
    );
    expect(Math.abs(entry.oklch.c - expected), `step ${entry.step}`).toBeLessThanOrEqual(0.001);
  });
}

/** I-03 and I-04: finite numbers, and a null hue exactly when chroma is at most 4e-6. */
function expectFinite(scale: readonly ScaleStep[]): void {
  for (const entry of scale) {
    expect(Number.isFinite(entry.oklch.l)).toBe(true);
    expect(Number.isFinite(entry.oklch.c)).toBe(true);
    expect(Number.isFinite(entry.contrast)).toBe(true);
    if (entry.oklch.c <= 4e-6) expect(entry.oklch.h).toBeNull();
    else {
      expect(entry.oklch.h).not.toBeNull();
      expect(entry.oklch.h).toBeGreaterThanOrEqual(0);
      expect(entry.oklch.h).toBeLessThan(360);
    }
  }
}

/** The channels of a hex differ by at most one code from each other: a gray, or one code off it. */
function expectNearGray(hex: string): void {
  const codes = [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16));
  expect(Math.max(...codes) - Math.min(...codes), hex).toBeLessThanOrEqual(1);
}

const solve = (hue: number, mode: Mode, page: Rgb, peakChroma = PEAK, gamut: Gamut = "srgb") =>
  solveScale({ hue, peakChroma, mode, page, gamut });

describe("solveScale", () => {
  it("C-SCALE-01 returns 11 steps in order with lowercase hexes and their measured contrast", () => {
    expect([...STEPS]).toEqual(EXPECTED_STEPS);
    expect(EXPECTED_STEPS.map((step) => TARGETS[step as keyof typeof TARGETS])).toEqual(
      EXPECTED_TARGETS,
    );
    for (const [mode, page] of MODES) expectShape(solve(262, mode, page), page);
  });

  it("C-SCALE-02 lands every step in its band and every threshold step above its threshold", () => {
    for (const [mode, page] of MODES) {
      for (const hue of HUES) expectContrastChecks(solve(hue, mode, page), page);
    }
  });

  it("C-SCALE-03 orders lightness away from the page with adjacent steps 0.008 apart", () => {
    for (const [mode, page] of MODES) {
      for (const hue of HUES) expectOrder(solve(hue, mode, page), mode);
    }
  });

  it("C-SCALE-04 keeps every hex and every oklch in gamut", () => {
    for (const [mode, page] of MODES) {
      for (const hue of HUES) expectInGamut(solve(hue, mode, page), "srgb");
    }
  });

  it("C-SCALE-05 drifts yellows and ambers only, by the section 2 formula", () => {
    for (const [mode, page] of MODES) {
      const yellow = solve(95, mode, page);
      yellow.forEach((entry, i) => {
        expect(hueDistance(entry.oklch.h ?? Number.NaN, 95 - (34.286 * i) / 10)).toBeLessThan(0.1);
      });
      expect(hueDistance(yellow[0].oklch.h ?? Number.NaN, 95)).toBeLessThan(0.1);
      expect(hueDistance(yellow[10].oklch.h ?? Number.NaN, 60.714)).toBeLessThan(0.1);
      for (const hue of [262, 27, 55, 150]) {
        for (const entry of solve(hue, mode, page)) {
          expect(hueDistance(entry.oklch.h ?? Number.NaN, hue)).toBeLessThan(0.1);
        }
      }
      expect(hueDistance(solve(90, mode, page)[10].oklch.h ?? Number.NaN, 50)).toBeLessThan(0.1);
    }
  });

  it("C-SCALE-06 stores chroma as the envelope capped at 0.97 of the gamut's maximum", () => {
    for (const [mode, page] of MODES) {
      for (const hue of HUES) expectChroma(solve(hue, mode, page), hue, PEAK, mode, "srgb");
    }
  });

  it("stepChroma gives the stored chroma of every step, the formula lint rule K4 reads", () => {
    for (const [mode, page] of MODES) {
      for (const hue of HUES) {
        solve(hue, mode, page).forEach((entry, index) => {
          const expected = Math.min(
            PEAK * ENVELOPE[index] * (mode === "dark" ? 0.85 : 1),
            0.97 * maxChroma(entry.oklch.l, (entry.oklch.h ?? hue) as number, "srgb"),
          );
          const shared = stepChroma(
            { hue, peakChroma: PEAK, mode, gamut: "srgb" },
            index,
            entry.oklch.l,
          );
          expect(shared).toBeCloseTo(expected, 5);
          expect(shared).toBeCloseTo(entry.oklch.c, 5);
        });
      }
    }
  });

  it("stepChroma rejects bad input", () => {
    const ok = { hue: 20, peakChroma: 0.1, mode: "light", gamut: "srgb" } as const;
    expect(() => stepChroma(null as unknown as typeof ok, 0, 0.5)).toThrow(TypeError);
    for (const [palette, index, l] of [
      [{ ...ok, hue: Number.NaN }, 0, 0.5],
      [{ ...ok, peakChroma: Number.POSITIVE_INFINITY }, 0, 0.5],
      [{ ...ok, peakChroma: -0.01 }, 0, 0.5],
      [{ ...ok, peakChroma: 0.51 }, 0, 0.5],
      [{ ...ok, mode: "dim" }, 0, 0.5],
      [{ ...ok, gamut: "rec2020" }, 0, 0.5],
      [ok, 11, 0.5],
      [ok, 1.5, 0.5],
      [ok, -1, 0.5],
      [ok, 0, Number.NaN],
    ] as const) {
      expect(() => stepChroma(palette as typeof ok, index, l)).toThrow(RangeError);
    }
  });

  it(
    "C-SCALE-08 holds every invariant for any hue, peak chroma and mode",
    () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 360, noNaN: true, maxExcluded: true }),
          fc.double({ min: 0, max: 0.35, noNaN: true }),
          fc.constantFrom(...MODES),
          (hue, peak, [mode, page]) => {
            const scale = solve(hue, mode, page, peak);
            expectShape(scale, page);
            expectContrastChecks(scale, page);
            expectOrder(scale, mode);
            expectInGamut(scale, "srgb");
            expectChroma(scale, hue, peak, mode, "srgb");
            expectFinite(scale);
          },
        ),
        { numRuns: 200 },
      );
    },
    PROPERTY_TIMEOUT,
  );

  it("solves the threshold steps for target + 0.02, a margin above the 8-bit grid", () => {
    // The unquantized solution of a threshold step clears its target by more than 0.01, which a
    // solve for the bare target (margin 0) would not.
    for (const hue of HUES) {
      for (const [mode, page] of MODES) {
        for (const s of solve(hue, mode, page)) {
          const threshold = THRESHOLD[s.step];
          if (threshold === undefined) continue;
          const ratio = wcagRatio(gamutMap(s.oklch, "srgb"), page);
          expect(ratio, `${mode} ${hue} ${s.step}`).toBeGreaterThan(threshold + 0.01);
        }
      }
    }
  });

  it("C-SCALE-09 throws at step 700 on a #808080 light page, where black reaches 5.32:1", () => {
    const run = () => solve(27, "light", rgbOfHex("#808080"));
    expect(run).toThrow(UnsatisfiableTargetError);
    try {
      run();
    } catch (error) {
      const failure = error as UnsatisfiableTargetError;
      expect(failure).toBeInstanceOf(Error);
      expect(failure.name).toBe("UnsatisfiableTargetError");
      expect(failure.step).toBe(700);
      expect(failure.target).toBe(7.0);
      expect(failure.hue).toBe(27);
      expect(failure.message).toContain("700");
      expect(failure.message).toContain("27");
      expect(failure.message).toContain("7:1");
    }
  });

  it("C-SCALE-10 gives a valid scale or a typed error for extreme inputs", () => {
    const valid = (scale: readonly ScaleStep[], mode: Mode, gamut: Gamut = "srgb") => {
      expectOrder(scale, mode);
      expectInGamut(scale, gamut);
      expectFinite(scale);
    };
    // (a) A near-white light page and (b) a near-black dark page.
    valid(solve(27, "light", rgbOfHex("#fefefe")), "light");
    valid(solve(27, "dark", rgbOfHex("#050505")), "dark");
    // (c) Peak chroma 0: achromatic oklch and hexes one code from gray at most.
    for (const [mode, page] of MODES) {
      const scale = solve(27, mode, page, 0);
      valid(scale, mode);
      for (const entry of scale) {
        expect(entry.oklch.c).toBe(0);
        expect(entry.oklch.h).toBeNull();
        expectNearGray(entry.hex);
      }
    }
    // (d) Hue 110 at peak 0.35, above the gamut, in both modes.
    for (const [mode, page] of MODES) valid(solve(110, mode, page, 0.35), mode);
  });

  it("C-SCALE-11 throws at step 50 on a black light page and on a white dark page", () => {
    for (const [mode, page] of [
      ["light", rgbOfHex("#000000")],
      ["dark", rgbOfHex("#ffffff")],
    ] as const) {
      try {
        solve(200, mode, page);
        expect.unreachable("expected UnsatisfiableTargetError");
      } catch (error) {
        expect(error).toBeInstanceOf(UnsatisfiableTargetError);
        expect((error as UnsatisfiableTargetError).step).toBe(50);
        expect((error as UnsatisfiableTargetError).target).toBe(1.06);
        expect((error as UnsatisfiableTargetError).hue).toBe(200);
      }
    }
  });

  it("C-SCALE-12 throws RangeError on invalid input", () => {
    const base = {
      hue: 27,
      peakChroma: PEAK,
      mode: "light" as Mode,
      page: WHITE,
      gamut: "srgb" as Gamut,
    };
    for (const hue of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => solveScale({ ...base, hue })).toThrow(RangeError);
    }
    for (const peakChroma of [Number.NaN, -0.01, 0.51]) {
      expect(() => solveScale({ ...base, peakChroma })).toThrow(RangeError);
    }
    for (const page of [
      [1.5, 1, 1],
      [-0.1, 0, 0],
      [Number.NaN, 0, 0],
    ] as Rgb[]) {
      expect(() => solveScale({ ...base, page })).toThrow(RangeError);
    }
    expect(() => solveScale({ ...base, mode: "dim" as Mode })).toThrow(RangeError);
    expect(() => solveScale({ ...base, gamut: "rec2020" as Gamut })).toThrow(RangeError);
    const { hue: _hue, ...rest } = base;
    expect(() => solveEvenScales([], rest)).toThrow(RangeError);
    expect(() => solveEvenScales([27, Number.NaN], rest)).toThrow(RangeError);
  });

  it("C-SCALE-12 throws TypeError on a value of the wrong type (R-05)", () => {
    const rest = { peakChroma: PEAK, mode: "light" as Mode, page: WHITE, gamut: "srgb" as Gamut };
    expect(() => solveScale(null as unknown as Parameters<typeof solveScale>[0])).toThrow(
      TypeError,
    );
    expect(() => solveScale({ ...rest, hue: "27" as unknown as number })).toThrow(TypeError);
    expect(() => solveScale({ ...rest, hue: 27, mode: 1 as unknown as Mode })).toThrow(TypeError);
    expect(() => solveEvenScales("27" as unknown as number[], rest)).toThrow(TypeError);
  });

  it("C-SCALE-09 even scales throw UnsatisfiableTargetError on a #808080 light page", () => {
    const page = rgbOfHex("#808080");
    expect(() =>
      solveEvenScales([27, 150], { peakChroma: PEAK, mode: "light", page, gamut: "srgb" }),
    ).toThrow(UnsatisfiableTargetError);
  });

  it("C-SCALE-13 caps chroma by P3 but solves and measures on the sRGB hex", () => {
    for (const [mode, page] of MODES) {
      const scale = solve(145, mode, page, 0.3, "p3");
      expectShape(scale, page);
      expectInGamut(scale, "p3");
      expectContrastChecks(scale, page);
      expectChroma(scale, 145, 0.3, mode, "p3");
      expect(scale.some((entry) => entry.oklch.c > maxChroma(entry.oklch.l, 145, "srgb"))).toBe(
        true,
      );
    }
  });

  it(
    "C-SCALE-14 stores a hex within one code of the mapped oklch, and numbers already rounded",
    () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 360, noNaN: true, maxExcluded: true }),
          fc.double({ min: 0, max: 0.35, noNaN: true }),
          fc.constantFrom(...MODES),
          fc.constantFrom<Gamut>("srgb", "p3"),
          (hue, peak, [mode, page], gamut) => {
            for (const entry of solve(hue, mode, page, peak, gamut)) {
              expectHexClose(entry.hex, toHex(gamutMap(entry.oklch, "srgb")));
              expect(round6(entry.oklch.l)).toBe(entry.oklch.l);
              expect(round6(entry.oklch.c)).toBe(entry.oklch.c);
              if (entry.oklch.h !== null) expect(round6(entry.oklch.h)).toBe(entry.oklch.h);
              expect(round6(entry.contrast)).toBe(entry.contrast);
            }
          },
        ),
        { numRuns: 200 },
      );
    },
    PROPERTY_TIMEOUT,
  );

  it("C-SCALE-15 is deterministic and leaves the page alone", () => {
    const page = Object.freeze([1, 1, 1] as const);
    const first = solveScale({ hue: 95, peakChroma: PEAK, mode: "light", page, gamut: "srgb" });
    const second = solveScale({ hue: 95, peakChroma: PEAK, mode: "light", page, gamut: "srgb" });
    expect(second).toEqual(first);
    expect(page).toEqual([1, 1, 1]);
  });

  it("C-SCALE-17 measures contrast against the page it receives", () => {
    const pages: readonly [Mode, string][] = [
      ["light", "#f0f0f0"],
      ["dark", "#1a1410"],
      ["dark", "#0b1a12"],
    ];
    for (const [mode, hex] of pages) {
      const page = rgbOfHex(hex);
      const scale = solve(262, mode, page);
      expectShape(scale, page);
      expectContrastChecks(scale, page);
      expectOrder(scale, mode);
    }
    // On #f0f0f0 the 4.5:1 step is darker than on white.
    const onWhite = solve(262, "light", WHITE)[6].oklch.l;
    const onGray = solve(262, "light", rgbOfHex("#f0f0f0"))[6].oklch.l;
    expect(onGray).toBeLessThan(onWhite);
  });

  it("C-SCALE-18 gives null hues at peak 0 and finite hues otherwise", () => {
    for (const [mode, page] of MODES) {
      for (const entry of solve(150, mode, page, 0)) expect(entry.oklch.h).toBeNull();
      for (const entry of solve(150, mode, page, 0.05)) {
        expect(Number.isFinite(entry.oklch.h)).toBe(true);
      }
    }
  });

  it("C-SCALE-19 passes the contrast checks with neutral scales on three pages", () => {
    const pages: readonly [Mode, Rgb][] = [...MODES, ["dark", rgbOfHex("#121212")]];
    for (const [mode, page] of pages) {
      const scale = solve(262, mode, page, 0);
      expectContrastChecks(scale, page);
      for (const entry of scale) {
        expect(entry.oklch.c).toBe(0);
        expectNearGray(entry.hex);
      }
    }
  });

  it("C-SCALE-20 stores hue 0 for a hue that rounds to 360", () => {
    for (const [mode, page] of MODES) {
      for (const entry of solve(359.99999999999994, mode, page)) expect(entry.oklch.h).toBe(0);
    }
  });
});

describe("solveEvenScales", () => {
  it("C-SCALE-07 equalizes chroma across hues and keeps every scale's contrast checks", () => {
    const hues = [27, 150, 262];
    for (const [mode, page] of MODES) {
      const scales = solveEvenScales(hues, { peakChroma: PEAK, mode, page, gamut: "srgb" });
      expect(scales).toHaveLength(3);
      // Input order: each scale's first step carries its own hue.
      scales.forEach((scale, k) => {
        expect(hueDistance(scale[0].oklch.h ?? Number.NaN, hues[k])).toBeLessThan(0.1);
        expectShape(scale, page);
        expectContrastChecks(scale, page);
        expectOrder(scale, mode);
        expectInGamut(scale, "srgb");
      });
      for (let i = 0; i < STEPS.length; i++) {
        const chromas = scales.map((scale) => scale[i].oklch.c);
        expect(Math.max(...chromas) - Math.min(...chromas)).toBeLessThanOrEqual(0.005);
      }
    }
  });

  it("C-SCALE-16 with one hue equals solveScale for that hue", () => {
    for (const [mode, page] of MODES) {
      for (const hue of [95, 150, 262]) {
        const [even] = solveEvenScales([hue], { peakChroma: PEAK, mode, page, gamut: "srgb" });
        const standard = solve(hue, mode, page);
        even.forEach((entry, i) => {
          expect(Math.abs(entry.oklch.l - standard[i].oklch.l)).toBeLessThanOrEqual(0.001);
          expect(Math.abs(entry.oklch.c - standard[i].oklch.c)).toBeLessThanOrEqual(0.001);
          expectHexClose(entry.hex, standard[i].hex);
        });
      }
    }
  });
});

describe("pickHex", () => {
  it("C-PICK-01 picks the nearest of the hexes around the solution", () => {
    expect(pickHex([0.3, 0.45, 0.8], WHITE, 4.5)).toBe("#4d73cc");
  });

  it("C-PICK-02 picks the nearest hex, or the nearest one that meets the threshold", () => {
    expect(pickHex([0.338, 0.426, 0.879], WHITE, 4.5)).toBe("#576de0");
    expect(pickHex([0.338, 0.426, 0.879], WHITE, 4.5, 4.5)).toBe("#566de0");
  });

  it("C-PICK-03 equals a brute-force search over the up to eight hexes", () => {
    const channel = fc.double({ min: 0, max: 1, noNaN: true });
    fc.assert(
      fc.property(
        fc.tuple(channel, channel, channel),
        fc.constantFrom(WHITE, DARK_PAGE),
        fc.double({ min: 1, max: 21, noNaN: true }),
        fc.constantFrom<3 | 4.5 | 7 | undefined>(undefined, 3, 4.5, 7),
        (solution, page, target, threshold) => {
          // A channel within 1e-9 of a whole code is that code alone (C-PICK-04).
          const options = solution.map((value) => {
            const code = value * 255;
            if (Math.abs(code - Math.round(code)) <= 1e-9) return [Math.round(code)];
            return [...new Set([Math.floor(code), Math.ceil(code)])];
          });
          let best: { hex: string; error: number } | null = null;
          for (const r of options[0]) {
            for (const g of options[1]) {
              for (const b of options[2]) {
                const ratio = wcagRatio([r / 255, g / 255, b / 255], page);
                if (threshold !== undefined && ratio < threshold) continue;
                const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
                const error = Math.abs(ratio - target);
                if (
                  best === null ||
                  error < best.error ||
                  (error === best.error && hex < best.hex)
                ) {
                  best = { hex, error };
                }
              }
            }
          }
          if (best === null) {
            expect(() => pickHex(solution, page, target, threshold)).toThrow(RangeError);
            return;
          }
          const picked = pickHex(solution, page, target, threshold);
          expect(picked).toBe(best.hex);
          const rounded = solution.map((value) => Math.round(value * 255) / 255) as unknown as Rgb;
          const roundedRatio = wcagRatio(rounded, page);
          if (threshold === undefined || roundedRatio >= threshold) {
            expect(best.error).toBeLessThanOrEqual(Math.abs(roundedRatio - target));
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it("C-PICK-04 returns the hex itself for whole codes", () => {
    expect(pickHex([0.4, 0.4, 0.4], WHITE, 4.5)).toBe("#666666");
    expect(pickHex([102 / 255, 51 / 255, 1], WHITE, 4.5)).toBe("#6633ff");
  });

  it("C-PICK-05 keeps codes inside 0 to 255 at the edges and within the tolerance", () => {
    expect(pickHex([-1e-7, 0.5, 1 + 1e-7], WHITE, 3)).toMatch(/^#00(7f|80)ff$/);
    expect(pickHex([0, 0, 0], WHITE, 21)).toBe("#000000");
    expect(pickHex([1, 1, 1], WHITE, 1)).toBe("#ffffff");
  });

  it("throws TypeError for a threshold of the wrong type (R-05)", () => {
    for (const bad of ["4.5", null, true]) {
      expect(() => pickHex([0.3, 0.45, 0.8], WHITE, 4.5, bad as unknown as 4.5)).toThrow(TypeError);
    }
    expect(() => pickHex([0.3, 0.45, 0.8], WHITE, 4.5, 5 as unknown as 4.5)).toThrow(RangeError);
  });

  it("C-PICK-06 throws RangeError when no hex around the solution meets the threshold", () => {
    expect(() => pickHex([0.2, 0.5, 0.7], WHITE, 4.5, 4.5)).toThrow(RangeError);
  });

  it("C-PICK-07 throws RangeError on a non-finite or out-of-range input", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -1.1e-6, 1 + 1.1e-6, 1.5]) {
      expect(() => pickHex([bad, 0.5, 0.5], WHITE, 4.5)).toThrow(RangeError);
      expect(() => pickHex([0.5, 0.5, 0.5], [bad, 1, 1], 4.5)).toThrow(RangeError);
    }
    for (const target of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => pickHex([0.5, 0.5, 0.5], WHITE, target)).toThrow(RangeError);
    }
    expect(() => pickHex([0.5, 0.5, 0.5], WHITE, 4.5, 5 as 4.5)).toThrow(RangeError);
  });
});
