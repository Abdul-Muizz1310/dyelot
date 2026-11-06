import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { importsOf } from "../engine/guard-support";

// C-BRAND-05 of docs/specs/05-motion-3d.md, section 14.3 (ruling R5-22): root.tsx is read from its
// syntax tree and never executed, since it calls registerRoot.

const FILE = path.resolve(import.meta.dirname, "../../../src/flavor/remotion/root.tsx");
const SOURCE = readFileSync(FILE, "utf8");
const TREE = ts.createSourceFile(FILE, SOURCE, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX);

function walk(node: ts.Node, visit: (node: ts.Node) => void): void {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}

/** Every `<Composition …>` of the file as its attributes: `id`, `spread` texts and `defaultProps`. */
function compositions() {
  const found: { id: string; spreads: string[]; defaultProps: string; component: string }[] = [];
  walk(TREE, (node) => {
    if (!ts.isJsxSelfClosingElement(node) && !ts.isJsxOpeningElement(node)) return;
    if (node.tagName.getText(TREE) !== "Composition") return;
    const entry = { id: "", spreads: [] as string[], defaultProps: "", component: "" };
    for (const attribute of node.attributes.properties) {
      if (ts.isJsxSpreadAttribute(attribute)) {
        entry.spreads.push(attribute.expression.getText(TREE));
      } else if (ts.isJsxAttribute(attribute) && attribute.initializer) {
        const value = ts.isJsxExpression(attribute.initializer)
          ? (attribute.initializer.expression?.getText(TREE) ?? "")
          : attribute.initializer.getText(TREE).slice(1, -1);
        const name = attribute.name.getText(TREE);
        if (name === "id") entry.id = value.replace(/^["']|["']$/g, "");
        if (name === "defaultProps") entry.defaultProps = value;
        if (name === "component") entry.component = value;
      }
    }
    found.push(entry);
  });
  return found;
}

/** The `registerRoot(...)` calls of the file, as their argument texts. */
function registerCalls(): string[] {
  const found: string[] = [];
  walk(TREE, (node) => {
    if (ts.isCallExpression(node) && node.expression.getText(TREE) === "registerRoot") {
      found.push(node.arguments.map((argument) => argument.getText(TREE)).join(", "));
    }
  });
  return found;
}

describe("root.tsx", () => {
  it("C-BRAND-05 imports exactly remotion, ./brand-intro and ./brand.json", () => {
    expect(
      importsOf(FILE, SOURCE)
        .map(({ specifier }) => specifier)
        .sort(),
    ).toEqual(["./brand-intro", "./brand.json", "remotion"]);
  });

  it("C-BRAND-05 registers the two compositions with BRAND_INTRO and the brand props", () => {
    const found = compositions();
    expect(found.map((entry) => entry.id)).toEqual(["brand-intro-light", "brand-intro-dark"]);
    expect(found.map((entry) => entry.defaultProps)).toEqual(["brand.light", "brand.dark"]);
    for (const entry of found) {
      expect(entry.spreads).toEqual(["{...BRAND_INTRO}".slice(4, -1)]);
      expect(entry.component).toBe("BrandIntro");
    }
  });

  it("C-BRAND-05 calls registerRoot(RemotionRoot) once", () => {
    expect(registerCalls()).toEqual(["RemotionRoot"]);
    const exported: string[] = [];
    walk(TREE, (node) => {
      if (
        ts.isFunctionDeclaration(node) &&
        node.name &&
        node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
      ) {
        exported.push(node.name.text);
      }
    });
    expect(exported).toEqual(["RemotionRoot"]);
  });
});
