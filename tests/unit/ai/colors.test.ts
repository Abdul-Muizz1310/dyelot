import { describe, expect, it } from "vitest";
import { briefColors } from "@/ai/colors";
import { normalizeSeed, type Oklch, parseColor, type Rgb, rgbToOklch } from "@/engine";

// C-COLOR-01 to C-COLOR-04 of docs/specs/04-ai.md, section 14.4 (R4-40, section 7.5): the color
// literals of a brief become seeds, and `rest` is what the lexicon and the models read.

/** CSS Color 4's HSL to sRGB, written out here so the test does not borrow the reader under test. */
function hslToRgb(hue: number, saturation: number, lightness: number): Rgb {
  const h = ((hue % 360) + 360) % 360;
  const s = saturation / 100;
  const l = lightness / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

function hslSeed(hue: number, saturation: number, lightness: number): Oklch {
  const color = rgbToOklch(hslToRgb(hue, saturation, lightness), "srgb");
  return normalizeSeed({ ...color, l: Math.min(1, Math.max(0, color.l)) });
}

/** The same seed within rounding: L and C to 5 decimals, H within 0.1°. */
function expectSeed(actual: Oklch | undefined, expected: Oklch): void {
  expect(actual).toBeDefined();
  expect(actual?.l).toBeCloseTo(expected.l, 5);
  expect(actual?.c).toBeCloseTo(expected.c, 5);
  expect(expected.h).not.toBeNull();
  expect(Math.abs((actual?.h ?? Number.NaN) - (expected.h as number))).toBeLessThanOrEqual(0.1);
}

const BLUE = normalizeSeed(parseColor("#3a6ea5"));
const HSL_BLUE = hslSeed(210, 48, 44);

describe("C-COLOR-01 the colors a brief reads", () => {
  it.each([
    ["#3a6ea5", BLUE],
    ["#fab", normalizeSeed(parseColor("#ffaabb"))],
    ["#3a6ea580", BLUE],
    ["rgb(58 110 165)", BLUE],
    ["hsl(210 48% 44%)", HSL_BLUE],
    ["hsl(210, 48%, 44%)", HSL_BLUE],
    ["hsl(570deg 48% 44%)", HSL_BLUE],
    ["hsl(-150 48% 44%)", HSL_BLUE],
    ["hsl(210 48% 44% / 50%)", HSL_BLUE],
    ["OKLCH(0.5 0.1 250)", normalizeSeed({ l: 0.5, c: 0.1, h: 250 })],
  ])("C-COLOR-01 reads %s as one seed and keeps the words around it", (literal, expected) => {
    const { seeds, rest } = briefColors(`calm ${literal} dusk`);
    expect(seeds).toHaveLength(1);
    expectSeed(seeds[0], expected);
    expect(rest).toBe("calm   dusk");
  });

  it("C-COLOR-01 the HSL reader agrees with the same color written as rgb()", () => {
    const [r, g, b] = hslToRgb(210, 48, 44).map((channel) => channel * 255);
    expectSeed(
      briefColors("hsl(210 48% 44%)").seeds[0],
      normalizeSeed(parseColor(`rgb(${r} ${g} ${b})`)),
    );
    // White converts to L 1.0000000000000002: the reader clamps L before normalizeSeed, as parseColor does.
    expect(briefColors("hsl(0 0% 100%)").seeds).toEqual([normalizeSeed(parseColor("#ffffff"))]);
    expect(briefColors("hsl(0 0% 100%)").seeds[0]).toMatchObject({ l: 1, h: null });
  });

  it("C-COLOR-01 four colors give the first three in text order, and every read color leaves rest", () => {
    const { seeds, rest } = briefColors("#3a6ea5 then #b8422e, #f2e6d0 and #1a1c1e");
    expect(seeds).toEqual(
      ["#3a6ea5", "#b8422e", "#f2e6d0"].map((hex) => normalizeSeed(parseColor(hex))),
    );
    expect(rest).toBe("  then  ,   and  ");
  });
});

describe("C-COLOR-02 text that is not a color", () => {
  it.each([
    "#fabulous",
    "#1",
    "#12",
    "#12345",
    "rgb(oops)",
    "hsl(1 2 3)",
    "rgba(1 2 3)",
    "hsl(1 101% 3%)",
  ])("C-COLOR-02 %j is no seed and stays in rest", (text) => {
    expect(briefColors(`a ${text} b`)).toEqual({ seeds: [], rest: `a ${text} b` });
  });

  it("C-COLOR-02 #cafe is a four-digit hex and becomes a seed", () => {
    expect(briefColors("#cafe")).toEqual({
      seeds: [normalizeSeed(parseColor("#ccaaff"))],
      rest: " ",
    });
  });
});

describe("C-COLOR-03 failures", () => {
  it("C-COLOR-03 a brief that is not a string is a TypeError naming briefColors", () => {
    expect(() => briefColors(5 as unknown as string)).toThrow(TypeError);
    expect(() => briefColors(5 as unknown as string)).toThrow(/^briefColors: /);
  });
});

describe("C-COLOR-04 the no-letter rule's input", () => {
  it("C-COLOR-04 a brief of colors alone leaves no letter in rest", () => {
    const { seeds, rest } = briefColors("#b8422e, oklch(0.62 0.14 250)");
    expect(seeds).toHaveLength(2);
    expect(rest).not.toMatch(/\p{L}/u);
  });

  it("C-COLOR-04 a word between the colors stays, so a provider runs", () => {
    const { seeds, rest } = briefColors("#b8422e and oklch(0.62 0.14 250)");
    expect(seeds).toHaveLength(2);
    expect(rest).toMatch(/\p{L}/u);
    expect(rest).toContain("and");
  });
});
