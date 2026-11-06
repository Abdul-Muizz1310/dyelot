import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { MOTION_PRESET_IDS, MOTION_PRESETS, withMotion } from "@/engine";
import { scanLine } from "@/export/checker/dyelot-check.mjs";
import { EXPLORE_LINES } from "@/features/explore/scene";
import { FLAVOR_LINES, VIDEO_LINES } from "@/features/flavor/video";
import { presetLine, readField, type TokenPath } from "@/features/motion/lab";
import { motionLine } from "@/features/studio/pages";
import vitestConfig from "../../../vitest.config";
import { copyProblems } from "../ai/copy-rules";
import { SPEC } from "../export/golden-support";
import { CUSTOM_TOKENS } from "../support/motion";
import {
  codeFiles,
  coreViolations,
  engineAndSpecFiles,
  exportAndImportFiles,
  type ImportRecord,
  importsOf,
  purityViolations,
  ROOT,
  stripComments,
} from "./guard-support";

// The M5 repository guards (docs/specs/05-motion-3d.md, section 14, C-GUARD5-nn).

/** C-GUARD5-07: the tokens the web renderer's CSS subset leaves out (ruling R5-22). */
const SUBSET_TOKENS = [
  "zIndex",
  "z-index",
  "radial-gradient",
  "conic-gradient",
  "backdropFilter",
  "perspective",
  "transformStyle",
  "mixBlendMode",
  "objectPosition",
  "filter:",
  "inset",
  "clipPath",
  "oklch(",
  "rgb(",
  "rgba(",
  "hsl(",
  "url(",
] as const;

/** The forbidden tokens in `source`, comments removed. */
function subsetViolations(source: string): string[] {
  const code = stripComments(source);
  return SUBSET_TOKENS.filter((token) => code.includes(token));
}

describe("C-GUARD5-07 the composition keeps to the web renderer's CSS subset", () => {
  it("C-GUARD5-07 reports a probe of each forbidden token", () => {
    for (const token of SUBSET_TOKENS) {
      expect(subsetViolations(`const style = { x: "${token}" };`)).toEqual([token]);
    }
  });

  it("C-GUARD5-07 does not count a token inside a comment", () => {
    expect(subsetViolations(`// z-index, oklch(\n/* url( */ const a = 1;`)).toEqual([]);
  });

  it("C-GUARD5-07 finds none in brand-intro.tsx", () => {
    const file = path.join(ROOT, "src/flavor/remotion/brand-intro.tsx");
    expect(subsetViolations(readFileSync(file, "utf8"))).toEqual([]);
  });
});

/** C-GUARD5-08: what no file under src may hold (R5-02, R5-48, R5-58). */
const VIDEO_ELEMENT = /<video\b|createElement\(\s*["'`]video["'`]/;
const FLUSH_SYNC = /\bflushSync\b/;

/** The reasons `source`, comments removed, breaks the guard. */
function mediaViolations(source: string): string[] {
  const code = stripComments(source);
  const found: string[] = [];
  if (VIDEO_ELEMENT.test(code)) found.push("video element");
  if (FLUSH_SYNC.test(code)) found.push("flushSync");
  return found;
}

describe("C-GUARD5-08 no video element, no flushSync, no media-src or wasm in the CSP", () => {
  it("C-GUARD5-08 reports a probe of each", () => {
    expect(mediaViolations("const a = <video src={x} />;")).toEqual(["video element"]);
    expect(mediaViolations('document.createElement("video");')).toEqual(["video element"]);
    expect(mediaViolations("import { flushSync } from 'react-dom'; flushSync(f);")).toEqual([
      "flushSync",
    ]);
    expect(
      mediaViolations("// <video flushSync\n/* createElement('video') */ const a = 1;"),
    ).toEqual([]);
    const csp = "media-src 'self' 'wasm-unsafe-eval'";
    expect(csp.includes("media-src")).toBe(true);
    expect(csp.includes("'wasm-unsafe-eval'")).toBe(true);
  });

  it("C-GUARD5-08 finds none under src", () => {
    const problems = codeFiles(path.join(ROOT, "src")).flatMap((file) =>
      mediaViolations(readFileSync(file, "utf8")).map((reason) => `${file}: ${reason}`),
    );
    expect(problems).toEqual([]);
  });

  it("C-GUARD5-08 keeps media-src and 'wasm-unsafe-eval' out of csp.ts", () => {
    const code = stripComments(readFileSync(path.join(ROOT, "src/lib/site/csp.ts"), "utf8"));
    expect(code).not.toContain("media-src");
    expect(code).not.toContain("'wasm-unsafe-eval'");
  });
});

// C-GUARD5-06: the shipped sources are self-contained, and the Remotion root is only read as text.

const FLAVOR_DIR = path.join(ROOT, "src/flavor");
const SRC_DIR = path.join(ROOT, "src");
const ROOT_TSX = path.join(FLAVOR_DIR, "remotion/root.tsx");
const SOURCES_FILE = path.join(ROOT, "src/export/flavor-sources.ts");

/** The file an import of `specifier` from `file` names, when it is relative or `@/`. */
function resolved(file: string, specifier: string): string | null {
  const bare = specifier.split("?")[0] as string;
  if (bare.startsWith("@/")) return path.join(SRC_DIR, bare.slice(2));
  if (bare.startsWith(".")) return path.resolve(path.dirname(file), bare);
  return null;
}

/** Imports under `src/flavor/` other than `react`, `remotion` and a path inside the folder. */
function flavorImportViolations(file: string, source: string): string[] {
  return importsOf(file, source)
    .filter(({ specifier }) => {
      if (specifier === "react" || specifier === "remotion") return false;
      const target = specifier.startsWith(".") ? resolved(file, specifier) : null;
      return target === null || !(target + path.sep).startsWith(FLAVOR_DIR + path.sep);
    })
    .map(({ specifier }) => specifier);
}

/** Imports of `root.tsx` in `source` that are not the `?raw` import of the sources file. */
function rootImportViolations(file: string, source: string): string[] {
  const without = (target: string) => target.replace(/\.tsx$/, "");
  return importsOf(file, source)
    .filter(({ specifier }) => {
      const target = resolved(file, specifier);
      if (target === null || without(target) !== without(ROOT_TSX)) return false;
      return !(file === SOURCES_FILE && specifier.endsWith("?raw"));
    })
    .map(({ specifier }) => specifier);
}

/** The extensions the checker scans, read from its source. */
const SCAN_LIST = /const SCAN_EXTENSIONS = new Set\(\s*"([^"]+)"/.exec(
  readFileSync(path.join(ROOT, "src/export/checker/dyelot-check.mjs"), "utf8"),
)?.[1];
const SCAN_EXTENSIONS: ReadonlySet<string> = new Set((SCAN_LIST ?? "").split(" "));

