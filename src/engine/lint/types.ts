import type { ColorParams, Palette, PaletteName } from "../color/palette";
import type { RoleName } from "../color/roles";
import type { Hex, Mode } from "../color/types";
import type { FontEntry } from "../fonts/catalog";
import type { TypeContext } from "../tokens/type";

/**
 * The 20 rules of the M1 linter (M1 spec section 6.8), in the order that spec lists them, then the
 * four taste rules T1 to T4 of M2 (spec section 5.4).
 */
export const RULE_IDS = Object.freeze([
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
  "T1",
  "T2",
  "T3",
  "T4",
] as const);

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

/** The options of `lintSpec`: `catalog` replaces `FONT_CATALOG`, for tests (R2-09). */
export type LintOptions = { readonly catalog?: readonly FontEntry[] };

/**
 * What the linter reads from a `DesignSpec`: its color section and, for the taste rules T1 and T4,
 * its type section. A rule whose input is absent does not run (R2-09). The linter never imports
 * the spec model, so this is the structural part of it; every `DesignSpec` is one.
 */
export type LintedSpec = {
  readonly color: {
    /** The gamut, the scale mode, and the locked seeds, which K4 needs to find seeded steps. */
    readonly params: Pick<ColorParams, "gamut" | "scaleMode" | "primary" | "secondary" | "accent">;
    readonly palettes: Readonly<Record<PaletteName, LintedPalette>>;
    readonly roles: Readonly<Record<Mode, Readonly<Record<RoleName, Hex>>>>;
  };
  readonly type?: {
    readonly families: { readonly display: string };
    readonly context: TypeContext;
    readonly steps: readonly { readonly name: string; readonly sizePx: number }[];
  };
};
