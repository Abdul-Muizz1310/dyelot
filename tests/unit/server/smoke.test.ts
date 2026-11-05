import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readAiEnv } from "@/server/ai/env";
import { planSmoke, smokeAllowed } from "@/server/ai/smoke";
import { TEST_ENV } from "../ai/fixtures";

// C-SMOKE-01 and C-SMOKE-02 of docs/specs/04-ai.md, section 14.13 (R4-61): the plan of the live smoke
// and its reserve check. The live file itself is run in a child Vitest, never with a key, to prove
// that it skips and that CI refuses it before any request.

const ROOT = path.resolve(import.meta.dirname, "../../..");
const VITEST = path.join(ROOT, "node_modules/vitest/vitest.mjs");
const LIVE_FILE = "tests/unit/scripts/ai-smoke.live.test.ts";

function envOf(source: Record<string, string>) {
  const read = readAiEnv(source);
  if (!read.ok) throw new Error(`the test environment is invalid at ${read.variable}`);
  return read.env;
}

describe("C-SMOKE-01 planSmoke and smokeAllowed", () => {
  it("C-SMOKE-01 plans one text call per distinct text slug, then one image call per vision slug", () => {
    const plan = planSmoke(envOf(TEST_ENV));
    expect(plan).toEqual([
      { slug: "test/text-1:free", kind: "text" },
      { slug: "test/text-2:free", kind: "text" },
      { slug: "test/text-3:free", kind: "text" },
      { slug: "test/vision-1:free", kind: "image" },
      { slug: "test/vision-2:free", kind: "image" },
      { slug: "test/vision-3:free", kind: "image" },
    ]);
    expect(plan.length).toBeLessThanOrEqual(6);
    expect(Object.isFrozen(plan)).toBe(true);
  });

  it("C-SMOKE-01 plans each slug once: a text slug that is also a vision slug is an image call", () => {
    const plan = planSmoke(
      envOf({
        ...TEST_ENV,
        OPENROUTER_MODEL_PRIMARY: "a/text:free",
        OPENROUTER_MODEL_FAST: "a/both:free",
        OPENROUTER_MODEL_FALLBACK: "a/text:free",
        OPENROUTER_VISION_MODEL_1: "a/both:free",
        OPENROUTER_VISION_MODEL_2: "b/vision:free",
        OPENROUTER_VISION_MODEL_3: "b/vision:free",
      }),
    );
    expect(plan).toEqual([
      { slug: "a/text:free", kind: "text" },
      { slug: "a/both:free", kind: "image" },
      { slug: "b/vision:free", kind: "image" },
    ]);
  });

  it("C-SMOKE-01 plans the 4 calls of the D9 slugs: one text and three image", () => {
    const plan = planSmoke(
      envOf({
        ...TEST_ENV,
        OPENROUTER_MODEL_PRIMARY: "x/xing:free",
        OPENROUTER_MODEL_FAST: "x/xing:free",
        OPENROUTER_MODEL_FALLBACK: "x/xing:free",
        OPENROUTER_VISION_MODEL_1: "x/dots:free",
        OPENROUTER_VISION_MODEL_2: "x/gemma:free",
        OPENROUTER_VISION_MODEL_3: "x/nemotron:free",
      }),
    );
    expect(plan.map((call) => call.kind)).toEqual(["text", "image", "image", "image"]);
  });

  it("C-SMOKE-01 plans nothing for an environment with no slug", () => {
    const { OPENROUTER_MODEL_PRIMARY, OPENROUTER_MODEL_FAST, OPENROUTER_MODEL_FALLBACK, ...rest } =
      TEST_ENV;
    const bare = Object.fromEntries(
      Object.entries(rest).filter(([name]) => !name.startsWith("OPENROUTER_VISION_MODEL")),
    );
    expect(planSmoke(envOf(bare))).toEqual([]);
  });

  it("C-SMOKE-01 allows the smoke only when remaining >= reserve + 3 + n", () => {
    expect(smokeAllowed(44, 35, 6)).toBe(true);
    expect(smokeAllowed(43, 35, 6)).toBe(false);
    expect(smokeAllowed(42, 35, 4)).toBe(true);
    expect(smokeAllowed(41, 35, 4)).toBe(false);
    expect(smokeAllowed(50, 0, 0)).toBe(true);
    expect(smokeAllowed(2, 0, 0)).toBe(false);
  });
});

describe("C-SMOKE-02 the refusals", () => {
  it("C-SMOKE-02 refuses an unread or low pool: smokeAllowed(40, 35, 3) and (null, 35, 1) are false", () => {
    expect(smokeAllowed(40, 35, 3)).toBe(false);
    expect(smokeAllowed(null, 35, 1)).toBe(false);
  });

  it("C-SMOKE-02 throws a TypeError naming planSmoke for an env that is not an object", () => {
    for (const bad of [null, undefined, 5, "env", []]) {
      expect(() => planSmoke(bad as never)).toThrow(TypeError);
      expect(() => planSmoke(bad as never)).toThrow(/planSmoke/);
    }
  });

  it("C-SMOKE-02 throws for a reserve, remaining or n that is not a number in its domain", () => {
    expect(() => smokeAllowed("40" as never, 35, 3)).toThrow(TypeError);
    expect(() => smokeAllowed(40, Number.NaN, 3)).toThrow(RangeError);
    expect(() => smokeAllowed(40, 35, -1)).toThrow(RangeError);
    expect(() => smokeAllowed(40, 35, 1.5)).toThrow(RangeError);
    expect(() => smokeAllowed(Number.NaN, 35, 1)).toThrow(RangeError);
  });

  /** The live file in a child Vitest with a scrubbed environment: no key, no network target. */
  function runLive(extra: Record<string, string>) {
    const env: Record<string, string | undefined> = {};
    for (const [name, value] of Object.entries(process.env)) {
      if (/^(VITEST|CLAUDE|AI_AGENT|CI$|DYELOT_|OPENROUTER_)/.test(name)) continue;
      env[name] = value;
    }
    return spawnSync(process.execPath, [VITEST, "run", LIVE_FILE], {
      cwd: ROOT,
      env: { ...env, ...extra } as NodeJS.ProcessEnv,
      encoding: "utf8",
      timeout: 120_000,
    });
  }

  it("C-SMOKE-02 skips the live file unless DYELOT_LIVE_SMOKE=1", () => {
    const result = runLive({});
    expect(result.status).toBe(0);
    expect(`${result.stdout}${result.stderr}`).toMatch(/skipped/);
    expect(`${result.stdout}${result.stderr}`).not.toMatch(/passed/);
  });

  it("C-SMOKE-02 fails the live file at once when DYELOT_LIVE_SMOKE and CI are both set", () => {
    const result = runLive({ DYELOT_LIVE_SMOKE: "1", CI: "true" });
    const output = `${result.stdout}${result.stderr}`;
    expect(result.status).not.toBe(0);
    // The refusal's own message: the test titles say "CI" too, so /CI/ alone could not fail.
    expect(output).toContain("the live smoke must not run when CI is set");
    // It comes before any read of the environment, so the scrubbed one is never reported.
    expect(output).not.toContain("the environment is invalid");
  });
});
