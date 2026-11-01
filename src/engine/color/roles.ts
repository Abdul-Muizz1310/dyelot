import { meets, perceptualLc, wcagRatio } from "./contrast";
import { hexToRgb } from "./convert";
import { assertHex, assertMode, assertOneOf, clampedSrgb, describeType } from "./guards";
import {
  CONTRAST_LEVELS,
  type ContrastLevel,
  PALETTE_NAMES,
  type Palette,
  type PaletteName,
  pageFor,
} from "./palette";
import { STEPS, type Step } from "./scale";
import type { Hex, Mode, Rgb } from "./types";

/** The 46 roles of a design system (spec R-14, section 6.5). */
export const ROLE_NAMES = [
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
] as const;

export type RoleName = (typeof ROLE_NAMES)[number];

const CHART_SIZE = 5;
/** WCAG 2.2 body text: the ratio text on a solid fill must reach. */
const TEXT_THRESHOLD = 4.5;
const WHITE = "#ffffff" as Hex;
const BLACK = "#000000" as Hex;
const ON_FILL_CANDIDATES: readonly Hex[] = [WHITE, BLACK];

type Measured = { readonly hex: Hex; readonly ratio: number; readonly lc: number };

/** The item with the highest score; a tie keeps the earlier item. */
function best(items: readonly Measured[], score: (item: Measured) => number): Measured {
  return items.reduce((kept, item) => (score(item) > score(kept) ? item : kept));
}

/**
 * R-15: among the candidates that reach WCAG 4.5 on the fill, the one with the largest
 * `abs(perceptualLc)`; when none reaches it, the one with the highest WCAG ratio, for lint rule
 * C5 to report. A tie keeps the earlier candidate.
 */
function select(fill: Rgb, candidates: readonly Hex[]): Hex {
  const measured = candidates.map((hex) => {
    const text = hexToRgb(hex);
    return { hex, ratio: wcagRatio(text, fill), lc: Math.abs(perceptualLc(text, fill)) };
  });
  const passing = measured.filter((item) => meets(item.ratio, TEXT_THRESHOLD));
  if (passing.length > 0) return best(passing, (item) => item.lc).hex;
  return best(measured, (item) => item.ratio).hex;
}

/**
 * The text color for a solid fill: `#ffffff` or `#000000`, by the rule of R-15. At least one of
 * the two always reaches 4.5:1 on any fill. A channel outside 0 to 1 by more than 1e-6 throws.
 */
export function onFill(fill: Rgb): Hex {
  return select(clampedSrgb(fill, "onFill: fill"), ON_FILL_CANDIDATES);
}

/** `onFill` with its own candidates, tried in order (R-15, R-25). The list must not be empty. */
export function selectOnFill(fill: Rgb, candidates: readonly Hex[]): Hex {
  const checked = clampedSrgb(fill, "selectOnFill: fill");
  if (!Array.isArray(candidates)) {
    throw new TypeError(
      `selectOnFill: candidates must be an array, got ${describeType(candidates)}`,
    );
  }
  if (candidates.length === 0) throw new RangeError("selectOnFill: candidates must not be empty");
  for (let i = 0; i < candidates.length; i++) {
    assertHex(candidates[i], `selectOnFill: candidates[${i}]`);
  }
  return select(checked, candidates);
}

/** The hex at `step` of each palette's scale in one mode, after checking the scale's shape. */
function stepsOf(
  p: Record<PaletteName, Palette>,
  mode: Mode,
): (name: PaletteName, step: Step) => Hex {
  if (typeof p !== "object" || p === null) {
    throw new TypeError(`resolveRoles: p must be a palette record, got ${describeType(p)}`);
  }
  for (const name of PALETTE_NAMES) {
    const scale = p[name]?.[mode];
    if (!Array.isArray(scale) || scale.length !== STEPS.length) {
      throw new RangeError(`resolveRoles: p.${name}.${mode} must hold ${STEPS.length} steps`);
    }
    for (let i = 0; i < scale.length; i++) {
      assertHex(scale[i]?.hex, `resolveRoles: p.${name}.${mode}[${i}].hex`);
    }
  }
  return (name, step) => p[name][mode][STEPS.indexOf(step)].hex;
}

/**
 * The role map of one mode (spec section 2): every role's hex from its palette step, with the
 * level's moves. AA+ moves `muted-foreground` to neutral-800; AAA also moves `primary`,
 * `sidebar-primary`, `ring`, `sidebar-ring` and `input` to step 700. `destructive` stays on
 * danger-600 at every level. Text on a solid fill is `onFill` of that fill. `chart` holds the
 * five chart colors.
 */
export function resolveRoles(
  p: Record<PaletteName, Palette>,
  mode: Mode,
  level: ContrastLevel,
  chart: readonly Hex[],
): Record<RoleName, Hex> {
  assertMode(mode, "resolveRoles: mode");
  assertOneOf(level, CONTRAST_LEVELS, "resolveRoles: level");
  if (!Array.isArray(chart)) {
    throw new TypeError(`resolveRoles: chart must be an array, got ${describeType(chart)}`);
  }
  if (chart.length !== CHART_SIZE) {
    throw new RangeError(`resolveRoles: chart must hold ${CHART_SIZE} hexes, got ${chart.length}`);
  }
  for (let i = 0; i < chart.length; i++) assertHex(chart[i], `resolveRoles: chart[${i}]`);
  const at = stepsOf(p, mode);
  const action: Step = level === "AAA" ? 700 : 600;
  const primary = at("primary", action);
  const destructive = at("danger", 600);
  const success = at("success", 800);
  const warning = at("warning", 500);
  const info = at("info", 700);
  const text = (fill: Hex) => onFill(hexToRgb(fill));
  return {
    background: pageFor(p.neutral, mode),
    foreground: at("neutral", 950),
    card: at("neutral", 50),
    "card-foreground": at("neutral", 950),
    popover: at("neutral", 50),
    "popover-foreground": at("neutral", 950),
    muted: at("neutral", 100),
    "muted-foreground": at("neutral", level === "AA" ? 700 : 800),
    secondary: at("secondary", 100),
    "secondary-foreground": at("secondary", 900),
    accent: at("accent", 100),
    "accent-foreground": at("accent", 900),
    primary,
    "primary-foreground": text(primary),
    destructive,
    "destructive-foreground": text(destructive),
    "destructive-subtle": at("danger", 100),
    "destructive-subtle-foreground": at("danger", 900),
    success,
    "success-foreground": text(success),
    "success-subtle": at("success", 100),
    "success-subtle-foreground": at("success", 900),
    warning,
    "warning-foreground": text(warning),
    "warning-subtle": at("warning", 100),
    "warning-subtle-foreground": at("warning", 900),
    info,
    "info-foreground": text(info),
    "info-subtle": at("info", 100),
    "info-subtle-foreground": at("info", 900),
    border: at("neutral", 200),
    input: at("neutral", action),
    ring: primary,
    sidebar: at("neutral", 50),
    "sidebar-foreground": at("neutral", 950),
    "sidebar-primary": primary,
    "sidebar-primary-foreground": text(primary),
    "sidebar-accent": at("neutral", 100),
    "sidebar-accent-foreground": at("neutral", 900),
    "sidebar-border": at("neutral", 200),
    "sidebar-ring": primary,
    "chart-1": chart[0],
    "chart-2": chart[1],
    "chart-3": chart[2],
    "chart-4": chart[3],
    "chart-5": chart[4],
  };
}
