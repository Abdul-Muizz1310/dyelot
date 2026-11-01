import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { pickChartColors } from "@/engine/color/chart";
import { perceptualLc, relativeLuminance, wcagRatio } from "@/engine/color/contrast";
import { linearToSrgb } from "@/engine/color/convert";
import {
  buildPalettes,
  type ColorParams,
  type Palette,
  type PaletteName,
  pageFor,
} from "@/engine/color/palette";
import {
  onFill,
  ROLE_NAMES,
  type RoleName,
  resolveRoles,
  selectOnFill,
} from "@/engine/color/roles";
import { STEPS } from "@/engine/color/scale";
import type { Hex, Mode, Rgb } from "@/engine/color/types";
import { seededRandom } from "@/engine/random";
import { anyRgb, BAD_CHANNELS, deepFreeze, rgbOfHex, withChannel } from "./support";

// Cases are the C-ROLE-nn and C-ONFILL-nn rows of docs/specs/01-color-engine.md, section 6.5.

type Level = "AA" | "AA+" | "AAA";
const DEFAULTS: ColorParams = {
  harmony: "analogous",
  chroma: "balanced",
  neutralTint: "brand",
  gamut: "srgb",
  scaleMode: "standard",
  contrastLevel: "AA",
};
const MODES: readonly Mode[] = ["light", "dark"];
const LEVELS: readonly Level[] = ["AA", "AA+", "AAA"];
const HUE_262 = () => 262.5 / 360;
const CHART = ["#111111", "#222222", "#333333", "#444444", "#555555"] as Hex[];
const PROPERTY_TIMEOUT = 240_000;
const WHITE = "#ffffff";
const BLACK = "#000000";

/** The 46 names of section 6.5, written out so the test does not read the module's list. */
const EXPECTED_NAMES = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "muted",
  "muted-foreground",
  "secondary",
  "secondary-foreground",
  "accent",
  "accent-foreground",
  "primary",
  "primary-foreground",
  "destructive",
  "destructive-foreground",
  "destructive-subtle",
  "destructive-subtle-foreground",
  "success",
  "success-foreground",
  "success-subtle",
  "success-subtle-foreground",
  "warning",
  "warning-foreground",
  "warning-subtle",
  "warning-subtle-foreground",
  "info",
  "info-foreground",
  "info-subtle",
  "info-subtle-foreground",
  "border",
  "input",
  "ring",
  "sidebar",
  "sidebar-foreground",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
  "sidebar-ring",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
];

/** The C1 and C5 pairs of section 6.5, as [foreground, fill]. */
const C1: ReadonlyArray<readonly [RoleName, RoleName]> = [
  ["foreground", "background"],
  ["card-foreground", "card"],
  ["popover-foreground", "popover"],
  ["sidebar-foreground", "sidebar"],
  ["muted-foreground", "muted"],
  ["muted-foreground", "background"],
  ["secondary-foreground", "secondary"],
  ["accent-foreground", "accent"],
  ["sidebar-accent-foreground", "sidebar-accent"],
  ["success-subtle-foreground", "success-subtle"],
  ["warning-subtle-foreground", "warning-subtle"],
  ["info-subtle-foreground", "info-subtle"],
  ["destructive-subtle-foreground", "destructive-subtle"],
];
const C5: ReadonlyArray<readonly [RoleName, RoleName]> = [
  ["primary-foreground", "primary"],
  ["sidebar-primary-foreground", "sidebar-primary"],
  ["destructive-foreground", "destructive"],
  ["success-foreground", "success"],
  ["warning-foreground", "warning"],
  ["info-foreground", "info"],
];

