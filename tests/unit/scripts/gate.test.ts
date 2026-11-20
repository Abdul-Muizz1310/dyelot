import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { devices, type Project } from "@playwright/test";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import playwrightConfig from "../../../playwright.config";
import { SCAN_TESTS, SLOW_TESTS } from "../../../vitest.config";
import { TIMED_FLOWS, TIMED_GREP, TIMED_TAG } from "../../e2e/timed-flows";
import { E2E_TITLE, filesUnder, testTitles } from "../engine/guard-support";

// Cases are C-REPO-M2-06 to C-REPO-M2-08 of docs/specs/02-studio.md, section 6.10: the gates of R2-31.
// `pnpm gate` leaves the slow set to `pnpm gate:full` and CI, and no unit test file may fall between
// the projects. The file lists come from Vitest itself, so the checks read what a run would run.

const ROOT = path.resolve(import.meta.dirname, "../../..");
const VITEST = path.join(ROOT, "node_modules/vitest/vitest.mjs");
const TEST_FILE = /\.test\.tsx?$/;

/** Every unit test file on disk, relative to the root, sorted. */
function unitTestFiles(): string[] {
  return readdirSync(path.join(ROOT, "tests/unit"), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && TEST_FILE.test(entry.name))
    .map((entry) => path.relative(ROOT, path.join(entry.parentPath, entry.name)))
    .sort();
}

type Listed = { file: string; project: string };

/**
 * The test files Vitest would run for `args` (the arguments that follow `vitest run`), each with its
 * project, read through `vitest list --filesOnly --json=<file>`. The child gets no `VITEST*`
 * variables, so it starts as a run from the shell would.
 */
