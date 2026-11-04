import {
  CHROMA_LEVELS,
  CONTRAST_LEVELS,
  choosePairing,
  DEPTH_STYLES,
  type DirectionParams,
  GAMUTS,
  HARMONIES,
  hexToRgb,
  LOCKABLE,
  type Lockable,
  MOTION_FEELS,
  NEUTRAL_TINTS,
  normalizeSeed,
  type Oklch,
  PAIRING_IDS,
  paramsOfSpec,
  RADIUS_SET_NAMES,
  resolveParams,
  rgbToOklch,
  SCALE_MODES,
  TYPE_CONTEXTS,
} from "@/engine";
import { type DesignSpec, DesignSpecSchema } from "@/spec";
import { assertOneOf, assertRecord, describeType, isOneOf, isRecord } from "./guards";

// The studio's parameters (spec section 5.7): the check a draft's parameters pass (R2-14 item 2),
// the seed a lock takes (R2-17) and the fields a preset owns (R2-28). Pure.

// `freshParams`, `resolveParams` and `paramsOfSpec` moved to the engine (R3-03); the names stay here.
export { freshParams, paramsOfSpec, resolveParams } from "@/engine";

/** Every field optional, at every level (spec section 5.7). */
export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

/** A change of parameters: `type` merges by key, and a key set to undefined is removed (`pairing: undefined` means auto). */
export type ParamsPatch = DeepPartial<Omit<DirectionParams, "direction" | "rules">> & {
  /** Like `name`: a value sets the field, `undefined` removes it (R3-03). */
  readonly direction?: DirectionParams["direction"] | undefined;
  readonly rules?: DirectionParams["rules"] | undefined;
};

/**
 * The keys of `DirectionParams`: the one list that `parseParams` and `mergeParams` (the store's
 * `setParams`) accept, so a draft and a patch can never disagree on what a parameter is (I2).
 */
export const DIRECTION_PARAM_KEYS: readonly (keyof DirectionParams)[] = Object.freeze([
  ...LOCKABLE,
  "harmony",
  "chroma",
  "neutralTint",
  "gamut",
  "scaleMode",
  "contrastLevel",
  "type",
  "radius",
  "depth",
  "motion",
  "pairing",
  "name",
  "oneLiner",
  "direction",
  "rules",
]);

const PARAM_KEYS: ReadonlySet<string> = new Set(DIRECTION_PARAM_KEYS);

const hasOnly = (value: Record<string, unknown>, keys: ReadonlySet<string>): boolean =>
  Object.keys(value).every((key) => keys.has(key));

const SEED_KEYS: ReadonlySet<string> = new Set(["l", "c", "h"]);
const TYPE_KEYS: ReadonlySet<string> = new Set(["context", "ratio"]);

/** A color's shape: `l`, `c` and `h` and nothing else, numbers, `h` possibly null; else null. */
function seedShape(value: unknown): Oklch | null {
  if (!isRecord(value) || !hasOnly(value, SEED_KEYS)) return null;
  const { l, c, h } = value;
  if (typeof l !== "number" || typeof c !== "number") return null;
  if (h !== null && typeof h !== "number") return null;
  return { l, c, h };
}

/** A seed as stored, when it has a color's shape and `normalizeSeed` accepts it (its domain). */
function parseSeed(value: unknown): Oklch | null {
  const seed = seedShape(value);
  if (seed === null) return null;
  try {
    normalizeSeed(seed);
  } catch {
    return null;
  }
  return seed;
}

/** `type` as stored: a known context and, when present, a finite ratio in (1, 2]. */
function parseType(value: unknown): DirectionParams["type"] | null {
  if (!isRecord(value) || !hasOnly(value, TYPE_KEYS)) return null;
  const { context, ratio } = value;
  if (!isOneOf(context, TYPE_CONTEXTS)) return null;
  if (ratio === undefined) return { context };
  if (typeof ratio !== "number" || !Number.isFinite(ratio) || ratio <= 1 || ratio > 2) return null;
  return { context, ratio };
}

const SPEC_SHAPE = DesignSpecSchema.shape;

/**
 * Whether the text parameters stored in a draft fit R3-01's bounds, the very schema a spec of
 * theirs would pass: `oneLiner`, `direction` and `rules`, each absent or valid.
 */
function textFieldsFit(oneLiner: unknown, direction: unknown, rules: unknown): boolean {
  return (
    (oneLiner === undefined || SPEC_SHAPE.meta.shape.oneLiner.safeParse(oneLiner).success) &&
    (direction === undefined || SPEC_SHAPE.direction.safeParse(direction).success) &&
    (rules === undefined || SPEC_SHAPE.rules.safeParse(rules).success)
  );
}

/**
 * Stored parameters, parsed (R2-14 item 2): every enum in its set, every seed and ratio in its
 * domain, a known pairing id, a non-empty name, and no other key. Anything else gives null. The
 * name's length and every value's agreement with a spec are `paramsMatchSpec`'s check.
 */
