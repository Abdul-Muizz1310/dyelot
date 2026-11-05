// The live smoke of docs/specs/04-ai.md, R4-61: run it on purpose, never from a gate. It runs the live
// test through Vitest (which resolves `@/` and `?raw`) with the shell's variables and
// DYELOT_LIVE_SMOKE=1, and refuses at once when CI is set. It prints no secret.
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

if ((process.env.CI ?? "") !== "") {
  console.error(
    "ai-smoke: refusing to run when CI is set; the smoke spends the owner's free calls.",
  );
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [
    path.join(ROOT, "node_modules/vitest/vitest.mjs"),
    "run",
    "tests/unit/scripts/ai-smoke.live.test.ts",
  ],
  { cwd: ROOT, env: { ...process.env, DYELOT_LIVE_SMOKE: "1" }, stdio: "inherit" },
);
process.exit(result.status ?? 1);
