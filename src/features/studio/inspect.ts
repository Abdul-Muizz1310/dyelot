import {
  CONTRAST_LEVELS,
  type ContrastLevel,
  type Deficiency,
  type Finding,
  FONT_CATALOG,
  type FontCategory,
  type Hex,
  hexToRgb,
  type Mode,
  type Oklch,
  PALETTE_NAMES,
  type PaletteName,
  perceptualLc,
  ROLE_NAMES,
  type RoleName,
  RULE_IDS,
  type RuleId,
  rgbToOklch,
  STEPS,
  type Step,
  wcagRatio,
} from "@/engine";
import type { DesignSpec } from "@/spec";
import {
  assertFinite,
  assertOneOf,
  assertRecord,
  assertString,
  describeType,
  isOneOf,
} from "./guards";
import { type Highlight, MODES, VISIONS } from "./view";

// The inspector's pure helpers (spec sections 5.8 and 6.9): the role table, the pass levels, the
// signed advisory score, the findings' groups, titles, keys and measures, what "show me" highlights,
// the colors the Names section names, the font note and a fix's outcome. The inspector's components
// render what these return.

/** A text pair's WCAG level. */
type PassLevel = "AAA" | "AA" | "AA large" | "fail";
/** A non-text pair's WCAG 1.4.11 level. */
type UiLevel = "pass 3:1" | "fail";
/** One mode of a role pair: its hexes, the WCAG ratio and level, and the signed advisory score. */
export type ModeCell = {
  readonly foreground: Hex;
  readonly fill: Hex;
  readonly ratio: number;
  readonly level: PassLevel | UiLevel;
  readonly lc: number;
  readonly lcText: string;
};
/** One row of the role table: a pair, `<foreground>/<fill>`, in both modes. */
export type RoleRow = {
  readonly pair: string;
  readonly kind: "text" | "ui";
  readonly foreground: RoleName;
  readonly fill: RoleName;
  readonly light: ModeCell;
  readonly dark: ModeCell;
};
/** A color the Names section names. */
type NameTarget = { readonly label: string; readonly hex: Hex; readonly color: Oklch };
/** What a fix button asked for: the finding it fixes and the level it raised the design to. */
export type FixRequest = { readonly key: string; readonly level: ContrastLevel };

type Pair = readonly [foreground: RoleName, fill: RoleName];

const SEVERITIES = ["error", "warn", "info"] as const;
const HEX = /^#[0-9a-f]{6}$/;
/** U+2212, the minus sign, for a negative number on screen. */
const MINUS = "−";

/** The 13 C1 text pairs and the 6 C5 on-fill pairs of M1's linter, in its order (section 6.9). */
const TEXT_PAIRS: readonly Pair[] = [
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
  ["primary-foreground", "primary"],
  ["sidebar-primary-foreground", "sidebar-primary"],
  ["destructive-foreground", "destructive"],
  ["success-foreground", "success"],
  ["warning-foreground", "warning"],
  ["info-foreground", "info"],
];
/** The 13 non-text roles, each against `background` (section 6.9). */
const UI_ROLES: readonly RoleName[] = [
  "input",
  "border",
  "ring",
  "primary",
  "destructive",
  "success",
  "warning",
  "info",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
];
const CHARTS: readonly RoleName[] = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"];
/** S1's sets, as the linter names them in a subject (`<set>/<view>`). */
const SETS: Readonly<Record<string, readonly RoleName[]>> = Object.freeze({
  status: ["success", "warning", "destructive", "info"],
  chart: CHARTS,
});

