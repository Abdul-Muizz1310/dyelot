import type { DesignSpec, DirectionParams } from "../spec/schema";
import { describeType } from "./color/guards";
import { choosePairing, PAIRINGS, type Pairing } from "./fonts/pairings";
import { PRESETS } from "./presets";

// The parameters of a fresh design, the automatic pairing (R2-05) and the parameters a spec
// records (R3-03). They sit in the engine so the studio and the exporters share them. Pure.

/**
 * The name `generateSystem` writes when `params.name` is absent. `paramsOfSpec` leaves it out, so
 * a design made without a name reads back without one; a test pins it to the generator's output.
 */
const UNNAMED = "untitled";

/** The gamut of a fresh design; the `default` preset does not set one. */
const FRESH_GAMUT = "srgb";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertRecord(value: unknown, name: string): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    throw new TypeError(
      `${name} must be an object, got ${Array.isArray(value) ? "array" : describeType(value)}`,
    );
  }
}

function assertString(value: unknown, name: string): asserts value is string {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a string, got ${describeType(value)}`);
  }
}

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
 * radius set, the depth style, the motion feel, the name (left out when it is the generator's
 * default), `meta.oneLiner`, `direction` and `rules` (the last only when a list holds an entry,
 * R3-03), and the pairing whose families equal `type.families`. That pairing stays absent (auto)
 * when it is the one `choosePairing(meta.seed)` picks (R2-05). Families that match no pairing
 * leave `pairing` absent and set `customFonts` (R2-14 item 4).
 */
export function paramsOfSpec(spec: DesignSpec): { params: DirectionParams; customFonts: boolean } {
  checkSpec(spec, "paramsOfSpec");
  const { primary, secondary, accent, ...choices } = spec.color.params;
  const { context, ratio, families } = spec.type;
  const { oneLiner } = spec.meta;
  const { direction, rules } = spec;
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
    ...(oneLiner === undefined ? {} : { oneLiner }),
    ...(direction === undefined ? {} : { direction: structuredClone(direction) }),
    ...(rules === undefined || (rules.do.length === 0 && rules.dont.length === 0)
      ? {}
      : { rules: { do: [...rules.do], dont: [...rules.dont] } }),
    ...(explicit ? { pairing: match.id } : {}),
  };
  return { params, customFonts: match === undefined };
}
