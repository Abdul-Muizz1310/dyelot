import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { isFreeSlug } from "@/ai";
import config from "../../../vitest.config";
import {
  codeFiles,
  coreViolations,
  ENGINE_DIR,
  EXPORT_DIR,
  engineAndSpecFiles,
  exportAndImportFiles,
  IMPORT_DIR,
  IMPURE,
  inProbe,
  isForbiddenSpecifier,
  PROBE_DIR,
  purityViolations,
  ROOT,
  SPEC_DIR,
  specifiers,
  stripComments,
  THEME_DIR,
} from "./guard-support";

// C-REPO-01, C-REPO-02, C-REPO-04 and C-REPO-05 of docs/specs/01-color-engine.md, section 6.9, with
// C-REPO-02 and C-REPO-05 amended by R2-25 of docs/specs/02-studio.md, and C-ENTRY-16 to 18. C-REPO-03
// lives in environment.test.ts, one copy per folder. These M1 guards, as R2-25 leaves them, are
// C-REPO-M2-04 of the M2 spec, section 6.10; the M2 guards C-REPO-M2-01 to 05 follow them.

/** Whether `specifier`, written in `file`, points into src/spec. */
function importsFromSpec(file: string, specifier: string): boolean {
  if (specifier === "@/spec" || specifier.startsWith("@/spec/")) return true;
  if (!specifier.startsWith(".")) return false;
  const resolved = path.resolve(path.dirname(file), specifier);
  return resolved === SPEC_DIR || resolved.startsWith(SPEC_DIR + path.sep);
}

