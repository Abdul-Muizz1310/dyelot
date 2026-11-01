import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { ColorParseError, parseColor } from "@/engine/color/parse";
import type { Oklch } from "@/engine/color/types";
import { ACHROMATIC_CHROMA, expectOklchClose } from "./support";

// Cases are the C-PARSE-nn rows of docs/specs/01-color-engine.md, section 6.1.

// Madder, the house accent. Values from core.py: l 0.70025083, c 0.17005499, h 22.063842.
const MADDER: Oklch = { l: 0.7003, c: 0.1701, h: 22.06 };
const MADDER_EXACT: Oklch = { l: 0.7002508346689501, c: 0.17005498554118814, h: 22.0638415289496 };
// The parse of oklch(70% 0.17 22), used by C-PARSE-09 and C-PARSE-29.
const OKLCH_70: Oklch = { l: 0.7, c: 0.17, h: 22 };

/** Parses `input`, which must fail with a ColorParseError, and returns the error. */
function parseError(input: string): ColorParseError {
  try {
    parseColor(input);
  } catch (error) {
    if (error instanceof ColorParseError) return error;
    throw error;
  }
  throw new Error(`parseColor accepted ${JSON.stringify(input.slice(0, 80))}`);
}

function expectParseFailure(input: string): void {
  expect(parseError(input).input).toBe(input);
}

