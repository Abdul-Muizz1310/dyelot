import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  briefChange,
  imageChange,
  MOOD_TAGS,
  rationaleChange,
  refineChange,
  TYPE_VIBES,
  vibeChange,
} from "@/ai/apply";
import {
  type AiFeature,
  type BriefOutput,
  type CritiqueOutput,
  type FeatureInput,
  type FeatureOutput,
  parseOutput,
  type RationaleOutput,
  type RefineOp,
  type RefineOutput,
  type VibeOutput,
} from "@/ai/features";
import { refineInput, vibeInput } from "@/ai/inputs";
import {
  applyPreset,
  CHROMA_LEVELS,
  CONTRAST_LEVELS,
  DEPTH_STYLES,
  type DirectionParams,
  generateSystem,
  HARMONIES,
  imagePalette,
  LOCKABLE,
  type Lockable,
  MOTION_FEELS,
  NEUTRAL_TINTS,
  normalizeSeed,
  type Oklch,
  PAIRING_IDS,
  PRESET_IDS,
  type PresetId,
  RADIUS_SET_NAMES,
  type RawCluster,
  TYPE_CONTEXTS,
} from "@/engine";
import { mergeParams } from "@/features/studio/params";
import { anyDirection, anySeedColor, PROPERTY_TIMEOUT } from "../spec/support";
import { BRIEF_IN, CRITIQUE_IN, RATIONALE_IN, TINY_JPEG_DATA_URL } from "./fixtures";

// C-IMG-14 of docs/specs/04-ai.md, section 14.6 (R4-38, I-M4-07): for random outputs of each
// feature that pass `parseOutput`, and random valid parameters, the feature's change, applied as the
// store's `applyAi` applies it (the preset by `applyPreset`, then the patch by `mergeParams`),
// generates without a throw. Critique has no change (R4-50): its runs check that the held design
// still generates. 300 runs in all, 60 per feature.

const RUNS = 60;
const SEED = 4006;
const DESIGN_SEED = "seed-4006";
/** The fields `applyAi` accepts (store.ts): any other is a RangeError. */
const AI_CHANGE_FIELDS: readonly string[] = ["preset", "patch", "density", "createdWith"];

/** Words a model might write, accents and other scripts among them, with no color or score name. */
const WORDS = [
  "calm",
  "exact",
  "tea",
  "house",
  "dusk",
  "Quiet",
  "río",
  "東京",
  "naïve",
  "stone",
  "Keep",
  "body",
  "text",
  "at",
  "16",
  "px",
  "or",
  "more",
  "light",
  "it's",
];

/** Plain text of at most `max` characters, as the spec stores it. */
const plain = (max: number): fc.Arbitrary<string> =>
  fc
    .array(fc.constantFrom(...WORDS), { minLength: 1, maxLength: 6 })
    .map((words) => words.join(" ").slice(0, max).trim());

/** Raw model text of at most `max` characters: padding and runs of white space that `parseOutput` cleans. */
const prose = (max: number): fc.Arbitrary<string> =>
  fc
    .tuple(
      fc.constantFrom("", " ", "\t", "\n "),
      fc.array(fc.constantFrom(...WORDS), { minLength: 1, maxLength: 12 }),
      fc.constantFrom(" ", "  ", "\n"),
      fc.constantFrom("", " ", "\r\n"),
    )
    .map(([head, words, gap, tail]) => `${head}${words.join(gap)}${tail}`.slice(0, max));

const hue = fc.integer({ min: 0, max: 359 });

/** Valid held parameters: any of `anyDirection`, with an optional pairing and direction. */
const params: fc.Arbitrary<DirectionParams> = fc
  .tuple(
    anyDirection,
    fc.option(fc.constantFrom(...PAIRING_IDS), { nil: undefined }),
    fc.option(
      fc
        .record(
          {
            thesis: plain(280),
            adjectives: fc.array(plain(24), { minLength: 1, maxLength: 5 }),
            like: fc.array(plain(80), { minLength: 1, maxLength: 5 }),
          },
          { requiredKeys: [] },
        )
        .filter((direction) => Object.keys(direction).length > 0),
      { nil: undefined },
    ),
  )
  .map(([held, pairing, direction]) => ({
    ...held,
    ...(pairing === undefined ? {} : { pairing }),
    ...(direction === undefined ? {} : { direction }),
  }));

/** What applying `change` as `applyAi` does: its fields checked, the preset, then the patch. */
function applied(
  held: DirectionParams,
  change: { readonly preset?: PresetId; readonly patch: Parameters<typeof mergeParams>[1] },
): DirectionParams {
  for (const field of Object.keys(change)) expect(AI_CHANGE_FIELDS).toContain(field);
  const base = change.preset === undefined ? held : applyPreset(held, change.preset);
  return mergeParams(base, change.patch);
}

