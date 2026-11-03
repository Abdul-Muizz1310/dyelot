import { perceptualLc, wcagRatio } from "../color/contrast";
import { ACHROMATIC_CHROMA, hexToRgb, oklchToRgb, rgbToOklch } from "../color/convert";
import { minPairwiseDeltaE, VIEWS } from "../color/deltae";
import { STORED_GAMUT_TOLERANCE } from "../color/guards";
import { LOCKABLE, PALETTE_NAMES, type PaletteName, seedHex } from "../color/palette";
import type { RoleName } from "../color/roles";
import { DARK_CHROMA_FACTOR, type ScaleStep, STEPS, stepChroma } from "../color/scale";
import type { Gamut, Mode, Oklch } from "../color/types";
import { FONT_CATALOG, genericness } from "../fonts/catalog";
import { TAILWIND_HEX_SET } from "./tailwind";
import type { Finding, LintedPalette, LintedSpec, LintOptions, RuleId, Severity } from "./types";

// The rule table of spec section 6.8: thresholds, severities and sources.
const TEXT = 4.5;
const LARGE_TEXT = 3;
const NON_TEXT = 3;
const BODY_LC = 75;
const SEPARATION = 0.08;
const SEPARATION_ERROR = 0.05;
const DANGER_SUCCESS_L = 0.1;
const ADJACENT_L = 0.008;
const CHROMA_DRIFT = 0.01;
const DARK_PAGE_L = 0.15;
const DARK_TEXT_L = [0.92, 0.96] as const;
const DISLIKED = { hueFrom: 90, hueTo: 111, chroma: 0.04, lightness: 0.65 } as const;

const SOURCES: Readonly<Record<RuleId, string>> = {
  C1: "WCAG 2.2 SC 1.4.3, 1.4.6",
  C2: "WCAG 2.2 SC 1.4.3 (large text)",
  C4: "perceptual contrast guidance (advisory)",
  C5: "WCAG 2.2 SC 1.4.3",
  N1: "WCAG 2.2 SC 1.4.11",
  N2: "WCAG 2.2 SC 1.4.11",
  N3: "WCAG 2.2 SC 1.4.11 (decorative dividers are exempt)",
  F1: "WCAG 2.2 SC 1.4.11, 2.4.13",
  S1: "calibrated against Okabe-Ito (RR-0028)",
  S2: "red and green collapse under protan and deutan (RR-0028)",
  K1: "invariant",
  K2: "CSS JND; Radix measured",
  K4: "computed (RR-0028)",
  G1: "CSS Color 4",
  G3: "CSS Color 4 (powerless hue)",
  D1: "Material dark theme guidance",
  D2: "off-white body text (Radix, Material)",
  D3: "Material guidance on dark-mode accents",
  D4: "Material 3 tonal elevation",
  P1: "Palmer and Schloss, via Material Color Utilities",
  T1: "research D2, D4: overused display face",
  T2: "research D4: purple on white",
  T3: "research D4: Tailwind defaults used verbatim",
  T4: "research D1 rule 20: body size floor",
};

/** A text pair: foreground over fill (spec section 6.5). */
type Pair = readonly [foreground: RoleName, fill: RoleName];