describe("parseColor, accepted forms", () => {
  it("C-PARSE-01 reads #f66c6d as madder", () => {
    const color = parseColor("#f66c6d");
    expectOklchClose(color, MADDER);
    expect(color.l).toBeCloseTo(MADDER_EXACT.l, 12);
    expect(color.c).toBeCloseTo(MADDER_EXACT.c, 12);
    expect(color.h).toBeCloseTo(MADDER_EXACT.h as number, 9);
  });

  it("C-PARSE-02 reads upper-case hex as the same color", () => {
    expect(parseColor("#F66C6D")).toEqual(parseColor("#f66c6d"));
    expect(parseColor("#F66c6D")).toEqual(parseColor("#f66c6d"));
  });

  it("C-PARSE-03 ignores spaces, tabs and newlines around the input", () => {
    for (const padded of [" #f66c6d ", "\t#f66c6d\n", "\r\n  #f66c6d \t ", "   #f66c6d"]) {
      expect(parseColor(padded)).toEqual(parseColor("#f66c6d"));
    }
  });

  it("C-PARSE-04 reads rgb(246 108 109) as madder", () => {
    expectOklchClose(parseColor("rgb(246 108 109)"), MADDER);
    expectOklchClose(parseColor("rgb(246 108 109)"), MADDER_EXACT, {
      l: 1e-12,
      c: 1e-12,
      h: 1e-9,
    });
  });

  it("C-PARSE-05 reads rgb(246, 108, 109) as madder", () => {
    expectOklchClose(parseColor("rgb(246, 108, 109)"), MADDER);
    expect(parseColor("rgb(246,108,109)")).toEqual(parseColor("rgb(246 108 109)"));
  });

  it("C-PARSE-06 reads #fff as white and #abc as #aabbcc", () => {
    const white = parseColor("#fff");
    expect(white.l).toBeCloseTo(1, 6);
    expect(white.c).toBeLessThan(ACHROMATIC_CHROMA);
    expect(white.h).toBeNull();
    expect(parseColor("#abc")).toEqual(parseColor("#aabbcc"));
  });

  it("C-PARSE-07 reads #ffffffff and #ffff as white", () => {
    const white = parseColor("#ffffff");
    expect(parseColor("#ffffffff")).toEqual(white);
    expect(parseColor("#ffff")).toEqual(white);
    expect(white.h).toBeNull();
  });

  it("C-PARSE-08 drops the alpha pair of #aabbccdd", () => {
    expect(parseColor("#aabbccdd")).toEqual(parseColor("#aabbcc"));
    expect(parseColor("#abcd")).toEqual(parseColor("#abc"));
  });

  it("C-PARSE-09 reads a percentage lightness", () => {
    const color = parseColor("oklch(70% 0.17 22)");
    expect(color.l).toBeCloseTo(0.7, 12);
    expect(color.c).toBeCloseTo(0.17, 12);
    expect(color.h).toBeCloseTo(22, 12);
    expect(parseColor("oklch(100% 0 0)").l).toBe(1);
    expect(parseColor("oklch(0% 0.1 90)").l).toBe(0);
  });

  it("C-PARSE-10 reads a none hue on a gray as no hue", () => {
    expect(parseColor("oklch(0.6 0 none)").h).toBeNull();
  });

  it("C-PARSE-11 reads function names in any case", () => {
    expect(parseColor("oklch(0.7 0.17 22)")).toEqual({ l: 0.7, c: 0.17, h: 22 });
    expect(parseColor("OKLCH(0.7 0.17 22)")).toEqual(parseColor("oklch(0.7 0.17 22)"));
    expect(parseColor("OkLch(0.7 0.17 22)")).toEqual(parseColor("oklch(0.7 0.17 22)"));
    expect(parseColor("RGB(246 108 109)")).toEqual(parseColor("rgb(246 108 109)"));
  });

  it("C-PARSE-12 normalizes the hue into [0, 360)", () => {
    expect(parseColor("oklch(0.7 0.17 -338)").h).toBeCloseTo(22, 9);
    expect(parseColor("oklch(0.7 0.17 382)").h).toBeCloseTo(22, 9);
    expect(parseColor("oklch(0.7 0.17 360)").h).toBe(0);
    expect(parseColor("oklch(0.7 0.17 -360)").h).toBe(0);
    expect(parseColor("oklch(0.7 0.17 -0)").h).toBe(0);
    expect(parseColor("oklch(0.7 0.17 -1e-20)").h).toBe(0);
    expect(parseColor("oklch(0.7 0.17 359.5)").h).toBeCloseTo(359.5, 9);
    expect(parseColor("oklch(0.7 0.17 1e300)").h).toBeLessThan(360);
  });

  it("C-PARSE-13 gives a color with chroma at or below 4e-6 no hue", () => {
    expect(parseColor("oklch(0.6 0 120)").h).toBeNull();
    expect(parseColor("oklch(0.6 0.000003 120)").h).toBeNull();
    expect(parseColor("oklch(0.6 0.000004 120)").h).toBeNull();
    expect(parseColor("rgb(0 0 0)").h).toBeNull();
    expect(parseColor("oklch(0.6 0.00001 120)").h).toBe(120);
  });

  it("writes a negative zero as zero", () => {
    const color = parseColor("oklch(-0 -0 -0)");
    expect(Object.is(color.l, 0)).toBe(true);
    expect(Object.is(color.c, 0)).toBe(true);
    expect(color.h).toBeNull();
    expect(Object.is(parseColor("oklch(-0% 0.1 -0)").l, 0)).toBe(true);
    expect(Object.is(parseColor("oklch(-0% 0.1 -0)").h, 0)).toBe(true);
  });

  it("C-PARSE-14 reads none as hue 0 on a chromatic color", () => {
    expect(parseColor("oklch(0.6 0.1 none)")).toEqual({ l: 0.6, c: 0.1, h: 0 });
    // Like every CSS keyword, none ignores case. R-04 names only the function names.
    expect(parseColor("oklch(0.6 0.1 NONE)")).toEqual({ l: 0.6, c: 0.1, h: 0 });
  });

  it("C-PARSE-15 reads CSS number syntax", () => {
    expectOklchClose(parseColor("rgb(246.5 108 109)"), MADDER);
    expect(parseColor("oklch(0.5 .1 20)")).toEqual({ l: 0.5, c: 0.1, h: 20 });
    expect(parseColor("oklch(+0.5 +0.1 +20)")).toEqual({ l: 0.5, c: 0.1, h: 20 });
    expect(parseColor("oklch(5e-1 1E-1 2.2e1)").l).toBeCloseTo(0.5, 12);
    expect(parseColor("oklch(5e-1 1E-1 2.2e1)").c).toBeCloseTo(0.1, 12);
    expect(parseColor("oklch(5e-1 1E-1 2.2e1)").h).toBeCloseTo(22, 12);
    expect(() => parseColor("rgb(.5 1e1 +2)")).not.toThrow();
  });

  it("C-PARSE-29 allows whitespace inside the parentheses", () => {
    expect(parseColor("rgb( 246 108 109 )")).toEqual(parseColor("rgb(246 108 109)"));
    expect(parseColor("rgb(246 , 108 , 109)")).toEqual(parseColor("rgb(246 108 109)"));
    expect(parseColor("rgb(\t246\n108\r\n109 )")).toEqual(parseColor("rgb(246 108 109)"));
    expect(parseColor("oklch(  0.7   0.17   22  )")).toEqual(parseColor("oklch(0.7 0.17 22)"));
    expectOklchClose(parseColor("oklch(  70%   0.17   22  )"), OKLCH_70);
  });
});

