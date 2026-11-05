import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { BriefDraft } from "@/ai/features";
import { LEXICON } from "@/ai/lexicon/data";
import { type LexiconMatch, matchLexicon } from "@/ai/lexicon/match";
import {
  CHROMA_LEVELS,
  CONTRAST_LEVELS,
  DEPTH_STYLES,
  HARMONIES,
  LOCKABLE,
  MOTION_FEELS,
  NEUTRAL_TINTS,
  PAIRING_IDS,
  PRESET_IDS,
  RADIUS_SET_NAMES,
  TYPE_CONTEXTS,
} from "@/engine";
import { copyProblems } from "./copy-rules";
import { DENY_LIST } from "./lexicon-deny";

// C-LEX-08 to C-LEX-13 of docs/specs/04-ai.md, section 14.4 (R4-42, R4-43, sections 7.1 to 7.3): the
// shipped LEXICON, the matcher over it, and the rules its data follows.

/** The enum fields of a set (7.1), each with the engine's own list of values. */
const ENUM_LISTS: Readonly<Record<string, readonly string[]>> = {
  chroma: CHROMA_LEVELS,
  neutralTint: NEUTRAL_TINTS,
  harmony: HARMONIES,
  contrastLevel: CONTRAST_LEVELS,
  preset: PRESET_IDS,
  pairing: PAIRING_IDS,
  typeContext: TYPE_CONTEXTS,
  radius: RADIUS_SET_NAMES,
  depth: DEPTH_STYLES,
  motion: MOTION_FEELS,
};
const CATEGORIES = ["mood", "industry", "material", "place", "era", "style"];
/** The suffixes of 7.4, written out from the spec. */
const SUFFIXES = ["", "s", "es", "ed", "ing", "ly", "y"];
const TERM = /^[a-z]+( [a-z]+)?$/;
const TERMS = new Set(LEXICON.map((entry) => entry.term));

/** Every problem of one set or draft against 7.1: an empty list when it follows the rules. */
function draftProblems(draft: BriefDraft): string[] {
  const problems: string[] = [];
  for (const [key, value] of Object.entries(draft)) {
    if (key === "hues") {
      const hues = Object.entries(value as object);
      if (hues.length === 0) problems.push("empty hues");
      for (const [slot, hue] of hues) {
        if (!(LOCKABLE as readonly string[]).includes(slot)) problems.push(`hue slot ${slot}`);
        if (!Number.isInteger(hue) || hue < 0 || hue > 359) problems.push(`${slot} hue ${hue}`);
      }
    } else if (ENUM_LISTS[key] === undefined) {
      problems.push(`key ${key}`);
    } else if (!ENUM_LISTS[key].includes(value as string)) {
      problems.push(`${key} ${String(value)}`);
    }
  }
  return problems;
}

/** Whether `a` is `b` with a suffix of 7.4 on one or more of its words ("tea houses", "dusky"). */
function suffixForm(a: string, b: string): boolean {
  const [left, right] = [a.split(" "), b.split(" ")];
  return (
    a !== b &&
    left.length === right.length &&
    left.every((word, i) => SUFFIXES.some((s) => word === (right[i] as string) + s))
  );
}

/** The values each enum field takes across the sets of LEXICON. */
function voted(field: string): Set<unknown> {
  return new Set(LEXICON.map((entry) => (entry.set as Record<string, unknown>)[field]));
}

/** Whether `value` and everything inside it is frozen. */
function deeplyFrozen(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return true;
  return Object.isFrozen(value) && Object.values(value).every(deeplyFrozen);
}

function checkMatch(result: LexiconMatch): void {
  for (const term of result.terms) expect(TERMS.has(term), term).toBe(true);
  expect(new Set(result.terms).size).toBe(result.terms.length);
  if (result.draft === null) {
    expect(result.terms).toEqual([]);
  } else {
    expect(result.terms.length).toBeGreaterThan(0);
    expect(draftProblems(result.draft)).toEqual([]);
  }
}

