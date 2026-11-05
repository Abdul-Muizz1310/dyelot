// Plain text (R3-02): the one rule every user-visible text of a spec follows.

// Built from strings so the escapes stay escapes in the source.
/** U+061C, U+200E, U+200F, U+202A to U+202E and U+2066 to U+2069. */
const BIDI_CLASS = String.raw`\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069`;
const SEPARATOR_CLASS = String.raw`\u2028\u2029`;
const BIDI = new RegExp(`[${BIDI_CLASS}]`, "gu");
/** A lone surrogate: with the `u` flag a well-formed pair is one code point, so only a lone one matches. */
const LONE_SURROGATE = /\p{Cs}/gu;
const NOT_PLAIN = new RegExp(`[\\p{Cc}${SEPARATOR_CLASS}${BIDI_CLASS}]|\\p{Cs}`, "u");
const SPACE_RUN = new RegExp(`[\\s\\p{Cc}${SEPARATOR_CLASS}]+`, "gu");
const EDGE_SPACE = /^\s|\s$/;
/**
 * NFC can shorten text by only a few code units per code point (a Hangul syllable or a base with
 * stacked marks), so a prefix longer than this can never fit, and the cut stops scanning there.
 */
const NFC_SHRINK_LIMIT = 8;

function describeType(value: unknown): string {
  return value === null ? "null" : typeof value;
}

/**
 * Whether `value` is plain text: at least one character, well formed, in NFC, with no control
 * character, line or paragraph separator or bidirectional control, and no white space at either
 * end. A value that is not a string is a bug in the caller, so it throws.
 */
export function isPlainText(value: string): boolean {
  if (typeof value !== "string") {
    throw new TypeError(`isPlainText: value must be a string, got ${describeType(value)}`);
  }
  return (
    value.length > 0 &&
    !NOT_PLAIN.test(value) &&
    !EDGE_SPACE.test(value) &&
    value === value.normalize("NFC")
  );
}

/** The longest prefix of whole code points whose NFC form has at most `max` code units. */
function longestFit(text: string, max: number): string {
  let best = "";
  let end = 0;
  for (const point of text) {
    end += point.length;
    if (end > max * NFC_SHRINK_LIMIT) break;
    const candidate = text.slice(0, end).normalize("NFC");
    if (candidate.length <= max) best = candidate;
  }
  return best;
}

/**
 * Raw text made plain, in the order of R3-02: drop bidirectional controls and lone surrogates,
 * collapse each run of white space and control characters to one space, NFC, trim, then, when it
 * is longer than `max` code units, cut to the longest prefix of whole code points that fits.
 * `null` means nothing is left.
 */
export function toPlainText(raw: string, max: number): { text: string; truncated: boolean } | null {
  if (typeof raw !== "string") {
    throw new TypeError(`toPlainText: raw must be a string, got ${describeType(raw)}`);
  }
  if (typeof max !== "number") {
    throw new TypeError(`toPlainText: max must be a number, got ${describeType(max)}`);
  }
  if (!Number.isInteger(max) || max < 1) {
    throw new RangeError(`toPlainText: max must be an integer of at least 1, got ${max}`);
  }
  const text = raw
    .replace(BIDI, "")
    .replace(LONE_SURROGATE, "")
    .replace(SPACE_RUN, " ")
    .normalize("NFC")
    .trim();
  if (text.length <= max) return text === "" ? null : { text, truncated: false };
  const cut = longestFit(text, max).trim();
  return cut === "" ? null : { text: cut, truncated: true };
}
