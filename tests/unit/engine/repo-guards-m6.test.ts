import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { brandProps } from "@/export/brand";
import { ABOUT_INTRO, ABOUT_LINKS, ABOUT_SECTIONS } from "@/features/about/copy";
import { brandDescription, FLAVOR_LINES } from "@/features/flavor/video";
import { RECEIPT_EXCERPT, RECEIPT_LINES, receiptLines } from "@/features/landing/receipt";
import { START_LINES } from "@/features/landing/start";
import { TEMPLATE_LINES } from "@/features/preview/templates/load";
import { GALLERY_CARD_ALT, MOSAIC_ALT } from "@/lib/site/gallery-card";
import vitestConfig from "../../../vitest.config";
import { m6CopyProblems } from "../support/copy-m6";
import { GALLERY_DATA, SPEC_OF } from "../support/gallery";
import {
  codeFiles,
  coreFiles,
  coreViolations,
  exportAndImportFiles,
  type Floors,
  floorsOf,
  importsOf,
  isValue,
  moduleFile,
  type Project,
  type ProjectsConfig,
  purityViolations,
  type Reader,
  ROOT,
  readDisk,
  readOnly,
  runs,
  SRC_DIR,
  sourceStrings,
  strings,
  valueGraph,
  valueImporters,
} from "./guard-support";

// The M6 repository guards (docs/specs/06-gallery.md, section 14.12, C-GUARD6-nn). Task 6.1a holds
// C-GUARD6-04 and C-GUARD6-06, Task 6.3 C-GUARD6-07, Task 6.4 C-GUARD6-09 and Task 6.11a C-GUARD6-03,
// 05, 08, 10, 11 and 12; the other rows join this file with their tasks.

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

// C-GUARD6-03 (Task 6.11a, R6-54, section 15): the M6 unit folders join their Vitest projects, and
// section 15's helper lists and floors hold, each named file existing. As C-GUARD5-09 does for M5,
// the rows are written from section 15, never read back from vitest.config.ts, so a list the config
// drops is still asked for. C-REPO-M2-03, C-GUARD4-10 and C-GUARD5-09 keep the earlier scope.

/** Section 15's whole coverage scope. */
const M6_SCOPE_FLOORS: Floors = { lines: 80, statements: 80, functions: 75, branches: 70 };
/** R6-54's test folders, each with the project that runs it. */
const M6_PROJECT_FOLDERS: ReadonlyArray<readonly [folder: string, project: "web" | "core"]> = [
  ["tests/unit/features/gallery", "web"],
  ["tests/unit/features/about", "web"],
  ["tests/unit/scripts", "core"],
];
/** Section 15's helper lists M6 adds or grows, each file measured by name at 95 and 90. */
const M6_HELPERS: ReadonlyArray<readonly [list: string, files: readonly string[]]> = [
  [
    "GALLERY_HELPERS",
    ["tags", "defs", "data", "cards", "links", "build"].map(
      (name) => `src/features/gallery/${name}.ts`,
    ),
  ],
  ["LANDING_HELPERS", ["receipt", "start"].map((name) => `src/features/landing/${name}.ts`)],
  ["ABOUT_HELPERS", ["src/features/about/copy.ts"]],
  ["PREVIEW_HELPERS", ["src/features/preview/templates/load.ts"]],
  ["STUDIO_HELPERS", ["url", "view"].map((name) => `src/features/studio/${name}.ts`)],
  ["FLAVOR_HELPERS", ["src/features/flavor/video.ts"]],
];
/**
 * Section 15's folders that gain a file in M6, with their floors (null: the whole scope's, with no
 * floor of its own) and their new files.
 */
const M6_FOLDERS: ReadonlyArray<
  readonly [glob: string, floors: Floors | null, files: readonly string[]]
> = [
  ["src/export/**", floorsOf(90, 85), ["src/export/guards.ts"]],
  ["src/lib/site/**", null, ["src/lib/site/gallery-card.tsx"]],
];

