import path from "node:path";
import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

// The pure core (src/engine, src/spec and src/theme) runs in plain Node, so a DOM access there fails its
// test (spec R-24). Vitest 4 dropped `environmentMatchGlobs`; Node and jsdom projects replace it.
const PURE_CORE_TESTS = [
  "tests/unit/engine/**/*.test.{ts,tsx}",
  "tests/unit/spec/**/*.test.{ts,tsx}",
  "tests/unit/theme/**/*.test.{ts,tsx}",
  // The build scripts and the gate guard run under Node and spawn it; they have no DOM.
  "tests/unit/scripts/**/*.test.{ts,tsx}",
];

/**
 * The slow set (spec R2-31): every unit test file that took 10 s or more alone at Task 2.11 (`vitest run
 * <file>`, no coverage, start-up included, on the 8-core reference machine when idle; the next file,
 * canonical.test.ts, took 8.7 s). `pnpm gate` leaves them and `SCAN_TESTS` to `pnpm gate:full` and CI.
 * A file joins or leaves the list only on a measured solo time, never on a timing rule at run time.
 * These run in Node, beside the pure core.
 */
const SLOW_CORE_TESTS = [
  "tests/unit/engine/generate.test.ts", // 27.3 s: C-GEN-04 and C-GEN-05
  "tests/unit/engine/color/palette.test.ts", // 24.5 s: C-PAL-06, C-STATUS-01
  "tests/unit/engine/color/roles.test.ts", // 22.4 s: C-ROLE-04
  "tests/unit/engine/lint/lint-spec.test.ts", // 20.5 s: C-LINT-44
  "tests/unit/spec/url-codec.test.ts", // 18.3 s: C-URL-01, C-URL-02
  "tests/unit/engine/presets-lint-3.test.ts", // 18.1 s: C-PRESET-03, C-PRESET-04
  "tests/unit/engine/presets-lint-2.test.ts", // 17.8 s
  "tests/unit/engine/presets-lint-1.test.ts", // 15.5 s
  "tests/unit/engine/presets-lint-4.test.ts", // 15.0 s
  "tests/unit/engine/lint/t3-defaults-2.test.ts", // 13.9 s: C-TASTE-13
  "tests/unit/engine/generate-idempotence.test.ts", // 13.7 s: C-GEN-13
  "tests/unit/engine/lint/t3-defaults-3.test.ts", // 12.1 s: C-TASTE-13
  "tests/unit/engine/color/chart.test.ts", // 12.1 s: C-CHART-03
  "tests/unit/engine/lint/t3-defaults-1.test.ts", // 12.1 s: C-TASTE-13
  "tests/unit/engine/presets-lint-5.test.ts", // 11.7 s
];

/** The slow set's files that run in jsdom, beside the studio's other tests. */
const SLOW_WEB_TESTS = [
  "tests/unit/features/studio/store-lock-primary-aa.test.ts", // 19.7 s: C-STORE-34, C-STORE-41
  "tests/unit/features/studio/store-lock-primary-aaa.test.ts", // 19.7 s: C-STORE-34, C-STORE-41
  "tests/unit/features/studio/store-lock-seeds.test.ts", // 18.1 s: C-STORE-34
  "tests/unit/features/studio/store-lock-pair-aaa.test.ts", // 13.7 s
  "tests/unit/features/studio/store-lock-pair-aa.test.ts", // 13.4 s
];

/** The slow set of R2-31 apart from the scan; the gate guard (C-REPO-M2-07) reads it. */
export const SLOW_TESTS: readonly string[] = [...SLOW_CORE_TESTS, ...SLOW_WEB_TESTS];

/**
 * The R2-10 scan (C-INSPECT-16): 576 generations that read only the engine, 30 s per file alone at Task
 * 2.11. It runs in Node, in a project of its own after the others (`groupOrder`), because beside the
 * CPU-bound property cases it pushed them past their timeouts. It is part of the slow set (R2-31).
 */
