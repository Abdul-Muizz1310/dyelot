import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { briefSpec, type GalleryAi } from "@/features/gallery/build";
import { galleryCards } from "@/features/gallery/cards";
import { entryDescription, entryMetadata, type GalleryEntry } from "@/features/gallery/data";
import { isLinkPage, LINK_PAGES } from "@/features/gallery/links";
import { codeFiles, importsOf, ROOT, testTitles, UNIT_TITLE } from "../../engine/guard-support";
import { BRIEFS, GALLERY_DATA, KERMES } from "../../support/gallery";

// C-GAL7-01 to C-GAL7-04, C-CARD7-03 and C-DATA7-01 of docs/specs/07-finish.md, section 14.1
// (R7-07 to R7-10).

const KERMES_DEF = BRIEFS.find((def) => def.slug === "kermes");
if (KERMES_DEF === undefined || KERMES_DEF.source !== "brief") throw new Error("no kermes row");
type Brief = typeof KERMES_DEF;

const briefChange = vi.fn();
const AI = {
  briefColors: (text: string) => ({ seeds: [], rest: text }),
  matchLexicon: () => ({ draft: null, terms: [] }),
  briefChange,
} as unknown as GalleryAi;

const run = (patch: Record<string, unknown>) => () =>
  briefSpec({ ...KERMES_DEF, ...patch } as Brief, AI);

