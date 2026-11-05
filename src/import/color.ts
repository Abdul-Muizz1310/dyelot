// Reads one CSS color value into sRGB channels with @csstools/css-color-parser (R3-31). The
// channels keep any value outside [0, 1], so `buildImport` can gamut-map the color (R3-29).

import { color } from "@csstools/css-color-parser";
import { type ComponentValue, parseComponentValue } from "@csstools/css-parser-algorithms";
import { tokenize } from "@csstools/css-tokenizer";
import type { Rgb } from "@/engine";

/** A color read from CSS. `rgb` may lie outside [0, 1]; `inGamut` says whether it does not. */
export type ParsedColor = {
  readonly rgb: Rgb;
  readonly alpha: number;
  readonly inGamut: boolean;
  readonly source: string;
};

/** The tolerance of `toHex`: a channel this close to [0, 1] is in gamut. */
const GAMUT_TOLERANCE = 1e-6;

/** A channel further than this from [0, 1] is a color no display can show; the value is rejected. */
const CHANNEL_LIMIT = 1_000;

/** shadcn v3's bare form: `222.2 84% 4.9%`, with an optional `/ alpha`. */
const HSL_TRIPLE =
  /^[+-]?(?:\d+\.?\d*|\.\d+)(?:deg)?\s+(?:\d+\.?\d*|\.\d+)%\s+(?:\d+\.?\d*|\.\d+)%(?:\s*\/\s*(?:\d+\.?\d*|\.\d+)%?)?$/i;

/** A value with surrounding white space and a trailing `!important` removed (R3-31). */
export function cleanValue(value: string): string {
  return value.replace(/\s*!\s*important\s*$/i, "").trim();
}

/** The one component value of `css`, or `null` when the text holds none, more than one, or a parse error. */
function parseOne(css: string): ComponentValue | null {
  let failed = false;
  const onParseError = () => {
    failed = true;
  };
  const value = parseComponentValue(tokenize({ css }, { onParseError }), { onParseError });
  return failed || value === undefined ? null : value;
}

/**
 * The color a CSS value names, or `null` when the parser rejects it, reads it with a parse error
 * or cannot place it in sRGB. A bare HSL triple reads as `hsl(...)`. Never throws.
 */
export function parseCssColor(value: string): ParsedColor | null {
  try {
    const source = cleanValue(value);
    const text = HSL_TRIPLE.test(source) ? `hsl(${source})` : source;
    const parsed = parseOne(text);
    if (parsed === null || color(parsed) === false) return null;
    // Relative color syntax keeps channels outside [0, 1], which a plain serialization would clip.
    const converted = parseOne(`color(from ${text} srgb r g b / alpha)`);
    const data = converted === null ? false : color(converted);
    if (data === false || data.colorNotation !== "srgb") return null;
    const [r, g, b] = data.channels;
    const alpha = data.alpha;
    if (typeof alpha !== "number" || !Number.isFinite(alpha)) return null;
    const rgb: Rgb = [r, g, b];
    if (!rgb.every((channel) => Number.isFinite(channel) && Math.abs(channel) <= CHANNEL_LIMIT)) {
      return null;
    }
    return {
      rgb,
      alpha: Math.min(1, Math.max(0, alpha)),
      inGamut: rgb.every(
        (channel) => channel >= -GAMUT_TOLERANCE && channel <= 1 + GAMUT_TOLERANCE,
      ),
      source,
    };
  } catch {
    return null;
  }
}
