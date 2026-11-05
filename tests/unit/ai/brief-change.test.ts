import { describe, expect, it } from "vitest";
import { briefChange, HUE_SEEDS } from "@/ai/apply";
import type { BriefDraft } from "@/ai/features";
import { matchLexicon } from "@/ai/lexicon/match";
import { type DirectionParams, normalizeSeed, type Oklch, parseColor } from "@/engine";
import { DEFAULT_PARAMS } from "../spec/support";
import { BRIEF_OUT } from "./fixtures";
import { FIXTURE_LEXICON } from "./lexicon-fixture";

// C-BRIEF-01 to C-BRIEF-06 of docs/specs/04-ai.md, section 14.4 (R4-40, R4-41, section 7.6): a brief's
// draft and its literal colors become one change for the store's `applyAi`.

const RUST = normalizeSeed(parseColor("#b8422e"));
const BLUE = normalizeSeed(parseColor("#3a6ea5"));
const SAND = normalizeSeed(parseColor("#f2e6d0"));

const change = (
  draft: BriefDraft,
  params: DirectionParams = DEFAULT_PARAMS,
  literals: Oklch[] = [],
) => briefChange(draft, { params, literals });

describe("C-BRIEF-01 the fixture's brief", () => {
  it("C-BRIEF-01 BRIEF_OUT gives its preset and a patch of exactly its fields", () => {
    expect(change(BRIEF_OUT)).toStrictEqual({
      preset: "organic",
      patch: {
        primary: normalizeSeed({ l: 0.62, c: 0.07, h: 150 }),
        chroma: "muted",
        neutralTint: "warm",
        harmony: "analogous",
        radius: "soft",
        motion: "calm",
        name: "Dusk Tea",
        oneLiner: "A calm tea house at dusk.",
        direction: { adjectives: ["calm", "exact"] },
      },
    });
  });

  it("C-BRIEF-01 copies every parameter field, and the type context as type.context", () => {
    const { patch } = change({
      harmony: "triadic",
      chroma: "vivid",
      neutralTint: "cool",
      radius: "round",
      depth: "layered",
      motion: "playful",
      pairing: "funnel",
      typeContext: "poster",
    });
    expect(patch).toStrictEqual({
      harmony: "triadic",
      chroma: "vivid",
      neutralTint: "cool",
      radius: "round",
      depth: "layered",
      motion: "playful",
      pairing: "funnel",
      type: { context: "poster" },
    });
  });
});

describe("C-BRIEF-02 hue seeds", () => {
  it("C-BRIEF-02 HUE_SEEDS is section 7.6's table, frozen", () => {
    expect(HUE_SEEDS).toStrictEqual({
      muted: { l: 0.62, c: 0.07 },
      balanced: { l: 0.6, c: 0.13 },
      vivid: { l: 0.62, c: 0.2 },
    });
    expect(Object.isFrozen(HUE_SEEDS)).toBe(true);
    expect(Object.values(HUE_SEEDS).every(Object.isFrozen)).toBe(true);
  });

  it("C-BRIEF-02 a hue takes the brief's chroma first", () => {
    const { patch } = change({ hues: { primary: 30 }, chroma: "vivid", preset: "editorial" });
    expect(patch.primary).toEqual(normalizeSeed({ l: 0.62, c: 0.2, h: 30 }));
  });

  it("C-BRIEF-02 without a chroma it takes the preset's level, else the held one", () => {
    expect(change({ hues: { accent: 30 }, preset: "minimal-swiss" }).patch.accent).toEqual(
      normalizeSeed({ l: 0.62, c: 0.07, h: 30 }),
    );
    expect(change({ hues: { accent: 30 } }).patch.accent).toEqual(
      normalizeSeed({ l: 0.6, c: 0.13, h: 30 }),
    );
    const vivid = { ...DEFAULT_PARAMS, chroma: "vivid" } as const;
    expect(change({ hues: { secondary: 200 } }, vivid).patch.secondary).toEqual(
      normalizeSeed({ l: 0.62, c: 0.2, h: 200 }),
    );
  });
});

describe("C-BRIEF-03 locks and literals", () => {
  it("C-BRIEF-03 a locked slot gets no patch key while an unlocked one takes its hue", () => {
    const locked = { ...DEFAULT_PARAMS, primary: BLUE };
    const { patch } = change({ hues: { primary: 30, secondary: 200 } }, locked);
    expect(Object.hasOwn(patch, "primary")).toBe(false);
    expect(patch.secondary).toEqual(normalizeSeed({ l: 0.6, c: 0.13, h: 200 }));
  });

  it("C-BRIEF-03 literals fill their slots in order even over a lock, and a model hue there is ignored", () => {
    const locked = { ...DEFAULT_PARAMS, primary: SAND, secondary: SAND };
    const { patch } = change({ hues: { primary: 30, secondary: 200, accent: 100 } }, locked, [
      RUST,
      BLUE,
    ]);
    expect(patch.primary).toEqual(RUST);
    expect(patch.secondary).toEqual(BLUE);
    expect(patch.accent).toEqual(normalizeSeed({ l: 0.6, c: 0.13, h: 100 }));
  });

  it("C-BRIEF-03 three literals fill all three slots with no hue in the draft", () => {
    expect(change({}, DEFAULT_PARAMS, [RUST, BLUE, SAND]).patch).toStrictEqual({
      primary: RUST,
      secondary: BLUE,
      accent: SAND,
    });
  });
});

