import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { wcagRatio } from "@/engine/color/contrast";
import { rgbToOklch, toHex } from "@/engine/color/convert";
import { deltaEOK, minPairwiseDeltaE } from "@/engine/color/deltae";
import { gamutMap, inGamut, maxChroma } from "@/engine/color/gamut";
import { type Harmony, harmonyHues } from "@/engine/color/harmony";
import {
  buildPalettes,
  type ColorParams,
  normalizeSeed,
  PALETTE_NAMES,
  type Palette,
  type PaletteName,
  pageFor,
} from "@/engine/color/palette";
import { parseColor } from "@/engine/color/parse";
import { type ScaleStep, STEPS, solveScale } from "@/engine/color/scale";
import type { Gamut, Hex, Mode, Oklch, Rgb } from "@/engine/color/types";
import { seededRandom } from "@/engine/random";
import { round6, roundHue } from "@/engine/round";
import { deepFreeze, expectStepContrast, rgbOfHex } from "./support";

// Cases are the C-PAL-nn and C-STATUS-nn rows of docs/specs/01-color-engine.md, section 6.5.

/** The color part of the spec's DEFAULT_PARAMS (section 5). */
const DEFAULTS: ColorParams = {
  harmony: "analogous",
  chroma: "balanced",
  neutralTint: "brand",
  gamut: "srgb",
  scaleMode: "standard",
  contrastLevel: "AA",
};
const HARMONY_LIST: readonly Harmony[] = [
  "monochrome",
  "analogous",
  "complementary",
  "split",
  "triadic",
  "tetradic",
];
const CHROMAS = ["muted", "balanced", "vivid"] as const;
const TINTS = ["none", "warm", "cool", "brand"] as const;
const MODES: readonly Mode[] = ["light", "dark"];
const STATUS = ["success", "warning", "danger", "info"] as const;
const EXTREME_SEEDS = [
  "#fefefe",
  "#010101",
  "#808080",
  "oklch(0.6 0 none)",
  "oklch(0.98 0.35 110)",
];
const WHITE = rgbOfHex("#ffffff");
/** A missing primary takes floor(262.5 / 360 × 360) = 262. */
const HUE_262 = () => 262.5 / 360;
const PROPERTY_TIMEOUT = 180_000;

const build = (overrides: Partial<ColorParams> = {}, random: () => number = HUE_262) =>
  buildPalettes({ ...DEFAULTS, ...overrides }, random);
const pageOf = (palettes: Record<PaletteName, Palette>, mode: Mode): Rgb =>
  rgbOfHex(pageFor(palettes.neutral, mode));
const indexOf = (step: number) => STEPS.indexOf(step as (typeof STEPS)[number]);

/** R-02 and R-03: the seed as the engine stores it. */
function rounded(color: Oklch): Oklch {
  const c = round6(color.c);
  return { l: round6(color.l), c, h: c <= 4e-6 ? null : roundHue(color.h ?? 0) };
}

/** R-10 and R-01: the color that stands in for a seed, and its hex. */
function expectedSeed(raw: Oklch, gamut: Gamut): { oklch: Oklch; hex: Hex; mapped: boolean } {
  const original = rounded(raw);
  const mapped = !inGamut(raw, gamut);
  const oklch = mapped ? rounded(rgbToOklch(gamutMap(original, gamut), gamut)) : original;
  return { oklch, hex: toHex(gamutMap(oklch, "srgb")), mapped };
}

/** The indexes of the steps that hold the seed, found by its stored color. */
function seedIndexes(scale: readonly ScaleStep[], seed: Oklch): number[] {
  return scale.flatMap((entry, i) =>
    entry.oklch.l === seed.l && entry.oklch.c === seed.c && entry.oklch.h === seed.h ? [i] : [],
  );
}

function expectStrictOrder(scale: readonly ScaleStep[], mode: Mode): void {
  for (let i = 1; i < scale.length; i++) {
    const delta = scale[i].oklch.l - scale[i - 1].oklch.l;
    if (mode === "light") expect(delta, `step ${scale[i].step}`).toBeLessThan(0);
    else expect(delta, `step ${scale[i].step}`).toBeGreaterThan(0);
  }
}

