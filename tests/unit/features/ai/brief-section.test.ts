import { afterEach, describe, expect, it, vi } from "vitest";
import * as ai from "@/ai";
import { createAiActivity } from "@/features/ai/activity";
import { readBrief } from "@/features/ai/BriefSection";
import { freshParams } from "@/features/studio/params";
import type { StudioStore } from "@/features/studio/store";
import { BRIEF_OUT } from "../../ai/fixtures";

// The brief's work (docs/specs/04-ai.md, 13.1, R4-37 and I-M4-03, all or nothing): it builds every
// line it will show before it commits the change, so a failure while building leaves the design
// as it was (controller ruling on Task 4.10a's review, Minor 3). The on-device model answers in the
// model's path; a shared route that cannot be reached sends the word list's path.

const BRIEF = "calm tea house at dusk";

/** A store whose `applyAi` records its changes. */
function fakeStore() {
  const applyAi = vi.fn(() => true);
  const store = { getState: () => ({ params: freshParams(), applyAi }) } as unknown as StudioStore;
  return { store, applyAi };
}

/** The AI core with a `madeWith` that throws, as a defect in building a line would. */
const breaking = {
  ...ai,
  madeWith: () => {
    throw new Error("madeWith broke");
  },
} as typeof ai;

/** A `LanguageModel` that is available and answers `BRIEF_OUT`. */
const model = {
  availability: async () => "available",
  create: async () => ({ prompt: async () => JSON.stringify(BRIEF_OUT), destroy: () => {} }),
};

function onDevice() {
  vi.stubGlobal("LanguageModel", model);
  const activity = createAiActivity();
  activity.getState().setOnDevice(true);
  return activity;
}

function wordList() {
  vi.stubGlobal("LanguageModel", undefined);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }),
  );
  return createAiActivity();
}

const run = (core: typeof ai, store: StudioStore, activity = createAiActivity()) =>
  readBrief(core, { store, activity, text: BRIEF, signal: new AbortController().signal });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("13.1 readBrief builds its lines before it commits", () => {
  it("13.1 commits a model's brief once, with its line", async () => {
    const { store, applyAi } = fakeStore();
    expect(await run(ai, store, onDevice())).toEqual({
      failures: [],
      result: "Made with Chrome's built-in model.",
    });
    expect(applyAi).toHaveBeenCalledTimes(1);
    expect(applyAi).toHaveBeenCalledWith(expect.objectContaining({ createdWith: "on-device" }));
  });

  it("13.1 commits nothing when a model's line cannot be built", async () => {
    const { store, applyAi } = fakeStore();
    await expect(run(breaking, store, onDevice())).rejects.toThrow("madeWith broke");
    expect(applyAi).not.toHaveBeenCalled();
  });

  it("13.1 commits the word list's brief once, with its lines", async () => {
    const { store, applyAi } = fakeStore();
    const lines = await run(ai, store, wordList());
    expect(lines.failures).toEqual([
      "The shared quota could not be reached, so dyelot used the word list.",
    ]);
    expect(lines.result).toMatch(/^Made with the word list \(no model\)\. Matched: /);
    expect(applyAi).toHaveBeenCalledTimes(1);
    expect(applyAi).toHaveBeenCalledWith(expect.objectContaining({ createdWith: "lexicon" }));
  });

  it("13.1 commits nothing when the word list's line cannot be built", async () => {
    const { store, applyAi } = fakeStore();
    await expect(run(breaking, store, wordList())).rejects.toThrow("madeWith broke");
    expect(applyAi).not.toHaveBeenCalled();
  });
});