type Source = readonly [PaletteName, Record<Level, number>] | "page" | `chart-${number}`;
const at = (step: number): Record<Level, number> => ({ AA: step, "AA+": step, AAA: step });
/** Section 2's role table: each fill role and its palette step per level. */
const FILLS: Readonly<Partial<Record<RoleName, Source>>> = {
  background: "page",
  foreground: ["neutral", at(950)],
  card: ["neutral", at(50)],
  "card-foreground": ["neutral", at(950)],
  popover: ["neutral", at(50)],
  "popover-foreground": ["neutral", at(950)],
  sidebar: ["neutral", at(50)],
  "sidebar-foreground": ["neutral", at(950)],
  primary: ["primary", { AA: 600, "AA+": 600, AAA: 700 }],
  "sidebar-primary": ["primary", { AA: 600, "AA+": 600, AAA: 700 }],
  secondary: ["secondary", at(100)],
  "secondary-foreground": ["secondary", at(900)],
  muted: ["neutral", at(100)],
  "sidebar-accent": ["neutral", at(100)],
  "muted-foreground": ["neutral", { AA: 700, "AA+": 800, AAA: 800 }],
  accent: ["accent", at(100)],
  "accent-foreground": ["accent", at(900)],
  "sidebar-accent-foreground": ["neutral", at(900)],
  destructive: ["danger", at(600)],
  "destructive-subtle": ["danger", at(100)],
  "destructive-subtle-foreground": ["danger", at(900)],
  success: ["success", at(800)],
  warning: ["warning", at(500)],
  info: ["info", at(700)],
  "success-subtle": ["success", at(100)],
  "success-subtle-foreground": ["success", at(900)],
  "warning-subtle": ["warning", at(100)],
  "warning-subtle-foreground": ["warning", at(900)],
  "info-subtle": ["info", at(100)],
  "info-subtle-foreground": ["info", at(900)],
  border: ["neutral", at(200)],
  "sidebar-border": ["neutral", at(200)],
  input: ["neutral", { AA: 600, "AA+": 600, AAA: 700 }],
  ring: ["primary", { AA: 600, "AA+": 600, AAA: 700 }],
  "sidebar-ring": ["primary", { AA: 600, "AA+": 600, AAA: 700 }],
};
/** Each foreground on a solid fill is onFill of that fill. */
const ON_FILL: Readonly<Partial<Record<RoleName, RoleName>>> = {
  "primary-foreground": "primary",
  "sidebar-primary-foreground": "sidebar-primary",
  "destructive-foreground": "destructive",
  "success-foreground": "success",
  "warning-foreground": "warning",
  "info-foreground": "info",
};

const stepHex = (
  palettes: Record<PaletteName, Palette>,
  name: PaletteName,
  mode: Mode,
  step: number,
) => palettes[name][mode][STEPS.indexOf(step as (typeof STEPS)[number])].hex;
const ratio = (a: string, b: string) => wcagRatio(rgbOfHex(a), rgbOfHex(b));
const base = buildPalettes(DEFAULTS, HUE_262);
const roles = (mode: Mode, level: Level, palettes = base) =>
  resolveRoles(palettes, mode, level, CHART);

