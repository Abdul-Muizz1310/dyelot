import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import config from "../../../vitest.config";

// C-REPO-01, C-REPO-02, C-REPO-04 and C-REPO-05 of docs/specs/01-color-engine.md, section 6.9, with
// C-REPO-02 and C-REPO-05 amended by R2-25 of docs/specs/02-studio.md, and C-ENTRY-16 to 18. C-REPO-03
// lives in environment.test.ts, one copy per folder.

const ROOT = path.resolve(import.meta.dirname, "../../..");
const ENGINE_DIR = path.join(ROOT, "src/engine");
const SPEC_DIR = path.join(ROOT, "src/spec");
const THEME_DIR = path.join(ROOT, "src/theme");
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

/**
 * The specifiers of the value imports and re-exports in `source` (comments already stripped): a
 * statement that starts `import type` or `export type` is a type import and does not count (R2-25).
 */
function valueSpecifiers(source: string): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(
    /\b(import|export)\s+(type\s+)?(?:[^;"']*?\bfrom\s*)?["']([^"']+)["']/g,
  )) {
    if (match[2] === undefined) found.push(match[3]);
  }
  return found;
}

/** The files of src/engine that may import a value from src/spec (R2-25). */
const SPEC_VALUE_IMPORTERS = ["generate.ts", "presets.ts", "index.ts"].map((name) =>
  path.join(ENGINE_DIR, name),
);

