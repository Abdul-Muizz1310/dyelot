import path from "node:path";
import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

// The pure core (src/engine and src/spec) runs in plain Node, so a DOM access there fails its
// test (spec R-24). Vitest 4 dropped `environmentMatchGlobs`; two projects replace it.
const PURE_CORE_TESTS = [
  "tests/unit/engine/**/*.test.{ts,tsx}",
  "tests/unit/spec/**/*.test.{ts,tsx}",
];

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
      include: ["src/engine/**", "src/spec/**", "src/lib/site/**"],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 75,
        branches: 70,
        // The pure core holds a higher floor than the rest of the code.
        "src/engine/**": { lines: 95, statements: 95, functions: 95, branches: 90 },
        // The same floor for src/spec/** arrives with the first file in that folder.
      },
    },
  },
});
