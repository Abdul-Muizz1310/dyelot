import {
  CHROMA_LEVELS,
  CONTRAST_CHECKS,
  CONTRAST_LEVELS,
  type ContrastLevel,
  DEPTH_STYLES,
  type DepthStyle,
  HARMONIES,
  type Harmony,
  LOCKABLE,
  type Lockable,
  MOTION_FEELS,
  type Mode,
  type MotionFeel,
  NEUTRAL_TINTS,
  PAIRING_IDS,
  PAIRINGS,
  type PairingId,
  PRESET_IDS,
  type PresetId,
  RADIUS_SET_NAMES,
  type RadiusSet,
  RULE_IDS,
  type RuleId,
  type Severity,
  TYPE_CONTEXTS,
  type TypeContext,
} from "@/engine";
import { isPlainText } from "@/spec";
import { z } from "@/spec/zod";
import { MOOD_TAGS, TYPE_VIBES } from "./apply";
import { assertOneOf, valueAt } from "./assert";
import { cleanModelText } from "./prose";

// The five features, their closed schemas and the one check every provider's output passes
// (docs/specs/04-ai.md, R4-38, R4-39, R4-45, R4-48 to R4-50 and section 5.2). Every enum comes from
// the engine's own lists, so an output that passes can always be applied (I-M4-07). Output schemas
// stay flat enough for `z.toJSONSchema` (R4-10): objects, arrays, string enums, one integer literal
// enum (never a union of literals, R4-62 probe 7), bounded strings and integers, and no refinement.

export const AI_FEATURES = Object.freeze([
  "brief",
  "refine",
  "vibe",
  "rationale",
  "critique",
] as const);
export type AiFeature = (typeof AI_FEATURES)[number];

/** A hue on the OKLCH wheel: an integer from 0 to 359. */
export type Hue = number;
export type HueOrNull = Hue | null;
export type ChromaLevel = (typeof CHROMA_LEVELS)[number];
export type NeutralTint = (typeof NEUTRAL_TINTS)[number];

export type BriefInput = {
  /** Plain text of 1 to 500 characters. */
  readonly brief: string;
  readonly locked: {
    readonly primary?: HueOrNull;
    readonly secondary?: HueOrNull;
    readonly accent?: HueOrNull;
  };
};
export type BriefOutput = {
  readonly name: string;
  readonly oneLiner?: string;
  readonly adjectives?: readonly string[];
  readonly hues?: { readonly primary?: Hue; readonly secondary?: Hue; readonly accent?: Hue };
  readonly chroma?: ChromaLevel;
  readonly neutralTint?: NeutralTint;
  readonly harmony?: Harmony;
  readonly contrastLevel?: ContrastLevel;
  readonly preset?: PresetId;
  readonly pairing?: PairingId;
  readonly typeContext?: TypeContext;
  readonly radius?: RadiusSet;
  readonly depth?: DepthStyle;
  readonly motion?: MotionFeel;
};
/** What the lexicon gives: no name, one-liner or adjectives. */
export type BriefDraft = Partial<BriefOutput>;

export type RefineInput = {
  /** Plain text of 1 to 200 characters. */
  readonly text: string;
  readonly current: {
    readonly harmony: Harmony;
    readonly chroma: ChromaLevel;
    readonly neutralTint: NeutralTint;
    readonly contrastLevel: ContrastLevel;
    readonly pairing: PairingId | "auto";
    readonly typeContext: TypeContext;
    readonly radius: RadiusSet;
    readonly depth: DepthStyle;
    readonly motion: MotionFeel;
    readonly hues: {
      readonly primary: HueOrNull;
      readonly secondary: HueOrNull;
      readonly accent: HueOrNull;
    };
  };
};
const REFINE_OPS = Object.freeze([
  "shiftHue",
  "setChroma",
  "setNeutralTint",
  "setContrast",
  "setHarmony",
  "setPairing",
  "setRadius",
  "setDepth",
  "setMotion",
  "setTypeContext",
] as const);
export type RefineOpName = (typeof REFINE_OPS)[number];
/** One flat op (R4-45); section 8.2 lists each op's own fields. */
export type RefineOp = {
  readonly op: RefineOpName;
  readonly slot?: Lockable;
  /** A literal enum of −60 to −1 and 1 to 60. */
  readonly degrees?: number;
  readonly chroma?: ChromaLevel;
  readonly neutralTint?: NeutralTint;
  readonly contrastLevel?: ContrastLevel;
  readonly harmony?: Harmony;
  readonly pairing?: PairingId | "auto";
  readonly radius?: RadiusSet;
  readonly depth?: DepthStyle;
  readonly motion?: MotionFeel;
  readonly typeContext?: TypeContext;
};
export type RefineOutput = { readonly ops: readonly RefineOp[]; readonly summary: string };

