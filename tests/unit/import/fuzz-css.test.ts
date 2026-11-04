import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { lintSpec } from "@/engine";
import { importShadcnCss } from "@/import/css";
import { normalizeSpec } from "@/spec";

// C-IMP-03, the CSS half (I-M3-05): 300 runs, seed 3005. Import never throws for a string.

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
  ":root",
  ".dark",
  "html",
  ".light",
  '[data-theme="dark"]',
  "@media (prefers-color-scheme: dark)",
  "@layer base",
  "@theme inline",
  "{",
  "}",
  "{",
  "}",
  ";",
  ":",
  ",",
  "--primary",
  "--background",
  "--foreground",
  "--radius",
  "--font-sans",
  "--font-serif",
  "--ring",
  "--border",
  "var(--primary)",
  "oklch(0.7 0.17 22)",
  "oklch(1 0 0)",
  "oklch(0 0 0)",
  "color(srgb 1 1 1)",
  "color(display-p3 1 1 1)",
  "lab(100 0 0)",
  "rgb(1000 1000 1000)",
  "#ffffff",
  "#000",
  "oklch(0.7 0.4 145 / 50%)",
  "#3a6ea5",
  "#fff",
  "rgb(0 0 0 / 50%)",
  "0 0% 100%",
  "222.2 84% 4.9%",
  "hsl(",
  ")",
  "(",
  '"',
  "'",
  "/*",
  "*/",
  "\\",
  "!important",
  "0.625rem",
  "10px",
  "Inter, sans-serif",
  " ",
  "\n",
  "\r\n",
  "﻿",
  "�",
  "\ud800",
);
const cssLike = fc.array(piece, { maxLength: 80 }).map((parts) => parts.join(" "));

describe("C-IMP-03 importShadcnCss never throws for a string", () => {
  it("returns an error code or a normalized, lintable spec", () => {
    const strings = fc.oneof(
      cssLike,
      fc.string({ maxLength: 4096 }),
      fc.string({ unit: "binary", maxLength: 2048 }),
      fc.string({ unit: "grapheme", maxLength: 2048 }),
      fc
        .integer({ min: 200_000, max: 270_000 })
        .chain((n) =>
          fc
            .constantFrom("a", "{", "--primary: red;", ":root{")
            .map((unit) => unit.repeat(Math.ceil(n / unit.length))),
        ),
      fc
        .array(cssLike, { minLength: 1, maxLength: 4 })
        .map((parts) => `:root { --primary: #3a6ea5; ${parts.join("\n")} }`),
    );
    fc.assert(
      fc.property(strings, (text) => {
        const result = importShadcnCss(text);
        if (!result.ok) {
          expect(CODES.has(result.error.code)).toBe(true);
          expect(result.error.message.length).toBeGreaterThan(0);
          return;
        }
        expect(result.spec).toEqual(normalizeSpec(result.spec));
        expect(() => lintSpec(result.spec)).not.toThrow();
      }),
      { numRuns: 300, seed: 3005 },
    );
  });
});
