import { afterEach, describe, expect, it, vi } from "vitest";
import * as ai from "@/ai";
import { type DirectionParams, generateSystem } from "@/engine";
import { createAiActivity } from "@/features/ai/activity";
import { refineDesign } from "@/features/ai/SteerSection";
import { freshParams, resolveParams } from "@/features/studio/params";
import type { StudioStore } from "@/features/studio/store";

// Refine without a model (docs/specs/04-ai.md, 13.4, R4-45; controller ruling on Task 4.10b's
// review): the chip words in the text apply as one commit; when chip words were found but every
// one is at the end of its range, nothing is committed (no history entry, `meta.createdWith`
// unchanged) and the line says so. The shared route cannot be reached here, so the rules answer.

const UNREACHED = "The shared quota could not be reached, so dyelot used the steer words.";
const AT_LIMIT = "Those words are already at their limit, so nothing changed.";
const NO_WORDS =
  "No steer words found, so nothing changed. Try warmer, cooler, bolder, quieter, softer, sharper or airier.";

/** A store holding `params` and its design, whose `applyAi` records its changes. */
function fakeStore(params: DirectionParams) {
  const applyAi = vi.fn(() => true);
  const spec = generateSystem(resolveParams(params, "70"), "70");
  const store = {
    getState: () => ({ params, spec, view: { density: "comfortable" }, applyAi }),
  } as unknown as StudioStore;
  return { store, applyAi };
}

/** An activity whose shared route cannot be reached, with no on-device model and no key. */
function rulesOnly() {
  vi.stubGlobal("LanguageModel", undefined);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }),
  );
  return createAiActivity();
}

const run = (store: StudioStore, text: string) =>
  refineDesign(ai, { store, activity: rulesOnly(), text, signal: new AbortController().signal });

/** A design at the end of the bolder and softer chips' ranges. */
const AT_ENDS: DirectionParams = {
  ...freshParams(),
  chroma: "vivid",
  radius: "round",
  depth: "layered",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("13.4 refine without a model", () => {
  it("13.4 commits nothing when every chip word is at its limit, and says so", async () => {
    const { store, applyAi } = fakeStore(AT_ENDS);
    expect(await run(store, "bolder and softer please")).toEqual({
      failures: [UNREACHED],
      result: AT_LIMIT,
    });
    expect(applyAi).not.toHaveBeenCalled();
  });

  it("13.4 lists and commits only the chip words that applied", async () => {
    const { store, applyAi } = fakeStore(AT_ENDS);
    expect(await run(store, "bolder and warmer")).toEqual({
      failures: [UNREACHED],
      result: "Made with the steer words (no model): warmer.",
    });
    expect(applyAi).toHaveBeenCalledTimes(1);
    expect(applyAi).toHaveBeenCalledWith(expect.objectContaining({ createdWith: "controls" }));
  });

  it("13.4 commits nothing when the text holds no chip word", async () => {
    const { store, applyAi } = fakeStore(AT_ENDS);
    expect(await run(store, "make it pop")).toEqual({ failures: [UNREACHED], result: NO_WORDS });
    expect(applyAi).not.toHaveBeenCalled();
  });
});
