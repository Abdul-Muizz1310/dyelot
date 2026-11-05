import type { AiPatch } from "@/ai";
import {
  CHROMA_LEVELS,
  DEPTH_STYLES,
  type Density,
  type DirectionParams,
  NEUTRAL_TINTS,
  normalizeSeed,
  type Oklch,
  RADIUS_SET_NAMES,
  TYPE_CONTEXTS,
  type TypeContext,
} from "@/engine";
import {
  assertFinite,
  assertOneOf,
  assertRecord,
  assertString,
  describeType,
} from "@/features/studio/guards";

// The seven steer chips (R4-44, section 8.1 and 8.3 of docs/specs/04-ai.md): pure operations on
// the held parameters and the view density, so the Steer section shows each chip's state at first
// paint without loading the AI layer. The only import from `@/ai` is a type.

export const CHIPS = Object.freeze([
  "warmer",
  "cooler",
  "bolder",
  "quieter",
  "softer",
  "sharper",
  "airier",
] as const);
export type Chip = (typeof CHIPS)[number];

/** `primary` is the held primary seed: `params.primary` when locked, else `lockSeed(spec, "primary")`. */
export type ChipContext = {
  readonly params: DirectionParams;
  readonly density: Density;
  readonly primary: Oklch;
};

export type ChipOutcome =
  | { readonly enabled: true; readonly patch: AiPatch; readonly density?: Density }
  | { readonly enabled: false; readonly reason: string };

/** The type ratios a chip steps through, smallest first (section 8.1). */
export const RATIO_LADDER: readonly number[] = Object.freeze([
  1.125, 1.2, 1.25, 1.333,
  // biome-ignore lint/suspicious/noApproximativeNumericConstant: 1.414 is the published ratio
  1.414, 1.5, 1.618,
]);

/** The ratio each context's narrow viewport uses (src/engine/tokens/type.ts; C-CHIP-06 ties them). */
export const NARROW_RATIO: Readonly<Record<TypeContext, number>> = Object.freeze({
  dense: 1.2,
  product: 1.25,
  marketing: 1.2,
  editorial: 1.2,
  poster: 1.5,
});

const DENSITIES: readonly Density[] = Object.freeze(["dense", "compact", "comfortable"] as const);
const WARM_HUE = 50;
const COOL_HUE = 250;
const HUE_STEP = 20;
const RATIO_EPSILON = 1e-9;

const REASONS: Readonly<Record<Chip, string>> = Object.freeze({
  warmer: "Already as warm as this chip goes.",
  cooler: "Already as cool as this chip goes.",
  bolder: "Chroma is already vivid.",
  quieter: "Chroma is already muted.",
  softer: "Radius and depth are already at their softest.",
  sharper: "Radius and depth are already at their sharpest.",
  airier: "Spacing and type are already at their airiest.",
});

/** The item `by` places after (or before) `item` in `list`, else undefined at the end. */
function neighbor<T>(list: readonly T[], item: T, by: 1 | -1): T | undefined {
  return list[list.indexOf(item) + by];
}

/** The primary one hue step toward `target`, or undefined when it has no hue or sits on it. */
function stepped(primary: Oklch, target: number): Oklch | undefined {
  if (primary.h === null) return undefined;
  const d = ((((target - primary.h) % 360) + 540) % 360) - 180;
  if (d === 0) return undefined;
  const step = Math.sign(d) * Math.min(HUE_STEP, Math.abs(d));
  return normalizeSeed({ l: primary.l, c: primary.c, h: (primary.h + step + 360) % 360 });
}

function checkedContext(context: unknown, caller: string): ChipContext {
  assertRecord(context, `${caller}: context`);
  assertRecord(context.params, `${caller}: context.params`);
  assertRecord(context.params.type, `${caller}: context.params.type`);
  assertOneOf(context.params.type.context, TYPE_CONTEXTS, `${caller}: context.params.type.context`);
  assertOneOf(context.params.chroma, CHROMA_LEVELS, `${caller}: context.params.chroma`);
  assertOneOf(context.params.radius, RADIUS_SET_NAMES, `${caller}: context.params.radius`);
  assertOneOf(context.params.depth, DEPTH_STYLES, `${caller}: context.params.depth`);
  assertOneOf(context.params.neutralTint, NEUTRAL_TINTS, `${caller}: context.params.neutralTint`);
  const { ratio } = context.params.type;
  if (ratio !== undefined) {
    assertFinite(ratio, `${caller}: context.params.type.ratio`);
    if (ratio <= 1 || ratio > 2) {
      throw new RangeError(`${caller}: context.params.type.ratio must lie in (1, 2], got ${ratio}`);
    }
  }
  assertOneOf(context.density, DENSITIES, `${caller}: context.density`);
  assertRecord(context.primary, `${caller}: context.primary`);
  normalizeSeed(context.primary as Oklch, `${caller}: context.primary`);
  return context as ChipContext;
}

