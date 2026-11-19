import { defineConfig, devices } from "@playwright/test";
import { TIMED_GREP } from "./tests/e2e/timed-flows";

const port = Number(process.env.PORT ?? 3100);
const baseURL = `http://localhost:${port}`;
const DESKTOP = { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } };

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: { baseURL, trace: "on-first-retry" },
  projects: [
    // The parallel flows: every flow but the Lighthouse runs and the timed ones.
    {
      name: "chromium",
      use: DESKTOP,
      testIgnore: /lighthouse-m6\.spec\.ts/,
      grepInvert: TIMED_GREP,
    },
    // The Lighthouse gate (docs/specs/06-gallery.md, R6-44 and 12.2): after the parallel flows and
    // before `timed` (docs/specs/07-finish.md, R7-04), so no audit shares the CPU, its tests in order
    // and one at a time. It sets no `use`: a launch in the test runner takes the running project's
    // `use`, and a device's options break Lighthouse's own screen emulation (probe 1, R6-57).
    {
      name: "lighthouse",
      testMatch: /lighthouse-m6\.spec\.ts/,
      dependencies: ["chromium"],
      retries: 1,
      fullyParallel: false,
    },
    // The load family (docs/specs/07-finish.md, R7-04, R7-05 and section 7): flows that hold a time
    // budget or a harness timeout, one at a time after the Lighthouse runs, beside no other browser.
    // To rerun them alone: `pnpm exec playwright test --project timed --no-deps`. A run filtered by
    // file or `--grep` that selects a timed flow also runs every `chromium` and `lighthouse` test, its
    // dependencies; to stay narrow, run `--project chromium <files>`, then `--project timed --no-deps
    // <files>`.
    {
      name: "timed",
      use: DESKTOP,
      testIgnore: /lighthouse-m6\.spec\.ts/,
      grep: TIMED_GREP,
      dependencies: ["lighthouse"],
      workers: 1,
    },
  ],
  webServer: [
    // The local mock of OpenRouter (docs/specs/04-ai.md, R4-58), first, so the app's shared route
    // reaches it from the first flow. The flows that reach it live in tests/e2e/ai-route.spec.ts.
    // It is always started fresh: a stale or foreign server on its fixed port fails the run instead
    // of answering it.
    {
      command: "node tests/e2e/mock-openrouter.mjs",
      url: "http://127.0.0.1:3199/__log",
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: `pnpm build && pnpm start -p ${port}`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
      // The build's output, its route table included, goes into the run's log (spec R2-31, item 5).
      stdout: "pipe",
      // The shared route's test values (docs/specs/04-ai.md, section 4: TEST_ENV, made-up key and
      // secret), pointed at the local mock OpenRouter (R4-58). The Langfuse trio is blank, so a local
      // .env never turns tracing on in a test run (Next.js keeps a variable already set, empty or not).
      env: {
        NEXT_PUBLIC_SITE_URL: baseURL,
        OPENROUTER_API_KEY: "sk-or-test-0123456789abcdef",
        DYELOT_COOKIE_SECRET: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=",
        OPENROUTER_BASE_URL: "http://127.0.0.1:3199/api/v1",
        OPENROUTER_MODEL_PRIMARY: "test/text-1:free",
        OPENROUTER_MODEL_FAST: "test/text-2:free",
        OPENROUTER_MODEL_FALLBACK: "test/text-3:free",
        OPENROUTER_VISION_MODEL_1: "test/vision-1:free",
        OPENROUTER_VISION_MODEL_2: "test/vision-2:free",
        OPENROUTER_VISION_MODEL_3: "test/vision-3:free",
        LANGFUSE_PUBLIC_KEY: "",
        LANGFUSE_SECRET_KEY: "",
        LANGFUSE_BASE_URL: "",
      },
    },
  ],
});