/** The plain-language title of each rule (C-INSPECT-14). */
const TITLES: Readonly<Record<RuleId, string>> = Object.freeze({
  C1: "Text under 4.5:1",
  C2: "Large text under 3:1",
  C4: "Body text under the advisory score",
  C5: "Text on a fill under 4.5:1",
  N1: "Input border under 3:1",
  N2: "Chart color under 3:1",
  N3: "Border under 3:1",
  F1: "Focus ring under 3:1",
  S1: "Colors too close under color-blind views",
  S2: "Danger and success too close in lightness",
  K1: "Scale steps out of order",
  K2: "Adjacent steps too close",
  K4: "Chroma off its curve",
  G1: "Color outside the gamut",
  G3: "Gray color with a hue",
  D1: "Dark page too light",
  D2: "Dark text off-white",
  D3: "Dark accent too saturated",
  D4: "Dark card not lighter than the page",
  P1: "Color in the disliked yellow-green zone",
  T1: "Overused display font",
  T2: "Purple on white default",
  T3: "Tailwind default color",
  T4: "Body text under 16 px",
});

/** WCAG ratio rules: their measure is a ratio against `<threshold>:1`. */
const RATIO_RULES: ReadonlySet<RuleId> = new Set(["C1", "C2", "C5", "N1", "N2", "N3", "F1"]);
/** The taste rules with no mode: the linter writes `light` by convention. */
const MODELESS: ReadonlySet<RuleId> = new Set(["T1", "T4"]);

const EMPTY: Highlight = Object.freeze({ roles: Object.freeze([]), cells: Object.freeze([]) });

/** The finding's id, checked: a record with a rule id. */
function checkFinding(finding: Finding, caller: string): void {
  assertRecord(finding, `${caller}: finding`);
  assertOneOf(finding.id, RULE_IDS, `${caller}: finding.id`);
}

/** The role colors of one mode, each a lowercase `#rrggbb`. */
function rolesOf(spec: DesignSpec, mode: Mode): Readonly<Record<RoleName, Hex>> {
  assertRecord(spec, "roleRows: spec");
  assertRecord(spec.color, "roleRows: spec.color");
  assertRecord(spec.color.roles, "roleRows: spec.color.roles");
  const roles = spec.color.roles[mode];
  assertRecord(roles, `roleRows: spec.color.roles.${mode}`);
  for (const role of ROLE_NAMES) {
    const hex = roles[role];
    assertString(hex, `roleRows: spec.color.roles.${mode}.${role}`);
    if (!HEX.test(hex)) {
      throw new RangeError(
        `roleRows: spec.color.roles.${mode}.${role} must be a lowercase #rrggbb hex, got ${JSON.stringify(hex)}`,
      );
    }
  }
  return roles as Readonly<Record<RoleName, Hex>>;
}

function cell(
  roles: Readonly<Record<RoleName, Hex>>,
  [foreground, fill]: Pair,
  kind: RoleRow["kind"],
): ModeCell {
  const fg = roles[foreground];
  const bg = roles[fill];
  const ratio = wcagRatio(hexToRgb(fg), hexToRgb(bg));
  const lc = perceptualLc(hexToRgb(fg), hexToRgb(bg));
  return {
    foreground: fg,
    fill: bg,
    ratio,
    level: passLevel(ratio, kind),
    lc,
    lcText: formatLc(lc),
  };
}

/**
 * The 32 rows of the role table (section 6.9): the 19 text pairs of the linter, then the 13
 * non-text roles against `background`, each with both modes.
 */
export function roleRows(spec: DesignSpec): readonly RoleRow[] {
  const light = rolesOf(spec, "light");
  const dark = rolesOf(spec, "dark");
  const pairs: { pair: Pair; kind: RoleRow["kind"] }[] = [
    ...TEXT_PAIRS.map((pair) => ({ pair, kind: "text" as const })),
    ...UI_ROLES.map((role) => ({ pair: [role, "background"] as Pair, kind: "ui" as const })),
  ];
  return pairs.map(({ pair, kind }) => ({
    pair: `${pair[0]}/${pair[1]}`,
    kind,
    foreground: pair[0],
    fill: pair[1],
    light: cell(light, pair, kind),
    dark: cell(dark, pair, kind),
  }));
}

