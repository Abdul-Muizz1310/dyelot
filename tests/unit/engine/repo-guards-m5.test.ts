import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { scanLine } from "@/export/checker/dyelot-check.mjs";
import { codeFiles, type ImportRecord, importsOf, ROOT, stripComments } from "./guard-support";

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
 * Pins another lane adds that this lane's base does not hold yet: Task 5.9b adds `@remotion/player`.
 * A pending pin must be absent, so the rebase that brings one in fails here until it leaves the list.
 */
const PENDING_PINS: readonly string[] = ["@remotion/player"];

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