/**
 * Every way `candidate` misses R6-54 and section 15, named; an empty list when it holds them all.
 * `exists` says whether a path is in the repository.
 */
function guard6Problems(candidate: ProjectsConfig, exists: (file: string) => boolean): string[] {
  const problems: string[] = [];
  const projects: Project[] = Array.isArray(candidate.test?.projects)
    ? (candidate.test.projects as Project[])
    : [];
  const named = (name: string) => projects.find((project) => project.test?.name === name);
  for (const [folder, project] of M6_PROJECT_FOLDERS) {
    if (!exists(folder)) problems.push(`${folder} does not exist`);
    // A file at the top of the folder and one below it, in each extension a test takes.
    const probes = ["probe.test.ts", "probe.test.tsx", "deep/probe.test.ts"].map(
      (name) => `${folder}/${name}`,
    );
    if (!probes.every((file) => runs(named(project), file))) {
      problems.push(`${project} does not run ${folder}/**`);
    }
  }

  const coverage = candidate.test?.coverage;
  const include = strings(coverage?.include);
  const thresholds = (
    typeof coverage?.thresholds === "object" && coverage.thresholds !== null
      ? coverage.thresholds
      : {}
  ) as Record<string, unknown>;
  for (const [name, floor] of Object.entries(M6_SCOPE_FLOORS)) {
    if (thresholds[name] !== floor) {
      problems.push(`the whole scope's ${name} floor is ${String(thresholds[name])}, not ${floor}`);
    }
  }
  for (const [list, files] of M6_HELPERS) {
    for (const file of files) {
      if (!include.includes(file)) problems.push(`coverage does not measure ${file} (${list})`);
      if (!isDeepStrictEqual(thresholds[file], floorsOf(95, 90))) {
        problems.push(`${file} (${list}) is not held to 95 and 90`);
      }
      if (!exists(file)) problems.push(`${file} does not exist`);
    }
  }
  for (const [glob, floors, files] of M6_FOLDERS) {
    if (!include.includes(glob)) problems.push(`coverage does not measure ${glob}`);
    if (floors === null) {
      if (thresholds[glob] !== undefined) {
        problems.push(`${glob} sets a floor of its own, not the whole scope's`);
      }
    } else if (!isDeepStrictEqual(thresholds[glob], floors)) {
      problems.push(`${glob} is not held to ${floors.lines} and ${floors.branches}`);
    }
    for (const file of files) if (!exists(file)) problems.push(`${file} does not exist`);
  }
  return problems;
}

/** A plain copy of the parts of the real config that C-GUARD6-03 reads, for a probe to change. */
function m6ConfigCopy(): {
  test: {
    projects: Project[];
    coverage: { include: string[]; thresholds: Record<string, unknown> };
  };
} {
  return JSON.parse(
    JSON.stringify({
      test: {
        projects: vitestConfig.test?.projects,
        coverage: {
          include: vitestConfig.test?.coverage?.include,
          thresholds: vitestConfig.test?.coverage?.thresholds,
        },
      },
    }),
  );
}

const inRepository = (file: string): boolean => existsSync(path.join(ROOT, file));

