import { LOCKABLE, type Lockable } from "@/engine";
import { describeType } from "../assert";
import type { BriefDraft, Hue } from "../features";
import { LEXICON } from "./data";

// The lexicon's matcher (docs/specs/04-ai.md, R4-43 and section 7.4): the brief's rule-based path,
// which runs when no model answers. It normalizes the text, matches two-word terms before one-word
// terms at each position, accepts a term's word with one of a few suffixes, then votes each field by
// weight and combines hues by weighted circular mean. No model, no randomness: the same text and
// lexicon always give the same result.

export type LexiconCategory = "mood" | "industry" | "material" | "place" | "era" | "style";
export type LexiconEntry = {
  /** One or two words of `a` to `z` joined by one space, distinct across the data (7.1). */
  readonly term: string;
  readonly category: LexiconCategory;
  readonly weight: 1 | 2 | 3;
  /** A non-empty draft with no name, one-liner or adjectives. */
  readonly set: BriefDraft;
};
export type LexiconMatch = {
  /** The matched terms in text order, each once. */
  readonly terms: readonly string[];
  /** `null` when no term matched; `{}` when the matched terms set only hues that cancel. */
  readonly draft: BriefDraft | null;
};

/** The longest text the matcher reads: the cleaned brief's bound (R4-39). */
const TEXT_MAX = 500;
const SUFFIXES: readonly string[] = ["", "s", "es", "ed", "ing", "ly", "y"];
/** Below this length the weighted hue vector has no direction: the hues cancel. */
const CANCEL = 1e-6;
const FULL_TURN = 360;

/** The enum fields a draft votes on, in the order of `BriefOutput`. */
const VOTED_FIELDS = [
  "chroma",
  "neutralTint",
  "harmony",
  "contrastLevel",
  "preset",
  "pairing",
  "typeContext",
  "radius",
  "depth",
  "motion",
] as const;
type VotedField = (typeof VOTED_FIELDS)[number];

/**
 * The words of `text` as the matcher reads them: NFKD with the marks removed, lowercased, split on
 * every run of characters outside `a` to `z`. Exported for C-CHIP-08; not in the entry.
 */
export function words(text: string): string[] {
  if (typeof text !== "string") {
    throw new TypeError(`words: text must be a string, got ${describeType(text)}`);
  }
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((word) => word !== "");
}

/** Whether `token` is `word` or `word` with one of the suffixes. */
function same(token: string, word: string): boolean {
  return token.startsWith(word) && SUFFIXES.includes(token.slice(word.length));
}

/** The matched entries' indexes in `lexicon`, in text order, each once (7.4). */
function matchedIndexes(tokens: readonly string[], lexicon: readonly LexiconEntry[]): number[] {
  const parts = lexicon.map(({ term }) => term.split(" "));
  const matched: number[] = [];
  for (let i = 0; i < tokens.length; ) {
    const token = tokens[i] as string;
    const next = tokens[i + 1];
    const pair = parts.findIndex(
      ([a, b]) =>
        b !== undefined && next !== undefined && same(token, a as string) && same(next, b),
    );
    const hit =
      pair !== -1 ? pair : parts.findIndex(([a, b]) => b === undefined && same(token, a as string));
    if (hit !== -1 && !matched.includes(hit)) matched.push(hit);
    i += pair === -1 ? 1 : 2;
  }
  return matched;
}

/**
 * The value of one field with the largest total weight among the matched entries that vote for it.
 * A tie goes to the value whose first voter comes earliest in the lexicon (its index), not the text.
 */
function vote(field: VotedField, matched: readonly number[], lexicon: readonly LexiconEntry[]) {
  const totals = new Map<string, { total: number; first: number }>();
  for (const index of matched) {
    const { set, weight } = lexicon[index] as LexiconEntry;
    const value = set[field];
    if (value === undefined) continue;
    const held = totals.get(value);
    totals.set(value, {
      total: (held?.total ?? 0) + weight,
      first: Math.min(held?.first ?? index, index),
    });
  }
  let best: { value: string; total: number; first: number } | undefined;
  for (const [value, { total, first }] of totals) {
    if (best === undefined || total > best.total || (total === best.total && first < best.first)) {
      best = { value, total, first };
    }
  }
  return best?.value;
}

/** The weighted circular mean of one slot's hues, or undefined when none is set or they cancel. */
function meanHue(
  slot: Lockable,
  matched: readonly number[],
  lexicon: readonly LexiconEntry[],
): Hue | undefined {
  let x = 0;
  let y = 0;
  let any = false;
  for (const index of matched) {
    const { set, weight } = lexicon[index] as LexiconEntry;
    const hue = set.hues?.[slot];
    if (hue === undefined) continue;
    any = true;
    const radians = (hue * Math.PI) / 180;
    x += weight * Math.cos(radians);
    y += weight * Math.sin(radians);
  }
  if (!any || Math.hypot(x, y) < CANCEL) return undefined;
  const degrees = (Math.atan2(y, x) * 180) / Math.PI;
  return Math.round(((degrees % FULL_TURN) + FULL_TURN) % FULL_TURN) % FULL_TURN;
}

/** The winning fields of the matched entries: hues per slot, then each voted field. */
function draftOf(matched: readonly number[], lexicon: readonly LexiconEntry[]): BriefDraft {
  const hues: Partial<Record<Lockable, Hue>> = {};
  for (const slot of LOCKABLE) {
    const hue = meanHue(slot, matched, lexicon);
    if (hue !== undefined) hues[slot] = hue;
  }
  const draft: Record<string, unknown> = {};
  if (Object.keys(hues).length > 0) draft.hues = Object.freeze(hues);
  for (const field of VOTED_FIELDS) {
    const value = vote(field, matched, lexicon);
    if (value !== undefined) draft[field] = value;
  }
  return Object.freeze(draft) as BriefDraft;
}

/**
 * The terms of `lexicon` a brief holds and the draft they vote for (R4-43). `text` is a string of at
 * most 500 characters, `lexicon` an array; anything else throws naming `matchLexicon`. No term gives
 * `{ terms: [], draft: null }`, and the lexicon then changes nothing.
 */
export function matchLexicon(
  text: string,
  lexicon: readonly LexiconEntry[] = LEXICON,
): LexiconMatch {
  if (typeof text !== "string") {
    throw new TypeError(`matchLexicon: text must be a string, got ${describeType(text)}`);
  }
  if (text.length > TEXT_MAX) {
    throw new RangeError(
      `matchLexicon: text must be at most ${TEXT_MAX} characters, got ${text.length}`,
    );
  }
  if (!Array.isArray(lexicon)) {
    throw new TypeError(`matchLexicon: lexicon must be an array, got ${describeType(lexicon)}`);
  }
  const matched = matchedIndexes(words(text), lexicon);
  return Object.freeze({
    terms: Object.freeze(matched.map((index) => (lexicon[index] as LexiconEntry).term)),
    draft: matched.length === 0 ? null : draftOf(matched, lexicon),
  });
}