describe("parseColor, rejected input", () => {
  it("C-PARSE-18 rejects the empty string", () => {
    expect(parseError("").input).toBe("");
  });

  it("C-PARSE-19 rejects #ggg", () => {
    expectParseFailure("#ggg");
  });

  it("C-PARSE-20 rejects #12345", () => {
    expectParseFailure("#12345");
  });

  it("C-PARSE-21 rejects rgb(1,2)", () => {
    expectParseFailure("rgb(1,2)");
  });

  it("C-PARSE-22 rejects oklch(1 2 3 4)", () => {
    expectParseFailure("oklch(1 2 3 4)");
  });

  it.each([
    ["   "],
    ["#12"],
    ["#1234567"],
    ["#123456789"],
    ["fff"],
    ["0xfff"],
    ["#"],
    ["##fff"],
    ["# fff"],
    ["#ff ff"],
  ])("C-PARSE-23 rejects whitespace only, wrong hex lengths and a missing #: %j", (input) => {
    expectParseFailure(input);
  });

  it.each([
    ["rgb(1,2,3,4)"],
    ["rgb(1 2,3)"],
    ["rgb(1, 2 3)"],
    ["rgb(256 0 0)"],
    ["rgb(-1 0 0)"],
    ["rgb(a b c)"],
    ["rgb(1 2 3"],
    ["rgba(1 2 3)"],
    ["rgb(100% 0% 0%)"],
    ["rgb(1 2 3 / 50%)"],
    ["rgb()"],
    ["rgb(1 2 3))"],
    ["rgb (1 2 3)"],
    ["rgb(1,, 2, 3)"],
    ["rgb(1 2 3 4)"],
    ["rgb(1. 2 3)"],
    ["rgb(1e999 0 0)"],
    ["rgb(,1 2 3)"],
  ])("C-PARSE-24 rejects malformed rgb(): %j", (input) => {
    expectParseFailure(input);
  });

  it.each([
    ["oklch(1.5 0 0)"],
    ["oklch(101% 0 0)"],
    ["oklch(-0.1 0 0)"],
    ["oklch(0.5 -0.1 20)"],
    ["oklch(0.5 0.6 20)"],
    ["oklch(0.5 50% 20)"],
    ["oklch(-1% 0 0)"],
  ])("C-PARSE-25 rejects oklch() values out of range: %j", (input) => {
    expectParseFailure(input);
  });

  it.each([
    ["oklch(0.5 0.1 abc)"],
    ["oklch(NaN 0 0)"],
    ["oklch(0.5 0.1 Infinity)"],
    ["oklch(0.5 0.1 -Infinity)"],
    ["oklch(1e999 0 0)"],
    ["oklch(0.5 0.1 1e999)"],
    ["oklch(0.5, 0.1, 20)"],
    ["oklch(0.5 0.1 22 / 50%)"],
    ["oklch(none 0.1 20)"],
    ["oklch(0.5 none 20)"],
    ["oklch(0.5 0.1 20deg)"],
    ["oklch(0.5 0.1 20"],
    ["oklch(0.5 0.1)"],
    ["oklch()"],
    ["oklch(0.5 1. 20)"],
    ["oklch(0.5 0x1 20)"],
  ])("C-PARSE-26 rejects non-numbers and wrong separators in oklch(): %j", (input) => {
    expectParseFailure(input);
  });

  it.each([
    ["red"],
    ["transparent"],
    ["hsl(0 100% 50%)"],
    ["color(display-p3 1 0 0)"],
    ["oklab(0.5 0.1 0.1)"],
    ["rgb"],
    ["oklch"],
  ])("C-PARSE-27 rejects named colors and other color functions: %j", (input) => {
    expectParseFailure(input);
  });

  it("C-PARSE-28 throws a named Error that keeps the untrimmed input and a short message", () => {
    const error = parseError("  #ggg  ");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ColorParseError);
    expect(error.name).toBe("ColorParseError");
    expect(error.input).toBe("  #ggg  ");
    expect(error.message).toContain("#ggg");

    const long = "x".repeat(10_000);
    const longError = parseError(long);
    expect(longError.input).toBe(long);
    expect(longError.message.length).toBeLessThan(200);
    expect(longError.message).toContain("x".repeat(80));
    expect(longError.message).not.toContain("x".repeat(81));

    const longRgb = `rgb(${"1".repeat(10_000)} 0 0)`;
    expect(parseError(longRgb).message.length).toBeLessThan(200);
  });

  it.each([
    ["\u00a0#f66c6d"],
    ["#f66c6d\u00a0"],
    ["\f#f66c6d"],
    ["\v#f66c6d"],
    ["\u2003rgb(246 108 109)"],
    ["rgb(246\u00a0108\u00a0109)"],
    ["rgb(246\f108 109)"],
    ["oklch(0.7\u00a00.17 22)"],
  ])("rejects whitespace other than space, tab, CR and LF: %j", (input) => {
    expectParseFailure(input);
  });

  it("names why a recognized form failed", () => {
    expect(parseError("rgb(256 0 0)").message).toMatch(/0 to 255/);
    expect(parseError("oklch(1.5 0 0)").message).toMatch(/lightness/i);
    expect(parseError("oklch(0.5 0.6 20)").message).toMatch(/chroma/i);
    expect(parseError("oklch(0.5 0.1 1e999)").message).toMatch(/hue/i);
  });

  it("rejects an argument that is not a string with a TypeError", () => {
    for (const bad of [undefined, null, 42, {}, ["#fff"]]) {
      expect(() => parseColor(bad as unknown as string)).toThrow(TypeError);
    }
  });
});

