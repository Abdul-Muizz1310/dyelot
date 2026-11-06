import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { codeFiles, ROOT, stripComments } from "./guard-support";

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

/** C-GUARD5-08: what no file under src may hold (R5-02, R5-48, R5-58). */
const VIDEO_ELEMENT = /<video\b|createElement\(\s*["'`]video["'`]/;
const FLUSH_SYNC = /\bflushSync\b/;

/** The reasons `source`, comments removed, breaks the guard. */
function mediaViolations(source: string): string[] {
  const code = stripComments(source);
  const found: string[] = [];
  if (VIDEO_ELEMENT.test(code)) found.push("video element");
  if (FLUSH_SYNC.test(code)) found.push("flushSync");
  return found;
}

describe("C-GUARD5-08 no video element, no flushSync, no media-src or wasm in the CSP", () => {
  it("C-GUARD5-08 reports a probe of each", () => {
    expect(mediaViolations("const a = <video src={x} />;")).toEqual(["video element"]);
    expect(mediaViolations('document.createElement("video");')).toEqual(["video element"]);
    expect(mediaViolations("import { flushSync } from 'react-dom'; flushSync(f);")).toEqual([
      "flushSync",
    ]);
    expect(
      mediaViolations("// <video flushSync\n/* createElement('video') */ const a = 1;"),
    ).toEqual([]);
    const csp = "media-src 'self' 'wasm-unsafe-eval'";
    expect(csp.includes("media-src")).toBe(true);
    expect(csp.includes("'wasm-unsafe-eval'")).toBe(true);
  });

  it("C-GUARD5-08 finds none under src", () => {
    const problems = codeFiles(path.join(ROOT, "src")).flatMap((file) =>
      mediaViolations(readFileSync(file, "utf8")).map((reason) => `${file}: ${reason}`),
    );
    expect(problems).toEqual([]);
  });

  it("C-GUARD5-08 keeps media-src and 'wasm-unsafe-eval' out of csp.ts", () => {
    const code = stripComments(readFileSync(path.join(ROOT, "src/lib/site/csp.ts"), "utf8"));
    expect(code).not.toContain("media-src");
    expect(code).not.toContain("'wasm-unsafe-eval'");
  });
});