/** The lines of `source` on which the checker's scan finds something. */
function scanFindings(source: string): number[] {
  return source
    .split("\n")
    .flatMap((line, index) => (scanLine(line).findings.length > 0 ? [index + 1] : []));
}

describe("C-GUARD5-06 src/flavor is self-contained", () => {
  const files = codeFiles(FLAVOR_DIR);
  const everyFile = readdirSync(FLAVOR_DIR, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name));

  it("C-GUARD5-06 reads the checker's extensions", () => {
    expect(SCAN_EXTENSIONS.has(".tsx") && SCAN_EXTENSIONS.has(".mjs")).toBe(true);
    expect(SCAN_EXTENSIONS.has(".json")).toBe(false);
  });

  it("C-GUARD5-06 scans the four sources", () => {
    expect(files.map((file) => path.relative(FLAVOR_DIR, file)).sort()).toEqual([
      "flavor-react.tsx",
      "flavor.mjs",
      "remotion/brand-intro.tsx",
      "remotion/root.tsx",
    ]);
  });

  it("C-GUARD5-06 imports only react, remotion and files of src/flavor", () => {
    const bad = files.flatMap((file) =>
      flavorImportViolations(file, readFileSync(file, "utf8")).map(
        (specifier) => `${path.relative(ROOT, file)}: ${specifier}`,
      ),
    );
    expect(bad).toEqual([]);
  });

  it("C-GUARD5-06 reports a probe of a foreign import", () => {
    const file = path.join(FLAVOR_DIR, "probe.ts");
    expect(flavorImportViolations(file, 'import { a } from "@/engine";')).toEqual(["@/engine"]);
    expect(flavorImportViolations(file, 'import b from "../export/text";')).toEqual([
      "../export/text",
    ]);
    expect(flavorImportViolations(file, 'const c = await import("zod");')).toEqual(["zod"]);
    expect(
      flavorImportViolations(
        file,
        'import { d } from "react"; import e from "remotion"; export * from "./flavor.mjs";',
      ),
    ).toEqual([]);
  });

  it("C-GUARD5-06 lets only flavor-sources.ts import root.tsx, and with ?raw", () => {
    const bad = codeFiles(SRC_DIR).flatMap((file) =>
      rootImportViolations(file, readFileSync(file, "utf8")).map(
        (specifier) => `${path.relative(ROOT, file)}: ${specifier}`,
      ),
    );
    expect(bad).toEqual([]);
    const raw = importsOf(SOURCES_FILE, readFileSync(SOURCES_FILE, "utf8")).filter(
      ({ specifier }) => resolved(SOURCES_FILE, specifier)?.startsWith(ROOT_TSX.slice(0, -4)),
    );
    expect(raw.map(({ specifier }) => specifier.endsWith("?raw"))).toEqual([true]);
  });

  it("C-GUARD5-06 reports a probe that imports root.tsx as code", () => {
    const other = path.join(SRC_DIR, "features/probe.ts");
    expect(
      rootImportViolations(other, 'import { RemotionRoot } from "@/flavor/remotion/root";'),
    ).toEqual(["@/flavor/remotion/root"]);
    expect(
      rootImportViolations(other, 'import text from "@/flavor/remotion/root.tsx?raw";'),
    ).toEqual(["@/flavor/remotion/root.tsx?raw"]);
    expect(
      rootImportViolations(SOURCES_FILE, 'import text from "../flavor/remotion/root";'),
    ).toEqual(["../flavor/remotion/root"]);
    expect(
      rootImportViolations(SOURCES_FILE, 'import text from "../flavor/remotion/root.tsx?raw";'),
    ).toEqual([]);
  });

  it("C-GUARD5-06 finds nothing for the checker's scan in any scanned file of src/flavor", () => {
    const scanned = everyFile.filter((file) => SCAN_EXTENSIONS.has(path.extname(file)));
    expect(scanned.length).toBe(4);
    const bad = scanned.flatMap((file) =>
      scanFindings(readFileSync(file, "utf8")).map(
        (line) => `${path.relative(ROOT, file)}:${line}`,
      ),
    );
    expect(bad).toEqual([]);
    expect(scanFindings('const a = "#ff0000";\nconst b = 1;')).toEqual([1]);
    expect(everyFile.some((file) => file.endsWith("brand.json"))).toBe(true);
  });
});

// C-GUARD5-05: the landing's client code reaches no core (R5-31, R5-61). Only the three pages import
// heroes.ts as a value, the hero's static value imports reach no file of the engine, the spec or the
// export, and cards.ts holds the committed JSON alone.

const HEROES_FILE = path.join(SRC_DIR, "features/landing/heroes.ts");
const HERO_FILE = path.join(SRC_DIR, "features/landing/Hero.tsx");
const CARDS_FILE = path.join(SRC_DIR, "features/landing/cards.ts");
const HERO_PAGES = ["app/page.tsx", "app/explore/page.tsx", "app/motion/page.tsx"].map((file) =>
  path.join(SRC_DIR, file),
);
const CORE_DIRS = ["engine", "spec", "export"].map((folder) => path.join(SRC_DIR, folder));
/** The endings a bundler tries for a specifier written without one, in order. */
const ENDINGS = [".ts", ".tsx", ".mjs", ".js", ".json", "/index.ts", "/index.tsx"];
const CODE = /\.[cm]?[jt]sx?$/;

/** A file's text, or null when no such file exists. */
type Reader = (file: string) => string | null;

const readDisk: Reader = (file) =>
  existsSync(file) && statSync(file).isFile() ? readFileSync(file, "utf8") : null;

/** The file `specifier`, written in `file`, loads, or null for a package or a file that is missing. */
function moduleFile(file: string, specifier: string, read: Reader): string | null {
  const base = resolved(file, specifier);
  if (base === null) return null;
  for (const candidate of [base, ...ENDINGS.map((ending) => base + ending)]) {
    if (read(candidate) !== null) return candidate;
  }
  return null;
}

/** Whether `record` loads its module as a value: anything but a whole `import type`. */
const isValue = (record: ImportRecord): boolean => !record.typeOnly;

/**
 * Every file the static value imports of `entry` reach, `entry` included; `import()` and `import
 * type` are not followed, nor are packages. A missing entry is an error.
 */