/** The output `parseOutput` returns for a generated one, which must pass. */
function accepted<F extends AiFeature>(
  feature: F,
  input: FeatureInput[F],
  output: unknown,
): FeatureOutput[F] {
  const result = parseOutput(feature, input, output);
  if (!result.ok) throw new Error(`${feature} output rejected as ${result.kind}`);
  return result.output;
}

const generates = (design: DirectionParams) => {
  expect(() => generateSystem(design, DESIGN_SEED)).not.toThrow();
};

const briefOutput: fc.Arbitrary<BriefOutput> = fc
  .record(
    {
      name: prose(40),
      oneLiner: prose(140),
      adjectives: fc.array(prose(24), { minLength: 1, maxLength: 5 }),
      hues: fc
        .record({ primary: hue, secondary: hue, accent: hue }, { requiredKeys: [] })
        .filter((hues) => Object.keys(hues).length > 0),
      chroma: fc.constantFrom(...CHROMA_LEVELS),
      neutralTint: fc.constantFrom(...NEUTRAL_TINTS),
      harmony: fc.constantFrom(...HARMONIES),
      contrastLevel: fc.constantFrom(...CONTRAST_LEVELS),
      preset: fc.constantFrom(...PRESET_IDS),
      pairing: fc.constantFrom(...PAIRING_IDS),
      typeContext: fc.constantFrom(...TYPE_CONTEXTS),
      radius: fc.constantFrom(...RADIUS_SET_NAMES),
      depth: fc.constantFrom(...DEPTH_STYLES),
      motion: fc.constantFrom(...MOTION_FEELS),
    },
    { requiredKeys: ["name"] },
  )
  .filter((output) =>
    Object.keys(output).some((key) => !["name", "oneLiner", "adjectives"].includes(key)),
  );

/** The nine ops that set a field; `shiftHue` is added per case, for the slots with a hue. */
const SET_OPS: readonly fc.Arbitrary<RefineOp>[] = [
  fc.record({ op: fc.constant("setChroma" as const), chroma: fc.constantFrom(...CHROMA_LEVELS) }),
  fc.record({
    op: fc.constant("setNeutralTint" as const),
    neutralTint: fc.constantFrom(...NEUTRAL_TINTS),
  }),
  fc.record({
    op: fc.constant("setContrast" as const),
    contrastLevel: fc.constantFrom(...CONTRAST_LEVELS),
  }),
  fc.record({ op: fc.constant("setHarmony" as const), harmony: fc.constantFrom(...HARMONIES) }),
  fc.record({
    op: fc.constant("setPairing" as const),
    pairing: fc.constantFrom(...PAIRING_IDS, "auto" as const),
  }),
  fc.record({
    op: fc.constant("setRadius" as const),
    radius: fc.constantFrom(...RADIUS_SET_NAMES),
  }),
  fc.record({ op: fc.constant("setDepth" as const), depth: fc.constantFrom(...DEPTH_STYLES) }),
  fc.record({ op: fc.constant("setMotion" as const), motion: fc.constantFrom(...MOTION_FEELS) }),
  fc.record({
    op: fc.constant("setTypeContext" as const),
    typeContext: fc.constantFrom(...TYPE_CONTEXTS),
  }),
];

const degrees = fc.oneof(fc.integer({ min: -60, max: -1 }), fc.integer({ min: 1, max: 60 }));

type RefineCase = {
  readonly held: DirectionParams;
  readonly seeds: Readonly<Record<Lockable, Oklch>>;
  readonly input: FeatureInput["refine"];
  readonly output: RefineOutput;
};

/** Held parameters, each slot's held seed (the locked one, else any), its input and an output. */
const refineCase: fc.Arbitrary<RefineCase> = fc
  .tuple(params, anySeedColor, anySeedColor, anySeedColor)
  .chain(([held, ...others]) => {
    const seeds = Object.fromEntries(
      LOCKABLE.map((slot, i) => [slot, normalizeSeed(held[slot] ?? (others[i] as Oklch))]),
    ) as Record<Lockable, Oklch>;
    const input = refineInput("warmer and rounder", held, seeds);
    const open = LOCKABLE.filter((slot) => input.current.hues[slot] !== null);
    const shift: fc.Arbitrary<RefineOp>[] =
      open.length === 0
        ? []
        : [
            fc.record({
              op: fc.constant("shiftHue" as const),
              slot: fc.constantFrom(...open),
              degrees,
            }),
          ];
    return fc
      .record({
        ops: fc.array(fc.oneof(...SET_OPS, ...shift), { minLength: 1, maxLength: 6 }),
        summary: prose(140),
      })
      .map((output) => ({ held, seeds, input, output }));
  });

const hex = fc.integer({ min: 0, max: 0xffffff }).map((n) => `#${n.toString(16).padStart(6, "0")}`);