describe("C-GUARD6-03 the M6 unit folders join their projects, and section 15's lists and floors hold", () => {
  it("C-GUARD6-03 finds no gap in vitest.config.ts, and each named file exists", () => {
    expect(guard6Problems(vitestConfig, inRepository)).toEqual([]);
  });

  it("C-GUARD6-03 names section 15's thirteen helpers and its two folders", () => {
    expect(M6_HELPERS.flatMap(([, files]) => files)).toHaveLength(13);
    expect(M6_FOLDERS.map(([glob]) => glob)).toEqual(["src/export/**", "src/lib/site/**"]);
  });

  type Probe = ReturnType<typeof m6ConfigCopy>;
  const projectOf = (probe: Probe, name: string) =>
    probe.test.projects.find((each) => each.test?.name === name);
  const excludeFrom = (probe: Probe, name: string, glob: string) => {
    const project = projectOf(probe, name);
    if (project?.test) project.test.exclude = [...(project.test.exclude ?? []), glob];
  };
  it.each<[string, (probe: Probe) => void, string]>([
    [
      "web excluding the gallery's tests",
      (probe) => excludeFrom(probe, "web", "tests/unit/features/gallery/**"),
      "web does not run tests/unit/features/gallery/**",
    ],
    [
      "web excluding the about tests",
      (probe) => excludeFrom(probe, "web", "tests/unit/features/about/**"),
      "web does not run tests/unit/features/about/**",
    ],
    [
      "the scripts' tests moved out of core",
      (probe) => excludeFrom(probe, "core", "tests/unit/scripts/**"),
      "core does not run tests/unit/scripts/**",
    ],
    [
      "start.ts left out of the scope",
      (probe) => {
        probe.test.coverage.include = probe.test.coverage.include.filter(
          (glob) => glob !== "src/features/landing/start.ts",
        );
      },
      "coverage does not measure src/features/landing/start.ts (LANDING_HELPERS)",
    ],
    [
      "templates/load.ts at the export floors",
      (probe) => {
        probe.test.coverage.thresholds["src/features/preview/templates/load.ts"] = floorsOf(90, 85);
      },
      "src/features/preview/templates/load.ts (PREVIEW_HELPERS) is not held to 95 and 90",
    ],
    [
      "a gallery helper with no floor",
      (probe) => {
        delete probe.test.coverage.thresholds["src/features/gallery/build.ts"];
      },
      "src/features/gallery/build.ts (GALLERY_HELPERS) is not held to 95 and 90",
    ],
    [
      "src/export/** at 85 and 80",
      (probe) => {
        probe.test.coverage.thresholds["src/export/**"] = floorsOf(85, 80);
      },
      "src/export/** is not held to 90 and 85",
    ],
    [
      "src/lib/site/** out of the scope",
      (probe) => {
        probe.test.coverage.include = probe.test.coverage.include.filter(
          (glob) => glob !== "src/lib/site/**",
        );
      },
      "coverage does not measure src/lib/site/**",
    ],
    [
      "src/lib/site/** at a floor of its own",
      (probe) => {
        probe.test.coverage.thresholds["src/lib/site/**"] = floorsOf(60, 50);
      },
      "src/lib/site/** sets a floor of its own, not the whole scope's",
    ],
    [
      "a whole-scope floor of 65 branches",
      (probe) => {
        probe.test.coverage.thresholds.branches = 65;
      },
      "the whole scope's branches floor is 65, not 70",
    ],
  ])("C-GUARD6-03 reports the probe: %s", (_name, change, problem) => {
    const probe = m6ConfigCopy();
    change(probe);
    expect(guard6Problems(probe, inRepository)).toContain(problem);
  });

  it("C-GUARD6-03 reports a named file or folder that does not exist (a probe)", () => {
    const gone = new Set([
      "src/features/about/copy.ts",
      "tests/unit/scripts",
      "src/export/guards.ts",
    ]);
    const missing = (file: string) => !gone.has(file) && inRepository(file);
    expect(
      guard6Problems(m6ConfigCopy(), missing).filter((problem) => problem.endsWith("not exist")),
    ).toEqual([
      "tests/unit/scripts does not exist",
      "src/features/about/copy.ts does not exist",
      "src/export/guards.ts does not exist",
    ]);
  });
});

// C-GUARD6-05 (Task 6.11a, R6-28, R6-56, I-M6-03): the gallery's and the landing's client files
// reach no engine, spec or export through their static value imports, and the six data and link
// modules they lean on load nothing as a value but JSON and each other.

