import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import playwrightConfig from "../../../playwright.config";
import { SCAN_TESTS, SLOW_TESTS } from "../../../vitest.config";

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
