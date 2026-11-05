import {
  applyPreset,
  CHROMA_LEVELS,
  CONTRAST_LEVELS,
  type ContrastLevel,
  DEPTH_STYLES,
  type Density,
  type DepthStyle,
  type DirectionParams,
  HARMONIES,
  type Harmony,
  LOCKABLE,
  type Lockable,
  MOTION_FEELS,
  type MotionFeel,
  NEUTRAL_TINTS,
  normalizeSeed,
  type Oklch,
  PAIRING_IDS,
  type PairingId,
  PRESET_IDS,
  type PresetId,
  RADIUS_SET_NAMES,
  type RadiusSet,
  TYPE_CONTEXTS,
  type TypeContext,
} from "@/engine";
import { type CreatedWith, isPlainText } from "@/spec";
import { assertInteger, assertOneOf, assertRecord, describeType, isRecord } from "./assert";
import type {
  BriefDraft,
  ChromaLevel,
  NeutralTint,
  RationaleOutput,
  RefineOp,
  RefineOutput,
} from "./features";

// The changes an AI or rule result makes to the studio (docs/specs/04-ai.md, section 5.2): the two
// types the store's `applyAi` takes (Task 4.1), the vibe tables of section 9.4, and the change
// builders. Each builder returns exactly the fields of an AiChange it owns, never another key,
// because `applyAi` rejects an unknown field.

/** The spec entry does not export `Direction`; this is the same type. */
type Direction = NonNullable<DirectionParams["direction"]>;

/** A change of parameters an AI or rule result makes: assignable to the studio's `ParamsPatch`. */
export type AiPatch = {
  readonly primary?: Oklch | undefined;
  readonly secondary?: Oklch | undefined;
  readonly accent?: Oklch | undefined;
  readonly harmony?: Harmony;
  readonly chroma?: ChromaLevel;
  readonly neutralTint?: NeutralTint;
  readonly contrastLevel?: ContrastLevel;
  readonly type?: { readonly context?: TypeContext; readonly ratio?: number };
  readonly radius?: RadiusSet;
  readonly depth?: DepthStyle;
  readonly motion?: MotionFeel;
  readonly pairing?: PairingId | undefined;
  readonly name?: string;
  readonly oneLiner?: string;
  readonly direction?: Direction;
  readonly rules?: { readonly do: readonly string[]; readonly dont: readonly string[] };
};

/**
 * What the store's `applyAi` applies as one commit (R4-37): the preset first, then the patch, then
 * the density, stamped with what made it. An action never makes an "import".
 */
export type AiChange = {
  readonly preset?: PresetId;
  readonly patch: AiPatch;
  readonly density?: Density;
  readonly createdWith: Exclude<CreatedWith, "import">;
};

/** The vibe's mood tags (section 9.4), which become `direction.adjectives`. */
export const MOOD_TAGS = Object.freeze([
  "calm",
  "warm",
  "cool",
  "bold",
  "playful",
  "serious",
  "earthy",
  "airy",
  "moody",
  "bright",
  "soft",
  "luxurious",
  "technical",
  "organic",
  "retro",
  "minimal",
] as const);

/** The vibe's type vibes (section 9.4), each mapped to one pairing by `TYPE_VIBE_PAIRING`. */
export const TYPE_VIBES = Object.freeze([
  "geometric",
  "humanist",
  "grotesk",
  "editorial-serif",
  "mono-tech",
  "display",
] as const);

export const TYPE_VIBE_PAIRING: Readonly<Record<(typeof TYPE_VIBES)[number], PairingId>> =
  Object.freeze({
    geometric: "funnel",
    humanist: "atkinson",
    grotesk: "host-grotesk",
    "editorial-serif": "schibsted-serif",
    "mono-tech": "hubot-mona",
    display: "unbounded-golos",
  });

/** The lightness and chroma a model or lexicon hue takes as a seed, by chroma level (section 7.6). */
export const HUE_SEEDS: Readonly<Record<ChromaLevel, { readonly l: number; readonly c: number }>> =
  Object.freeze({
    muted: Object.freeze({ l: 0.62, c: 0.07 }),
    balanced: Object.freeze({ l: 0.6, c: 0.13 }),
    vivid: Object.freeze({ l: 0.62, c: 0.2 }),
  });

// The bounds of RationaleOutput (R4-49), within the spec's own bounds of R3-01. They repeat
// features.ts's because features.ts imports this module's tables at run time; importing back would
// make a cycle.
const ONE_LINER_MAX = 140;
const THESIS_MAX = 280;
const RULE_MAX = 160;
const RULES_MAX = 6;
const RATIONALE_KEYS: readonly string[] = ["oneLiner", "thesis", "do", "dont"];

