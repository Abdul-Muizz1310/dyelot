import { round6, roundHue } from "../round";
import { wcagRatio } from "./contrast";
import { ACHROMATIC_CHROMA, hexToRgb, normalizeHue, rgbToOklch } from "./convert";
import { gamutMap, maxChroma } from "./gamut";
import { assertFinite, assertGamut, clamp01, clampedSrgb, describeType } from "./guards";
import type { Gamut, Hex, Mode, Oklch, Rgb } from "./types";

/** The eleven steps of every scale, lightest job first (spec section 2). */
export const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

export type Step = (typeof STEPS)[number];

/** The WCAG contrast each step aims for against its mode's page (spec section 2). */
export const TARGETS: Readonly<Record<Step, number>> = {
  50: 1.06,
  100: 1.15,
  200: 1.32,
  300: 1.65,
  400: 2.2,
  500: 3.0,
  600: 4.5,
  700: 7.0,
  800: 9.5,
  900: 12.5,
  950: 15.5,
};

export type Threshold = 3 | 4.5 | 7;

/** Steps whose emitted hex must meet a WCAG threshold. They solve for `target + 0.02`. */
export const THRESHOLDS: Readonly<Partial<Record<Step, Threshold>>> = { 500: 3, 600: 4.5, 700: 7 };
const THRESHOLD_MARGIN = 0.02;

/** The chroma envelope per step index, times the palette's peak chroma. */
const ENVELOPE = [0.12, 0.22, 0.4, 0.62, 0.85, 1, 1, 0.9, 0.75, 0.6, 0.45] as const;
const DARK_CHROMA_FACTOR = 0.85;
const GAMUT_CAP = 0.97;
const MAX_PEAK_CHROMA = 0.5;

/** Bisection on L: 50 iterations, and 24 for the inner `maxChroma` (spec, notes for implementers). */
const SOLVE_ITERATIONS = 50;
const CAP_ITERATIONS = 24;

/** Whole codes within this of a channel times 255 count as that code, not as a floor and a ceiling. */
const WHOLE_CODE = 1e-9;

export type ScaleStep = {
  readonly step: Step;
  readonly oklch: Oklch;
  readonly hex: Hex;
  readonly contrast: number;
};

export type ScaleInput = {
  readonly hue: number;
  readonly peakChroma: number;
  readonly mode: Mode;
  readonly page: Rgb;
  readonly gamut: Gamut;
};

/**
 * A step whose target no color reaches: black on a light page, or white on a dark page, falls
 * short of it (spec R-06). `target` is the nominal target, such as 7.0, not the solved 7.02.
 */
export class UnsatisfiableTargetError extends Error {
  readonly step: Step;
  readonly hue: number;
  readonly target: number;

  constructor(step: Step, hue: number, target: number, reachable: number) {
    super(
      `Step ${step} of hue ${hue} cannot reach ${target}:1 against this page: the extreme color reaches only ${reachable.toFixed(2)}:1.`,
    );
    this.name = "UnsatisfiableTargetError";
    this.step = step;
    this.hue = hue;
    this.target = target;
  }
}

/** Hue drift in degrees over the whole scale: only yellows and ambers move (spec section 2). */
function drift(hue: number): number {
  return 40 * clamp01(1 - Math.abs(hue - 90) / 35);
}

const hexCode = (code: number): string => code.toString(16).padStart(2, "0");

/** The floor and the ceiling of 255 times the channel, clamped to 0 to 255, ascending. */
function codesAround(channel: number): readonly number[] {
  const value = channel * 255;
  const nearest = Math.round(value);
  if (Math.abs(value - nearest) <= WHOLE_CODE) return [nearest];
  const floor = Math.max(0, Math.min(255, Math.floor(value)));
  const ceiling = Math.max(0, Math.min(255, Math.ceil(value)));
  return floor === ceiling ? [floor] : [floor, ceiling];
}

function assertThreshold(threshold: Threshold | undefined): void {
  if (threshold === undefined) return;
  if (threshold !== 3 && threshold !== 4.5 && threshold !== 7) {
    throw new RangeError(`pickHex: threshold must be 3, 4.5 or 7, got ${String(threshold)}`);
  }
}

