import type { LexiconEntry } from "@/ai/lexicon/match";

// FIXTURE_LEXICON of docs/specs/04-ai.md, section 7.4: the table's ten entries in its order. It drives
// the matcher's cases (C-LEX-01 to 07 and RF2), so a tie's winner and a hue's mean are known by hand.
// It is for the matcher only and need not follow 7.1's hue rule (`tea house` is warm at 140).

export const FIXTURE_LEXICON: readonly LexiconEntry[] = Object.freeze([
  {
    term: "tea house",
    category: "place",
    weight: 3,
    set: { hues: { primary: 140 }, neutralTint: "warm", pairing: "young-onest" },
  },
  {
    term: "dusk",
    category: "mood",
    weight: 2,
    set: { hues: { primary: 280 }, neutralTint: "cool" },
  },
  { term: "calm", category: "mood", weight: 2, set: { chroma: "muted", motion: "calm" } },
  {
    term: "fintech",
    category: "industry",
    weight: 3,
    set: { hues: { primary: 250 }, contrastLevel: "AA+", typeContext: "product" },
  },
  { term: "tea", category: "material", weight: 1, set: { hues: { primary: 100 } } },
  { term: "glow", category: "style", weight: 1, set: { chroma: "vivid" } },
  { term: "neon", category: "style", weight: 2, set: { chroma: "vivid" } },
  { term: "red", category: "mood", weight: 1, set: { hues: { primary: 0 } } },
  { term: "teal", category: "mood", weight: 1, set: { hues: { primary: 180 } } },
  { term: "harbor", category: "place", weight: 1, set: { hues: { secondary: 220 } } },
] satisfies LexiconEntry[]);
