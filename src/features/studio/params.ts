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
  PAIRINGS,
  type Pairing,
  PRESETS,
  RADIUS_SET_NAMES,
  rgbToOklch,
  SCALE_MODES,
  TYPE_CONTEXTS,
} from "@/engine";
import type { DesignSpec } from "@/spec";
import { assertOneOf, assertRecord, assertString, isOneOf, isRecord } from "./guards";

// The studio's parameters (spec section 5.7): the fresh design, the automatic pairing (R2-05), the
// parameters a spec records (`paramsOfSpec`), the check a draft's parameters pass (R2-14 item 2),
// the seed a lock takes (R2-17) and the fields a preset owns (R2-28). Pure.

/** Every field optional, at every level (spec section 5.7). */
export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

/** A change of parameters: `type` merges by key, and a key set to undefined is removed (`pairing: undefined` means auto). */
export type ParamsPatch = DeepPartial<DirectionParams>;

/**
 * The name `generateSystem` writes when `params.name` is absent. `paramsOfSpec` leaves it out, so
 * a design made without a name reads back without one; a test pins it to the generator's output.
 */
const UNNAMED = "untitled";

/** The gamut of a fresh design; the `default` preset does not set one. */
const FRESH_GAMUT = "srgb";

/** The `default` preset's parameters with sRGB and no pairing, which means auto (R2-05). */
export function freshParams(): DirectionParams {
  const { pairing: _auto, type, ...rest } = PRESETS.default.params;
  return { ...rest, type: { context: type.context }, gamut: FRESH_GAMUT };
}

/** The parameters with an absent pairing filled by `choosePairing(seed)` (R2-05). */
export function resolveParams(params: DirectionParams, seed: string): DirectionParams {
  assertRecord(params, "resolveParams: params");
  assertString(seed, "resolveParams: seed");
  return params.pairing === undefined ? { ...params, pairing: choosePairing(seed) } : params;
}

/** The pairing whose three families are these, if one is. */
function pairingWith(families: DesignSpec["type"]["families"]): Pairing | undefined {
  return PAIRINGS.find(
    (item) =>
      item.display === families.display &&
      item.body === families.body &&
      item.mono === families.mono,
  );
}

/** A spec's sections that `paramsOfSpec` reads, checked before they are read (R-05). */
function checkSpec(spec: DesignSpec, caller: string): void {
  assertRecord(spec, `${caller}: spec`);
  const sections = {
    meta: spec.meta,
    color: spec.color,
    type: spec.type,
    shape: spec.shape,
    depth: spec.depth,
    motion: spec.motion,
  };
  for (const [key, value] of Object.entries(sections))
    assertRecord(value, `${caller}: spec.${key}`);
  assertRecord(spec.color.params, `${caller}: spec.color.params`);
  assertRecord(spec.type.families, `${caller}: spec.type.families`);
  assertString(spec.meta.seed, `${caller}: spec.meta.seed`);
}

/**
 * The parameters a spec records (section 5.7): `color.params`, the type context and ratio, the
 * radius set, the depth style, the motion feel and the name (left out when it is the generator's
 * default), and the pairing whose families equal `type.families`. That pairing stays absent (auto)
 * when it is the one `choosePairing(meta.seed)` picks (R2-05). Families that match no pairing
 * leave `pairing` absent and set `customFonts` (R2-14 item 4).
 */
export function paramsOfSpec(spec: DesignSpec): { params: DirectionParams; customFonts: boolean } {
  checkSpec(spec, "paramsOfSpec");
  const { primary, secondary, accent, ...choices } = spec.color.params;
  const { context, ratio, families } = spec.type;
  const match = pairingWith(families);
  const explicit = match !== undefined && match.id !== choosePairing(spec.meta.seed);
  const params: DirectionParams = {
    ...(primary === undefined ? {} : { primary }),
    ...(secondary === undefined ? {} : { secondary }),
    ...(accent === undefined ? {} : { accent }),
    ...choices,
    type: ratio === undefined ? { context } : { context, ratio },
    radius: spec.shape.radiusSet,
    depth: spec.depth.style,
    motion: spec.motion.feel,
    ...(spec.meta.name === UNNAMED ? {} : { name: spec.meta.name }),
    ...(explicit ? { pairing: match.id } : {}),
  };
  return { params, customFonts: match === undefined };
}

const PARAM_KEYS: ReadonlySet<string> = new Set([
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
]);

const hasOnly = (value: Record<string, unknown>, keys: ReadonlySet<string>): boolean =>
  Object.keys(value).every((key) => keys.has(key));

const SEED_KEYS: ReadonlySet<string> = new Set(["l", "c", "h"]);
const TYPE_KEYS: ReadonlySet<string> = new Set(["context", "ratio"]);

/** A seed as stored, when `normalizeSeed` accepts it (its domain), else null. */
function parseSeed(value: unknown): Oklch | null {
  if (!isRecord(value) || !hasOnly(value, SEED_KEYS)) return null;
  const { l, c, h } = value;
  if (typeof l !== "number" || typeof c !== "number") return null;
  if (h !== null && typeof h !== "number") return null;
  const seed: Oklch = { l, c, h };
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

/**
 * Stored parameters, parsed (R2-14 item 2): every enum in its set, every seed and ratio in its
 * domain, a known pairing id, a non-empty name, and no other key. Anything else gives null. The
 * name's length and every value's agreement with a spec are `paramsMatchSpec`'s check.
 */
export function parseParams(value: unknown): DirectionParams | null {
  if (!isRecord(value) || !hasOnly(value, PARAM_KEYS)) return null;
  const { harmony, chroma, neutralTint, gamut, scaleMode, contrastLevel } = value;
  const { radius, depth, motion, pairing, name } = value;
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
  };
}

/** JSON with sorted keys and undefined left out: equal text means equal plain data. */
function stableJson(value: unknown): string {
  // Parameters hold no arrays; JSON.stringify writes any other value deterministically.
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
  checkSpec(spec, "paramsMatchSpec");
  const { pairing: _ours, ...rest } = params;
  const { pairing: _theirs, ...expected } = paramsOfSpec(spec).params;
  if (stableJson(rest) !== stableJson(expected)) return false;
  const resolved = resolveParams(params, spec.meta.seed).pairing;
  return resolved !== undefined && pairingWith(spec.type.families)?.id === resolved;
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
