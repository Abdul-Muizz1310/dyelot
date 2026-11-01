import type { ColorParams, Palette, PaletteName } from "../color/palette";
import type { RoleName } from "../color/roles";
import type { Hex, Mode } from "../color/types";

/** The 20 rules of the M1 linter (spec section 6.8), in the order the spec lists them. */
export const RULE_IDS = [
  "C1",
  "C2",
  "C4",
  "C5",
  "N1",
  "N2",
  "N3",
  "F1",
  "S1",
  "S2",
  "K1",
  "K2",
  "K4",
  "G1",
  "G3",
  "D1",
  "D2",
  "D3",
  "D4",
  "P1",
] as const;

export type RuleId = (typeof RULE_IDS)[number];

export type Severity = "error" | "warn" | "info";

/**
 * One failed check: which rule, how bad, in which mode, on what (`subject`, R-23), the measured
 * value against the rule's threshold, and the standard or research note behind the rule.
 */
export type Finding = {
  readonly id: RuleId;
  readonly severity: Severity;
  readonly mode: Mode;
  readonly subject: string;
  readonly measured: number;
  readonly threshold: number;
  readonly source: string;
};

/**
 * A palette as the linter reads it. `peakChroma` may be absent: an imported design need not carry
 * one, and the linter then reads the largest chroma of the light steps as the peak (spec 6.8).
 */
export type LintedPalette = Omit<Palette, "peakChroma"> & { readonly peakChroma?: number };

/**
 * What the linter reads from a `DesignSpec`: its color section. The engine never imports the spec
 * model (spec section 5), so this is the structural part of it; every `DesignSpec` is one.
 */
export type LintedSpec = {
  readonly color: {
    /** The gamut, the scale mode, and the locked seeds, which K4 needs to find seeded steps. */
    readonly params: Pick<ColorParams, "gamut" | "scaleMode" | "primary" | "secondary" | "accent">;
    readonly palettes: Readonly<Record<PaletteName, LintedPalette>>;
    readonly roles: Readonly<Record<Mode, Readonly<Record<RoleName, Hex>>>>;
  };
};
