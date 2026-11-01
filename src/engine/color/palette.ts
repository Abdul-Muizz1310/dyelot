import { round6, roundHue } from "../round";
import { meets, wcagRatio } from "./contrast";
import { ACHROMATIC_CHROMA, hexToRgb, oklchToRgb, rgbToOklch, toHex } from "./convert";
import { deltaEOK } from "./deltae";
import { gamutMap } from "./gamut";
import {
  assertFinite,
  assertGamut,
  assertMode,
  assertOklch,
  assertOneOf,
  describeType,
  STORED_GAMUT_TOLERANCE,
  withinUnitCube,
} from "./guards";
import { HARMONIES, type Harmony, harmonyHues } from "./harmony";
import { type ScaleStep, STEPS, type Step, solveEvenScales, solveScale, THRESHOLDS } from "./scale";
import type { Gamut, Hex, Mode, Oklch, Rgb } from "./types";

/** The eight palettes of a design system, in the order a spec stores them. */
export const PALETTE_NAMES = [
  "neutral",
  "primary",
  "secondary",
  "accent",
  "success",
  "warning",
  "danger",
  "info",
] as const;

export type PaletteName = (typeof PALETTE_NAMES)[number];

export const CHROMA_LEVELS = ["muted", "balanced", "vivid"] as const;
export const NEUTRAL_TINTS = ["none", "warm", "cool", "brand"] as const;
export const SCALE_MODES = ["standard", "even"] as const;
export const CONTRAST_LEVELS = ["AA", "AA+", "AAA"] as const;

export type ContrastLevel = (typeof CONTRAST_LEVELS)[number];

/**
 * One palette: its anchor hue and peak chroma, and the solved scale of each mode. `seedStep`
 * names the step that holds a locked seed when both modes place it. `seedDeviation` says how far
 * the color that stands in for the seed is from it, when the seed had to be gamut-mapped or a mode
 * rejected it (spec R-10). Both are absent, never undefined, when they do not apply.
 */
export type Palette = {
  readonly name: PaletteName;
  readonly hue: number;
  readonly peakChroma: number;
  readonly light: readonly ScaleStep[];
  readonly dark: readonly ScaleStep[];
  readonly seedStep?: { readonly light: Step; readonly dark: Step };
  readonly seedDeviation?: { readonly step: Step; readonly deltaEOK: number };
};

/** The color parameters of a design system. A color that is passed in is locked. */
export type ColorParams = {
  readonly primary?: Oklch;
  readonly secondary?: Oklch;
  readonly accent?: Oklch;
  readonly harmony: Harmony;
  readonly chroma: (typeof CHROMA_LEVELS)[number];
  readonly neutralTint: (typeof NEUTRAL_TINTS)[number];
  readonly gamut: Gamut;
  readonly scaleMode: (typeof SCALE_MODES)[number];
  readonly contrastLevel: ContrastLevel;
};

// Section 2: peak chroma by the `chroma` parameter, the secondary's share of it, and the status
// palettes at a fixed chroma whatever the parameter says.
const PEAK_CHROMA: Readonly<Record<ColorParams["chroma"], number>> = {
  muted: 0.08,
  balanced: 0.14,
  vivid: 0.22,
};
const SECONDARY_SHARE = 0.6;
const STATUS_CHROMA = 0.14;
const STATUS_HUES = { success: 150, warning: 70, danger: 25, info: 250 } as const;
const STATUS_NAMES = ["success", "warning", "danger", "info"] as const;

/** The neutral tint table: chroma, and a fixed hue or the primary's (R-08). */
const NEUTRAL: Readonly<Record<ColorParams["neutralTint"], { chroma: number; hue?: number }>> = {
  none: { chroma: 0 },
  warm: { chroma: 0.012, hue: 60 },
  cool: { chroma: 0.012, hue: 250 },
  brand: { chroma: 0.01 },
};