function expectFinite(palette: Palette): void {
  expect(Number.isFinite(palette.hue)).toBe(true);
  expect(Number.isFinite(palette.peakChroma)).toBe(true);
  for (const mode of MODES) {
    for (const entry of palette[mode]) {
      for (const value of [entry.oklch.l, entry.oklch.c, entry.contrast]) {
        expect(Number.isFinite(value)).toBe(true);
      }
      if (entry.oklch.c <= 4e-6) expect(entry.oklch.h).toBeNull();
      else {
        expect(entry.oklch.h).toBeGreaterThanOrEqual(0);
        expect(entry.oklch.h).toBeLessThan(360);
      }
    }
  }
  if (palette.seedDeviation !== undefined) {
    expect(Number.isFinite(palette.seedDeviation.deltaEOK)).toBe(true);
    expect(palette.seedDeviation.deltaEOK).toBeGreaterThanOrEqual(0);
  }
}

/**
 * C-PAL-06, C-PAL-10 and RF5 on one palette: shape, order, gamut and contrast of every non-seed
 * step, and a seed that is verbatim at `seedStep` or recorded in `seedDeviation`.
 */
function expectPalette(
  palettes: Record<PaletteName, Palette>,
  name: PaletteName,
  gamut: Gamut,
  raw: Oklch | undefined,
): void {
  const palette = palettes[name];
  expect(palette.name).toBe(name);
  expectFinite(palette);
  const seed = raw === undefined ? undefined : expectedSeed(raw, gamut);
  const held: Record<Mode, number[]> = { light: [], dark: [] };
  for (const mode of MODES) {
    const scale = palette[mode];
    const page = pageOf(palettes, mode);
    expect(scale.map((entry) => entry.step)).toEqual([...STEPS]);
    expectStrictOrder(scale, mode);
    if (seed !== undefined) held[mode] = seedIndexes(scale, seed.oklch);
    expect(held[mode].length).toBeLessThanOrEqual(1);
    scale.forEach((entry, i) => {
      expect(entry.hex).toMatch(/^#[0-9a-f]{6}$/);
      if (held[mode].includes(i)) {
        expect(entry.hex).toBe(seed?.hex);
        return;
      }
      expect(inGamut(entry.oklch, gamut), `${name} ${mode} ${entry.step}`).toBe(true);
      expectStepContrast(entry.hex, i, page, wcagRatio);
      const previous = scale[i - 1];
      if (previous !== undefined && !held[mode].includes(i - 1)) {
        expect(Math.abs(entry.oklch.l - previous.oklch.l)).toBeGreaterThanOrEqual(0.008);
      }
    });
  }
  if (seed === undefined) {
    expect("seedStep" in palette).toBe(false);
    expect("seedDeviation" in palette).toBe(false);
    return;
  }
  if (palette.seedStep !== undefined) {
    expect(held.light).toEqual([indexOf(palette.seedStep.light)]);
    expect(held.dark).toEqual([indexOf(palette.seedStep.dark)]);
    expect("seedDeviation" in palette).toBe(seed.mapped);
  } else {
    expect("seedStep" in palette).toBe(false);
    expect(palette.seedDeviation).toBeDefined();
    expect(held.light.length + held.dark.length).toBeLessThanOrEqual(1);
  }
}

describe("buildPalettes: hues and chroma", () => {
  it("C-PAL-01 draws a missing primary's hue once, as floor(random() × 360)", () => {
    for (const [value, hue] of [
      [0.5, 180],
      [0, 0],
      [0.999999, 359],
    ]) {
      let calls = 0;
      const palettes = build({}, () => {
        calls++;
        return value;
      });
      expect(palettes.primary.hue).toBe(hue);
      expect(calls).toBe(1);
    }
    let calls = 0;
    build({ primary: parseColor("#f66c6d") }, () => {
      calls++;
      return 0.5;
    });
    expect(calls).toBe(0);
  });

  it("C-PAL-02 takes secondary and accent hues from the harmony unless they are locked", () => {
    for (const harmony of HARMONY_LIST) {
      const palettes = build({ harmony }, () => 0.5);
      expect(palettes.secondary.hue, harmony).toBe(harmonyHues(180, harmony).secondary);
      expect(palettes.accent.hue, harmony).toBe(harmonyHues(180, harmony).accent);
    }
    const seed = parseColor("#f66c6d");
    const h0 = roundHue(seed.h ?? Number.NaN);
    const anchored = build({ primary: seed, harmony: "complementary" });
    expect(anchored.primary.hue).toBe(h0);
    expect(anchored.accent.hue).toBe(roundHue(harmonyHues(h0, "complementary").accent));
    const lockedSecondary = build({ secondary: seed, harmony: "triadic" });
    expect(lockedSecondary.secondary.hue).toBe(h0);
    expect(lockedSecondary.accent.hue).toBe(harmonyHues(262, "triadic").accent);
    const lockedAccent = build({ accent: seed, harmony: "triadic" });
    expect(lockedAccent.accent.hue).toBe(h0);
    expect(lockedAccent.secondary.hue).toBe(harmonyHues(262, "triadic").secondary);
  });

  it("C-PAL-03 sets peak chroma per palette from the chroma and tint parameters", () => {
    for (const [chroma, peak] of [
      ["muted", 0.08],
      ["balanced", 0.14],
      ["vivid", 0.22],
    ] as const) {
      const palettes = build({ chroma });
      expect(palettes.primary.peakChroma).toBe(peak);
      expect(palettes.accent.peakChroma).toBe(peak);
      expect(palettes.secondary.peakChroma).toBeCloseTo(0.6 * peak, 12);
      expect(round6(palettes.secondary.peakChroma)).toBe(palettes.secondary.peakChroma);
      for (const name of STATUS) expect(palettes[name].peakChroma).toBe(0.14);
    }
    for (const [neutralTint, peak, hue] of [
      ["none", 0, 262],
      ["warm", 0.012, 60],
      ["cool", 0.012, 250],
      ["brand", 0.01, 262],
    ] as const) {
      const palettes = build({ neutralTint });
      expect(palettes.neutral.peakChroma, neutralTint).toBe(peak);
      expect(palettes.neutral.hue, neutralTint).toBe(hue);
    }
  });

  it("C-PAL-04 puts the status palettes at hues 150, 70, 25 and 250", () => {
    const palettes = build();
    expect(STATUS.map((name) => palettes[name].hue)).toEqual([150, 70, 25, 250]);
    expect(Object.keys(palettes).sort()).toEqual([...PALETTE_NAMES].sort());
  });

  it("C-PAL-05 solves on #ffffff and on the neutral's dark page", () => {
    const brand = build();
    expect(pageFor(brand.neutral, "light")).toBe("#ffffff");
    expect(pageFor(brand.neutral, "dark")).toBe(
      toHex(gamutMap({ l: 0.18, c: 0.01, h: 262 }, "srgb")),
    );
    expect(pageFor(brand.neutral, "dark")).toBe("#0f1216");
    expect(pageFor(build({ neutralTint: "none" }).neutral, "dark")).toBe("#121212");
    expect(pageFor(build({ neutralTint: "warm" }).neutral, "dark")).toBe(
      toHex(gamutMap({ l: 0.18, c: 0.012, h: 60 }, "srgb")),
    );
    for (const mode of MODES) {
      const page = pageOf(brand, mode);
      for (const name of PALETTE_NAMES) {
        for (const entry of brand[name][mode]) {
          expect(Math.abs(entry.contrast - wcagRatio(rgbOfHex(entry.hex), page))).toBeLessThan(
            1e-4,
          );
        }
      }
    }
  });

  it("C-PAL-05 pageFor throws on an unknown mode or a bad neutral palette", () => {
    expect(() => pageFor(build().neutral, "dim" as Mode)).toThrow(RangeError);
    expect(() => pageFor(build().neutral, 1 as unknown as Mode)).toThrow(TypeError);
    const neutral = build().neutral;
    for (const bad of [
      { hue: 360 },
      { hue: -1 },
      { peakChroma: -0.01 },
      { peakChroma: 0.51 },
      { hue: Number.NaN },
    ]) {
      expect(() => pageFor({ ...neutral, ...bad }, "dark"), JSON.stringify(bad)).toThrow(
        RangeError,
      );
    }
    expect(() => pageFor(null as unknown as Palette, "light")).toThrow(TypeError);
  });
});

const unit = fc.double({ min: 0, max: 1, noNaN: true });
const anySeed: fc.Arbitrary<Oklch> = fc.oneof(
  fc.record({
    l: unit,
    c: fc.double({ min: 0, max: 0.5, noNaN: true }),
    h: fc.double({ min: 0, max: 360, maxExcluded: true, noNaN: true }),
  }),
  fc
    .tuple(
      fc.integer({ min: 0, max: 255 }),
      fc.integer({ min: 0, max: 255 }),
      fc.integer({ min: 0, max: 255 }),
    )
    .map(([r, g, b]) => rgbToOklch([r / 255, g / 255, b / 255], "srgb"))
    .map((color) => ({ l: Math.min(1, color.l), c: color.c, h: color.h })),
);
const anyParams: fc.Arbitrary<ColorParams> = fc.record(
  {
    primary: anySeed,
    secondary: anySeed,
    accent: anySeed,
    harmony: fc.constantFrom(...HARMONY_LIST),
    chroma: fc.constantFrom(...CHROMAS),
    neutralTint: fc.constantFrom(...TINTS),
    gamut: fc.constantFrom<Gamut>("srgb", "p3"),
    scaleMode: fc.constantFrom("standard" as const, "even" as const),
    contrastLevel: fc.constantFrom("AA" as const, "AA+" as const, "AAA" as const),
  },
  { requiredKeys: ["harmony", "chroma", "neutralTint", "gamut", "scaleMode", "contrastLevel"] },
);

describe("buildPalettes: the property", () => {
  it(
    "C-PAL-06 gives eight valid palettes for any parameters",
    () => {
      fc.assert(
        fc.property(
          anyParams,
          unit.filter((value) => value < 1),
          (params, draw) => {
            const palettes = buildPalettes(params, () => draw);
            expect(Object.keys(palettes).sort()).toEqual([...PALETTE_NAMES].sort());
            for (const name of PALETTE_NAMES) {
              const raw =
                name === "primary" || name === "secondary" || name === "accent"
                  ? params[name]
                  : undefined;
              expectPalette(palettes, name, params.gamut, raw);
            }
          },
        ),
        { numRuns: 100 },
      );
    },
    PROPERTY_TIMEOUT,
  );
});

describe("buildPalettes: seeds", () => {
  it("C-PAL-07 keeps #f66c6d verbatim at light step 400, because 500 needs 3:1", () => {
    const seed = parseColor("#f66c6d");
    expect(wcagRatio(rgbOfHex("#f66c6d"), WHITE)).toBeCloseTo(2.88, 2);
    const palettes = build({ primary: seed });
    const { primary } = palettes;
    expect(primary.light[4].hex).toBe("#f66c6d");
    expect(primary.light[4].oklch).toEqual({
      l: round6(seed.l),
      c: round6(seed.c),
      h: roundHue(seed.h ?? Number.NaN),
    });
    expect(primary.seedStep?.light).toBe(400);
    expect("seedDeviation" in primary).toBe(false);
    // Step 500 of the scale solved without the seed is the nearest by L, and the seed misses 3.0.
    const seedless = solveScale({
      hue: primary.hue,
      peakChroma: 0.14,
      mode: "light",
      page: WHITE,
      gamut: "srgb",
    });
    const gaps = seedless.map((entry) => Math.abs(entry.oklch.l - seed.l));
    expect(gaps.indexOf(Math.min(...gaps))).toBe(5);
    expect(wcagRatio(rgbOfHex("#f66c6d"), WHITE)).toBeLessThan(3);
    const dark = primary.seedStep?.dark;
    expect(dark).toBeDefined();
    expect(primary.dark[indexOf(dark ?? 0)].hex).toBe("#f66c6d");
    expectPalette(palettes, "primary", "srgb", seed);
  });

  it("C-PAL-08 gamut-maps oklch(0.7 0.3 145), places it and records the move", () => {
    const seed = parseColor("oklch(0.7 0.3 145)");
    expect(inGamut(seed, "srgb")).toBe(false);
    const palettes = build({ primary: seed });
    const { primary } = palettes;
    expect(primary.seedStep).toBeDefined();
    expect(primary.seedDeviation?.deltaEOK).toBeGreaterThan(0.02);
    expect(Math.abs((primary.seedDeviation?.deltaEOK ?? 0) - 0.06)).toBeLessThan(0.01);
    expect(primary.seedDeviation?.step).toBe(primary.seedStep?.light);
    const held = primary.light[indexOf(primary.seedStep?.light ?? 0)];
    expect(primary.seedDeviation?.deltaEOK).toBe(round6(deltaEOK(rounded(seed), held.oklch)));
    expectPalette(palettes, "primary", "srgb", seed);
  });

  it("C-PAL-09 records the nearest light step when no light step accepts the seed", () => {
    const seed: Oklch = { l: 0.68, c: 0.05, h: 0 };
    const seedHex = toHex(gamutMap(seed, "srgb"));
    const reference = solveScale({
      hue: 0,
      peakChroma: 0.14,
      mode: "light",
      page: WHITE,
      gamut: "srgb",
    });
    expect(Math.abs(reference[5].oklch.l - 0.686)).toBeLessThan(0.001);
    expect(wcagRatio(rgbOfHex(seedHex), WHITE)).toBeLessThan(3);
    expect(wcagRatio(rgbOfHex(seedHex), WHITE)).toBeCloseTo(2.95, 2);
    const palettes = build({ primary: seed });
    const { primary } = palettes;
    expect(primary.light).toEqual(reference);
    expect(primary.dark[6].hex).toBe(seedHex);
    expect(primary.dark[6].oklch).toEqual(seed);
    expect(Math.abs(primary.dark[6].contrast - 6.4)).toBeLessThan(0.05);
    expect("seedStep" in primary).toBe(false);
    const distances = reference.map((entry) => deltaEOK(seed, entry.oklch));
    const nearest = distances.indexOf(Math.min(...distances));
    expect(STEPS[nearest]).toBe(500);
    expect(primary.seedDeviation).toEqual({ step: 500, deltaEOK: round6(distances[nearest]) });
    expectPalette(palettes, "primary", "srgb", seed);
  });

  it("C-PAL-09 describes the dark mode when only the dark mode rejects the seed", () => {
    // oklch(0.48 0.02 150) holds light step 600, but every dark step rejects it.
    const seed: Oklch = { l: 0.48, c: 0.02, h: 150 };
    const seedHex = toHex(gamutMap(seed, "srgb"));
    const palettes = build({ primary: seed });
    const { primary } = palettes;
    expect(primary.light[indexOf(600)].hex).toBe(seedHex);
    const page = pageOf(palettes, "dark");
    const reference = solveScale({ hue: 150, peakChroma: 0.14, mode: "dark", page, gamut: "srgb" });
    expect(primary.dark).toEqual(reference);
    expect("seedStep" in primary).toBe(false);
    const distances = reference.map((entry) => deltaEOK(seed, entry.oklch));
    const nearest = distances.indexOf(Math.min(...distances));
    expect(primary.seedDeviation).toEqual({
      step: STEPS[nearest],
      deltaEOK: round6(distances[nearest]),
    });
    expectPalette(palettes, "primary", "srgb", seed);
  });

  it("C-PAL-10 handles every extreme seed in sRGB and P3", () => {
    for (const text of EXTREME_SEEDS) {
      for (const gamut of ["srgb", "p3"] as const) {
        const seed = parseColor(text);
        const palettes = build({ primary: seed, gamut });
        for (const name of PALETTE_NAMES) {
          expectPalette(palettes, name, gamut, name === "primary" ? seed : undefined);
        }
      }
    }
  });

  it("C-PAL-11 gives an achromatic seed a gray palette", () => {
    for (const text of ["#808080", "oklch(0.6 0 none)"]) {
      const { primary } = build({ primary: parseColor(text) });
      expect(primary.peakChroma).toBe(0);
      expect(primary.hue).toBe(0);
      for (const mode of MODES) {
        for (const entry of primary[mode]) {
          expect(entry.oklch.h).toBeNull();
          const codes = [1, 3, 5].map((at) => Number.parseInt(entry.hex.slice(at, at + 2), 16));
          expect(Math.max(...codes) - Math.min(...codes)).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("C-PAL-12 places a locked secondary or accent by the same rule", () => {
    const seed = parseColor("#f66c6d");
    for (const name of ["secondary", "accent"] as const) {
      const palettes = build({ [name]: seed });
      const palette = palettes[name];
      const step = palette.seedStep;
      expect(step).toBeDefined();
      expect(palette.light[indexOf(step?.light ?? 0)].hex).toBe("#f66c6d");
      expect(palette.dark[indexOf(step?.dark ?? 0)].hex).toBe("#f66c6d");
      expect("seedDeviation" in palette).toBe(false);
      expectPalette(palettes, name, "srgb", seed);
    }
    expect(build({ secondary: seed }).secondary.peakChroma).toBeCloseTo(0.6 * 0.14, 12);
  });

  it("C-PAL-13 keeps peak chroma from the parameter, not from the seed", () => {
    expect(build({ primary: parseColor("#f66c6d"), chroma: "muted" }).primary.peakChroma).toBe(
      0.08,
    );
  });

  it("C-PAL-18 stores hue 0 for a seed hue that rounds to 360", () => {
    const seed: Oklch = { l: 0.7, c: 0.17, h: 359.99999999999994 };
    const { primary } = build({ primary: seed });
    expect(primary.hue).toBe(0);
    for (const mode of MODES) {
      for (const entry of primary[mode]) expect(entry.oklch.h ?? 0).toBeLessThan(360);
      expect(primary[mode].some((entry) => entry.oklch.h === 0 && entry.oklch.l === 0.7)).toBe(
        true,
      );
    }
  });

  it("C-PAL-19 runs the achromatic test after rounding a seed", () => {
    const { primary } = build({ primary: { l: 0.6, c: 0.0000040000004, h: 120 } });
    expect(primary.peakChroma).toBe(0);
    expect(primary.hue).toBe(0);
    const held = [...primary.light, ...primary.dark].filter((entry) => entry.oklch.c === 4e-6);
    expect(held.length).toBeGreaterThan(0);
    for (const entry of held) expect(entry.oklch.h).toBeNull();
  });

  it("C-PAL-20 does not count rounding as gamut mapping: #0000ff stays verbatim", () => {
    const seed = parseColor("#0000ff");
    expect(inGamut(seed, "srgb")).toBe(true);
    expect(inGamut(rounded(seed), "srgb")).toBe(false);
    const { primary } = build({ primary: seed });
    expect("seedDeviation" in primary).toBe(false);
    expect(primary.seedStep).toEqual({ light: 700, dark: 400 });
    expect(primary.light[indexOf(700)].hex).toBe("#0000ff");
    expect(primary.dark[indexOf(400)].hex).toBe("#0000ff");
  });
});

describe("buildPalettes: modes, gamut and purity", () => {
  it("C-PAL-14 equalizes chroma within the even groups", () => {
    for (const primary of [undefined, parseColor("#f66c6d")]) {
      const extra = primary === undefined ? {} : { primary };
      const even = build({ ...extra, scaleMode: "even" });
      const standard = build({ ...extra, scaleMode: "standard" });
      expect(even.primary.peakChroma).toBe(even.accent.peakChroma);
      for (const mode of MODES) {
        const seedAt = primary === undefined ? -1 : indexOf(even.primary.seedStep?.[mode] ?? 0);
        STEPS.forEach((_, i) => {
          if (i !== seedAt) {
            expect(
              Math.abs(even.primary[mode][i].oklch.c - even.accent[mode][i].oklch.c),
            ).toBeLessThanOrEqual(0.005);
          }
          const chromas = STATUS.map((name) => even[name][mode][i].oklch.c);
          expect(Math.max(...chromas) - Math.min(...chromas)).toBeLessThanOrEqual(0.005);
        });
      }
      expect(even.secondary).toEqual(standard.secondary);
      expect(even.neutral).toEqual(standard.neutral);
    }
    // Unequal peaks: an achromatic primary and the accent each stand alone.
    const gray = parseColor("#808080");
    const even = build({ primary: gray, scaleMode: "even" });
    const standard = build({ primary: gray });
    expect(even.primary).toEqual(standard.primary);
    expect(even.accent).toEqual(standard.accent);
  });

  it("C-PAL-15 solves in P3 and measures on sRGB hexes", () => {
    const palettes = build({ gamut: "p3", chroma: "vivid" });
    for (const name of PALETTE_NAMES) expectPalette(palettes, name, "p3", undefined);
    const beyond = palettes.primary.light.some(
      (entry) => entry.oklch.c > maxChroma(entry.oklch.l, entry.oklch.h ?? 0, "srgb"),
    );
    expect(beyond).toBe(true);
  });

  it("C-PAL-16 is deterministic and leaves its input alone", () => {
    const params = deepFreeze({ ...DEFAULTS, accent: parseColor("#f66c6d") });
    const first = buildPalettes(params, seededRandom("seed-1"));
    const second = buildPalettes(params, seededRandom("seed-1"));
    expect(second).toEqual(first);
    expect(params.accent).toEqual(parseColor("#f66c6d"));
  });
});

describe("normalizeSeed", () => {
  it("C-PAL-19 rounds a seed, then applies the achromatic rule (R-02, R-03)", () => {
    expect(normalizeSeed({ l: 0.6, c: 0.0000040000004, h: 120 })).toEqual({
      l: 0.6,
      c: 4e-6,
      h: null,
    });
    expect(normalizeSeed({ l: 0.7002508346689501, c: 0.17, h: 359.99999999999994 })).toEqual({
      l: 0.700251,
      c: 0.17,
      h: 0,
    });
    // A chromatic color with no hue reads it as 0, as a CSS conversion does.
    expect(normalizeSeed({ l: 0.6, c: 0.1, h: null })).toEqual({ l: 0.6, c: 0.1, h: 0 });
    expect(normalizeSeed({ l: 1, c: 0, h: null })).toEqual({ l: 1, c: 0, h: null });
  });

  it("C-PAL-17 rejects a seed out of its domain instead of building a value (I-02, I-04)", () => {
    const cases: ReadonlyArray<readonly [Oklch, string]> = [
      [{ l: 1.5, c: 0.1, h: 20 }, "seed.l"],
      [{ l: -0.2, c: 0.1, h: 20 }, "seed.l"],
      [{ l: 0.5, c: 0.9, h: 720 }, "seed.c"],
      [{ l: 0.5, c: 0.1, h: 720 }, "seed.h"],
      [{ l: 0.5, c: 0.1, h: Number.NaN }, "seed.h"],
    ];
    for (const [seed, field] of cases) {
      expect(() => normalizeSeed(seed), JSON.stringify(seed)).toThrow(RangeError);
      expect(() => normalizeSeed(seed), JSON.stringify(seed)).toThrow(field);
    }
    expect(() => normalizeSeed(null as unknown as Oklch)).toThrow(TypeError);
    expect(() => normalizeSeed({ l: "0.5", c: 0.1, h: 20 } as unknown as Oklch)).toThrow(TypeError);
  });

  it("C-PAL-10 places a seed mapped to the white corner without leaving l in [0, 1]", () => {
    // gamutMap sends l 1 to white, whose OKLab l is 1.0000000000000002 before rounding.
    for (const gamut of ["srgb", "p3"] as const) {
      const seed: Oklch = { l: 1, c: 0.3, h: 100 };
      const palettes = build({ primary: seed, gamut });
      expectPalette(palettes, "primary", gamut, seed);
      const held = [...palettes.primary.light, ...palettes.primary.dark].filter(
        (entry) => entry.hex === "#ffffff",
      );
      expect(held.length).toBeGreaterThan(0);
      for (const entry of held) expect(entry.oklch.l).toBe(1);
    }
  });
});

describe("buildPalettes: failures", () => {
  const expectError = (
    kind: typeof RangeError | typeof TypeError,
    overrides: Record<string, unknown>,
    field: string,
    random: () => number = HUE_262,
  ) => {
    const run = () => buildPalettes({ ...DEFAULTS, ...overrides } as ColorParams, random);
    expect(run, field).toThrow(kind);
    expect(run, field).toThrow(field);
  };
  const expectRange = (overrides: Record<string, unknown>, field: string, random?: () => number) =>
    expectError(RangeError, overrides, field, random);
  const ENUM_FIELDS = ["harmony", "chroma", "neutralTint", "gamut", "scaleMode", "contrastLevel"];

  it("C-PAL-17 throws RangeError naming an enum field set to an unknown string", () => {
    for (const field of ENUM_FIELDS) {
      for (const value of ["tetris", "", "SRGB"]) expectRange({ [field]: value }, field);
    }
    // The harmony is checked even when all three colors are locked and no harmony is needed.
    const seed = parseColor("#f66c6d");
    expectRange({ primary: seed, secondary: seed, accent: seed, harmony: "tetris" }, "harmony");
  });

  it("C-PAL-17 throws TypeError naming an enum field of the wrong type (R-05)", () => {
    for (const field of ENUM_FIELDS) {
      for (const value of [42, null, undefined, true, {}]) {
        expectError(TypeError, { [field]: value }, field);
      }
    }
    const seed = parseColor("#f66c6d");
    expectError(
      TypeError,
      { primary: seed, secondary: seed, accent: seed, harmony: 42 },
      "harmony",
    );
  });

  it("C-PAL-17 throws RangeError naming a seed field out of its range", () => {
    const bad: ReadonlyArray<readonly [Record<string, number | null>, string]> = [
      [{ l: Number.NaN }, "l"],
      [{ c: Number.POSITIVE_INFINITY }, "c"],
      [{ h: Number.NaN }, "h"],
      [{ l: -0.1 }, "l"],
      [{ l: 1.1 }, "l"],
      [{ c: -0.01 }, "c"],
      [{ c: 0.51 }, "c"],
      [{ h: 360 }, "h"],
      [{ h: -1 }, "h"],
    ];
    for (const name of ["primary", "secondary", "accent"]) {
      for (const [change, field] of bad) {
        expectRange({ [name]: { l: 0.6, c: 0.1, h: 120, ...change } }, `${name}.${field}`);
      }
    }
  });

  it("C-PAL-17 throws RangeError for a random outside [0, 1)", () => {
    for (const value of [Number.NaN, -0.1, 1, 1.5, Number.POSITIVE_INFINITY]) {
      expectRange({}, "random", () => value);
    }
  });

  it("C-PAL-17 throws TypeError for a value of the wrong type", () => {
    expect(() => buildPalettes(null as unknown as ColorParams, HUE_262)).toThrow(TypeError);
    expect(() =>
      buildPalettes({ ...DEFAULTS, primary: "#f66c6d" as unknown as Oklch }, HUE_262),
    ).toThrow(TypeError);
    expect(() => buildPalettes(DEFAULTS, 0.5 as unknown as () => number)).toThrow(TypeError);
  });
});

describe("status palettes", () => {
  it(
    "C-STATUS-01 keeps the status indicators 0.08 apart under every view",
    () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 359 }),
          fc.constantFrom(...CHROMAS),
          fc.constantFrom(...TINTS),
          (hue, chroma, neutralTint) => {
            const palettes = build({ chroma, neutralTint }, () => (hue + 0.5) / 360);
            for (const mode of MODES) {
              const indicators = [
                palettes.warning[mode][indexOf(500)].hex,
                palettes.danger[mode][indexOf(600)].hex,
                palettes.info[mode][indexOf(700)].hex,
                palettes.success[mode][indexOf(800)].hex,
              ].map(rgbOfHex);
              const views = minPairwiseDeltaE(indicators);
              for (const value of Object.values(views)) expect(value).toBeGreaterThanOrEqual(0.08);
            }
          },
        ),
        { numRuns: 100 },
      );
    },
    PROPERTY_TIMEOUT,
  );

  it("C-STATUS-02 does not depend on the chroma parameter", () => {
    for (const scaleMode of ["standard", "even"] as const) {
      const [muted, balanced, vivid] = CHROMAS.map((chroma) => build({ chroma, scaleMode }));
      for (const name of STATUS) {
        expect(muted[name]).toEqual(balanced[name]);
        expect(vivid[name]).toEqual(balanced[name]);
        expect(balanced[name].peakChroma).toBe(0.14);
      }
    }
  });
});
