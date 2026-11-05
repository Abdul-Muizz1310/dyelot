import { describe, expect, it } from "vitest";
import { MOOD_TAGS, TYPE_VIBES } from "@/ai/apply";
import {
  AI_FEATURES,
  type AiFeature,
  type FeatureInput,
  inputSchema,
  outputJsonSchema,
  outputSchema,
} from "@/ai/features";
import { vibeInput } from "@/ai/inputs";
import {
  CHROMA_LEVELS,
  CONTRAST_LEVELS,
  DEPTH_STYLES,
  HARMONIES,
  imagePalette,
  LOCKABLE,
  MOTION_FEELS,
  NEUTRAL_TINTS,
  PAIRING_IDS,
  PRESET_IDS,
  RADIUS_SET_NAMES,
  TYPE_CONTEXTS,
} from "@/engine";
import { z } from "@/spec/zod";
import {
  BRIEF_IN,
  CRITIQUE_IN,
  FOUR_COLORS,
  RATIONALE_IN,
  REFINE_IN,
  TINY_JPEG_DATA_URL,
  VIBE_IN,
} from "./fixtures";

// C-AI-01 to C-AI-03 of docs/specs/04-ai.md, section 14.2: the features, their input schemas and the
// JSON Schema of each output (R4-10, R4-15, R4-39, R4-45, R4-48 to R4-50, R4-62 probe 7).

const INPUTS: { readonly [F in AiFeature]: FeatureInput[F] } = {
  brief: BRIEF_IN,
  refine: REFINE_IN,
  vibe: VIBE_IN,
  rationale: RATIONALE_IN,
  critique: CRITIQUE_IN,
};

/** A deep copy of a fixture, to change one field of it. */
function copy<T>(value: T): T {
  return structuredClone(value);
}

/** A deep copy of `value` with the field at `at` set to `next`. */
function withAt(value: unknown, at: readonly (string | number)[], next: unknown): unknown {
  const root = copy(value) as Record<string | number, unknown>;
  let node = root;
  for (const key of at.slice(0, -1)) node = node[key] as Record<string | number, unknown>;
  node[at[at.length - 1] as string | number] = next;
  return root;
}

const accepts = (feature: AiFeature, value: unknown) =>
  inputSchema(feature).safeParse(value).success;

/** VIBE_IN with `n` clusters, numbered c1 to cN. */
function vibeWith(n: number): Record<string, unknown> {
  const clusters = Array.from({ length: n }, (_, i) => ({
    id: `c${i + 1}`,
    l: 0.5,
    c: 0.1,
    h: 30 * i,
    share: 0.1,
  }));
  return { ...copy(VIBE_IN), clusters };
}

/** A critique input of `n` findings. */
function findings(n: number): Record<string, unknown> {
  const one = CRITIQUE_IN.findings[0];
  return { findings: Array.from({ length: n }, () => ({ ...one })) };
}

describe("C-AI-01 the five features", () => {
  it("C-AI-01 AI_FEATURES is brief, refine, vibe, rationale and critique, frozen", () => {
    expect(AI_FEATURES).toEqual(["brief", "refine", "vibe", "rationale", "critique"]);
    expect(Object.isFrozen(AI_FEATURES)).toBe(true);
  });
});