/** The client files of R6-56, under src. */
const CLIENT_NAMES = [
  "features/gallery/CopyLink.tsx",
  "features/landing/StartFrom.tsx",
  "features/landing/Hero.tsx",
] as const;
/** The modules that import nothing as a value but JSON and each other, under src. */
const LEAF_NAMES = [
  "features/landing/start.ts",
  "features/landing/receipt.ts",
  "features/gallery/tags.ts",
  "features/gallery/links.ts",
  "features/gallery/cards.ts",
  "features/gallery/data.ts",
] as const;
const LEAF_MODULES = LEAF_NAMES.map(at);

/**
 * The specifiers of `file`'s value imports (static or `import()`; `import type` is exempt) that load
 * anything but a JSON file or one of `LEAF_MODULES`.
 */
function leafStrays(file: string, read: Reader): string[] {
  return importsOf(file, read(file) ?? "")
    .filter((record) => {
      if (!isValue(record)) return false;
      const target = moduleFile(file, record.specifier, read);
      return target === null || !(target.endsWith(".json") || LEAF_MODULES.includes(target));
    })
    .map((record) => record.specifier);
}

describe("C-GUARD6-05 the new client files reach no core, and the data modules stay leaves", () => {
  it.each(CLIENT_NAMES)(
    "C-GUARD6-05 finds no engine, spec or export file in the static value imports of %s",
    (name) => {
      const file = at(name);
      const graph = valueGraph(file, readDisk);
      expect(graph.length).toBeGreaterThan(1);
      expect(coreFiles(graph)).toEqual([]);
    },
  );

  it.each(LEAF_NAMES)(
    "C-GUARD6-05 finds no value import in %s but JSON and the other five",
    (name) => {
      const file = at(name);
      expect(readDisk(file), file).not.toBeNull();
      expect(leafStrays(file, readDisk)).toEqual([]);
    },
  );

  it.each(CLIENT_NAMES)(
    "C-GUARD6-05 reports a probe %s that reaches a core through another file",
    (name) => {
      const file = at(name);
      const middle = path.join(path.dirname(file), "probe-middle.ts");
      const spec = at("spec/index.ts");
      const read = readOnly({
        [file]: 'import { a } from "./probe-middle";\nimport type { DesignSpec } from "@/engine";',
        [middle]: 'import { decodeSpec } from "@/spec";\nexport const a = decodeSpec;',
        [spec]: "export const decodeSpec = 1;",
      });
      expect(coreFiles(valueGraph(file, read))).toEqual([spec]);
    },
  );

  it.each(LEAF_NAMES)("C-GUARD6-05 reports a probe value import in %s", (name) => {
    const file = at(name);
    const [other = ""] = LEAF_MODULES.filter((each) => each !== file);
    const sibling = `@/${path.relative(SRC_DIR, other).replace(/\.ts$/, "")}`;
    const read = readOnly({
      [file]: [
        'import { generateSystem } from "@/engine";',
        'import { useState } from "react";',
        'import type { DesignSpec } from "@/spec";',
        'import probe from "./probe.json";',
        `import { x } from "${sibling}";`,
        'const load = () => import("@/export");',
      ].join("\n"),
      [at("engine/index.ts")]: "",
      [at("spec/index.ts")]: "",
      [at("export/index.ts")]: "",
      [path.join(path.dirname(file), "probe.json")]: "{}",
      [other]: "",
    });
    expect(leafStrays(file, read)).toEqual(["@/engine", "react", "@/export"]);
  });
});

// C-GUARD6-08 (Task 6.11a, R6-59): the copy rules hold in every M6 copy table, every entry's words
// and the strings of the new components and pages: no banned word, no exclamation mark, no emoji and
// no British spelling, by M6's copy check (tests/unit/support/copy-m6.ts), which C-GUARD6-12 reads too.

/** The M6 files whose strings are copy: the gallery's and the landing's components and three pages. */
const M6_COPY_FILES = [
  "src/features/gallery/GalleryCard.tsx",
  "src/features/gallery/Specimen.tsx",
  "src/features/gallery/CopyLink.tsx",
  "src/features/landing/StartFrom.tsx",
  "src/features/landing/ReceiptSection.tsx",
  "src/app/gallery/page.tsx",
  "src/app/gallery/[slug]/page.tsx",
  "src/app/about/page.tsx",
] as const;
/** The Flavor dialog's two keys of R6-36. */
const NEW_FLAVOR_KEYS = ["pause-background", "pause-video"] as const;
const ENTRIES = GALLERY_DATA.entries;