describe("C-REPO-01 the pure core uses no impure API", () => {
  const files = engineAndSpecFiles();

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
  it("C-ENTRY-12 lets only generate.ts, presets.ts and index.ts import a value from src/spec", () => {
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
  // Section 16 of docs/specs/04-ai.md (R4-03, R4-05): src/ai and src/server join the rule.
  const PURE_FOLDERS = ["engine", "spec", "theme", "ai", "server"];
  const pureFiles = PURE_FOLDERS.flatMap((name) => codeFiles(path.join(ROOT, "src", name)));

  it("C-REPO-M2-02 scans src/ai and src/server too, each with real files", () => {
    for (const folder of ["ai", "server"]) {
      const inside = pureFiles.filter((file) =>
        file.startsWith(path.join(ROOT, "src", folder) + path.sep),
      );
      expect(inside.length, `src/${folder}`).toBeGreaterThan(0);
    }
  });

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
      .filter((file) => !file.split(path.sep).join("/").includes("public/fonts/"))
      .filter((file) => !inProbe(file));
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

describe("C-REPO-M2-04 the M1 repository guards stay in force", () => {
  it("C-REPO-M2-04 keeps each C-REPO case of the M1 spec named in a title of its guard files", () => {
    const m1 = readFileSync(path.join(ROOT, "docs/specs/01-color-engine.md"), "utf8");
    const cases = [...new Set(m1.match(/^\| C-REPO-\d+ \|/gm) ?? [])].map((row) =>
      row.slice(2, -2),
    );
    // This file holds C-REPO-01, 02, 04 and 05; each pure folder's environment test holds C-REPO-03.
    const files = [
      "tests/unit/engine/repo-guards.test.ts",
      "tests/unit/engine/environment.test.ts",
      "tests/unit/spec/environment.test.ts",
    ];
    const titles = files.flatMap((file) =>
      [
        ...readFileSync(path.join(ROOT, file), "utf8").matchAll(
          /\b(?:describe|it)\(\s*"([^"\n]*)"/g,
        ),
      ].map((match) => match[1] ?? ""),
    );
    expect(cases).toHaveLength(5);
    const unnamed = cases.filter(
      (id) => !titles.some((title) => new RegExp(`${id}(?![0-9])`).test(title)),
    );
    expect(unnamed).toEqual([]);
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
    // A floor on a file that does not exist measures nothing: the helper must be there (Task 2.10b).
    expect(existsSync(path.join(ROOT, file)), `${file} exists`).toBe(true);
    expect(include()).toContain(file);
    expect(thresholds()?.[file]).toEqual(FLOORS);
  });

  // The preview's pure helpers (Task 2.7) take the same floors: new pure files keep the M1 floors.
  it.each(["frame", "swatches", "copy", "vars", "kit/states", "tide", "bars", "format"])(
    "measures src/features/preview/%s.ts by name and holds it to 95 and 90",
    (name) => {
      const file = `src/features/preview/${name}.ts`;
      expect(existsSync(path.join(ROOT, file)), `${file} exists`).toBe(true);
      expect(include()).toContain(file);
      expect(thresholds()?.[file]).toEqual(FLOORS);
    },
  );
});

// C-GUARD4-10 of docs/specs/04-ai.md, section 14.10 (R4-59), which is section 16's change to
// C-REPO-M2-03: the core project runs tests/unit/ai and tests/unit/server, and the coverage scope
// holds section 15's include and floors, each named file of which exists. The rows are written from
// section 15, not read back from vitest.config.ts, so a list the config drops is still asked for.

type FloorSet = { lines: number; statements: number; functions: number; branches: number };
const floorsOf = (main: number, branches: number): FloorSet => ({
  lines: main,
  statements: main,
  functions: main,
  branches,
});

/** Section 15's whole coverage scope: 80, 80, 75 and 70. */
const SCOPE_FLOORS = { lines: 80, statements: 80, functions: 75, branches: 70 };
/** The test folders R4-59 puts in `core`. */
const AI_CORE_TESTS = ["tests/unit/ai/**/*.test.{ts,tsx}", "tests/unit/server/**/*.test.{ts,tsx}"];
/** Section 15's folders: the include glob that measures each, its threshold key and its floors. */
const SECTION_15_FOLDERS: ReadonlyArray<readonly [include: string, key: string, floors: FloorSet]> =
  [
    ["src/engine/**", "src/engine/**", floorsOf(95, 90)],
    ["src/spec/**", "src/spec/**", floorsOf(95, 90)],
    ["src/theme/**", "src/theme/**", floorsOf(95, 90)],
    // The AI core's code, not its prompt files (Task 4.6b's fix round).
    ["src/ai/**/*.ts", "src/ai/**", floorsOf(95, 90)],
    ["src/export/**", "src/export/**", floorsOf(90, 85)],
    ["src/import/**", "src/import/**", floorsOf(90, 85)],
  ];
/** Section 15's files, each measured by name with its own floors. */
const SECTION_15_FILES: ReadonlyArray<readonly [file: string, floors: FloorSet]> = [
  ...["env", "clock", "cap", "guard", "cache", "transport", "trace", "smoke", "handle"].map(
    (name) => [`src/server/ai/${name}.ts`, floorsOf(90, 85)] as const,
  ),
  // AI_HELPERS: the nine helpers of src/features/ai, the step planner and the activity among them
  // (the final review's Minor 4).
  ...[
    "shared",
    "visitor-key",
    "connect",
    "on-device",
    "router",
    "image-protocol",
    "steer",
    "steps",
    "activity",
  ].map((name) => [`src/features/ai/${name}.ts`, floorsOf(95, 90)] as const),
];

/** The parts of a Vitest config that C-GUARD4-10 reads. */
type CoverageConfig = {
  test?: {
    projects?: unknown;
    coverage?: { include?: unknown; thresholds?: unknown };
  };
};

/**
 * Every way `candidate` misses R4-59 and section 15, named; an empty list when it holds them all.
 * `exists` says whether a named file is in the repository.
 */
function guard4Problems(candidate: CoverageConfig, exists: (file: string) => boolean): string[] {
  const problems: string[] = [];
  const projects = Array.isArray(candidate.test?.projects)
    ? (candidate.test.projects as { test?: { name?: unknown; include?: unknown } }[])
    : [];
  const core = projects.find((project) => project.test?.name === "core");
  const coreInclude = Array.isArray(core?.test?.include) ? core.test.include : [];
  for (const glob of AI_CORE_TESTS) {
    if (!coreInclude.includes(glob)) problems.push(`core does not run ${glob}`);
  }

  const coverage = candidate.test?.coverage;
  const include = Array.isArray(coverage?.include) ? (coverage.include as unknown[]) : [];
  const thresholds = (
    typeof coverage?.thresholds === "object" && coverage.thresholds !== null
      ? coverage.thresholds
      : {}
  ) as Record<string, unknown>;
  // The same floors in any key order are the same floors.
  const same = (value: unknown, floors: FloorSet) => isDeepStrictEqual(value, floors);
  const held = (floors: FloorSet) => `${floors.lines} and ${floors.branches}`;

  for (const [name, floor] of Object.entries(SCOPE_FLOORS)) {
    if (thresholds[name] !== floor) {
      problems.push(`the whole scope's ${name} floor is ${String(thresholds[name])}, not ${floor}`);
    }
  }
  for (const [glob, key, floors] of SECTION_15_FOLDERS) {
    if (!include.includes(glob)) problems.push(`coverage does not measure ${glob}`);
    if (!same(thresholds[key], floors)) problems.push(`${key} is not held to ${held(floors)}`);
  }
  for (const [file, floors] of SECTION_15_FILES) {
    if (!include.includes(file)) problems.push(`coverage does not measure ${file}`);
    if (!same(thresholds[file], floors)) problems.push(`${file} is not held to ${held(floors)}`);
    if (!exists(file)) problems.push(`${file} does not exist`);
  }
  // src/lib/site/csp.ts falls under src/lib/site/**, which the scope includes (section 15).
  if (!include.includes("src/lib/site/**"))
    problems.push("coverage does not measure src/lib/site/**");
  if (!exists("src/lib/site/csp.ts")) problems.push("src/lib/site/csp.ts does not exist");
  return problems;
}

/** A plain copy of the real config's parts that C-GUARD4-10 reads, for a probe to change. */
function configCopy(): {
  test: {
    projects: { test?: { name?: string; include?: string[] } }[];
    coverage: { include: string[]; thresholds: Record<string, unknown> };
  };
} {
  return JSON.parse(
    JSON.stringify({
      test: {
        projects: config.test?.projects,
        coverage: {
          include: config.test?.coverage?.include,
          thresholds: config.test?.coverage?.thresholds,
        },
      },
    }),
  );
}

const inRepository = (file: string): boolean => existsSync(path.join(ROOT, file));

describe("C-GUARD4-10 the AI tests run in core, and section 15's include and floors hold", () => {
  it("C-GUARD4-10 finds no gap in vitest.config.ts, and each named file exists", () => {
    expect(guard4Problems(config, inRepository)).toEqual([]);
  });

  it("C-GUARD4-10 names each of section 15's files: nine server files and the nine AI helpers", () => {
    expect(SECTION_15_FILES.map(([file]) => file)).toHaveLength(18);
    for (const [file] of SECTION_15_FILES) expect(inRepository(file), file).toBe(true);
  });

  type Probe = ReturnType<typeof configCopy>;
  const coreOf = (probe: Probe) => probe.test.projects.find((each) => each.test?.name === "core");
  it.each<[string, (probe: Probe) => void, string]>([
    [
      "core without tests/unit/ai",
      (probe) => {
        const core = coreOf(probe);
        if (core?.test?.include) {
          core.test.include = core.test.include.filter(
            (glob) => !glob.startsWith("tests/unit/ai/"),
          );
        }
      },
      "core does not run tests/unit/ai/**/*.test.{ts,tsx}",
    ],
    [
      "core without tests/unit/server",
      (probe) => {
        const core = coreOf(probe);
        if (core?.test?.include) {
          core.test.include = core.test.include.filter(
            (glob) => !glob.startsWith("tests/unit/server/"),
          );
        }
      },
      "core does not run tests/unit/server/**/*.test.{ts,tsx}",
    ],
    [
      "no core project",
      (probe) => {
        probe.test.projects = probe.test.projects.filter((each) => each.test?.name !== "core");
      },
      "core does not run tests/unit/ai/**/*.test.{ts,tsx}",
    ],
    [
      "a whole-scope floor of 60 branches",
      (probe) => {
        probe.test.coverage.thresholds.branches = 60;
      },
      "the whole scope's branches floor is 60, not 70",
    ],
    [
      "src/ai/** at 90 and 85",
      (probe) => {
        probe.test.coverage.thresholds["src/ai/**"] = floorsOf(90, 85);
      },
      "src/ai/** is not held to 95 and 90",
    ],
    [
      "src/ai unmeasured",
      (probe) => {
        probe.test.coverage.include = probe.test.coverage.include.filter(
          (glob) => !glob.startsWith("src/ai/"),
        );
      },
      "coverage does not measure src/ai/**/*.ts",
    ],
    [
      "a server file without its floor",
      (probe) => {
        delete probe.test.coverage.thresholds["src/server/ai/smoke.ts"];
      },
      "src/server/ai/smoke.ts is not held to 90 and 85",
    ],
    [
      "an AI helper left out of the scope",
      (probe) => {
        probe.test.coverage.include = probe.test.coverage.include.filter(
          (glob) => glob !== "src/features/ai/router.ts",
        );
      },
      "coverage does not measure src/features/ai/router.ts",
    ],
    [
      "an AI helper at the server floors",
      (probe) => {
        probe.test.coverage.thresholds["src/features/ai/steer.ts"] = floorsOf(90, 85);
      },
      "src/features/ai/steer.ts is not held to 95 and 90",
    ],
    [
      "src/lib/site unmeasured, so csp.ts is not",
      (probe) => {
        probe.test.coverage.include = probe.test.coverage.include.filter(
          (glob) => glob !== "src/lib/site/**",
        );
      },
      "coverage does not measure src/lib/site/**",
    ],
  ])("C-GUARD4-10 reports the probe: %s", (_name, change, problem) => {
    const probe = configCopy();
    expect(guard4Problems(probe, inRepository)).toEqual([]);
    change(probe);
    expect(guard4Problems(probe, inRepository)).toContain(problem);
  });

  it("C-GUARD4-10 reads floors whatever their keys' order (a probe)", () => {
    const probe = configCopy();
    const thresholds = probe.test.coverage.thresholds;
    // The same floors, listed in another order, are the same floors.
    thresholds["src/ai/**"] = { branches: 90, functions: 95, statements: 95, lines: 95 };
    thresholds["src/server/ai/cap.ts"] = { branches: 85, lines: 90, functions: 90, statements: 90 };
    expect(guard4Problems(probe, inRepository)).toEqual([]);
  });

  it("C-GUARD4-10 reports a named file that does not exist (a probe)", () => {
    const missing = (file: string) => file !== "src/features/ai/connect.ts" && inRepository(file);
    expect(guard4Problems(configCopy(), missing)).toEqual([
      "src/features/ai/connect.ts does not exist",
    ]);
  });
});

// C-GUARD3-01 to 04 of docs/specs/03-export.md, section 10.9 (R3-38, I-M3-02, R3-39): the export and
// import cores load only through a dynamic import, and stay pure. Section 16 of docs/specs/04-ai.md
// amends C-GUARD3-01, 03 and 04 (R4-04): the AI core, src/ai, is the third such core.

const AI_DIR = path.join(ROOT, "src/ai");
const APP_DIRS = ["src/features", "src/app", "src/components", "src/lib"].map((folder) =>
  path.join(ROOT, folder),
);

/** Whether `specifier`, written in `file`, points at `@/export`, `@/import`, `@/ai` or a path under them. */
function reachesCores(file: string, specifier: string): boolean {
  if (/^@\/(?:export|import|ai)(?:\/|$)/.test(specifier)) return true;
  if (!specifier.startsWith(".")) return false;
  const resolved = path.resolve(path.dirname(file), specifier);
  return [EXPORT_DIR, IMPORT_DIR, AI_DIR].some(
    (dir) => resolved === dir || resolved.startsWith(dir + path.sep),
  );
}

/** The specifiers of static `import` and `export … from` statements, `import type` aside. */
function staticCoreImports(file: string, source: string): string[] {
  const code = stripComments(source);
  const found: string[] = [];
  for (const match of code.matchAll(/\b(?:import|export)\b([^;"'`]*?)\bfrom\s*["']([^"']+)["']/g)) {
    if (/^\s*type\b/.test(match[1] as string)) continue;
    found.push(match[2] as string);
  }
  for (const match of code.matchAll(/\bimport\s*["']([^"']+)["']/g)) found.push(match[1] as string);
  return found.filter((specifier) => reachesCores(file, specifier));
}

/** The specifiers of `import("…")` calls that reach the cores. */
function dynamicCoreImports(file: string, source: string): string[] {
  return [...stripComments(source).matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)]
    .map((match) => match[1] as string)
    .filter((specifier) => reachesCores(file, specifier));
}

const APP_FILES = APP_DIRS.flatMap(codeFiles);
const PROBE_FILE = path.join(ROOT, "src/features/probe.ts");

describe("C-GUARD3-01 app code reaches the export, import and AI cores only through import()", () => {
  it("scans real app files", () => {
    expect(APP_FILES.length).toBeGreaterThan(0);
  });

  it("finds no static import or export-from of the cores in src/features, app, components or lib", () => {
    const bad = APP_FILES.flatMap((file) =>
      staticCoreImports(file, readFileSync(file, "utf8")).map(
        (specifier) => `${path.relative(ROOT, file)}: ${specifier}`,
      ),
    );
    expect(bad).toEqual([]);
  });

  it.each([
    ['import { zipBundle } from "@/export/zip";', ["@/export/zip"]],
    ['import { buildBundle } from "@/export";', ["@/export"]],
    ['export { importDesignMd } from "@/import";', ["@/import"]],
    ['import { x } from "../export/zip";', ["../export/zip"]],
    ['import { x } from "../import/css";', ["../import/css"]],
    ['import "@/export";', ["@/export"]],
    ['import {\n  a,\n  b,\n} from "@/export/bundle";', ["@/export/bundle"]],
    ['import { parseOutput } from "@/ai";', ["@/ai"]],
    ['import { chatMessages } from "@/ai/chat";', ["@/ai/chat"]],
    ['import { x } from "../ai/features";', ["../ai/features"]],
    ['export { briefInput } from "@/ai/inputs";', ["@/ai/inputs"]],
  ])("reports the probe %j", (source, expected) => {
    expect(staticCoreImports(PROBE_FILE, source)).toEqual(expected);
  });

  it.each([
    'import type { Bundle } from "@/export";',
    'export type { Bundle } from "@/export";',
    'const load = () => import("@/export");',
    'import { x } from "@/engine";',
    'import { x } from "./export-button";',
    '// import { x } from "@/export";',
    'import type { AiChange } from "@/ai";',
    'const loadAi = () => import("@/ai");',
    'import { chipChange } from "./ai/steer";',
    'import { chipChange } from "@/features/ai/steer";',
  ])("allows the probe %j", (source) => {
    expect(staticCoreImports(PROBE_FILE, source)).toEqual([]);
  });
});

describe("C-GUARD3-02 src/export and src/import stay pure", () => {
  const files = exportAndImportFiles();
  const CHECKER = path.join(EXPORT_DIR, "checker/dyelot-check.mjs");

  it("scans real files, the checker among them", () => {
    expect(files.length).toBeGreaterThan(20);
    expect(files).toContain(CHECKER);
  });

  it("finds no impure API in any file bar the checker", () => {
    const bad = files
      .filter((file) => file !== CHECKER)
      .flatMap((file) =>
        coreViolations(readFileSync(file, "utf8")).map(
          (name) => `${path.relative(ROOT, file)}: ${name}`,
        ),
      );
    expect(bad).toEqual([]);
  });

  it("lets only the checker import a node: module", () => {
    const importers = files.filter((file) =>
      coreViolations(readFileSync(file, "utf8")).includes("node: import"),
    );
    expect(importers).toEqual([CHECKER]);
  });

  it.each([
    ["Date", "const d = new Date();"],
    ["Math.random", "const r = Math.random();"],
    ["getRandomValues", "crypto.getRandomValues(a);"],
    ["performance", "const t = performance.now();"],
    ["Intl", "new Intl.NumberFormat();"],
    ["toLocale", "n.toLocaleString();"],
    ["localeCompare", "a.localeCompare(b);"],
    ["document", "document.title;"],
    ["window", "window.open();"],
    ["localStorage", "localStorage.getItem('k');"],
    ["sessionStorage", "sessionStorage.clear();"],
    ["fetch", "await fetch(url);"],
    ["XMLHttpRequest", "new XMLHttpRequest();"],
    ["node: import", 'import { x } from "node:fs";'],
    ["node: import", 'const m = await import("node:path");'],
  ])("sees %s in a probe", (name, source) => {
    expect(coreViolations(source)).toContain(name);
  });

  it("ignores a comment that names an API", () => {
    expect(coreViolations("// Date, fetch and Intl\n/* window */ const x = 1;")).toEqual([]);
  });
});

const ENTRY_NAMES = ["@/export", "@/import", "@/ai"];

/** Every app `import()` of a core that names a path under it rather than its entry. */
function misnamedDynamicImports(): string[] {
  return APP_FILES.flatMap((file) =>
    dynamicCoreImports(file, readFileSync(file, "utf8"))
      .filter((specifier) => !ENTRY_NAMES.includes(specifier))
      .map((specifier) => `${path.relative(ROOT, file)}: ${specifier}`),
  );
}

/** Whether every statement of an index file is an `export … from` line. */
function onlyExportsFrom(source: string): boolean {
  const statements = stripComments(source)
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
  return (
    statements.length > 0 &&
    statements.every((statement) =>
      /^export\s+(?:type\s+)?(?:\{[^}]*\}|\*(?:\s+as\s+\w+)?)\s+from\s+"[^"]+"$/.test(statement),
    )
  );
}

describe("C-GUARD3-03 the three entries hold only export-from lines and app import() names them exactly", () => {
  it.each(["src/export/index.ts", "src/import/index.ts", "src/ai/index.ts"])(
    "keeps %s to export-from lines",
    (file) => {
      expect(onlyExportsFrom(readFileSync(path.join(ROOT, file), "utf8"))).toBe(true);
    },
  );

  it.each([
    ['export { a } from "./a";\nexport type { B } from "./b";', true],
    ['import { a } from "./a";\nexport { a };', false],
    ["export const x = 1;", false],
    ['export { a } from "./a";\nconst y = 2;', false],
    ["", false],
  ])("judges the probe %j as %s", (source, expected) => {
    expect(onlyExportsFrom(source)).toBe(expected);
  });

  it("names exactly @/export, @/import or @/ai in every app import() of a core", () => {
    expect(misnamedDynamicImports()).toEqual([]);
  });

  it("reports a probe import of a path under a core", () => {
    expect(dynamicCoreImports(PROBE_FILE, 'import("@/export/zip")')).toEqual(["@/export/zip"]);
    expect(dynamicCoreImports(PROBE_FILE, 'import("../export/zip")')).toEqual(["../export/zip"]);
    expect(dynamicCoreImports(PROBE_FILE, 'import("@/export")')).toEqual(["@/export"]);
    expect(dynamicCoreImports(PROBE_FILE, 'import("@/ai/chat")')).toEqual(["@/ai/chat"]);
    expect(dynamicCoreImports(PROBE_FILE, 'import("../ai/chat")')).toEqual(["../ai/chat"]);
    expect(dynamicCoreImports(PROBE_FILE, 'import("@/ai")')).toEqual(["@/ai"]);
    expect(dynamicCoreImports(PROBE_FILE, 'import("./ai/steer")')).toEqual([]);
  });
});

const BIOME = path.join(ROOT, "node_modules/.bin/biome");

/** Biome's verdict on `source` written as a file of src/features (the probe is removed after). */
function lint(source: string): { status: number | null; output: string } {
  const probe = path.join(ROOT, "src/features/guard3-04-probe.ts");
  writeFileSync(probe, source);
  try {
    const r = spawnSync(BIOME, ["lint", probe], { cwd: ROOT, encoding: "utf8" });
    return { status: r.status, output: `${r.stdout}${r.stderr}` };
  } finally {
    rmSync(probe, { force: true });
  }
}

describe("C-GUARD3-04 Biome rejects a static import of a path under the cores", () => {
  it("reports noRestrictedImports for a probe in src/features importing @/export/zip", () => {
    const result = lint('import { zipBundle } from "@/export/zip";\nexport const z = zipBundle;\n');
    expect(result.status).not.toBe(0);
    expect(result.output).toContain("noRestrictedImports");
  });

  it("reports the import and AI cores and a relative path into any core", () => {
    for (const source of [
      'import { importShadcnCss } from "@/import/css";\nexport const z = importShadcnCss;\n',
      'import { zipBundle } from "../export/zip";\nexport const z = zipBundle;\n',
      'import { x } from "../import/css";\nexport const z = x;\n',
      'import { parseOutput } from "@/ai/features";\nexport const z = parseOutput;\n',
      'import { parseOutput } from "../ai/features";\nexport const z = parseOutput;\n',
    ]) {
      const result = lint(source);
      expect(result.status, source).not.toBe(0);
      expect(result.output, source).toContain("noRestrictedImports");
    }
  });

  it("accepts a dynamic import of the entry", () => {
    const result = lint('export const load = () => import("@/export");\n');
    expect(result.status).toBe(0);
  });

  it("accepts a dynamic import of the AI entry and a type import from it", () => {
    const source =
      'import type { AiChange } from "@/ai";\nexport const load = () => import("@/ai");\nexport type C = AiChange;\n';
    expect(lint(source).status).toBe(0);
  });
});

// C-GUARD4-01 to 03 of docs/specs/04-ai.md, section 14.10 (R4-03, R4-04, I-M4-08): the AI core is
// pure, imports only what R4-03 lists, and app code reaches it only through import("@/ai").

/** The names of the I-M4-08 APIs: those of I-M3-02 and seven more. */
const AI_IMPURE: ReadonlyArray<readonly [name: string, pattern: RegExp]> = [
  ...IMPURE,
  ["navigator", /\bnavigator\b/],
  ["crypto", /\bcrypto\b/],
  ["process", /\bprocess\b/],
  ["setTimeout", /\bsetTimeout\b/],
  ["setInterval", /\bsetInterval\b/],
  ["Buffer", /\bBuffer\b/],
  ["require", /\brequire\b/],
];

/**
 * The module specifiers of comment-free code: `import … from`, `export … from` and `import "…"`
 * statements, and `import("…")` calls. A statement starts the code or follows `;`, `}` or a line
 * break, so a string such as `"import"` in a type is not read as an import.
 */
function moduleSpecifiers(code: string): string[] {
  const statements = [
    /(?:^|[;}\n])\s*(?:import|export)\b[^;"'`]*?\bfrom\s*["']([^"']+)["']/g,
    /(?:^|[;}\n])\s*import\s*["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  return statements.flatMap((pattern) =>
    [...code.matchAll(pattern)].map((match) => match[1] as string),
  );
}

/** The impure APIs and imports (`node:`, a Node built-in, React or Next) of one src/ai file. */
function aiViolations(source: string): string[] {
  const code = stripComments(source);
  const found = AI_IMPURE.filter(([, pattern]) => pattern.test(code)).map(([name]) => name);
  for (const specifier of moduleSpecifiers(code)) {
    if (isForbiddenSpecifier(specifier)) found.push(`import "${specifier}"`);
  }
  return found;
}

describe("C-GUARD4-01 src/ai uses no impure API (I-M4-08)", () => {
  const files = codeFiles(AI_DIR);

  it("C-GUARD4-01 scans real files, features.ts, inputs.ts and copy.ts among them", () => {
    expect(files).toEqual(
      expect.arrayContaining(
        ["features.ts", "inputs.ts", "copy.ts", "index.ts"].map((name) => path.join(AI_DIR, name)),
      ),
    );
  });

  it("C-GUARD4-01 finds no clock, randomness, DOM, storage, network, environment, locale or Web Crypto", () => {
    const bad = files.flatMap((file) =>
      aiViolations(readFileSync(file, "utf8")).map(
        (name) => `${path.relative(ROOT, file)}: ${name}`,
      ),
    );
    expect(bad).toEqual([]);
  });

  it.each([
    ["Date", "const d = Date.now();"],
    ["Math.random", "const r = Math.random();"],
    ["getRandomValues", "globalThis.getRandomValues(a);"],
    ["performance", "const t = performance.now();"],
    ["Intl", "new Intl.Segmenter();"],
    ["toLocale", "n.toLocaleString();"],
    ["localeCompare", "a.localeCompare(b);"],
    ["document", "document.title;"],
    ["window", "window.open();"],
    ["navigator", "navigator.language;"],
    ["localStorage", "localStorage.getItem('k');"],
    ["sessionStorage", "sessionStorage.clear();"],
    ["fetch", "await fetch(url);"],
    ["XMLHttpRequest", "new XMLHttpRequest();"],
    ["crypto", "crypto.subtle.digest('SHA-256', bytes);"],
    ["process", "const key = process.env.OPENROUTER_API_KEY;"],
    ["setTimeout", "setTimeout(done, 20_000);"],
    ["setInterval", "setInterval(tick, 1000);"],
    ["Buffer", "Buffer.from(text).toString('base64');"],
    ["require", "const z = require('zod');"],
    ['import "node:crypto"', 'import { createHmac } from "node:crypto";'],
    ['import "react"', 'import { useState } from "react";'],
    ['import "next/server"', 'import { after } from "next/server";'],
  ])("C-GUARD4-01 sees %s in a probe", (name, source) => {
    expect(aiViolations(source)).toContain(name);
  });

  it("C-GUARD4-01 reads every form of import, and not a string that says import", () => {
    expect(moduleSpecifiers('import a from "a";\nexport { b } from "b";\nimport "c";')).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(moduleSpecifiers('import type {\n  D,\n} from "d";')).toEqual(["d"]);
    expect(moduleSpecifiers('const m = await import("e");')).toEqual(["e"]);
    expect(moduleSpecifiers('type C = Exclude<CreatedWith, "import">;\nconst x = "y";')).toEqual(
      [],
    );
  });

  it("C-GUARD4-01 lets a comment name an API, and longer words through", () => {
    expect(aiViolations("// Date, fetch and crypto are the shells' work\nconst x = 1;")).toEqual(
      [],
    );
    expect(aiViolations("const processed = 1; const cryptic = 2; const updated = 3;")).toEqual([]);
  });
});

/** The specifiers R4-03 lets a src/ai file import, beside its own files. */
const AI_ALLOWED = ["@/engine", "@/spec", "@/spec/zod", "@/export/sha256"];
/** A prompt file, imported as text by a file directly under src/ai (R4-51). */
const PROMPT_RAW = /^\.\/prompts\/[a-z-]+\.md\?raw$/;

/** The specifiers of `file` (under src/ai) that R4-03 does not allow, type imports included. */
function aiImportViolations(file: string, source: string): string[] {
  return moduleSpecifiers(stripComments(source)).filter((specifier) => {
    if (AI_ALLOWED.includes(specifier)) return false;
    if (PROMPT_RAW.test(specifier)) return path.dirname(file) !== AI_DIR;
    if (specifier.includes("?") || specifier.endsWith(".md")) return true;
    const target = specifier.startsWith("@/ai/")
      ? path.join(AI_DIR, specifier.slice("@/ai/".length))
      : specifier.startsWith(".")
        ? path.resolve(path.dirname(file), specifier)
        : null;
    return target === null || !(target === AI_DIR || target.startsWith(AI_DIR + path.sep));
  });
}

describe("C-GUARD4-02 src/ai imports only what R4-03 lists", () => {
  it("C-GUARD4-02 finds no other import in any file under src/ai", () => {
    const files = codeFiles(AI_DIR);
    expect(files.length).toBeGreaterThan(5);
    const bad = files.flatMap((file) =>
      aiImportViolations(file, readFileSync(file, "utf8")).map(
        (specifier) => `${path.relative(ROOT, file)}: ${specifier}`,
      ),
    );
    expect(bad).toEqual([]);
  });

  const ROOT_FILE = path.join(AI_DIR, "probe.ts");
  const NESTED_FILE = path.join(AI_DIR, "lexicon/probe.ts");

  it.each([
    [ROOT_FILE, 'import { z } from "zod";'],
    [ROOT_FILE, 'import { assertHex } from "@/engine/color/guards";'],
    [ROOT_FILE, 'import { isPlainText } from "@/spec/text";'],
    [ROOT_FILE, 'import { zipBundle } from "@/export/zip";'],
    [ROOT_FILE, 'import { buildBundle } from "@/export";'],
    [ROOT_FILE, 'import { lockSeed } from "@/features/studio/params";'],
    [ROOT_FILE, 'import { chipChange } from "@/features/ai/steer";'],
    [ROOT_FILE, 'import { readAiEnv } from "../server/ai/env";'],
    [ROOT_FILE, 'import type { Snapshot } from "../features/studio/drafts";'],
    [ROOT_FILE, 'import brief from "./prompts/brief.md";'],
    [ROOT_FILE, 'import brief from "./prompts/brief.md?url";'],
    [NESTED_FILE, 'import brief from "./prompts/brief.md?raw";'],
    [ROOT_FILE, 'import { useState } from "react";'],
    [ROOT_FILE, 'const m = await import("@/export/zip");'],
  ])("C-GUARD4-02 reports the probe in %s: %j", (file, source) => {
    expect(aiImportViolations(file, source)).toHaveLength(1);
  });

  it.each([
    [ROOT_FILE, 'import { lintSpec } from "@/engine";'],
    [ROOT_FILE, 'import type { DesignSpec } from "@/spec";'],
    [ROOT_FILE, 'import { z } from "@/spec/zod";'],
    [ROOT_FILE, 'import { sha256 } from "@/export/sha256";'],
    [ROOT_FILE, 'import { AI_FEATURES } from "./features";'],
    [ROOT_FILE, 'export { words } from "./lexicon/match";'],
    [ROOT_FILE, 'import brief from "./prompts/brief.md?raw";'],
    [NESTED_FILE, 'import type { BriefDraft } from "../features";'],
    [NESTED_FILE, 'import { LEXICON } from "@/ai/lexicon/data";'],
  ])("C-GUARD4-02 allows the probe in %s: %j", (file, source) => {
    expect(aiImportViolations(file, source)).toEqual([]);
  });
});

describe("C-GUARD4-03 app code reaches @/ai only through import()", () => {
  /** The static imports of the AI core in `file`, type imports aside. */
  const staticAiImports = (file: string, source: string) =>
    staticCoreImports(file, source).filter((specifier) => {
      if (/^@\/ai(?:\/|$)/.test(specifier)) return true;
      const resolved = path.resolve(path.dirname(file), specifier);
      return (
        specifier.startsWith(".") && (resolved === AI_DIR || resolved.startsWith(AI_DIR + path.sep))
      );
    });

  it("C-GUARD4-03 finds no static import of @/ai or a path under it in src/features, app, components or lib", () => {
    const bad = APP_FILES.flatMap((file) =>
      staticAiImports(file, readFileSync(file, "utf8")).map(
        (specifier) => `${path.relative(ROOT, file)}: ${specifier}`,
      ),
    );
    expect(bad).toEqual([]);
  });

  it("C-GUARD4-03 sees a static import of the AI core and lets a type import through", () => {
    expect(staticAiImports(PROBE_FILE, 'import { parseOutput } from "@/ai";')).toEqual(["@/ai"]);
    expect(staticAiImports(PROBE_FILE, 'import { x } from "@/ai/chat";')).toEqual(["@/ai/chat"]);
    expect(staticAiImports(PROBE_FILE, 'import { x } from "../ai/chat";')).toEqual(["../ai/chat"]);
    expect(staticAiImports(PROBE_FILE, 'import { x } from "../ai";')).toEqual(["../ai"]);
    expect(staticAiImports(PROBE_FILE, 'import type { AiChange } from "@/ai";')).toEqual([]);
    expect(staticAiImports(PROBE_FILE, 'import { chipChange } from "./ai/steer";')).toEqual([]);
  });

  it("C-GUARD4-03 names exactly @/export, @/import or @/ai in every import() of a core", () => {
    expect(misnamedDynamicImports()).toEqual([]);
  });

  it("C-GUARD4-03 Biome rejects a probe importing @/ai/chat from src/features, naming the three cores", () => {
    const result = lint(
      'import { chatMessages } from "@/ai/chat";\nexport const z = chatMessages;\n',
    );
    expect(result.status).not.toBe(0);
    expect(result.output).toContain("noRestrictedImports");
    expect(result.output).toContain('import("@/ai")');
  });
});

// C-GUARD4-04 of docs/specs/04-ai.md, section 14.10 (R4-05): the server shell is reached only from
// the two route files, and imports only what R4-05 lists; the Langfuse and OpenTelemetry packages of
// R4-60 only in langfuse.ts, so no other server file pulls in a tracing SDK.

const SERVER_DIR = path.join(ROOT, "src/server");
const SERVER_AI_DIR = path.join(SERVER_DIR, "ai");
const LANGFUSE_FILE = path.join(SERVER_AI_DIR, "langfuse.ts");
const ROUTE_FILES = ["src/app/api/ai/[feature]/route.ts", "src/app/api/ai/models/route.ts"].map(
  (file) => path.join(ROOT, file),
);
/** The files of R4-05, src/server/ai/ in full. */
const SERVER_AI_FILES = [
  "env",
  "clock",
  "cap",
  "guard",
  "cache",
  "transport",
  "trace",
  "smoke",
  "langfuse",
  "handle",
  "deps",
].map((name) => path.join(SERVER_AI_DIR, `${name}.ts`));
/** What R4-05 lets a src/server file import, beside its own files. */
const SERVER_ALLOWED = ["@/ai", "@/engine", "@/spec", "next/server"];
/** The tracing packages of R4-60, for langfuse.ts alone. */
const TRACING_PACKAGES = [
  "@langfuse/tracing",
  "@langfuse/otel",
  "@opentelemetry/api",
  "@opentelemetry/core",
  "@opentelemetry/sdk-trace-base",
  "@opentelemetry/otlp-exporter-base",
  "@opentelemetry/exporter-trace-otlp-http",
];

/** Whether `specifier`, written in `file`, points into src/server. */
function reachesServer(file: string, specifier: string): boolean {
  if (/^@\/server(?:\/|$)/.test(specifier)) return true;
  if (!specifier.startsWith(".")) return false;
  const resolved = path.resolve(path.dirname(file), specifier);
  return resolved === SERVER_DIR || resolved.startsWith(SERVER_DIR + path.sep);
}

/** The specifiers of `file` that reach src/server, type imports included. */
const serverImports = (file: string, source: string): string[] =>
  moduleSpecifiers(stripComments(source)).filter((specifier) => reachesServer(file, specifier));

/** The specifiers of `file` (under src/server) that R4-05 does not allow, type imports included. */
function serverImportViolations(file: string, source: string): string[] {
  return moduleSpecifiers(stripComments(source)).filter((specifier) => {
    if (SERVER_ALLOWED.includes(specifier)) return false;
    if (file === LANGFUSE_FILE && TRACING_PACKAGES.includes(specifier)) return false;
    return !reachesServer(file, specifier);
  });
}

describe("C-GUARD4-04 the server shell is reached only from the two routes and imports only R4-05's list", () => {
  it("C-GUARD4-04 scans real files: the server files of R4-05 and the two route files", () => {
    for (const file of [...SERVER_AI_FILES, ...ROUTE_FILES]) {
      expect(existsSync(file), path.relative(ROOT, file)).toBe(true);
    }
    expect(codeFiles(SERVER_DIR)).toEqual(expect.arrayContaining(SERVER_AI_FILES));
  });

  it("C-GUARD4-04 finds no import of src/server under src/features, src/components or src/lib", () => {
    const files = ["src/features", "src/components", "src/lib"].flatMap((folder) =>
      codeFiles(path.join(ROOT, folder)),
    );
    expect(files.length).toBeGreaterThan(0);
    const bad = files.flatMap((file) =>
      serverImports(file, readFileSync(file, "utf8")).map(
        (specifier) => `${path.relative(ROOT, file)}: ${specifier}`,
      ),
    );
    expect(bad).toEqual([]);
  });

  it("C-GUARD4-04 finds src/server imported under src/app by the two route files only", () => {
    const importers = codeFiles(path.join(ROOT, "src/app"))
      .filter((file) => serverImports(file, readFileSync(file, "utf8")).length > 0)
      .sort();
    expect(importers).toEqual([...ROUTE_FILES].sort());
  });

  it("C-GUARD4-04 finds src/server importing only @/ai, @/engine, @/spec, next/server and its own files, and the tracing packages in langfuse.ts alone", () => {
    const files = codeFiles(SERVER_DIR);
    expect(files.length).toBeGreaterThanOrEqual(SERVER_AI_FILES.length);
    const bad = files.flatMap((file) =>
      serverImportViolations(file, readFileSync(file, "utf8")).map(
        (specifier) => `${path.relative(ROOT, file)}: ${specifier}`,
      ),
    );
    expect(bad).toEqual([]);
    const langfuse = moduleSpecifiers(stripComments(readFileSync(LANGFUSE_FILE, "utf8")));
    expect(langfuse.some((specifier) => TRACING_PACKAGES.includes(specifier))).toBe(true);
  });

  const HANDLE_FILE = path.join(SERVER_AI_DIR, "handle.ts");
  const APP_PROBE = path.join(ROOT, "src/app/probe.ts");

  it.each([
    'import { handleAi } from "@/server/ai/handle";',
    'import type { AiDeps } from "@/server/ai/handle";',
    'import { x } from "@/server";',
    'import { x } from "../server/ai/env";',
    'export { serverDeps } from "../server/ai/deps";',
    'const m = await import("@/server/ai/handle");',
  ])("C-GUARD4-04 sees an import of src/server in the probe %j", (source) => {
    expect(serverImports(APP_PROBE, source)).toHaveLength(1);
  });

  it.each([
    'import { x } from "@/serverless";',
    'import { x } from "./server-actions";',
    'import { x } from "@/lib/site/config";',
    '// import { handleAi } from "@/server/ai/handle";',
  ])("C-GUARD4-04 lets the probe %j through", (source) => {
    expect(serverImports(APP_PROBE, source)).toEqual([]);
  });

  it.each([
    [HANDLE_FILE, 'import { z } from "zod";'],
    [HANDLE_FILE, 'import { z } from "@/spec/zod";'],
    [HANDLE_FILE, 'import { chatMessages } from "@/ai/chat";'],
    [HANDLE_FILE, 'import { chipChange } from "@/features/ai/steer";'],
    [HANDLE_FILE, 'import { SITE } from "@/lib/site/config";'],
    [HANDLE_FILE, 'import { createHmac } from "node:crypto";'],
    [HANDLE_FILE, 'import { cookies } from "next/headers";'],
    [HANDLE_FILE, 'import { startObservation } from "@langfuse/tracing";'],
    [HANDLE_FILE, 'import type { Span } from "@opentelemetry/api";'],
    [LANGFUSE_FILE, 'import { NodeSDK } from "@opentelemetry/sdk-node";'],
    [LANGFUSE_FILE, 'import { LangfuseClient } from "@langfuse/client";'],
  ])("C-GUARD4-04 reports the probe in %s: %j", (file, source) => {
    expect(serverImportViolations(file, source)).toHaveLength(1);
  });

  it.each([
    [HANDLE_FILE, 'import { AI_FEATURES, type AiFeature } from "@/ai";'],
    [HANDLE_FILE, 'import type { DesignSpec } from "@/spec";'],
    [HANDLE_FILE, 'import { lintSpec } from "@/engine";'],
    [HANDLE_FILE, 'import { after } from "next/server";'],
    [HANDLE_FILE, 'import { readAiEnv } from "./env";'],
    [HANDLE_FILE, 'import { readAiEnv } from "@/server/ai/env";'],
    [LANGFUSE_FILE, 'import { startObservation } from "@langfuse/tracing";'],
    [LANGFUSE_FILE, 'import { LangfuseSpanProcessor } from "@langfuse/otel";'],
    [LANGFUSE_FILE, 'import { BasicTracerProvider } from "@opentelemetry/sdk-trace-base";'],
  ])("C-GUARD4-04 allows the probe in %s: %j", (file, source) => {
    expect(serverImportViolations(file, source)).toEqual([]);
  });
});

// C-GUARD4-08 of docs/specs/04-ai.md, section 14.10 (R4-20): .env.example names every variable of
// section 11.4, with the values that section's last paragraph gives: the slugs of R4-13 and the
// reserve 35; every other value, each secret and the Langfuse trio among them, is empty, and
// Langfuse's US base URL stands in a comment, so a copy of the file leaves tracing off.

/** The variables of section 11.4, in its order, with the value `.env.example` gives each. */
const ENV_EXAMPLE: ReadonlyArray<readonly [name: string, value: string]> = [
  ["OPENROUTER_API_KEY", ""],
  ["DYELOT_COOKIE_SECRET", ""],
  ["DYELOT_AI_RESERVE", "35"],
  ["OPENROUTER_BASE_URL", ""],
  ["OPENROUTER_MODEL_PRIMARY", "google/gemma-4-26b-a4b-it:free"],
  ["OPENROUTER_MODEL_FAST", "xingchen-agi/xing4.0-29b-a4b:free"],
  ["OPENROUTER_MODEL_FALLBACK", "dots-studio/dots-3-note-preview:free"],
  ["OPENROUTER_VISION_MODEL_1", "dots-studio/dots-3-note-preview:free"],
  ["OPENROUTER_VISION_MODEL_2", "google/gemma-4-26b-a4b-it:free"],
  ["OPENROUTER_VISION_MODEL_3", ""],
  ["LANGFUSE_PUBLIC_KEY", ""],
  ["LANGFUSE_SECRET_KEY", ""],
  ["LANGFUSE_BASE_URL", ""],
  ["APP_ENV", ""],
];

/** The `NAME=value` lines of a dotenv text, in order; comments, blank and indented lines aside. */
function dotenvEntries(text: string): [name: string, value: string][] {
  return text
    .split(/\r?\n/)
    .filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line))
    .map((line) => {
      const at = line.indexOf("=");
      return [line.slice(0, at), line.slice(at + 1)];
    });
}

