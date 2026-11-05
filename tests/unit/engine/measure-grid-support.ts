import { describe, expect, it } from "vitest";
import {
  applyPreset,
  CONTRAST_CHECKS,
  CONTRAST_LEVELS,
  type ContrastLevel,
  type DirectionParams,
  GAMUTS,
  generateSystem,
  hexToRgb,
  lintSpec,
  NEUTRAL_TINTS,
  PRESET_IDS,
  parseColor,
  SCALE_MODES,
  wcagRatio,
} from "@/engine";
import { ACHROMATIC_CHROMA } from "@/engine/color/convert";
import { minPairwiseDeltaE, VIEWS } from "@/engine/color/deltae";
import { STORED_GAMUT_TOLERANCE } from "@/engine/color/guards";
import type { RoleName } from "@/engine/color/roles";
import { gamutExcess } from "@/engine/lint";
import { freshParams, resolveParams } from "@/features/studio/params";
import type { DesignSpec } from "@/spec";
import { GRID_TEST_TIMEOUT } from "../support/timeouts";

// The five fixed grids of ruling R3-41 (spec docs/specs/03-export.md): 3,808 generated designs, each
// of which must generate and lint with no finding of severity "error" (I-M3-10). The record keeps,
// per error rule, how many checks ran and the worst margin: the measured value minus the threshold,
// in the direction that passes, so a smaller margin is closer to failing.

export type Grid = "A" | "B" | "C" | "D" | "E";
export type GridDesign = {
  readonly label: string;
  readonly params: DirectionParams;
  readonly seed: string;
};

/** The error rules of the linter (severity "error"); S1 is an error only below 0.05. */
export const ERROR_RULES = ["C1", "C2", "C5", "N1", "N2", "F1", "S1", "K1", "G1", "G3"] as const;
export type ErrorRule = (typeof ERROR_RULES)[number];

export type RuleRecord = {
  checked: number;
  /** The smallest margin seen; null for G3, a yes/no condition. */
  worstMargin: number | null;
  worstLabel: string;
  worstPrimaryHue: number | null;
};

export type GridRecord = {
  readonly rules: Record<ErrorRule, RuleRecord>;
  /** The primary hue of seeds s0 to s3 under `freshParams()` with the automatic pairing. */
  readonly seedHues: Record<string, number>;
  /** Labels of designs that threw or raised an error finding, with the cause. */
  readonly failures: string[];
};

const SEED = "s0";
const SEEDS = ["s0", "s1", "s2", "s3"] as const;
const PRIMARIES = [
  "#fefefe",
  "#010101",
  "#808080",
  "oklch(0.6 0 none)",
  "oklch(0.5 0.02 250)",
  "#ff0000",
  "#0000ff",
  "#ffff00",
  "oklch(0.98 0.35 110)",
  "oklch(0.7 0.37 145)",
  "#1a1c1e",
  "#171717",
  "#3a6ea5",
] as const;
const D_HUES = [60, 85, 175, 205, 230, 290, 320, 345] as const;
const LEVELS: readonly ContrastLevel[] = CONTRAST_LEVELS;

type PresetSet = { readonly label: string; readonly params: DirectionParams };

/** `P`: every preset after applyPreset at each level, gamut and scale mode (168 sets). */
function presetSets(): PresetSet[] {
  return PRESET_IDS.flatMap((id) =>
    LEVELS.flatMap((level) =>
      GAMUTS.flatMap((gamut) =>
        SCALE_MODES.map((scaleMode) => ({
          label: `${id}/${level}/${gamut}/${scaleMode}`,
          params: { ...applyPreset(freshParams(), id), contrastLevel: level, gamut, scaleMode },
        })),
      ),
    ),
  );
}

function gridA(): GridDesign[] {
  return presetSets().flatMap((set) =>
    SEEDS.map((seed) => ({
      label: `A/${set.label}/${seed}`,
      params: resolveParams(set.params, seed),
      seed,
    })),
  );
}