export function parseParams(value: unknown): DirectionParams | null {
  if (!isRecord(value) || !hasOnly(value, PARAM_KEYS)) return null;
  const { harmony, chroma, neutralTint, gamut, scaleMode, contrastLevel } = value;
  const { radius, depth, motion, pairing, name, oneLiner, direction, rules } = value;
  if (
    !isOneOf(harmony, HARMONIES) ||
    !isOneOf(chroma, CHROMA_LEVELS) ||
    !isOneOf(neutralTint, NEUTRAL_TINTS) ||
    !isOneOf(gamut, GAMUTS) ||
    !isOneOf(scaleMode, SCALE_MODES) ||
    !isOneOf(contrastLevel, CONTRAST_LEVELS) ||
    !isOneOf(radius, RADIUS_SET_NAMES) ||
    !isOneOf(depth, DEPTH_STYLES) ||
    !isOneOf(motion, MOTION_FEELS)
  ) {
    return null;
  }
  if (pairing !== undefined && !isOneOf(pairing, PAIRING_IDS)) return null;
  if (name !== undefined && (typeof name !== "string" || name.length === 0)) return null;
  if (!textFieldsFit(oneLiner, direction, rules)) return null;
  const type = parseType(value.type);
  if (type === null) return null;
  const seeds: Partial<Record<Lockable, Oklch>> = {};
  for (const slot of LOCKABLE) {
    if (value[slot] === undefined) continue;
    const seed = parseSeed(value[slot]);
    if (seed === null) return null;
    seeds[slot] = seed;
  }
  return {
    ...seeds,
    harmony,
    chroma,
    neutralTint,
    gamut,
    scaleMode,
    contrastLevel,
    type,
    radius,
    depth,
    motion,
    ...(pairing === undefined ? {} : { pairing }),
    ...(name === undefined ? {} : { name }),
    ...(oneLiner === undefined ? {} : { oneLiner: oneLiner as string }),
    ...(direction === undefined ? {} : { direction: direction as DirectionParams["direction"] }),
    ...(rules === undefined ? {} : { rules: rules as DirectionParams["rules"] }),
  };
}