describe("resolveRoles", () => {
  it("C-ROLE-01 returns exactly the 46 role names, each a Hex", () => {
    const result = roles("light", "AA");
    expect(Object.keys(result).sort()).toEqual([...EXPECTED_NAMES].sort());
    expect([...ROLE_NAMES].sort()).toEqual([...EXPECTED_NAMES].sort());
    for (const hex of Object.values(result)) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("C-ROLE-02 takes each role from its section 2 source", () => {
    for (const mode of MODES) {
      for (const level of LEVELS) {
        const result = roles(mode, level);
        for (const name of EXPECTED_NAMES as RoleName[]) {
          const source = FILLS[name];
          const fill = ON_FILL[name];
          let expected: string;
          if (fill !== undefined) expected = onFill(rgbOfHex(result[fill]));
          else if (name.startsWith("chart-")) expected = CHART[Number(name.slice(6)) - 1];
          else if (source === "page") expected = pageFor(base.neutral, mode);
          else if (source === undefined || typeof source === "string") throw new Error(name);
          else expected = stepHex(base, source[0], mode, source[1][level]);
          expect(result[name], `${mode} ${level} ${name}`).toBe(expected);
        }
      }
    }
  });

  it("C-ROLE-03 moves only the listed roles between levels", () => {
    const changed = (a: Record<RoleName, Hex>, b: Record<RoleName, Hex>) =>
      (EXPECTED_NAMES as RoleName[]).filter((name) => a[name] !== b[name]);
    for (const mode of MODES) {
      const [aa, aaPlus, aaa] = LEVELS.map((level) => roles(mode, level));
      expect(changed(aa, aaPlus)).toEqual(["muted-foreground"]);
      const moved = changed(aaPlus, aaa);
      const allowed = [
        "primary",
        "sidebar-primary",
        "ring",
        "sidebar-ring",
        "input",
        "primary-foreground",
        "sidebar-primary-foreground",
      ];
      for (const name of moved) expect(allowed).toContain(name);
      for (const name of ["primary", "sidebar-primary", "ring", "sidebar-ring", "input"])
        expect(moved).toContain(name);
      for (const name of [
        "destructive",
        "destructive-foreground",
        "destructive-subtle",
        "destructive-subtle-foreground",
      ] as RoleName[]) {
        expect(aa[name]).toBe(aaa[name]);
        expect(aaPlus[name]).toBe(aaa[name]);
      }
    }
  });

  it(
    "C-ROLE-04 keeps every text pair at 4.5:1 and every line at 3:1, for any seed",
    () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 16 }),
          fc.constantFrom(
            "monochrome",
            "analogous",
            "complementary",
            "split",
            "triadic",
            "tetradic" as const,
          ),
          fc.constantFrom("muted", "balanced", "vivid" as const),
          fc.constantFrom("none", "warm", "cool", "brand" as const),
          fc.constantFrom("standard", "even" as const),
          (seed, harmony, chroma, neutralTint, scaleMode) => {
            const params = { ...DEFAULTS, harmony, chroma, neutralTint, scaleMode } as ColorParams;
            const palettes = buildPalettes(params, seededRandom(seed));
            for (const mode of MODES) {
              const chart = pickChartColors(palettes, mode, params.gamut);
              for (const level of LEVELS) {
                const result = resolveRoles(palettes, mode, level, chart);
                for (const [text, fill] of [...C1, ...C5]) {
                  const value = ratio(result[text], result[fill]);
                  expect(value, `${text}/${fill} ${mode} ${level}`).toBeGreaterThanOrEqual(4.5);
                }
                if (level !== "AA") {
                  expect(
                    ratio(result["muted-foreground"], result.background),
                  ).toBeGreaterThanOrEqual(7);
                }
                for (const line of ["input", "ring"] as const) {
                  for (const surface of ["background", "card", "muted"] as const) {
                    expect(
                      ratio(result[line], result[surface]),
                      `${line}/${surface}`,
                    ).toBeGreaterThanOrEqual(3);
                  }
                }
              }
            }
          },
        ),
        { numRuns: 200 },
      );
    },
    PROPERTY_TIMEOUT,
  );

  it("C-ROLE-05 keeps muted-foreground on muted at 7:1 at AA+ and AAA", () => {
    for (const mode of MODES) {
      for (const level of ["AA+", "AAA"] as const) {
        const result = roles(mode, level);
        const value = ratio(result["muted-foreground"], result.muted);
        expect(value).toBeGreaterThanOrEqual(7);
        expect(Math.abs(value - 8.3)).toBeLessThan(0.3);
      }
    }
  });

  it("C-ROLE-06 puts the status roles on warning-500, danger-600, info-700 and success-800", () => {
    for (const mode of MODES) {
      const result = roles(mode, "AA");
      expect(result.warning).toBe(stepHex(base, "warning", mode, 500));
      expect(result.destructive).toBe(stepHex(base, "danger", mode, 600));
      expect(result.info).toBe(stepHex(base, "info", mode, 700));
      expect(result.success).toBe(stepHex(base, "success", mode, 800));
      for (const name of ["warning", "info", "success"] as const) {
        expect(result[`${name}-foreground`]).toBe(onFill(rgbOfHex(result[name])));
        expect(result[`${name}-subtle`]).toBe(stepHex(base, name, mode, 100));
        expect(result[`${name}-subtle-foreground`]).toBe(stepHex(base, name, mode, 900));
      }
    }
  });

  it("C-ROLE-07 throws RangeError for a bad chart list, mode or level", () => {
    for (const chart of [CHART.slice(0, 4), [...CHART, CHART[0]], []]) {
      expect(() => resolveRoles(base, "light", "AA", chart)).toThrow(RangeError);
    }
    for (const entry of ["red", "#FFF", "#ABCDEF", "#ffffff80", ""]) {
      const chart = [...CHART.slice(0, 4), entry] as Hex[];
      expect(() => resolveRoles(base, "light", "AA", chart), entry).toThrow(RangeError);
    }
    expect(() => resolveRoles(base, "dim" as Mode, "AA", CHART)).toThrow(RangeError);
    expect(() => resolveRoles(base, "light", "A" as Level, CHART)).toThrow(RangeError);
  });

  it("C-ROLE-07 throws TypeError for a chart, entry, mode or level of the wrong type (R-05)", () => {
    for (const entry of [42, null, undefined]) {
      const chart = [...CHART.slice(0, 4), entry] as Hex[];
      expect(() => resolveRoles(base, "light", "AA", chart), String(entry)).toThrow(TypeError);
      expect(() => resolveRoles(base, "light", "AA", chart), String(entry)).toThrow("chart[4]");
    }
    for (const chart of ["#ffffff", null, { length: 5 }]) {
      const notAList = chart as unknown as Hex[];
      expect(() => resolveRoles(base, "light", "AA", notAList)).toThrow(TypeError);
    }
    expect(() => resolveRoles(base, 1 as unknown as Mode, "AA", CHART)).toThrow(TypeError);
    expect(() => resolveRoles(base, "light", null as unknown as Level, CHART)).toThrow(TypeError);
  });

  it("C-ROLE-07 checks the palette record", () => {
    const notARecord = null as unknown as Record<PaletteName, Palette>;
    expect(() => resolveRoles(notARecord, "light", "AA", CHART)).toThrow(TypeError);
    const { info: _info, ...partial } = base;
    expect(() =>
      resolveRoles(partial as Record<PaletteName, Palette>, "light", "AA", CHART),
    ).toThrow(RangeError);
  });

  it("C-ROLE-08 is deterministic and leaves the palettes alone", () => {
    const frozen = deepFreeze(buildPalettes(DEFAULTS, HUE_262));
    for (const mode of MODES) {
      expect(resolveRoles(frozen, mode, "AAA", CHART)).toEqual(
        resolveRoles(frozen, mode, "AAA", CHART),
      );
    }
    expect(frozen).toEqual(base);
  });

  it("C-ROLE-09 keeps input and ring at 3:1 against the card and the muted fill", () => {
    const expected: Record<Mode, { card: number; muted: readonly [number, number] }> = {
      light: { card: 4.24, muted: [3.91, 3.91] },
      dark: { card: 4.25, muted: [3.91, 3.93] },
    };
    for (const mode of MODES) {
      for (const level of ["AA", "AA+"] as const) {
        const result = roles(mode, level);
        expect(result.input).toBe(stepHex(base, "neutral", mode, 600));
        expect(result.ring).toBe(stepHex(base, "primary", mode, 600));
        expect(result["sidebar-ring"]).toBe(stepHex(base, "primary", mode, 600));
        for (const line of ["input", "ring"] as const) {
          expect(Math.abs(ratio(result[line], result.card) - expected[mode].card)).toBeLessThan(
            0.05,
          );
          const muted = ratio(result[line], result.muted);
          expect(muted).toBeGreaterThan(expected[mode].muted[0] - 0.05);
          expect(muted).toBeLessThan(expected[mode].muted[1] + 0.05);
        }
      }
      const aaa = roles(mode, "AAA");
      expect(aaa.input).toBe(stepHex(base, "neutral", mode, 700));
      expect(aaa.ring).toBe(stepHex(base, "primary", mode, 700));
      expect(aaa["sidebar-ring"]).toBe(stepHex(base, "primary", mode, 700));
      for (const line of ["input", "ring", "sidebar-ring"] as const) {
        expect(ratio(aaa[line], aaa.card)).toBeGreaterThanOrEqual(6.5);
        expect(ratio(aaa[line], aaa.muted)).toBeGreaterThanOrEqual(6.0);
      }
    }
  });

  it("C-ROLE-10 keeps destructive on danger-600 and its subtle pair at 7:1", () => {
    for (const mode of MODES) {
      for (const level of LEVELS) {
        const result = roles(mode, level);
        expect(result.destructive).toBe(stepHex(base, "danger", mode, 600));
        expect(result["destructive-subtle"]).toBe(stepHex(base, "danger", mode, 100));
        expect(result["destructive-subtle-foreground"]).toBe(stepHex(base, "danger", mode, 900));
        const value = ratio(result["destructive-subtle-foreground"], result["destructive-subtle"]);
        expect(value).toBeGreaterThanOrEqual(7);
        expect(Math.abs(value - 10.9)).toBeLessThan(0.3);
      }
    }
  });
});