function listFiles(args: readonly string[]): Listed[] {
  const work = mkdtempSync(path.join(tmpdir(), "dyelot-gate-"));
  try {
    const out = path.join(work, "files.json");
    const env: NodeJS.ProcessEnv = { ...process.env };
    for (const key of Object.keys(env)) if (key.startsWith("VITEST")) delete env[key];
    const result = spawnSync(
      process.execPath,
      [VITEST, "list", "--filesOnly", `--json=${out}`, ...args],
      { cwd: ROOT, env, encoding: "utf8", timeout: 60_000 },
    );
    if (result.status !== 0 || !existsSync(out)) {
      throw new Error(`vitest list ${args.join(" ")} failed: ${result.stderr}${result.stdout}`);
    }
    const listed = JSON.parse(readFileSync(out, "utf8")) as {
      file: string;
      projectName?: string;
    }[];
    return listed.map((entry) => ({
      file: path.relative(ROOT, entry.file),
      project: entry.projectName ?? "",
    }));
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** The package scripts, as `package.json` holds them. */
function scripts(): Record<string, string> {
  const json = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };
  return json.scripts ?? {};
}

describe("R2-31 the two gates", () => {
  it("C-REPO-M2-06 runs every unit test file in exactly one project", { timeout: 60_000 }, () => {
    const files = unitTestFiles();
    expect(files.length).toBeGreaterThan(90);
    const projects = new Map<string, string[]>();
    for (const { file, project } of listFiles([])) {
      projects.set(file, [...(projects.get(file) ?? []), project]);
    }
    const notOnce = [...projects]
      .filter(([, names]) => names.length !== 1)
      .map(([file, names]) => `${file}: ${names.join(", ")}`);
    expect(notOnce, "files in more than one project").toEqual([]);
    expect([...projects.keys()].sort(), "the files the projects run").toEqual(files);
  });

  it("C-REPO-M2-07 lists only existing test files in the slow set, each once", () => {
    const slow = [...SLOW_TESTS, ...SCAN_TESTS];
    expect(SLOW_TESTS.length).toBeGreaterThan(0);
    expect([...SCAN_TESTS].sort()).toEqual(
      [
        "tests/unit/features/studio/fix-scan-p3.test.ts",
        "tests/unit/features/studio/fix-scan-srgb.test.ts",
        ...Array.from({ length: 10 }, (_, i) => `tests/unit/engine/measure-grid-${i + 1}.test.ts`),
      ].sort(),
    );
    const repeated = slow.filter((file, at) => slow.indexOf(file) !== at);
    expect(repeated, "entries listed twice").toEqual([]);
    const missing = slow.filter(
      (file) =>
        !file.startsWith("tests/unit/") ||
        !TEST_FILE.test(file) ||
        !existsSync(path.join(ROOT, file)),
    );
    expect(missing, "entries that are not a unit test file on disk").toEqual([]);
  });

  it("C-REPO-M2-08 pnpm gate runs no slow file and every other one; gate:full runs them all", {
    timeout: 60_000,
  }, () => {
    const all = scripts();
    expect(all.gate).toBe("pnpm lint && pnpm typecheck && pnpm test:fast && pnpm test:e2e");
    expect(all["gate:full"]).toBe(
      "pnpm lint && pnpm typecheck && pnpm vitest run --coverage && pnpm test:e2e",
    );
    const fast = all["test:fast"] ?? "";
    expect(fast).toMatch(/^vitest run(?: --project [\w-]+)+$/);
    const listed = listFiles(fast.replace(/^vitest run /, "").split(" ")).map(
      (entry) => entry.file,
    );
    const slow = new Set<string>([...SLOW_TESTS, ...SCAN_TESTS]);
    expect(
      listed.filter((file) => slow.has(file)),
      "slow files in pnpm gate",
    ).toEqual([]);
    expect([...listed].sort(), "the files pnpm gate runs").toEqual(
      unitTestFiles().filter((file) => !slow.has(file)),
    );
  });
});

// C-GUARD6-02 and C-GUARD6-13 of docs/specs/06-gallery.md, section 14.12: the one package M6 adds
// (R6-43, R6-53) and the Lighthouse project that runs after every other flow (R6-44, 12.2).

/** The `dependencies` M5 left, by name: M6 adds no runtime package (R6-49, R6-53). */
const M5_DEPENDENCIES = [
  "@csstools/css-color-parser",
  "@csstools/css-parser-algorithms",
  "@csstools/css-tokenizer",
  "@langfuse/otel",
  "@langfuse/tracing",
  "@opentelemetry/api",
  "@opentelemetry/core",
  "@opentelemetry/exporter-trace-otlp-http",
  "@opentelemetry/otlp-exporter-base",
  "@opentelemetry/sdk-trace-base",
  "@react-three/drei",
  "@react-three/fiber",
  "@remotion/player",
  "@remotion/web-renderer",
  "@toon-format/toon",
  "color-name-list",
  "colorthief",
  "fflate",
  "lucide-react",
  "mediabunny",
  "motion",
  "next",
  "react",
  "react-dom",
  "remotion",
  "three",
  "yaml",
  "zod",
  "zustand",
];

/** C-GUARD5-02's pins (R5-60), each in the one field that holds it; M6 changes none. */
const M5_PINS: Record<"dependencies" | "devDependencies", Record<string, string>> = {
  dependencies: {
    three: "0.187.0",
    "@react-three/fiber": "9.8.2",
    "@react-three/drei": "10.7.9",
    remotion: "4.0.543",
    "@remotion/player": "4.0.543",
    "@remotion/web-renderer": "4.0.543",
    mediabunny: "1.64.0",
    motion: "14.3.0",
  },
  devDependencies: { "@types/three": "0.187.0" },
};

describe("C-GUARD6-02 package.json adds exactly lighthouse 13.5.0, as a dev dependency", () => {
  const manifest = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };

  it("C-GUARD6-02 pins lighthouse in devDependencies alone and keeps M5's dependencies", () => {
    expect(manifest.devDependencies.lighthouse).toBe("13.5.0");
    expect(Object.hasOwn(manifest.dependencies, "lighthouse")).toBe(false);
    expect(Object.keys(manifest.dependencies).sort()).toEqual([...M5_DEPENDENCIES].sort());
  });

  it("C-GUARD6-02 holds every pin of C-GUARD5-02", () => {
    for (const [field, pins] of Object.entries(M5_PINS) as [
      keyof typeof M5_PINS,
      Record<string, string>,
    ][]) {
      for (const [name, version] of Object.entries(pins)) {
        expect(manifest[field][name], `${field} ${name}`).toBe(version);
      }
    }
  });
});

describe("C-GUARD6-13 playwright.config.ts holds the lighthouse project of 12.2", () => {
  const projects = playwrightConfig.projects ?? [];
  const named = (name: string) => projects.find((project) => project.name === name);

  it("C-GUARD6-13 runs lighthouse-m6.spec.ts alone, after chromium, once retried, in order and device-free", () => {
    expect(named("lighthouse")).toEqual({
      name: "lighthouse",
      testMatch: /lighthouse-m6\.spec\.ts/,
      dependencies: ["chromium"],
      retries: 1,
      fullyParallel: false,
    });
  });

  it("C-GUARD6-13 keeps lighthouse-m6.spec.ts out of the chromium project, and no other flow", () => {
    const ignore = named("chromium")?.testIgnore;
    expect(ignore).toBeInstanceOf(RegExp);
    const ignores = (file: string) => (ignore as RegExp).test(file);
    expect(ignores("tests/e2e/lighthouse-m6.spec.ts")).toBe(true);
    expect(ignores("tests/e2e/landing.spec.ts")).toBe(false);
    expect(ignores("tests/e2e/a11y-m5.spec.ts")).toBe(false);
  });
});

