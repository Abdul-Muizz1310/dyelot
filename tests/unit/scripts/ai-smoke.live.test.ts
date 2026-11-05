import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { briefInput, buildChatRequest, readReply, vibeInput } from "@/ai";
import { imagePalette } from "@/engine";
import { readAiEnv } from "@/server/ai/env";
import { readGuard } from "@/server/ai/guard";
import { planSmoke, smokeAllowed } from "@/server/ai/smoke";
import { sendChat } from "@/server/ai/transport";
import { FOUR_COLORS } from "../engine/image/support";

// The live smoke of docs/specs/04-ai.md, R4-61. It is run on purpose by `node scripts/ai-smoke.mjs`
// (DYELOT_LIVE_SMOKE=1 and the shell's variables) and never by a gate: it is skipped unless
// DYELOT_LIVE_SMOKE is 1, and it fails before any request when CI is set too. It prints each slug's
// kind, validity, failure kind and duration, never the key.

const SET = process.env.DYELOT_LIVE_SMOKE !== undefined;
const LIVE = process.env.DYELOT_LIVE_SMOKE === "1";
const REFERER = "https://dyelot.vercel.app";
const CALL_TIMEOUT_MS = 20_000;
const KEY_TIMEOUT_MS = 5_000;
const JPEG = path.resolve(import.meta.dirname, "../../fixtures/ai/smoke-16.jpg");

/** No CI run reaches OpenRouter: the refusal comes before any read of the environment. */
function refuseInCi(): void {
  if ((process.env.CI ?? "") !== "") {
    throw new Error("the live smoke must not run when CI is set: it spends the owner's free calls");
  }
}

describe("C-SMOKE-02 the live smoke", () => {
  it.skipIf(!SET)("C-SMOKE-02 refuses to run when CI is set", () => {
    refuseInCi();
  });

  it.skipIf(!LIVE)(
    "C-SMOKE-02 calls each planned slug once and prints its validity",
    async () => {
      refuseInCi();
      const read = readAiEnv(process.env);
      if (!read.ok) throw new Error(`the environment is invalid at ${read.variable}`);
      const { env } = read;
      const plan = planSmoke(env);
      expect(plan.length, "no slug is configured").toBeGreaterThan(0);

      const remaining = await readGuard({
        fetch,
        baseUrl: env.baseUrl,
        apiKey: env.apiKey,
        timeoutMs: KEY_TIMEOUT_MS,
      });
      console.log(`smoke: ${plan.length} calls planned, remaining ${remaining ?? "unread"}`);
      expect(
        smokeAllowed(remaining, env.reserve, plan.length),
        "the free pool is below the reserve + 3 + the planned calls",
      ).toBe(true);

      const text = briefInput("a calm tea house at dusk", {});
      const dataUrl = `data:image/jpeg;base64,${readFileSync(JPEG).toString("base64")}`;
      const vibe = vibeInput(imagePalette(FOUR_COLORS), { dataUrl, width: 16, height: 16 });

      const failed: string[] = [];
      for (const { slug, kind } of plan) {
        const started = Date.now();
        let verdict: string;
        try {
          const request =
            kind === "image"
              ? buildChatRequest({
                  feature: "vibe",
                  input: vibe,
                  slug,
                  baseUrl: env.baseUrl,
                  apiKey: env.apiKey,
                  referer: REFERER,
                })
              : buildChatRequest({
                  feature: "brief",
                  input: text,
                  slug,
                  baseUrl: env.baseUrl,
                  apiKey: env.apiKey,
                  referer: REFERER,
                });
          const response = await sendChat(request, { fetch, timeoutMs: CALL_TIMEOUT_MS });
          const outcome =
            kind === "image"
              ? readReply("vibe", vibe, response)
              : readReply("brief", text, response);
          verdict = outcome.ok ? "valid" : outcome.kind;
        } catch {
          verdict = "error";
        }
        console.log(`${slug} ${kind} ${verdict} ${Date.now() - started} ms`);
        if (verdict !== "valid") failed.push(slug);
      }
      expect(failed, "slugs whose call was not valid").toEqual([]);
    },
    smokeBudget(),
  );
});

/** The whole run's budget: the key read and at most 6 calls of 20 s. */
function smokeBudget(): number {
  return KEY_TIMEOUT_MS + 6 * CALL_TIMEOUT_MS + 10_000;
}