/** `pickHex` for checked input: `solution` and `page` clamped, `target` finite. */
function pick(solution: Rgb, page: Rgb, target: number, threshold?: Threshold): Hex | null {
  let best: Hex | null = null;
  let bestError = Number.POSITIVE_INFINITY;
  // The loops run in ascending code order, so the first of two equal errors is the smaller hex.
  for (const r of codesAround(solution[0])) {
    for (const g of codesAround(solution[1])) {
      for (const b of codesAround(solution[2])) {
        const ratio = wcagRatio([r / 255, g / 255, b / 255], page);
        if (threshold !== undefined && ratio < threshold) continue;
        const error = Math.abs(ratio - target);
        if (error < bestError) {
          bestError = error;
          best = `#${hexCode(r)}${hexCode(g)}${hexCode(b)}` as Hex;
        }
      }
    }
  }
  return best;
}

/**
 * Among the up to eight hexes around `solution` (the floor and the ceiling of each channel), the
 * one whose WCAG ratio against `page` is nearest `target` (spec R-06). With `threshold` it keeps
 * only hexes that meet it, and throws a RangeError when none does. A tie goes to the smaller hex.
 */
export function pickHex(solution: Rgb, page: Rgb, target: number, threshold?: Threshold): Hex {
  const around = clampedSrgb(solution, "pickHex: solution");
  const against = clampedSrgb(page, "pickHex: page");
  assertFinite(target, "pickHex: target");
  assertThreshold(threshold);
  const hex = pick(around, against, target, threshold);
  if (hex === null) {
    throw new RangeError(`pickHex: no hex around the solution meets ${threshold}:1`);
  }
  return hex;
}

function assertMode(mode: Mode, name: string): void {
  if (typeof mode !== "string") {
    throw new TypeError(`${name} must be a string, got ${describeType(mode)}`);
  }
  if (mode !== "light" && mode !== "dark") {
    throw new RangeError(`${name} must be "light" or "dark", got ${JSON.stringify(mode)}`);
  }
}

/** The checked settings shared by every hue of a solve. */
type Settings = {
  readonly peakChroma: number;
  readonly mode: Mode;
  readonly page: Rgb;
  readonly gamut: Gamut;
  /** The page's OKLCH lightness: one end of the search bracket. */
  readonly pageL: number;
};

function checkSettings(input: Omit<ScaleInput, "hue">, name: string): Settings {
  if (typeof input !== "object" || input === null) {
    throw new TypeError(`${name} must be an object, got ${describeType(input)}`);
  }
  assertFinite(input.peakChroma, `${name}.peakChroma`);
  if (input.peakChroma < 0 || input.peakChroma > MAX_PEAK_CHROMA) {
    throw new RangeError(
      `${name}.peakChroma must be in [0, ${MAX_PEAK_CHROMA}], got ${input.peakChroma}`,
    );
  }
  assertMode(input.mode, `${name}.mode`);
  assertGamut(input.gamut, `${name}.gamut`);
  const page = clampedSrgb(input.page, `${name}.page`);
  return {
    peakChroma: input.peakChroma,
    mode: input.mode,
    page,
    gamut: input.gamut,
    pageL: clamp01(rgbToOklch(page, "srgb").l),
  };
}

/** R-06: the first step, in `STEPS` order, whose nominal target the extreme color misses. */
function assertSatisfiable(hue: number, settings: Settings): void {
  const extreme: Rgb = settings.mode === "light" ? [0, 0, 0] : [1, 1, 1];
  const reachable = wcagRatio(extreme, settings.page);
  for (const step of STEPS) {
    if (reachable < TARGETS[step]) {
      throw new UnsatisfiableTargetError(step, hue, TARGETS[step], reachable);
    }
  }
}

/** A continuous solution: lightness, chroma, and the gamut-mapped sRGB color. */
type Solution = { readonly l: number; readonly c: number; readonly rgb: Rgb };

/**
 * Bisection on L inside the reachable side of the page, on the contrast of the unquantized,
 * gamut-mapped color. `ceiling` is the step's chroma before the gamut cap.
 */