function gridB(): GridDesign[] {
  return presetSets().flatMap((set) =>
    PRIMARIES.map((text) => ({
      label: `B/${set.label}/${SEED}/${text}`,
      params: resolveParams({ ...set.params, primary: parseColor(text) }, SEED),
      seed: SEED,
    })),
  );
}

function gridC(): GridDesign[] {
  return presetSets().flatMap((set) => [
    {
      label: `C/${set.label}/${SEED}/secondary #ff00ff`,
      params: resolveParams({ ...set.params, secondary: parseColor("#ff00ff") }, SEED),
      seed: SEED,
    },
    {
      label: `C/${set.label}/${SEED}/accent #00ff00`,
      params: resolveParams({ ...set.params, accent: parseColor("#00ff00") }, SEED),
      seed: SEED,
    },
  ]);
}

/** Each preset at its own level (the level `applyPreset` gives a fresh design). */
function gridD(): GridDesign[] {
  return PRESET_IDS.flatMap((id) =>
    GAMUTS.flatMap((gamut) =>
      SCALE_MODES.flatMap((scaleMode) =>
        D_HUES.map((h) => ({
          label: `D/${id}/${gamut}/${scaleMode}/${SEED}/oklch(0.62 0.14 ${h})`,
          params: resolveParams(
            {
              ...applyPreset(freshParams(), id),
              gamut,
              scaleMode,
              primary: parseColor(`oklch(0.62 0.14 ${h})`),
            },
            SEED,
          ),
          seed: SEED,
        })),
      ),
    ),
  );
}

function gridE(): GridDesign[] {
  const sets = NEUTRAL_TINTS.filter((t) => t !== "brand").flatMap((tint) =>
    GAMUTS.flatMap((gamut) =>
      SCALE_MODES.map((scaleMode) => ({
        label: `${tint}/${gamut}/${scaleMode}/AA`,
        params: {
          ...freshParams(),
          neutralTint: tint,
          gamut,
          scaleMode,
          contrastLevel: "AA" as const,
        },
      })),
    ),
  );
  const primaries = sets.flatMap((set) =>
    PRIMARIES.map((text) => ({
      label: `E/${set.label}/${SEED}/${text}`,
      params: resolveParams({ ...set.params, primary: parseColor(text) }, SEED),
      seed: SEED,
    })),
  );
  const pairs = sets.map((set) => ({
    label: `E/${set.label}/${SEED}/#1a1c1e+accent #b8422e`,
    params: resolveParams(
      { ...set.params, primary: parseColor("#1a1c1e"), accent: parseColor("#b8422e") },
      SEED,
    ),
    seed: SEED,
  }));
  return [...primaries, ...pairs];
}

const BUILDERS: Record<Grid, () => GridDesign[]> = {
  A: gridA,
  B: gridB,
  C: gridC,
  D: gridD,
  E: gridE,
};

/** The designs of one grid, in a fixed order. */
export function gridDesigns(grid: Grid): readonly GridDesign[] {
  return BUILDERS[grid]();
}

const CHARTS: readonly RoleName[] = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"];
const STATUS: readonly RoleName[] = ["success", "warning", "destructive", "info"];

/** The six WCAG error rules, read from the shared table (N3, the border pair, is advisory). */
const WCAG: readonly {
  id: ErrorRule;
  threshold: number;
  pairs: readonly (readonly [RoleName, RoleName])[];
}[] = (["C1", "C2", "C5", "N1", "N2", "F1"] as const).map((id) => {
  const checks = CONTRAST_CHECKS.filter((check) => check.rule === id);
  return {
    id,
    threshold: checks[0]?.threshold ?? 0,
    pairs: checks.map((check) => [check.foreground, check.background] as const),
  };
});

const SEPARATION_ERROR = 0.05;
const MODES = ["light", "dark"] as const;

function emptyRules(): Record<ErrorRule, RuleRecord> {
  return Object.fromEntries(
    ERROR_RULES.map((id) => [
      id,
      {
        checked: 0,
        worstMargin: id === "G3" ? null : Number.POSITIVE_INFINITY,
        worstLabel: "",
        worstPrimaryHue: null,
      },
    ]),
  ) as Record<ErrorRule, RuleRecord>;
}