describe("parseColor, properties", () => {
  const ws = (min: number) =>
    fc
      .array(fc.constantFrom(" ", "\t", "\r", "\n"), { minLength: min, maxLength: 3 })
      .map((chars) => chars.join(""));

  /** A CSS number in [min, max], written in one of several styles. */
  const cssNumber = (min: number, max: number) =>
    fc
      .tuple(
        fc.double({ min, max, noNaN: true }),
        fc.constantFrom("plain", "fixed", "plus", "bare"),
      )
      .map(([value, style]) => {
        if (style === "fixed") return value.toFixed(3);
        if (style === "plus" && value >= 0) return `+${String(value)}`;
        if (style === "bare") return String(value).replace(/^0\./, ".");
        return String(value);
      });

  const hexDigit = fc.constantFrom(..."0123456789abcdefABCDEF");
  const hexText = fc
    .constantFrom(3, 4, 6, 8)
    .chain((length) => fc.array(hexDigit, { minLength: length, maxLength: length }))
    .map((digits) => `#${digits.join("")}`);

  const separator = (comma: boolean) =>
    comma ? fc.tuple(ws(0), ws(0)).map(([before, after]) => `${before},${after}`) : ws(1);
  const rgbText = fc.boolean().chain((comma) =>
    fc
      .tuple(
        fc.constantFrom("rgb", "RGB", "Rgb"),
        ws(0),
        cssNumber(0, 255),
        separator(comma),
        cssNumber(0, 255),
        separator(comma),
        cssNumber(0, 255),
        ws(0),
      )
      .map(([name, open, r, first, g, second, b, close]) => {
        return `${name}(${open}${r}${first}${g}${second}${b}${close})`;
      }),
  );

  const lightness = fc.oneof(
    cssNumber(0, 1),
    cssNumber(0, 100).map((text) => `${text}%`),
  );
  const hue = fc.oneof(cssNumber(-1e300, 1e300), fc.constant("none"));
  const oklchText = fc
    .tuple(
      fc.constantFrom("oklch", "OKLCH", "OkLch"),
      ws(0),
      lightness,
      ws(1),
      cssNumber(0, 0.5),
      ws(1),
      hue,
      ws(0),
    )
    .map(([name, open, l, first, c, second, h, close]) => {
      return `${name}(${open}${l}${first}${c}${second}${h}${close})`;
    });

  /** Text the grammar of R-04 accepts: a color in any form, padded by whitespace. */
  const grammar = fc
    .tuple(ws(0), fc.oneof(hexText, rgbText, oklchText), ws(0))
    .map(([before, text, after]) => `${before}${text}${after}`);

  /** Grammar text with a few characters inserted, so it sits right at the edge of the grammar. */
  const mutated = fc
    .tuple(grammar, fc.nat(), fc.string({ maxLength: 2 }))
    .map(([text, at, junk]) => {
      const cut = at % (text.length + 1);
      return `${text.slice(0, cut)}${junk}${text.slice(cut)}`;
    });

  const TOKENS = [
    "#",
    "rgb(",
    "RGB(",
    "oklch(",
    "(",
    ")",
    " ",
    "\t",
    "\n",
    ",",
    "/",
    "%",
    "none",
    "NaN",
    "Infinity",
    "0",
    "1",
    "7",
    "22",
    "255",
    "0.5",
    ".",
    "-",
    "+",
    "e",
    "E",
    "a",
    "f",
    "g",
  ];
  const nearMiss = fc
    .array(fc.constantFrom(...TOKENS), { maxLength: 24 })
    .map((parts) => parts.join(""));
  const anyString = fc.oneof(
    fc.string({ maxLength: 40 }),
    fc.string({ unit: "binary", maxLength: 40 }),
    nearMiss,
    grammar,
    mutated,
  );

  /** I-04 and I-03: finite l and c, and a hue exactly when chroma is above the achromatic limit. */
  function expectValidColor(color: Oklch): void {
    expect(Number.isFinite(color.l)).toBe(true);
    expect(Number.isFinite(color.c)).toBe(true);
    expect(color.h === null).toBe(color.c <= ACHROMATIC_CHROMA);
    if (color.h !== null) {
      expect(Number.isFinite(color.h)).toBe(true);
      expect(color.h).toBeGreaterThanOrEqual(0);
      expect(color.h).toBeLessThan(360);
    }
  }

  it("C-PARSE-16 returns a finite color or throws ColorParseError, for any string", () => {
    fc.assert(
      fc.property(anyString, (input) => {
        let color: Oklch;
        try {
          color = parseColor(input);
        } catch (error) {
          expect(error).toBeInstanceOf(ColorParseError);
          expect((error as ColorParseError).input).toBe(input);
          return;
        }
        expectValidColor(color);
      }),
      { numRuns: 500 },
    );
  });

  it("C-PARSE-17 never throws on strings built from the grammar", () => {
    fc.assert(
      fc.property(grammar, (input) => {
        expectValidColor(parseColor(input));
      }),
      { numRuns: 500 },
    );
  });
});