function valueGraph(entry: string, read: Reader): string[] {
  if (read(entry) === null) throw new Error(`valueGraph: ${entry} does not exist`);
  const seen = new Set<string>([entry]);
  const queue = [entry];
  for (let file = queue.shift(); file !== undefined; file = queue.shift()) {
    if (!CODE.test(file)) continue;
    for (const record of importsOf(file, read(file) ?? "")) {
      if (record.dynamic || !isValue(record)) continue;
      const target = moduleFile(file, record.specifier, read);
      if (target === null || seen.has(target)) continue;
      seen.add(target);
      queue.push(target);
    }
  }
  return [...seen];
}

/** The files of `files` under `src/engine`, `src/spec` or `src/export`. */
const coreFiles = (files: readonly string[]): string[] =>
  files.filter((file) => CORE_DIRS.some((dir) => file.startsWith(dir + path.sep)));

/** The value imports of heroes.ts in `source`, written in `file`, unless `file` is one of the pages. */
function heroesImportViolations(file: string, source: string, read: Reader): string[] {
  if (HERO_PAGES.includes(file)) return [];
  return importsOf(file, source)
    .filter((record) => isValue(record) && moduleFile(file, record.specifier, read) === HEROES_FILE)
    .map(({ specifier }) => specifier);
}

/** A reader of `files` alone, for the probes. */
const readOnly =
  (files: Readonly<Record<string, string>>): Reader =>
  (file) =>
    files[file] ?? null;

describe("C-GUARD5-05 the landing's client code reaches no core", () => {
  it("C-GUARD5-05 lets only the three pages import heroes.ts as a value", () => {
    const bad = codeFiles(SRC_DIR).flatMap((file) =>
      heroesImportViolations(file, readFileSync(file, "utf8"), readDisk).map(
        (specifier) => `${path.relative(ROOT, file)}: ${specifier}`,
      ),
    );
    expect(bad).toEqual([]);
  });

  it("C-GUARD5-05 reports a probe that value-imports heroes.ts from src/features", () => {
    const probe = path.join(SRC_DIR, "features/explore/probe.ts");
    expect(
      heroesImportViolations(
        probe,
        'import { heroSpec } from "@/features/landing/heroes";',
        readDisk,
      ),
    ).toEqual(["@/features/landing/heroes"]);
    expect(
      heroesImportViolations(
        probe,
        'export { HERO_PARAMS } from "../landing/heroes.ts";',
        readDisk,
      ),
    ).toEqual(["../landing/heroes.ts"]);
    expect(
      heroesImportViolations(
        probe,
        'const m = await import("@/features/landing/heroes");',
        readDisk,
      ),
    ).toEqual(["@/features/landing/heroes"]);
    expect(
      heroesImportViolations(
        probe,
        'import type { HeroParams } from "@/features/landing/heroes";',
        readDisk,
      ),
    ).toEqual([]);
    expect(
      heroesImportViolations(
        path.join(SRC_DIR, "app/explore/page.tsx"),
        'import { defaultDesign } from "@/features/landing/heroes";',
        readDisk,
      ),
    ).toEqual([]);
  });

  it("C-GUARD5-05 finds no engine, spec or export file in Hero.tsx's static value imports", () => {
    const graph = valueGraph(HERO_FILE, readDisk);
    expect(graph).toContain(path.join(SRC_DIR, "flavor/flavor.mjs"));
    expect(coreFiles(graph)).toEqual([]);
  });

  it("C-GUARD5-05 reports a probe hero that reaches a core through another file", () => {
    const hero = path.join(SRC_DIR, "features/landing/ProbeHero.tsx");
    const middle = path.join(SRC_DIR, "features/landing/probe-middle.ts");
    const core = path.join(SRC_DIR, "engine/probe-core.ts");
    const spec = path.join(SRC_DIR, "spec/index.ts");
    const exported = path.join(SRC_DIR, "export/index.ts");
    const read = readOnly({
      [hero]: 'import { a } from "./probe-middle";\nimport type { DesignSpec } from "@/spec";',
      [middle]: 'import { b } from "@/engine/probe-core";\nconst load = () => import("@/export");',
      [core]: "export const b = 1;",
      [spec]: "export type DesignSpec = {};",
      [exported]: "export const c = 1;",
    });
    expect(valueGraph(hero, read)).toEqual([hero, middle, core]);
    expect(coreFiles(valueGraph(hero, read))).toEqual([core]);
    expect(() => valueGraph(path.join(SRC_DIR, "features/landing/Missing.tsx"), read)).toThrow(
      "valueGraph: ",
    );
  });

  it("C-GUARD5-05 holds cards.ts to the one import of the committed JSON", () => {
    const only = (source: string) =>
      importsOf(CARDS_FILE, source).map(({ specifier }) => specifier);
    expect(only(readFileSync(CARDS_FILE, "utf8"))).toEqual(["./hero-cards.json"]);
    expect(
      only('import cards from "./hero-cards.json";\nimport { x } from "./heroes";'),
    ).not.toEqual(["./hero-cards.json"]);
  });
});

// C-GUARD5-02 and C-GUARD5-03 (Task 5.6b): R5-60's pins and exclusions, and R5-35's import
// boundary for three and R3F. Probe 1 kept drei (R5-64), so drei is pinned and on the allow-list.

/** R5-60's exact versions, each in the dependency field that must hold it. */
const M5_PINS = {
  dependencies: {
    three: "0.186.1",
    "@react-three/fiber": "9.8.2",
    "@react-three/drei": "10.7.9",
    remotion: "4.0.539",
    "@remotion/player": "4.0.539",
    "@remotion/web-renderer": "4.0.539",
    mediabunny: "1.62.0",
    motion: "14.3.0",
  },
  devDependencies: { "@types/three": "0.186.0" },
} as const;

/**
 * Pins another lane adds that this lane's base does not hold yet. A pending pin must be absent, so the
 * rebase that brings one in fails here until it leaves the list; none is pending now.
 */
const PENDING_PINS: readonly string[] = [];

/** The packages R5-60 keeps out of the repository. */
const M5_EXCLUDED = [
  "postprocessing",
  "@react-three/postprocessing",
  "gsap",
  "@remotion/cli",
  "@remotion/three",
  "lenis",
  "@paper-design/shaders",
  "detect-gpu",
] as const;

const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
] as const;

