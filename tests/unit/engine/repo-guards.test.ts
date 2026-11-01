import { readdirSync, readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";
import config from "../../../vitest.config";

// C-REPO-01, C-REPO-02 and C-REPO-04 of docs/specs/01-color-engine.md, section 6.9. C-REPO-03
// lives in environment.test.ts, one copy per folder.

const ROOT = path.resolve(import.meta.dirname, "../../..");
const ENGINE_DIR = path.join(ROOT, "src/engine");
const SPEC_DIR = path.join(ROOT, "src/spec");
const CODE_FILE = /\.[cm]?[jt]sx?$/;

/** Every code file under `directory`, or none when the folder does not exist yet. */
function codeFiles(directory: string): string[] {
  try {
    return readdirSync(directory, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && CODE_FILE.test(entry.name))
      .map((entry) => path.join(entry.parentPath, entry.name));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

/**
 * Removes `//` and block comments so a comment that names a forbidden API cannot trip a grep.
 * String and template literals pass through untouched, so a `//` inside "https://…" does not
 * hide the code after it.
 */
function stripComments(source: string): string {
  let out = "";
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    const next = source[i + 1];
    if (char === "/" && next === "/") {
      while (i < source.length && source[i] !== "\n") i++;
    } else if (char === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2);
      i = end === -1 ? source.length : end + 2;
      out += " ";
    } else if (char === '"' || char === "'" || char === "`") {
      out += char;
      i++;
      while (i < source.length && source[i] !== char) {
        out += source[i];
        if (source[i] === "\\") {
          i++;
          out += source[i] ?? "";
        }
        i++;
      }
      out += source[i] ?? "";
      i++;
    } else {
      out += char;
      i++;
    }
  }
  return out;
}

// The patterns of C-REPO-01, with the controller's two refinements: `new Date` tolerates any
// whitespace, and a bare `Date(` call counts as well.
const FORBIDDEN: ReadonlyArray<readonly [name: string, pattern: RegExp]> = [
  ["Math.random", /Math\.random/],
  ["new Date", /\bnew\s+Date\b/],
  ["Date call", /\bDate\s*\(/],
  ["Date.now, Date.parse or Date.UTC", /\bDate\.(?:now|parse|UTC)\b/],
  ["window.", /\bwindow\./],
  ["document.", /\bdocument\./],
  ["navigator.", /\bnavigator\./],
  ["web storage", /\b(?:localStorage|sessionStorage|indexedDB)\b/],
  ["process", /\bprocess\.(?:env|argv|cwd|exit|platform)\b/],
  ["Buffer", /\bBuffer\.(?:from|alloc)\b/],
  ["require", /\brequire\(/],
];

const NODE_MODULES = new Set(builtinModules);
const FRAMEWORKS = new Set(["react", "react-dom", "next"]);

/** Module specifiers named by `import … from`, `import "…"`, `import("…")` and `export … from`. */
function specifiers(source: string): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+)["']/g)) {
    found.push(match[1]);
  }
  return found;
}

/** An import from `node:…`, a Node built-in, React or Next. */
function isForbiddenSpecifier(specifier: string): boolean {
  if (specifier.startsWith("node:")) return true;
  const root = specifier.split("/")[0];
  return NODE_MODULES.has(specifier) || NODE_MODULES.has(root) || FRAMEWORKS.has(root);
}

/** The names of the forbidden APIs and imports in one source file, comments aside. */
function purityViolations(source: string): string[] {
  const code = stripComments(source);
  const found = FORBIDDEN.filter(([, pattern]) => pattern.test(code)).map(([name]) => name);
  for (const specifier of specifiers(code)) {
    if (isForbiddenSpecifier(specifier)) found.push(`import "${specifier}"`);
  }
  return found;
}

/** Whether `specifier`, written in `file`, points into src/spec. */
function importsFromSpec(file: string, specifier: string): boolean {
  if (specifier === "@/spec" || specifier.startsWith("@/spec/")) return true;
  if (!specifier.startsWith(".")) return false;
  const resolved = path.resolve(path.dirname(file), specifier);
  return resolved === SPEC_DIR || resolved.startsWith(SPEC_DIR + path.sep);
}

describe("C-REPO-01 the pure core uses no impure API", () => {
  const files = [...codeFiles(ENGINE_DIR), ...codeFiles(SPEC_DIR)];

  it("scans real files, so the grep cannot pass by looking at nothing", () => {
    expect(codeFiles(ENGINE_DIR).length).toBeGreaterThan(0);
    expect(codeFiles(SPEC_DIR).length).toBeGreaterThan(0);
  });

  it("finds no randomness, clock, DOM, storage, Node or framework use in src/engine or src/spec", () => {
    const violations = files.flatMap((file) =>
      purityViolations(readFileSync(file, "utf8")).map(
        (name) => `${path.relative(ROOT, file)}: ${name}`,
      ),
    );
    expect(violations).toEqual([]);
  });

  describe("the grep itself", () => {
    it.each([
      ["Math.random", "const x = Math.random();"],
      ["new Date", "const now = new Date();"],
      ["new Date", "const now = new   Date(0);"],
      ["Date call", "const text = Date();"],
      ["Date.now, Date.parse or Date.UTC", "const t = Date.now();"],
      ["Date.now, Date.parse or Date.UTC", "const t = Date.parse(text);"],
      ["Date.now, Date.parse or Date.UTC", "const t = Date.UTC(2026, 0);"],
      ["window.", "const w = window.innerWidth;"],
      ["document.", "document.body.append(node);"],
      ["navigator.", "const lang = navigator.language;"],
      ["web storage", "const saved = localStorage.getItem('x');"],
      ["web storage", "sessionStorage.clear();"],
      ["web storage", "const db = indexedDB.open('x');"],
      ["process", "const home = process.env.HOME;"],
      ["process", "process.exit(1);"],
      ["Buffer", "const bytes = Buffer.from(text);"],
      ["require", "const fs = require('fs');"],
      ['import "node:fs"', "import { readFileSync } from 'node:fs';"],
      ['import "fs"', 'import { readFileSync } from "fs";'],
      ['import "fs/promises"', 'import { readFile } from "fs/promises";'],
      ['import "react"', "import { useState } from 'react';"],
      ['import "react-dom/client"', "import { createRoot } from 'react-dom/client';"],
      ['import "next/navigation"', 'import { redirect } from "next/navigation";'],
      ['import "node:crypto"', 'const crypto = await import("node:crypto");'],
      ['import "next"', 'import "next";'],
      ['import "next"', 'export * from "next";'],
    ])("catches %s in `%s`", (name, source) => {
      expect(purityViolations(source)).toContain(name);
    });

    it("catches a violation that follows a URL on the same line", () => {
      const source = 'const url = "https://example.com"; const n = Math.random();';
      expect(purityViolations(source)).toContain("Math.random");
    });

    it.each([
      "// never Math.random, new Date() or window.innerWidth",
      "/* Date.now() and process.env are not allowed here */",
      "/**\n * Uses no Math.random.\n * No `document.` either.\n */",
      "const x = 1; // new Date()",
    ])("lets a comment name a forbidden word: %j", (source) => {
      expect(purityViolations(source)).toEqual([]);
    });

    it.each([
      "import { wcagRatio } from '@/engine/color/contrast';",
      "import type { Oklch } from './types';",
      "import { strToU8 } from 'fflate';",
      "const dates = updateDate(1) + candidate.length;",
      "const mathRandomly = 1; const windowed = 2; const documentation = 3;",
      "const nextStep = steps[i + 1]; const reactive = true;",
    ])("lets ordinary code through: %s", (source) => {
      expect(purityViolations(source)).toEqual([]);
    });

    it("strips line and block comments and keeps string contents", () => {
      expect(stripComments("a // b\nc")).toBe("a \nc");
      expect(stripComments("a /* b */ c")).toBe("a   c");
      expect(stripComments("a /* b")).toBe("a  ");
      expect(stripComments('const u = "https://x"; // gone')).toBe('const u = "https://x"; ');
      expect(stripComments("const q = 'it\\'s // kept'; // gone")).toBe(
        "const q = 'it\\'s // kept'; ",
      );
      expect(stripComments("const t = `// kept`; /* gone */")).toBe("const t = `// kept`;  ");
    });
  });
});

describe("C-REPO-02 the engine does not import from the spec", () => {
  it("lets only src/engine/generate.ts import from src/spec", () => {
    const offenders = codeFiles(ENGINE_DIR)
      .filter((file) => file !== path.join(ENGINE_DIR, "generate.ts"))
      .filter((file) =>
        specifiers(stripComments(readFileSync(file, "utf8"))).some((specifier) =>
          importsFromSpec(file, specifier),
        ),
      )
      .map((file) => path.relative(ROOT, file));
    expect(offenders).toEqual([]);
  });

  it("recognizes an import from src/spec however it is written", () => {
    const file = path.join(ENGINE_DIR, "color/example.ts");
    expect(importsFromSpec(file, "@/spec/schema")).toBe(true);
    expect(importsFromSpec(file, "@/spec")).toBe(true);
    expect(importsFromSpec(file, "../../spec/schema")).toBe(true);
    expect(importsFromSpec(file, "../../spec")).toBe(true);
    expect(importsFromSpec(file, "../round")).toBe(false);
    expect(importsFromSpec(file, "./types")).toBe(false);
    expect(importsFromSpec(file, "@/engine/round")).toBe(false);
    expect(importsFromSpec(file, "fflate")).toBe(false);
    expect(importsFromSpec(file, "../../specs/other")).toBe(false);
  });
});

describe("C-REPO-04 the coverage floors", () => {
  it.each(["src/engine/**", "src/spec/**"])(
    "holds %s to lines, statements and functions 95 and branches 90",
    (folder) => {
      const thresholds = config.test?.coverage?.thresholds as Record<string, unknown> | undefined;
      expect(thresholds?.[folder]).toEqual({
        lines: 95,
        statements: 95,
        functions: 95,
        branches: 90,
      });
    },
  );

  it("measures both folders of the pure core", () => {
    expect(config.test?.coverage?.include).toEqual(
      expect.arrayContaining(["src/engine/**", "src/spec/**"]),
    );
  });

  it("keeps the global floors for everything else", () => {
    expect(config.test?.coverage?.thresholds).toMatchObject({
      lines: 80,
      statements: 80,
      functions: 75,
      branches: 70,
    });
  });
});
