import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ROOT, stripComments } from "./guard-support";

// The M5 repository guards (docs/specs/05-motion-3d.md, section 14, C-GUARD5-nn).

/** C-GUARD5-07: the tokens the web renderer's CSS subset leaves out (ruling R5-22). */
const SUBSET_TOKENS = [
  "zIndex",
  "z-index",
  "radial-gradient",
  "conic-gradient",
  "backdropFilter",
  "perspective",
  "transformStyle",
  "mixBlendMode",
  "objectPosition",
  "filter:",
  "inset",
  "clipPath",
  "oklch(",
  "rgb(",
  "rgba(",
  "hsl(",
  "url(",
] as const;

/** The forbidden tokens in `source`, comments removed. */
function subsetViolations(source: string): string[] {
  const code = stripComments(source);
  return SUBSET_TOKENS.filter((token) => code.includes(token));
}

describe("C-GUARD5-07 the composition keeps to the web renderer's CSS subset", () => {
  it("C-GUARD5-07 reports a probe of each forbidden token", () => {
    for (const token of SUBSET_TOKENS) {
      expect(subsetViolations(`const style = { x: "${token}" };`)).toEqual([token]);
    }
  });

  it("C-GUARD5-07 does not count a token inside a comment", () => {
    expect(subsetViolations(`// z-index, oklch(\n/* url( */ const a = 1;`)).toEqual([]);
  });

  it("C-GUARD5-07 finds none in brand-intro.tsx", () => {
    const file = path.join(ROOT, "src/flavor/remotion/brand-intro.tsx");
    expect(subsetViolations(readFileSync(file, "utf8"))).toEqual([]);
  });
});