/** What breaks R5-60 in `manifest`, a parsed package.json: each problem as one line. */
function pinProblems(manifest: Record<string, unknown>, pending: readonly string[]): string[] {
  const fields = Object.fromEntries(
    DEPENDENCY_FIELDS.map((field) => [field, (manifest[field] ?? {}) as Record<string, string>]),
  ) as Record<(typeof DEPENDENCY_FIELDS)[number], Record<string, string>>;
  const declared = (name: string) =>
    DEPENDENCY_FIELDS.filter((field) => fields[field][name] !== undefined);
  const problems: string[] = [];
  for (const [field, pins] of Object.entries(M5_PINS) as [
    keyof typeof M5_PINS,
    Record<string, string>,
  ][]) {
    for (const [name, version] of Object.entries(pins)) {
      const where = declared(name);
      if (pending.includes(name)) {
        if (where.length > 0) problems.push(`${name}: pending, yet declared`);
        continue;
      }
      if (where.length !== 1 || where[0] !== field) {
        problems.push(`${name}: in ${where.join(", ") || "no field"}, not ${field} alone`);
      } else if (fields[field][name] !== version) {
        problems.push(`${name}: ${fields[field][name]}, not ${version}`);
      }
    }
  }
  for (const name of M5_EXCLUDED) {
    if (declared(name).length > 0) problems.push(`${name}: excluded`);
  }
  return problems;
}

describe("C-GUARD5-02 package.json pins R5-60's versions and holds none of its excluded packages", () => {
  const manifest = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));

  it("C-GUARD5-02 pins three, R3F, drei, Remotion, Mediabunny, motion and @types/three exactly", () => {
    expect(pinProblems(manifest, PENDING_PINS)).toEqual([]);
    expect(manifest.dependencies.three).toBe("0.186.1");
    expect(manifest.devDependencies["@types/three"]).toBe("0.186.0");
  });

  it("C-GUARD5-02 reports a range, a wrong field, a missing pin and each excluded package (a probe)", () => {
    const exact = {
      dependencies: { ...M5_PINS.dependencies },
      devDependencies: { ...M5_PINS.devDependencies },
    };
    expect(pinProblems(exact, [])).toEqual([]);
    expect(
      pinProblems(
        { ...exact, dependencies: { ...exact.dependencies, three: "^0.186.1", motion: "14.3.1" } },
        [],
      ),
    ).toEqual(["three: ^0.186.1, not 0.186.1", "motion: 14.3.1, not 14.3.0"]);
    const { "@react-three/drei": _drei, ...withoutDrei } = exact.dependencies;
    expect(pinProblems({ ...exact, dependencies: withoutDrei }, [])).toEqual([
      "@react-three/drei: in no field, not dependencies alone",
    ]);
    expect(
      pinProblems(
        {
          dependencies: { ...exact.dependencies, "@types/three": "0.186.0" },
          devDependencies: {},
        },
        [],
      ),
    ).toEqual(["@types/three: in dependencies, not devDependencies alone"]);
    for (const name of M5_EXCLUDED) {
      expect(
        pinProblems({ ...exact, optionalDependencies: { [name]: "1.0.0" } }, []),
        name,
      ).toEqual([`${name}: excluded`]);
    }
    const { "@remotion/player": _player, ...withoutPlayer } = exact.dependencies;
    expect(pinProblems({ ...exact, dependencies: withoutPlayer }, ["@remotion/player"])).toEqual(
      [],
    );
    expect(pinProblems(exact, ["@remotion/player"])).toEqual([
      "@remotion/player: pending, yet declared",
    ]);
  });
});

/** R5-35's names, by the specifier that may give them; any other three or R3F specifier gives none. */
const THREE_NAMES: Readonly<Record<string, readonly string[]>> = {
  three: [
    "BufferAttribute",
    "BufferGeometry",
    "CatmullRomCurve3",
    "Color",
    "DoubleSide",
    "InstancedMesh",
    "Matrix4",
    "MeshBasicMaterial",
    "Plane",
    "SphereGeometry",
    "TubeGeometry",
    "Vector3",
  ],
  "@react-three/fiber": ["Canvas", "useThree"],
  "@react-three/drei": ["OrbitControls"],
};
const EXPLORE_DIR = path.join(ROOT, "src/features/explore");

const isThreeSpecifier = (specifier: string): boolean =>
  specifier === "three" || specifier.startsWith("three/") || specifier.startsWith("@react-three/");

/** The imports of three, `three/*` and `@react-three/*` in `file` that R5-35 does not allow. */
function threeImportViolations(file: string, source: string): string[] {
  const inside = file.startsWith(EXPLORE_DIR + path.sep);
  return importsOf(file, source).flatMap(({ specifier, names, dynamic }) => {
    if (!isThreeSpecifier(specifier)) return [];
    if (!inside) return [`${specifier} outside src/features/explore`];
    if (dynamic) return [`import("${specifier}")`];
    const allowed = THREE_NAMES[specifier] ?? [];
    return names
      .filter((name) => !allowed.includes(name))
      .map((name) => `${name} from ${specifier}`);
  });
}

describe("C-GUARD5-03 three and R3F are imported only under src/features/explore, and only R5-35's names", () => {
  it("C-GUARD5-03 finds no other import under src, and the explorer imports the 3D stack", () => {
    const files = codeFiles(path.join(ROOT, "src"));
    const bad = files.flatMap((file) =>
      threeImportViolations(file, readFileSync(file, "utf8")).map(
        (problem) => `${path.relative(ROOT, file)}: ${problem}`,
      ),
    );
    expect(bad).toEqual([]);
    const used = files
      .filter((file) => file.startsWith(EXPLORE_DIR + path.sep))
      .flatMap((file) => importsOf(file, readFileSync(file, "utf8")))
      .filter(({ specifier }) => isThreeSpecifier(specifier))
      .flatMap(({ names }) => names);
    expect(used).toEqual(expect.arrayContaining(["Canvas", "OrbitControls", "InstancedMesh"]));
  });

  it("C-GUARD5-03 reports a probe of drei's Text, EffectComposer, a namespace and an import elsewhere", () => {
    const explore = path.join(EXPLORE_DIR, "Probe.tsx");
    expect(threeImportViolations(explore, 'import { Text } from "@react-three/drei";')).toEqual([
      "Text from @react-three/drei",
    ]);
    expect(
      threeImportViolations(
        explore,
        'import { EffectComposer } from "@react-three/postprocessing";',
      ),
    ).toEqual(["EffectComposer from @react-three/postprocessing"]);
    expect(
      threeImportViolations(
        explore,
        'import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";',
      ),
    ).toEqual(["EffectComposer from three/examples/jsm/postprocessing/EffectComposer.js"]);
    expect(threeImportViolations(explore, 'import * as THREE from "three";')).toEqual([
      "* from three",
    ]);
    expect(threeImportViolations(explore, 'const three = await import("three");')).toEqual([
      'import("three")',
    ]);
    expect(
      threeImportViolations(
        path.join(ROOT, "src/features/studio/Probe.tsx"),
        'import { Canvas } from "@react-three/fiber";',
      ),
    ).toEqual(["@react-three/fiber outside src/features/explore"]);
    expect(
      threeImportViolations(
        explore,
        'import { Canvas, useThree } from "@react-three/fiber";\nimport { OrbitControls } from "@react-three/drei";\nimport { Color, Plane } from "three";',
      ),
    ).toEqual([]);
  });
});

