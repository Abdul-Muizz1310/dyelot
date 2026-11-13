import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  codeFiles,
  importsOf,
  isValue,
  moduleFile,
  type Reader,
  ROOT,
  readDisk,
  readOnly,
  SRC_DIR,
  valueGraph,
  valueImporters,
} from "./guard-support";

// The M6 repository guards (docs/specs/06-gallery.md, section 14.12, C-GUARD6-nn). Task 6.1a holds
// C-GUARD6-04 and C-GUARD6-06 and Task 6.4 C-GUARD6-09; the other rows join this file with their tasks.

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

describe("C-GUARD6-07 the image routes import six modules (R6-18)", () => {
  const ROUTES = ["app/gallery/opengraph-image.tsx", "app/gallery/[slug]/opengraph-image.tsx"].map(
    at,
  );
  const ALLOWED: ReadonlySet<string> = new Set([
    "next/og",
    "next/navigation",
    "@/features/gallery/cards",
    "@/lib/site/assets",
    "@/lib/site/config",
    "@/lib/site/gallery-card",
  ]);
  const DATA = at("features/gallery/data.ts");
  const JSON_FILE = at("features/gallery/gallery.json");

  /** What breaks the rule in `route`: a module outside the six, or data.ts or gallery.json reached. */
  const routeProblems = (route: string, read: Reader): string[] => [
    ...importsOf(route, read(route) ?? "")
      .filter((record) => !ALLOWED.has(record.specifier))
      .map((record) => `imports ${record.specifier}`),
    ...valueGraph(route, read)
      .filter((file) => file === DATA || file === JSON_FILE)
      .map((file) => `reaches ${path.relative(ROOT, file)}`),
  ];

  it("C-GUARD6-07 finds only the six modules in both routes, and neither reaches the gallery data", () => {
    for (const route of ROUTES) expect(routeProblems(route, readDisk), route).toEqual([]);
  });

  it("C-GUARD6-07 reports a probe route that imports data.ts or another module", () => {
    const [, route = ""] = ROUTES;
    const cards = at("features/gallery/cards.ts");
    const direct = readOnly({
      [route]:
        'import { ImageResponse } from "next/og";\nimport { entryOf } from "@/features/gallery/data";',
      [DATA]: 'import gallery from "./gallery.json";',
      [JSON_FILE]: "{}",
    });
    expect(routeProblems(route, direct)).toEqual([
      "imports @/features/gallery/data",
      "reaches src/features/gallery/data.ts",
      "reaches src/features/gallery/gallery.json",
    ]);
    const throughCards = readOnly({
      [route]: 'import { cardOf } from "@/features/gallery/cards";',
      [cards]: 'import { GALLERY } from "./data";',
      [DATA]: "",
    });
    expect(routeProblems(route, throughCards)).toEqual(["reaches src/features/gallery/data.ts"]);
    const other = readOnly({ [route]: 'import { headers } from "next/headers";' });
    expect(routeProblems(route, other)).toEqual(["imports next/headers"]);
    const typeOnly = readOnly({
      [route]: 'import type { GalleryData } from "@/features/gallery/data";',
      [DATA]: "",
    });
    expect(routeProblems(route, typeOnly)).toEqual(["imports @/features/gallery/data"]);
  });
});

describe("C-GUARD6-09 dyelot ships no analytics (R6-22)", () => {
  const PACKAGES = [
    "@vercel/analytics",
    "@vercel/speed-insights",
    "@sentry/nextjs",
    "@sentry/browser",
    "posthog-js",
    "plausible-tracker",
    "mixpanel-browser",
    "react-ga4",
  ];
  const HOSTS = [
    "googletagmanager.com",
    "google-analytics.com",
    "plausible.io",
    "posthog.com",
    "segment.io",
    "sentry.io",
    "/_vercel/insights",
  ];

  /** The names of `manifest`'s dependency tables that are an analytics client, in either table. */
  function analyticsPackages(manifest: string): string[] {
    const parsed = JSON.parse(manifest) as Record<string, Record<string, string> | undefined>;
    const names = [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
      "peerDependencies",
    ].flatMap((table) => Object.keys(parsed[table] ?? {}));
    return names.filter((name) => PACKAGES.includes(name) || name.startsWith("@segment/"));
  }

  /** The hosts of the list that `source` names, in any case. */
  const hostsNamed = (source: string): string[] =>
    HOSTS.filter((host) => source.toLowerCase().includes(host));

  it("C-GUARD6-09 finds no analytics package in package.json", () => {
    expect(analyticsPackages(readFileSync(path.join(ROOT, "package.json"), "utf8"))).toEqual([]);
  });

  it("C-GUARD6-09 finds no analytics host in any file under src", () => {
    const named = ALL_FILES.flatMap((file) =>
      hostsNamed(readFileSync(file, "utf8")).map((host) => `${path.relative(ROOT, file)}: ${host}`),
    );
    expect(named).toEqual([]);
  });

  it("C-GUARD6-09 reports a probe of each package and each host", () => {
    for (const name of [...PACKAGES, "@segment/analytics-next"]) {
      for (const table of ["dependencies", "devDependencies"]) {
        const manifest = JSON.stringify({ [table]: { react: "1.0.0", [name]: "1.0.0" } });
        expect(analyticsPackages(manifest), `${table} ${name}`).toEqual([name]);
      }
    }
    expect(analyticsPackages(JSON.stringify({ dependencies: { react: "1.0.0" } }))).toEqual([]);
    expect(analyticsPackages("{}")).toEqual([]);
    for (const host of HOSTS) {
      expect(hostsNamed(`fetch("https://${host.toUpperCase()}/x")`), host).toEqual([host]);
    }
    expect(hostsNamed('fetch("https://openrouter.ai")')).toEqual([]);
  });
});