function outcome(patch: AiPatch, density: Density | undefined): ChipOutcome {
  return density === undefined ? { enabled: true, patch } : { enabled: true, patch, density };
}

function steerBy(context: ChipContext, direction: 1 | -1, key: "radius" | "depth") {
  const list = key === "radius" ? RADIUS_SET_NAMES : DEPTH_STYLES;
  return neighbor<string>(list, context.params[key], direction);
}

function compute(chip: Chip, context: ChipContext): ChipOutcome {
  const { params, density, primary } = context;
  const patch: { -readonly [K in keyof AiPatch]: AiPatch[K] } = {};
  let nextDensity: Density | undefined;
  if (chip === "warmer" || chip === "cooler") {
    const tint = chip === "warmer" ? "warm" : "cool";
    const moved = stepped(primary, chip === "warmer" ? WARM_HUE : COOL_HUE);
    if (moved !== undefined) patch.primary = moved;
    if (params.neutralTint !== tint) patch.neutralTint = tint;
  } else if (chip === "bolder" || chip === "quieter") {
    const next = neighbor(CHROMA_LEVELS, params.chroma, chip === "bolder" ? 1 : -1);
    if (next !== undefined) patch.chroma = next;
  } else if (chip === "softer" || chip === "sharper") {
    const direction = chip === "softer" ? 1 : -1;
    const radius = steerBy(context, direction, "radius");
    const depth = steerBy(context, direction, "depth");
    if (radius !== undefined) patch.radius = radius as AiPatch["radius"];
    if (depth !== undefined) patch.depth = depth as AiPatch["depth"];
  } else {
    nextDensity = neighbor(DENSITIES, density, 1);
    const held = params.type.ratio ?? NARROW_RATIO[params.type.context as TypeContext];
    const ratio = RATIO_LADDER.find((value) => value > held + RATIO_EPSILON);
    if (ratio !== undefined) patch.type = { ratio };
  }
  if (Object.keys(patch).length === 0 && nextDensity === undefined) {
    return { enabled: false, reason: REASONS[chip] };
  }
  return outcome(patch, nextDensity);
}

/**
 * What a chip changes (section 8.1): the patch and, for `airier`, a density, or the reason it is
 * disabled when the change would be empty.
 */
export function chipChange(chip: Chip, context: ChipContext): ChipOutcome {
  assertOneOf(chip, CHIPS, "chipChange: chip");
  return compute(chip, checkedContext(context, "chipChange"));
}

/**
 * Each chip in order, on the context the previous ones left: a disabled chip is skipped and left
 * out of `applied`. The density key is present only when a chip changed it.
 */
export function chipsChange(
  chips: readonly Chip[],
  context: ChipContext,
): { readonly patch: AiPatch; readonly density?: Density; readonly applied: readonly Chip[] } {
  if (!Array.isArray(chips)) {
    throw new TypeError(`chipsChange: chips must be an array, got ${describeType(chips)}`);
  }
  for (const chip of chips) assertOneOf(chip, CHIPS, "chipsChange: chips[]");
  let held = checkedContext(context, "chipsChange");
  const patch: { -readonly [K in keyof AiPatch]: AiPatch[K] } = {};
  let density: Density | undefined;
  const applied: Chip[] = [];
  for (const chip of chips) {
    const result = compute(chip, held);
    if (!result.enabled) continue;
    applied.push(chip);
    const { type, ...rest } = result.patch;
    Object.assign(patch, rest);
    if (type !== undefined) patch.type = { ...patch.type, ...type };
    held = {
      params: {
        ...held.params,
        ...(rest as Partial<DirectionParams>),
        type: { ...held.params.type, ...type },
      },
      density: result.density ?? held.density,
      primary: rest.primary ?? held.primary,
    };
    if (result.density !== undefined) density = result.density;
  }
  return density === undefined ? { patch, applied } : { patch, density, applied };
}

/**
 * The chip names in `text`, once each, in order of first appearance (section 8.3). The split is
 * the lexicon matcher's (7.4); no suffix applies, so "warm" and "warmest" are not chip words.
 */
export function chipWords(text: string): readonly Chip[] {
  assertString(text, "chipWords: text");
  const tokens = text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w !== "");
  const found: Chip[] = [];
  for (const token of tokens) {
    const chip = CHIPS.find((name) => name === token);
    if (chip !== undefined && !found.includes(chip)) found.push(chip);
  }
  return found;
}