export type VibeInput = {
  /** 1 to 8, ids "c1" … "cN" in order; l and c to 3 decimals, share to 3 decimals in (0, 1]. */
  readonly clusters: readonly {
    readonly id: string;
    readonly l: number;
    readonly c: number;
    readonly h: HueOrNull;
    readonly share: number;
  }[];
  readonly image: { readonly dataUrl: string; readonly width: number; readonly height: number };
};
export type MoodTag = (typeof MOOD_TAGS)[number];
export type TypeVibe = (typeof TYPE_VIBES)[number];
export type VibeOutput = {
  readonly roleMap: {
    readonly primary: string;
    readonly secondary?: string;
    readonly accent?: string;
  };
  readonly neutralTint: NeutralTint;
  readonly moodTags: readonly MoodTag[];
  readonly typeVibe: TypeVibe;
  readonly preset: PresetId;
};

export type RationaleInput = {
  readonly name: string;
  readonly preset: PresetId | null;
  /** The label of the pairing whose three families the spec uses, else null. */
  readonly pairing: string | null;
  readonly families: { readonly display: string; readonly body: string; readonly mono: string };
  readonly contrastLevel: ContrastLevel;
  /** The 26 C1 checks, light then dark, each ratio cut to 2 decimals. */
  readonly checks: readonly {
    readonly check: string;
    readonly mode: Mode;
    readonly ratio: number;
  }[];
  readonly lint: { readonly error: number; readonly warn: number; readonly info: number };
};
export type RationaleOutput = {
  readonly oneLiner: string;
  readonly thesis: string;
  readonly do: readonly string[];
  readonly dont: readonly string[];
};

export type CritiqueInput = {
  /** 1 to 40, in lintSpec's order. */
  readonly findings: readonly {
    readonly id: RuleId;
    readonly severity: Severity;
    readonly mode: Mode;
    readonly subject: string;
    readonly measured: number;
    readonly threshold: number;
  }[];
};
export type CritiqueOutput = {
  readonly top: readonly { readonly findingIndex: number; readonly why: string }[];
  readonly verdict: string;
};

export type FeatureInput = {
  brief: BriefInput;
  refine: RefineInput;
  vibe: VibeInput;
  rationale: RationaleInput;
  critique: CritiqueInput;
};
export type FeatureOutput = {
  brief: BriefOutput;
  refine: RefineOutput;
  vibe: VibeOutput;
  rationale: RationaleOutput;
  critique: CritiqueOutput;
};

// The bounds of 5.2.
const BRIEF_MAX = 500;
const REFINE_MAX = 200;
const RATIONALE_NAME_MAX = 80;
const FAMILY_NAME_MAX = 64;
const SUBJECT_MAX = 120;
const MAX_CLUSTERS = 8;
const DATA_URL_MAX = 1_400_000;
const VIBE_SIDE = 768;
const MAX_FINDINGS = 40;
const NAME_MAX = 40;
const ONE_LINER_MAX = 140;
const ADJECTIVE_MAX = 24;
const LIST_MAX = 5;
const SUMMARY_MAX = 140;
const MAX_OPS = 6;
const THESIS_MAX = 280;
const RULE_MAX = 160;
const RULES_MAX = 6;
const WHY_MAX = 200;
const VERDICT_MAX = 200;
const MAX_TOP = 3;
/** The engine's chroma ceiling, the domain of `normalizeSeed`. */
const CHROMA_MAX = 0.5;
const DATA_URL = /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/;

const MODES = ["light", "dark"] as const satisfies readonly Mode[];
const SEVERITIES = ["error", "warn", "info"] as const satisfies readonly Severity[];
const PAIRING_OR_AUTO: readonly (PairingId | "auto")[] = [...PAIRING_IDS, "auto"];
const C1_IDS: readonly string[] = CONTRAST_CHECKS.filter((check) => check.rule === "C1").map(
  (check) => check.id,
);
/** The integers −60 to −1 and 1 to 60, as one literal enum. */
const DEGREES: readonly number[] = [
  ...Array.from({ length: 60 }, (_, i) => i - 60),
  ...Array.from({ length: 60 }, (_, i) => i + 1),
];

