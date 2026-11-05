import { describe, expect, it } from "vitest";
import { type AiFeature, type FeatureInput, parseOutput } from "@/ai/features";
import { cleanModelText } from "@/ai/prose";
import {
  BRIEF_IN,
  BRIEF_OUT,
  CRITIQUE_IN,
  CRITIQUE_OUT,
  RATIONALE_IN,
  RATIONALE_OUT,
  REFINE_IN,
  REFINE_OUT,
  VIBE_IN,
  VIBE_OUT,
} from "./fixtures";

// C-AI-04 to C-AI-06 of docs/specs/04-ai.md, section 14.2: the one check every provider's output
// passes (R4-38), its order (zod, the structural rules, the value checks) and its two kinds.

const INPUTS: { readonly [F in AiFeature]: FeatureInput[F] } = {
  brief: BRIEF_IN,
  refine: REFINE_IN,
  vibe: VIBE_IN,
  rationale: RATIONALE_IN,
  critique: CRITIQUE_IN,
};

const OUTPUTS: { readonly [F in AiFeature]: unknown } = {
  brief: BRIEF_OUT,
  refine: REFINE_OUT,
  vibe: VIBE_OUT,
  rationale: RATIONALE_OUT,
  critique: CRITIQUE_OUT,
};

/** The kind `parseOutput` gives, or "ok". */
function kindOf(feature: AiFeature, value: unknown, input?: unknown): string {
  const result = parseOutput(feature, (input ?? INPUTS[feature]) as never, value);
  return result.ok ? "ok" : result.kind;
}

/** A copy of a fixture output with `patch` merged over its top level. */
const brief = (patch: Record<string, unknown>) => ({ ...structuredClone(BRIEF_OUT), ...patch });
const refine = (patch: Record<string, unknown>) => ({ ...structuredClone(REFINE_OUT), ...patch });
const vibe = (patch: Record<string, unknown>) => ({ ...structuredClone(VIBE_OUT), ...patch });
const rationale = (patch: Record<string, unknown>) => ({
  ...structuredClone(RATIONALE_OUT),
  ...patch,
});
const critique = (patch: Record<string, unknown>) => ({
  ...structuredClone(CRITIQUE_OUT),
  ...patch,
});

/** REFINE_IN with the primary slot's hue null: the design changed while the model read it. */
const GRAY_PRIMARY = {
  ...REFINE_IN,
  current: { ...REFINE_IN.current, hues: { ...REFINE_IN.current.hues, primary: null } },
};