/** Every copy table C-GUARD6-08 names, as [where, text] pairs. */
function m6CopyTables(): [where: string, text: string][] {
  return [
    ...Object.entries(START_LINES).map(([key, text]) => [`START_LINES.${key}`, text]),
    ...Object.entries(RECEIPT_LINES).map(([key, text]) => [`RECEIPT_LINES.${key}`, text]),
    ...receiptLines(RECEIPT_EXCERPT).map((text, i) => [`receiptLines line ${i + 1}`, text]),
    ["ABOUT_INTRO", ABOUT_INTRO.text],
    ...ABOUT_SECTIONS.flatMap((section) => [
      [`ABOUT_SECTIONS.${section.id} heading`, section.heading],
      ...section.paragraphs.map((paragraph, i) => [
        `ABOUT_SECTIONS.${section.id} paragraph ${i + 1}`,
        paragraph.text,
      ]),
    ]),
    ...ABOUT_LINKS.map((link) => [`ABOUT_LINKS ${link.href}`, link.label]),
    ...Object.entries(TEMPLATE_LINES).map(([key, text]) => [`TEMPLATE_LINES.${key}`, text]),
    ...NEW_FLAVOR_KEYS.map((key) => [`FLAVOR_LINES.${key}`, FLAVOR_LINES[key]]),
    // Both modes: the sentence reads the props' words and counts, which a mode could change.
    ...ENTRIES.flatMap((entry) =>
      (["light", "dark"] as const).map((mode) => [
        `brandDescription(${entry.slug}, ${mode})`,
        brandDescription(brandProps(SPEC_OF(entry.slug), mode)),
      ]),
    ),
    ["GALLERY_CARD_ALT", GALLERY_CARD_ALT],
    ["MOSAIC_ALT", MOSAIC_ALT],
    ...ENTRIES.flatMap((entry) => [
      [`${entry.slug} name`, entry.name],
      ...(entry.brief === null ? [] : [[`${entry.slug} brief`, entry.brief]]),
      [`${entry.slug} line`, entry.line],
    ]),
  ] as [string, string][];
}

/** Every rule each text breaks, as "<where>: <problem> in <text>". */
const m6CopyFindings = (texts: readonly (readonly [where: string, text: string])[]): string[] =>
  texts.flatMap(([where, text]) =>
    m6CopyProblems(text).map((problem) => `${where}: ${problem} in ${JSON.stringify(text)}`),
  );