// C-GUARD5-04 and C-GUARD5-12 (Task 5.9c): R5-60's import boundary for Remotion and Mediabunny, and
// R5-59's rule that every flow that can reach the render answers its usage event.

const REMOTION_DIR = path.join(ROOT, "src/flavor/remotion");
const FLAVOR_FEATURE_DIR = path.join(ROOT, "src/features/flavor");

/** Whether `specifier` names `name` or a path inside it. */
const names = (specifier: string, name: string): boolean =>
  specifier === name || specifier.startsWith(`${name}/`);

/** The packages R5-60 lets only the flavor folders import, and the lazy pair only by `import()`. */
const EAGER_REMOTION = ["remotion", "@remotion/player"] as const;
const LAZY_VIDEO = ["@remotion/web-renderer", "mediabunny"] as const;

/**
 * The imports of Remotion and Mediabunny in `file` that R5-60 does not allow: `remotion` and
 * `@remotion/player` outside `src/flavor/remotion/` and `src/features/flavor/`; `@remotion/web-renderer`
 * and `mediabunny` outside `src/features/flavor/`, or there in any static form. An `import type`
 * of the lazy pair is allowed anywhere: the compiler erases it.
 */
function remotionImportViolations(file: string, source: string): string[] {
  const inside = (directory: string) => file.startsWith(directory + path.sep);
  return importsOf(file, source).flatMap(({ specifier, typeOnly, dynamic }) => {
    if (EAGER_REMOTION.some((name) => names(specifier, name))) {
      return inside(REMOTION_DIR) || inside(FLAVOR_FEATURE_DIR)
        ? []
        : [`${specifier} outside src/flavor/remotion and src/features/flavor`];
    }
    if (!LAZY_VIDEO.some((name) => names(specifier, name)) || typeOnly) return [];
    if (!inside(FLAVOR_FEATURE_DIR)) return [`${specifier} outside src/features/flavor`];
    return dynamic ? [] : [`static import of ${specifier}`];
  });
}

describe("C-GUARD5-04 Remotion stays in the flavor folders, and the renderer and Mediabunny load by import()", () => {
  it("C-GUARD5-04 finds no other import under src, and the dialog loads the renderer and Mediabunny lazily", () => {
    const files = codeFiles(path.join(ROOT, "src"));
    const bad = files.flatMap((file) =>
      remotionImportViolations(file, readFileSync(file, "utf8")).map(
        (problem) => `${path.relative(ROOT, file)}: ${problem}`,
      ),
    );
    expect(bad).toEqual([]);
    const lazy = files
      .filter((file) => file.startsWith(FLAVOR_FEATURE_DIR + path.sep))
      .flatMap((file) => importsOf(file, readFileSync(file, "utf8")))
      .filter(({ dynamic }) => dynamic)
      .map(({ specifier }) => specifier);
    expect(lazy).toEqual(expect.arrayContaining(["@remotion/web-renderer", "mediabunny"]));
  });

  it("C-GUARD5-04 reports a probe of each: Remotion elsewhere, a static renderer or Mediabunny, an import() elsewhere", () => {
    const flavor = path.join(FLAVOR_FEATURE_DIR, "Probe.tsx");
    const studio = path.join(ROOT, "src/features/studio/Probe.tsx");
    const engine = path.join(ROOT, "src/export/Probe.ts");
    expect(remotionImportViolations(studio, 'import { Player } from "@remotion/player";')).toEqual([
      "@remotion/player outside src/flavor/remotion and src/features/flavor",
    ]);
    expect(remotionImportViolations(engine, 'import { AbsoluteFill } from "remotion";')).toEqual([
      "remotion outside src/flavor/remotion and src/features/flavor",
    ]);
    expect(remotionImportViolations(studio, 'export { Player } from "@remotion/player";')).toEqual([
      "@remotion/player outside src/flavor/remotion and src/features/flavor",
    ]);
    expect(
      remotionImportViolations(
        flavor,
        'import { renderMediaOnWeb } from "@remotion/web-renderer";',
      ),
    ).toEqual(["static import of @remotion/web-renderer"]);
    expect(remotionImportViolations(flavor, 'import { Output } from "mediabunny";')).toEqual([
      "static import of mediabunny",
    ]);
    expect(remotionImportViolations(flavor, 'export * from "mediabunny";')).toEqual([
      "static import of mediabunny",
    ]);
    expect(remotionImportViolations(flavor, 'import { type Output } from "mediabunny";')).toEqual([
      "static import of mediabunny",
    ]);
    expect(
      remotionImportViolations(studio, 'const renderer = await import("@remotion/web-renderer");'),
    ).toEqual(["@remotion/web-renderer outside src/features/flavor"]);
    expect(remotionImportViolations(studio, 'const media = await import("mediabunny");')).toEqual([
      "mediabunny outside src/features/flavor",
    ]);
    expect(
      remotionImportViolations(
        flavor,
        [
          'import { Player } from "@remotion/player";',
          'import { AbsoluteFill } from "remotion";',
          'import type { Output } from "mediabunny";',
          'const renderer = await import("@remotion/web-renderer");',
          'const media = await import("mediabunny");',
        ].join("\n"),
      ),
    ).toEqual([]);
    expect(
      remotionImportViolations(
        path.join(REMOTION_DIR, "Probe.tsx"),
        'import { Composition } from "remotion";',
      ),
    ).toEqual([]);
    expect(
      remotionImportViolations(studio, 'import type { CanvasSource } from "mediabunny";'),
    ).toEqual([]);
  });
});

const E2E_DIR = path.join(ROOT, "tests/e2e");
const RENDER_LABEL = "Render the brand video";

/**
 * The flow files that hold "Render the brand video" but never call `TELEMETRY(` (R5-59, I-M5-09):
 * such a flow could click the button with nobody to answer the usage event. A call in a comment
 * does not count.
 */
