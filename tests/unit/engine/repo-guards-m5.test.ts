import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { scanLine } from "@/export/checker/dyelot-check.mjs";
import { codeFiles, importsOf, ROOT, stripComments } from "./guard-support";

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