describe("C-GUARD6-08 the M6 copy holds no banned word, no exclamation mark, no emoji and no British spelling", () => {
  it("C-GUARD6-08 reads every table, every entry's words and both modes of each brand video", () => {
    const tables = m6CopyTables();
    const briefs = ENTRIES.filter((entry) => entry.brief !== null).length;
    expect(ENTRIES).toHaveLength(24);
    expect(briefs).toBe(18);
    expect(tables).toHaveLength(
      Object.keys(START_LINES).length +
        Object.keys(RECEIPT_LINES).length +
        receiptLines(RECEIPT_EXCERPT).length +
        1 +
        ABOUT_SECTIONS.reduce((sum, section) => sum + 1 + section.paragraphs.length, 0) +
        ABOUT_LINKS.length +
        3 +
        2 +
        2 * 24 +
        2 +
        2 * 24 +
        briefs,
    );
  });

  it("C-GUARD6-08 finds nothing in the copy tables", () => {
    expect(m6CopyFindings(m6CopyTables())).toEqual([]);
  });

  it.each(M6_COPY_FILES)("C-GUARD6-08 finds nothing in the strings of %s", (file) => {
    const full = path.join(ROOT, file);
    expect(existsSync(full), `${file} exists`).toBe(true);
    const found = sourceStrings(full, readFileSync(full, "utf8"));
    expect(found.length).toBeGreaterThan(0);
    expect(m6CopyFindings(found.map((text) => [file, text] as const))).toEqual([]);
  });

  it("C-GUARD6-08 reports a probe of each rule, in a table and in a file's strings", () => {
    expect(
      m6CopyFindings([
        ["probe", "Simply open one."],
        ["probe", "Just one"],
        ["probe", "An easy start"],
        ["probe", "Obviously so"],
        ["probe", "Basically done"],
        ["probe", "Copied!"],
        ["probe", "Copied \u{2728}"],
        ["probe", "The colour"],
        ["probe", "Its behaviour"],
        ["probe", "Copy cancelled."],
        ["probe", "A grey card"],
        ["probe", "The centre"],
      ]).map((finding) => finding.split(" in ")[0]),
    ).toEqual([
      'probe: banned word "simply"',
      'probe: banned word "just"',
      'probe: banned word "easy"',
      'probe: banned word "obviously"',
      'probe: banned word "basically"',
      "probe: exclamation mark",
      "probe: emoji",
      'probe: British "colour"',
      'probe: British "behaviour"',
      'probe: British "cancelled"',
      'probe: British "grey"',
      'probe: British "centre"',
    ]);
    const probe = path.join(ROOT, "src/features/gallery/ProbeCard.tsx");
    const source = 'export const P = () => <p aria-label="Open it">Copied!</p>;';
    expect(
      m6CopyFindings(sourceStrings(probe, source).map((text) => ["ProbeCard.tsx", text] as const)),
    ).toEqual(['ProbeCard.tsx: exclamation mark in "Copied!"']);
  });
});

// C-GUARD6-10 (Task 6.11a, R6-03): C-REPO-01's and C-GUARD3-02's scanners find nothing in
// src/export/guards.ts, which C-GUARD3-02's list holds, nor any DOM, storage, network, clock,
// randomness, environment or locale API in M6's pure files. The scan reads each file as the ruling of
// Task 6.11a in section 14.12 says: its type-only imports blanked, and in scripts/audit-core.mjs the
// name of Lighthouse's `performance` category.

const GUARDS_FILE = path.join(ROOT, "src/export/guards.ts");
const AUDIT_CORE = path.join(ROOT, "scripts/audit-core.mjs");
/** M6's pure files outside src/export (R6-03), from the root. */
const M6_PURE_FILES = [
  ...["tags", "defs", "data", "cards", "links", "build"].map(
    (name) => `src/features/gallery/${name}.ts`,
  ),
  ...["start", "receipt"].map((name) => `src/features/landing/${name}.ts`),
  "src/features/about/copy.ts",
  "scripts/audit-core.mjs",
];

/** What the two scanners find in `source`, the text of `file`, read as the ruling says. */
function m6PurityFindings(file: string, source: string): string[] {
  const kind = file.endsWith(".mjs") ? ts.ScriptKind.JS : ts.ScriptKind.TSX;
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.ESNext, true, kind);
  const ranges: [start: number, end: number][] = [];
  const blank = (node: ts.Node) => ranges.push([node.getStart(tree), node.getEnd()]);
  const visit = (node: ts.Node): void => {
    // A whole type-only import or export loads nothing: TypeScript erases it.
    if (
      (ts.isImportDeclaration(node) && node.importClause?.isTypeOnly === true) ||
      (ts.isExportDeclaration(node) && node.isTypeOnly)
    ) {
      blank(node);
      return;
    }
    // Lighthouse's category, a name in audit-core.mjs alone: its string and its object key.
    if (file === AUDIT_CORE) {
      if (ts.isStringLiteral(node) && node.text === "performance") blank(node);
      if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name)) {
        if (node.name.text === "performance") blank(node.name);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  let code = source;
  for (const [start, end] of ranges) {
    code = code.slice(0, start) + code.slice(start, end).replace(/[^\n]/g, " ") + code.slice(end);
  }
  return [...new Set([...purityViolations(code), ...coreViolations(code)])];
}