/** Plain text (R3-02) of 1 to `max` characters: another type is a TypeError, else a RangeError. */
function assertProse(value: unknown, max: number, name: string): asserts value is string {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a string, got ${describeType(value)}`);
  }
  if (value.length > max || !isPlainText(value)) {
    throw new RangeError(`${name} must be plain text of 1 to ${max} characters`);
  }
}

function assertRules(value: unknown, name: string): asserts value is readonly string[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${name} must be an array, got ${describeType(value)}`);
  }
  if (value.length < 1 || value.length > RULES_MAX) {
    throw new RangeError(`${name} must hold 1 to ${RULES_MAX} rules, got ${value.length}`);
  }
  value.forEach((rule, i) => {
    assertProse(rule, RULE_MAX, `${name}[${i}]`);
  });
}

// The bounds of BriefOutput (R4-39), repeated from features.ts for the same reason.
const BRIEF_NAME_MAX = 40;
const ADJECTIVE_MAX = 24;
const ADJECTIVES_MAX = 5;
/** The most literal colors a brief gives: one per lockable slot (R4-40). */
const LITERALS_MAX = LOCKABLE.length;
const HUE_MAX = 359;
const BRIEF_KEYS: readonly string[] = [
  "name",
  "oneLiner",
  "adjectives",
  "hues",
  "chroma",
  "neutralTint",
  "harmony",
  "contrastLevel",
  "preset",
  "pairing",
  "typeContext",
  "radius",
  "depth",
  "motion",
];
/** The brief's enum fields, each with the engine's list it takes its value from (I-M4-07). */
const BRIEF_ENUMS: ReadonlyArray<readonly [key: string, values: readonly string[]]> = [
  ["chroma", CHROMA_LEVELS],
  ["neutralTint", NEUTRAL_TINTS],
  ["harmony", HARMONIES],
  ["contrastLevel", CONTRAST_LEVELS],
  ["preset", PRESET_IDS],
  ["pairing", PAIRING_IDS],
  ["typeContext", TYPE_CONTEXTS],
  ["radius", RADIUS_SET_NAMES],
  ["depth", DEPTH_STYLES],
  ["motion", MOTION_FEELS],
];
/** Contrast levels in order: a brief never lowers the level, as presets never do (R2-06). */
const RANK: Readonly<Record<ContrastLevel, number>> = { AA: 0, "AA+": 1, AAA: 2 };

/** A draft of the brief's output shape, every field optional; an explicit undefined is absent. */
function assertDraft(draft: unknown): asserts draft is BriefDraft {
  assertRecord(draft, "briefChange: draft");
  const extra = Object.keys(draft).find((key) => !BRIEF_KEYS.includes(key));
  if (extra !== undefined) {
    throw new RangeError(`briefChange: draft has an unknown key ${JSON.stringify(extra)}`);
  }
  for (const [key, values] of BRIEF_ENUMS) {
    if (draft[key] !== undefined) assertOneOf(draft[key], values, `briefChange: draft.${key}`);
  }
  if (draft.hues !== undefined) {
    assertRecord(draft.hues, "briefChange: draft.hues");
    for (const [slot, hue] of Object.entries(draft.hues)) {
      assertOneOf(slot, LOCKABLE, "briefChange: draft.hues slot");
      if (hue !== undefined) assertInteger(hue, 0, HUE_MAX, `briefChange: draft.hues.${slot}`);
    }
  }
  if (draft.name !== undefined) assertProse(draft.name, BRIEF_NAME_MAX, "briefChange: draft.name");
  if (draft.oneLiner !== undefined) {
    assertProse(draft.oneLiner, ONE_LINER_MAX, "briefChange: draft.oneLiner");
  }
  const { adjectives } = draft;
  if (adjectives === undefined) return;
  if (!Array.isArray(adjectives)) {
    throw new TypeError(
      `briefChange: draft.adjectives must be an array, got ${describeType(adjectives)}`,
    );
  }
  if (adjectives.length < 1 || adjectives.length > ADJECTIVES_MAX) {
    throw new RangeError(
      `briefChange: draft.adjectives must hold 1 to ${ADJECTIVES_MAX} words, got ${adjectives.length}`,
    );
  }
  adjectives.forEach((word, i) => {
    assertProse(word, ADJECTIVE_MAX, `briefChange: draft.adjectives[${i}]`);
  });
}

/** The fields of `fields` that are not undefined. */
function defined<T extends Record<string, unknown>>(
  fields: T,
): { [K in keyof T]?: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as {
    [K in keyof T]?: Exclude<T[K], undefined>;
  };
}