// C-SER7-01 to C-SER7-03 of docs/specs/07-finish.md, section 14.5: the load family runs in a third
// project, `timed`, one test at a time after the Lighthouse runs (R7-04), selected by its case ids
// whole and by one tag (R7-05, section 7).

const sameGrep = (value: unknown): boolean =>
  value instanceof RegExp && value.source === TIMED_GREP.source && value.flags === TIMED_GREP.flags;

/**
 * Each rule of R7-04 that `projects` break, as "<project>.<key>", or the names of the projects that
 * are missing: `chromium` leaves the timed flows out, `lighthouse` waits for `chromium`, and `timed`
 * takes `chromium`'s device and ignore, selects the timed flows, waits for `lighthouse` and runs on
 * one worker, so no budget is measured beside another browser.
 */
function timedProblems(projects: readonly Project[]): string[] {
  const named = new Map(projects.map((project) => [project.name, project]));
  const chromium = named.get("chromium");
  const lighthouse = named.get("lighthouse");
  const timed = named.get("timed");
  if (chromium === undefined || lighthouse === undefined || timed === undefined) {
    return ["chromium", "lighthouse", "timed"].filter((name) => !named.has(name));
  }
  const rules: [key: string, holds: boolean][] = [
    ["chromium.grepInvert", sameGrep(chromium.grepInvert)],
    ["lighthouse.dependencies", isDeepStrictEqual(lighthouse.dependencies, ["chromium"])],
    ["timed.use", isDeepStrictEqual(timed.use, chromium.use)],
    ["timed.testIgnore", isDeepStrictEqual(timed.testIgnore, chromium.testIgnore)],
    ["timed.grep", sameGrep(timed.grep)],
    ["timed.dependencies", isDeepStrictEqual(timed.dependencies, ["lighthouse"])],
    ["timed.workers", timed.workers === 1],
  ];
  return rules.filter(([, holds]) => !holds).map(([key]) => key);
}

/** `project` without its `key`, for a probe config. */
const without = (project: Project, key: keyof Project): Project =>
  Object.fromEntries(Object.entries(project).filter(([name]) => name !== key)) as Project;

describe("C-SER7-01 playwright.config.ts runs the timed flows in a third project after lighthouse", () => {
  const projects = playwrightConfig.projects ?? [];

  it("C-SER7-01 holds chromium, lighthouse and timed, in order, and breaks no rule of R7-04", () => {
    expect(projects.map((project) => project.name)).toEqual(["chromium", "lighthouse", "timed"]);
    expect(timedProblems(projects)).toEqual([]);
  });

  it("C-SER7-01 timed is R7-04's object with chromium's use and testIgnore; lighthouse is C-GUARD6-13's", () => {
    const [chromium, lighthouse, timed] = projects;
    expect(chromium).toEqual({
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
      testIgnore: /lighthouse-m6\.spec\.ts/,
      grepInvert: TIMED_GREP,
    });
    expect(lighthouse).toEqual({
      name: "lighthouse",
      testMatch: /lighthouse-m6\.spec\.ts/,
      dependencies: ["chromium"],
      retries: 1,
      fullyParallel: false,
    });
    expect(timed).toEqual({
      name: "timed",
      use: chromium?.use,
      testIgnore: chromium?.testIgnore,
      grep: TIMED_GREP,
      dependencies: ["lighthouse"],
      workers: 1,
    });
  });
});

const E2E_DIR = path.join(ROOT, "tests/e2e");
/** Playwright's `test.describe` and its modifiers; `configure` takes no title, so it names none. */
const DESCRIBE_TITLE = /^test\.describe(?:\.(?:only|skip|fixme|serial|parallel))*$/;

