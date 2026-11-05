import {
  ColorParseError,
  normalizeSeed,
  type Oklch,
  parseColor,
  type Rgb,
  rgbToOklch,
} from "@/engine";
import { describeType } from "./assert";

// Colors in a brief (docs/specs/04-ai.md, R4-40 and section 7.5). The visitor typed them, so they
// become locked seeds before any provider reads the brief, and `rest`, the brief without them, is
// what the lexicon and the models read. When `rest` holds no letter, no provider runs.

/** Section 7.5's pattern, verbatim: a hex of 3, 4, 6 or 8 digits, or an rgb(), hsl() or oklch(). */
const COLOR_LITERAL =
  /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})(?![0-9a-z_])|\b(?:rgb|hsl|oklch)\([^()]{0,80}\)/gi;

/** The most seeds a brief gives: primary, secondary and accent, in that order. */
const SEEDS_MAX = 3;
const FULL_TURN = 360;
const PERCENT = 100;

// The grammar of `parseColor` (spec R-04), for the HSL reader `parseColor` does not have: `ws` is a
// space, tab, carriage return or line feed, and a number is a CSS number.
const WS = String.raw`[ \t\r\n]`;
const NUMBER = String.raw`[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?`;
/** `hsl(<h>[deg] <s>% <l>%[ / <a>])`. */
const HSL_SPACES = new RegExp(
  String.raw`^hsl\(${WS}*(${NUMBER})(?:deg)?${WS}+(${NUMBER})%${WS}+(${NUMBER})%(?:${WS}*\/${WS}*${NUMBER}%?)?${WS}*\)$`,
  "i",
);
/** `hsl(<h>, <s>%, <l>%)`. */
const HSL_COMMAS = new RegExp(
  String.raw`^hsl\(${WS}*(${NUMBER})${WS}*,${WS}*(${NUMBER})%${WS}*,${WS}*(${NUMBER})%${WS}*\)$`,
  "i",
);

/** CSS Color 4's HSL to sRGB in [0, 1], for a hue in degrees and saturation and lightness in %. */
function hslToRgb(hue: number, saturation: number, lightness: number): Rgb {
  const s = saturation / PERCENT;
  const l = lightness / PERCENT;
  const chroma = s * Math.min(l, 1 - l);
  const channel = (n: number) => {
    const k = (n + hue / 30) % 12;
    return l - chroma * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [channel(0), channel(8), channel(4)];
}

/** An `hsl()` literal as OKLCH, or null when it does not read. */
function readHsl(literal: string): Oklch | null {
  const match = HSL_SPACES.exec(literal) ?? HSL_COMMAS.exec(literal);
  if (match === null) return null;
  const [h, s, l] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (!Number.isFinite(h) || !(s >= 0 && s <= PERCENT) || !(l >= 0 && l <= PERCENT)) return null;
  return rgbToOklch(hslToRgb(((h % FULL_TURN) + FULL_TURN) % FULL_TURN, s, l), "srgb");
}

/** One literal of the pattern as a seed, or null when it does not read: then it is not a color. */
function readLiteral(literal: string): Oklch | null {
  let color: Oklch | null;
  if (/^hsl\(/i.test(literal)) {
    color = readHsl(literal);
  } else {
    try {
      color = parseColor(literal);
    } catch (error) {
      if (!(error instanceof ColorParseError)) throw error;
      color = null;
    }
  }
  return color === null
    ? null
    : normalizeSeed({ ...color, l: Math.min(1, Math.max(0, color.l)) }, "briefColors: color");
}

/**
 * The color literals of a brief, left to right (R4-40): the first three that read, as normalized
 * seeds for primary, secondary and accent, and `rest`, the text with every literal that read replaced
 * by one space. A literal that does not read stays in `rest`.
 */
export function briefColors(text: string): {
  readonly seeds: readonly Oklch[];
  readonly rest: string;
} {
  if (typeof text !== "string") {
    throw new TypeError(`briefColors: text must be a string, got ${describeType(text)}`);
  }
  const seeds: Oklch[] = [];
  const rest = text.replace(COLOR_LITERAL, (literal) => {
    const seed = readLiteral(literal);
    if (seed === null) return literal;
    if (seeds.length < SEEDS_MAX) seeds.push(seed);
    return " ";
  });
  return Object.freeze({ seeds: Object.freeze(seeds), rest });
}
