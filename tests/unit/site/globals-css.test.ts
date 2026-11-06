import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// The view-transition rules (R5-48, section 10.3).

const CSS = readFileSync(path.resolve(import.meta.dirname, "../../../src/app/globals.css"), "utf8");
const squash = (text: string) => text.replace(/\s+/g, " ").trim();

describe("globals.css view-transition rules", () => {
  const css = squash(CSS);

  it("C-VT-08 holds 10.3's five rules as written", () => {
    const rules = [
      "::view-transition { pointer-events: none; }",
      "::view-transition-old(root) { display: none; }",
      "::view-transition-new(root) { animation: none; }",
      "::view-transition-group(.dyelot-morph) { animation-duration: 250ms; animation-timing-function: cubic-bezier(0.2, 0, 0, 1); }",
      "@media (prefers-reduced-motion: reduce) { ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) { animation-duration: 0s !important; animation-delay: 0s !important; } }",
    ];
    for (const rule of rules) expect(css, rule).toContain(rule);
  });

  it("C-VT-08 places them after the reduced-motion block", () => {
    expect(css.indexOf("::view-transition {")).toBeGreaterThan(
      css.indexOf("@media (prefers-reduced-motion: reduce) { .cursor-blink"),
    );
  });
});
