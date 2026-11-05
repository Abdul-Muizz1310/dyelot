import { afterEach, describe, expect, it, vi } from "vitest";

// R4-04 of docs/specs/04-ai.md (the ruling behind C-GUARD4-03, section 14.10): app code reaches @/ai
// only through one import(), memoized per page and forgotten when it fails, as @/export is loaded
// (R3-38). F-BRIEF-13 checks the same in the browser; no other C- case names loadAi.

afterEach(() => {
  vi.doUnmock("@/ai");
  vi.resetModules();
});

describe("C-GUARD4-03 loadAi reaches @/ai through one memoized import()", () => {
  it("C-GUARD4-03 loadAi gives the @/ai entry and the same promise on each call", async () => {
    const { loadAi } = await import("@/features/ai/load");
    const first = loadAi();
    expect(loadAi()).toBe(first);
    const module = await first;
    expect(module.AI_FEATURES).toEqual(["brief", "refine", "vibe", "rationale", "critique"]);
  });

  it("C-GUARD4-03 loadAi forgets a failed load, so the next call tries again", async () => {
    vi.doMock("@/ai", () => {
      throw new Error("chunk failed");
    });
    const { loadAi } = await import("@/features/ai/load");
    await expect(loadAi()).rejects.toThrow();
    vi.doUnmock("@/ai");
    vi.resetModules();
    const module = await loadAi();
    expect(typeof module.parseOutput).toBe("function");
  });
});