describe("C-AI-02 the input schemas", () => {
  it.each(AI_FEATURES)("C-AI-02 accepts the %s fixture", (feature) => {
    expect(accepts(feature, INPUTS[feature])).toBe(true);
  });

  it.each([
    ["brief", ["extra"]],
    ["brief", ["locked", "extra"]],
    ["refine", ["extra"]],
    ["refine", ["current", "extra"]],
    ["refine", ["current", "hues", "extra"]],
    ["vibe", ["extra"]],
    ["vibe", ["clusters", 0, "extra"]],
    ["vibe", ["image", "extra"]],
    ["rationale", ["extra"]],
    ["rationale", ["families", "extra"]],
    ["rationale", ["checks", 0, "extra"]],
    ["rationale", ["lint", "extra"]],
    ["critique", ["extra"]],
    ["critique", ["findings", 0, "source"]],
  ] as const)("C-AI-02 rejects an unknown key at any depth of %s: %j", (feature, at) => {
    expect(accepts(feature, withAt(INPUTS[feature], at, "x"))).toBe(false);
  });

  it.each([
    ["", false],
    ["a".repeat(501), false],
    [" a", false],
    ["a\u0000b", false],
    ["a", true],
    ["a".repeat(500), true],
  ])("C-AI-02 a brief of %j is accepted: %s", (brief, ok) => {
    expect(accepts("brief", { brief, locked: {} })).toBe(ok);
  });

  it.each([
    [{ primary: 0, secondary: 359, accent: null }, true],
    [{ primary: 360 }, false],
    [{ primary: -1 }, false],
    [{ primary: 12.5 }, false],
    [{ primary: "12" }, false],
  ])("C-AI-02 a locked set %j is accepted: %s", (locked, ok) => {
    expect(accepts("brief", { brief: "calm", locked })).toBe(ok);
  });

  it("C-AI-02 rejects a refine text of 201 characters and accepts 200", () => {
    expect(accepts("refine", { ...copy(REFINE_IN), text: "a".repeat(201) })).toBe(false);
    expect(accepts("refine", { ...copy(REFINE_IN), text: "a".repeat(200) })).toBe(true);
    expect(accepts("refine", { ...copy(REFINE_IN), text: "" })).toBe(false);
  });

  it("C-AI-02 rejects a refine summary of a pairing outside the list, and takes auto", () => {
    expect(accepts("refine", withAt(REFINE_IN, ["current", "pairing"], "auto"))).toBe(true);
    expect(accepts("refine", withAt(REFINE_IN, ["current", "pairing"], "comic-sans"))).toBe(false);
  });

  it("C-AI-02 rejects a vibe with 0 or 9 clusters and takes 1 and 8", () => {
    expect(accepts("vibe", vibeWith(0))).toBe(false);
    expect(accepts("vibe", vibeWith(9))).toBe(false);
    expect(accepts("vibe", vibeWith(1))).toBe(true);
    expect(accepts("vibe", vibeWith(8))).toBe(true);
  });

  it("C-AI-02 rejects vibe cluster ids out of order or misnamed", () => {
    const swapped = vibeWith(3) as { clusters: { id: string }[] };
    swapped.clusters[0].id = "c2";
    swapped.clusters[1].id = "c1";
    expect(accepts("vibe", swapped)).toBe(false);
    const skipped = vibeWith(2) as { clusters: { id: string }[] };
    skipped.clusters[1].id = "c3";
    expect(accepts("vibe", skipped)).toBe(false);
  });

  it.each([
    ["l", 1.0001],
    ["l", 0.1234],
    ["c", -0.001],
    ["c", 0.1234],
    ["h", 360],
    ["h", 12.5],
    ["share", 0],
    ["share", 1.001],
    ["share", 0.0005],
  ])("C-AI-02 rejects a vibe cluster with %s %d", (key, value) => {
    const input = vibeWith(1) as { clusters: Record<string, unknown>[] };
    input.clusters[0][key] = value;
    expect(accepts("vibe", input)).toBe(false);
  });

  it("C-AI-02 rejects a data URL of image/png, of 1,400,001 characters or not base64", () => {
    const withUrl = (dataUrl: string) => ({
      ...copy(VIBE_IN),
      image: { ...VIBE_IN.image, dataUrl },
    });
    const prefix = "data:image/jpeg;base64,";
    expect(accepts("vibe", withUrl(TINY_JPEG_DATA_URL.replace("jpeg", "png")))).toBe(false);
    expect(accepts("vibe", withUrl(prefix + "A".repeat(1_400_001 - prefix.length)))).toBe(false);
    expect(accepts("vibe", withUrl(prefix + "A".repeat(1_400_000 - prefix.length)))).toBe(true);
    expect(accepts("vibe", withUrl("data:image/jpeg;base64,@@@"))).toBe(false);
    expect(accepts("vibe", withUrl("data:image/jpeg;base64,"))).toBe(false);
    expect(accepts("vibe", withUrl("data:image/jpeg;base64,QUJD==="))).toBe(false);
  });

  it("C-AI-02 rejects a width or height of 769 or 0 and takes 768", () => {
    const withSize = (width: number, height: number) => ({
      ...copy(VIBE_IN),
      image: { ...VIBE_IN.image, width, height },
    });
    expect(accepts("vibe", withSize(769, 2))).toBe(false);
    expect(accepts("vibe", withSize(2, 769))).toBe(false);
    expect(accepts("vibe", withSize(0, 2))).toBe(false);
    expect(accepts("vibe", withSize(1.5, 2))).toBe(false);
    expect(accepts("vibe", withSize(768, 768))).toBe(true);
  });

  it("C-AI-02 rejects 0 or 41 findings and takes 1 and 40", () => {
    expect(accepts("critique", findings(0))).toBe(false);
    expect(accepts("critique", findings(41))).toBe(false);
    expect(accepts("critique", findings(1))).toBe(true);
    expect(accepts("critique", findings(40))).toBe(true);
  });

  it("C-AI-02 rejects a finding with a rule, severity or mode outside the lists", () => {
    for (const [key, value] of [
      ["id", "Z9"],
      ["severity", "fatal"],
      ["mode", "dim"],
      ["measured", "3"],
      ["subject", ""],
    ] as const) {
      const input = findings(1) as { findings: Record<string, unknown>[] };
      input.findings[0][key] = value;
      expect(accepts("critique", input), key).toBe(false);
    }
  });

  it("C-AI-02 rejects a rationale with 25 checks, checks out of order, a ratio of 3 decimals or a pairing that is no label", () => {
    const short = { ...RATIONALE_IN, checks: RATIONALE_IN.checks.slice(0, 25) };
    expect(accepts("rationale", short)).toBe(false);
    const [first, ...rest] = RATIONALE_IN.checks;
    expect(accepts("rationale", { ...RATIONALE_IN, checks: [...rest, first] })).toBe(false);
    expect(accepts("rationale", withAt(RATIONALE_IN, ["checks", 0, "ratio"], 4.567))).toBe(false);
    expect(accepts("rationale", withAt(RATIONALE_IN, ["checks", 0, "check"], "C2:x/y"))).toBe(
      false,
    );
    expect(accepts("rationale", withAt(RATIONALE_IN, ["pairing"], "Comic Sans with Papyrus"))).toBe(
      false,
    );
    expect(accepts("rationale", { ...RATIONALE_IN, pairing: null, preset: null })).toBe(true);
    expect(accepts("rationale", withAt(RATIONALE_IN, ["lint", "warn"], -1))).toBe(false);
    expect(accepts("rationale", withAt(RATIONALE_IN, ["name"], " untitled"))).toBe(false);
  });

  it("C-AI-02 throws for a feature outside AI_FEATURES, naming inputSchema", () => {
    expect(() => inputSchema("haiku" as AiFeature)).toThrow(RangeError);
    expect(() => inputSchema("haiku" as AiFeature)).toThrow(/^inputSchema: /);
    expect(() => inputSchema(5 as unknown as AiFeature)).toThrow(TypeError);
  });
});

