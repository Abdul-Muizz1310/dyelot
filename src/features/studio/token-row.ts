import {
  formatOklch,
  type Hex,
  type Mode,
  PALETTE_NAMES,
  type PaletteName,
  ROLE_NAMES,
  type RoleName,
  STEPS,
  type Step,
} from "@/engine";
import type { DesignSpec } from "@/spec";
import { assertOneOf, assertRecord, assertString, describeType } from "./guards";

// The token row of a Scales step (spec R5-47, section 5.4): what the inspector shows when a step
// opens, and the name its swatch carries through the view transition. Pure.

const MODES = ["light", "dark"] as const;

export type TokenRow = {
  /** The Tailwind token, `--color-<palette>-<step>`. */
  readonly token: string;
  /** The Tailwind class, `bg-<palette>-<step>`. */
  readonly utility: string;
  /** The run-time variable `:root` and `.dark` define; what Copy writes. */
  readonly cssVar: string;
  readonly hex: Hex;
  readonly oklch: string;
  /** The ratio against the page, `4.50:1`. */
  readonly contrast: string;
  /** The roles whose hex in the shown mode is the step's, in `ROLE_NAMES` order. */
  readonly roles: readonly RoleName[];
};

function assertStep(value: unknown, name: string): asserts value is Step {
  if (typeof value !== "number") {
    throw new TypeError(`${name} must be a number, got ${describeType(value)}`);
  }
  if (!(STEPS as readonly number[]).includes(value)) {
    throw new RangeError(`${name} must be one of ${STEPS.join(", ")}, got ${value}`);
  }
}

/** The token row of `palette`'s `step` in `mode`. */
export function tokenRow(spec: DesignSpec, mode: Mode, palette: PaletteName, step: Step): TokenRow {
  assertRecord(spec, "tokenRow: spec");
  assertString(mode, "tokenRow: mode");
  assertString(palette, "tokenRow: palette");
  if (typeof step !== "number") {
    throw new TypeError(`tokenRow: step must be a number, got ${describeType(step)}`);
  }
  assertOneOf(mode, MODES, "tokenRow: mode");
  assertOneOf(palette, PALETTE_NAMES, "tokenRow: palette");
  assertStep(step, "tokenRow: step");
  const found = spec.color.palettes[palette][mode].find((candidate) => candidate.step === step);
  if (found === undefined) throw new RangeError(`tokenRow: no step ${step} in ${palette}`);
  const roles = spec.color.roles[mode];
  return {
    token: `--color-${palette}-${step}`,
    utility: `bg-${palette}-${step}`,
    cssVar: `var(--${palette}-${step})`,
    hex: found.hex,
    oklch: formatOklch(found.oklch),
    contrast: `${found.contrast.toFixed(2)}:1`,
    roles: ROLE_NAMES.filter((role) => roles[role] === found.hex),
  };
}

/** The view-transition name both swatches of a step share, `dyelot-swatch-<palette>-<step>`. */
export function swatchName(palette: PaletteName, step: Step): string {
  assertString(palette, "swatchName: palette");
  if (typeof step !== "number") {
    throw new TypeError(`swatchName: step must be a number, got ${describeType(step)}`);
  }
  assertOneOf(palette, PALETTE_NAMES, "swatchName: palette");
  assertStep(step, "swatchName: step");
  return `dyelot-swatch-${palette}-${step}`;
}