describe("C-GUARD4-08 .env.example declares every variable of section 11.4", () => {
  const entries = dotenvEntries(readFileSync(path.join(ROOT, ".env.example"), "utf8"));
  const names = new Set(ENV_EXAMPLE.map(([name]) => name));

  it("C-GUARD4-08 declares each variable of section 11.4 once, in that section's order", () => {
    expect(entries.map(([name]) => name).filter((name) => names.has(name))).toEqual(
      ENV_EXAMPLE.map(([name]) => name),
    );
  });

  it("C-GUARD4-08 gives the slugs and the reserve, and leaves the rest empty, the Langfuse trio included", () => {
    const values = new Map(entries);
    for (const [name, value] of ENV_EXAMPLE) expect(values.get(name), name).toBe(value);
  });

  it("C-GUARD4-08 names Langfuse's US base URL in a comment only", () => {
    const lines = readFileSync(path.join(ROOT, ".env.example"), "utf8").split(/\r?\n/);
    const naming = lines.filter((line) => line.includes("https://us.cloud.langfuse.com"));
    expect(naming.length).toBeGreaterThan(0);
    for (const line of naming) expect(line.startsWith("#"), line).toBe(true);
  });

  it("C-GUARD4-08 reads NAME=value lines and nothing else (a probe)", () => {
    expect(dotenvEntries("# A=1\nB=2\r\n\n  C=3\nD=\nE=x=y\n")).toEqual([
      ["B", "2"],
      ["D", ""],
      ["E", "x=y"],
    ]);
  });
});