describe("briefSpec's word rules (R7-07)", () => {
  it("C-GAL7-01 refuses each row that breaks R6-12, with the rule's message", () => {
    const nameMsg = (name: string) =>
      `briefSpec: the name of "kermes" must be 1 to 18 letters and single spaces, got "${name}"`;
    const rows: [Record<string, unknown>, string][] = [
      [{ name: "Abcdefghijklmnopqrs" }, nameMsg("Abcdefghijklmnopqrs")],
      [{ name: "Red 2" }, nameMsg("Red 2")],
      [{ name: "Two  Spaces" }, nameMsg("Two  Spaces")],
      [
        { name: "Cochineal" },
        `briefSpec: the slug "kermes" must be the name in lowercase with hyphens`,
      ],
      [
        { brief: "A tea house at dusk\u0007, lit by paper lanterns." },
        `briefSpec: the brief of "kermes" must be plain text`,
      ],
      [
        { brief: `A${"b".repeat(27)}.` },
        `briefSpec: the brief of "kermes" must have 30 to 100 characters, got 29`,
      ],
      [
        { brief: `A ${"b".repeat(98)}.` },
        `briefSpec: the brief of "kermes" must have 30 to 100 characters, got 101`,
      ],
      [
        { brief: "A tea house at dusk with paper lanterns" },
        `briefSpec: the brief of "kermes" must be one sentence ending in a period`,
      ],
      [
        { brief: "A tea house at dusk. Paper lanterns glow." },
        `briefSpec: the brief of "kermes" must be one sentence ending in a period`,
      ],
    ];
    for (const [patch, message] of rows) {
      expect(run(patch), message).toThrow(RangeError);
      expect(run(patch), message).toThrow(
        new RegExp(`^${message.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
      );
    }
    const bad = run({ name: 5, brief: `A ${"b".repeat(98)}.` });
    expect(bad).toThrow(TypeError);
    expect(bad).toThrow(/^briefSpec: def\.name/);
  });

  it("C-GAL7-04 passes the word rules at their bounds and stops at the word list", () => {
    const rows: Record<string, unknown>[] = [
      { name: "Abcdefghijklmnopqr", slug: "abcdefghijklmnopqr" },
      { name: "Two Words", slug: "two-words" },
      { brief: `A${"b".repeat(28)}.` },
      { brief: `A ${"b".repeat(97)}.` },
    ];
    for (const patch of rows) {
      const slug = (patch.slug ?? "kermes") as string;
      const call = run(patch);
      expect(call).toThrow(RangeError);
      expect(call).toThrow(
        new RegExp(`^briefSpec: the brief of "${slug}" matches no term of the word list$`),
      );
    }
    expect(briefChange).not.toHaveBeenCalled();
  });
});

describe("the readers' checks (R7-08)", () => {
  const copy = (): GalleryEntry => structuredClone(KERMES);
  const readers = [entryDescription, entryMetadata] as const;
  const withContrast = (patch: Record<string, unknown>): GalleryEntry => {
    const entry = copy();
    Object.assign(entry.summary.contrast, patch);
    return entry;
  };

  it("C-GAL7-02 refuses a summary the readers cannot read, types first", () => {
    const noSummary = copy() as unknown as Record<string, unknown>;
    delete noSummary.summary;
    const noContrast = copy();
    (noContrast.summary as unknown as Record<string, unknown>).contrast = null;
    const typeRows: [GalleryEntry, string][] = [
      [noSummary as unknown as GalleryEntry, "entry.summary"],
      [noContrast, "entry.summary.contrast"],
      [withContrast({ requiredPass: "78" }), "entry.summary.contrast.requiredPass"],
      [withContrast({ requiredPass: "78", required: 77.5 }), "entry.summary.contrast.requiredPass"],
    ];
    const rangeRows: [GalleryEntry, string][] = [
      [withContrast({ requiredPass: 77.5 }), "entry.summary.contrast.requiredPass"],
      [withContrast({ requiredPass: -1 }), "entry.summary.contrast.requiredPass"],
    ];
    for (const read of readers) {
      for (const [entry, path] of typeRows) {
        expect(() => read(entry), `${read.name} ${path}`).toThrow(TypeError);
        expect(() => read(entry)).toThrow(
          new RegExp(`^${read.name}: ${path.replaceAll(".", "\\.")}`),
        );
      }
      for (const [entry, path] of rangeRows) {
        expect(() => read(entry), `${read.name} ${path}`).toThrow(RangeError);
        expect(() => read(entry)).toThrow(
          new RegExp(`^${read.name}: ${path.replaceAll(".", "\\.")}`),
        );
      }
    }
    expect(entryDescription(KERMES)).toBe(
      `${KERMES.line} ${KERMES.summary.contrast.requiredPass} of ${KERMES.summary.contrast.required} required contrast checks pass.`,
    );
    expect(entryMetadata(KERMES).description).toBe(entryDescription(KERMES));
  });

  it("C-CARD7-03 refuses a specimen that is not an array, and one out of order", () => {
    const data = (specimen: unknown) => ({
      entries: GALLERY_DATA.entries.map((entry) =>
        entry.slug === "kermes" ? { ...entry, specimen } : entry,
      ),
    });
    const notArray = () => galleryCards(data("x") as never);
    expect(notArray).toThrow(TypeError);
    expect(notArray).toThrow(/^galleryCards.*kermes/);
    const short = () => galleryCards(data(KERMES.specimen.slice(0, 4)) as never);
    expect(short).toThrow(RangeError);
    expect(short).toThrow(/^galleryCards/);
    expect(galleryCards(GALLERY_DATA).cards).toHaveLength(24);
  });
});

const GALLERY_SOURCES = [
  ...codeFiles(path.join(ROOT, "src/features/gallery")),
  ...codeFiles(path.join(ROOT, "src/app/gallery")),
];
const read = (file: string): string => readFileSync(file, "utf8");
const parse = (file: string): ts.SourceFile =>
  ts.createSourceFile(
    file,
    read(file),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
const walk = (tree: ts.Node, visit: (node: ts.Node) => void): void => {
  visit(tree);
  ts.forEachChild(tree, (child) => walk(child, visit));
};
const endsWith = (file: string, tail: string): boolean =>
  file.split(path.sep).join("/").endsWith(tail);
const LINKS_FILE = "src/features/gallery/links.ts";

describe("one source for the gallery's shared names (R7-10)", () => {
  it("C-GAL7-03 holds the pages, the guard and the names in links.ts only", () => {
    expect(LINK_PAGES).toEqual(["studio", "explore", "motion"]);
    expect(Object.isFrozen(LINK_PAGES)).toBe(true);
    for (const page of LINK_PAGES) expect(isLinkPage(page)).toBe(true);
    for (const page of ["lab", "Studio", "", "__proto__"]) expect(isLinkPage(page)).toBe(false);
    expect(() => isLinkPage(3 as never)).toThrow(TypeError);
    expect(() => isLinkPage(3 as never)).toThrow(/^isLinkPage/);

    const route = GALLERY_SOURCES.find((file) =>
      endsWith(file, "src/app/gallery/[slug]/open/[page]/route.ts"),
    );
    const entryPage = GALLERY_SOURCES.find((file) =>
      endsWith(file, "src/app/gallery/[slug]/page.tsx"),
    );
    const build = GALLERY_SOURCES.find((file) => endsWith(file, "src/features/gallery/build.ts"));
    if (route === undefined || entryPage === undefined || build === undefined) {
      throw new Error("a gallery file is missing");
    }
    const fromLinks = (file: string) =>
      importsOf(file, read(file))
        .filter((record) => record.specifier === "@/features/gallery/links")
        .flatMap((record) => record.names);
    expect(fromLinks(route)).toContain("isLinkPage");
    expect(fromLinks(entryPage)).toContain("LINK_PAGES");

    let labels = false;
    walk(parse(entryPage), (node) => {
      if (
        ts.isVariableDeclaration(node) &&
        node.type !== undefined &&
        node.type.getText() === "Record<LinkPage, string>" &&
        node.initializer !== undefined &&
        ts.isObjectLiteralExpression(node.initializer)
      ) {
        labels = true;
      }
    });
    expect(labels, "a Record<LinkPage, string> label object").toBe(true);

    const arrays: string[] = [];
    const declared: Record<string, string[]> = { typeName: [], SLUG: [], isRecord: [] };
    for (const file of GALLERY_SOURCES) {
      walk(parse(file), (node) => {
        if (
          ts.isArrayLiteralExpression(node) &&
          node.elements.length === 3 &&
          node.elements.every((element) => ts.isStringLiteralLike(element)) &&
          node.elements.map((element) => (element as ts.StringLiteral).text).join() ===
            "studio,explore,motion"
        ) {
          arrays.push(file);
        }
        const name =
          (ts.isFunctionDeclaration(node) || ts.isVariableDeclaration(node)) &&
          node.name !== undefined &&
          ts.isIdentifier(node.name)
            ? node.name.text
            : null;
        if (name !== null && name in declared) declared[name]?.push(file);
      });
    }
    expect(arrays.map((file) => path.relative(ROOT, file))).toEqual([LINKS_FILE]);
    expect(declared.typeName?.map((file) => path.relative(ROOT, file))).toEqual([LINKS_FILE]);
    expect(declared.SLUG?.map((file) => path.relative(ROOT, file))).toEqual([LINKS_FILE]);
    expect(declared.isRecord?.some((file) => file === build)).toBe(false);
  });
});

describe("the update command (R7-09)", () => {
  const SCRIPT =
    "DYELOT_UPDATE_GALLERY=1 DYELOT_UPDATE_HEROES=1 vitest run --project web --project web-slow tests/unit/features/gallery/data.test.ts tests/unit/features/gallery/cards.test.ts tests/unit/features/landing/receipt.test.ts tests/unit/features/landing/heroes.test.ts -t rewrites";
  const WRITERS = [
    "tests/unit/features/gallery/data.test.ts",
    "tests/unit/features/gallery/cards.test.ts",
    "tests/unit/features/landing/receipt.test.ts",
    "tests/unit/features/landing/heroes.test.ts",
  ];
  const TITLES = [
    "C-GAL6-02 rewrites gallery.json, and never in CI",
    "C-CARD6-02 rewrites cards.json, and never in CI",
    "C-REC6-02 rewrites receipt-excerpt.json, and never in CI",
    "C-LAND5-02 rewrites hero-cards.json, and never in CI",
  ];

  it("C-DATA7-01 names the four writers, each inside its update switch", () => {
    const pkg = JSON.parse(read(path.join(ROOT, "package.json"))) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts["data:update"]).toBe(SCRIPT);
    for (const file of WRITERS) expect(SCRIPT).toContain(file);
    const found: string[] = [];
    for (const file of WRITERS) {
      const full = path.join(ROOT, file);
      const source = read(full);
      const titles = testTitles(source, full, UNIT_TITLE).filter((title) =>
        title.includes("rewrites"),
      );
      found.push(...titles);
      walk(parse(full), (node) => {
        if (!ts.isCallExpression(node)) return;
        const first = node.arguments[0];
        if (
          first === undefined ||
          !ts.isStringLiteralLike(first) ||
          !first.text.includes("rewrites")
        )
          return;
        let guarded = false;
        for (let up: ts.Node | undefined = node.parent; up !== undefined; up = up.parent) {
          if (
            ts.isIfStatement(up) &&
            /process\.env\.DYELOT_UPDATE_(GALLERY|HEROES)/.test(up.expression.getText())
          ) {
            guarded = true;
          }
        }
        expect(guarded, `${first.text} sits in an update-switch if`).toBe(true);
      });
    }
    expect(found).toEqual(TITLES);
  });
});