describe("C-LEX-08 the matcher over LEXICON", () => {
  it("C-LEX-08 never throws, agrees with itself and stays in the engine's lists for any text", () => {
    fc.assert(
      fc.property(
        fc.string({ unit: "binary", maxLength: 500 }).filter((s) => s.length <= 500),
        (text) => {
          const result = matchLexicon(text);
          expect(matchLexicon(text)).toEqual(result);
          checkMatch(result);
        },
      ),
      { numRuns: 500, seed: 4004 },
    );
  });

  it("C-LEX-08 does the same for briefs made of LEXICON's terms, their suffixes and noise", () => {
    const piece = fc.tuple(
      fc.constantFrom(...TERMS),
      fc.constantFrom("", "s", "es", "ed", "ing", "ly", "y", "er"),
      fc.constantFrom(" ", ", ", "-", " and ", "2", "é ", " 東京 "),
    );
    const brief = fc
      .array(piece, { maxLength: 40 })
      .map((pieces) => pieces.map((parts) => parts.join("")).join(""))
      .map((text) => text.slice(0, 500));
    fc.assert(
      fc.property(brief, (text) => {
        const result = matchLexicon(text);
        expect(matchLexicon(text)).toEqual(result);
        checkMatch(result);
      }),
      { numRuns: 500, seed: 4004 },
    );
  });
});

describe("C-LEX-09 LEXICON follows 7.1 and 7.2", () => {
  it("C-LEX-09 holds at least 400 distinct terms, at least 40 per category", () => {
    expect(LEXICON.length).toBeGreaterThanOrEqual(400);
    expect(TERMS.size).toBe(LEXICON.length);
    for (const category of CATEGORIES) {
      const count = LEXICON.filter((entry) => entry.category === category).length;
      expect(count, category).toBeGreaterThanOrEqual(40);
    }
    expect(LEXICON.filter((entry) => !CATEGORIES.includes(entry.category))).toEqual([]);
  });

  it("C-LEX-09 every term fits the pattern and every weight is 1, 2 or 3", () => {
    expect(LEXICON.filter((entry) => !TERM.test(entry.term)).map((e) => e.term)).toEqual([]);
    expect(LEXICON.filter((entry) => ![1, 2, 3].includes(entry.weight))).toEqual([]);
  });

  it("C-LEX-09 every set is non-empty, holds no text field, and stays in the engine's lists", () => {
    const bad = LEXICON.flatMap((entry) => {
      const keys = Object.keys(entry.set);
      const problems = draftProblems(entry.set);
      if (keys.length === 0) problems.push("empty set");
      return problems.map((problem) => `${entry.term}: ${problem}`);
    });
    expect(bad).toEqual([]);
  });

  it("C-LEX-09 no term is another term plus a suffix, on either of its words", () => {
    const list = [...TERMS];
    const suffixed = list.flatMap((a) =>
      list.filter((b) => suffixForm(a, b)).map((b) => `${a} is ${b} with a suffix`),
    );
    expect(suffixed).toEqual([]);
  });

  it("C-LEX-09 a warm or cool set with a primary hue follows R3-29's hue rule", () => {
    const bad = LEXICON.filter(({ set }) => {
      const hue = set.hues?.primary;
      if (hue === undefined) return false;
      const warm = hue < 140 || hue >= 330;
      return (set.neutralTint === "warm" && !warm) || (set.neutralTint === "cool" && warm);
    }).map((entry) => entry.term);
    expect(bad).toEqual([]);
  });

  it("C-LEX-09 every preset, pairing and enum value is voted by at least one term", () => {
    for (const [field, values] of Object.entries(ENUM_LISTS)) {
      const seen = voted(field);
      expect(
        values.filter((value) => !seen.has(value)),
        field,
      ).toEqual([]);
    }
    const slots = new Set(LEXICON.flatMap((entry) => Object.keys(entry.set.hues ?? {})));
    expect([...slots].sort()).toEqual([...LOCKABLE].sort());
  });

  it("C-LEX-09 is frozen, every entry and set with it", () => {
    expect(Object.isFrozen(LEXICON)).toBe(true);
    expect(LEXICON.filter((entry) => !deeplyFrozen(entry)).map((entry) => entry.term)).toEqual([]);
  });

  it("C-LEX-09 every term is copy the studio can show (R4-57): American English, no banned word", () => {
    expect(LEXICON.flatMap((entry) => copyProblems(entry.term))).toEqual([]);
  });
});