describe("C-GUARD6-10 the purity scanners find nothing in the M6 pure files", () => {
  it("C-GUARD6-10 finds src/export/guards.ts in C-GUARD3-02's list, and neither scanner finds anything in it", () => {
    expect(exportAndImportFiles()).toContain(GUARDS_FILE);
    const source = readFileSync(GUARDS_FILE, "utf8");
    expect(purityViolations(source)).toEqual([]);
    expect(coreViolations(source)).toEqual([]);
  });

  it.each(M6_PURE_FILES)(
    "C-GUARD6-10 finds no DOM, storage, network, clock, randomness, environment or locale API in %s",
    (name) => {
      const file = path.join(ROOT, name);
      expect(existsSync(file), name).toBe(true);
      expect(m6PurityFindings(file, readFileSync(file, "utf8"))).toEqual([]);
    },
  );

  it("C-GUARD6-10 reports a probe of each kind of API, and an import a type does not hide", () => {
    const data = path.join(ROOT, "src/features/gallery/data.ts");
    for (const [line, finding] of [
      ["const nodes = document.querySelectorAll('a');", "document."],
      ["const kept = localStorage.getItem('x');", "web storage"],
      ["const answer = await fetch('/api');", "fetch"],
      ["const now = Date.now();", "Date.now, Date.parse or Date.UTC"],
      ["const pick = Math.random();", "Math.random"],
      ["const site = process.env.SITE;", "process"],
      ["const label = new Intl.NumberFormat('en').format(1);", "Intl"],
      ['import { headers } from "next/headers";', 'import "next/headers"'],
    ] as const) {
      expect(m6PurityFindings(data, line), line).toContain(finding);
    }
    expect(m6PurityFindings(data, 'import type { Metadata } from "next";')).toEqual([]);
    expect(
      m6PurityFindings(data, 'export type { Metadata } from "next";\nexport const a = 1;'),
    ).toEqual([]);
    expect(coreViolations("export const s = await fetch(origin);")).toEqual(["fetch"]);
  });

  it("C-GUARD6-10 reads Lighthouse's performance category as a name, and still finds the clock", () => {
    const category =
      'const NAMES = ["performance"];\nconst scores = { performance: score("performance") };';
    expect(coreViolations(category)).toEqual(["performance"]);
    expect(m6PurityFindings(AUDIT_CORE, category)).toEqual([]);
    expect(m6PurityFindings(AUDIT_CORE, `${category}\nconst t = performance.now();`)).toEqual([
      "performance",
    ]);
    expect(m6PurityFindings(AUDIT_CORE, "const { performance } = globalThis;")).toEqual([
      "performance",
    ]);
    // The allowance is audit-core.mjs's alone.
    expect(m6PurityFindings(path.join(ROOT, "src/features/about/copy.ts"), category)).toEqual([
      "performance",
    ]);
  });
});

// C-GUARD6-11 (Task 6.11a, R6-39, R6-60): this file walks folders only through `codeFiles` and
// `filesUnder`, whose walks are never vacuous; it names no folder reader of node:fs of its own.

const THIS_FILE = path.join(ROOT, "tests/unit/engine/repo-guards-m6.test.ts");
/** The folder readers of node:fs, which a walk of its own would call. */
const FOLDER_READERS: ReadonlySet<string> = new Set([
  "readdirSync",
  "readdir",
  "opendirSync",
  "opendir",
]);