/** Each refine op's own fields (section 8.2), exactly. */
const OP_FIELDS: Readonly<Record<RefineOpName, readonly (keyof RefineOp)[]>> = {
  shiftHue: ["slot", "degrees"],
  setChroma: ["chroma"],
  setNeutralTint: ["neutralTint"],
  setContrast: ["contrastLevel"],
  setHarmony: ["harmony"],
  setPairing: ["pairing"],
  setRadius: ["radius"],
  setDepth: ["depth"],
  setMotion: ["motion"],
  setTypeContext: ["typeContext"],
};

const decimals = (places: number) => (x: number) => {
  const scale = 10 ** places;
  return Math.round(x * scale) / scale === x;
};
const plainText = (max: number) =>
  z.string().min(1).max(max).refine(isPlainText, "must be plain text");
const HueSchema = z.int().min(0).max(359);
const HueOrNullSchema = HueSchema.nullable();

// The input schemas: what `briefInput` and the others build, and what the route accepts (R4-16).

const BriefInputSchema = z.strictObject({
  brief: plainText(BRIEF_MAX),
  locked: z.strictObject({
    primary: HueOrNullSchema.exactOptional(),
    secondary: HueOrNullSchema.exactOptional(),
    accent: HueOrNullSchema.exactOptional(),
  }),
});

const RefineInputSchema = z.strictObject({
  text: plainText(REFINE_MAX),
  current: z.strictObject({
    harmony: z.enum(HARMONIES),
    chroma: z.enum(CHROMA_LEVELS),
    neutralTint: z.enum(NEUTRAL_TINTS),
    contrastLevel: z.enum(CONTRAST_LEVELS),
    pairing: z.enum(PAIRING_OR_AUTO),
    typeContext: z.enum(TYPE_CONTEXTS),
    radius: z.enum(RADIUS_SET_NAMES),
    depth: z.enum(DEPTH_STYLES),
    motion: z.enum(MOTION_FEELS),
    hues: z.strictObject({
      primary: HueOrNullSchema,
      secondary: HueOrNullSchema,
      accent: HueOrNullSchema,
    }),
  }),
});

const VibeInputSchema = z.strictObject({
  clusters: z
    .array(
      z.strictObject({
        id: z.string(),
        l: z.number().min(0).max(1).refine(decimals(3), "must have at most 3 decimals"),
        c: z.number().min(0).max(CHROMA_MAX).refine(decimals(3), "must have at most 3 decimals"),
        h: HueOrNullSchema,
        share: z.number().gt(0).max(1).refine(decimals(3), "must have at most 3 decimals"),
      }),
    )
    .min(1)
    .max(MAX_CLUSTERS)
    .refine(
      (clusters) => clusters.every((cluster, i) => cluster.id === `c${i + 1}`),
      "ids must be c1 to cN in order",
    ),
  image: z.strictObject({
    dataUrl: z.string().max(DATA_URL_MAX).regex(DATA_URL),
    width: z.int().min(1).max(VIBE_SIDE),
    height: z.int().min(1).max(VIBE_SIDE),
  }),
});

const RationaleInputSchema = z.strictObject({
  name: plainText(RATIONALE_NAME_MAX),
  preset: z.enum(PRESET_IDS).nullable(),
  pairing: z.enum(PAIRINGS.map((pairing) => pairing.label)).nullable(),
  families: z.strictObject({
    display: plainText(FAMILY_NAME_MAX),
    body: plainText(FAMILY_NAME_MAX),
    mono: plainText(FAMILY_NAME_MAX),
  }),
  contrastLevel: z.enum(CONTRAST_LEVELS),
  checks: z
    .array(
      z.strictObject({
        check: z.enum(C1_IDS),
        mode: z.enum(MODES),
        ratio: z.number().min(1).max(21).refine(decimals(2), "must be cut to 2 decimals"),
      }),
    )
    .length(C1_IDS.length * MODES.length)
    .refine(
      (checks) =>
        checks.every(
          (entry, i) =>
            entry.check === C1_IDS[i % C1_IDS.length] &&
            entry.mode === MODES[Math.floor(i / C1_IDS.length)],
        ),
      "must hold the C1 checks in order, light then dark",
    ),
  lint: z.strictObject({ error: z.int().min(0), warn: z.int().min(0), info: z.int().min(0) }),
});

