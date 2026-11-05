import type {
  ContrastLevel,
  Density,
  DepthStyle,
  DirectionParams,
  Harmony,
  MotionFeel,
  Oklch,
  PairingId,
  PresetId,
  RadiusSet,
  TypeContext,
} from "@/engine";
import { type CreatedWith, isPlainText } from "@/spec";
import { assertRecord, describeType, isRecord } from "./assert";
import type { ChromaLevel, NeutralTint, RationaleOutput } from "./features";

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