/**
 * A brief's change (R4-41, section 7.6): the draft's preset, applied first, and one patch. The
 * literal colors of the brief (`briefColors`' seeds, at most three) fill primary, secondary and accent
 * in order, even over a lock. A draft hue fills a slot only when the slot is unlocked in `params`, the
 * store's parameters when the reply is applied, and no literal filled it; it takes `HUE_SEEDS`' L and
 * C at the draft's chroma, else the preset's, else the held one. The contrast level applies only when
 * it ranks above the level after the preset. The name and one-liner replace the held ones, and the
 * adjectives replace `direction.adjectives`, keeping the rest of `direction`. The result holds only
 * the fields of an AiChange it owns: `preset` when the draft names one, and `patch`.
 */
export function briefChange(
  draft: BriefDraft,
  context: { params: DirectionParams; literals: readonly Oklch[] },
): { readonly preset?: PresetId; readonly patch: AiPatch } {
  assertDraft(draft);
  assertRecord(context, "briefChange: context");
  const { params, literals } = context;
  assertRecord(params, "briefChange: context.params");
  if (!Array.isArray(literals)) {
    throw new TypeError(
      `briefChange: context.literals must be an array, got ${describeType(literals)}`,
    );
  }
  if (literals.length > LITERALS_MAX) {
    throw new RangeError(
      `briefChange: context.literals must hold at most ${LITERALS_MAX} colors, got ${literals.length}`,
    );
  }
  const seeds = literals.map((literal, i) =>
    normalizeSeed(literal, `briefChange: context.literals[${i}]`),
  );
  assertOneOf(params.chroma, CHROMA_LEVELS, "briefChange: context.params.chroma");
  assertOneOf(params.contrastLevel, CONTRAST_LEVELS, "briefChange: context.params.contrastLevel");
  const held = params.direction;
  if (held !== undefined && !isRecord(held)) {
    throw new TypeError(
      `briefChange: context.params.direction must be an object, got ${describeType(held)}`,
    );
  }
  const { preset, hues, contrastLevel, typeContext, adjectives, ...rest } = draft;
  const base = preset === undefined ? params : applyPreset(params, preset);
  const { l, c } = HUE_SEEDS[rest.chroma ?? base.chroma];
  const slots: Partial<Record<Lockable, Oklch>> = {};
  LOCKABLE.forEach((slot, i) => {
    const literal = seeds[i];
    const hue = hues?.[slot];
    if (literal !== undefined) {
      slots[slot] = literal;
    } else if (hue !== undefined && params[slot] === undefined) {
      slots[slot] = normalizeSeed({ l, c, h: hue }, `briefChange: draft.hues.${slot}`);
    }
  });
  const raises = contrastLevel !== undefined && RANK[contrastLevel] > RANK[base.contrastLevel];
  const patch: AiPatch = {
    ...slots,
    ...defined({
      harmony: rest.harmony,
      chroma: rest.chroma,
      neutralTint: rest.neutralTint,
      radius: rest.radius,
      depth: rest.depth,
      motion: rest.motion,
      pairing: rest.pairing,
    }),
    ...(typeContext === undefined ? {} : { type: { context: typeContext } }),
    ...(raises ? { contrastLevel } : {}),
    ...defined({ name: rest.name, oneLiner: rest.oneLiner }),
    ...(adjectives === undefined ? {} : { direction: { ...held, adjectives: [...adjectives] } }),
  };
  return preset === undefined ? { patch } : { preset, patch };
}

/**
 * The rationale stored in the spec (R4-49): the one-liner, `direction.thesis` (keeping the rest of
 * the held direction) and the rules, as one patch, so the export of a spec stays deterministic. The
 * output is the cleaned one `parseOutput` returns; anything else is refused before it can reach the
 * generator.
 */
export function rationaleChange(
  output: RationaleOutput,
  params: DirectionParams,
): { readonly patch: AiPatch } {
  assertRecord(output, "rationaleChange: output");
  assertRecord(params, "rationaleChange: params");
  const extra = Object.keys(output).find((key) => !RATIONALE_KEYS.includes(key));
  if (extra !== undefined) {
    throw new RangeError(`rationaleChange: output has an unknown key ${JSON.stringify(extra)}`);
  }
  assertProse(output.oneLiner, ONE_LINER_MAX, "rationaleChange: output.oneLiner");
  assertProse(output.thesis, THESIS_MAX, "rationaleChange: output.thesis");
  assertRules(output.do, "rationaleChange: output.do");
  assertRules(output.dont, "rationaleChange: output.dont");
  const held = params.direction;
  if (held !== undefined && !isRecord(held)) {
    throw new TypeError(
      `rationaleChange: params.direction must be an object, got ${describeType(held)}`,
    );
  }
  return {
    patch: {
      oneLiner: output.oneLiner,
      direction: { ...held, thesis: output.thesis },
      rules: { do: [...output.do], dont: [...output.dont] },
    },
  };
}