describe("onFill and selectOnFill", () => {
  it("C-ONFILL-01 puts white on the light primary-600 of hue 262", () => {
    const fill = rgbOfHex(stepHex(base, "primary", "light", 600));
    expect(wcagRatio(rgbOfHex(WHITE), fill)).toBeGreaterThanOrEqual(4.5);
    expect(wcagRatio(rgbOfHex(BLACK), fill)).toBeGreaterThanOrEqual(4.5);
    expect(Math.abs(perceptualLc(rgbOfHex(WHITE), fill))).toBeGreaterThan(70);
    expect(Math.abs(perceptualLc(rgbOfHex(BLACK), fill))).toBeLessThan(40);
    expect(onFill(fill)).toBe(WHITE);
  });

  it("C-ONFILL-02 puts black on #ffeb3b", () => {
    expect(onFill(rgbOfHex("#ffeb3b"))).toBe(BLACK);
  });

  it("C-ONFILL-03 puts white on #006400, where only white reaches 4.5", () => {
    expect(onFill(rgbOfHex("#006400"))).toBe(WHITE);
  });

  it("C-ONFILL-04 takes the larger perceptual score when both reach 4.5", () => {
    // A fill of luminance Y: random linear weights scaled to Y, then encoded.
    const fill = fc
      .tuple(
        fc.double({ min: 0.17501, max: 0.18333, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
      )
      .map(([y, r, g, b]) => {
        const weight = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const k = weight === 0 ? 0 : y / weight;
        return [r * k, g * k, b * k];
      })
      .filter(
        (linear) =>
          linear.every((channel) => channel <= 1) && linear.some((channel) => channel > 0),
      )
      .map((linear) => linear.map(linearToSrgb) as unknown as Rgb);
    fc.assert(
      fc.property(fill, (rgb) => {
        const y = relativeLuminance(rgb);
        expect(y).toBeGreaterThanOrEqual(0.175);
        expect(y).toBeLessThanOrEqual(0.18334);
        const white = Math.abs(perceptualLc(rgbOfHex(WHITE), rgb));
        const black = Math.abs(perceptualLc(rgbOfHex(BLACK), rgb));
        const passes = [WHITE, BLACK].filter((hex) => wcagRatio(rgbOfHex(hex), rgb) >= 4.5);
        fc.pre(passes.length === 2);
        expect(onFill(rgb)).toBe(black > white ? BLACK : WHITE);
      }),
      { numRuns: 200 },
    );
  });

  it("C-ONFILL-04 lets the second candidate win on the perceptual score when both pass", () => {
    const white = rgbOfHex(WHITE);
    const gray = rgbOfHex("#595959");
    const black = rgbOfHex(BLACK);
    expect(wcagRatio(gray, white)).toBeCloseTo(7.005, 3);
    expect(wcagRatio(black, white)).toBeCloseTo(21, 9);
    expect(Math.abs(perceptualLc(gray, white))).toBeCloseTo(84.29, 2);
    expect(Math.abs(perceptualLc(black, white))).toBeCloseTo(106.04, 2);
    expect(selectOnFill(white, ["#595959", "#000000"] as Hex[])).toBe(BLACK);
  });

  it("C-ONFILL-05 compares on the full float: 4.4781 fails and 4.5422 passes", () => {
    expect(selectOnFill(rgbOfHex(WHITE), ["#777777", "#767676"] as Hex[])).toBe("#767676");
  });

  it("C-ONFILL-06 takes the higher WCAG ratio when no candidate reaches 4.5", () => {
    expect(selectOnFill(rgbOfHex("#808080"), ["#777777", "#888888"] as Hex[])).toBe("#777777");
    expect(selectOnFill(rgbOfHex("#808080"), ["#888888", "#777777"] as Hex[])).toBe("#777777");
  });

  it("C-ONFILL-06 keeps the first candidate on a tie", () => {
    expect(selectOnFill(rgbOfHex("#808080"), ["#808080", "#808080"] as Hex[])).toBe("#808080");
    expect(selectOnFill(rgbOfHex(BLACK), [WHITE, WHITE] as Hex[])).toBe(WHITE);
  });

  it("C-ONFILL-07 always returns white or black, and the pick reaches 4.5", () => {
    fc.assert(
      fc.property(anyRgb, (fill) => {
        const result = onFill(fill);
        expect([WHITE, BLACK]).toContain(result);
        expect(wcagRatio(rgbOfHex(result), fill)).toBeGreaterThanOrEqual(4.5);
      }),
      { numRuns: 500 },
    );
  });

  it("C-ONFILL-08 throws RangeError for a bad fill or an empty candidate list", () => {
    const gray: Rgb = [0.5, 0.5, 0.5];
    for (const bad of BAD_CHANNELS) {
      for (const index of [0, 1, 2] as const) {
        expect(() => onFill(withChannel(gray, index, bad))).toThrow(RangeError);
        expect(() => selectOnFill(withChannel(gray, index, bad), [WHITE as Hex])).toThrow(
          RangeError,
        );
      }
    }
    expect(() => selectOnFill(gray, [])).toThrow(RangeError);
    expect(() => selectOnFill(gray, ["white" as Hex])).toThrow(RangeError);
    expect(() => selectOnFill(gray, [42 as unknown as Hex])).toThrow(TypeError);
    expect(() => selectOnFill(gray, "#ffffff" as unknown as Hex[])).toThrow(TypeError);
  });
});