// C-GUARD4-09 of docs/specs/04-ai.md, section 14.10 (R4-29, I-M4-05): the visitor key's storage name
// lives in one file of src, and nothing in the browser's AI shell logs, so the key cannot leave
// through a log line.

const KEY_STORAGE_NAME = "dyelot:openrouter-key";
const FEATURES_AI_DIR = path.join(ROOT, "src/features/ai");
const VISITOR_KEY_FILE = path.join(FEATURES_AI_DIR, "visitor-key.ts");

/** Whether comment-free code names `console`, as a call, a property read or a destructuring. */
const namesConsole = (source: string): boolean => /\bconsole\b/.test(stripComments(source));

describe("C-GUARD4-09 the visitor key's name lives in visitor-key.ts, and src/features/ai never logs", () => {
  it("C-GUARD4-09 names dyelot:openrouter-key in src/features/ai/visitor-key.ts and in no other file under src", () => {
    const holders = textFiles(path.join(ROOT, "src")).filter((file) =>
      readFileSync(file, "utf8").includes(KEY_STORAGE_NAME),
    );
    expect(holders.map((file) => path.relative(ROOT, file))).toEqual([
      path.relative(ROOT, VISITOR_KEY_FILE),
    ]);
  });

  it("C-GUARD4-09 finds no console in any file under src/features/ai", () => {
    const files = codeFiles(FEATURES_AI_DIR);
    expect(files).toEqual(expect.arrayContaining([VISITOR_KEY_FILE]));
    const bad = files
      .filter((file) => namesConsole(readFileSync(file, "utf8")))
      .map((file) => path.relative(ROOT, file));
    expect(bad).toEqual([]);
  });

  it.each([
    "console.log(key);",
    "console.error(error)",
    "globalThis.console.info(stores);",
    'console["warn"](key);',
    "const { debug } = console;",
  ])("C-GUARD4-09 sees console in the probe %j", (source) => {
    expect(namesConsole(source)).toBe(true);
  });

  it.each([
    "// console.log(key);",
    "/* console.error(error) */ const x = 1;",
    "const consoleText = 1; const myconsole = 2;",
  ])("C-GUARD4-09 lets the probe %j through", (source) => {
    expect(namesConsole(source)).toBe(false);
  });
});