/**
 * The WCAG level of a ratio, compared on the full float: for text 7 is AAA, 4.5 AA and 3 AA large
 * (WCAG 1.4.3, 1.4.6); for a non-text part 3 passes (WCAG 1.4.11). Below that it fails.
 */
export function passLevel(ratio: number, kind: "text" | "ui"): PassLevel | UiLevel {
  assertFinite(ratio, "passLevel: ratio");
  if (ratio < 1 || ratio > 21) {
    throw new RangeError(`passLevel: ratio must be within 1 to 21, got ${ratio}`);
  }
  assertOneOf(kind, ["text", "ui"], "passLevel: kind");
  if (kind === "ui") return ratio >= 3 ? "pass 3:1" : "fail";
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  return ratio >= 3 ? "AA large" : "fail";
}

/** The advisory score rounded, with its sign: "+76", "−33" (U+2212), and "0" with no sign. */
export function formatLc(lc: number): string {
  assertFinite(lc, "formatLc: lc");
  const rounded = Math.sign(lc) * Math.round(Math.abs(lc));
  if (rounded === 0) return "0";
  return rounded > 0 ? `+${rounded}` : `${MINUS}${-rounded}`;
}

/** The findings by severity, each group in the order given; nothing is dropped. */
export function groupFindings(findings: readonly Finding[]): {
  error: Finding[];
  warn: Finding[];
  info: Finding[];
} {
  if (!Array.isArray(findings as unknown)) {
    throw new TypeError(`groupFindings: findings must be an array, got ${describeType(findings)}`);
  }
  const groups: { error: Finding[]; warn: Finding[]; info: Finding[] } = {
    error: [],
    warn: [],
    info: [],
  };
  for (const [i, finding] of findings.entries()) {
    assertRecord(finding, `groupFindings: findings[${i}]`);
    assertOneOf(finding.severity, SEVERITIES, `groupFindings: findings[${i}].severity`);
    groups[finding.severity].push(finding);
  }
  return groups;
}

/** A role named in a subject, or null. */
const roleOf = (name: string | undefined): RoleName | null =>
  isOneOf(name, ROLE_NAMES) ? name : null;

/** The roles of an `a/b` subject, or null when either is not a role. */
function pairRoles(subject: string): RoleName[] | null {
  const parts = subject.split("/");
  if (parts.length !== 2) return null;
  const a = roleOf(parts[0]);
  const b = roleOf(parts[1]);
  return a === null || b === null ? null : [a, b];
}

/** The cell of a `<palette>-<step>` subject, or null. */
function cellOf(text: string | undefined): { palette: PaletteName; step: Step } | null {
  const match = /^([a-z]+)-(\d+)$/.exec(text ?? "");
  if (match === null) return null;
  const palette = match[1];
  const step = Number(match[2]);
  if (!isOneOf(palette, PALETTE_NAMES)) return null;
  const known = STEPS.find((entry) => entry === step);
  return known === undefined ? null : { palette, step: known };
}

const roles = (list: readonly string[]): Highlight => ({ roles: [...list], cells: [] });

/**
 * What "show me" highlights for a finding (section 6.9): the roles to outline on the canvas and
 * the scale cells to outline in the inspector. A subject of an unknown shape gives an empty
 * highlight and never throws (C-INSPECT-13).
 */
