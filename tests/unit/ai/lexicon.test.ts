import { describe, expect, it } from "vitest";
import { briefColors } from "@/ai/colors";
import { type LexiconEntry, matchLexicon, words } from "@/ai/lexicon/match";
import { normalizeSeed, parseColor } from "@/engine";
import { toPlainText } from "@/spec";
import { FIXTURE_LEXICON } from "./lexicon-fixture";

// C-LEX-01 to C-LEX-07 and C-LEX-RF2 of docs/specs/04-ai.md, section 14.4 (R4-43, section 7.4): the
// matcher on FIXTURE_LEXICON, whose ten entries make every tie and every hue known by hand.

const match = (text: string) => matchLexicon(text, FIXTURE_LEXICON);
const terms = (text: string) => match(text).terms;

describe("C-LEX-01 a brief's terms and draft", () => {
  it("C-LEX-01 reads the R4-43 brief into its terms, in text order, and the voted draft", () => {
    expect(match("Kyoto tea houses at dusk, calmly glowing, but fintech")).toEqual({
      terms: ["tea house", "dusk", "calm", "glow", "fintech"],
      draft: {
        hues: { primary: 224 },
        neutralTint: "warm",
        pairing: "young-onest",
        chroma: "muted",
        motion: "calm",
        contrastLevel: "AA+",
        typeContext: "product",
      },
    });
  });
});

describe("C-LEX-02 normalizing", () => {
  it.each(["Dúsk", "DUSK", "dusk2day"])("C-LEX-02 %j matches dusk", (text) => {
    expect(terms(text)).toEqual(["dusk"]);
  });

  it("C-LEX-02 a hyphen splits like a space, and other scripts match nothing", () => {
    expect(terms("tea-house")).toEqual(["tea house"]);
    expect(terms("東京 dusk")).toEqual(["dusk"]);
  });
});

describe("C-LEX-03 suffixes", () => {
  it.each([
    ["teas", "tea"],
    ["dusky", "dusk"],
    ["calmed", "calm"],
    ["glows", "glow"],
    ["glowes", "glow"],
    ["neons", "neon"],
  ])("C-LEX-03 %j matches %s", (text, term) => {
    expect(terms(text)).toEqual([term]);
  });

  it.each(["calmer", "duskiness", "teapot"])("C-LEX-03 %j matches nothing", (text) => {
    expect(terms(text)).toEqual([]);
  });

  it("C-LEX-03 teal is not tea, tea alone is tea, and tea house never also matches tea", () => {
    expect(terms("teal")).not.toContain("tea");
    expect(terms("tea")).toEqual(["tea"]);
    expect(terms("tea house")).toEqual(["tea house"]);
    expect(terms("tea houses and more tea")).toEqual(["tea house", "tea"]);
  });
});

describe("C-LEX-04 votes", () => {
  it("C-LEX-04 a tie goes to the value whose first voter comes earliest in the data", () => {
    expect(match("neon calm").draft).toEqual({ chroma: "muted", motion: "calm" });
    expect(match("calm neon").draft).toEqual({ chroma: "muted", motion: "calm" });
  });

  it("C-LEX-04 the largest weighted total wins", () => {
    expect(match("calm neon glow").draft?.chroma).toBe("vivid");
  });

  it("C-LEX-04 a term repeated in the text counts once", () => {
    expect(match("dusk dusk dusk")).toEqual({
      terms: ["dusk"],
      draft: { hues: { primary: 280 }, neutralTint: "cool" },
    });
  });
});

describe("C-LEX-05 hues", () => {
  it("C-LEX-05 hues combine by weighted circular mean, per slot", () => {
    expect(match("dusk tea").draft?.hues).toEqual({ primary: 280 });
    expect(match("harbor dusk").draft?.hues).toEqual({ primary: 280, secondary: 220 });
  });

  it("C-LEX-05 hues that cancel give a draft with no hues", () => {
    expect(match("red teal")).toEqual({ terms: ["red", "teal"], draft: {} });
  });

  it("C-LEX-05 a mean of 359.6 rounds to 0, and 359.4 to 359", () => {
    const pole = (west: 1 | 2 | 3, north: 1 | 2 | 3): LexiconEntry[] => [
      { term: "west", category: "place", weight: west, set: { hues: { primary: 359 } } },
      { term: "north", category: "place", weight: north, set: { hues: { primary: 0 } } },
    ];
    expect(matchLexicon("west north", pole(2, 3)).draft).toEqual({ hues: { primary: 0 } });
    expect(matchLexicon("west north", pole(3, 2)).draft).toEqual({ hues: { primary: 359 } });
  });
});