const C1_PAIRS: readonly Pair[] = [
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
const C4_PAIRS: readonly Pair[] = C1_PAIRS.slice(0, 4);
const C5_PAIRS: readonly Pair[] = [
  ["primary-foreground", "primary"],
  ["sidebar-primary-foreground", "sidebar-primary"],
  ["destructive-foreground", "destructive"],
  ["success-foreground", "success"],
  ["warning-foreground", "warning"],
  ["info-foreground", "info"],
];
const LARGE_TEXT_ROLES: readonly RoleName[] = [
  "primary",
  "destructive",
  "success",
  "warning",
  "info",
];
const CHARTS: readonly RoleName[] = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"];
const STATUS: readonly RoleName[] = ["success", "warning", "destructive", "info"];
const ACCENTED: readonly PaletteName[] = [
  "primary",
  "secondary",
  "accent",
  "success",
  "warning",
  "danger",
  "info",
];
const BRAND: readonly PaletteName[] = ["primary", "secondary", "accent"];
const STATUS_PALETTES: readonly PaletteName[] = ["success", "warning", "danger", "info"];
const D3_STEPS = [500, 600, 700] as const;
const MODES: readonly Mode[] = ["light", "dark"];
// The taste rules of spec section 5.4.
const GENERIC_DISPLAY = 0.8;
const PURPLE_HUES = [265, 300] as const;
const WHITE_PAGE = "#ffffff";
const TAILWIND_STEPS = [300, 400, 500, 600, 700, 800] as const;
const BODY_FLOOR_PX = 16;

/** One rule's findings in one mode. */
type Rule = (spec: LintedSpec, mode: Mode, options: LintOptions) => Finding[];

function finding(
  id: RuleId,
  severity: Severity,
  mode: Mode,
  subject: string,
  measured: number,
  threshold: number,
): Finding {
  return { id, severity, mode, subject, measured, threshold, source: SOURCES[id] };
}

const rgbOf = (spec: LintedSpec, mode: Mode, role: RoleName) =>
  hexToRgb(spec.color.roles[mode][role]);

const ratio = (spec: LintedSpec, mode: Mode, [a, b]: Pair) =>
  wcagRatio(rgbOf(spec, mode, a), rgbOf(spec, mode, b));

/** OKLCH lightness of a role's hex. */
const lightness = (spec: LintedSpec, mode: Mode, role: RoleName) =>
  rgbToOklch(rgbOf(spec, mode, role), "srgb").l;

/** A WCAG rule over pairs: one finding per pair below `threshold`. */
function wcagRule(id: RuleId, severity: Severity, pairs: readonly Pair[], threshold: number): Rule {
  return (spec, mode) =>
    pairs.flatMap((pair) => {
      const measured = ratio(spec, mode, pair);
      return measured < threshold
        ? [finding(id, severity, mode, `${pair[0]}/${pair[1]}`, measured, threshold)]
        : [];
    });
}

const against = (roles: readonly RoleName[], fills: readonly RoleName[]): Pair[] =>
  roles.flatMap((role) => fills.map((fill): Pair => [role, fill]));

const C4: Rule = (spec, mode) =>
  C4_PAIRS.flatMap(([text, fill]) => {
    const measured = Math.abs(perceptualLc(rgbOf(spec, mode, text), rgbOf(spec, mode, fill)));
    return measured < BODY_LC
      ? [finding("C4", "warn", mode, `${text}/${fill}`, measured, BODY_LC)]
      : [];
  });

/** S1: the smallest pairwise ΔEOK of each set under each view, the measure of chart picking. */
const S1: Rule = (spec, mode) => {
  const sets = [
    ["status", STATUS],
    ["chart", CHARTS],
  ] as const;
  return sets.flatMap(([set, roles]) => {
    const smallest = minPairwiseDeltaE(roles.map((role) => rgbOf(spec, mode, role)));
    return VIEWS.flatMap((view) => {
      const measured = smallest[view];
      if (measured >= SEPARATION) return [];
      const severity = measured < SEPARATION_ERROR ? "error" : "warn";
      return [finding("S1", severity, mode, `${set}/${view}`, measured, SEPARATION)];
    });
  });
};

const S2: Rule = (spec, mode) => {
  const measured = Math.abs(
    lightness(spec, mode, "destructive") - lightness(spec, mode, "success"),
  );
  return measured < DANGER_SUCCESS_L
    ? [finding("S2", "warn", mode, "destructive/success", measured, DANGER_SUCCESS_L)]
    : [];
};

/** Each adjacent step pair of each palette in one mode. */
function adjacent(
  spec: LintedSpec,
  mode: Mode,
  check: (a: ScaleStep, b: ScaleStep, subject: string) => Finding[],
) {
  return PALETTE_NAMES.flatMap((name) => {
    const scale = spec.color.palettes[name][mode];
    return scale.slice(1).flatMap((b, i) => {
      const a = scale[i];
      return check(a, b, `${name}-${a.step}/${name}-${b.step}`);
    });
  });
}

const K1: Rule = (spec, mode) =>
  adjacent(spec, mode, (a, b, subject) => {
    const movement = mode === "light" ? a.oklch.l - b.oklch.l : b.oklch.l - a.oklch.l;
    return movement <= 0 ? [finding("K1", "error", mode, subject, movement, 0)] : [];
  });

const K2: Rule = (spec, mode) =>
  adjacent(spec, mode, (a, b, subject) => {
    const gap = Math.abs(a.oklch.l - b.oklch.l);
    return gap < ADJACENT_L ? [finding("K2", "warn", mode, subject, gap, ADJACENT_L)] : [];
  });

/**
 * The palette's peak chroma: its stored `peakChroma`, or for a palette that carries none (an
 * imported design) the largest chroma of its light steps (spec 6.8).
 */
function peakOf(palette: LintedPalette): number {
  return palette.peakChroma ?? Math.max(...palette.light.map((entry) => entry.oklch.c));
}

/**
 * The even groups of R-11: the four status palettes, always; primary and accent when their peak
 * chroma is equal; every other palette alone. Standard mode puts every palette alone.
 */
function groupOf(spec: LintedSpec, name: PaletteName): readonly PaletteName[] {
  if (spec.color.params.scaleMode !== "even") return [name];
  if (STATUS_PALETTES.includes(name)) return STATUS_PALETTES;
  const { primary, accent } = spec.color.palettes;
  const paired = peakOf(primary) === peakOf(accent);
  return paired && (name === "primary" || name === "accent") ? ["primary", "accent"] : [name];
}

/** K4's expected chroma: the step's formula, or in even mode the smallest over its group. */
function expectedChroma(spec: LintedSpec, name: PaletteName, mode: Mode, index: number): number {
  const { gamut } = spec.color.params;
  return Math.min(
    ...groupOf(spec, name).map((member) => {
      const palette = spec.color.palettes[member];
      const l = palette[mode][index].oklch.l;
      return stepChroma({ hue: palette.hue, peakChroma: peakOf(palette), mode, gamut }, index, l);
    }),
  );
}

/**
 * The step indexes of `mode` that hold each palette's locked seed (R-10): `seedStep[mode]` when
 * both modes placed the seed, and otherwise every step whose hex is the seed's hex.
 */
function seededSteps(spec: LintedSpec, mode: Mode): ReadonlyMap<PaletteName, ReadonlySet<number>> {
  const seeded = new Map<PaletteName, ReadonlySet<number>>();
  for (const name of LOCKABLE) {
    const seed = spec.color.params[name];
    if (seed === undefined) continue;
    const palette = spec.color.palettes[name];
    if (palette.seedStep !== undefined) {
      seeded.set(name, new Set([STEPS.indexOf(palette.seedStep[mode])]));
      continue;
    }
    const hex = seedHex(seed, spec.color.params.gamut);
    const holding = palette[mode].flatMap((entry, index) => (entry.hex === hex ? [index] : []));
    seeded.set(name, new Set(holding));
  }
  return seeded;
}

/**
 * K4. In even mode a group's cap at a step comes from every member's lightness before a seed
 * replaced one of them, which the spec does not keep, so K4 skips every member of a group at a
 * step and mode where any member holds its locked seed (spec 6.8).
 */
const K4: Rule = (spec, mode) => {
  const even = spec.color.params.scaleMode === "even";
  // Standard mode measures each step against its own palette, so only even mode reads the seeds.
  const seeded = even ? seededSteps(spec, mode) : new Map<PaletteName, ReadonlySet<number>>();
  return PALETTE_NAMES.flatMap((name) => {
    const group = groupOf(spec, name);
    return spec.color.palettes[name][mode].flatMap((entry, index) => {
      if (even && group.some((member) => seeded.get(member)?.has(index) === true)) return [];
      const drift = Math.abs(entry.oklch.c - expectedChroma(spec, name, mode, index));
      return drift > CHROMA_DRIFT
        ? [finding("K4", "warn", mode, `${name}-${entry.step}`, drift, CHROMA_DRIFT)]
        : [];
    });
  });
};

/**
 * G1's measure: how far the color's largest channel in `gamut` lies outside [0, 1], or 0 inside.
 * Rounding to 6 digits leaves a stored seed up to 1.347e-4 outside, so G1 allows 2e-4 (R-10).
 */
export function gamutExcess(color: Oklch, gamut: Gamut): number {
  const rgb = oklchToRgb(color, gamut);
  return Math.max(0, -rgb[0], -rgb[1], -rgb[2], rgb[0] - 1, rgb[1] - 1, rgb[2] - 1);
}

/** A rule over every step of every palette in one mode. */
function eachStep(
  spec: LintedSpec,
  mode: Mode,
  check: (entry: ScaleStep, subject: string) => Finding[],
) {
  return PALETTE_NAMES.flatMap((name) =>
    spec.color.palettes[name][mode].flatMap((entry) => check(entry, `${name}-${entry.step}`)),
  );
}

const G1: Rule = (spec, mode) =>
  eachStep(spec, mode, (entry, subject) => {
    const excess = gamutExcess(entry.oklch, spec.color.params.gamut);
    return excess > STORED_GAMUT_TOLERANCE
      ? [finding("G1", "error", mode, subject, excess, STORED_GAMUT_TOLERANCE)]
      : [];
  });

const G3: Rule = (spec, mode) =>
  eachStep(spec, mode, (entry, subject) =>
    entry.oklch.c <= ACHROMATIC_CHROMA && entry.oklch.h !== null
      ? [finding("G3", "error", mode, subject, entry.oklch.c, ACHROMATIC_CHROMA)]
      : [],
  );

const D1: Rule = (spec) => {
  const l = lightness(spec, "dark", "background");
  return l < DARK_PAGE_L ? [finding("D1", "warn", "dark", "background", l, DARK_PAGE_L)] : [];
};

const D2: Rule = (spec) => {
  const l = lightness(spec, "dark", "foreground");
  const [low, high] = DARK_TEXT_L;
  if (l < low) return [finding("D2", "warn", "dark", "foreground", l, low)];
  if (l > high) return [finding("D2", "warn", "dark", "foreground", l, high)];
  return [];
};

/**
 * D3: a dark fill may hold the light chroma of its step, or the engine's own dark desaturation of
 * the peak, whichever is larger. A light step that the gamut limits holds less chroma than its
 * correctly desaturated dark twin, so comparing with the light chroma alone reports the engine.
 */
const D3: Rule = (spec) =>
  ACCENTED.flatMap((name) => {
    const palette = spec.color.palettes[name];
    const desaturated = DARK_CHROMA_FACTOR * peakOf(palette);
    return D3_STEPS.flatMap((step) => {
      const index = STEPS.indexOf(step);
      const dark = palette.dark[index].oklch.c;
      const bound = Math.max(palette.light[index].oklch.c, desaturated);
      return dark > bound ? [finding("D3", "warn", "dark", `${name}-${step}`, dark, bound)] : [];
    });
  });

const D4: Rule = (spec) => {
  const card = lightness(spec, "dark", "card");
  const page = lightness(spec, "dark", "background");
  return card <= page ? [finding("D4", "warn", "dark", "card/background", card, page)] : [];
};

const P1: Rule = (spec, mode) =>
  BRAND.flatMap((name) =>
    spec.color.palettes[name][mode].flatMap(({ step, oklch: { l, c, h } }) => {
      const disliked =
        h !== null &&
        h >= DISLIKED.hueFrom &&
        h <= DISLIKED.hueTo &&
        c > DISLIKED.chroma &&
        l < DISLIKED.lightness;
      return disliked
        ? [finding("P1", "info", mode, `${name}-${step}`, l, DISLIKED.lightness)]
        : [];
    }),
  );

/** T1: a display family whose genericness is 0.8 or more; a family outside the catalog is skipped. */
const T1: Rule = (spec, _mode, options) => {
  if (spec.type === undefined) return [];
  const catalog = options.catalog ?? FONT_CATALOG;
  const display = spec.type.families.display;
  if (!catalog.some((font) => font.id === display)) return [];
  const measured = genericness(display, catalog);
  return measured >= GENERIC_DISPLAY
    ? [finding("T1", "warn", "light", "display", measured, GENERIC_DISPLAY)]
    : [];
};

/** T2: a primary hue in [265, 300] on a white page with no locked primary. */
const T2: Rule = (spec) => {
  const { hue } = spec.color.palettes.primary;
  const [from, to] = PURPLE_HUES;
  const purple = hue >= from && hue <= to;
  if (!purple || spec.color.roles.light.background !== WHITE_PAGE) return [];
  if (spec.color.params.primary !== undefined) return [];
  const nearer = hue - from <= to - hue ? from : to;
  return [finding("T2", "warn", "light", "primary", hue, nearer)];
};

/** T3: a step 300 to 800 that equals a Tailwind v4 default hex (R2-09). */
const T3: Rule = (spec, mode) =>
  PALETTE_NAMES.flatMap((name) =>
    spec.color.palettes[name][mode].flatMap(({ step, hex }) =>
      (TAILWIND_STEPS as readonly number[]).includes(step) && TAILWIND_HEX_SET.has(hex)
        ? [finding("T3", "warn", mode, `${name}-${step}`, 0, 0)]
        : [],
    ),
  );

/** T4: a body size under 16 px outside the dense context. */
const T4: Rule = (spec) => {
  if (spec.type === undefined || spec.type.context === "dense") return [];
  const body = spec.type.steps.find((step) => step.name === "body");
  return body !== undefined && body.sizePx < BODY_FLOOR_PX
    ? [finding("T4", "warn", "light", "body", body.sizePx, BODY_FLOOR_PX)]
    : [];
};

/** Rules that run in both modes, then the dark-mode rules, which run once. */
const BOTH_MODES: readonly Rule[] = [
  wcagRule("C1", "error", C1_PAIRS, TEXT),
  wcagRule("C2", "error", against(LARGE_TEXT_ROLES, ["background"]), LARGE_TEXT),
  C4,
  wcagRule("C5", "error", C5_PAIRS, TEXT),
  wcagRule("N1", "error", against(["input"], ["background", "card"]), NON_TEXT),
  wcagRule("N2", "error", against(CHARTS, ["background", "card"]), NON_TEXT),
  wcagRule("N3", "info", [["border", "background"]], NON_TEXT),
  wcagRule("F1", "error", against(["ring"], ["background", "card", "muted"]), NON_TEXT),
  S1,
  S2,
  K1,
  K2,
  K4,
  G1,
  G3,
  P1,
  T3,
];
const DARK_ONLY: readonly Rule[] = [D1, D2, D3, D4];
/** Taste rules with no mode: they report `light`. */
const LIGHT_ONLY: readonly Rule[] = [T1, T2, T4];

/** Every finding of every rule, unsorted. */
export function runRules(spec: LintedSpec, options: LintOptions = {}): Finding[] {
  return [
    ...MODES.flatMap((mode) => BOTH_MODES.flatMap((rule) => rule(spec, mode, options))),
    ...DARK_ONLY.flatMap((rule) => rule(spec, "dark", options)),
    ...LIGHT_ONLY.flatMap((rule) => rule(spec, "light", options)),
  ];
}