// C-GUARD4-05 of docs/specs/04-ai.md, section 14.10 (R4-02, R4-08, R4-60): no AI SDK, mock server,
// color utility, in-browser model runtime or embedding package enters the repo; colorthief is pinned
// to exactly 3.5.0, and every Langfuse or OpenTelemetry package to an exact version.

/** The packages R4-60 keeps out of the repo. */
const EXCLUDED_PACKAGES = [
  "ai",
  "@openrouter/ai-sdk-provider",
  "msw",
  "@material/material-color-utilities",
  "@huggingface/transformers",
  "@mlc-ai/web-llm",
] as const;
/** An exact version: no range, tag, tilde, caret, wildcard or protocol. */
const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
/**
 * The tracing packages R4-60 pins: the `@langfuse` and `@opentelemetry` scopes, and the unscoped
 * `langfuse` and `opentelemetry` packages and their `-` variants (`langfuse-node`, `langfuse-vercel`,
 * `opentelemetry-instrumentation-…`).
 */
const TRACING_PACKAGE = /^(?:@langfuse\/|@opentelemetry\/|(?:langfuse|opentelemetry)(?:-|$))/;
const isTracingPackage = (name: string): boolean => TRACING_PACKAGE.test(name);

/** Every dependency of a package.json, by name, from each of its dependency fields. */
function declaredPackages(manifest: Record<string, unknown>): Map<string, string> {
  const fields = [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
  ] as const;
  const found = new Map<string, string>();
  for (const field of fields) {
    const entries = manifest[field];
    if (entries === undefined) continue;
    for (const [name, version] of Object.entries(entries as Record<string, string>)) {
      found.set(name, version);
    }
  }
  return found;
}