/** The 19 `test` titles of section 7 that hold a timed id, as "<file> <title>" (R7-05, C-SER7-02). */
const TIMED_TITLES = [
  "about.spec.ts F-ABT-02 typing Saltmarsh at a steady pace is one history entry, and one Undo undoes it",
  "canvas.spec.ts F-CANVAS-07 Reduce motion stops both templates, keeps the FAQ's state and never replays the entrance",
  "canvas.spec.ts F-CANVAS-07 Reduce motion stops the dashboard and settings, keeps their state and never replays the entrance",
  "canvas.spec.ts F-CANVAS-07 Reduce motion stops the kit's animations, transitions and springs",
  "canvas.spec.ts F-CANVAS-07 Reduce motion stops the mobile template, keeps its tab and sheet and never replays the entrance",
  "canvas.spec.ts F-CANVAS-07 Reduce motion switched on during the sheet's rise leaves it settled, with no rise later",
  "canvas.spec.ts F-CANVAS-07 Reduce motion toggled with the settings' confirm dialog open never replays its entrance",
  "flavor.spec.ts F-LOOP-01 Record the shader loop shows its progress, and an MP4 downloads within the record budget",
  "flavor.spec.ts F-RENDER-01 the first render shows the note, then renders an MP4 within the render budget with one usage event",
  "import.spec.ts F-IMP-RF4 {} imports within 2 s with no long task over 1 s",
  "inspector.spec.ts F-INSP-15 T1 and T4 each outline a part on screen in every template",
  "lazy-m5.spec.ts F-LAZY5-02 the first load of /studio fetches no three, R3F, Remotion, web renderer or Mediabunny code",
  "steer.spec.ts F-STEER-01 Warmer locks the primary, moves it toward 50 and warms the tint; three quick presses are one entry",
  "studio.spec.ts F-INPUT-07 a drag in the color input is one undo step (F-INPUT-15)",
  "studio.spec.ts F-INPUT-07 the native color input sets the hex field and locks the seed",
  "studio.spec.ts F-INPUT-15 holding Space is one undo step",
  "studio.spec.ts F-STUDIO-05 a drawer takes focus, traps it, makes the page inert and gives focus back on Escape",
  "studio.spec.ts F-STUDIO-05 a drawer that becomes a column closes, and stays closed when the window narrows",
  "transitions.spec.ts F-VT-04 a step opens its token row, the swatch morphs, another step closes it, Escape returns focus",
];

/** A title holds a timed id whole: a word boundary on each side, as TIMED_GREP reads it (R7-05). */
const holdsTimedId = (title: string): boolean =>
  TIMED_FLOWS.some((id) => new RegExp(`\\b${id}\\b`).test(title));

/** A `test` call's tag, from its options object: the name `TIMED_TAG` or a string, alone or in a list. */
function carriesTimedTag(options: ts.Expression | undefined): boolean {
  if (options === undefined || !ts.isObjectLiteralExpression(options)) return false;
  return options.properties.some((property) => {
    if (!ts.isPropertyAssignment(property) || property.name.getText() !== "tag") return false;
    const value = property.initializer;
    const tags = ts.isArrayLiteralExpression(value) ? [...value.elements] : [value];
    return tags.some(
      (tag) =>
        (ts.isIdentifier(tag) && tag.text === "TIMED_TAG") ||
        (ts.isStringLiteralLike(tag) && tag.text === TIMED_TAG),
    );
  });
}

/**
 * A call's name from the syntax tree, `test.describe.serial` for `test.describe\n  .serial(…)`, so
 * the formatter's line breaks do not change it; null for anything but names joined by dots.
 */
function calleeName(node: ts.Expression): string | null {
  if (ts.isIdentifier(node)) return node.text;
  if (!ts.isPropertyAccessExpression(node)) return null;
  const base = calleeName(node.expression);
  return base === null ? null : `${base}.${node.name.text}`;
}

/** A title's text: a string's, a template's source, or "" for anything else, such as a callback. */
function titleOf(node: ts.Expression | undefined, tree: ts.SourceFile): string {
  if (node === undefined) return "";
  if (ts.isStringLiteralLike(node)) return node.text;
  return ts.isTemplateExpression(node) ? node.getText(tree) : "";
}

type TaggedCall = { file: string; call: string; title: string; inDescribe: boolean };

/**
 * The `test` and `test.describe` calls of `source` that carry TIMED_TAG, by their options or in
 * their title, read from the syntax tree, each with its name and whether a `test.describe` call
 * holds it. A tagged describe moves every test inside it into `timed`, so it counts too.
 */