/** The primary hue of seeds s0 to s3: the four values R3-41 records. */
export function seedPrimaryHues(): Record<string, number> {
  return Object.fromEntries(
    SEEDS.map((seed) => [
      seed,
      generateSystem(resolveParams(freshParams(), seed), seed).color.palettes.primary.hue,
    ]),
  );
}

/** Folds one design's measurements into the record. */
function measure(spec: DesignSpec, label: string, rules: Record<ErrorRule, RuleRecord>): void {
  const hue = spec.color.palettes.primary.hue;
  const note = (id: ErrorRule, margin: number) => {
    const rule = rules[id];
    rule.checked += 1;
    if (rule.worstMargin !== null && margin < rule.worstMargin) {
      rule.worstMargin = margin;
      rule.worstLabel = label;
      rule.worstPrimaryHue = hue;
    }
  };
  for (const mode of MODES) {
    const roles = spec.color.roles[mode];
    for (const { id, threshold, pairs } of WCAG) {
      for (const [a, b] of pairs) {
        note(id, wcagRatio(hexToRgb(roles[a]), hexToRgb(roles[b])) - threshold);
      }
    }
    for (const set of [STATUS, CHARTS]) {
      const smallest = minPairwiseDeltaE(set.map((role) => hexToRgb(roles[role])));
      for (const view of VIEWS) note("S1", smallest[view] - SEPARATION_ERROR);
    }
    for (const palette of Object.values(spec.color.palettes)) {
      const scale = palette[mode];
      for (let i = 1; i < scale.length; i++) {
        const [a, b] = [scale[i - 1].oklch.l, scale[i].oklch.l];
        note("K1", mode === "light" ? a - b : b - a);
      }
      for (const entry of scale) {
        note("G1", STORED_GAMUT_TOLERANCE - gamutExcess(entry.oklch, spec.color.params.gamut));
        // G3 is yes/no: the check passes unless a color at or below the achromatic chroma has a hue.
        rules.G3.checked += 1;
        if (entry.oklch.c <= ACHROMATIC_CHROMA && entry.oklch.h !== null) {
          throw new Error(`G3 would fail at ${palette.name}-${entry.step} ${mode}`);
        }
      }
    }
  }
}

/** Generates and lints `designs[start, end)`, measuring each against the required checks. */
export function measureGrid(
  designs: readonly GridDesign[],
  slice: readonly [start: number, end: number],
): GridRecord {
  const rules = emptyRules();
  const failures: string[] = [];
  for (const { label, params, seed } of designs.slice(slice[0], slice[1])) {
    try {
      const spec = generateSystem(params, seed);
      const errors = lintSpec(spec).filter((f) => f.severity === "error");
      if (errors.length > 0) {
        failures.push(
          `${label}: ${errors.map((f) => `${f.id} ${f.subject} ${f.mode} ${f.measured} vs ${f.threshold}`).join("; ")}`,
        );
      }
      measure(spec, label, rules);
    } catch (error) {
      failures.push(`${label}: threw ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { rules, seedHues: seedPrimaryHues(), failures };
}

const CASE: Record<Grid, string> = {
  A: "C-MEAS-09",
  B: "C-MEAS-10",
  C: "C-MEAS-11",
  D: "C-MEAS-12",
  E: "C-MEAS-13",
};

/** The test every grid file runs: its slice of one grid generates and lints with no error. */
export function describeGridSlice(grid: Grid, slice: readonly [number, number]): void {
  describe(`grid ${grid} designs ${slice[0]} to ${slice[1]}`, () => {
    it(
      `${CASE[grid]} generates without a throw and lints with no error (grid ${grid})`,
      () => {
        const designs = gridDesigns(grid);
        const record = measureGrid(designs, slice);
        console.table(ERROR_RULES.map((id) => ({ rule: id, ...record.rules[id] })));
        console.table(record.seedHues);
        expect(record.failures, "designs that threw or raised an error").toEqual([]);
      },
      GRID_TEST_TIMEOUT,
    ); // sized for the coverage run in CI
  });
}