describe("C-GUARD4-05 package.json pins colorthief and the tracing packages and holds no excluded package", () => {
  const manifest = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const packages = declaredPackages(manifest);

  it("C-GUARD4-05 holds none of ai, @openrouter/ai-sdk-provider, msw, Material Color Utilities, @huggingface/transformers or @mlc-ai/web-llm", () => {
    expect(EXCLUDED_PACKAGES.filter((name) => packages.has(name))).toEqual([]);
  });

  it("C-GUARD4-05 pins colorthief to exactly 3.5.0", () => {
    expect(packages.get("colorthief")).toBe("3.5.0");
  });

  it("C-GUARD4-05 pins every Langfuse or OpenTelemetry package to an exact version", () => {
    const loose = [...packages]
      .filter(([name, version]) => isTracingPackage(name) && !EXACT_VERSION.test(version))
      .map(([name, version]) => `${name}@${version}`);
    expect(loose).toEqual([]);
  });

  it("C-GUARD4-05 reads every dependency field and tells an exact version from a range (a probe)", () => {
    const probe = declaredPackages({
      dependencies: { ai: "^5.0.0", colorthief: "3.5.0" },
      devDependencies: { msw: "2.0.0", "@langfuse/otel": "~6.1.1" },
      optionalDependencies: { "@mlc-ai/web-llm": "0.2.0" },
      peerDependencies: { "@opentelemetry/api": "1.9.1" },
    });
    expect(EXCLUDED_PACKAGES.filter((name) => probe.has(name))).toEqual([
      "ai",
      "msw",
      "@mlc-ai/web-llm",
    ]);
    for (const version of ["3.5.0", "6.1.1", "0.223.0", "1.0.0-rc.1"]) {
      expect(EXACT_VERSION.test(version), version).toBe(true);
    }
    for (const version of ["^3.5.0", "~6.1.1", "3.x", "*", "latest", ">=1.0.0", "npm:x@1.0.0"]) {
      expect(EXACT_VERSION.test(version), version).toBe(false);
    }
    expect(isTracingPackage("@langfuse/tracing")).toBe(true);
    expect(isTracingPackage("@opentelemetry/sdk-trace-base")).toBe(true);
    // The unscoped Langfuse and OpenTelemetry packages count too (controller ruling on Task
    // 4.10b's review), so `langfuse@^3` cannot slip past the exact-version rule.
    for (const name of [
      "langfuse",
      "langfuse-node",
      "langfuse-vercel",
      "langfuse-langchain",
      "opentelemetry",
      "opentelemetry-instrumentation-fetch",
    ]) {
      expect(isTracingPackage(name), name).toBe(true);
    }
    for (const name of ["lang", "langfuser", "otel-ish", "@lang/fuse", "colorthief"]) {
      expect(isTracingPackage(name), name).toBe(false);
    }
    const loose = declaredPackages({
      dependencies: { langfuse: "^3.38.0", "langfuse-node": "3.38.0" },
    });
    expect(
      [...loose].filter(
        ([name, version]) => isTracingPackage(name) && !EXACT_VERSION.test(version),
      ),
    ).toEqual([["langfuse", "^3.38.0"]]);
  });
});

describe("the guards' file walks skip the Biome probe folder", () => {
  it("lists no file under a __entry-probe__ folder, which entry.test.ts writes and removes", () => {
    expect(inProbe(path.join(ROOT, "src", "components", PROBE_DIR, "probe.ts"))).toBe(true);
    expect(inProbe(path.join(ROOT, "src", "components", "probe.ts"))).toBe(false);
    expect(inProbe(path.join(ROOT, "src", "features", "__entry-probe-x__", "a.ts"))).toBe(false);
  });
});

// C-GUARD4-07 of docs/specs/04-ai.md, section 14.10 (R4-28, R4-59): every string a model writes
// reaches the page as React text, so no file under src writes HTML: `dangerouslySetInnerHTML` only in
// the site's structured data (JSON-LD it builds itself), and no `innerHTML`, `outerHTML`,
// `insertAdjacentHTML` or `document.write` anywhere. Comments may name them; strings may not.

