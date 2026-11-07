import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyPreset, type DirectionParams, normalizeSeed, parseColor } from "@/engine";
import { DRAFT_KEY, readDraft } from "@/features/studio/drafts";
import { freshParams, paramsOfSpec, resolveParams } from "@/features/studio/params";
import { writeHash } from "@/features/studio/url";
import { DEFAULT_VIEW, presetView } from "@/features/studio/view";
import { type DesignSpec, encodeSpec, normalizeSpec, specId } from "@/spec";
import { MADDER, TURQUOISE } from "../../support/gallery";
import { makeStore } from "./store-support";
import { FRESH_PARAMS, fakeLocation, freshSpec, generate, memoryStorage } from "./support";

// Cases are C-STORE6-01 to C-STORE6-06 and C-STORE6-09 of docs/specs/06-gallery.md, section 14
// (R6-24 to R6-26, 10.2, 10.3): an entry hash outranks the draft on the first load and counts as
// the first commit, a malformed one opens a fresh design with the link notice, and a loaded design
// opens with its preset's view.

const DEBOUNCE_MS = 300;

/** The seed `#color=f66c6d` locks: `normalizeSeed(parseColor("#f66c6d"))`. */
const MADDER_SEED = normalizeSeed(parseColor("#f66c6d"));

/** A real design other than FRESH's, for the drafts an entry must not use. */
const roundSpec = () => generate({ ...FRESH_PARAMS, radius: "round", pairing: "funnel" }, "seed-7");

/** A storage holding the draft the store would write for `spec`, `params` and `preset`. */
function draftOf(spec: DesignSpec, params: DirectionParams, preset: string | null) {
  return memoryStorage({
    [DRAFT_KEY]: JSON.stringify({ v: 1, link: encodeSpec(spec), params, preset }),
  });
}

/** A draft of `roundSpec`, as M2's tests write one. */
const roundDraft = () => draftOf(roundSpec(), paramsOfSpec(roundSpec()).params, "bento");

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("an entry on the first load (R6-24)", () => {
  it("C-STORE6-01 #color= opens a fresh design with the primary locked, over the draft, and persists it", () => {
    const { location, history } = fakeLocation("#color=f66c6d");
    const storage = roundDraft();
    const { store, stub } = makeStore({ location, history, storage });
    const params = { ...freshParams(), primary: MADDER_SEED };
    const state = store.getState();
    expect(state.params).toEqual(params);
    expect(state.seed).toBe("seed-1");
    expect(state.spec).toEqual(normalizeSpec(generate(resolveParams(params, "seed-1"), "seed-1")));
    expect(state.preset).toBe("default");
    expect(state.provenance).toBe("generated");
    expect(state.createdWith).toBe("controls");
    expect(state.status.notice).toBeNull();
    expect(state.entry).toBeNull();
    expect(state.history).toEqual([]);
    expect(state.view).toEqual(DEFAULT_VIEW);
    expect(stub.posted).toEqual([]);
    vi.advanceTimersByTime(DEBOUNCE_MS - 1);
    expect(history.replaceState).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(history.replaceState).toHaveBeenCalledOnce();
    expect(history.replaceState).toHaveBeenCalledWith(null, "", writeHash(state.spec));
    expect(readDraft(storage)?.spec).toEqual(state.spec);
    expect(readDraft(storage)?.preset).toBe("default");
  });

  it("C-STORE6-02 #brief= opens a fresh design, holds the brief until takeEntry, runs nothing and persists it", () => {
    const { location, history } = fakeLocation("#brief=A%20tea%20house");
    const { store, stub, storage } = makeStore({ location, history });
    const state = store.getState();
    expect(state.spec).toEqual(freshSpec());
    expect(state.params).toEqual(FRESH_PARAMS);
    expect(state.preset).toBe("default");
    expect(state.status.notice).toBeNull();
    expect(state.entry).toEqual({ kind: "brief", text: "A tea house" });
    expect(store.getState().takeEntry()).toEqual({ kind: "brief", text: "A tea house" });
    expect(store.getState().entry).toBeNull();
    expect(store.getState().takeEntry()).toBeNull();
    expect(stub.posted).toEqual([]);
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(history.replaceState).toHaveBeenCalledOnce();
    expect(history.replaceState).toHaveBeenCalledWith(null, "", writeHash(freshSpec()));
    expect(readDraft(storage)?.spec).toEqual(freshSpec());
    expect(stub.posted).toEqual([]);
  });

  it("C-STORE6-03 #start=image opens a fresh design and gives the image entry once", () => {
    const { location, history } = fakeLocation("#start=image");
    const { store, stub } = makeStore({ location, history });
    expect(store.getState().spec).toEqual(freshSpec());
    expect(store.getState().status.notice).toBeNull();
    expect(store.getState().takeEntry()).toEqual({ kind: "image" });
    expect(store.getState().takeEntry()).toBeNull();
    expect(stub.posted).toEqual([]);
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(history.replaceState).toHaveBeenCalledWith(null, "", writeHash(freshSpec()));
  });

  it("C-STORE6-04 a malformed entry opens a fresh design with the link notice and persists nothing", () => {
    const { location, history } = fakeLocation("#color=zzz");
    const storage = roundDraft();
    const stored = storage.items.get(DRAFT_KEY);
    const { store, stub } = makeStore({ location, history, storage });
    const state = store.getState();
    expect(state.spec).toEqual(freshSpec());
    expect(state.preset).toBe("default");
    expect(state.status.notice).toEqual({ kind: "link", reason: "corrupt", fallback: "fresh" });
    expect(state.entry).toBeNull();
    vi.advanceTimersByTime(DEBOUNCE_MS * 10);
    expect(history.replaceState).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.items.get(DRAFT_KEY)).toBe(stored);
    expect(stub.posted).toEqual([]);
  });

  it("C-STORE6-05 loadFromHash of an entry form mid-session changes nothing", () => {
    const { store, stub, history } = makeStore();
    store.getState().setView({ mode: "dark" });
    store.getState().regenerate();
    stub.reply(1);
    vi.advanceTimersByTime(DEBOUNCE_MS);
    const before = store.getState();
    store.getState().loadFromHash("#color=f66c6d");
    const after = store.getState();
    expect(after.spec).toBe(before.spec);
    expect(after.status.notice).toBe(before.status.notice);
    expect(after.history).toBe(before.history);
    expect(after.view).toBe(before.view);
    expect(after.entry).toBeNull();
    expect(after.takeEntry()).toBeNull();
    expect(stub.posted).toHaveLength(1);
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(history.replaceState).toHaveBeenCalledOnce();
  });
});

