import { readdirSync, readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import path from "node:path";
import ts from "typescript";

// The helpers the repository guards share (R5 preflight rulings 14 and 16): moved unchanged from
// repo-guards.test.ts so the M5 guards import them rather than copy them. C-REPO-01's and
// C-GUARD3-02's scanners and file lists live here too, for C-GUARD5-11 to read (Task 5.11a), and
// C-GUARD4-11's case-id readers, for C-GUARD5-01 to read (Task 5.12).

export const ROOT = path.resolve(import.meta.dirname, "../../..");
export const ENGINE_DIR = path.join(ROOT, "src/engine");
export const SPEC_DIR = path.join(ROOT, "src/spec");
export const THEME_DIR = path.join(ROOT, "src/theme");
export const EXPORT_DIR = path.join(ROOT, "src/export");
export const IMPORT_DIR = path.join(ROOT, "src/import");
const CODE_FILE = /\.[cm]?[jt]sx?$/;

/**
 * A folder the Biome probes of tests/unit/engine/entry.test.ts write under src for a moment and
 * remove: a file listed while it exists may be gone by the time a guard reads it, so no walk
 * lists it.
 */
export const PROBE_DIR = "__entry-probe__";
/**
 * The file C-GUARD3-04's Biome probe (tests/unit/engine/repo-guards.test.ts) writes under
 * src/features for a moment and removes. The M5 guards walk src from another test file, at the same
 * time, so no walk lists it either.
 */
export const GUARD3_04_PROBE = path.join(ROOT, "src/features/guard3-04-probe.ts");
export const inProbe = (file: string): boolean =>
  file === GUARD3_04_PROBE || file.split(path.sep).includes(PROBE_DIR);

/** Every code file under `directory`, or none when the folder does not exist yet. */
export function codeFiles(directory: string): string[] {
  try {
    return readdirSync(directory, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && CODE_FILE.test(entry.name))
      .map((entry) => path.join(entry.parentPath, entry.name))
      .filter((file) => !inProbe(file));
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
export function stripComments(source: string): string {
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
export const FORBIDDEN: ReadonlyArray<readonly [name: string, pattern: RegExp]> = [
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
export function specifiers(source: string): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+)["']/g)) {
    found.push(match[1]);
  }
  return found;
}

/** An import from `node:…`, a Node built-in, React or Next. */
export function isForbiddenSpecifier(specifier: string): boolean {
  if (specifier.startsWith("node:")) return true;
  const root = specifier.split("/")[0];
  return NODE_MODULES.has(specifier) || NODE_MODULES.has(root) || FRAMEWORKS.has(root);
}

/** C-REPO-01's scanner: the names of the forbidden APIs and imports in one file, comments aside. */
export function purityViolations(source: string): string[] {
  const code = stripComments(source);
  const found = FORBIDDEN.filter(([, pattern]) => pattern.test(code)).map(([name]) => name);
  for (const specifier of specifiers(code)) {
    if (isForbiddenSpecifier(specifier)) found.push(`import "${specifier}"`);
  }
  return found;
}

/** The files C-REPO-01 scans: every code file of src/engine and src/spec. */
export const engineAndSpecFiles = (): string[] => [
  ...codeFiles(ENGINE_DIR),
  ...codeFiles(SPEC_DIR),
];

/** The names of the I-M3-02 APIs in comment-free code (C-GUARD3-02). */
export const IMPURE: ReadonlyArray<readonly [name: string, pattern: RegExp]> = [
  ["Date", /\bDate\b/],
  ["Math.random", /Math\.random/],
  ["getRandomValues", /getRandomValues/],
  ["performance", /\bperformance\b/],
  ["Intl", /\bIntl\b/],
  ["toLocale", /toLocale/],
  ["localeCompare", /localeCompare/],
  ["document", /\bdocument\b/],
  ["window", /\bwindow\b/],
  ["localStorage", /\blocalStorage\b/],
  ["sessionStorage", /\bsessionStorage\b/],
  ["fetch", /\bfetch\b/],
  ["XMLHttpRequest", /\bXMLHttpRequest\b/],
];

/** C-GUARD3-02's scanner: the I-M3-02 APIs and `node:` imports in one file, comments aside. */
export function coreViolations(source: string): string[] {
  const code = stripComments(source);
  const found = IMPURE.filter(([, pattern]) => pattern.test(code)).map(([name]) => name);
  if (/(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)["']node:/.test(code)) {
    found.push("node: import");
  }
  return found;
}

/** The files C-GUARD3-02 scans: every code file of src/export and src/import. */
export const exportAndImportFiles = (): string[] => [
  ...codeFiles(EXPORT_DIR),
  ...codeFiles(IMPORT_DIR),
];

/** One import of a source file: its specifier, the names it takes and the form it is written in. */
export type ImportRecord = {
  readonly specifier: string;
  readonly names: readonly string[];
  readonly typeOnly: boolean;
  readonly dynamic: boolean;
};

/**
 * Every import of `source`, read from its syntax tree: static imports, `import type`, `export …
 * from` and `import()`. `file` only picks the script kind (its extension).
 */
export function importsOf(file: string, source: string): readonly ImportRecord[] {
  const kind = /\.[cm]?tsx$|\.jsx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.ESNext, true, kind);
  const found: ImportRecord[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      const names: string[] = [];
      if (clause?.name) names.push("default");
      const bindings = clause?.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) names.push("*");
      if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          names.push((element.propertyName ?? element.name).text);
        }
      }
      found.push({
        specifier: node.moduleSpecifier.text,
        names,
        typeOnly: clause?.isTypeOnly === true,
        dynamic: false,
      });
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const names =
        node.exportClause && ts.isNamedExports(node.exportClause)
          ? node.exportClause.elements.map((element) => (element.propertyName ?? element.name).text)
          : ["*"];
      found.push({
        specifier: node.moduleSpecifier.text,
        names,
        typeOnly: node.isTypeOnly,
        dynamic: false,
      });
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      found.push({ specifier: node.arguments[0].text, names: [], typeOnly: false, dynamic: true });
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return found;
}

// C-GUARD4-11's readers (docs/specs/04-ai.md, section 14.10, R4-59), which C-GUARD5-01 runs on the
// M5 spec (R5-62): moved from repo-guards.test.ts, with the spec's path a parameter.

/** A case row of section 14: its id alone in the first cell. */
export const CASE_ROW = /^\| ([CF]-[A-Z0-9]+-[A-Z0-9]+) \|/gm;

/** Section 14 of the spec at `file`, whose text is `spec`: from its heading to section 15's. */
export function section14(spec: string, file: string): string {
  const start = spec.indexOf("\n## 14. ");
  const end = spec.indexOf("\n## 15. ", start);
  if (start === -1 || end === -1) throw new Error(`section14: ${file} lost section 14 or 15`);
  return spec.slice(start, end);
}

/** The ids of section 14's case rows, in the spec's order. */
export function caseIds(section: string): string[] {
  return [...section.matchAll(CASE_ROW)].map((match) => match[1] ?? "");
}

/** The titles of the calls whose name `callee` matches, read from the source's syntax tree. */
export function testTitles(source: string, file: string, callee: RegExp): string[] {
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
export function unnamedCases(
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
export const UNIT_TITLE =
  /^(?:describe|it)(?:\.(?:each|skip|only|concurrent|sequential|runIf|skipIf|todo|fails))*$/;
/** An end-to-end title: Playwright's `test` and its modifiers, never `test.describe`. */
export const E2E_TITLE = /^test(?:\.(?:skip|only|fixme|fail|slow))*$/;

/** Every file under `folder` whose name `pattern` matches. */
export function filesUnder(folder: string, pattern: RegExp): string[] {
  return readdirSync(path.join(ROOT, folder), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && pattern.test(entry.name))
    .map((entry) => path.join(entry.parentPath, entry.name));
}

export const titlesIn = (files: readonly string[], callee: RegExp): string[] =>
  files.flatMap((file) => testTitles(readFileSync(file, "utf8"), file, callee));
