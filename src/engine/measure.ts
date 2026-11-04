import { perceptualLc, wcagRatio } from "./color/contrast";
import { hexToRgb } from "./color/convert";
import { minPairwiseDeltaE, VIEWS, type View } from "./color/deltae";
import {
  assertHex,
  assertOneOf,
  describeType,
  GAMUTS,
  STORED_GAMUT_TOLERANCE,
} from "./color/guards";
import { PALETTE_NAMES, type PaletteName } from "./color/palette";
import type { RoleName } from "./color/roles";
import type { Step } from "./color/scale";
import type { Gamut, Mode } from "./color/types";
import { CONTRAST_CHECKS } from "./lint/contrast-checks";
import { gamutExcess } from "./lint/rules";
import type { Finding, LintedSpec } from "./lint/types";

// The measurements of a design (spec R3-08): what the receipt records and the export gate reads.
// Pure. The linter's seven WCAG rules read the same `CONTRAST_CHECKS`, so the two cannot disagree.

export type { ContrastCheck, ContrastKind } from "./lint/contrast-checks";
export { CONTRAST_CHECKS };

export type Measurements = {
  readonly contrast: readonly {
    readonly check: string;
    readonly mode: Mode;
    readonly ratio: number;
    readonly lc: number;
    readonly pass: boolean;
  }[];
  readonly separation: readonly {
    readonly set: "status" | "chart";
    readonly mode: Mode;
    readonly view: View;
    readonly minDeltaE: number;
  }[];
  readonly gamut: readonly {
    readonly palette: PaletteName;
    readonly step: Step;
    readonly mode: Mode;
    readonly excess: number;
  }[];
};

export type Summary = {
  readonly pass: boolean;
  readonly contrast: {
    readonly checks: number;
    readonly required: number;
    readonly requiredPass: number;
    readonly advisoryBelow: number;
  };
  readonly separation: { readonly checks: number; readonly below: number };
  readonly gamut: { readonly gamut: Gamut; readonly values: number; readonly outside: number };
  readonly lint: { readonly error: number; readonly warn: number; readonly info: number };
};

const MODES: readonly Mode[] = ["light", "dark"];
const SETS = [
  ["status", ["success", "warning", "destructive", "info"]],
  ["chart", ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"]],
] as const satisfies readonly (readonly [string, readonly RoleName[]])[];
/** The separation threshold of S1: a smaller smallest-pair delta counts as below. */
const SEPARATION = 0.08;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertRecord(
  value: unknown,
  name: string,
  caller: string,
): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    throw new TypeError(`${caller}: ${name} must be an object, got ${describeType(value)}`);
  }
}

/** The 80 contrast, 16 separation and 176 gamut measurements of `spec`, in the order of R3-08. */
export function measureSpec(spec: LintedSpec): Measurements {
  assertRecord(spec, "spec", "measureSpec");
  assertRecord(spec.color, "spec.color", "measureSpec");
  assertRecord(spec.color.roles, "spec.color.roles", "measureSpec");
  assertRecord(spec.color.palettes, "spec.color.palettes", "measureSpec");
  for (const mode of MODES) {
    assertRecord(spec.color.roles[mode], `spec.color.roles.${mode}`, "measureSpec");
    for (const role of new Set(CONTRAST_CHECKS.flatMap((c) => [c.foreground, c.background]))) {
      assertHex(spec.color.roles[mode][role], `measureSpec: spec.color.roles.${mode}.${role}`);
    }
  }
  const rgb = (mode: Mode, role: RoleName) => hexToRgb(spec.color.roles[mode][role]);
  const contrast = MODES.flatMap((mode) =>
    CONTRAST_CHECKS.map((check) => {
      const [fg, bg] = [rgb(mode, check.foreground), rgb(mode, check.background)];
      const ratio = wcagRatio(fg, bg);
      return {
        check: check.id,
        mode,
        ratio,
        lc: perceptualLc(fg, bg),
        pass: ratio >= check.threshold,
      };
    }),
  );
  const separation = MODES.flatMap((mode) =>
    SETS.flatMap(([set, roles]) => {
      const smallest = minPairwiseDeltaE(roles.map((role) => rgb(mode, role)));
      return VIEWS.map((view) => ({ set, mode, view, minDeltaE: smallest[view] }));
    }),
  );
  const gamut = MODES.flatMap((mode) =>
    PALETTE_NAMES.flatMap((palette) =>
      spec.color.palettes[palette][mode].map(({ step, oklch }) => ({
        palette,
        step,
        mode,
        excess: gamutExcess(oklch, spec.color.params.gamut),
      })),
    ),
  );
  return { contrast, separation, gamut };
}

/** The counts of the receipt's summary, from the measurements and the linter's findings. */
export function summarize(
  measurements: Measurements,
  findings: readonly Finding[],
  gamut: Gamut,
): Summary {
  assertRecord(measurements, "measurements", "summarize");
  const { contrast, separation, gamut: values } = measurements;
  for (const [name, list] of [
    ["contrast", contrast],
    ["separation", separation],
    ["gamut", values],
  ] as const) {
    if (!Array.isArray(list)) {
      throw new TypeError(
        `summarize: measurements.${name} must be an array, got ${describeType(list)}`,
      );
    }
  }
  if (contrast.length !== CONTRAST_CHECKS.length * MODES.length) {
    throw new RangeError(
      `summarize: measurements.contrast must hold ${CONTRAST_CHECKS.length * MODES.length} entries, got ${contrast.length}`,
    );
  }
  if (!Array.isArray(findings)) {
    throw new TypeError(`summarize: findings must be an array, got ${describeType(findings)}`);
  }
  assertOneOf(gamut, GAMUTS, "summarize: gamut");
  const required = new Map(CONTRAST_CHECKS.map((check) => [check.id, check.required]));
  let requiredCount = 0;
  let requiredPass = 0;
  let advisoryBelow = 0;
  for (const entry of contrast) {
    const isRequired = required.get(entry.check);
    if (isRequired === undefined) {
      throw new RangeError(
        `summarize: measurements.contrast names an unknown check ${entry.check}`,
      );
    }
    if (isRequired) {
      requiredCount += 1;
      if (entry.pass) requiredPass += 1;
    } else if (!entry.pass) {
      advisoryBelow += 1;
    }
  }
  const count = (severity: Finding["severity"]) =>
    findings.filter((f) => f.severity === severity).length;
  const error = count("error");
  return {
    pass: error === 0,
    contrast: { checks: contrast.length, required: requiredCount, requiredPass, advisoryBelow },
    separation: {
      checks: separation.length,
      below: separation.filter((entry) => entry.minDeltaE < SEPARATION).length,
    },
    gamut: {
      gamut,
      values: values.length,
      outside: values.filter((entry) => entry.excess > STORED_GAMUT_TOLERANCE).length,
    },
    lint: { error, warn: count("warn"), info: count("info") },
  };
}