function telemetryViolations(files: readonly { file: string; source: string }[]): string[] {
  return files
    .filter(({ source }) => source.includes(RENDER_LABEL))
    .filter(({ source }) => !stripComments(source).includes("TELEMETRY("))
    .map(({ file }) => file);
}

describe("C-GUARD5-12 every flow file that names the render button answers the usage event", () => {
  it("C-GUARD5-12 finds every such file under tests/e2e calling TELEMETRY(", () => {
    const files = codeFiles(E2E_DIR).map((file) => ({
      file: path.relative(ROOT, file),
      source: readFileSync(file, "utf8"),
    }));
    expect(telemetryViolations(files)).toEqual([]);
    // The guard is not empty: the render's own flows hold the label.
    expect(
      files.filter(({ source }) => source.includes(RENDER_LABEL)).map(({ file }) => file),
    ).toContain("tests/e2e/flavor.spec.ts");
  });

  it("C-GUARD5-12 reports a probe file that clicks the button without the call", () => {
    const click = `await page.getByRole("button", { name: "${RENDER_LABEL}" }).click();`;
    expect(
      telemetryViolations([
        { file: "probe.spec.ts", source: click },
        { file: "commented.spec.ts", source: `// TELEMETRY(page)\n${click}` },
        { file: "answered.spec.ts", source: `await TELEMETRY(page);\n${click}` },
        { file: "unrelated.spec.ts", source: 'await page.goto("/studio");' },
      ]),
    ).toEqual(["probe.spec.ts", "commented.spec.ts"]);
  });
});

// C-GUARD5-09 (Task 5.11a, R5-62): the new unit folders join a Vitest project, and section 15's
// include and floors hold, each named file existing. The rows are written from section 15, not read
// back from vitest.config.ts, so a list the config drops is still asked for. C-GUARD4-10 keeps
// M4's scope and floors.

type Floors = { lines: number; statements: number; functions: number; branches: number };
const floorsOf = (main: number, branches: number): Floors => ({
  lines: main,
  statements: main,
  functions: main,
  branches,
});

/** Section 15's whole coverage scope. */
const SCOPE_FLOORS: Floors = { lines: 80, statements: 80, functions: 75, branches: 70 };
/** R5-62's test folders, each with the project that runs it. */
const PROJECT_FOLDERS: ReadonlyArray<readonly [folder: string, project: "web" | "core"]> = [
  ["tests/unit/flavor", "web"],
  ["tests/unit/features/landing", "web"],
  ["tests/unit/features/explore", "web"],
  ["tests/unit/features/motion", "web"],
  ["tests/unit/features/flavor", "web"],
  ["tests/unit/engine", "core"],
  ["tests/unit/export", "core"],
];
/** Section 15's two folders that gain files in M5, with their floors and their new files. */
const M5_FOLDERS: ReadonlyArray<readonly [glob: string, floors: Floors, files: readonly string[]]> =
  [
    [
      "src/engine/**",
      floorsOf(95, 90),
      ["color/rec2020", "color/solid", "flavor", "tokens/motion-presets", "tokens/bezier"].map(
        (name) => `src/engine/${name}.ts`,
      ),
    ],
    [
      "src/export/**",
      floorsOf(90, 85),
      ["flavor", "brand", "media", "flavor-sources"].map((name) => `src/export/${name}.ts`),
    ],
  ];
/** Section 15's helpers, each measured by name at 95 and 90. */
const M5_HELPERS: readonly string[] = [
  ...["pages", "token-row"].map((name) => `src/features/studio/${name}.ts`),
  ...["transition", "kit/reduced"].map((name) => `src/features/preview/${name}.ts`),
  ...["heroes", "story", "cycle"].map((name) => `src/features/landing/${name}.ts`),
  ...["scene", "webgl"].map((name) => `src/features/explore/${name}.ts`),
  "src/features/motion/lab.ts",
  ...["video", "render", "record"].map((name) => `src/features/flavor/${name}.ts`),
];

/** The parts of a Vitest config that C-GUARD5-09 reads. */
type ProjectsConfig = {
  test?: {
    projects?: unknown;
    coverage?: { include?: unknown; thresholds?: unknown };
  };
};
type Project = { test?: { name?: string; include?: string[]; exclude?: string[] } };

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((each): each is string => typeof each === "string") : [];

/** Whether `project` runs the test file `file`: an include matches it and no exclude does. */
function runs(project: Project | undefined, file: string): boolean {
  const matches = (globs: unknown) => strings(globs).some((glob) => path.matchesGlob(file, glob));
  return matches(project?.test?.include) && !matches(project?.test?.exclude);
}

/**
 * Every way `candidate` misses R5-62 and section 15, named; an empty list when it holds them all.
 * `exists` says whether a path is in the repository.
 */
