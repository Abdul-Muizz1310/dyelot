import { describe, expect, it } from "vitest";
import { cacheKey } from "@/ai/cache-key";
import { stableJson } from "@/ai/chat";
import { AI_FEATURES, type AiFeature, type FeatureInput, type VibeInput } from "@/ai/features";
import { briefInput } from "@/ai/inputs";
import { PROMPTS } from "@/ai/prompts";
import { sha256 } from "@/export/sha256";
import { BRIEF_IN, CRITIQUE_IN, RATIONALE_IN, REFINE_IN, VIBE_IN } from "./fixtures";

// C-AI-18 of docs/specs/04-ai.md, section 14.2: the shared route's cache key (R4-19, section 11.5),
// `<feature>:v<prompt version>:<SHA-256 hex of stableJson(normalized input)>`, where a vibe's
// normalized input carries its data URL's own SHA-256 in place of the data URL.

const INPUTS: { readonly [F in AiFeature]: FeatureInput[F] } = {
  brief: BRIEF_IN,
  refine: REFINE_IN,
  vibe: VIBE_IN,
  rationale: RATIONALE_IN,
  critique: CRITIQUE_IN,
};

const keyOf = (feature: AiFeature, input: unknown = INPUTS[feature], version = 2) =>
  cacheKey(feature, input as never, version);

/** A deep copy with the keys of every object in reverse order. */
function reversed(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reversed);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .reverse()
        .map(([key, item]) => [key, reversed(item)]),
    );
  }
  return value;
}

/** VIBE_IN with another image. */
const withImage = (image: Partial<VibeInput["image"]>): VibeInput => ({
  ...VIBE_IN,
  image: { ...VIBE_IN.image, ...image },
});

describe("C-AI-18 cacheKey", () => {
  it.each(AI_FEATURES)("C-AI-18 the %s key is <feature>:v<version>:<64 hex>", (feature) => {
    const key = keyOf(feature, INPUTS[feature], PROMPTS[feature].version);
    expect(key).toMatch(new RegExp(`^${feature}:v${PROMPTS[feature].version}:[0-9a-f]{64}$`));
    // Section 6.1's versions: the rationale's is 3 since its rules became bare verb phrases.
    expect(PROMPTS[feature].version).toBe(feature === "rationale" ? 3 : 2);
  });

  it("C-AI-18 hashes stableJson of the input with SHA-256", () => {
    expect(keyOf("brief")).toBe(`brief:v2:${sha256(stableJson(BRIEF_IN))}`);
    expect(keyOf("critique", CRITIQUE_IN, 7)).toBe(
      `critique:v7:${sha256(stableJson(CRITIQUE_IN))}`,
    );
  });

  it("C-AI-18 a vibe hashes its data URL's SHA-256 in place of the data URL", () => {
    const normalized = {
      clusters: VIBE_IN.clusters,
      image: { sha256: sha256(VIBE_IN.image.dataUrl), width: 2, height: 2 },
    };
    expect(keyOf("vibe")).toBe(`vibe:v2:${sha256(stableJson(normalized))}`);
  });

  it.each(AI_FEATURES)(
    "C-AI-18 equal %s inputs give equal keys, keys in another order included",
    (feature) => {
      const input = INPUTS[feature];
      expect(keyOf(feature, structuredClone(input))).toBe(keyOf(feature, input));
      expect(keyOf(feature, reversed(input))).toBe(keyOf(feature, input));
      expect(Object.keys(reversed(input) as object)).toEqual(Object.keys(input).reverse());
    },
  );

  it("C-AI-18 another brief, another lock or another version gives another key", () => {
    const key = keyOf("brief");
    const dawn = briefInput("Kyoto tea house at dawn, calm and exact", {});
    expect(keyOf("brief", dawn)).not.toBe(key);
    expect(keyOf("brief", briefInput(BRIEF_IN.brief, { primary: 150 }))).not.toBe(key);
    expect(keyOf("brief", BRIEF_IN, 3)).not.toBe(key);
    expect(keyOf("brief", BRIEF_IN, 20)).not.toBe(key);
    expect(keyOf("brief", BRIEF_IN, 20).startsWith("brief:v20:")).toBe(true);
  });

  it("C-AI-18 a vibe key changes with the image and not with the data URL's object identity", () => {
    const key = keyOf("vibe");
    const [head, payload] = VIBE_IN.image.dataUrl.split(",") as [string, string];
    const rebuilt = [head, payload].join(",");
    expect(rebuilt).toBe(VIBE_IN.image.dataUrl);
    expect(keyOf("vibe", withImage({ dataUrl: rebuilt }))).toBe(key);
    expect(keyOf("vibe", structuredClone(VIBE_IN))).toBe(key);
    expect(keyOf("vibe", withImage({ dataUrl: `${head},${payload.slice(0, -4)}AAAA` }))).not.toBe(
      key,
    );
    expect(keyOf("vibe", withImage({ dataUrl: "data:image/jpeg;base64,AAAA" }))).not.toBe(key);
    expect(keyOf("vibe", withImage({ width: 3 }))).not.toBe(key);
    expect(keyOf("vibe", { ...VIBE_IN, clusters: VIBE_IN.clusters.slice(0, 1) })).not.toBe(key);
  });

  it.each([
    ["a feature 5", 5, BRIEF_IN, 2, TypeError],
    ['a feature "haiku"', "haiku", BRIEF_IN, 2, RangeError],
    ["an input null", "brief", null, 2, TypeError],
    ["an input that is a string", "brief", "Kyoto", 2, TypeError],
    ["another feature's input", "vibe", BRIEF_IN, 2, RangeError],
    ["a brief of 0 characters", "brief", { brief: "", locked: {} }, 2, RangeError],
    ["a version that is a string", "brief", BRIEF_IN, "2", TypeError],
    ["a version of 0", "brief", BRIEF_IN, 0, RangeError],
    ["a version of 1.5", "brief", BRIEF_IN, 1.5, RangeError],
    ["a version of 10000", "brief", BRIEF_IN, 10000, RangeError],
    ["a version NaN", "brief", BRIEF_IN, Number.NaN, RangeError],
  ] as const)("C-AI-18 cacheKey refuses %s, naming itself", (_, feature, input, version, type) => {
    const call = () => cacheKey(feature as AiFeature, input as never, version as number);
    expect(call).toThrow(type);
    expect(call).toThrow(/^cacheKey: /);
  });
});