/** Every node of a JSON Schema, depth first. */
function nodes(schema: unknown): Record<string, unknown>[] {
  if (typeof schema !== "object" || schema === null) return [];
  if (Array.isArray(schema)) return schema.flatMap(nodes);
  const node = schema as Record<string, unknown>;
  return [node, ...Object.values(node).flatMap(nodes)];
}

/** A JSON Schema read field by field; `toEqual` checks the leaves. */
type Json = { readonly [key: string]: Json };

/** The values a property may take: its `enum`, or its one `const`. */
function values(property: Json): unknown {
  return property.enum ?? [property.const];
}

const DEGREES = [
  ...Array.from({ length: 60 }, (_, i) => i - 60),
  ...Array.from({ length: 60 }, (_, i) => i + 1),
];
const REFINE_OPS = [
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
];

describe("C-AI-03 each output's JSON Schema", () => {
  it.each(AI_FEATURES)(
    "C-AI-03 %s: no $schema, $ref, $defs, anyOf, oneOf or allOf; every object closed",
    (feature) => {
      const schema = outputJsonSchema(feature, INPUTS[feature] as never);
      expect(schema).not.toHaveProperty("$schema");
      const all = nodes(schema);
      for (const key of ["$schema", "$ref", "$defs", "definitions", "anyOf", "oneOf", "allOf"]) {
        expect(
          all.filter((node) => key in node),
          key,
        ).toEqual([]);
      }
      const objects = all.filter((node) => node.type === "object");
      expect(objects.length).toBeGreaterThan(0);
      for (const node of objects) expect(node.additionalProperties).toBe(false);
    },
  );

  it("C-AI-03 the brief's enums are the engine's lists", () => {
    const { properties: p, required } = outputJsonSchema("brief", BRIEF_IN) as unknown as Json;
    expect(required).toEqual(["name"]);
    expect(p.chroma.enum).toEqual([...CHROMA_LEVELS]);
    expect(p.neutralTint.enum).toEqual([...NEUTRAL_TINTS]);
    expect(p.harmony.enum).toEqual([...HARMONIES]);
    expect(p.contrastLevel.enum).toEqual([...CONTRAST_LEVELS]);
    expect(p.preset.enum).toEqual([...PRESET_IDS]);
    expect(p.pairing.enum).toEqual([...PAIRING_IDS]);
    expect(p.typeContext.enum).toEqual([...TYPE_CONTEXTS]);
    expect(p.radius.enum).toEqual([...RADIUS_SET_NAMES]);
    expect(p.depth.enum).toEqual([...DEPTH_STYLES]);
    expect(p.motion.enum).toEqual([...MOTION_FEELS]);
    for (const slot of LOCKABLE) {
      expect(p.hues.properties[slot]).toEqual({ type: "integer", minimum: 0, maximum: 359 });
    }
    expect(p.name).toMatchObject({ type: "string", minLength: 1, maxLength: 40 });
    expect(p.adjectives).toMatchObject({ minItems: 1, maxItems: 5 });
  });

  it("C-AI-03 the refine op's enums are the engine's lists, auto joins the pairings, degrees one enum", () => {
    const { properties } = outputJsonSchema("refine", REFINE_IN) as unknown as Json;
    expect(properties.ops).toMatchObject({ minItems: 1, maxItems: 6 });
    const op = properties.ops.items.properties;
    expect(properties.ops.items.required).toEqual(["op"]);
    expect(op.op.enum).toEqual(REFINE_OPS);
    expect(op.slot.enum).toEqual([...LOCKABLE]);
    expect(op.degrees.enum).toEqual(DEGREES);
    expect(op.chroma.enum).toEqual([...CHROMA_LEVELS]);
    expect(op.neutralTint.enum).toEqual([...NEUTRAL_TINTS]);
    expect(op.contrastLevel.enum).toEqual([...CONTRAST_LEVELS]);
    expect(op.harmony.enum).toEqual([...HARMONIES]);
    expect(op.pairing.enum).toEqual([...PAIRING_IDS, "auto"]);
    expect(op.radius.enum).toEqual([...RADIUS_SET_NAMES]);
    expect(op.depth.enum).toEqual([...DEPTH_STYLES]);
    expect(op.motion.enum).toEqual([...MOTION_FEELS]);
    expect(op.typeContext.enum).toEqual([...TYPE_CONTEXTS]);
  });

  it("C-AI-03 the vibe's ids are the input's, and its tags, vibes and presets the lists", () => {
    const { properties: p } = outputJsonSchema("vibe", VIBE_IN) as unknown as Json;
    for (const role of ["primary", "secondary", "accent"]) {
      expect(p.roleMap.properties[role].enum).toEqual(["c1", "c2", "c3", "c4"]);
    }
    expect(p.roleMap.required).toEqual(["primary"]);
    expect(p.neutralTint.enum).toEqual([...NEUTRAL_TINTS]);
    expect(p.moodTags.items.enum).toEqual([...MOOD_TAGS]);
    expect(p.moodTags).toMatchObject({ minItems: 1, maxItems: 5 });
    expect(p.typeVibe.enum).toEqual([...TYPE_VIBES]);
    expect(p.preset.enum).toEqual([...PRESET_IDS]);
  });

  it("C-AI-03 the vibe's ids follow an input of one cluster", () => {
    const one = vibeInput(imagePalette([FOUR_COLORS[0]]), VIBE_IN.image);
    const { properties: p } = outputJsonSchema("vibe", one) as unknown as Json;
    expect(values(p.roleMap.properties.primary)).toEqual(["c1"]);
  });

  it.each([1, 4, 40])("C-AI-03 the critique's indexes are 0 to n − 1 for n = %i", (n) => {
    const input = findings(n) as FeatureInput["critique"];
    const { properties: p } = outputJsonSchema("critique", input) as unknown as Json;
    expect(values(p.top.items.properties.findingIndex)).toEqual(
      Array.from({ length: n }, (_, i) => i),
    );
    expect(p.top).toMatchObject({ minItems: 1, maxItems: 3 });
  });

  it("C-AI-03 the rationale's lists hold 1 to 6 entries of 1 to 160", () => {
    const { properties: p } = outputJsonSchema("rationale", RATIONALE_IN) as unknown as Json;
    for (const key of ["do", "dont"]) {
      expect(p[key]).toMatchObject({ minItems: 1, maxItems: 6 });
      expect(p[key].items).toMatchObject({ type: "string", minLength: 1, maxLength: 160 });
    }
    expect(p.thesis).toMatchObject({ minLength: 1, maxLength: 280 });
  });

  it("C-AI-03 outputSchema is the schema outputJsonSchema converts, with R4-10's options", () => {
    const options = {
      target: "draft-07",
      unrepresentable: "throw",
      io: "output",
      reused: "inline",
      cycles: "throw",
    } as const;
    for (const feature of AI_FEATURES) {
      const input = INPUTS[feature] as never;
      const { $schema, ...converted } = z.toJSONSchema(outputSchema(feature, input), options);
      expect($schema, feature).toBe("http://json-schema.org/draft-07/schema#");
      expect(outputJsonSchema(feature, input), feature).toEqual(converted);
    }
  });

  it("C-AI-03 throws for a feature outside the list or an input its schema rejects", () => {
    expect(() => outputJsonSchema("haiku" as AiFeature, BRIEF_IN as never)).toThrow(
      /^outputJsonSchema: /,
    );
    expect(() => outputSchema("haiku" as AiFeature, BRIEF_IN as never)).toThrow(RangeError);
    expect(() => outputSchema(null as unknown as AiFeature, BRIEF_IN as never)).toThrow(TypeError);
    expect(() => outputSchema("vibe", BRIEF_IN as never)).toThrow(RangeError);
    expect(() => outputSchema("vibe", BRIEF_IN as never)).toThrow(/^outputSchema: input/);
    expect(() => outputJsonSchema("critique", { findings: [] })).toThrow(RangeError);
  });
});
