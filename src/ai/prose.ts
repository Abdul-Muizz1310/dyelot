import { toPlainText } from "@/spec";
import { assertInteger, assertString } from "./assert";

// The value check every model string passes (R4-38 (3)): plain text, then the hard prose rules. A
// model never writes a color (I-M4-01) and never names the perceptual contrast score (DR-0038). The
// soft rules (no emoji, no exclamation mark, none of the banned words) are the prompts' to ask for,
// not a reason to fail a tier (section 21, item 5).

/** `#` and 3, 4, 6 or 8 hex digits not followed by a word character. */
const HEX_LITERAL = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})(?!\w)/i;
/**
 * A CSS color function's name and its parenthesis, in any case. The name starts a word, as in the
 * brief's color pattern (7.5), so "watercolor(ish)" is prose, not `color(`.
 */
const COLOR_FUNCTION = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i;
/**
 * The perceptual score's name as a word, in any case (DR-0038). One letter sits in a class so that
 * the name itself never appears in src/ (I-10 of the M1 spec, C-CONTRAST-12): this pattern rejects
 * the name, and the bundle never carries it.
 */
const SCORE_NAME = /\ba[p]ca\b/i;

/**
 * A model string made plain (`toPlainText(raw, max)`), or `null` when nothing is left or the text
 * holds a color literal or the perceptual score's name. The rules read the plain text, the text a
 * visitor sees.
 */
export function cleanModelText(raw: string, max: number): string | null {
  assertString(raw, "cleanModelText: raw");
  assertInteger(max, 1, Number.MAX_SAFE_INTEGER, "cleanModelText: max");
  const plain = toPlainText(raw, max);
  if (plain === null) return null;
  const { text } = plain;
  return HEX_LITERAL.test(text) || COLOR_FUNCTION.test(text) || SCORE_NAME.test(text) ? null : text;
}