function guard5Problems(candidate: ProjectsConfig, exists: (file: string) => boolean): string[] {
  const problems: string[] = [];
  const projects: Project[] = Array.isArray(candidate.test?.projects)
    ? (candidate.test.projects as Project[])
    : [];
  const named = (name: string) => projects.find((project) => project.test?.name === name);
  for (const [folder, project] of PROJECT_FOLDERS) {
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
  const held = (floors: Floors) => `${floors.lines} and ${floors.branches}`;
  for (const [name, floor] of Object.entries(SCOPE_FLOORS)) {
    if (thresholds[name] !== floor) {
      problems.push(`the whole scope's ${name} floor is ${String(thresholds[name])}, not ${floor}`);
    }
  }
  for (const [glob, floors, files] of M5_FOLDERS) {
    if (!include.includes(glob)) problems.push(`coverage does not measure ${glob}`);
    if (!isDeepStrictEqual(thresholds[glob], floors)) {
      problems.push(`${glob} is not held to ${held(floors)}`);
    }
    for (const file of files) if (!exists(file)) problems.push(`${file} does not exist`);
  }
  for (const file of M5_HELPERS) {
    if (!include.includes(file)) problems.push(`coverage does not measure ${file}`);
    if (!isDeepStrictEqual(thresholds[file], floorsOf(95, 90))) {
      problems.push(`${file} is not held to 95 and 90`);
    }
    if (!exists(file)) problems.push(`${file} does not exist`);
  }
  return problems;
}

/** A plain copy of the parts of the real config that C-GUARD5-09 reads, for a probe to change. */
function configCopy(): {
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

describe("C-GUARD5-09 the new unit folders join a project, and section 15's include and floors hold", () => {
  it("C-GUARD5-09 finds no gap in vitest.config.ts, and each named file exists", () => {
    expect(guard5Problems(vitestConfig, inRepository)).toEqual([]);
  });

  it("C-GUARD5-09 names section 15's five engine files, four export files and thirteen helpers", () => {
    expect(M5_FOLDERS.flatMap(([, , files]) => files)).toHaveLength(9);
    expect(M5_HELPERS).toHaveLength(13);
  });

  type Probe = ReturnType<typeof configCopy>;
  const projectOf = (probe: Probe, name: string) =>
    probe.test.projects.find((each) => each.test?.name === name);
  it.each<[string, (probe: Probe) => void, string]>([
    [
      "web excluding tests/unit/flavor",
      (probe) => {
        const web = projectOf(probe, "web");
        if (web?.test) web.test.exclude = [...(web.test.exclude ?? []), "tests/unit/flavor/**"];
      },
      "web does not run tests/unit/flavor/**",
    ],
    [
      "web excluding the explorer's tests",
      (probe) => {
        const web = projectOf(probe, "web");
        if (web?.test) {
          web.test.exclude = [...(web.test.exclude ?? []), "tests/unit/features/explore/**"];
        }
      },
      "web does not run tests/unit/features/explore/**",
    ],
    [
      "the export tests moved out of core",
      (probe) => {
        const core = projectOf(probe, "core");
        if (core?.test?.include) {
          core.test.include = core.test.include.filter(
            (glob) => !glob.startsWith("tests/unit/export/"),
          );
        }
      },
      "core does not run tests/unit/export/**",
    ],
    [
      "no web project",
      (probe) => {
        probe.test.projects = probe.test.projects.filter((each) => each.test?.name !== "web");
      },
      "web does not run tests/unit/features/landing/**",
    ],
    [
      "a whole-scope floor of 70 functions",
      (probe) => {
        probe.test.coverage.thresholds.functions = 70;
      },
      "the whole scope's functions floor is 70, not 75",
    ],
    [
      "src/export/** at 85 and 80",
      (probe) => {
        probe.test.coverage.thresholds["src/export/**"] = floorsOf(85, 80);
      },
      "src/export/** is not held to 90 and 85",
    ],
    [
      "a flavor helper left out of the scope",
      (probe) => {
        probe.test.coverage.include = probe.test.coverage.include.filter(
          (glob) => glob !== "src/features/flavor/record.ts",
        );
      },
      "coverage does not measure src/features/flavor/record.ts",
    ],
    [
      "a landing helper at the export floors",
      (probe) => {
        probe.test.coverage.thresholds["src/features/landing/cycle.ts"] = floorsOf(90, 85);
      },
      "src/features/landing/cycle.ts is not held to 95 and 90",
    ],
  ])("C-GUARD5-09 reports the probe: %s", (_name, change, problem) => {
    const probe = configCopy();
    expect(guard5Problems(probe, inRepository)).toEqual([]);
    change(probe);
    expect(guard5Problems(probe, inRepository)).toContain(problem);
  });

  it("C-GUARD5-09 reports a named file or folder that does not exist (a probe)", () => {
    const gone = new Set(["src/engine/color/solid.ts", "tests/unit/features/motion"]);
    const missing = (file: string) => !gone.has(file) && inRepository(file);
    expect(guard5Problems(configCopy(), missing)).toEqual([
      "tests/unit/features/motion does not exist",
      "src/engine/color/solid.ts does not exist",
    ]);
  });
});

// C-GUARD5-10 (Task 5.11a, R5-66): the copy rules hold in every exported copy table and in the strings
// of the seven files the row names: no banned word, no exclamation mark, no emoji, and none of the
// British spellings (tests/unit/ai/copy-rules.ts holds the rules; the row's five spellings are
// among its list).

const COPY_FILES = [
  "src/features/landing/Story.tsx",
  "src/features/landing/Hero.tsx",
  "src/features/motion/LabClient.tsx",
  "src/features/motion/Previews.tsx",
  "src/features/explore/ExploreClient.tsx",
  "src/features/flavor/FlavorDialog.tsx",
  "src/features/flavor/PrivacyNote.tsx",
] as const;

/** One field of each kind the lab bounds, so `readField` gives each kind's sentence. */
const BOUND_PATHS: readonly TokenPath[] = [
  { kind: "duration", name: "fast" },
  { kind: "easing", name: "standard", index: 0 },
  { kind: "easing", name: "standard", index: 1 },
  { kind: "spring", name: "snappy", field: "visualDuration" },
  { kind: "spring", name: "snappy", field: "bounce" },
];

/** LAB_BOUNDS' sentences, as `readField` gives them for an empty field of each kind. */
function boundSentences(): string[] {
  return BOUND_PATHS.map((each) => {
    const read = readField(each, "");
    if (read.ok) throw new Error(`readField read "" as ${read.value}`);
    return read.message;
  });
}

/** Every copy table the row names, as [where, text] pairs. */
function copyTables(): [where: string, text: string][] {
  const tokenSets = [
    ...MOTION_PRESET_IDS.map((id) => [id, MOTION_PRESETS[id].tokens] as const),
    ["CUSTOM_TOKENS", CUSTOM_TOKENS] as const,
  ];
  return [
    ...Object.entries(FLAVOR_LINES).map(([key, text]) => [`FLAVOR_LINES.${key}`, text]),
    ...Object.entries(VIDEO_LINES).map(([key, text]) => [`VIDEO_LINES.${key}`, text]),
    ...Object.entries(EXPLORE_LINES).map(([key, text]) => [`EXPLORE_LINES.${key}`, text]),
    ...boundSentences().map((text, i) => [`LAB_BOUNDS sentence ${i + 1}`, text]),
    ...MOTION_PRESET_IDS.flatMap((id) => [
      [`MOTION_PRESETS.${id}.label`, MOTION_PRESETS[id].label],
      [`MOTION_PRESETS.${id}.note`, MOTION_PRESETS[id].note],
    ]),
    ...tokenSets.flatMap(([name, tokens]) => [
      [`presetLine(${name})`, presetLine(tokens)],
      [`motionLine(${name})`, motionLine(withMotion(SPEC, tokens))],
    ]),
  ] as [string, string][];
}

/**
 * The strings of a source file, read from its syntax tree: string and template literals and JSX
 * text. Module specifiers (of `import`, `export … from` and `import()`) and directives are code,
 * not copy.
 */
function sourceStrings(file: string, source: string): string[] {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  const isSpecifier = (node: ts.Node): boolean => {
    const parent = node.parent;
    return (
      ((ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) &&
        parent.moduleSpecifier === node) ||
      (ts.isCallExpression(parent) &&
        parent.expression.kind === ts.SyntaxKind.ImportKeyword &&
        parent.arguments[0] === node) ||
      (ts.isExpressionStatement(parent) && ts.isSourceFile(parent.parent))
    );
  };
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (!isSpecifier(node)) found.push(node.text);
    } else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      found.push(node.text);
    } else if (ts.isJsxText(node)) {
      const text = node.text.trim();
      if (text !== "") found.push(text);
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return found;
}

/** Every rule each text breaks, as "<where>: <problem> in <text>". */
const copyFindings = (texts: readonly (readonly [where: string, text: string])[]): string[] =>
  texts.flatMap(([where, text]) =>
    copyProblems(text).map((problem) => `${where}: ${problem} in ${JSON.stringify(text)}`),
  );

describe("C-GUARD5-10 the M5 copy holds no banned word, no exclamation mark, no emoji and no British spelling", () => {
  it("C-GUARD5-10 reads every table: the video, flavor and explorer lines, the lab's sentences, the presets and the lines", () => {
    const tables = copyTables();
    expect(tables.length).toBe(
      Object.keys(FLAVOR_LINES).length +
        Object.keys(VIDEO_LINES).length +
        Object.keys(EXPLORE_LINES).length +
        5 +
        2 * MOTION_PRESET_IDS.length +
        2 * (MOTION_PRESET_IDS.length + 1),
    );
    expect(new Set(boundSentences()).size).toBe(4);
    expect(tables.some(([, text]) => text === "Motion tokens: custom.")).toBe(true);
    expect(tables.some(([, text]) => text === "Custom tokens: no preset matches.")).toBe(true);
  });

  it("C-GUARD5-10 finds nothing in the copy tables", () => {
    expect(copyFindings(copyTables())).toEqual([]);
  });

  it.each(COPY_FILES)("C-GUARD5-10 finds nothing in the strings of %s", (file) => {
    const full = path.join(ROOT, file);
    expect(existsSync(full), `${file} exists`).toBe(true);
    const strings = sourceStrings(full, readFileSync(full, "utf8"));
    expect(strings.length).toBeGreaterThan(0);
    expect(copyFindings(strings.map((text) => [file, text] as const))).toEqual([]);
  });

  it("C-GUARD5-10 reports a probe of each rule, in a table and in a file's strings", () => {
    expect(
      copyFindings([
        ["probe", "Simply pick a color."],
        ["probe", "Just one"],
        ["probe", "An easy start"],
        ["probe", "Obviously so"],
        ["probe", "Basically done"],
        ["probe", "Done!"],
        ["probe", "Done \u{1F389}"],
        ["probe", "The colour"],
        ["probe", "Its behaviour"],
        ["probe", "Render cancelled."],
        ["probe", "A grey step"],
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
    const probe = path.join(ROOT, "src/features/flavor/Probe.tsx");
    const source = [
      '"use client";',
      'import { a } from "./easy!";',
      'const b = () => import("./grey");',
      'const line = "Just render it";',
      `const note = \`The \${b} colour\`;`,
      "export const P = () => <p>Done!</p>;",
    ].join("\n");
    expect(sourceStrings(probe, source)).toEqual(["Just render it", "The ", " colour", "Done!"]);
  });
});

// C-GUARD5-11 (Task 5.11a, R5-04, I-M5-05): the purity guards C-REPO-01 (src/engine and src/spec)
// and C-GUARD3-02 (src/export and src/import) scan the new pure files, and find nothing in them. The
// guards' lists and scanners come from guard-support.ts, as the guards themselves read them.

const M5_ENGINE_FILES = M5_FOLDERS[0][2];
const M5_EXPORT_FILES = M5_FOLDERS[1][2];

/** The files each purity guard scans, as absolute paths. */
type PurityLists = { readonly repo01: readonly string[]; readonly guard302: readonly string[] };

/** Every way the purity guards miss the M5 files, named; `read` gives a file's text. */
function purityProblems(lists: PurityLists, read: (file: string) => string): string[] {
  const problems: string[] = [];
  const scan = (
    files: readonly string[],
    list: readonly string[],
    guard: string,
    violations: (source: string) => string[],
  ) => {
    for (const file of files) {
      const full = path.join(ROOT, file);
      if (!list.includes(full)) {
        problems.push(`${guard} does not scan ${file}`);
        continue;
      }
      for (const name of violations(read(full))) problems.push(`${file}: ${name}`);
    }
  };
  scan(M5_ENGINE_FILES, lists.repo01, "C-REPO-01", purityViolations);
  scan(M5_EXPORT_FILES, lists.guard302, "C-GUARD3-02", coreViolations);
  return problems;
}

const readText = (file: string): string => readFileSync(file, "utf8");
const realLists = (): PurityLists => ({
  repo01: engineAndSpecFiles(),
  guard302: exportAndImportFiles(),
});

describe("C-GUARD5-11 the purity guards scan the new pure files and find nothing in them", () => {
  it("C-GUARD5-11 finds each new engine file in C-REPO-01's list and each new export file in C-GUARD3-02's, all pure", () => {
    expect(purityProblems(realLists(), readText)).toEqual([]);
  });

  it("C-GUARD5-11 reports a list that leaves a file out (a probe)", () => {
    const lists = realLists();
    const without = (list: readonly string[], file: string) =>
      list.filter((each) => each !== path.join(ROOT, file));
    expect(
      purityProblems(
        {
          repo01: without(lists.repo01, "src/engine/color/rec2020.ts"),
          guard302: without(lists.guard302, "src/export/flavor-sources.ts"),
        },
        readText,
      ),
    ).toEqual([
      "C-REPO-01 does not scan src/engine/color/rec2020.ts",
      "C-GUARD3-02 does not scan src/export/flavor-sources.ts",
    ]);
  });

  it("C-GUARD5-11 reports an impure line in an engine file and in an export file (a probe)", () => {
    const impure: Readonly<Record<string, string>> = {
      [path.join(ROOT, "src/engine/tokens/bezier.ts")]: "export const t = Date.now();",
      [path.join(ROOT, "src/export/media.ts")]: "export const r = await fetch(url);",
    };
    const read = (file: string) => impure[file] ?? readText(file);
    expect(purityProblems(realLists(), read)).toEqual([
      "src/engine/tokens/bezier.ts: Date.now, Date.parse or Date.UTC",
      "src/export/media.ts: fetch",
    ]);
  });
});