describe("C-REPO-02 the engine reaches the spec only where R2-25 allows", () => {
  it("lets only generate.ts, presets.ts and index.ts import a value from src/spec", () => {
    const offenders = codeFiles(ENGINE_DIR)
      .filter((file) => !SPEC_VALUE_IMPORTERS.includes(file))
      .filter((file) =>
        valueSpecifiers(stripComments(readFileSync(file, "utf8"))).some((specifier) =>
          importsFromSpec(file, specifier),
        ),
      )
      .map((file) => path.relative(ROOT, file));
    expect(offenders).toEqual([]);
  });

  it("C-ENTRY-18 lets the linter import nothing from src/spec, not even a type", () => {
    const linter = codeFiles(path.join(ENGINE_DIR, "lint"));
    expect(linter.length).toBeGreaterThan(0);
    const offenders = linter
      .filter((file) =>
        specifiers(stripComments(readFileSync(file, "utf8"))).some((specifier) =>
          importsFromSpec(file, specifier),
        ),
      )
      .map((file) => path.relative(ROOT, file));
    expect(offenders).toEqual([]);
  });

  it("tells a type import from a value import", () => {
    expect(valueSpecifiers('import type { A } from "../spec/schema";')).toEqual([]);
    expect(valueSpecifiers('export type { A } from "../spec/schema";')).toEqual([]);
    expect(valueSpecifiers('import { type A, b } from "../spec/schema";')).toEqual([
      "../spec/schema",
    ]);
    expect(valueSpecifiers('import { b } from "../spec/schema";')).toEqual(["../spec/schema"]);
    expect(valueSpecifiers('export { b } from "../spec/schema";')).toEqual(["../spec/schema"]);
    expect(valueSpecifiers('export * from "./x";\nimport "./side";')).toEqual(["./x", "./side"]);
    expect(valueSpecifiers("const a = 1;")).toEqual([]);
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

describe("C-REPO-05 only toHex and the Hex guards make a Hex", () => {
  // A cast (`as Hex`, `<Hex>x`) or a predicate (`x is Hex`, `asserts x is Hex`).
  const MAKES_HEX = /\bas\s+Hex\b|(?<![\w$>])<Hex>|\bis\s+Hex\b/g;

  it("finds a Hex made only by toHex (a cast) and by isHex and assertHex (predicates)", () => {
    const found = [
      ...codeFiles(ENGINE_DIR),
      ...codeFiles(SPEC_DIR),
      ...codeFiles(THEME_DIR),
    ].flatMap((file) =>
      Array.from(
        stripComments(readFileSync(file, "utf8")).matchAll(MAKES_HEX),
        (match) => `${path.relative(ROOT, file)}: ${match[0].replace(/\s+/g, " ")}`,
      ),
    );
    // toHex brands the string it builds, once; the two predicates of guards.ts are the schema's way in.
    expect(found).toEqual([
      "src/engine/color/convert.ts: as Hex",
      "src/engine/color/guards.ts: is Hex",
      "src/engine/color/guards.ts: is Hex",
    ]);
  });

  it("C-ENTRY-17 sees a cast, an angle cast or a predicate, however spaced, and not a longer name", () => {
    expect("x as Hex;".match(MAKES_HEX)).toHaveLength(1);
    expect("x as\n  Hex)".match(MAKES_HEX)).toHaveLength(1);
    expect("const h = <Hex>x;".match(MAKES_HEX)).toHaveLength(1);
    expect("function f(v: unknown): v is Hex {".match(MAKES_HEX)).toHaveLength(1);
    expect("function f(v: unknown): asserts v is  Hex {".match(MAKES_HEX)).toHaveLength(1);
    expect("const h = <Hex>(x);".match(MAKES_HEX)).toHaveLength(1);
    for (const generic of [
      "const a: Set<Hex> = new Set();",
      "const b: ReadonlyArray<Hex> = [];",
      "const [c] = useState<Hex>(x);",
      "const d = new Map<string, Hex>();",
      "type E = Promise<Hex>;",
      "type F = Array<Array<Hex>>;",
    ]) {
      expect(generic.match(MAKES_HEX), generic).toBeNull();
    }
    expect("x as HexColor".match(MAKES_HEX)).toBeNull();
    expect("v is HexColor".match(MAKES_HEX)).toBeNull();
    expect("type Hex = string".match(MAKES_HEX)).toBeNull();
  });
});

describe("C-ENTRY-16 each bound has one definition", () => {
  const sources = [...codeFiles(ENGINE_DIR), ...codeFiles(SPEC_DIR)].map(
    (file) => [path.relative(ROOT, file), stripComments(readFileSync(file, "utf8"))] as const,
  );
  const definitions = (name: string): string[] =>
    sources
      .filter(([, code]) => new RegExp(`\\bconst\\s+${name}\\s*=`).test(code))
      .map(([file]) => file);

  it.each([
    ["CHROMA_CEILING", "src/engine/color/guards.ts"],
    ["NAME_MAX", "src/spec/schema.ts"],
    ["SEED_MAX", "src/spec/schema.ts"],
  ])("defines %s once, in %s", (name, home) => {
    expect(definitions(name)).toEqual([home]);
  });

  it("writes the 0.5 chroma ceiling as a literal nowhere else", () => {
    const literal = /\.max\(0\.5\)|CHROMA\w*\s*=\s*0\.5\b|\[0, 0\.5\]|to 0\.5\b/;
    const offenders = sources
      .filter(([file]) => file !== "src/engine/color/guards.ts")
      .filter(([, code]) => literal.test(code))
      .map(([file]) => file);
    expect(offenders).toEqual([]);
  });
});

describe("C-REPO-M2-02 the pure core imports nothing from the app layers (I-M2-07)", () => {
  const LAYERS = ["features", "app", "components", "lib"].map((name) =>
    path.join(ROOT, "src", name),
  );
  const pureFiles = ["engine", "spec", "theme"].flatMap((name) =>
    codeFiles(path.join(ROOT, "src", name)),
  );

  /** Whether `specifier`, written in `file`, points into one of the app layers. */
  function importsFromLayer(file: string, specifier: string): boolean {
    if (/^@\/(features|app|components|lib)(\/|$)/.test(specifier)) return true;
    if (!specifier.startsWith(".")) return false;
    const resolved = path.resolve(path.dirname(file), specifier);
    return LAYERS.some((layer) => resolved === layer || resolved.startsWith(layer + path.sep));
  }

  it("finds no import from src/features, src/app, src/components or src/lib", () => {
    expect(pureFiles.length).toBeGreaterThan(0);
    const offenders = pureFiles
      .filter((file) =>
        specifiers(stripComments(readFileSync(file, "utf8"))).some((s) =>
          importsFromLayer(file, s),
        ),
      )
      .map((file) => path.relative(ROOT, file));
    expect(offenders).toEqual([]);
  });

  it("recognizes an import from an app layer however it is written", () => {
    const file = path.join(ROOT, "src/engine/color/example.ts");
    expect(importsFromLayer(file, "@/features/studio/store")).toBe(true);
    expect(importsFromLayer(file, "@/lib")).toBe(true);
    expect(importsFromLayer(file, "../../app/page")).toBe(true);
    expect(importsFromLayer(file, "../../../src/components/x")).toBe(true);
    expect(importsFromLayer(file, "../round")).toBe(false);
    expect(importsFromLayer(file, "@/engine/round")).toBe(false);
    expect(importsFromLayer(file, "@/library/x")).toBe(false);
    expect(importsFromLayer(file, "fflate")).toBe(false);
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

const BINARY = /\.(woff2?|ttf|otf|png|ico|jpe?g|webp|avif|gif)$/i;
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com", "fontshare"];

/** Every regular file under `directory` that is text: font and image binaries and `public/fonts` are skipped. */
function textFiles(directory: string): string[] {
  try {
    return readdirSync(directory, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && !BINARY.test(entry.name))
      .map((entry) => path.join(entry.parentPath, entry.name))
      .filter((file) => !file.split(path.sep).join("/").includes("public/fonts/"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

/** The text files under `roots` that name a Google Fonts or Fontshare host. */
function hostViolations(roots: readonly string[]): { file: string; host: string }[] {
  const hits: { file: string; host: string }[] = [];
  for (const file of roots.flatMap(textFiles)) {
    const source = readFileSync(file, "utf8").toLowerCase();
    for (const host of FONT_HOSTS) if (source.includes(host)) hits.push({ file, host });
  }
  return hits;
}

describe("the font guards", () => {
  it("C-REPO-M2-01 keeps every Google, gstatic and Fontshare host out of src, scripts and public", () => {
    const roots = ["src", "scripts", "public"].map((folder) => path.join(ROOT, folder));
    expect(hostViolations(roots)).toEqual([]);
  });

  it("C-REPO-M2-01 reads CSS, SVG, JSON and other text files, not only code", () => {
    const files = ["src", "scripts", "public"].flatMap((folder) =>
      textFiles(path.join(ROOT, folder)).map((file) => path.relative(ROOT, file)),
    );
    expect(files).toContain("src/app/globals.css");
    expect(files.some((file) => file.endsWith(".svg") || file.endsWith(".json"))).toBe(true);
    expect(files.some((file) => file.startsWith("public/fonts/"))).toBe(false);
    expect(files.some((file) => /\.(woff2?|ttf|otf|png|ico|jpe?g|webp|avif|gif)$/.test(file))).toBe(
      false,
    );
  });

  it("C-REPO-M2-01 flags a host in a CSS import, an SVG and a manifest, and skips a binary", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "dyelot-guard-"));
    try {
      mkdirSync(path.join(dir, "public/fonts/x"), { recursive: true });
      writeFileSync(path.join(dir, "a.css"), '@import url("https://fonts.googleapis.com/css2");');
      writeFileSync(path.join(dir, "b.svg"), "<svg><!-- https://fonts.gstatic.com/s/x --></svg>");
      writeFileSync(path.join(dir, "c.webmanifest"), '{"x":"https://www.fontshare.com"}');
      writeFileSync(path.join(dir, "d.png"), "fonts.googleapis.com");
      writeFileSync(path.join(dir, "public/fonts/x/e.txt"), "fonts.googleapis.com");
      writeFileSync(path.join(dir, "ok.ts"), "export const x = 1;\n");
      const found = hostViolations([dir]).map((hit) => path.relative(dir, hit.file));
      expect(found.sort()).toEqual(["a.css", "b.svg", "c.webmanifest"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("the font binaries", () => {
  it("C-REPO-M2-05 tracks no font binary outside src/lib/site/fonts", () => {
    const tracked = spawnSync("git", ["ls-files", "*.woff2", "*.woff", "*.ttf", "*.otf"], {
      cwd: ROOT,
      encoding: "utf8",
    });
    expect(tracked.error).toBeUndefined();
    expect(tracked.status).toBe(0);
    const stray = tracked.stdout
      .split("\n")
      .filter(Boolean)
      .filter((file) => !file.startsWith("src/lib/site/fonts/"));
    expect(stray).toEqual([]);
  });
});

describe("the font coverage and project config", () => {
  it("measures the font loader and holds it to the pure-core floors", () => {
    expect(config.test?.coverage?.include).toContain("src/features/fonts/load.ts");
    expect(config.test?.coverage?.thresholds).toMatchObject({
      "src/features/fonts/load.ts": { lines: 95, statements: 95, functions: 95, branches: 90 },
    });
  });

  it("runs the script tests in the node project", () => {
    const projects = config.test?.projects as { test?: { name?: string; include?: string[] } }[];
    const core = projects.find((project) => project.test?.name === "core");
    expect(core?.test?.include).toContain("tests/unit/scripts/**/*.test.{ts,tsx}");
  });
});

describe("C-REPO-M2-03 the new pure folders and helpers keep the pure-core floors (R2-22)", () => {
  const FLOORS = { lines: 95, statements: 95, functions: 95, branches: 90 };
  const thresholds = () => config.test?.coverage?.thresholds as Record<string, unknown> | undefined;
  const include = () => config.test?.coverage?.include ?? [];

  it("runs tests/unit/theme in the node project", () => {
    const projects = config.test?.projects as { test?: { name?: string; include?: string[] } }[];
    const core = projects.find((project) => project.test?.name === "core");
    expect(core?.test?.include).toContain("tests/unit/theme/**/*.test.{ts,tsx}");
  });

  it("measures src/theme and src/engine (with src/engine/fonts) at 95 and 90", () => {
    expect(include()).toEqual(expect.arrayContaining(["src/theme/**", "src/engine/**"]));
    expect(thresholds()?.["src/theme/**"]).toEqual(FLOORS);
    expect(thresholds()?.["src/engine/**"]).toEqual(FLOORS);
  });

  it.each([
    "protocol",
    "url",
    "drafts",
    "params",
    "lot",
    "inspect",
    "fixes",
    "client",
    "guards",
    "view",
    "shortcuts",
    "inputs",
  ])("measures src/features/studio/%s.ts by name and holds it to 95 and 90", (name) => {
    const file = `src/features/studio/${name}.ts`;
    expect(include()).toContain(file);
    expect(thresholds()?.[file]).toEqual(FLOORS);
  });
});