const HUE_DEGREES = 60;

/** The op's own field, checked against its list: a missing one is a RangeError, a wrong type a TypeError. */
function opField<T extends string>(
  op: Readonly<Record<string, unknown>>,
  field: string,
  allowed: readonly T[],
  name: string,
): T {
  if (op[field] === undefined) throw new RangeError(`${name}.${field} is required`);
  assertOneOf(op[field], allowed, `${name}.${field}`);
  return op[field];
}

/**
 * The ops of a refine output (R4-45, section 8.2) as one patch, applied in order: a later op on a
 * field wins and two `shiftHue` on one slot add up. `seeds` holds each slot's held seed. Returns
 * null when a `shiftHue` finds its slot's hue null, because the design changed while the model
 * read it (I-M4-03). Only `patch` is returned: the caller adds `createdWith`.
 */
export function refineChange(
  output: RefineOutput,
  context: {
    readonly params: DirectionParams;
    readonly seeds: Readonly<Record<Lockable, Oklch>>;
  },
): { readonly patch: AiPatch } | null {
  assertRecord(output, "refineChange: output");
  if (!Array.isArray(output.ops)) {
    throw new TypeError(
      `refineChange: output.ops must be an array, got ${describeType(output.ops)}`,
    );
  }
  assertRecord(context, "refineChange: context");
  assertRecord(context.params, "refineChange: context.params");
  assertRecord(context.seeds, "refineChange: context.seeds");
  const patch: { -readonly [K in keyof AiPatch]: AiPatch[K] } = {};
  let stale = false;
  for (const [i, raw] of (output.ops as readonly unknown[]).entries()) {
    const name = `refineChange: output.ops[${i}]`;
    assertRecord(raw, name);
    const op = raw as RefineOp;
    switch (op.op) {
      case "shiftHue": {
        const slot = opField(raw, "slot", LOCKABLE, name);
        const { degrees } = op;
        if (degrees === undefined) throw new RangeError(`${name}.degrees is required`);
        if (typeof degrees !== "number") {
          throw new TypeError(`${name}.degrees must be a number, got ${describeType(degrees)}`);
        }
        if (!Number.isInteger(degrees) || degrees === 0 || Math.abs(degrees) > HUE_DEGREES) {
          throw new RangeError(
            `${name}.degrees must be an integer from -60 to 60 but not 0, got ${degrees}`,
          );
        }
        const seed = patch[slot] ?? context.seeds[slot];
        assertRecord(seed, `refineChange: context.seeds.${slot}`);
        const held = normalizeSeed(seed as Oklch, `refineChange: context.seeds.${slot}`);
        if (held.h === null) {
          stale = true;
          break;
        }
        patch[slot] = normalizeSeed({
          l: held.l,
          c: held.c,
          h: (((held.h + degrees) % 360) + 360) % 360,
        });
        break;
      }
      case "setChroma":
        patch.chroma = opField(raw, "chroma", CHROMA_LEVELS, name);
        break;
      case "setNeutralTint":
        patch.neutralTint = opField(raw, "neutralTint", NEUTRAL_TINTS, name);
        break;
      case "setContrast":
        patch.contrastLevel = opField(raw, "contrastLevel", CONTRAST_LEVELS, name);
        break;
      case "setHarmony":
        patch.harmony = opField(raw, "harmony", HARMONIES, name);
        break;
      case "setPairing": {
        const pairing = opField(raw, "pairing", [...PAIRING_IDS, "auto"], name);
        patch.pairing = pairing === "auto" ? undefined : (pairing as PairingId);
        break;
      }
      case "setRadius":
        patch.radius = opField(raw, "radius", RADIUS_SET_NAMES, name);
        break;
      case "setDepth":
        patch.depth = opField(raw, "depth", DEPTH_STYLES, name);
        break;
      case "setMotion":
        patch.motion = opField(raw, "motion", MOTION_FEELS, name);
        break;
      case "setTypeContext":
        patch.type = { ...patch.type, context: opField(raw, "typeContext", TYPE_CONTEXTS, name) };
        break;
      default:
        if (typeof op.op !== "string") {
          throw new TypeError(`${name}.op must be a string, got ${describeType(op.op)}`);
        }
        throw new RangeError(`${name}.op is not a refine op, got ${JSON.stringify(op.op)}`);
    }
  }
  return stale ? null : { patch };
}