export const SCAN_TESTS: readonly string[] = [
  "tests/unit/features/studio/fix-scan-srgb.test.ts", // 29.7 s
  "tests/unit/features/studio/fix-scan-p3.test.ts", // 30.2 s
];

/** The floor of the pure core, held by every pure helper too (spec R2-22). */
const PURE_FLOORS = { lines: 95, statements: 95, functions: 95, branches: 90 };

/** The studio's pure helper files, each measured and held to `PURE_FLOORS` on its own. */
const STUDIO_HELPERS = [
  "protocol",
  "url",
  "drafts",
  "params",
  "lot",
  "inspect",
  "fixes",
  "client",
  "guards",
  "view",
  "shortcuts",
  "inputs",
].map((name) => `src/features/studio/${name}.ts`);

/** The preview's pure helpers (Tasks 2.7 to 2.10a), held to `PURE_FLOORS` the same way. */
const PREVIEW_HELPERS = [
  "frame",
  "swatches",
  "copy",
  "vars",
  "kit/states",
  "tide",
  "bars",
  "format",
].map((name) => `src/features/preview/${name}.ts`);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    globals: true,
    testTimeout: 30_000,
    // The engine's property and measurement tests are CPU-bound. One worker per logical core lets
    // hyperthread siblings and coverage slow each test past its timeout; half the logical cores
    // (one per physical core on SMT machines) keeps every test near its solo time.
    maxWorkers: "50%",
    // `pnpm gate` runs `core` and `web`; `pnpm gate:full` and CI run all five (spec R2-31). The
    // gate guard (tests/unit/scripts/gate.test.ts) checks that each unit test file runs in one project.
    projects: [
      {
        extends: true,
        test: {
          name: "core",
          environment: "node",
          include: PURE_CORE_TESTS,
          exclude: [...configDefaults.exclude, ...SLOW_CORE_TESTS],
        },
      },
      {
        extends: true,
        test: {
          name: "core-slow",
          environment: "node",
          include: SLOW_CORE_TESTS,
        },
      },
      {
        extends: true,
        test: {
          name: "web",
          environment: "jsdom",
          include: ["tests/unit/**/*.test.{ts,tsx}"],
          exclude: [
            ...configDefaults.exclude,
            ...PURE_CORE_TESTS,
            ...SCAN_TESTS,
            ...SLOW_WEB_TESTS,
          ],
          setupFiles: ["./tests/setup.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "web-slow",
          environment: "jsdom",
          include: SLOW_WEB_TESTS,
          setupFiles: ["./tests/setup.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "scan",
          environment: "node",
          include: [...SCAN_TESTS],
          sequence: { groupOrder: 1 },
        },
      },
    ],
    coverage: {
      provider: "v8",
      // Pure modules only; components and routes are covered by the E2E tier.
      include: [
        "src/engine/**",
        "src/spec/**",
        "src/theme/**",
        "src/lib/site/**",
        "src/features/fonts/load.ts",
        // The studio's pure helpers (spec R2-22). The store, the worker shell and the UI are
        // covered by the flows; inspect.ts holds the inspector's helpers (Task 2.10b).
        ...STUDIO_HELPERS,
        ...PREVIEW_HELPERS,
      ],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 75,
        branches: 70,
        // The pure core holds a higher floor than the rest of the code.
        "src/engine/**": { lines: 95, statements: 95, functions: 95, branches: 90 },
        "src/spec/**": { lines: 95, statements: 95, functions: 95, branches: 90 },
        "src/theme/**": { lines: 95, statements: 95, functions: 95, branches: 90 },
        "src/features/fonts/load.ts": { lines: 95, statements: 95, functions: 95, branches: 90 },
        ...Object.fromEntries(
          [...STUDIO_HELPERS, ...PREVIEW_HELPERS].map((file) => [file, PURE_FLOORS]),
        ),
      },
    },
  },
});