export function showMe(finding: Finding): Highlight {
  checkFinding(finding, "showMe");
  const { id, subject } = finding;
  assertString(subject, "showMe: finding.subject");
  switch (id) {
    case "C1":
    case "C2":
    case "C4":
    case "C5":
    case "N1":
    case "N2":
    case "N3":
    case "F1":
    case "D4": {
      const pair = pairRoles(subject);
      return pair === null ? EMPTY : roles(pair);
    }
    case "K4":
    case "G1":
    case "G3":
    case "D3":
    case "P1":
    case "T3": {
      const one = cellOf(subject);
      return one === null ? EMPTY : { roles: [], cells: [one] };
    }
    case "K1":
    case "K2": {
      const parts = subject.split("/");
      const a = cellOf(parts[0]);
      const b = cellOf(parts[1]);
      return parts.length !== 2 || a === null || b === null || a.palette !== b.palette
        ? EMPTY
        : { roles: [], cells: [a, b] };
    }
    case "S1": {
      const [set, view, ...rest] = subject.split("/");
      const members = set === undefined ? undefined : SETS[set];
      const known = members !== undefined && isOneOf(view, VISIONS) && rest.length === 0;
      return known ? roles(members) : EMPTY;
    }
    case "S2":
      return subject === "destructive/success" ? roles(["destructive", "success"]) : EMPTY;
    case "D1":
      return subject === "background" ? roles(["background"]) : EMPTY;
    case "D2":
      return subject === "foreground" ? roles(["foreground"]) : EMPTY;
    case "T1":
      return subject === "display" ? roles(["font-display"]) : EMPTY;
    case "T2":
      return subject === "primary"
        ? { roles: ["primary"], cells: [{ palette: "primary", step: 600 }] }
        : EMPTY;
    case "T4":
      return subject === "body" ? roles(["font-body"]) : EMPTY;
    default: {
      // checkFinding admitted only the ids of RULE_IDS, and each has a case above.
      const unknown: never = id;
      throw new RangeError(`showMe: no highlight for rule ${String(unknown)}`);
    }
  }
}

/** The plain-language title of a rule (C-INSPECT-14). */
export function findingTitle(id: RuleId): string {
  assertOneOf(id, RULE_IDS, "findingTitle: id");
  return TITLES[id];
}

/** A finding's identity in a list: its id, mode and subject, joined by spaces. */
export function findingKey(finding: Finding): string {
  checkFinding(finding, "findingKey");
  assertOneOf(finding.mode, MODES, "findingKey: finding.mode");
  assertString(finding.subject, "findingKey: finding.subject");
  return `${finding.id} ${finding.mode} ${finding.subject}`;
}

/** The mode "show me" shows a finding in: its own, or null for T1 and T4, which have none. */
export function showMeMode(finding: Finding): Mode | null {
  checkFinding(finding, "showMeMode");
  assertOneOf(finding.mode, MODES, "showMeMode: finding.mode");
  return MODELESS.has(finding.id) ? null : finding.mode;
}

/**
 * The vision view "show me" sets for a finding: S1's subject names the view (`<set>/<view>`) under which
 * its colors are too close, so the canvas shows them that way. Null for every other rule, and for an S1
 * subject of an unknown shape (fix round 1, M-4).
 */
export function showMeVision(finding: Finding): "none" | Deficiency | null {
  checkFinding(finding, "showMeVision");
  assertString(finding.subject, "showMeVision: finding.subject");
  if (finding.id !== "S1") return null;
  const [set, view, ...rest] = finding.subject.split("/");
  if (set === undefined || SETS[set] === undefined || rest.length > 0) return null;
  return isOneOf(view, VISIONS) ? view : null;
}

/** A number to at most three decimals, trailing zeros dropped, with U+2212 for a minus. */
function decimals(value: number): string {
  const text = String(Number(value.toFixed(3)));
  return text.startsWith("-") ? `${MINUS}${text.slice(1)}` : text;
}

/** What a finding measured against its threshold, as the inspector prints it (C-INSPECT-20). */
export function findingMeasure(finding: Finding): string {
  checkFinding(finding, "findingMeasure");
  const { id, measured, threshold } = finding;
  assertFinite(measured, "findingMeasure: finding.measured");
  assertFinite(threshold, "findingMeasure: finding.threshold");
  if (RATIO_RULES.has(id)) return `${measured.toFixed(2)}:1 against ${decimals(threshold)}:1`;
  switch (id) {
    case "C4":
      return `Lc ${Math.round(measured)} against ${decimals(threshold)}`;
    case "T2":
      return `hue ${Math.round(measured)}° against ${Math.round(threshold)}°`;
    case "T3":
      return "equals a Tailwind v4 default";
    case "T4":
      return `${decimals(measured)} px against ${decimals(threshold)} px`;
    default:
      return `${decimals(measured)} against ${decimals(threshold)}`;
  }
}