/** 1 to 8 clusters whose shares sum to 1, as the worker reports them. */
const rawClusters: fc.Arbitrary<readonly RawCluster[]> = fc
  .array(fc.tuple(hex, fc.integer({ min: 1, max: 100 })), { minLength: 1, maxLength: 8 })
  .map((entries) => {
    const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
    return entries.map(([color, weight]) => ({ hex: color, share: weight / total }));
  });

type VibeCase = {
  readonly held: DirectionParams;
  readonly palette: ReturnType<typeof imagePalette>;
  readonly input: FeatureInput["vibe"];
  readonly output: VibeOutput;
};

const vibeCase: fc.Arbitrary<VibeCase> = fc.tuple(params, rawClusters).chain(([held, raw]) => {
  const palette = imagePalette(raw);
  const input = vibeInput(palette, { dataUrl: TINY_JPEG_DATA_URL, width: 2, height: 2 });
  const ids = palette.clusters.map((cluster) => cluster.id);
  const roleMap = fc
    .tuple(fc.uniqueArray(fc.constantFrom(...ids), { minLength: 1, maxLength: 3 }), fc.boolean())
    .map(([[primary, second, third], skipSecondary]): VibeOutput["roleMap"] => {
      if (second === undefined) return { primary: primary as string };
      if (third === undefined) {
        return skipSecondary
          ? { primary: primary as string, accent: second }
          : { primary: primary as string, secondary: second };
      }
      return { primary: primary as string, secondary: second, accent: third };
    });
  return fc
    .record({
      roleMap,
      neutralTint: fc.constantFrom(...NEUTRAL_TINTS),
      moodTags: fc.uniqueArray(fc.constantFrom(...MOOD_TAGS), { minLength: 1, maxLength: 5 }),
      typeVibe: fc.constantFrom(...TYPE_VIBES),
      preset: fc.constantFrom(...PRESET_IDS),
    })
    .map((output) => ({ held, palette, input, output }));
});

const rules = fc.array(prose(160), { minLength: 1, maxLength: 6 });
const rationaleOutput: fc.Arbitrary<RationaleOutput> = fc.record({
  oneLiner: prose(140),
  thesis: prose(280),
  do: rules,
  dont: rules,
});

const findings = CRITIQUE_IN.findings.length;
const critiqueOutput: fc.Arbitrary<CritiqueOutput> = fc.record({
  top: fc.uniqueArray(
    fc.record({ findingIndex: fc.integer({ min: 0, max: findings - 1 }), why: prose(200) }),
    { minLength: 1, maxLength: Math.min(3, findings), selector: (entry) => entry.findingIndex },
  ),
  verdict: prose(200),
});

describe("C-IMG-14 every accepted output applies (I-M4-07)", () => {
  it(
    "C-IMG-14 brief: briefChange of any accepted output, with literals, generates",
    () => {
      fc.assert(
        fc.property(
          briefOutput,
          params,
          fc.array(anySeedColor, { maxLength: 3 }),
          (output, held, literals) => {
            const draft = accepted("brief", BRIEF_IN, output);
            generates(applied(held, briefChange(draft, { params: held, literals })));
          },
        ),
        { numRuns: RUNS, seed: SEED },
      );
    },
    PROPERTY_TIMEOUT,
  );

  it(
    "C-IMG-14 refine: refineChange of any accepted output, on the seeds its input names, generates",
    () => {
      fc.assert(
        fc.property(refineCase, ({ held, seeds, input, output }) => {
          const change = refineChange(accepted("refine", input, output), { params: held, seeds });
          expect(change).not.toBeNull();
          if (change !== null) generates(applied(held, change));
        }),
        { numRuns: RUNS, seed: SEED },
      );
    },
    PROPERTY_TIMEOUT,
  );

  it(
    "C-IMG-14 vibe: vibeChange of any accepted output over a random palette generates, and so does imageChange",
    () => {
      fc.assert(
        fc.property(vibeCase, ({ held, palette, input, output }) => {
          const parsed = accepted("vibe", input, output);
          generates(applied(held, vibeChange(parsed, { params: held, palette })));
          generates(applied(held, imageChange(palette)));
        }),
        { numRuns: RUNS, seed: SEED },
      );
    },
    PROPERTY_TIMEOUT,
  );

  it(
    "C-IMG-14 rationale: rationaleChange of any accepted output generates",
    () => {
      fc.assert(
        fc.property(rationaleOutput, params, (output, held) => {
          const parsed = accepted("rationale", RATIONALE_IN, output);
          generates(applied(held, rationaleChange(parsed, held)));
        }),
        { numRuns: RUNS, seed: SEED },
      );
    },
    PROPERTY_TIMEOUT,
  );

  it(
    "C-IMG-14 critique: an accepted output changes nothing, and the held design still generates",
    () => {
      fc.assert(
        fc.property(critiqueOutput, params, (output, held) => {
          accepted("critique", CRITIQUE_IN, output);
          generates(held);
        }),
        { numRuns: RUNS, seed: SEED },
      );
    },
    PROPERTY_TIMEOUT,
  );
});
