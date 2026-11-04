// Guesses which importer reads a text (spec section 8). Pure; never throws for a string.

import type { ImportFormat } from "./report";
import { describeType } from "./report";

const CSS_RULE = /(?::root|\.dark)\s*\{/;
const CSS_DECLARATION = /--(?:background|primary)\s*:/;

/**
 * `"design-md"` for a file name ending `.md` or `.markdown`, `"shadcn-css"` for one ending `.css`,
 * whatever the text. Without such a name: `"design-md"` when the first non-empty line is `---` or
 * a line starts with `## Colors`; `"shadcn-css"` when the text holds `:root` or `.dark` before a
 * `{`, or declares `--background` or `--primary`; otherwise `null`.
 */
export function detectImport(text: string, fileName?: string): ImportFormat | null {
  if (typeof text !== "string") {
    throw new TypeError(`detectImport: text must be a string, got ${describeType(text)}`);
  }
  if (fileName !== undefined && typeof fileName !== "string") {
    throw new TypeError(
      `detectImport: fileName must be a string or absent, got ${describeType(fileName)}`,
    );
  }
  const name = fileName?.toLowerCase() ?? "";
  if (name.endsWith(".md") || name.endsWith(".markdown")) return "design-md";
  if (name.endsWith(".css")) return "shadcn-css";
  const lines = text.replace(/^﻿/, "").split(/\r\n|\r|\n/);
  const first = lines.find((line) => line.trim() !== "");
  if (first?.trim() === "---" || lines.some((line) => line.startsWith("## Colors"))) {
    return "design-md";
  }
  return CSS_RULE.test(text) || CSS_DECLARATION.test(text) ? "shadcn-css" : null;
}
