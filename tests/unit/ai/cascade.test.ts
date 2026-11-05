import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { cascadePlan, isFreeSlug, type Tier } from "@/ai/cascade";
import { AI_FEATURES, type AiFeature } from "@/ai/features";
import { TEXT_SLUGS, VISION_SLUGS } from "./fixtures";

// C-AI-12 and C-AI-13 of docs/specs/04-ai.md, section 14.2: the cascade plan (R4-12, R4-13) and the
// slug rule.

const TEXT: readonly Tier[] = [
  { tier: "primary", slug: TEXT_SLUGS[0] },
  { tier: "fast", slug: TEXT_SLUGS[1] },
  { tier: "fallback", slug: TEXT_SLUGS[2] },
];
const VISION: readonly Tier[] = [
  { tier: "vision-1", slug: VISION_SLUGS[0] },
  { tier: "vision-2", slug: VISION_SLUGS[1] },
  { tier: "vision-3", slug: VISION_SLUGS[2] },
];
const TEXT_FEATURES: readonly AiFeature[] = ["brief", "refine", "rationale", "critique"];

describe("C-AI-12 cascadePlan", () => {
  it.each(TEXT_FEATURES)("C-AI-12 %s takes the text tiers in order", (feature) => {
    expect(cascadePlan(feature, { text: TEXT, vision: VISION })).toEqual(TEXT);
  });

  it("C-AI-12 vibe takes the vision tiers in order", () => {
    expect(cascadePlan("vibe", { text: TEXT, vision: VISION })).toEqual(VISION);
  });

  it("C-AI-12 leaves a missing tier out", () => {
    const text = [TEXT[0], TEXT[2]] as Tier[];
    expect(cascadePlan("brief", { text, vision: [] })).toEqual(text);
    expect(cascadePlan("vibe", { text: TEXT, vision: [VISION[1]] as Tier[] })).toEqual([VISION[1]]);
  });

  it("C-AI-12 drops a slug a later tier repeats, keeping the first", () => {
    const vision: Tier[] = [
      { tier: "vision-1", slug: "dots-studio/dots-3-note-preview:free" },
      { tier: "vision-2", slug: "google/gemma-4-26b-a4b-it:free" },
      { tier: "vision-3", slug: "dots-studio/dots-3-note-preview:free" },
    ];
    expect(cascadePlan("vibe", { text: [], vision })).toEqual(vision.slice(0, 2));
    const text: Tier[] = [
      { tier: "primary", slug: "a/b:free" },
      { tier: "fast", slug: "a/b:free" },
      { tier: "fallback", slug: "a/b:free" },
    ];
    expect(cascadePlan("critique", { text, vision: [] })).toEqual([text[0]]);
  });

  it("C-AI-12 gives [] when the feature's group has no tier", () => {
    expect(cascadePlan("brief", { text: [], vision: VISION })).toEqual([]);
    expect(cascadePlan("vibe", { text: TEXT, vision: [] })).toEqual([]);
  });

  it("C-AI-12 never plans more than 3 tiers, each from the feature's group, in order", () => {
    const tier = (names: readonly string[]) =>
      fc
        .subarray([...names])
        .chain((picked) =>
          fc.tuple(
            ...picked.map((name) =>
              fc
                .constantFrom("a/b:free", "c/d:free", "e/f:free")
                .map((slug) => ({ tier: name, slug })),
            ),
          ),
        );
    fc.assert(
      fc.property(
        fc.constantFrom(...AI_FEATURES),
        tier(["primary", "fast", "fallback"]),
        tier(["vision-1", "vision-2", "vision-3"]),
        (feature, text, vision) => {
          const plan = cascadePlan(feature, { text: text as Tier[], vision: vision as Tier[] });
          const group = feature === "vibe" ? vision : text;
          expect(plan.length).toBeLessThanOrEqual(3);
          expect(new Set(plan.map((t) => t.slug)).size).toBe(plan.length);
          expect(plan.every((t) => group.some((g) => g.tier === t.tier && g.slug === t.slug))).toBe(
            true,
          );
        },
      ),
      { numRuns: 300, seed: 4002 },
    );
  });

  it("C-AI-12 throws TypeError for a wrong type, naming cascadePlan", () => {
    const bad: unknown[] = [
      null,
      { text: TEXT },
      { text: "x", vision: [] },
      { text: [null], vision: [] },
      { text: [{ tier: "primary", slug: 5 }], vision: [] },
      { text: [{ tier: 5, slug: "a/b:free" }], vision: [] },
    ];
    for (const tiers of bad) {
      expect(() => cascadePlan("brief", tiers as never), JSON.stringify(tiers)).toThrow(TypeError);
      expect(() => cascadePlan("brief", tiers as never)).toThrow(/^cascadePlan: /);
    }
    expect(() => cascadePlan(3 as unknown as AiFeature, { text: [], vision: [] })).toThrow(
      TypeError,
    );
  });

  it("C-AI-12 throws RangeError for a feature, tier or slug out of its domain, naming cascadePlan", () => {
    const bad: unknown[] = [
      { text: [{ tier: "vision-1", slug: "a/b:free" }], vision: [] },
      { text: [], vision: [{ tier: "primary", slug: "a/b:free" }] },
      { text: [TEXT[1], TEXT[0]], vision: [] },
      { text: [TEXT[0], TEXT[0]], vision: [] },
      { text: [{ tier: "primary", slug: "openrouter/free" }], vision: [] },
    ];
    for (const tiers of bad) {
      expect(() => cascadePlan("brief", tiers as never), JSON.stringify(tiers)).toThrow(RangeError);
      expect(() => cascadePlan("brief", tiers as never)).toThrow(/^cascadePlan: /);
    }
    expect(() => cascadePlan("poem" as AiFeature, { text: [], vision: [] })).toThrow(RangeError);
  });
});

describe("C-AI-13 isFreeSlug", () => {
  it.each([
    "google/gemma-4-26b-a4b-it:free",
    "xingchen-agi/xing4.0-29b-a4b:free",
    "dots-studio/dots-3-note-preview:free",
    "nvidia/nemotron-3.5-super-vl:free",
    "test/text-1:free",
    `a/${"b".repeat(113)}:free`,
  ])("C-AI-13 is true for %s", (slug) => {
    expect(isFreeSlug(slug)).toBe(true);
  });

  it.each([
    "openrouter/free",
    "google/gemma-4-26b-a4b-it",
    "x/y:free ",
    " x/y:free",
    "Google/x:free",
    "/x:free",
    "x/:free",
    "x/y/z:free",
    "x/y:free:free",
    "x/_y:free",
    "x/y:FREE",
    "",
    `a/${"b".repeat(114)}:free`,
  ])("C-AI-13 is false for %j", (slug) => {
    expect(isFreeSlug(slug)).toBe(false);
  });

  it("C-AI-13 bounds a slug at 120 characters", () => {
    expect(`a/${"b".repeat(113)}:free`).toHaveLength(120);
    expect(`a/${"b".repeat(114)}:free`).toHaveLength(121);
  });

  it("C-AI-13 throws TypeError naming isFreeSlug for 5", () => {
    expect(() => isFreeSlug(5 as unknown as string)).toThrow(TypeError);
    expect(() => isFreeSlug(5 as unknown as string)).toThrow(/^isFreeSlug: /);
  });
});