const STRUCTURED_DATA_FILE = path.join(ROOT, "src/lib/site/structured-data.tsx");

/** The ways to write HTML that C-GUARD4-07 forbids, each with its pattern. */
const HTML_SINKS: ReadonlyArray<readonly [name: string, pattern: RegExp]> = [
  ["dangerouslySetInnerHTML", /\bdangerouslySetInnerHTML\b/],
  ["innerHTML", /\binnerHTML\b/],
  ["outerHTML", /\bouterHTML\b/],
  ["insertAdjacentHTML", /\binsertAdjacentHTML\b/],
  ["document.write", /\bdocument\s*\.\s*write(?:ln)?\b/],
];

/** The HTML sinks a source names outside its comments (strings count), by name. */
function htmlSinks(source: string): string[] {
  const code = stripComments(source);
  return HTML_SINKS.filter(([, pattern]) => pattern.test(code)).map(([name]) => name);
}

describe("C-GUARD4-07 model text is React text: src writes no HTML", () => {
  const files = codeFiles(path.join(ROOT, "src"));

  it("C-GUARD4-07 scans real files, the structured data and the inspector's model text among them", () => {
    expect(files).toEqual(
      expect.arrayContaining([
        STRUCTURED_DATA_FILE,
        path.join(ROOT, "src/features/ai/RationaleSection.tsx"),
        path.join(ROOT, "src/features/ai/Explanation.tsx"),
      ]),
    );
  });

  it("C-GUARD4-07 finds dangerouslySetInnerHTML only in src/lib/site/structured-data.tsx", () => {
    const holders = files
      .filter((file) => htmlSinks(readFileSync(file, "utf8")).includes("dangerouslySetInnerHTML"))
      .map((file) => path.relative(ROOT, file));
    expect(holders).toEqual([path.relative(ROOT, STRUCTURED_DATA_FILE)]);
  });

  it("C-GUARD4-07 finds no innerHTML, outerHTML, insertAdjacentHTML or document.write in src", () => {
    const bad = files.flatMap((file) =>
      htmlSinks(readFileSync(file, "utf8"))
        .filter((sink) => sink !== "dangerouslySetInnerHTML")
        .map((sink) => `${path.relative(ROOT, file)}: ${sink}`),
    );
    expect(bad).toEqual([]);
  });

  it.each([
    ["dangerouslySetInnerHTML", "<p dangerouslySetInnerHTML={{ __html: text }} />"],
    ["innerHTML", "node.innerHTML = text;"],
    ["innerHTML", 'node["innerHTML"] = text;'],
    ["outerHTML", "const html = node.outerHTML;"],
    ["insertAdjacentHTML", 'node.insertAdjacentHTML("beforeend", text);'],
    ["document.write", "document.write(text);"],
    ["document.write", "window.document.writeln(text);"],
    ["document.write", "document . write(text);"],
  ])("C-GUARD4-07 sees %s in the probe %j", (name, source) => {
    expect(htmlSinks(source)).toContain(name);
  });

  it.each([
    "// node.innerHTML = text;",
    "/* document.write(text); */ const x = 1;",
    "node.textContent = text;",
    "const innerHTMLish = 1; const myouterHTML = 2;",
    "const writer = document.writer;",
  ])("C-GUARD4-07 lets the probe %j through", (source) => {
    expect(htmlSinks(source)).toEqual([]);
  });
});

// C-GUARD4-06 of docs/specs/04-ai.md, section 14.10 (R4-13): every slug the repository configures,
// fixes or mocks is a free one. The values of the slug variables in .env.example, the e2e server's
// environment in playwright.config.ts and the mock OpenRouter, and every string literal ending in
// `:free` in those files and in the unit fixtures, pass `isFreeSlug`. An empty value is an unset
// tier (11.4), not a slug.

