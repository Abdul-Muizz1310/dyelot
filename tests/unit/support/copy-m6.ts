import { NEVER_USE_HOSTS } from "@/lib/site/define";
import { copyProblems } from "../ai/copy-rules";

// M6's copy check (C-GUARD6-08, C-GUARD6-12): the M4 copy rules, plus the perceptual score's trade
// name, which C-CONTRAST-12 of M1 forbids in every text file under src/ (written the same way, case
// aside), and every host of the workspace's NEVER-USE list.

/** C-CONTRAST-12's pattern (tests/unit/engine/color/contrast.test.ts). */
const FORBIDDEN = /apca/i;

/** Every rule `text` breaks, named; an empty list when it follows them all. */
export function m6CopyProblems(text: string): readonly string[] {
  const problems = [...copyProblems(text)];
  if (FORBIDDEN.test(text)) problems.push("the perceptual score's trade name");
  const lower = text.toLowerCase();
  for (const host of NEVER_USE_HOSTS) {
    if (lower.includes(host)) problems.push(`never-use host "${host}"`);
  }
  return problems;
}
