import { describe, expect, it, vi } from "vitest";
import type { AiPath, ProviderFailure } from "@/ai";
import { type ProviderStep, runProviders } from "@/features/ai/router";
import { TEXT_SLUGS } from "../../ai/fixtures";

// C-ROUTER-01 of docs/specs/04-ai.md, section 14.9 (R4-06, R4-30, R4-56): runProviders tries the
// steps in R4-30's order and stops at the first that answers, keeps every failure in order, falls
// to the rules when all fail, and stops at once on a cancel, running nothing after it.

type Output = { readonly name: string };
type Result = Awaited<ReturnType<ProviderStep<Output>["run"]>>;

const ON_DEVICE_DOWN: ProviderFailure = { provider: "on-device", reason: "not-downloaded" };
const KEY_REFUSED: ProviderFailure = { provider: "visitor-key", reason: "refused" };
const SHARED_CAP: ProviderFailure = { provider: "shared", reason: "visitor-cap" };
const KEY_PATH: AiPath = { provider: "visitor-key", slug: TEXT_SLUGS[0], attempts: 2 };
const SHARED_PATH: AiPath = { provider: "shared", slug: TEXT_SLUGS[1], tier: "fast", attempts: 2 };

/** A step that answers `result` and records that it ran, and with which signal. */
function step(
  provider: ProviderStep<Output>["provider"],
  result: Result | (() => Promise<Result>),
) {
  const run = vi.fn(async (_signal: AbortSignal) =>
    typeof result === "function" ? result() : result,
  );
  return { provider, run } satisfies ProviderStep<Output>;
}
const fails = (failure: ProviderFailure): Result => ({ ok: false, failure });
const answers = (path: AiPath, name = "Dusk Tea"): Result => ({ ok: true, output: { name }, path });