// The pages: white in light mode; in dark mode the neutral's hue at L 0.18 and chroma up to 0.012.
const LIGHT_PAGE = "#ffffff" as Hex;
const DARK_PAGE_L = 0.18;
const DARK_PAGE_CHROMA = 0.012;

const MAX_CHROMA = 0.5;
const FULL_TURN = 360;

/** A palette's anchor before solving: its hue and peak chroma. */
type Anchor = { readonly hue: number; readonly peakChroma: number };

/**
 * R-02 and R-03 on a color already in a seed's domain: `round6` and `roundHue`, then the achromatic
 * rule on the rounded chroma. A chromatic color with a null hue reads its hue as 0, as a CSS
 * conversion does. Rounding keeps the domain: `round6` of a lightness in [0, 1] stays in [0, 1].
 */
function roundSeed(seed: Oklch): Oklch {
  const c = round6(seed.c);
  return { l: round6(seed.l), c, h: c <= ACHROMATIC_CHROMA ? null : roundHue(seed.h ?? 0) };
}

/**
 * A locked seed as the engine uses and stores it (spec R-25). It checks the seed's domain first
 * (l in [0, 1], c in [0, 0.5], h null or in [0, 360)) and throws RangeError naming the field, or
 * TypeError for a value of the wrong type, so it never builds a value from bad input. Then it
 * rounds the seed and applies the achromatic rule (R-02, R-03). `name` is how an error names the
 * seed, so a caller such as `generateSystem` can name its own field.
 */
export function normalizeSeed(seed: Oklch, name = "normalizeSeed: seed"): Oklch {
  checkSeed(seed, name);
  return roundSeed(seed);
}

function darkPage(anchor: Anchor): Hex {
  const c = Math.min(DARK_PAGE_CHROMA, anchor.peakChroma);
  return toHex(
    gamutMap({ l: DARK_PAGE_L, c, h: c <= ACHROMATIC_CHROMA ? null : anchor.hue }, "srgb"),
  );
}

/**
 * The page a mode's scales solve against: `#ffffff` in light mode, and in dark mode the emitted
 * hex of `oklch(0.18, min(0.012, neutral chroma), neutral hue)` (spec section 2).
 */
export function pageFor(neutral: Palette, mode: Mode): Hex {
  if (typeof neutral !== "object" || neutral === null) {
    throw new TypeError(`pageFor: neutral must be a palette, got ${describeType(neutral)}`);
  }
  assertFinite(neutral.hue, "pageFor: neutral.hue");
  assertFinite(neutral.peakChroma, "pageFor: neutral.peakChroma");
  if (neutral.hue < 0 || neutral.hue >= FULL_TURN) {
    throw new RangeError(`pageFor: neutral.hue must be in [0, 360), got ${neutral.hue}`);
  }
  if (neutral.peakChroma < 0 || neutral.peakChroma > MAX_CHROMA) {
    throw new RangeError(
      `pageFor: neutral.peakChroma must be in [0, 0.5], got ${neutral.peakChroma}`,
    );
  }
  assertMode(mode, "pageFor: mode");
  return mode === "light" ? LIGHT_PAGE : darkPage(neutral);
}

const LOCKABLE = ["primary", "secondary", "accent"] as const;
type Lockable = (typeof LOCKABLE)[number];

/** A seed as passed: an object with l in [0, 1], c in [0, 0.5] and h null or in [0, 360). */
function checkSeed(seed: Oklch, name: string): void {
  assertOklch(seed, name);
  if (seed.l < 0 || seed.l > 1) throw new RangeError(`${name}.l must be in [0, 1], got ${seed.l}`);
  if (seed.c < 0 || seed.c > MAX_CHROMA) {
    throw new RangeError(`${name}.c must be in [0, 0.5], got ${seed.c}`);
  }
  if (seed.h !== null && (seed.h < 0 || seed.h >= FULL_TURN)) {
    throw new RangeError(`${name}.h must be in [0, 360) or null, got ${seed.h}`);
  }
}