const CritiqueInputSchema = z.strictObject({
  findings: z
    .array(
      z.strictObject({
        id: z.enum(RULE_IDS),
        severity: z.enum(SEVERITIES),
        mode: z.enum(MODES),
        subject: z.string().min(1).max(SUBJECT_MAX),
        measured: z.number(),
        threshold: z.number(),
      }),
    )
    .min(1)
    .max(MAX_FINDINGS),
});

const INPUT_SCHEMAS: { readonly [F in AiFeature]: z.ZodType<FeatureInput[F]> } = {
  brief: BriefInputSchema,
  refine: RefineInputSchema,
  vibe: VibeInputSchema,
  rationale: RationaleInputSchema,
  critique: CritiqueInputSchema,
};

// The output schemas, closed at every depth. A model string is checked here for its type and
// length only; its value check is the third step of `parseOutput`.

const text = (max: number) => z.string().min(1).max(max);

const BriefOutputSchema = z.strictObject({
  name: text(NAME_MAX),
  oneLiner: text(ONE_LINER_MAX).exactOptional(),
  adjectives: z.array(text(ADJECTIVE_MAX)).min(1).max(LIST_MAX).exactOptional(),
  hues: z
    .strictObject({
      primary: HueSchema.exactOptional(),
      secondary: HueSchema.exactOptional(),
      accent: HueSchema.exactOptional(),
    })
    .exactOptional(),
  chroma: z.enum(CHROMA_LEVELS).exactOptional(),
  neutralTint: z.enum(NEUTRAL_TINTS).exactOptional(),
  harmony: z.enum(HARMONIES).exactOptional(),
  contrastLevel: z.enum(CONTRAST_LEVELS).exactOptional(),
  preset: z.enum(PRESET_IDS).exactOptional(),
  pairing: z.enum(PAIRING_IDS).exactOptional(),
  typeContext: z.enum(TYPE_CONTEXTS).exactOptional(),
  radius: z.enum(RADIUS_SET_NAMES).exactOptional(),
  depth: z.enum(DEPTH_STYLES).exactOptional(),
  motion: z.enum(MOTION_FEELS).exactOptional(),
});

const RefineOutputSchema = z.strictObject({
  ops: z
    .array(
      z.strictObject({
        op: z.enum(REFINE_OPS),
        slot: z.enum(LOCKABLE).exactOptional(),
        degrees: z.literal(DEGREES).exactOptional(),
        chroma: z.enum(CHROMA_LEVELS).exactOptional(),
        neutralTint: z.enum(NEUTRAL_TINTS).exactOptional(),
        contrastLevel: z.enum(CONTRAST_LEVELS).exactOptional(),
        harmony: z.enum(HARMONIES).exactOptional(),
        pairing: z.enum(PAIRING_OR_AUTO).exactOptional(),
        radius: z.enum(RADIUS_SET_NAMES).exactOptional(),
        depth: z.enum(DEPTH_STYLES).exactOptional(),
        motion: z.enum(MOTION_FEELS).exactOptional(),
        typeContext: z.enum(TYPE_CONTEXTS).exactOptional(),
      }),
    )
    .min(1)
    .max(MAX_OPS),
  summary: text(SUMMARY_MAX),
});

/** The vibe's roles name only the input's clusters. */
function vibeOutputSchema(input: VibeInput) {
  const ids = z.enum(input.clusters.map((cluster) => cluster.id));
  return z.strictObject({
    roleMap: z.strictObject({
      primary: ids,
      secondary: ids.exactOptional(),
      accent: ids.exactOptional(),
    }),
    neutralTint: z.enum(NEUTRAL_TINTS),
    moodTags: z.array(z.enum(MOOD_TAGS)).min(1).max(LIST_MAX),
    typeVibe: z.enum(TYPE_VIBES),
    preset: z.enum(PRESET_IDS),
  });
}

const RationaleOutputSchema = z.strictObject({
  oneLiner: text(ONE_LINER_MAX),
  thesis: text(THESIS_MAX),
  do: z.array(text(RULE_MAX)).min(1).max(RULES_MAX),
  dont: z.array(text(RULE_MAX)).min(1).max(RULES_MAX),
});

/** The critique names a finding by its index in the input: 0 to n − 1. */
function critiqueOutputSchema(input: CritiqueInput) {
  const indexes = input.findings.map((_, i) => i);
  return z.strictObject({
    top: z
      .array(z.strictObject({ findingIndex: z.literal(indexes), why: text(WHY_MAX) }))
      .min(1)
      .max(MAX_TOP),
    verdict: text(VERDICT_MAX),
  });
}