describe("C-BRIEF-04 contrast is never lowered", () => {
  it("C-BRIEF-04 held AAA and a draft of AA puts no contrastLevel in the patch", () => {
    const held = { ...DEFAULT_PARAMS, contrastLevel: "AAA" } as const;
    expect(Object.hasOwn(change({ contrastLevel: "AA" }, held).patch, "contrastLevel")).toBe(false);
    expect(Object.hasOwn(change({ contrastLevel: "AA+" }, held).patch, "contrastLevel")).toBe(
      false,
    );
  });

  it("C-BRIEF-04 held AA and a draft of AAA puts AAA", () => {
    expect(change({ contrastLevel: "AAA" }).patch.contrastLevel).toBe("AAA");
    expect(change({ contrastLevel: "AA+" }).patch.contrastLevel).toBe("AA+");
  });

  it("C-BRIEF-04 a preset that raises the level counts as the level to beat", () => {
    const organic = change({ preset: "organic", contrastLevel: "AA+" });
    expect(organic.preset).toBe("organic");
    expect(Object.hasOwn(organic.patch, "contrastLevel")).toBe(false);
    expect(change({ preset: "organic", contrastLevel: "AAA" }).patch.contrastLevel).toBe("AAA");
    expect(
      Object.hasOwn(change({ preset: "glass", contrastLevel: "AA+" }).patch, "contrastLevel"),
    ).toBe(false);
  });
});

describe("C-BRIEF-05 text fields", () => {
  it("C-BRIEF-05 adjectives replace direction.adjectives and keep the thesis", () => {
    const held = { ...DEFAULT_PARAMS, direction: { thesis: "Kept.", adjectives: ["old"] } };
    expect(change({ name: "New", adjectives: ["calm", "exact"] }, held).patch).toStrictEqual({
      name: "New",
      direction: { thesis: "Kept.", adjectives: ["calm", "exact"] },
    });
  });

  it("C-BRIEF-05 a lexicon draft with no text fields sets no name, one-liner or direction", () => {
    const { draft } = matchLexicon("calm tea house at dusk", FIXTURE_LEXICON);
    expect(draft).not.toBeNull();
    const result = change(draft as BriefDraft);
    expect(Object.keys(result)).toEqual(["patch"]);
    for (const key of ["name", "oneLiner", "direction"]) {
      expect(Object.hasOwn(result.patch, key), key).toBe(false);
    }
    expect(result.patch).toStrictEqual({
      // tea house (140, weight 3) and dusk (280, weight 2) meet at 181.2; calm makes it muted.
      primary: normalizeSeed({ l: 0.62, c: 0.07, h: 181 }),
      chroma: "muted",
      motion: "calm",
      neutralTint: "warm",
      pairing: "young-onest",
    });
  });
});

describe("C-BRIEF-06 failures", () => {
  it.each([
    ["a null draft", () => briefChange(null as never, { params: DEFAULT_PARAMS, literals: [] })],
    ["a context with no params", () => briefChange({}, { literals: [] } as never)],
    ["a null context", () => briefChange({}, null as never)],
    ["literals that are not an array", () => briefChange({}, { params: DEFAULT_PARAMS } as never)],
    ["a hue that is a string", () => change({ hues: { primary: "red" } } as never)],
    ["hues that are not an object", () => change({ hues: 5 } as never)],
    ["a chroma that is a number", () => change({ chroma: 5 } as never)],
    ["adjectives that are not an array", () => change({ adjectives: "calm" } as never)],
    [
      "a held direction that is not an object",
      () => change({ adjectives: ["calm"] }, { ...DEFAULT_PARAMS, direction: "calm" } as never),
    ],
  ])("C-BRIEF-06 %s is a TypeError naming briefChange", (_, call) => {
    expect(call).toThrow(TypeError);
    expect(call).toThrow(/^briefChange: /);
  });

  it.each([
    ["four literals", () => change({}, DEFAULT_PARAMS, [RUST, BLUE, SAND, RUST])],
    ["a literal with l 2", () => change({}, DEFAULT_PARAMS, [{ l: 2, c: 0.1, h: 30 }])],
    ["an unknown field", () => change({ mode: "dark" } as never)],
    ["a chroma outside the list", () => change({ chroma: "loud" } as never)],
    ["a preset outside the list", () => change({ preset: "neon" } as never)],
    ["a hue of 360", () => change({ hues: { primary: 360 } })],
    ["a hue for an unknown slot", () => change({ hues: { tint: 30 } } as never)],
    ["a name of 41 characters", () => change({ name: "a".repeat(41) })],
    ["six adjectives", () => change({ adjectives: ["a", "b", "c", "d", "e", "f"] })],
    [
      "a held contrast level outside the list",
      () => change({}, { ...DEFAULT_PARAMS, contrastLevel: "A" } as never),
    ],
  ])("C-BRIEF-06 %s is a RangeError naming briefChange", (_, call) => {
    expect(call).toThrow(RangeError);
    expect(call).toThrow(/^briefChange: /);
  });
});