/** Checks every parameter before anything is drawn or solved, so each failure names its field. */
function checkParams(input: ColorParams, random: () => number): void {
  if (typeof input !== "object" || input === null) {
    throw new TypeError(`buildPalettes: input must be an object, got ${describeType(input)}`);
  }
  if (typeof random !== "function") {
    throw new TypeError(`buildPalettes: random must be a function, got ${describeType(random)}`);
  }
  assertOneOf(input.harmony, HARMONIES, "buildPalettes: input.harmony");
  assertOneOf(input.chroma, CHROMA_LEVELS, "buildPalettes: input.chroma");
  assertOneOf(input.neutralTint, NEUTRAL_TINTS, "buildPalettes: input.neutralTint");
  assertGamut(input.gamut, "buildPalettes: input.gamut");
  assertOneOf(input.scaleMode, SCALE_MODES, "buildPalettes: input.scaleMode");
  assertOneOf(input.contrastLevel, CONTRAST_LEVELS, "buildPalettes: input.contrastLevel");
  for (const name of LOCKABLE) {
    const seed = input[name];
    if (seed !== undefined) checkSeed(seed, `buildPalettes: input.${name}`);
  }
}

/** One draw from `random`: a finite number in [0, 1), or a RangeError. */
function drawHue(random: () => number): number {
  const value = random();
  assertFinite(value, "buildPalettes: random()");
  if (value < 0 || value >= 1) {
    throw new RangeError(`buildPalettes: random() must return a number in [0, 1), got ${value}`);
  }
  return Math.floor(value * FULL_TURN);
}

/** A locked palette's anchor: the seed's hue, or hue 0 and peak 0 for a gray seed (R-09). */
function lockedAnchor(seed: Oklch, peakChroma: number): Anchor {
  return seed.h === null ? { hue: 0, peakChroma: 0 } : { hue: seed.h, peakChroma };
}

/** Hues and peak chroma of all eight palettes (section 2, R-08, R-09, R-12). */
function anchorsFor(
  input: ColorParams,
  seeds: Partial<Record<Lockable, Oklch>>,
  random: () => number,
): Record<PaletteName, Anchor> {
  const peak = PEAK_CHROMA[input.chroma];
  const secondaryPeak = round6(SECONDARY_SHARE * peak);
  const primary =
    seeds.primary === undefined
      ? { hue: drawHue(random), peakChroma: peak }
      : lockedAnchor(seeds.primary, peak);
  const harmony = harmonyHues(primary.hue, input.harmony);
  const slot = (name: "secondary" | "accent", slotPeak: number): Anchor => {
    const seed = seeds[name];
    return seed === undefined
      ? { hue: roundHue(harmony[name]), peakChroma: slotPeak }
      : lockedAnchor(seed, slotPeak);
  };
  const tint = NEUTRAL[input.neutralTint];
  // A gray primary has no hue to lend: its brand tint has chroma 0 (R-09).
  const neutralChroma = input.neutralTint === "brand" && primary.peakChroma === 0 ? 0 : tint.chroma;
  const status = (name: (typeof STATUS_NAMES)[number]): Anchor => ({
    hue: STATUS_HUES[name],
    peakChroma: STATUS_CHROMA,
  });
  return {
    neutral: { hue: tint.hue ?? primary.hue, peakChroma: neutralChroma },
    primary,
    secondary: slot("secondary", secondaryPeak),
    accent: slot("accent", peak),
    success: status("success"),
    warning: status("warning"),
    danger: status("danger"),
    info: status("info"),
  };
}

/**
 * The scales of one mode. Standard mode solves each palette alone. Even mode solves the four
 * status palettes as one group, primary and accent as one when their peak chroma is equal, and
 * every other palette alone (R-11); a group of one is a plain `solveScale`.
 */