/** The files whose slug variables and `:free` literals the guard reads. */
const SLUG_FILES = [".env.example", "playwright.config.ts", "tests/e2e/mock-openrouter.mjs"];
/** A slug variable's name: `OPENROUTER_MODEL_*` or `OPENROUTER_VISION_MODEL_*`. */
const SLUG_NAME = "OPENROUTER_(?:VISION_)?MODEL_[A-Z0-9_]+";
/** A dotenv line `NAME=value`, at the start of its line (a comment never is). */
const DOTENV_SLUG = new RegExp(`^(${SLUG_NAME})=(.*)$`, "gm");
/** An object entry `NAME: "value"`, the value in any quote. */
const ENTRY_SLUG = new RegExp(`\\b(${SLUG_NAME})\\s*:\\s*(["'\`])([^"'\`\\n]*)\\2`, "g");
/** A string literal, in any quote, whose text ends in `:free`. */
const FREE_LITERAL = /(["'`])([^"'`\n]*:free)\1/g;

/** The slug variables a file sets, as `[name, value]` pairs in order, empty values included. */
function slugVariables(text: string): [name: string, value: string][] {
  const dotenv = [...text.matchAll(DOTENV_SLUG)].map((match): [string, string] => [
    match[1] as string,
    (match[2] as string).trim(),
  ]);
  const entries = [...text.matchAll(ENTRY_SLUG)].map((match): [string, string] => [
    match[1] as string,
    match[3] as string,
  ]);
  return [...dotenv, ...entries];
}

/** The text of every string literal ending in `:free`, in order. */
const freeLiterals = (text: string): string[] =>
  [...text.matchAll(FREE_LITERAL)].map((match) => match[2] as string);

/** Every `fixtures*.ts` file under tests/unit. */
function unitFixtureFiles(): string[] {
  return readdirSync(path.join(ROOT, "tests/unit"), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /^fixtures.*\.ts$/.test(entry.name))
    .map((entry) => path.join(entry.parentPath, entry.name));
}

describe("C-GUARD4-06 every configured, fixed or mocked slug is free", () => {
  const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");

  it("C-GUARD4-06 reads every slug variable of .env.example and of the e2e server", () => {
    const names = [
      "OPENROUTER_MODEL_PRIMARY",
      "OPENROUTER_MODEL_FAST",
      "OPENROUTER_MODEL_FALLBACK",
      "OPENROUTER_VISION_MODEL_1",
      "OPENROUTER_VISION_MODEL_2",
      "OPENROUTER_VISION_MODEL_3",
    ];
    expect(slugVariables(read(".env.example")).map(([name]) => name)).toEqual(names);
    expect(slugVariables(read("playwright.config.ts"))).toEqual([
      ["OPENROUTER_MODEL_PRIMARY", "test/text-1:free"],
      ["OPENROUTER_MODEL_FAST", "test/text-2:free"],
      ["OPENROUTER_MODEL_FALLBACK", "test/text-3:free"],
      ["OPENROUTER_VISION_MODEL_1", "test/vision-1:free"],
      ["OPENROUTER_VISION_MODEL_2", "test/vision-2:free"],
      ["OPENROUTER_VISION_MODEL_3", "test/vision-3:free"],
    ]);
  });

  it("C-GUARD4-06 finds the free slugs the mock answers as tier 1 and the fixtures' test slugs", () => {
    expect(freeLiterals(read("tests/e2e/mock-openrouter.mjs"))).toEqual(
      expect.arrayContaining(["test/text-1:free", "test/vision-1:free"]),
    );
    const fixtures = unitFixtureFiles();
    expect(fixtures).toContain(path.join(ROOT, "tests/unit/ai/fixtures.ts"));
    expect(fixtures.flatMap((file) => freeLiterals(readFileSync(file, "utf8")))).toEqual(
      expect.arrayContaining([
        "test/text-1:free",
        "test/text-2:free",
        "test/text-3:free",
        "test/vision-1:free",
        "test/vision-2:free",
        "test/vision-3:free",
      ]),
    );
  });

  it("C-GUARD4-06 finds every slug variable's value and every :free literal free", () => {
    const slugs = SLUG_FILES.flatMap((file) => {
      const text = read(file);
      const values = slugVariables(text)
        .filter(([, value]) => value !== "")
        .map(([name, value]) => [`${file} ${name}`, value] as const);
      const literals = freeLiterals(text).map((literal) => [file, literal] as const);
      return [...values, ...literals];
    });
    const fixtures = unitFixtureFiles().flatMap((file) =>
      freeLiterals(readFileSync(file, "utf8")).map(
        (literal) => [path.relative(ROOT, file), literal] as const,
      ),
    );
    const notFree = [...slugs, ...fixtures]
      .filter(([, slug]) => !isFreeSlug(slug))
      .map(([where, slug]) => `${where}: ${slug}`);
    expect(notFree).toEqual([]);
  });

  it("C-GUARD4-06 reads both forms of a slug variable and every quote of a :free literal (a probe)", () => {
    const probe = [
      "# OPENROUTER_MODEL_PRIMARY=commented/out:free",
      "OPENROUTER_MODEL_PRIMARY=openai/gpt-4o",
      "OPENROUTER_VISION_MODEL_3=",
      "const env = { OPENROUTER_MODEL_FAST: \"vendor/model:free\", OPENROUTER_VISION_MODEL_1: 'x:free' };",
      "const slug = `vendor/model-2:free`;",
    ].join("\n");
    expect(slugVariables(probe)).toEqual([
      ["OPENROUTER_MODEL_PRIMARY", "openai/gpt-4o"],
      ["OPENROUTER_VISION_MODEL_3", ""],
      ["OPENROUTER_MODEL_FAST", "vendor/model:free"],
      ["OPENROUTER_VISION_MODEL_1", "x:free"],
    ]);
    expect(freeLiterals(probe)).toEqual(["vendor/model:free", "x:free", "vendor/model-2:free"]);
    // A paid slug and a malformed free one are caught.
    expect(isFreeSlug("openai/gpt-4o")).toBe(false);
    expect(isFreeSlug("x:free")).toBe(false);
    expect(isFreeSlug("vendor/model:free")).toBe(true);
  });
});

// C-GUARD4-12 of docs/specs/04-ai.md, section 14.10 (R4-16, R4-56): on Vercel `request.signal` fires
// only for a function that opts in, so vercel.json opts the AI POST route in, and holds nothing else.
// The key is the function's source path, the form of the vercel.json reference's `functions` key
// (its `pages/blog/[hello].tsx`), and the setting is the one of the Functions API reference's
// "Cancel requests" section.

/** The AI POST route's source file (R4-15). */
const AI_ROUTE_FILE = "src/app/api/ai/[feature]/route.ts";

describe("C-GUARD4-12 vercel.json opts the AI route, and only it, into request cancellation", () => {
  it("C-GUARD4-12 holds exactly supportsCancellation for the AI POST route, and no other setting", () => {
    const vercel: unknown = JSON.parse(readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
    expect(vercel).toEqual({
      $schema: "https://openapi.vercel.sh/vercel.json",
      functions: { [AI_ROUTE_FILE]: { supportsCancellation: true } },
    });
  });

  it("C-GUARD4-12 names a route file that exists and answers POST", () => {
    const route = path.join(ROOT, AI_ROUTE_FILE);
    expect(existsSync(route)).toBe(true);
    expect(readFileSync(route, "utf8")).toMatch(/^export async function POST\(/m);
  });
});

// C-GUARD4-11 of docs/specs/04-ai.md, section 14.10 (R4-59, section 20): every case of section 14
// carries its id in a test title, a C- id in a `describe` or `it` title under tests/unit and an F-
// id in a `test` title under tests/e2e. The ids are read from section 14's rows, so the count is
// the spec's, never a fixed number, and a case added to the spec without its test fails here.

/** A case row of section 14: its id alone in the first cell. */
const CASE_ROW = /^\| ([CF]-[A-Z0-9]+-[A-Z0-9]+) \|/gm;

/** Section 14 of the M4 spec: from its heading to section 15's. */
function section14(spec: string): string {
  const start = spec.indexOf("\n## 14. ");
  const end = spec.indexOf("\n## 15. ", start);
  if (start === -1 || end === -1)
    throw new Error("section14: docs/specs/04-ai.md lost section 14 or 15");
  return spec.slice(start, end);
}

/** The ids of section 14's case rows, in the spec's order. */
function caseIds(section: string): string[] {
  return [...section.matchAll(CASE_ROW)].map((match) => match[1] ?? "");
}

/** The titles of the calls whose name `callee` matches, read from the source's syntax tree. */
function testTitles(source: string, file: string, callee: RegExp): string[] {
  const tree = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    false,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const titles: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const name = calleeName(node.expression);
      const title = name !== null && callee.test(name) ? titleText(node.arguments[0]) : null;
      if (title !== null) titles.push(title);
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return titles;
}

/** A call's name: `it`, `it.each` for `it.each(…)(…)`, `test.describe`; null for anything else. */
function calleeName(node: ts.Expression): string | null {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isCallExpression(node)) return calleeName(node.expression);
  if (ts.isPropertyAccessExpression(node)) {
    const base = calleeName(node.expression);
    return base === null ? null : `${base}.${node.name.text}`;
  }
  return null;
}

/** A title's text: a string or template literal, a template with `{}` for each value, or a `+` of them. */
function titleText(node: ts.Expression | undefined): string | null {
  if (node === undefined) return null;
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isTemplateExpression(node)) {
    return node.head.text + node.templateSpans.map((span) => `{}${span.literal.text}`).join("");
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = titleText(node.left);
    const right = titleText(node.right);
    return left === null || right === null ? null : left + right;
  }
  return null;
}

/** The ids no title carries: a C- id in none of `unit`, an F- id in none of `e2e`. */
function unnamedCases(
  ids: readonly string[],
  unit: readonly string[],
  e2e: readonly string[],
): string[] {
  return ids.filter((id) => {
    // The id whole: no letter, digit or hyphen right before or after it.
    const pattern = new RegExp(`(?<![A-Z0-9-])${id}(?![A-Z0-9])`);
    return !(id.startsWith("C-") ? unit : e2e).some((title) => pattern.test(title));
  });
}

/** A unit title: `describe` or `it`, with Vitest's modifiers and `.each(…)`. */
const UNIT_TITLE =
  /^(?:describe|it)(?:\.(?:each|skip|only|concurrent|sequential|runIf|skipIf|todo|fails))*$/;
/** An end-to-end title: Playwright's `test` and its modifiers, never `test.describe`. */
const E2E_TITLE = /^test(?:\.(?:skip|only|fixme|fail|slow))*$/;

/** Every file under `folder` whose name `pattern` matches. */
function filesUnder(folder: string, pattern: RegExp): string[] {
  return readdirSync(path.join(ROOT, folder), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && pattern.test(entry.name))
    .map((entry) => path.join(entry.parentPath, entry.name));
}

const titlesIn = (files: readonly string[], callee: RegExp): string[] =>
  files.flatMap((file) => testTitles(readFileSync(file, "utf8"), file, callee));

describe("C-GUARD4-11 every case of section 14 carries its id in a test title", () => {
  const section = section14(readFileSync(path.join(ROOT, "docs/specs/04-ai.md"), "utf8"));
  const ids = caseIds(section);
  const unit = titlesIn(filesUnder("tests/unit", /\.test\.tsx?$/), UNIT_TITLE);
  const e2e = titlesIn(filesUnder("tests/e2e", /\.spec\.ts$/), E2E_TITLE);

  it("C-GUARD4-11 reads the ids from section 14's rows, one per case row, each once", () => {
    const rows = section.split("\n").filter((line) => /^\| [CF]-/.test(line));
    expect(ids.length).toBeGreaterThan(0);
    expect(ids).toHaveLength(rows.length);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(["C-GEN4-01", "C-GUARD4-11", "F-RAT-01"]));
    // Section 13's and 15's text is not section 14's.
    expect(section.startsWith("\n## 14. Cases")).toBe(true);
    expect(section).not.toContain("\n## 15. ");
  });

  it("C-GUARD4-11 finds each C- id in a unit title and each F- id in an end-to-end title", () => {
    expect(unit.length).toBeGreaterThan(0);
    expect(e2e.length).toBeGreaterThan(0);
    expect(unnamedCases(ids, unit, e2e)).toEqual([]);
  });

  it("C-GUARD4-11 reports a probe list's ids that no title carries", () => {
    const probe = [...ids, "C-PROBE4-01", "F-PROBE4-01"];
    expect(unnamedCases(probe, unit, e2e)).toEqual(["C-PROBE4-01", "F-PROBE4-01"]);
    // A C- id only in an end-to-end title, or an F- id only in a unit title, is not named.
    expect(unnamedCases(["C-X-01", "F-X-01"], ["F-X-01 a"], ["C-X-01 a"])).toEqual([
      "C-X-01",
      "F-X-01",
    ]);
    // An id is matched whole: C-AI-1 is not in a title that names C-AI-19 or XC-AI-1.
    expect(unnamedCases(["C-AI-1"], ["C-AI-19 a", "XC-AI-1 b"], [])).toEqual(["C-AI-1"]);
    expect(unnamedCases(["C-AI-1"], ["a C-AI-1: b"], [])).toEqual([]);
  });

  it("C-GUARD4-11 reads titles in each form a test takes, and nothing else (a probe)", () => {
    const source = [
      'describe("C-A-01 plain", () => {});',
      'it.each([1, 2])("C-A-02 %s each", () => {});',
      "describe.each([[1]])(`C-A-03 template`, () => {});",
      'it.runIf(true)("C-A-04 " + "joined", () => {});',
      // A template with a value: "$" and "{" apart, so this string is not read as a template.
      "it.skipIf(false)(`C-A-05 $" + "{1} spans`, () => {});",
      'test("C-A-06 a test is not a unit title", () => {});',
      'expect("C-A-07 not a title").toBe("x");',
      "it(title, () => {});",
    ].join("\n");
    expect(testTitles(source, "probe.test.ts", UNIT_TITLE)).toEqual([
      "C-A-01 plain",
      "C-A-02 %s each",
      "C-A-03 template",
      "C-A-04 joined",
      "C-A-05 {} spans",
    ]);
    const flows = [
      'test.describe("F-B-01 a describe is not a test title", () => {',
      '  test("F-B-02 plain", async () => {});',
      '  test.fixme("F-B-03 fixme", async () => {});',
      '  test.describe.configure({ mode: "serial" });',
      "});",
    ].join("\n");
    expect(testTitles(flows, "probe.spec.ts", E2E_TITLE)).toEqual(["F-B-02 plain", "F-B-03 fixme"]);
  });
});
