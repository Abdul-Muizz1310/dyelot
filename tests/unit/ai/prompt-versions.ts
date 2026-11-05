// The record C-PROMPT-04 checks (docs/specs/04-ai.md, R4-19 and R4-51): each prompt's current
// version and the SHA-256 of its body. A body edit changes the hash, so the test fails until the
// file's `version` is raised and the new version and hash are written here, with the old pair
// kept in the comment above it.

import type { AiFeature } from "@/ai/features";

export const PROMPT_VERSIONS: Readonly<Record<AiFeature, { version: number; sha256: string }>> = {
  brief: { version: 2, sha256: "bc6762b74c2cb36df405b57fa431e0feda351d9540b571e5567e968c0cf7d10f" },
  refine: {
    version: 2,
    sha256: "54e62ea56276c61e072ad3bb47eb420cb7c454b5aa948a60dc05e8ca043b383f",
  },
  vibe: { version: 2, sha256: "c0b009ada99a0410496ad2b18a166ada98042b7a42c2ab38dd3626e89b87ba23" },
  rationale: {
    version: 2,
    sha256: "ed0e8a1f932922f19daf2d1a26225f463a797ff4fd89357223d806543072dae9",
  },
  critique: {
    version: 2,
    sha256: "c47601dda1dbd8e5ece5f28418178d939ad799fb4ba075a9f21eeef3a8dcbe97",
  },
};