function solveMode(
  anchors: Record<PaletteName, Anchor>,
  mode: Mode,
  page: Rgb,
  gamut: Gamut,
  even: boolean,
): Record<PaletteName, readonly ScaleStep[]> {
  const alone = (name: PaletteName) =>
    solveScale({ hue: anchors[name].hue, peakChroma: anchors[name].peakChroma, mode, page, gamut });
  const together = (names: readonly PaletteName[]) =>
    solveEvenScales(
      names.map((name) => anchors[name].hue),
      { peakChroma: anchors[names[0]].peakChroma, mode, page, gamut },
    );
  const groups: (readonly PaletteName[])[] = even ? [STATUS_NAMES] : [];
  if (even && anchors.primary.peakChroma === anchors.accent.peakChroma) {
    groups.push(["primary", "accent"]);
  }
  const scales = {} as Record<PaletteName, readonly ScaleStep[]>;
  for (const group of groups) {
    together(group).forEach((scale, k) => {
      scales[group[k]] = scale;
    });
  }
  for (const name of PALETTE_NAMES) {
    if (!(name in scales)) scales[name] = alone(name);
  }
  return scales;
}

/** A locked seed ready to place: as rounded, as placed, its hex, and whether it was mapped. */
type Seed = {
  readonly original: Oklch;
  readonly placed: Oklch;
  readonly hex: Hex;
  readonly mapped: boolean;
};

/**
 * R-10: the seed counts as gamut-mapped only when its stored form, the rounded seed, lies more
 * than 2e-4 outside the gamut in some channel: the tolerance of lint rule G1, not the 1e-6 of
 * `inGamut`. Rounding alone moves a seed at most 1.347e-4, so it never counts. The test reads the
 * stored seed, so passing that seed back in (from a spec's `color.params`) gives the same
 * palettes. A mapped seed is the rounded seed mapped into the gamut, rounded again. Its hex is
 * `toHex(gamutMap(placed, "srgb"))` of the stored color (R-01).
 */
function prepareSeed(raw: Oklch, gamut: Gamut): Seed {
  const original = roundSeed(raw);
  const mapped = !withinUnitCube(oklchToRgb(original, gamut), STORED_GAMUT_TOLERANCE);
  // A mapped color is in gamut: its l is at most a rounding error above 1, which round6 writes as 1.
  const placed = mapped ? roundSeed(rgbToOklch(gamutMap(original, gamut), gamut)) : original;
  return { original, placed, hex: toHex(gamutMap(placed, "srgb")), mapped };
}

/** Whether L at `index` keeps the scale strictly ordered away from the page. */
function keepsOrder(scale: readonly ScaleStep[], index: number, l: number, mode: Mode): boolean {
  const before = scale[index - 1]?.oklch.l;
  const after = scale[index + 1]?.oklch.l;
  const sign = mode === "light" ? 1 : -1;
  return (
    (before === undefined || sign * (before - l) > 0) &&
    (after === undefined || sign * (l - after) > 0)
  );
}

/**
 * Section 2: try the steps in order of `abs(L − Lseed)` (ties in step order) and replace the first
 * step where L stays strictly ordered and the step's threshold, if any, holds on the seed's hex.
 * Returns the step index, or null when every step rejects the seed.
 */
function placeSeed(scale: readonly ScaleStep[], seed: Seed, mode: Mode, page: Rgb): number | null {
  const ratio = wcagRatio(hexToRgb(seed.hex), page);
  const gap = (index: number) => Math.abs(scale[index].oklch.l - seed.placed.l);
  const order = STEPS.map((_, index) => index).sort((a, b) => gap(a) - gap(b) || a - b);
  for (const index of order) {
    const threshold = THRESHOLDS[STEPS[index]];
    if (!keepsOrder(scale, index, seed.placed.l, mode)) continue;
    if (threshold !== undefined && !meets(ratio, threshold)) continue;
    return index;
  }
  return null;
}

/** The scale with the seed at `index`, its contrast measured on its hex. */
function withSeed(scale: readonly ScaleStep[], index: number, seed: Seed, page: Rgb): ScaleStep[] {
  const entry: ScaleStep = {
    step: STEPS[index],
    oklch: seed.placed,
    hex: seed.hex,
    contrast: round6(wcagRatio(hexToRgb(seed.hex), page)),
  };
  return scale.map((step, i) => (i === index ? entry : step));
}