/**
 * The 13 colors the Names section names (R2-11): the light step 500 of the 8 palettes, then
 * `chart-1` to `chart-5` of the light roles.
 */
export function nameTargets(spec: DesignSpec): readonly NameTarget[] {
  assertRecord(spec, "nameTargets: spec");
  assertRecord(spec.color, "nameTargets: spec.color");
  assertRecord(spec.color.palettes, "nameTargets: spec.color.palettes");
  assertRecord(spec.color.roles, "nameTargets: spec.color.roles");
  const palettes = PALETTE_NAMES.map((name): NameTarget => {
    const palette = spec.color.palettes[name];
    assertRecord(palette, `nameTargets: spec.color.palettes.${name}`);
    const step = Array.isArray(palette.light)
      ? palette.light.find((entry) => entry.step === 500)
      : undefined;
    if (step === undefined) {
      throw new TypeError(`nameTargets: spec.color.palettes.${name}.light must hold step 500`);
    }
    return { label: `${name} 500`, hex: step.hex, color: step.oklch };
  });
  const light = spec.color.roles.light;
  assertRecord(light, "nameTargets: spec.color.roles.light");
  const charts = CHARTS.map((role): NameTarget => {
    const hex = light[role];
    assertString(hex, `nameTargets: spec.color.roles.light.${role}`);
    return { label: role, hex, color: rgbToOklch(hexToRgb(hex), "srgb") };
  });
  return [...palettes, ...charts];
}

/**
 * The kind of face each catalog category falls back to. A stack's first entry (`ui-sans-serif`, …) is a
 * family only Safari knows, so the note names the generic kind every browser ends on (fix round 1, M-3).
 */
const FALLBACK_KINDS: Readonly<Record<FontCategory, string>> = Object.freeze({
  sans: "the system sans-serif",
  display: "the system sans-serif",
  serif: "the system serif",
  mono: "the system monospace",
});

/**
 * The status line for a family that did not load, and the fallback phrase inside it, which the
 * inspector keeps on one line ("sans-serif" holds a hyphen).
 */
export function fontNote(id: string): { text: string; fallback: string } {
  assertString(id, "fontNote: id");
  const font = FONT_CATALOG.find((entry) => entry.id === id);
  if (font === undefined) throw new RangeError(`fontNote: unknown font id ${JSON.stringify(id)}`);
  const fallback = FALLBACK_KINDS[font.category];
  return { text: `${font.family} did not load. The canvas uses ${fallback} instead.`, fallback };
}

/**
 * What a fix did once a new spec arrived: "superseded" when the spec is not at the fix's level
 * (another change came first), "kept" when its findings still hold the fixed one, else "cleared".
 */
export function fixOutcome(
  fix: FixRequest,
  spec: DesignSpec,
  findings: readonly Finding[],
): "cleared" | "kept" | "superseded" {
  assertRecord(fix, "fixOutcome: fix");
  assertString(fix.key, "fixOutcome: fix.key");
  assertOneOf(fix.level, CONTRAST_LEVELS, "fixOutcome: fix.level");
  assertRecord(spec, "fixOutcome: spec");
  assertRecord(spec.color, "fixOutcome: spec.color");
  assertRecord(spec.color.params, "fixOutcome: spec.color.params");
  if (!Array.isArray(findings as unknown)) {
    throw new TypeError(`fixOutcome: findings must be an array, got ${describeType(findings)}`);
  }
  if (spec.color.params.contrastLevel !== fix.level) return "superseded";
  return findings.some((finding) => findingKey(finding) === fix.key) ? "kept" : "cleared";
}