describe("C-AI-04 parseOutput accepts the fixtures and cleans their strings", () => {
  it.each(Object.keys(OUTPUTS) as AiFeature[])("C-AI-04 accepts the %s fixture", (feature) => {
    const result = parseOutput(feature, INPUTS[feature] as never, OUTPUTS[feature]);
    expect(result).toEqual({ ok: true, output: OUTPUTS[feature] });
  });

  it('C-AI-04 returns a name "  Dusk  Tea " as "Dusk Tea"', () => {
    const result = parseOutput("brief", BRIEF_IN, brief({ name: "  Dusk  Tea " }));
    expect(result.ok && result.output.name).toBe("Dusk Tea");
  });

  it("C-AI-04 cleans every model string of every feature through toPlainText", () => {
    const messy = (text: string) => ` ${text.replace(" ", "\n\t ")}‎ `;
    const cases: [AiFeature, unknown, (output: never) => unknown, unknown][] = [
      [
        "brief",
        brief({ oneLiner: messy("A calm tea house."), adjectives: [messy("very calm")] }),
        (o: { oneLiner: string; adjectives: string[] }) => [o.oneLiner, o.adjectives],
        ["A calm tea house.", ["very calm"]],
      ],
      [
        "refine",
        refine({ summary: messy("Rounder corners.") }),
        (o: { summary: string }) => o.summary,
        "Rounder corners.",
      ],
      [
        "rationale",
        rationale({
          oneLiner: messy("A b"),
          thesis: messy("C d"),
          do: [messy("E f")],
          dont: [messy("G h")],
        }),
        (o: { oneLiner: string; thesis: string; do: string[]; dont: string[] }) => [
          o.oneLiner,
          o.thesis,
          o.do,
          o.dont,
        ],
        ["A b", "C d", ["E f"], ["G h"]],
      ],
      [
        "critique",
        critique({ top: [{ findingIndex: 1, why: messy("I j") }], verdict: messy("K l") }),
        (o: { top: { why: string }[]; verdict: string }) => [o.top[0]?.why, o.verdict],
        ["I j", "K l"],
      ],
    ];
    for (const [feature, value, read, expected] of cases) {
      const result = parseOutput(feature, INPUTS[feature] as never, value);
      expect(result.ok, feature).toBe(true);
      if (result.ok) expect(read(result.output as never), feature).toEqual(expected);
    }
  });

  it("C-AI-04 keeps a vibe whose output names fewer roles, and a refine shiftHue of a held hue", () => {
    expect(kindOf("vibe", vibe({ roleMap: { primary: "c4" } }))).toBe("ok");
    expect(
      kindOf("refine", refine({ ops: [{ op: "shiftHue", slot: "accent", degrees: -60 }] })),
    ).toBe("ok");
    expect(
      kindOf(
        "refine",
        refine({ ops: [{ op: "shiftHue", slot: "accent", degrees: 60 }] }),
        GRAY_PRIMARY,
      ),
    ).toBe("ok");
    expect(kindOf("refine", refine({ ops: [{ op: "setPairing", pairing: "auto" }] }))).toBe("ok");
  });

  it("C-AI-04 does not change the value it reads", () => {
    const value = brief({ name: "  Dusk  Tea " });
    parseOutput("brief", BRIEF_IN, value);
    expect(value.name).toBe("  Dusk  Tea ");
  });

  it("C-AI-04 throws for a feature outside the list or an input its schema rejects", () => {
    expect(() => parseOutput("haiku" as AiFeature, BRIEF_IN as never, BRIEF_OUT)).toThrow(
      RangeError,
    );
    expect(() => parseOutput(7 as unknown as AiFeature, BRIEF_IN as never, BRIEF_OUT)).toThrow(
      TypeError,
    );
    expect(() => parseOutput("brief", { brief: "", locked: {} }, BRIEF_OUT)).toThrow(
      /^parseOutput: input/,
    );
    expect(() => parseOutput("critique", VIBE_IN as never, CRITIQUE_OUT)).toThrow(RangeError);
  });
});