describe("a loaded design's preset and view (R6-26)", () => {
  it("C-STORE6-06 a link takes presetOf(spec) and its view; a draft keeps its stored preset and takes its view", () => {
    const turquoise = makeStore({ location: fakeLocation(`#s=${TURQUOISE.link}`).location });
    expect(turquoise.store.getState().preset).toBe("dark-dev-tool");
    expect(turquoise.store.getState().view).toEqual(presetView(DEFAULT_VIEW, "dark-dev-tool"));
    expect(turquoise.store.getState().view).toMatchObject({ mode: "dark", density: "dense" });

    const madder = makeStore({ location: fakeLocation(`#s=${MADDER.link}`).location });
    expect(madder.store.getState().preset).toBeNull();
    expect(madder.store.getState().view).toEqual(DEFAULT_VIEW);

    const params = applyPreset(FRESH_PARAMS, "retro-futurism");
    const spec = generate(resolveParams(params, "seed-3"), "seed-3");
    const restored = makeStore({ storage: draftOf(spec, params, "retro-futurism") });
    const state = restored.store.getState();
    expect(state.spec).toEqual(spec);
    expect(state.params).toEqual(params);
    expect(state.preset).toBe("retro-futurism");
    expect(state.status.notice).toEqual({ kind: "draft-restored" });
    expect(state.view).toEqual({ ...DEFAULT_VIEW, mode: "dark", density: "comfortable" });
  });

  it("C-STORE6-09 a hashchange load takes the link's preset and keeps the visitor's view", () => {
    const { store } = makeStore();
    const view = store.getState().view;
    expect(view.mode).toBe("light");
    store.getState().loadFromHash(`#s=${TURQUOISE.link}`);
    expect(specId(store.getState().spec)).toBe(TURQUOISE.specId);
    expect(store.getState().preset).toBe("dark-dev-tool");
    expect(store.getState().view).toBe(view);
    expect(store.getState().view.mode).toBe("light");
  });
});
