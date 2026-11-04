import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
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
