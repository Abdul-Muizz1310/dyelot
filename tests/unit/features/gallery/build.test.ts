import { describe, expect, it } from "vitest";
import * as AI from "@/ai";
import { applyPreset, freshParams, generateSystem, presetOf, resolveParams } from "@/engine";
import { briefSpec, galleryData } from "@/features/gallery/build";
import type { BriefDef } from "@/features/gallery/defs";
import { mergeParams } from "@/features/studio/params";
import { PROPERTY_TIMEOUT } from "../../spec/support";
import { BRIEFS } from "../../support/gallery";

// C-GAL6-03 and C-GAL6-10 of docs/specs/06-gallery.md, section 14.1 (R6-06).

/** Section 6.1's last three columns for the 18 brief rows: the terms and the preset. */
const SIX = {
  realgar: [["balanced", "versatile", "professional", "fast", "orange"], "default"],
  cinnabar: [["swiss", "grid", "architecture", "stark", "precise", "red"], "minimal-swiss"],
  ochre: [["minimal", "concrete", "grid", "neutral", "crisp", "ochre"], "minimal-swiss"],
  kermes: [["slow", "longform", "magazine", "serif", "warm", "paper", "burgundy"], "editorial"],
  lapis: [["formal", "law", "journal", "classic", "serif", "quiet", "paper", "navy"], "editorial"],
  gamboge: [
    ["loud", "confident", "neo brutalism", "saturated", "yellow", "sharp"],
    "neo-brutalism",
  ],
  smalt: [["frost", "glass", "landing page", "startup", "cool", "azure", "high contrast"], "glass"],
  turquoise: [["dense", "fast", "terminal", "api", "flat", "teal"], "dark-dev-tool"],
  safflower: [["friendly", "bento", "modular", "tile", "mobile app", "rose"], "bento"],
  verditer: [["slow", "northern lights", "gradient", "storefront", "vivid", "cool"], "aurora"],
  tyrian: [
    ["neon", "synthwave", "holographic", "magenta", "playful", "eighties"],
    "retro-futurism",
  ],
  sepia: [["handcrafted", "leather", "workshop", "warm", "layer"], "tactile"],
  fustic: [["embossed", "brewery", "warm", "amber"], "tactile"],
  rhodonite: [["maximalist", "poster", "collage", "wild", "festive", "fuchsia"], "maximalism"],
  turmeric: [["cozy", "organic", "bakery", "honey", "cream", "slow", "handmade"], "organic"],
  "terre-verte": [["quiet", "matcha", "tea house", "slow", "handmade"], "organic"],
  malachite: [["stark", "pixel", "bitmap", "black", "lime", "sharp", "flat"], "dithering-pixel"],
  azurite: [["bouncy", "expressive", "friendly", "animated", "blue"], "m3-expressive"],
} as const;

/** R6-06's six steps, written out the way the studio runs them. */
function byHand(def: BriefDef) {
  const { seeds, rest } = AI.briefColors(def.brief);
  expect(seeds).toEqual([]);
  const match = AI.matchLexicon(rest);
  if (match.draft === null) throw new Error("no draft");
  const base = mergeParams(freshParams(), { name: def.name, oneLiner: def.brief });
  const { preset, patch } = AI.briefChange(match.draft, { params: base, literals: [] });
  const params = mergeParams(preset === undefined ? base : applyPreset(base, preset), patch);
  return {
    spec: generateSystem(resolveParams(params, def.seed), def.seed, { createdWith: "lexicon" }),
    terms: match.terms,
  };
}

describe("briefSpec (R6-06)", () => {
  it(
    "C-GAL6-03 equals the six steps for each of the 18 brief rows, with section 6's terms and preset",
    () => {
      expect(BRIEFS).toHaveLength(18);
      for (const def of BRIEFS) {
        if (def.source !== "brief") throw new Error("not a brief");
        const made = briefSpec(def, AI);
        const hand = byHand(def);
        expect(made.spec, def.slug).toEqual(hand.spec);
        expect(made.terms, def.slug).toEqual(SIX[def.slug as keyof typeof SIX][0]);
        expect(presetOf(made.spec), def.slug).toBe(SIX[def.slug as keyof typeof SIX][1]);
        expect(made.spec.meta.createdWith).toBe("lexicon");
        expect(made.spec.meta.name).toBe(def.name);
        expect(made.spec.meta.oneLiner).toBe(def.brief);
        expect(made.spec.meta.seed).toBe(def.seed);
        expect(AI.briefColors(def.brief).seeds).toEqual([]);
      }
    },
    PROPERTY_TIMEOUT,
  );
});

describe("briefSpec and galleryData refuse (R6-06, R-05)", () => {
  const row: BriefDef = {
    slug: "probe",
    source: "brief",
    name: "Probe",
    seed: "gallery-probe",
    brief: "A balanced planner for small teams, professional and fast.",
    tags: ["calm"],
  };

  it("C-GAL6-10 refuses a brief holding a color, naming briefSpec and the slug", () => {
    const call = () => briefSpec({ ...row, brief: "A bold planner for a team in #ff0000." }, AI);
    expect(call).toThrow(RangeError);
    expect(call).toThrow(/^briefSpec.*probe/);
  });

  it("C-GAL6-10 refuses a brief matching no term, naming briefSpec and the slug", () => {
    const call = () => briefSpec({ ...row, brief: "Nothing here reads as a mood or a place." }, AI);
    expect(call).toThrow(RangeError);
    expect(call).toThrow(/^briefSpec.*probe/);
  });

  it("C-GAL6-10 refuses a null row, a hero row and an ai without briefChange", () => {
    expect(() => briefSpec(null as never, AI)).toThrow(TypeError);
    expect(() => briefSpec(null as never, AI)).toThrow(/^briefSpec/);
    const hero = { slug: "madder", source: "hero", hero: 0, tags: ["bold"] };
    expect(() => briefSpec(hero as never, AI)).toThrow(RangeError);
    expect(() => briefSpec(hero as never, AI)).toThrow(/^briefSpec/);
    const { briefChange: _gone, ...without } = AI;
    expect(() => briefSpec(row, without as never)).toThrow(TypeError);
    expect(() => briefSpec(row, without as never)).toThrow(/^briefSpec/);
    expect(() => briefSpec(row, null as never)).toThrow(/^briefSpec/);
  });

  it("C-GAL6-10 checks the type of every argument before any domain", () => {
    const hero = { slug: "madder", source: "hero", hero: 0, tags: ["bold"] };
    expect(() => briefSpec({ ...row, slug: "Bad Slug" }, null as never)).toThrow(TypeError);
    expect(() => briefSpec(hero as never, null as never)).toThrow(TypeError);
    expect(() =>
      briefSpec({ ...row, slug: "Bad Slug" }, { ...AI, briefChange: 1 } as never),
    ).toThrow(TypeError);
    expect(() => briefSpec({ ...row, slug: "Bad Slug", name: 3 as never }, AI)).toThrow(TypeError);
  });

  it("C-GAL6-10 refuses a row with a bad field and an ai whose name is no function", () => {
    expect(() => briefSpec({ ...row, slug: "Bad Slug" }, AI)).toThrow(RangeError);
    expect(() => briefSpec({ ...row, brief: 3 as never }, AI)).toThrow(TypeError);
    expect(() => briefSpec(row, { ...AI, matchLexicon: 1 } as never)).toThrow(TypeError);
  });

  it("C-GAL6-10 galleryData(null) throws a TypeError naming galleryData", () => {
    expect(() => galleryData(null as never)).toThrow(TypeError);
    expect(() => galleryData(null as never)).toThrow(/^galleryData/);
  });
});