describe("C-AI-05 the schema failures", () => {
  it.each([
    ["brief", "no parameter field", { name: "Dusk Tea", oneLiner: "Calm.", adjectives: ["calm"] }],
    ["brief", "an unknown key", brief({ mood: "calm" })],
    ["brief", "a name of 41", brief({ name: "a".repeat(41) })],
    ["brief", "no name", { chroma: "muted" }],
    ["brief", "a hue of 12.5", brief({ hues: { primary: 12.5 } })],
    ["brief", "a hue that is a string", brief({ hues: { primary: "150" } })],
    ["brief", "hues: {}", brief({ hues: {} })],
    ["brief", "hues: {} beside another field", { name: "x", hues: {}, chroma: "muted" }],
    ["brief", "an adjective of 25", brief({ adjectives: ["a".repeat(25)] })],
    ["brief", "six adjectives", brief({ adjectives: ["a", "b", "c", "d", "e", "f"] })],
    ["brief", "no adjectives in the list", brief({ adjectives: [] })],
    ["brief", "an undefined oneLiner", brief({ oneLiner: undefined })],
    ["refine", 'an op "setDensity"', refine({ ops: [{ op: "setDensity", density: "dense" }] })],
    ["refine", "a setChroma without chroma", refine({ ops: [{ op: "setChroma" }] })],
    [
      "refine",
      "a setChroma with a slot",
      refine({ ops: [{ op: "setChroma", chroma: "vivid", slot: "primary" }] }),
    ],
    [
      "refine",
      "a shiftHue without degrees",
      refine({ ops: [{ op: "shiftHue", slot: "primary" }] }),
    ],
    [
      "refine",
      "a setPairing with a radius",
      refine({ ops: [{ op: "setPairing", pairing: "auto", radius: "round" }] }),
    ],
    ["refine", "7 ops", refine({ ops: Array(7).fill({ op: "setRadius", radius: "round" }) })],
    ["refine", "no ops", refine({ ops: [] })],
    ["refine", "a summary of 141", refine({ summary: "a".repeat(141) })],
    ["vibe", "a roleMap naming one id twice", vibe({ roleMap: { primary: "c1", accent: "c1" } })],
    ["vibe", "a repeated mood tag", vibe({ moodTags: ["calm", "calm"] })],
    ["vibe", "no mood tag", vibe({ moodTags: [] })],
    ["vibe", "a roleMap without a primary", vibe({ roleMap: { secondary: "c2" } })],
    ["vibe", "no preset", { ...structuredClone(VIBE_OUT), preset: undefined }],
    ["vibe", "a mood tag that is a number", vibe({ moodTags: [3] })],
    ["brief", "a preset that is a number", brief({ preset: 5 })],
    ["brief", "a preset of null", brief({ preset: null })],
    [
      "refine",
      "degrees that are a string",
      refine({ ops: [{ op: "shiftHue", slot: "primary", degrees: "10" }] }),
    ],
    ["rationale", "seven rules", rationale({ do: Array(7).fill("Keep it calm.") })],
    ["rationale", "a thesis of 281", rationale({ thesis: "a".repeat(281) })],
    [
      "critique",
      "a repeated critique index",
      critique({
        top: [
          { findingIndex: 0, why: "One." },
          { findingIndex: 0, why: "Two." },
        ],
      }),
    ],
    ["critique", "four entries", critique({ top: Array(4).fill({ findingIndex: 0, why: "x" }) })],
    [
      "critique",
      "an unknown key in an entry",
      critique({ top: [{ findingIndex: 0, why: "x", y: 1 }] }),
    ],
    ["brief", "null", null],
    ["brief", "a string", "Dusk Tea"],
    ["brief", "an array", [BRIEF_OUT]],
    ["critique", "an array", []],
    [
      "brief",
      "an unknown key together with an out-of-list preset",
      brief({ mood: "calm", preset: "vaporwave" }),
    ],
  ] as const)("C-AI-05 %s: %s is schema", (feature, _, value) => {
    expect(kindOf(feature, value)).toBe("schema");
  });
});