/** Each place `source` names a folder reader, read from its syntax tree, as "line <n>: <name>". */
function ownWalks(file: string, source: string): string[] {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && FOLDER_READERS.has(node.text)) {
      const { line } = tree.getLineAndCharacterOfPosition(node.getStart(tree));
      found.push(`line ${line + 1}: ${node.text}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return found;
}

describe("C-GUARD6-11 the M6 guards walk folders only through codeFiles or filesUnder", () => {
  it("C-GUARD6-11 finds no folder reader in this file, which walks src with codeFiles", () => {
    const source = readFileSync(THIS_FILE, "utf8");
    expect(importsOf(THIS_FILE, source).map((record) => record.specifier)).toContain(
      "./guard-support",
    );
    expect(source).toContain("codeFiles(SRC_DIR)");
    expect(ownWalks(THIS_FILE, source)).toEqual([]);
  });

  it("C-GUARD6-11 reports a probe file that calls readdirSync", () => {
    const probe = path.join(ROOT, "tests/unit/engine/probe-guards.test.ts");
    const source = [
      'import { readdirSync } from "node:fs";',
      'const all = readdirSync("src", { recursive: true });',
      "const more = fs.readdirSync(folder);",
      'const named = "readdirSync"; // readdirSync in a comment',
      "const files = codeFiles(SRC_DIR);",
      'const later = await fs.promises.readdir("src");',
    ].join("\n");
    expect(ownWalks(probe, source)).toEqual([
      "line 1: readdirSync",
      "line 2: readdirSync",
      "line 3: readdirSync",
      "line 6: readdir",
    ]);
  });
});

// C-GUARD6-12 (Task 6.11a, R6-12, R6-21, R6-59): no entry's words, no About paragraph and no string of
// 9.1 or 9.2 names the perceptual formula by its trade name or a host of `NEVER_USE_HOSTS`.

/** C-GUARD6-12's two rules of M6's copy check: the trade name and the never-use hosts. */
const nameProblems = (text: string): string[] =>
  m6CopyProblems(text).filter(
    (problem) =>
      problem === "the perceptual score's trade name" || problem.startsWith("never-use host"),
  );

/** Every text C-GUARD6-12 names, as [where, text] pairs. */
function guard12Texts(): [where: string, text: string][] {
  return [
    ...ENTRIES.flatMap((entry) => [
      [`${entry.slug} name`, entry.name],
      [`${entry.slug} slug`, entry.slug],
      ...(entry.brief === null ? [] : [[`${entry.slug} brief`, entry.brief]]),
      ...entry.tags.map((tag) => [`${entry.slug} tag`, tag]),
    ]),
    ["ABOUT_INTRO", ABOUT_INTRO.text],
    ...ABOUT_SECTIONS.flatMap((section) =>
      section.paragraphs.map((paragraph, i) => [
        `ABOUT_SECTIONS.${section.id} paragraph ${i + 1}`,
        paragraph.text,
      ]),
    ),
    ...Object.entries(START_LINES).map(([key, text]) => [`START_LINES.${key}`, text]),
    ...Object.entries(RECEIPT_LINES).map(([key, text]) => [`RECEIPT_LINES.${key}`, text]),
    ...receiptLines(RECEIPT_EXCERPT).map((text, i) => [`receiptLines line ${i + 1}`, text]),
  ] as [string, string][];
}

describe("C-GUARD6-12 no M6 words name the perceptual formula or a never-use host", () => {
  it("C-GUARD6-12 finds neither in the entries, the About paragraphs or the strings of 9.1 and 9.2", () => {
    const texts = guard12Texts();
    expect(texts.length).toBeGreaterThan(24 * 3);
    const found = texts.flatMap(([where, text]) =>
      nameProblems(text).map((problem) => `${where}: ${problem}`),
    );
    expect(found).toEqual([]);
  });

  it("C-GUARD6-12 reports a probe of the trade name in any case and of each never-use host", () => {
    for (const text of ["An APCA score", "the apca check", "Apca-W3"]) {
      expect(nameProblems(text), text).toEqual(["the perceptual score's trade name"]);
    }
    for (const host of ["bastion.vercel.app", "abdulmuizz.dev"]) {
      expect(nameProblems(`See ${host.toUpperCase()} for more.`), host).toEqual([
        `never-use host "${host}"`,
      ]);
    }
    expect(nameProblems("Simply a grey card!")).toEqual([]);
  });
});