describe("C-ROUTER-01 runProviders", () => {
  it("C-ROUTER-01 runs the steps in order and stops at the first that answers", async () => {
    const onDevice = step("on-device", fails(ON_DEVICE_DOWN));
    const key = step("visitor-key", answers(KEY_PATH));
    const shared = step("shared", answers(SHARED_PATH, "Other"));
    const action = new AbortController();
    const result = await runProviders([onDevice, key, shared], action.signal);
    expect(result).toEqual({
      kind: "model",
      output: { name: "Dusk Tea" },
      path: KEY_PATH,
      failures: [ON_DEVICE_DOWN],
    });
    expect(onDevice.run).toHaveBeenCalledWith(action.signal);
    expect(key.run).toHaveBeenCalledWith(action.signal);
    expect(shared.run).not.toHaveBeenCalled();
    expect(onDevice.run.mock.invocationCallOrder[0]).toBeLessThan(
      key.run.mock.invocationCallOrder[0] as number,
    );
  });

  it("C-ROUTER-01 answers with the first step and no failure when it succeeds", async () => {
    const shared = step("shared", answers(SHARED_PATH));
    expect(await runProviders([shared], new AbortController().signal)).toEqual({
      kind: "model",
      output: { name: "Dusk Tea" },
      path: SHARED_PATH,
      failures: [],
    });
  });

  it("C-ROUTER-01 collects the failures in order and gives rules when every step fails", async () => {
    const steps = [
      step("on-device", fails(ON_DEVICE_DOWN)),
      step("visitor-key", fails(KEY_REFUSED)),
      step("shared", fails(SHARED_CAP)),
    ];
    expect(await runProviders(steps, new AbortController().signal)).toEqual({
      kind: "rules",
      failures: [ON_DEVICE_DOWN, KEY_REFUSED, SHARED_CAP],
    });
    for (const each of steps) expect(each.run).toHaveBeenCalledTimes(1);
  });

  it("C-ROUTER-01 gives rules with no failure when there is no step", async () => {
    expect(await runProviders([], new AbortController().signal)).toEqual({
      kind: "rules",
      failures: [],
    });
  });

  it("C-ROUTER-01 gives canceled and runs no step for an action canceled before it starts", async () => {
    const action = new AbortController();
    action.abort();
    const shared = step("shared", answers(SHARED_PATH));
    expect(await runProviders([shared], action.signal)).toEqual({ kind: "canceled" });
    expect(shared.run).not.toHaveBeenCalled();
  });

  it("C-ROUTER-01 gives canceled and runs no later step for a cancel during a step that then fails", async () => {
    const action = new AbortController();
    const key = step("visitor-key", async () => {
      action.abort();
      return fails(KEY_REFUSED);
    });
    const shared = step("shared", answers(SHARED_PATH));
    expect(await runProviders([key, shared], action.signal)).toEqual({ kind: "canceled" });
    expect(shared.run).not.toHaveBeenCalled();
  });

  it("C-ROUTER-01 gives canceled for a cancel during a step that then answers", async () => {
    const action = new AbortController();
    const shared = step("shared", async () => {
      action.abort();
      return answers(SHARED_PATH);
    });
    expect(await runProviders([shared], action.signal)).toEqual({ kind: "canceled" });
  });

  it("C-ROUTER-01 stops at once on a cancel, without waiting for a step that never ends", async () => {
    const action = new AbortController();
    const key = step("visitor-key", () => new Promise<Result>(() => {}));
    const shared = step("shared", answers(SHARED_PATH));
    const pending = runProviders([key, shared], action.signal);
    await Promise.resolve();
    expect(key.run).toHaveBeenCalledTimes(1);
    action.abort();
    expect(await pending).toEqual({ kind: "canceled" });
    expect(shared.run).not.toHaveBeenCalled();
  });

  it("C-ROUTER-01 lets a step that throws reject, unless the action was canceled", async () => {
    const broken = step("shared", async () => {
      throw new RangeError("askShared: input is not a brief input");
    });
    await expect(runProviders([broken], new AbortController().signal)).rejects.toThrow(
      /^askShared: input is not a brief input/,
    );
    const action = new AbortController();
    const aborting = step("shared", async () => {
      action.abort();
      throw new DOMException("", "AbortError");
    });
    expect(await runProviders([aborting], action.signal)).toEqual({ kind: "canceled" });
  });

  it.each([
    ["out of R4-30's order", ["shared", "visitor-key"]],
    ["twice", ["visitor-key", "visitor-key"]],
    ["the rules, which are not a step", ["rules"]],
  ])("C-ROUTER-01 refuses with RangeError naming runProviders steps %s", async (_, providers) => {
    const steps = providers.map((provider) =>
      step(provider as ProviderStep<Output>["provider"], answers(SHARED_PATH)),
    );
    await expect(runProviders(steps, new AbortController().signal)).rejects.toThrow(RangeError);
    await expect(runProviders(steps, new AbortController().signal)).rejects.toThrow(
      /^runProviders: steps\[1\]|^runProviders: steps\[0\]/,
    );
    for (const each of steps) expect(each.run).not.toHaveBeenCalled();
  });

  it("C-ROUTER-01 refuses a step whose answer names another provider, so no sentence can be wrong", async () => {
    const key = step("visitor-key", fails(SHARED_CAP));
    await expect(runProviders([key], new AbortController().signal)).rejects.toThrow(
      /^runProviders: steps\[0\] \("visitor-key"\) failed as "shared"/,
    );
    const onDevice = step("on-device", answers(SHARED_PATH));
    await expect(runProviders([onDevice], new AbortController().signal)).rejects.toThrow(
      /^runProviders: steps\[0\] \("on-device"\) answered as "shared"/,
    );
    const shared = step("shared", { ok: false, failure: null } as unknown as Result);
    await expect(runProviders([shared], new AbortController().signal)).rejects.toThrow(
      /^runProviders: steps\[0\] \("shared"\) failed as null/,
    );
  });

  it("C-ROUTER-01 throws TypeError naming runProviders for arguments of the wrong type", async () => {
    const wrong = (value: unknown) => value as never;
    const signal = new AbortController().signal;
    await expect(runProviders(wrong(null), signal)).rejects.toThrow(
      /^runProviders: steps must be an array/,
    );
    await expect(runProviders([wrong({ provider: "shared" })], signal)).rejects.toThrow(
      /^runProviders: steps\[0\]\.run must be a function/,
    );
    await expect(runProviders([wrong(null)], signal)).rejects.toThrow(
      /^runProviders: steps\[0\] must be an object/,
    );
    await expect(runProviders([], wrong("stop"))).rejects.toThrow(
      /^runProviders: signal must be an AbortSignal/,
    );
    const odd = step("shared", async () => wrong({ ok: "yes" }));
    await expect(runProviders([odd], signal)).rejects.toThrow(TypeError);
  });
});
