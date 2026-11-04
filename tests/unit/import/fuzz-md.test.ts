import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { lintSpec } from "@/engine";
import { importDesignMd } from "@/import/design-md";
import { normalizeSpec } from "@/spec";

// C-IMP-03, the DESIGN.md half (I-M3-05): 300 runs, seed 3012. Import never throws for a string.

const CODES = new Set([
  "empty",
  "too-large",
  "binary",
  "no-roles",
  "no-primary",
  "yaml",
  "yaml-alias",
  "yaml-group-twice",
  "yaml-too-large",
]);

const piece = fc.constantFrom(
  "---",
  "```yaml",
  "```",
  "````markdown",
  "~~~",
  "colors:",
  "typography:",
  "rounded:",
  "name: Tide",
  "description: A line",
  "  primary: '#3a6ea5'",
  '  primary: "#ffffff"',
  "  secondary: oklch(0.6 0.1 150)",
  "  tertiary: red",
  "  surface: '#000'",
  "  body-md:",
  "    fontFamily: Inter",
  "    fontSize: 1rem",
  "    fontSize: 4rem",
  "  lg: 8px",
  "  md: 4px",
  "&a",
  "*a",
  "<<: *a",
  "\t",
  "- x",
  "[",
  "]",
  "{",
  "}",
  '"',
  "'",
  ":",
  "? ",
  "|",
  ">",
  "# Heading",
  "## Overview",
  "## Do's and Don'ts",
  "- Do keep it short",
  "- Don't shout",
  "<!--",
  "-->",
  "<https://dyelot.vercel.app/studio#s=AAAA>",
  "https://dyelot.vercel.app/studio#s=rVzb",
  "words and more words",
  "",
  "�",
  "\ud800",
  "﻿",
);
const mdLike = fc.array(piece, { maxLength: 60 }).map((parts) => parts.join("\n"));

describe("C-IMP-03 importDesignMd never throws for a string", () => {
  it("returns an error code or a normalized, lintable spec", () => {
    const strings = fc.oneof(
      mdLike,
      fc.string({ maxLength: 4096 }),
      fc.string({ unit: "binary", maxLength: 2048 }),
      fc.string({ unit: "grapheme", maxLength: 2048 }),
      fc
        .integer({ min: 200_000, max: 270_000 })
        .chain((n) =>
          fc
            .constantFrom("a", "---\n", "[", "- Do x\n", "```yaml\n")
            .map((unit) => unit.repeat(Math.ceil(n / unit.length))),
        ),
      fc
        .array(mdLike, { minLength: 1, maxLength: 4 })
        .map((parts) => `---\ncolors:\n  primary: "#3a6ea5"\n${parts.join("\n")}\n---\n`),
      fc
        .array(mdLike, { minLength: 1, maxLength: 4 })
        .map((parts) => `---\ncolors:\n  primary: "#3a6ea5"\n---\n${parts.join("\n")}\n`),
    );
    fc.assert(
      fc.property(strings, (text) => {
        const result = importDesignMd(text);
        if (!result.ok) {
          expect(CODES.has(result.error.code)).toBe(true);
          expect(result.error.message.length).toBeGreaterThan(0);
          return;
        }
        expect(result.spec).toEqual(normalizeSpec(result.spec));
        expect(() => lintSpec(result.spec)).not.toThrow();
      }),
      { numRuns: 300, seed: 3012 },
    );
  });
});