/** The index of the step whose color is nearest the seed by ΔEOK; ties go to the lower step. */
function nearestStep(scale: readonly ScaleStep[], seed: Oklch): number {
  let best = 0;
  scale.forEach((entry, i) => {
    if (deltaEOK(seed, entry.oklch) < deltaEOK(seed, scale[best].oklch)) best = i;
  });
  return best;
}

type Scales = Record<Mode, readonly ScaleStep[]>;

/** Places a locked seed in both modes and records `seedStep` and `seedDeviation` (R-10). */
function seededPalette(
  base: Omit<Palette, "light" | "dark">,
  scales: Scales,
  seed: Seed,
  pages: Record<Mode, Rgb>,
): Palette {
  const light = placeSeed(scales.light, seed, "light", pages.light);
  const dark = placeSeed(scales.dark, seed, "dark", pages.dark);
  const placed: Scales = {
    light: light === null ? scales.light : withSeed(scales.light, light, seed, pages.light),
    dark: dark === null ? scales.dark : withSeed(scales.dark, dark, seed, pages.dark),
  };
  if (light !== null && dark !== null) {
    const seedStep = { light: STEPS[light], dark: STEPS[dark] };
    if (!seed.mapped) return { ...base, ...placed, seedStep };
    const deviation = {
      step: STEPS[light],
      deltaEOK: round6(deltaEOK(seed.original, seed.placed)),
    };
    return { ...base, ...placed, seedStep, seedDeviation: deviation };
  }
  // The deviation describes light mode, unless only the dark mode rejected the seed.
  const rejected = light === null ? scales.light : scales.dark;
  const nearest = nearestStep(rejected, seed.original);
  const deviation = {
    step: STEPS[nearest],
    deltaEOK: round6(deltaEOK(seed.original, rejected[nearest].oklch)),
  };
  return { ...base, ...placed, seedDeviation: deviation };
}

/**
 * The eight palettes of a design system, each solved in light and dark mode (spec section 6.5).
 * A missing primary takes hue `floor(random() × 360)`, the only draw; missing secondary and accent
 * hues come from the harmony. A locked color anchors its palette's hue and is placed verbatim in
 * each mode's scale where contrast allows, or recorded in `seedDeviation` (R-10). Every parameter
 * is checked first: a bad value throws RangeError, or TypeError for a value of the wrong type.
 */
export function buildPalettes(
  input: ColorParams,
  random: () => number,
): Record<PaletteName, Palette> {
  checkParams(input, random);
  const seeds: Partial<Record<Lockable, Seed>> = {};
  for (const name of LOCKABLE) {
    const raw = input[name];
    if (raw !== undefined) seeds[name] = prepareSeed(raw, input.gamut);
  }
  const anchors = anchorsFor(
    input,
    {
      primary: seeds.primary?.original,
      secondary: seeds.secondary?.original,
      accent: seeds.accent?.original,
    },
    random,
  );
  const pages: Record<Mode, Rgb> = {
    light: hexToRgb(LIGHT_PAGE),
    dark: hexToRgb(darkPage(anchors.neutral)),
  };
  const even = input.scaleMode === "even";
  const solved: Record<Mode, Record<PaletteName, readonly ScaleStep[]>> = {
    light: solveMode(anchors, "light", pages.light, input.gamut, even),
    dark: solveMode(anchors, "dark", pages.dark, input.gamut, even),
  };
  const palettes = {} as Record<PaletteName, Palette>;
  for (const name of PALETTE_NAMES) {
    const base = { name, hue: anchors[name].hue, peakChroma: anchors[name].peakChroma };
    const scales: Scales = { light: solved.light[name], dark: solved.dark[name] };
    const seed =
      name === "primary" || name === "secondary" || name === "accent" ? seeds[name] : undefined;
    palettes[name] =
      seed === undefined ? { ...base, ...scales } : seededPalette(base, scales, seed, pages);
  }
  return palettes;
}
