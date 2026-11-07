import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  codeFiles,
  importsOf,
  isValue,
  moduleFile,
  ROOT,
  readDisk,
  readOnly,
  SRC_DIR,
  valueImporters,
} from "./guard-support";

// The M6 repository guards (docs/specs/06-gallery.md, section 14.12, C-GUARD6-nn). Task 6.1a holds
// C-GUARD6-04 and C-GUARD6-06; the other rows join this file with their tasks.

const GALLERY_DIR = path.join(SRC_DIR, "features/gallery");
const at = (file: string): string => path.join(SRC_DIR, file);
const ALL_FILES = codeFiles(SRC_DIR);

/** The files of `files` that import `target` as a value and `allowed` does not name, relative to the root. */
function strays(
  target: string,
  allowed: (file: string) => boolean,
  files: readonly string[],
  read = readDisk,
): string[] {
  return valueImporters(target, files, read)
    .filter((file) => !allowed(file))
    .map((file) => path.relative(ROOT, file));
}

const inFolder = (folder: string) => (file: string) => file.startsWith(at(folder) + path.sep);
const named =
  (...names: string[]) =>
  (file: string) =>
    names.map(at).includes(file);
const either =
  (...tests: ((file: string) => boolean)[]) =>
  (file: string) =>
    tests.some((test) => test(file));

/** The importers C-GUARD6-04 allows for `data.ts`: the gallery's pages, the sitemap and two components. */
const DATA_IMPORTERS = either(
  inFolder("app/gallery"),
  named("app/sitemap.ts", "features/gallery/GalleryCard.tsx", "features/gallery/Specimen.tsx"),
);
const CARDS_IMPORTERS = named(
  "app/gallery/opengraph-image.tsx",
  "app/gallery/[slug]/opengraph-image.tsx",
);

describe("C-GUARD6-04 the gallery data's importers (R6-56)", () => {
  it("C-GUARD6-04 lets only data.ts import gallery.json", () => {
    const json = at("features/gallery/gallery.json");
    expect(readDisk(json)).not.toBeNull();
    expect(strays(json, named("features/gallery/data.ts"), ALL_FILES)).toEqual([]);
    expect(valueImporters(json, ALL_FILES, readDisk)).toEqual([at("features/gallery/data.ts")]);
  });

  it("C-GUARD6-04 lets only the pages, the sitemap and two components import data.ts as a value", () => {
    expect(strays(at("features/gallery/data.ts"), DATA_IMPORTERS, ALL_FILES)).toEqual([]);
  });

  it("C-GUARD6-04 lets only build.ts import defs.ts, and nothing in src import build.ts", () => {
    expect(
      strays(at("features/gallery/defs.ts"), named("features/gallery/build.ts"), ALL_FILES),
    ).toEqual([]);
    expect(strays(at("features/gallery/build.ts"), () => false, ALL_FILES)).toEqual([]);
  });

  it("C-GUARD6-04 lets only the two image routes import cards.ts", () => {
    expect(strays(at("features/gallery/cards.ts"), CARDS_IMPORTERS, ALL_FILES)).toEqual([]);
  });

  it("C-GUARD6-04 reports a probe that imports data.ts from a client component", () => {
    const probe = path.join(GALLERY_DIR, "ProbeClient.tsx");
    const read = readOnly({
      ...Object.fromEntries(
        ["data.ts", "gallery.json", "defs.ts", "build.ts", "cards.ts"].map((name) => [
          path.join(GALLERY_DIR, name),
          "",
        ]),
      ),
      [probe]: '"use client";\nimport { GALLERY } from "./data";\nexport const x = GALLERY;',
    });
    const data = path.join(GALLERY_DIR, "data.ts");
    expect(strays(data, DATA_IMPORTERS, [probe], read)).toEqual([
      "src/features/gallery/ProbeClient.tsx",
    ]);
    const typeOnly = readOnly({
      [data]: "",
      [probe]: 'import type { GalleryData } from "./data";',
    });
    expect(strays(data, DATA_IMPORTERS, [probe], typeOnly)).toEqual([]);
    const dynamic = readOnly({
      [data]: "",
      [probe]: 'const m = () => import("@/features/gallery/data");',
    });
    expect(strays(data, DATA_IMPORTERS, [probe], dynamic)).toEqual([
      "src/features/gallery/ProbeClient.tsx",
    ]);
    const viaDefs = readOnly({
      [path.join(GALLERY_DIR, "defs.ts")]: "",
      [probe]: 'export * from "./defs";',
    });
    expect(
      strays(
        path.join(GALLERY_DIR, "defs.ts"),
        named("features/gallery/build.ts"),
        [probe],
        viaDefs,
      ),
    ).toEqual(["src/features/gallery/ProbeClient.tsx"]);
    expect(isValue({ specifier: "x", names: [], typeOnly: false, dynamic: false })).toBe(true);
    expect(moduleFile(probe, "@/features/gallery/data", read)).toBe(data);
  });
});

describe("C-GUARD6-06 build.ts reaches @/ai through a type import only (R6-06)", () => {
  const BUILD = at("features/gallery/build.ts");
  const AI_SPECIFIER = /^@\/ai(?:\/|$)|^(?:\.\.?\/)+ai(?:\/|$)/;

  /** The `@/ai` imports of `source` that load the module: static or dynamic, never `import type`. */
  const aiValueImports = (file: string, source: string): string[] =>
    importsOf(file, source)
      .filter(
        (record) => AI_SPECIFIER.test(record.specifier) && (!record.typeOnly || record.dynamic),
      )
      .map((record) => record.specifier);

  it("C-GUARD6-06 names @/ai in build.ts only in an import type", () => {
    const source = readFileSync(BUILD, "utf8");
    expect(importsOf(BUILD, source).filter((r) => r.specifier === "@/ai")).toHaveLength(1);
    expect(aiValueImports(BUILD, source)).toEqual([]);
  });

  it("C-GUARD6-06 finds no static value import of @/ai under src/features", () => {
    const bad = codeFiles(path.join(SRC_DIR, "features")).flatMap((file) =>
      importsOf(file, readFileSync(file, "utf8"))
        .filter(
          (record) => !record.typeOnly && !record.dynamic && AI_SPECIFIER.test(record.specifier),
        )
        .map((record) => `${path.relative(ROOT, file)}: ${record.specifier}`),
    );
    expect(bad).toEqual([]);
  });

  it("C-GUARD6-06 reports a probe value import of @/ai in build.ts", () => {
    expect(aiValueImports(BUILD, 'import { briefChange } from "@/ai";')).toEqual(["@/ai"]);
    expect(aiValueImports(BUILD, 'import * as AI from "@/ai";')).toEqual(["@/ai"]);
    expect(aiValueImports(BUILD, 'const ai = await import("@/ai");')).toEqual(["@/ai"]);
    expect(aiValueImports(BUILD, 'import { x } from "@/ai/apply";')).toEqual(["@/ai/apply"]);
    expect(aiValueImports(BUILD, 'import type * as AiModule from "@/ai";')).toEqual([]);
  });
});
