import path from "node:path";
import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

// The pure core (src/engine, src/spec and src/theme) runs in plain Node, so a DOM access there fails its
// test (spec R-24). Vitest 4 dropped `environmentMatchGlobs`; two projects replace it.
const PURE_CORE_TESTS = [
  "tests/unit/engine/**/*.test.{ts,tsx}",
  "tests/unit/spec/**/*.test.{ts,tsx}",
  "tests/unit/theme/**/*.test.{ts,tsx}",
  // The build scripts run under Node and spawn it; they have no DOM.
  "tests/unit/scripts/**/*.test.{ts,tsx}",
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
].map((name) => `src/features/studio/${name}.ts`);

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
    projects: [
      {
        extends: true,
        test: {
          name: "core",
          environment: "node",
          include: PURE_CORE_TESTS,
        },
      },
      {
        extends: true,
        test: {
          name: "web",
          environment: "jsdom",
          include: ["tests/unit/**/*.test.{ts,tsx}"],
          exclude: [...configDefaults.exclude, ...PURE_CORE_TESTS],
          setupFiles: ["./tests/setup.ts"],
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
        // covered by the flows; inspect.ts arrives with Task 2.10 and is held to the floor then.
        ...STUDIO_HELPERS,
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
        ...Object.fromEntries(STUDIO_HELPERS.map((file) => [file, PURE_FLOORS])),
      },
    },
  },
});
