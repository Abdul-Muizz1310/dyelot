// The record C-PROMPT-04 checks (docs/specs/04-ai.md, R4-19 and R4-51): each prompt's current
// version and the SHA-256 of its body. A body edit changes the hash, so the test fails until the
// file's `version` is raised and the new version and hash are written here, with the old pair
// kept in the comment above it.

import type { AiFeature } from "@/ai/features";

export const PROMPT_VERSIONS: Readonly<Record<AiFeature, { version: number; sha256: string }>> = {
  brief: { version: 1, sha256: "291001bcd1c6a2149b2b3a152f8057dcdcd4b578cf563f2eb9e8a408408ab7e1" },
  refine: {
    version: 1,
    sha256: "85636e1fed0bf79edb982cbeed778bd2cdf0ee617df55d92c39b879968d15c8d",
  },
  vibe: { version: 1, sha256: "c5eb8619088dac750154d39229422cf290a93e359fb15d544b2bd617bbddc662" },
  rationale: {
    version: 1,
    sha256: "b10abb81711e9c1d190c006db15b72d998c11882b0a531689bd04e835982dc97",
  },
  critique: {
    version: 1,
    sha256: "69d5533eca7623026101a879be5adc613642f8679afd7d34197f5c26698a8c74",
  },
};