describe("C-LEX-10 the deny list", () => {
  it("C-LEX-10 the list holds 62 distinct names, riso and risograph among them", () => {
    expect(DENY_LIST).toHaveLength(62);
    expect(new Set(DENY_LIST).size).toBe(62);
    expect(DENY_LIST).toEqual(expect.arrayContaining(["riso", "risograph"]));
  });

  it("C-LEX-10 no term is a denied name, and no two-word term holds one as a word", () => {
    const denied = new Set(DENY_LIST);
    expect([...TERMS].filter((term) => term.split(" ").some((word) => denied.has(word)))).toEqual(
      [],
    );
  });
});

describe("C-LEX-11 the flows' three terms", () => {
  it("C-LEX-11 LEXICON holds tea house, dusk and calm", () => {
    for (const term of ["tea house", "dusk", "calm"]) expect(TERMS.has(term), term).toBe(true);
  });
});

/** The color names of LEXICON, written out here: each is a word whose meaning is its hue. */
const COLOR_NAMES = [
  "red",
  "scarlet",
  "crimson",
  "maroon",
  "burgundy",
  "rose",
  "pink",
  "blush",
  "salmon",
  "peach",
  "apricot",
  "orange",
  "tan",
  "brown",
  "mustard",
  "yellow",
  "khaki",
  "lime",
  "chartreuse",
  "green",
  "teal",
  "turquoise",
  "aqua",
  "cyan",
  "azure",
  "cerulean",
  "blue",
  "navy",
  "violet",
  "purple",
  "lilac",
  "mauve",
  "plum",
  "magenta",
  "fuchsia",
];

/** The distance between two hues on the wheel, 0 to 180. */
const hueGap = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

describe("C-LEX-12 a named color survives an industry word", () => {
  it("C-LEX-12 every color name with every industry term keeps the primary within 45 degrees of the color", () => {
    const industries = LEXICON.filter((entry) => entry.category === "industry");
    expect(industries.length).toBeGreaterThanOrEqual(40);
    const off = COLOR_NAMES.flatMap((color) => {
      const own = LEXICON.find((entry) => entry.term === color)?.set.hues?.primary;
      expect(own, color).toBeDefined();
      return industries.flatMap(({ term }) => {
        const brief = `${color} ${term}`;
        const hue = matchLexicon(brief).draft?.hues?.primary;
        return hue !== undefined && hueGap(hue, own as number) <= 45 ? [] : [`${brief}: ${hue}`];
      });
    });
    expect(off).toEqual([]);
  });

  it("C-LEX-12 an industry word alone sets no hue unless it names a color of its own", () => {
    const hued = LEXICON.filter((entry) => entry.category === "industry" && entry.set.hues);
    expect(hued.map((entry) => entry.term).sort()).toEqual(["coffee", "wine"]);
  });
});

describe("C-LEX-13 phrases a single word would misread", () => {
  /** The blue-violet range, where a cold reading of "ice" would land. */
  const blueViolet = (hue: number | undefined) => hue !== undefined && hue >= 200 && hue <= 320;

  it.each(["ice cream", "Ice cream shop, cute and playful", "ice creams and sorbet"])(
    "C-LEX-13 %j reads as ice cream, warm and soft, never as ice",
    (brief) => {
      const { terms, draft } = matchLexicon(brief);
      expect(terms).toContain("ice cream");
      expect(terms).not.toContain("ice");
      expect(blueViolet(draft?.hues?.primary)).toBe(false);
      expect(draft?.neutralTint).toBe("warm");
    },
  );

  it("C-LEX-13 nordic and scandinavian, read as one request, give the same tint", () => {
    const tint = (term: string) => LEXICON.find((entry) => entry.term === term)?.set.neutralTint;
    expect(tint("nordic")).toBeDefined();
    expect(tint("scandinavian")).toBe(tint("nordic"));
  });
});
