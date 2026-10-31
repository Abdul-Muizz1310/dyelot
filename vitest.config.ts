import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 30_000,
    coverage: {
      provider: "v8",
      // Pure modules only; components and routes are covered by the E2E tier.
      include: ["src/engine/**", "src/spec/**", "src/lib/site/**"],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 75,
        branches: 70,
        // Per-folder floors for src/engine/** and src/spec/** (lines, statements and
        // functions 95, branches 90) arrive with the first files in those folders.
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