/** JSON with sorted keys and undefined left out: equal text means equal plain data. */
function stableJson(value: unknown): string {
  // Arrays (the text lists) hold strings only; JSON.stringify writes them deterministically.
  if (isRecord(value)) {
    const members = Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`);
    return `{${members.join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Whether two sets of parameters hold the same values; an absent key equals one set to undefined. */
export function sameParams(a: DirectionParams, b: DirectionParams): boolean {
  return stableJson(a) === stableJson(b);
}

/**
 * Whether `params` regenerate `spec` with its seed (R2-14 item 2): every field except `pairing`
 * equals what `paramsOfSpec(spec)` reads, and the pairing they resolve to for `meta.seed`, auto or
 * explicit, has the spec's three families. Families that match no pairing never match.
 */
export function paramsMatchSpec(params: DirectionParams, spec: DesignSpec): boolean {
  assertRecord(params, "paramsMatchSpec: params");
  assertRecord(spec, "paramsMatchSpec: spec");
  const { pairing: _ours, ...rest } = params;
  const { params: recorded, customFonts } = paramsOfSpec(spec);
  const { pairing: explicit, ...expected } = recorded;
  if (customFonts || stableJson(rest) !== stableJson(expected)) return false;
  // The spec's families are a pairing: the explicit one, or else the pick for its seed.
  return (
    resolveParams(params, spec.meta.seed).pairing === (explicit ?? choosePairing(spec.meta.seed))
  );
}

/**
 * The seed a lock takes (R2-17), so the locked slot keeps the color it shows. `primary`: L and C
 * of the light `primary` role, read back from its hex, with the palette's hue. `secondary` and
 * `accent`: L and C of the palette's light step 500 with the palette's hue. Never the drifted hue
 * of a step, and never the step-100 tint a role such as `secondary` shows.
 */
export function lockSeed(spec: DesignSpec, slot: Lockable): Oklch {
  assertRecord(spec, "lockSeed: spec");
  assertOneOf(slot, LOCKABLE, "lockSeed: slot");
  assertRecord(spec.color, "lockSeed: spec.color");
  const palette = spec.color.palettes[slot];
  assertRecord(palette, `lockSeed: spec.color.palettes.${slot}`);
  if (slot === "primary") {
    const shown = rgbToOklch(hexToRgb(spec.color.roles.light.primary), "srgb");
    // White reads back as L 1.0000000000000002; a seed's L stays in [0, 1].
    const l = Math.min(1, Math.max(0, shown.l));
    return normalizeSeed({ l, c: shown.c, h: palette.hue }, "lockSeed: seed");
  }
  const step = palette.light.find((entry) => entry.step === 500);
  if (step === undefined) {
    throw new TypeError(`lockSeed: spec.color.palettes.${slot}.light has no step 500`);
  }
  return normalizeSeed({ l: step.oklch.l, c: step.oklch.c, h: palette.hue }, "lockSeed: seed");
}

/** The parameters with the seed of `slot` set, or removed (unlocked) when `seed` is undefined. */
export function withSeed(
  params: DirectionParams,
  slot: Lockable,
  seed: Oklch | undefined,
): DirectionParams {
  const { primary, secondary, accent, ...rest } = params;
  const seeds: Partial<Record<Lockable, Oklch>> = { primary, secondary, accent, [slot]: seed };
  return {
    ...rest,
    ...(seeds.primary === undefined ? {} : { primary: seeds.primary }),
    ...(seeds.secondary === undefined ? {} : { secondary: seeds.secondary }),
    ...(seeds.accent === undefined ? {} : { accent: seeds.accent }),
  };
}

/** A seed of a patch: undefined removes it, a whole color sets it, anything else is a TypeError. */
function seedOfPatch(value: unknown, name: string): Oklch | undefined {
  if (value === undefined) return undefined;
  const seed = seedShape(value);
  if (seed === null) {
    throw new TypeError(
      `${name} must be a whole color with only l, c and h, got ${describeType(value)}`,
    );
  }
  return seed;
}

function mergeType(
  current: DirectionParams["type"],
  patch: DeepPartial<DirectionParams["type"]>,
  caller: string,
): DirectionParams["type"] {
  assertRecord(patch, `${caller}: patch.type`);
  for (const key of Object.keys(patch)) {
    if (!TYPE_KEYS.has(key)) {
      throw new RangeError(`${caller}: patch.type.${key} is not a type parameter`);
    }
  }
  if (Object.hasOwn(patch, "context") && patch.context === undefined) {
    throw new TypeError(`${caller}: patch.type.context cannot be removed`);
  }
  const context = patch.context ?? current.context;
  const ratio = Object.hasOwn(patch, "ratio") ? patch.ratio : current.ratio;
  return ratio === undefined ? { context } : { context, ratio };
}

/**
 * The parameters after a patch (spec section 5.7, `ParamsPatch`), a new object: `type` merges by
 * key, a whole seed color replaces a seed, and an optional key set to undefined is removed
 * (`pairing: undefined` is auto). Values are not checked: the generator checks them, and a bad one
 * ends in a `generation` notice (C-STORE-20). Keys and shapes are checked, so the result has the
 * parameters' form: an unknown key is a RangeError, a removed required key or a partial seed a
 * TypeError. Errors name `caller` (the store's `setParams`).
 */
export function mergeParams(
  params: DirectionParams,
  patch: ParamsPatch,
  caller = "mergeParams",
): DirectionParams {
  assertRecord(patch, `${caller}: patch`);
  for (const key of Object.keys(patch)) {
    if (!PARAM_KEYS.has(key)) {
      throw new RangeError(`${caller}: patch.${key} is not a direction parameter`);
    }
  }
  const {
    primary,
    secondary,
    accent,
    pairing,
    name,
    oneLiner,
    direction,
    rules,
    type,
    ...choices
  } = patch;
  for (const [key, value] of Object.entries(choices)) {
    if (value === undefined) throw new TypeError(`${caller}: patch.${key} cannot be removed`);
  }
  if (Object.hasOwn(patch, "type") && type === undefined) {
    throw new TypeError(`${caller}: patch.type cannot be removed`);
  }
  let next: DirectionParams = {
    ...params,
    ...choices,
    type: type === undefined ? params.type : mergeType(params.type, type, caller),
  };
  for (const [slot, value] of [
    ["primary", primary],
    ["secondary", secondary],
    ["accent", accent],
  ] as const) {
    if (Object.hasOwn(patch, slot)) {
      next = withSeed(next, slot, seedOfPatch(value, `${caller}: patch.${slot}`));
    }
  }
  if (Object.hasOwn(patch, "pairing")) {
    const { pairing: _old, ...rest } = next;
    next = pairing === undefined ? rest : { ...rest, pairing };
  }
  for (const [key, value] of [
    ["name", name],
    ["oneLiner", oneLiner],
    ["direction", direction],
    ["rules", rules],
  ] as const) {
    if (!Object.hasOwn(patch, key)) continue;
    const { [key]: _old, ...rest } = next;
    next = value === undefined ? rest : { ...rest, [key]: value };
  }
  return next;
}

/**
 * Whether a change of parameters touches a field the selected preset owns (R2-28): harmony,
 * chroma, neutral tint, contrast level, scale mode, type context, radius, depth, motion or
 * pairing, set to a different value. Seeds, the gamut, the ratio and the name do not.
 */
export function touchesPreset(before: DirectionParams, after: DirectionParams): boolean {
  return (
    before.harmony !== after.harmony ||
    before.chroma !== after.chroma ||
    before.neutralTint !== after.neutralTint ||
    before.contrastLevel !== after.contrastLevel ||
    before.scaleMode !== after.scaleMode ||
    before.type?.context !== after.type?.context ||
    before.radius !== after.radius ||
    before.depth !== after.depth ||
    before.motion !== after.motion ||
    before.pairing !== after.pairing
  );
}