describe("C-AI-06 the range failures", () => {
  it.each([
    ["brief", "a hue of 360", brief({ hues: { primary: 360 } })],
    ["brief", "a hue of -1", brief({ hues: { secondary: -1 } })],
    ["brief", 'a preset "vaporwave"', brief({ preset: "vaporwave" })],
    ["brief", "a pairing auto", brief({ pairing: "auto" })],
    [
      "refine",
      "a shiftHue of 61 degrees",
      refine({ ops: [{ op: "shiftHue", slot: "primary", degrees: 61 }] }),
    ],
    [
      "refine",
      "a shiftHue of 0 degrees",
      refine({ ops: [{ op: "shiftHue", slot: "primary", degrees: 0 }] }),
    ],
    [
      "refine",
      "a shiftHue of 2.5 degrees",
      refine({ ops: [{ op: "shiftHue", slot: "primary", degrees: 2.5 }] }),
    ],
    ["refine", "a radius outside the list", refine({ ops: [{ op: "setRadius", radius: "pill" }] })],
    ["vibe", 'a roleMap id "c9" with 4 clusters', vibe({ roleMap: { primary: "c9" } })],
    [
      "vibe",
      'a roleMap id "c5" with 4 clusters',
      vibe({ roleMap: { primary: "c1", accent: "c5" } }),
    ],
    ["vibe", "a mood tag outside the list", vibe({ moodTags: ["spooky"] })],
    ["critique", "a critique index equal to n", critique({ top: [{ findingIndex: 4, why: "x" }] })],
  ] as const)("C-AI-06 %s: %s is range", (feature, _, value) => {
    expect(kindOf(feature, value)).toBe("range");
  });

  it.each([
    "#3a6ea5",
    "#fff",
    "#3a6ea5cc",
    "#FFFA",
    "oklch(0.6 0.1 250)",
    "RGB(1 2 3)",
    "rgba(0, 0, 0, 0.5)",
    "Hsl(10 20% 30%)",
    "hsla(1, 2%, 3%)",
    "hwb(1 2% 3%)",
    "lab(50 10 10)",
    "lch(50 10 10)",
    "oklab(0.5 0.1 0.1)",
    "color(display-p3 1 0 0)",
    "APCA",
    "apca",
    "the Apca score",
  ])("C-AI-06 a model string holding %j is range, in every prose field", (text) => {
    const prose = `Warm ${text} tones.`;
    const values: [AiFeature, unknown][] = [
      ["brief", brief({ name: "Tea", oneLiner: prose })],
      ["brief", brief({ adjectives: ["calm", prose.slice(0, 24)] })],
      ["refine", refine({ summary: prose })],
      ["rationale", rationale({ thesis: prose })],
      ["rationale", rationale({ dont: ["Keep it calm.", prose] })],
      ["critique", critique({ verdict: prose })],
      ["critique", critique({ top: [{ findingIndex: 2, why: prose }] })],
    ];
    for (const [feature, value] of values) expect(kindOf(feature, value), feature).toBe("range");
    expect(kindOf("brief", brief({ name: text.slice(0, 40) }))).toBe("range");
  });

  it("C-AI-06 a string toPlainText empties is range", () => {
    expect(kindOf("brief", brief({ name: "\u0000" }))).toBe("range");
    expect(kindOf("rationale", rationale({ do: [" \n "] }))).toBe("range");
    expect(kindOf("critique", critique({ verdict: "‏" }))).toBe("range");
  });

  it("C-AI-06 a shiftHue of a slot whose input hue is null is range", () => {
    const value = refine({ ops: [{ op: "shiftHue", slot: "primary", degrees: 10 }] });
    expect(kindOf("refine", value, GRAY_PRIMARY)).toBe("range");
    expect(kindOf("refine", value)).toBe("ok");
  });

  it.each([
    "Just a calm palette.",
    "An easy, warm system!",
    "Calm tea \u{1F375} at dusk",
    "justify the text",
    "#1 pick",
    "Simply calm, obviously warm, basically quiet.",
    "#12345 is not a color",
    "a colorful(ish) watercolor(ish) scheme",
  ])("C-AI-06 the soft rules let %j pass", (text) => {
    expect(kindOf("rationale", rationale({ thesis: text }))).toBe("ok");
  });
});

describe("C-AI-06 cleanModelText, the value check of every model string", () => {
  it("C-AI-06 gives the plain text, or null for an empty result, a color literal or APCA", () => {
    expect(cleanModelText("  Calm \n tea ", 40)).toBe("Calm tea");
    expect(cleanModelText("\u0000", 40)).toBeNull();
    expect(cleanModelText("Blue #00f", 40)).toBeNull();
    expect(cleanModelText("AP‎CA", 40)).toBeNull();
    expect(cleanModelText("abcdef", 3)).toBe("abc");
  });

  it("C-AI-06 throws TypeError and RangeError naming cleanModelText", () => {
    expect(() => cleanModelText(5 as unknown as string, 40)).toThrow(TypeError);
    expect(() => cleanModelText("x", "40" as unknown as number)).toThrow(TypeError);
    expect(() => cleanModelText("x", 0)).toThrow(RangeError);
    expect(() => cleanModelText("x", 1.5)).toThrow(/^cleanModelText: /);
  });
});