function solveLightness(index: number, hue: number, ceiling: number, settings: Settings): Solution {
  const step = STEPS[index];
  const threshold = THRESHOLDS[step];
  const aim = TARGETS[step] + (threshold === undefined ? 0 : THRESHOLD_MARGIN);
  const light = settings.mode === "light";
  const at = (l: number): Solution => {
    const c = Math.min(ceiling, GAMUT_CAP * maxChroma(l, hue, settings.gamut, CAP_ITERATIONS));
    return { l, c, rgb: gamutMap({ l, c, h: hue }, "srgb") };
  };
  // The extreme meets the nominal target (checked first) but may miss the solved one: take it.
  const extreme = at(light ? 0 : 1);
  if (wcagRatio(extreme.rgb, settings.page) < aim) return extreme;
  let low = light ? 0 : settings.pageL;
  let high = light ? settings.pageL : 1;
  for (let i = 0; i < SOLVE_ITERATIONS; i++) {
    const middle = (low + high) / 2;
    const short = wcagRatio(at(middle).rgb, settings.page) < aim;
    // Light scales darken away from the page and dark scales lighten away from it.
    if (short === light) high = middle;
    else low = middle;
  }
  return at((low + high) / 2);
}

/** The stored step: rounded oklch (R-02, R-03), the picked hex and its measured contrast. */
function finish(index: number, hue: number, solution: Solution, settings: Settings): ScaleStep {
  const step = STEPS[index];
  const threshold = THRESHOLDS[step];
  // The bisection keeps the solution at or above the solved target, so a hex on the far side of
  // the page always meets the threshold, and pickHex finds one.
  const hex = pickHex(solution.rgb, settings.page, TARGETS[step], threshold);
  const c = round6(solution.c);
  return {
    step,
    oklch: { l: round6(solution.l), c, h: c <= ACHROMATIC_CHROMA ? null : roundHue(hue) },
    hex,
    contrast: round6(wcagRatio(hexToRgb(hex), settings.page)),
  };
}

/** The drifted hue of step `index` (0 to 10) for a base hue in [0, 360). */
function hueAt(hue: number, index: number): number {
  return normalizeHue(hue - (drift(hue) * index) / 10);
}

function checkHue(hue: number, name: string): number {
  assertFinite(hue, name);
  return normalizeHue(hue);
}

const envelopeChroma = (index: number, settings: Settings): number =>
  settings.peakChroma * ENVELOPE[index] * (settings.mode === "dark" ? DARK_CHROMA_FACTOR : 1);

function solveWith(
  hue: number,
  settings: Settings,
  ceilingAt: (index: number) => number,
): ScaleStep[] {
  return STEPS.map((_, index) => {
    const drifted = hueAt(hue, index);
    return finish(
      index,
      drifted,
      solveLightness(index, drifted, ceilingAt(index), settings),
      settings,
    );
  });
}

/**
 * The contrast-solved 11-step scale of one hue (spec section 6.4). Each step bisects L for its
 * target against `page`, with chroma from the envelope capped at 0.97 of the gamut's maximum,
 * then picks the nearest 8-bit hex. The stored `hex` is canonical: emit it, never re-derive it.
 * A step that no color can reach throws `UnsatisfiableTargetError`; bad input throws RangeError.
 */
export function solveScale(input: ScaleInput): readonly ScaleStep[] {
  const settings = checkSettings(input, "solveScale: input");
  const hue = checkHue(input.hue, "solveScale: input.hue");
  assertSatisfiable(input.hue, settings);
  return solveWith(hue, settings, (index) => envelopeChroma(index, settings));
}

/**
 * Scales for several hues with equal chroma per step: each step takes the smallest chroma any of
 * the hues reaches there in its own scale, and lightness is solved again with it. The scales come
 * back in the order of `hues`.
 */
export function solveEvenScales(
  hues: readonly number[],
  rest: Omit<ScaleInput, "hue">,
): readonly (readonly ScaleStep[])[] {
  if (!Array.isArray(hues)) {
    throw new TypeError(`solveEvenScales: hues must be an array, got ${describeType(hues)}`);
  }
  if (hues.length === 0) throw new RangeError("solveEvenScales: hues must not be empty");
  const settings = checkSettings(rest, "solveEvenScales: rest");
  const checked = hues.map((hue, k) => checkHue(hue, `solveEvenScales: hues[${k}]`));
  assertSatisfiable(hues[0], settings);
  const reached = checked.map((hue) =>
    STEPS.map((_, index) => {
      const drifted = hueAt(hue, index);
      return solveLightness(index, drifted, envelopeChroma(index, settings), settings).c;
    }),
  );
  const shared = STEPS.map((_, index) => Math.min(...reached.map((chromas) => chromas[index])));
  return checked.map((hue) => solveWith(hue, settings, (index) => shared[index]));
}