const OUTPUT_SCHEMAS: {
  readonly [F in AiFeature]: (input: FeatureInput[F]) => z.ZodType<FeatureOutput[F]>;
} = {
  brief: () => BriefOutputSchema,
  refine: () => RefineOutputSchema,
  vibe: vibeOutputSchema,
  rationale: () => RationaleOutputSchema,
  critique: critiqueOutputSchema,
};

/** R4-10's options, so the prompt's schema and the checked one cannot drift. */
const JSON_SCHEMA_OPTIONS = {
  target: "draft-07",
  unrepresentable: "throw",
  io: "output",
  reused: "inline",
  cycles: "throw",
} as const;

function assertFeature(feature: unknown, caller: string): asserts feature is AiFeature {
  assertOneOf(feature, AI_FEATURES, `${caller}: feature`);
}

/** The input, checked against its feature's input schema (a RangeError naming `caller`). */
function checkedInput<F extends AiFeature>(
  feature: F,
  input: unknown,
  caller: string,
): FeatureInput[F] {
  const result = INPUT_SCHEMAS[feature].safeParse(input);
  if (!result.success) {
    throw new RangeError(
      `${caller}: input is not a ${feature} input (${result.error.issues[0]?.message})`,
    );
  }
  return result.data;
}

/** The schema of a feature's input. */
export function inputSchema<F extends AiFeature>(feature: F): z.ZodType<FeatureInput[F]> {
  assertFeature(feature, "inputSchema");
  return INPUT_SCHEMAS[feature];
}

/** The closed schema of a feature's output for this input (the vibe's ids, the critique's indexes). */
export function outputSchema<F extends AiFeature>(
  feature: F,
  input: FeatureInput[F],
): z.ZodType<FeatureOutput[F]> {
  assertFeature(feature, "outputSchema");
  const build: (input: FeatureInput[F]) => z.ZodType<FeatureOutput[F]> = OUTPUT_SCHEMAS[feature];
  return build(checkedInput(feature, input, "outputSchema"));
}

/** The output schema as draft-07 JSON Schema, without `$schema` (R4-10). */
export function outputJsonSchema<F extends AiFeature>(
  feature: F,
  input: FeatureInput[F],
): Record<string, unknown> {
  assertFeature(feature, "outputJsonSchema");
  const build: (input: FeatureInput[F]) => z.ZodType<FeatureOutput[F]> = OUTPUT_SCHEMAS[feature];
  const schema = build(checkedInput(feature, input, "outputJsonSchema"));
  const { $schema: _, ...json } = z.toJSONSchema(schema, JSON_SCHEMA_OPTIONS);
  return json;
}

type Kind = "schema" | "range";
type Parsed<F extends AiFeature> =
  | { readonly ok: true; readonly output: FeatureOutput[F] }
  | { readonly ok: false; readonly kind: Kind };

/**
 * R4-38 (1): a value outside its list or a number outside its bounds is `range`, except an unknown
 * refine op, which is `schema` (decision G4); every other issue is `schema`, and any `schema` wins.
 * zod reports a missing key or a value of another type than the list's under an enum as a value
 * outside the list; R4-38 names both `schema` (a missing key, a wrong type), so they stay `schema`.
 */
function issueKind(feature: AiFeature, issue: z.core.$ZodIssue, root: unknown): Kind {
  if (issue.code === "invalid_value") {
    const isOp = feature === "refine" && issue.path.length === 3 && issue.path[2] === "op";
    const value = valueAt(root, issue.path);
    const listed = issue.values.some((allowed) => typeof allowed === typeof value);
    return isOp || !listed ? "schema" : "range";
  }
  if (issue.code === "too_big" || issue.code === "too_small") {
    return issue.origin === "number" ? "range" : "schema";
  }
  return "schema";
}

const distinct = (values: readonly unknown[]) => new Set(values).size === values.length;

/**
 * R4-38 (2), per feature: the structural rules of 5.2's types. A brief holds at least one parameter
 * field and no empty `hues`; each refine op carries exactly its own fields; the vibe's roles and mood
 * tags and the critique's finding indexes are distinct.
 */
