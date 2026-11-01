import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { pickChartColors } from "@/engine/color/chart";
import { wcagRatio } from "@/engine/color/contrast";
import { minPairwiseDeltaE } from "@/engine/color/deltae";
import {
  buildPalettes,
  type ColorParams,
  type Palette,
  type PaletteName,
  pageFor,
} from "@/engine/color/palette";
import { solveScale } from "@/engine/color/scale";
import type { Gamut, Mode } from "@/engine/color/types";
import { rgbOfHex } from "./support";

// Cases are the C-CHART-nn rows of docs/specs/01-color-engine.md, section 6.5.

const DEFAULTS: ColorParams = {
  harmony: "analogous",
  chroma: "balanced",
  neutralTint: "brand",
  gamut: "srgb",
  scaleMode: "standard",
  contrastLevel: "AA",
};
const MODES: readonly Mode[] = ["light", "dark"];
const HUE_262 = () => 262.5 / 360;
const PROPERTY_TIMEOUT = 240_000;

const build = (overrides: Partial<ColorParams> = {}, random: () => number = HUE_262) =>
  buildPalettes({ ...DEFAULTS, ...overrides }, random);
const ratio = (a: string, b: string) => wcagRatio(rgbOfHex(a), rgbOfHex(b));

/** The candidate hexes of section 2 and R-13, solved here with solveScale. */
function candidates(palettes: Record<PaletteName, Palette>, mode: Mode, gamut: Gamut): Set<string> {
  const page = rgbOfHex(pageFor(palettes.neutral, mode));
  const found = new Set<string>();
  for (let hue = 0; hue < 360; hue += 15) {
    const scale = solveScale({ hue, peakChroma: 0.14, mode, page, gamut });
    for (const index of [6, 7, 8, 9]) found.add(scale[index].hex);
  }
  return found;
}

/** C-CHART-01 and C-CHART-02 on one pick; returns the smallest ratios against page and card. */
function expectPick(palettes: Record<PaletteName, Palette>, mode: Mode, chart: readonly string[]) {
  expect(chart).toHaveLength(5);
  expect(new Set(chart).size).toBe(5);
  for (const hex of chart) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  expect(chart[0]).toBe(palettes.primary[mode][6].hex);
  const page = pageFor(palettes.neutral, mode);
  const card = palettes.neutral[mode][0].hex;
  const onPage = Math.min(...chart.map((hex) => ratio(hex, page)));
  const onCard = Math.min(...chart.map((hex) => ratio(hex, card)));
  expect(onPage).toBeGreaterThanOrEqual(3);
  expect(onCard).toBeGreaterThanOrEqual(3);
  return { onPage, onCard };
}

describe("pickChartColors", () => {
  it("C-CHART-01 and C-CHART-02 pick five distinct colors at 3:1 on page and card", () => {
    const palettes = build();
    for (const mode of MODES) {
      const { onPage, onCard } = expectPick(
        palettes,
        mode,
        pickChartColors(palettes, mode, "srgb"),
      );
      expect(onPage).toBeGreaterThanOrEqual(4.5);
      expect(onCard).toBeGreaterThanOrEqual(4.2);
    }
  });

  it(
    "C-CHART-03 keeps the five 0.08 apart under every view",
    () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 359 }),
          fc.constantFrom("muted", "balanced", "vivid" as const),
          (hue, chroma) => {
            const palettes = build({ chroma }, () => (hue + 0.5) / 360);
            for (const mode of MODES) {
              const chart = pickChartColors(palettes, mode, "srgb");
              expectPick(palettes, mode, chart);
              const views = minPairwiseDeltaE(chart.map(rgbOfHex));
              for (const value of Object.values(views)) expect(value).toBeGreaterThanOrEqual(0.08);
            }
          },
        ),
        { numRuns: 100 },
      );
    },
    PROPERTY_TIMEOUT,
  );

  it("C-CHART-04 gives the same array for the same palettes, in any key order", () => {
    const palettes = build();
    const reordered = Object.fromEntries(Object.entries(palettes).reverse()) as Record<
      PaletteName,
      Palette
    >;
    for (const mode of MODES) {
      const first = pickChartColors(palettes, mode, "srgb");
      expect(pickChartColors(palettes, mode, "srgb")).toEqual(first);
      expect(pickChartColors(reordered, mode, "srgb")).toEqual(first);
    }
  });

  it("C-CHART-05 picks every later color from the 0.14 candidates on steps 600 to 900", () => {
    for (const palettes of [build(), build({ neutralTint: "warm", chroma: "vivid" }, () => 0.1)]) {
      for (const mode of MODES) {
        const pool = candidates(palettes, mode, "srgb");
        for (const hex of pickChartColors(palettes, mode, "srgb").slice(1))
          expect(pool).toContain(hex);
      }
    }
  });

  it("C-CHART-06 solves the candidates in P3 and keeps the checks on the hexes", () => {
    const palettes = build({ gamut: "p3" });
    for (const mode of MODES) {
      const chart = pickChartColors(palettes, mode, "p3");
      expectPick(palettes, mode, chart);
      const pool = candidates(palettes, mode, "p3");
      for (const hex of chart.slice(1)) expect(pool).toContain(hex);
      for (const value of Object.values(minPairwiseDeltaE(chart.map(rgbOfHex)))) {
        expect(value).toBeGreaterThanOrEqual(0.08);
      }
    }
  });

  it("C-CHART-07 throws RangeError for an unknown mode or gamut, or a missing palette", () => {
    const palettes = build();
    expect(() => pickChartColors(palettes, "dim" as Mode, "srgb")).toThrow(RangeError);
    expect(() => pickChartColors(palettes, "light", "rec2020" as Gamut)).toThrow(RangeError);
    for (const name of ["primary", "neutral"] as const) {
      const { [name]: _missing, ...partial } = palettes;
      expect(() =>
        pickChartColors(partial as Record<PaletteName, Palette>, "light", "srgb"),
      ).toThrow(RangeError);
    }
    const short = {
      ...palettes,
      primary: { ...palettes.primary, light: palettes.primary.light.slice(1) },
    };
    expect(() => pickChartColors(short, "light", "srgb")).toThrow(RangeError);
    const notARecord = null as unknown as Record<PaletteName, Palette>;
    expect(() => pickChartColors(notARecord, "light", "srgb")).toThrow(TypeError);
  });
});