describe("C-LEX-06 no match", () => {
  it.each(["hello world", ""])("C-LEX-06 %j gives no terms and no draft", (text) => {
    expect(match(text)).toEqual({ terms: [], draft: null });
  });
});

describe("C-LEX-07 failures", () => {
  it("C-LEX-07 a text that is not a string, or a lexicon that is not an array, is a TypeError", () => {
    expect(() => matchLexicon(5 as unknown as string)).toThrow(TypeError);
    expect(() => matchLexicon(5 as unknown as string)).toThrow(/^matchLexicon: /);
    expect(() => matchLexicon("a", {} as unknown as LexiconEntry[])).toThrow(TypeError);
    expect(() => matchLexicon("a", {} as unknown as LexiconEntry[])).toThrow(/^matchLexicon: /);
  });

  it("C-LEX-07 a text of 501 characters is a RangeError, and 500 reads", () => {
    expect(() => match("a".repeat(501))).toThrow(RangeError);
    expect(() => match("a".repeat(501))).toThrow(/^matchLexicon: /);
    expect(match("calm ".repeat(100)).terms).toEqual(["calm"]);
  });

  it("C-LEX-07 words, the helper the matcher exports, refuses a text that is not a string", () => {
    expect(() => words(5 as unknown as string)).toThrow(TypeError);
    expect(() => words(5 as unknown as string)).toThrow(/^words: /);
    expect(words("Dúsk, TEA-house 2day")).toEqual(["dusk", "tea", "house", "day"]);
  });
});

describe("C-LEX-RF2 a mixed brief of 500 characters", () => {
  const HEAD =
    "Kyoto tea house at dusk 😀, #b8422e, oklch(0.7 0.1 200), hsl(30 60% 50%), 東京, café";
  // 82 code units and ", quiet " leave 410 for 82 repeats of "calm ", so the brief ends with a space.
  const BRIEF = `${HEAD}, quiet ${"calm ".repeat(82)}`;

  /** hsl(30 60% 50%) by the CSS Color 4 conversion, written out here: rgb(0.8, 0.5, 0.2). */
  const HSL_SEED = normalizeSeed(parseColor("rgb(204 127.5 51)"));

  it("C-LEX-RF2 the brief is 500 characters and ends with the trailing space the studio trims", () => {
    expect(BRIEF).toHaveLength(500);
    expect(BRIEF.endsWith("calm ")).toBe(true);
  });

  it("C-LEX-RF2 gives three seeds in text order, a rest with letters, and the lexicon's terms", () => {
    const cleaned = toPlainText(BRIEF, 500);
    expect(cleaned?.text).toBe(BRIEF.trimEnd());
    const { seeds, rest } = briefColors(cleaned?.text ?? "");
    expect(seeds).toHaveLength(3);
    expect(seeds[0]).toEqual(normalizeSeed(parseColor("#b8422e")));
    expect(seeds[1]).toEqual(normalizeSeed({ l: 0.7, c: 0.1, h: 200 }));
    expect(seeds[2]?.l).toBeCloseTo(HSL_SEED.l, 5);
    expect(seeds[2]?.c).toBeCloseTo(HSL_SEED.c, 5);
    expect(Math.abs((seeds[2]?.h ?? Number.NaN) - (HSL_SEED.h ?? Number.NaN))).toBeLessThan(0.1);
    expect(rest).toMatch(/\p{L}/u);
    expect(rest).not.toMatch(/#b8422e|oklch|hsl/);
    expect(match(rest).terms).toEqual(["tea house", "dusk", "calm"]);
    expect(matchLexicon(rest).terms).toEqual(expect.arrayContaining(["tea house", "dusk", "calm"]));
  });

  it("C-LEX-RF2 toPlainText of 501 characters cuts to 500", () => {
    const longer = `${BRIEF}c`;
    expect(longer).toHaveLength(501);
    const cut = toPlainText(longer, 500);
    expect(cut?.truncated).toBe(true);
    expect(cut?.text.length).toBeLessThanOrEqual(500);
    expect(cut?.text).toBe(BRIEF.trimEnd());
  });
});
