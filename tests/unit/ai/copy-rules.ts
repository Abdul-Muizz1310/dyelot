// The copy rules of docs/specs/04-ai.md (section 2, R4-57 and 6.2), shared by C-AI-14 (labels and
// sentences), C-PROMPT-02 (the prompt bodies) and C-CHIP-03 (the chips' reasons): American English,
// none of the banned words, no exclamation mark and no emoji.

/** The words no copy may hold, matched as whole words in any case. */
export const BANNED_WORDS = ["simply", "just", "easy", "obviously", "basically"] as const;

/** The British spellings of section 6.2, matched at the start of a word in any case. */
export const BRITISH_SPELLINGS = [
  "colour",
  "behaviour",
  "centre",
  "organisation",
  "favourite",
  "grey",
  "licence",
  "analyse",
  "catalogue",
  "cancelled",
] as const;

const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u{FE0F}/u;

/** Whether `text` holds an emoji: a pictograph, a flag letter or an emoji presentation selector. */
export function hasEmoji(text: string): boolean {
  return EMOJI.test(text);
}

/** Every rule `text` breaks, named; an empty list when it follows them all. */
export function copyProblems(text: string): string[] {
  const problems: string[] = [];
  for (const word of BANNED_WORDS) {
    if (new RegExp(`\\b${word}\\b`, "i").test(text)) problems.push(`banned word "${word}"`);
  }
  for (const spelling of BRITISH_SPELLINGS) {
    if (new RegExp(`\\b${spelling}`, "i").test(text)) problems.push(`British "${spelling}"`);
  }
  if (text.includes("!")) problems.push("exclamation mark");
  if (hasEmoji(text)) problems.push("emoji");
  return problems;
}