function timedTagged(source: string, file: string): TaggedCall[] {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const found: TaggedCall[] = [];
  const visit = (node: ts.Node, inDescribe: boolean): void => {
    let inside = inDescribe;
    if (ts.isCallExpression(node)) {
      const call = calleeName(node.expression) ?? "";
      const [title, options] = node.arguments;
      const text = titleOf(title, tree);
      const describe = DESCRIBE_TITLE.test(call);
      const tagged = carriesTimedTag(options) || text.includes(TIMED_TAG);
      if ((describe || E2E_TITLE.test(call)) && tagged) {
        found.push({ file: path.relative(E2E_DIR, file), call, title: text, inDescribe });
      }
      if (describe) inside = true;
    }
    ts.forEachChild(node, (child) => visit(child, inside));
  };
  visit(tree, false);
  return found;
}

describe("C-SER7-02 the timed list selects section 7's flows and nothing else", () => {
  const files = filesUnder("tests/e2e", /\.ts$/);
  const read = (file: string) => readFileSync(file, "utf8");
  const titled = (callee: RegExp) =>
    files.flatMap((file) =>
      testTitles(read(file), file, callee).map(
        (title) => `${path.relative(E2E_DIR, file)} ${title}`,
      ),
    );

  it("C-SER7-02 TIMED_FLOWS is section 7's twelve ids in order, frozen, and TIMED_TAG is @timed", () => {
    expect(TIMED_FLOWS).toEqual([
      "F-INSP-15",
      "F-STUDIO-05",
      "F-INPUT-07",
      "F-INPUT-15",
      "F-CANVAS-07",
      "F-IMP-RF4",
      "F-ABT-02",
      "F-STEER-01",
      "F-VT-04",
      "F-LOOP-01",
      "F-RENDER-01",
      "F-LAZY5-02",
    ]);
    expect(Object.isFrozen(TIMED_FLOWS)).toBe(true);
    expect(TIMED_TAG).toBe("@timed");
  });

  it("C-SER7-02 the test titles holding a timed id whole are exactly section 7's 19", () => {
    const holding = titled(E2E_TITLE).filter((line) => holdsTimedId(line));
    expect(holding.sort()).toEqual([...TIMED_TITLES].sort());
  });

  it("C-SER7-02 the one test with the tag TIMED_TAG is F-TPL-39's top-level test", () => {
    expect(files.flatMap((file) => timedTagged(read(file), file))).toEqual([
      {
        file: "templates.spec.ts",
        call: "test",
        title:
          "F-TPL-39 every painted color is named on a design whose 46 role colors are distinct",
        inDescribe: false,
      },
    ]);
  });

  it("C-SER7-02 no describe title and no file name matches TIMED_GREP", () => {
    expect(titled(DESCRIBE_TITLE).length, "describe titles read").toBeGreaterThan(50);
    expect(titled(DESCRIBE_TITLE).filter((line) => TIMED_GREP.test(line))).toEqual([]);
    expect(
      files.map((file) => path.relative(E2E_DIR, file)).filter((name) => TIMED_GREP.test(name)),
    ).toEqual([]);
  });
});

describe("C-SER7-03 TIMED_GREP and timedProblems reject what R7-04 and R7-05 rule out", () => {
  it("C-SER7-03 TIMED_GREP matches a timed id whole or the tag, and no longer or shorter id", () => {
    expect(TIMED_GREP.flags).toBe("");
    for (const line of [
      "timed import.spec.ts F-IMP-RF4 a 256 KiB DESIGN.md",
      "timed templates.spec.ts F-TPL-39 every painted color @timed",
    ]) {
      expect(TIMED_GREP.test(line), line).toBe(true);
    }
    for (const line of [
      "F-IMP-RF40 x",
      "XF-LOOP-01 x",
      "F-LOOP-010 x",
      "F-LOOP-0 x",
      "chromium templates.spec.ts 7.6 The landing and editorial templates F-TPL-39 every painted color in the landing",
    ]) {
      expect(TIMED_GREP.test(line), line).toBe(false);
    }
  });

  it("C-SER7-03 timedProblems reports a timed without workers, a timed after chromium and a chromium without grepInvert", () => {
    const projects = playwrightConfig.projects ?? [];
    const probe = (name: string, change: (project: Project) => Project): Project[] =>
      projects.map((project) => (project.name === name ? change(project) : project));
    expect(timedProblems(probe("timed", (timed) => without(timed, "workers")))).toEqual([
      "timed.workers",
    ]);
    expect(
      timedProblems(probe("timed", (timed) => ({ ...timed, dependencies: ["chromium"] }))),
    ).toEqual(["timed.dependencies"]);
    expect(timedProblems(probe("chromium", (chromium) => without(chromium, "grepInvert")))).toEqual(
      ["chromium.grepInvert"],
    );
  });
});