const STRUCTURE: { readonly [F in AiFeature]: (output: FeatureOutput[F]) => boolean } = {
  brief: ({ name: _name, oneLiner: _oneLiner, adjectives: _adjectives, ...fields }) =>
    Object.keys(fields).length > 0 &&
    (fields.hues === undefined || Object.keys(fields.hues).length > 0),
  refine: ({ ops }) =>
    ops.every((op) => {
      const own = OP_FIELDS[op.op];
      const fields = Object.keys(op).filter((key) => key !== "op");
      return fields.length === own.length && own.every((field) => fields.includes(field));
    }),
  vibe: ({ roleMap, moodTags }) => distinct(Object.values(roleMap)) && distinct(moodTags),
  rationale: () => true,
  critique: ({ top }) => distinct(top.map((entry) => entry.findingIndex)),
};

/** Every string of a list through `cleanModelText`, or null when one fails. */
function cleanAll(list: readonly string[], max: number): string[] | null {
  const cleaned = list.map((item) => cleanModelText(item, max));
  return cleaned.every((item): item is string => item !== null) ? cleaned : null;
}

/** R4-38 (3), per feature: the output with every model string cleaned, or null for `range`. */
const VALUE_CHECKS: {
  readonly [F in AiFeature]: (
    input: FeatureInput[F],
    output: FeatureOutput[F],
  ) => FeatureOutput[F] | null;
} = {
  brief: (_, output) => {
    const name = cleanModelText(output.name, NAME_MAX);
    const oneLiner =
      output.oneLiner === undefined ? undefined : cleanModelText(output.oneLiner, ONE_LINER_MAX);
    const adjectives =
      output.adjectives === undefined ? undefined : cleanAll(output.adjectives, ADJECTIVE_MAX);
    if (name === null || oneLiner === null || adjectives === null) return null;
    return {
      ...output,
      name,
      ...(oneLiner === undefined ? {} : { oneLiner }),
      ...(adjectives === undefined ? {} : { adjectives }),
    };
  },
  // A shiftHue must name a slot whose hue in the input is not null (section 8.2).
  refine: (input, output) => {
    const summary = cleanModelText(output.summary, SUMMARY_MAX);
    const hues: Readonly<Record<string, HueOrNull>> = input.current.hues;
    const held = output.ops.every((op) => op.op !== "shiftHue" || hues[op.slot ?? ""] != null);
    return summary === null || !held ? null : { ...output, summary };
  },
  vibe: (_, output) => output,
  rationale: (_, output) => {
    const oneLiner = cleanModelText(output.oneLiner, ONE_LINER_MAX);
    const thesis = cleanModelText(output.thesis, THESIS_MAX);
    const dos = cleanAll(output.do, RULE_MAX);
    const donts = cleanAll(output.dont, RULE_MAX);
    if (oneLiner === null || thesis === null || dos === null || donts === null) return null;
    return { oneLiner, thesis, do: dos, dont: donts };
  },
  critique: (_, output) => {
    const verdict = cleanModelText(output.verdict, VERDICT_MAX);
    const whys = cleanAll(
      output.top.map((entry) => entry.why),
      WHY_MAX,
    );
    if (verdict === null || whys === null) return null;
    return { top: output.top.map((entry, i) => ({ ...entry, why: whys[i] })), verdict };
  },
};

/**
 * The one check of every provider's output (R4-38): zod, then the structural rules, then the value
 * checks. It returns the output with its strings cleaned, or the failure's kind; it throws only for
 * a feature outside `AI_FEATURES` or an input its schema rejects.
 */
export function parseOutput<F extends AiFeature>(
  feature: F,
  input: FeatureInput[F],
  value: unknown,
): Parsed<F> {
  assertFeature(feature, "parseOutput");
  const held = checkedInput(feature, input, "parseOutput");
  const build: (input: FeatureInput[F]) => z.ZodType<FeatureOutput[F]> = OUTPUT_SCHEMAS[feature];
  const result = build(held).safeParse(value);
  if (!result.success) {
    const kinds = result.error.issues.map((issue) => issueKind(feature, issue, value));
    return { ok: false, kind: kinds.includes("schema") ? "schema" : "range" };
  }
  const holds: (output: FeatureOutput[F]) => boolean = STRUCTURE[feature];
  if (!holds(result.data)) return { ok: false, kind: "schema" };
  const check: (input: FeatureInput[F], output: FeatureOutput[F]) => FeatureOutput[F] | null =
    VALUE_CHECKS[feature];
  const output = check(held, result.data);
  return output === null ? { ok: false, kind: "range" } : { ok: true, output };
}
