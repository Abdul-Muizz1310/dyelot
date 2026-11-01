import { ACHROMATIC_CHROMA, hexDigitsToRgb, normalizeHue, rgbToOklch } from "./convert";
import { ColorParseError } from "./errors";
import { describeType } from "./guards";
import type { Oklch, Rgb } from "./types";

export { ColorParseError };

// The grammar of spec R-04. `ws` is a space, tab, carriage return or line feed; a number is a
// CSS number: an optional sign, digits with an optional fraction or a bare fraction (`.5`), and an
// optional exponent.
const WS = String.raw`[ \t\r\n]`;
const NUMBER = String.raw`[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?`;

const HEX = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB_SPACES = new RegExp(
  String.raw`^rgb\(${WS}*(${NUMBER})${WS}+(${NUMBER})${WS}+(${NUMBER})${WS}*\)$`,
  "i",
);
const RGB_COMMAS = new RegExp(
  String.raw`^rgb\(${WS}*(${NUMBER})${WS}*,${WS}*(${NUMBER})${WS}*,${WS}*(${NUMBER})${WS}*\)$`,
  "i",
);
const OKLCH = new RegExp(
  String.raw`^oklch\(${WS}*(${NUMBER}%?)${WS}+(${NUMBER})${WS}+(${NUMBER}|none)${WS}*\)$`,
  "i",
);

const MAX_CHROMA = 0.5;

function isWhitespace(code: number): boolean {
  return code === 0x20 || code === 0x09 || code === 0x0d || code === 0x0a;
}

/** Trims `ws` only. `String.prototype.trim` also trims characters the grammar does not allow. */
function trimWhitespace(text: string): string {
  let start = 0;
  let end = text.length;
  while (start < end && isWhitespace(text.charCodeAt(start))) start++;
  while (end > start && isWhitespace(text.charCodeAt(end - 1))) end--;
  return text.slice(start, end);
}

/** The six digits of `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa`, with the alpha pair dropped. */
function sixDigits(digits: string): string {
  if (digits.length <= 4) {
    return `${digits[0]}${digits[0]}${digits[1]}${digits[1]}${digits[2]}${digits[2]}`;
  }
  return digits.slice(0, 6);
}

/**
 * sRGB to OKLCH with l held in [0, 1]. White converts to l 1.0000000000000002, which `oklch()`
 * would reject, and the Oklch that `parseColor` returns stays inside the domain it accepts.
 */
function fromSrgb(rgb: Rgb): Oklch {
  const color = rgbToOklch(rgb, "srgb");
  return { l: Math.min(1, Math.max(0, color.l)), c: color.c, h: color.h };
}

function parseRgb(input: string, text: string): Oklch {
  const match = RGB_SPACES.exec(text) ?? RGB_COMMAS.exec(text);
  if (match === null) {
    throw new ColorParseError(input, "Write rgb(r g b) or rgb(r, g, b) with plain numbers.");
  }
  const [r, g, b] = [Number(match[1]), Number(match[2]), Number(match[3])];
  for (const channel of [r, g, b]) {
    if (!(channel >= 0 && channel <= 255)) {
      throw new ColorParseError(input, "rgb channels run from 0 to 255.");
    }
  }
  return fromSrgb([r / 255, g / 255, b / 255]);
}

function parseOklch(input: string, text: string): Oklch {
  const match = OKLCH.exec(text);
  if (match === null) {
    throw new ColorParseError(input, "Write oklch(L C H) with no commas and no alpha.");
  }
  const lightness = match[1];
  const l = lightness.endsWith("%") ? Number(lightness.slice(0, -1)) / 100 : Number(lightness);
  if (!(l >= 0 && l <= 1)) {
    throw new ColorParseError(input, "L (lightness) runs from 0 to 1, or 0% to 100%.");
  }
  const c = Number(match[2]);
  if (!(c >= 0 && c <= MAX_CHROMA)) {
    throw new ColorParseError(input, "C (chroma) runs from 0 to 0.5.");
  }
  // CSS reads a missing hue as 0 in a conversion, so `none` is hue 0 on a chromatic color.
  const h = match[3].toLowerCase() === "none" ? 0 : Number(match[3]);
  if (!Number.isFinite(h)) {
    throw new ColorParseError(input, "H (hue) must be a finite number or none.");
  }
  // -0 passes the range checks above; Math.abs writes it as 0.
  return {
    l: Math.abs(l),
    c: Math.abs(c),
    h: c <= ACHROMATIC_CHROMA ? null : normalizeHue(h),
  };
}

/**
 * Reads a pasted color: `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb(r g b)`, `rgb(r, g, b)` or
 * `oklch(L C H)`, with spaces, tabs or newlines around it. Throws `ColorParseError` for anything
 * else, naming the input.
 */
export function parseColor(input: string): Oklch {
  if (typeof input !== "string") {
    throw new TypeError(`parseColor: input must be a string, got ${describeType(input)}`);
  }
  const text = trimWhitespace(input);
  const hex = HEX.exec(text);
  if (hex !== null) return fromSrgb(hexDigitsToRgb(sixDigits(hex[1])));
  if (text.startsWith("#")) {
    throw new ColorParseError(input, "Hex colors take 3, 4, 6 or 8 digits from 0 to 9 and a to f.");
  }
  if (/^rgb\(/i.test(text)) return parseRgb(input, text);
  if (/^oklch\(/i.test(text)) return parseOklch(input, text);
  throw new ColorParseError(input);
}
