import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { importsOf } from "../engine/guard-support";

// C-HYG6-04 of docs/specs/06-gallery.md, section 14 (R6-40): each loader's shape is read from the
// file's syntax tree, so a comment, a line break or a trailing comma never decides it.

const ROOT = path.join(import.meta.dirname, "../../..");

const tree = (file: string, source: string): ts.SourceFile =>
  ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

/**
 * The entry `x` of `loadOnce(() => import("x"))`, with no other argument, parameter or modifier,
 * else null.
 */
function importedEntry(loader: ts.Expression): string | null {
  if (!ts.isCallExpression(loader) || loader.arguments.length !== 1) return null;
  if (!ts.isIdentifier(loader.expression) || loader.expression.text !== "loadOnce") return null;
  const load = loader.arguments[0];
  if (load === undefined || !ts.isArrowFunction(load)) return null;
  if (load.parameters.length > 0 || (load.modifiers?.length ?? 0) > 0) return null;
  const body = load.body;
  if (!ts.isCallExpression(body) || body.expression.kind !== ts.SyntaxKind.ImportKeyword) {
    return null;
  }
  const [specifier, ...rest] = body.arguments;
  return specifier !== undefined && rest.length === 0 && ts.isStringLiteral(specifier)
    ? specifier.text
    : null;
}

/** The `<entry>` of the top-level `const <name> = loadOnce(() => import("<entry>"))`, else null. */
function loaderEntry(file: string, source: string, name: string): string | null {
  for (const statement of tree(file, source).statements) {
    if (!ts.isVariableStatement(statement)) continue;
    if ((statement.declarationList.flags & ts.NodeFlags.Const) === 0) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== name) continue;
      return declaration.initializer === undefined ? null : importedEntry(declaration.initializer);
    }
  }
  return null;
}

/** Whether `source` assigns `loading` with `??=` anywhere: the memo `loadOnce` replaced. */
function hasLoadingMemo(file: string, source: string): boolean {
  let found = false;
  const visit = (node: ts.Node): void => {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionEqualsToken &&
      ts.isIdentifier(node.left) &&
      node.left.text === "loading"
    ) {
      found = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(tree(file, source));
  return found;
}
const LOADERS = [
  ["src/features/ai/load.ts", "loadAi", "@/ai"],
  ["src/features/export/useBundle.ts", "loadExport", "@/export"],
  ["src/features/import/ImportDialog.tsx", "loadImport", "@/import"],
] as const;

describe("the three loaders (R6-40)", () => {
  it.each(LOADERS)("C-HYG6-04 %s defines %s as loadOnce(() => import(%s))", (file, name, entry) => {
    const text = readFileSync(path.join(ROOT, file), "utf8");
    expect(loaderEntry(file, text, name)).toBe(entry);
    expect(hasLoadingMemo(file, text)).toBe(false);
    expect(importsOf(file, text).some((i) => i.dynamic && i.specifier === entry)).toBe(true);
    expect(importsOf(file, text).some((i) => i.specifier === "@/lib/load-once")).toBe(true);
  });

  it("C-HYG6-04 reads a probe's loader and memo from the syntax tree", () => {
    const one = 'export const loadX = loadOnce(() => import("@/x"));';
    expect(loaderEntry("x.ts", one, "loadX")).toBe("@/x");
    const wrapped = 'const loadX = loadOnce(\n  // the entry\n  () =>\n    import("@/x"),\n);';
    expect(loaderEntry("x.tsx", wrapped, "loadX")).toBe("@/x");
    expect(loaderEntry("x.ts", one, "loadY")).toBeNull();
    for (const other of [
      'export let loadX = loadOnce(() => import("@/x"));',
      'export const loadX = once(() => import("@/x"));',
      'export const loadX = loadOnce(() => import("@/x").then((m) => m));',
      'export const loadX = loadOnce(() => import("@/x"), 1);',
      'export const loadX = loadOnce(async () => import("@/x"));',
      "export const loadX = loadOnce((path) => import(path));",
      'function f() { const loadX = loadOnce(() => import("@/x")); }',
    ]) {
      expect(loaderEntry("x.ts", other, "loadX"), other).toBeNull();
    }
    const memo = [
      "let loading = null;",
      "export function loadX() {",
      '  loading ??= import("@/x");',
      "  return loading;",
      "}",
    ].join("\n");
    expect(loaderEntry("x.ts", memo, "loadX")).toBeNull();
    expect(hasLoadingMemo("x.ts", memo)).toBe(true);
    expect(hasLoadingMemo("x.ts", one)).toBe(false);
    expect(hasLoadingMemo("x.ts", `// loading ??= import("@/x")\n${one}`)).toBe(false);
    expect(hasLoadingMemo("x.ts", "cache ??= new Map();")).toBe(false);
  });
});
