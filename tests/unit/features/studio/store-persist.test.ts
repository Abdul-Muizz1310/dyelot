import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { choosePairing } from "@/engine";
import { DRAFT_KEY, readDraft, writeDraft } from "@/features/studio/drafts";
import { paramsOfSpec, resolveParams } from "@/features/studio/params";
import { bindStudioWindow } from "@/features/studio/store";
import { readHash, writeHash } from "@/features/studio/url";
import { encodeSpec } from "@/spec";
import { lastPosted, makeStore } from "./store-support";
import {
  FRESH_PARAMS,
  fakeLocation,
  freshSpec,
  generate,
  memoryStorage,
  seedSequence,
  throwingStorage,
} from "./support";

// Cases are C-HASH-11 to C-HASH-17, C-DRAFT-04 (the store's status), C-DRAFT-10, C-DRAFT-11 and
// C-DRAFT-13 of docs/specs/02-studio.md, section 6.7 (Review Focus 1 and 2, R2-14): the link in
// the hash and the draft follow each commit, 300 ms later, and the first load picks between them.

const DEBOUNCE_MS = 300;

/** A real spec other than FRESH's, for links and drafts. */
const roundSpec = () => generate({ ...FRESH_PARAMS, radius: "round", pairing: "funnel" }, "seed-7");

/** A draft as the store writes it, for the spec and params given. */
function draftOf(
  spec = roundSpec(),
  params: unknown = paramsOfSpec(spec).params,
  preset: string | null = "bento",
) {
  return memoryStorage({
    [DRAFT_KEY]: JSON.stringify({ v: 1, link: encodeSpec(spec), params, preset }),
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

describe("the hash after a commit", () => {
  it("C-HASH-11 ten commits within 300 ms write the hash once, after the debounce, for the newest spec", () => {
    const { store, stub, history, location, clock } = makeStore();
    for (let i = 0; i < 10; i++) {
      store.getState().regenerate();
      stub.reply(lastPosted(stub).id);
      clock.advance(25);
      vi.advanceTimersByTime(25);
    }
    expect(history.replaceState).not.toHaveBeenCalled();
    vi.advanceTimersByTime(DEBOUNCE_MS - 25);
    expect(history.replaceState).toHaveBeenCalledOnce();
    const { spec } = store.getState();
    expect(history.replaceState).toHaveBeenCalledWith(null, "", writeHash(spec));
    expect(readHash(location.hash)).toEqual({ kind: "spec", spec });
  });

  it("C-HASH-12 uses replaceState, never pushState: the browser history does not grow", () => {
    const pushState = vi.spyOn(window.history, "pushState");
    const length = window.history.length;
    const { store, stub } = makeStore({ location: window.location, history: window.history });
    for (let i = 0; i < 3; i++) {
      store.getState().regenerate();
      stub.reply(lastPosted(stub).id);
      vi.advanceTimersByTime(DEBOUNCE_MS);
    }
    store.getState().undo();
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(pushState).not.toHaveBeenCalled();
    expect(window.history.length).toBe(length);
    expect(readHash(window.location.hash)).toEqual({ kind: "spec", spec: store.getState().spec });
  });

  it("writes the hash and the draft after undo and redo too", () => {
    const { store, stub, location, storage } = makeStore();
    store.getState().setParams({ radius: "round" });
    stub.reply(1);
    vi.advanceTimersByTime(DEBOUNCE_MS);
    store.getState().undo();
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(readHash(location.hash)).toEqual({ kind: "spec", spec: freshSpec() });
    expect(readDraft(storage)?.spec).toEqual(freshSpec());
    store.getState().redo();
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(readHash(location.hash)).toEqual({ kind: "spec", spec: store.getState().spec });
  });

  it("C-HASH-15 swallows a replaceState that throws, and goes on", () => {
    const { location, history } = fakeLocation();
    history.replaceState.mockImplementation(() => {
      throw new DOMException("sandboxed", "SecurityError");
    });
    const { store, stub, storage } = makeStore({ location, history });
    store.getState().setParams({ radius: "round" });
    stub.reply(1);
    expect(() => vi.advanceTimersByTime(DEBOUNCE_MS)).not.toThrow();
    expect(history.replaceState).toHaveBeenCalledOnce();
    expect(readDraft(storage)?.spec).toEqual(store.getState().spec);
    store.getState().setParams({ radius: "sharp" });
    stub.reply(2);
    expect(store.getState().params.radius).toBe("sharp");
    store.getState().startFresh();
    expect(store.getState().preset).toBe("default");
  });
});

describe("bindStudioWindow", () => {
  it("C-HASH-13 flushes a pending write at once on pagehide", () => {
    const { store, stub, history } = makeStore();
    const unbind = bindStudioWindow(store, window);
    store.getState().setParams({ radius: "round" });
    stub.reply(1);
    window.dispatchEvent(new Event("pagehide"));
    expect(history.replaceState).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(history.replaceState).toHaveBeenCalledOnce();
    unbind();
  });

  it("C-HASH-13 flushes on visibilitychange to hidden, and not to visible", () => {
    const { store, stub, history } = makeStore();
    const unbind = bindStudioWindow(store, window);
    store.getState().setParams({ radius: "round" });
    stub.reply(1);
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(history.replaceState).not.toHaveBeenCalled();
    visibility.mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(history.replaceState).toHaveBeenCalledOnce();
    unbind();
  });

  it("C-HASH-14 a hashchange to a valid link loads it and pushes the previous design onto history", () => {
    const { store } = makeStore();
    const unbind = bindStudioWindow(store, window);
    window.history.replaceState(null, "", writeHash(roundSpec()));
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    expect(store.getState().spec).toEqual(roundSpec());
    expect(store.getState().history).toHaveLength(1);
    expect(store.getState().history[0]?.spec).toEqual(freshSpec());
    unbind();
  });

  it("C-HASH-14 a hashchange to an invalid link sets the notice and keeps the spec", () => {
    const { store } = makeStore();
    const unbind = bindStudioWindow(store, window);
    window.history.replaceState(null, "", "#s=AAAA");
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    expect(store.getState().spec).toEqual(freshSpec());
    expect(store.getState().status.notice).toEqual({
      kind: "link",
      reason: "corrupt",
      fallback: "current",
    });
    unbind();
  });

  it("unbinds every listener", () => {
    const { store, stub, history } = makeStore();
    bindStudioWindow(store, window)();
    store.getState().setParams({ radius: "round" });
    stub.reply(1);
    window.dispatchEvent(new Event("pagehide"));
    window.history.replaceState(null, "", "#s=AAAA");
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    expect(history.replaceState).not.toHaveBeenCalled();
    expect(store.getState().status.notice).toBeNull();
  });
});

describe("the first load (R2-14 item 2)", () => {
  it("C-HASH-16 a valid hash beats a draft: paramsOfSpec, preset null", () => {
    const { location } = fakeLocation(writeHash(roundSpec()));
    const { store } = makeStore({
      location,
      storage: draftOf(freshSpec(), FRESH_PARAMS, "default"),
    });
    const state = store.getState();
    expect(state.spec).toEqual(roundSpec());
    expect(state.params).toEqual(paramsOfSpec(roundSpec()).params);
    expect(state.seed).toBe("seed-7");
    expect(state.preset).toBeNull();
    expect(state.status.notice).toBeNull();
  });

  it("C-HASH-16 a draft whose specId equals the hash's supplies params, seed and preset", () => {
    const spec = generate({ ...FRESH_PARAMS, pairing: "young-onest" }, "seed-1");
    expect(choosePairing("seed-1")).toBe("young-onest");
    const explicit = { ...FRESH_PARAMS, pairing: "young-onest" };
    const { location } = fakeLocation(writeHash(spec));
    const { store } = makeStore({ location, storage: draftOf(spec, explicit, "m3-expressive") });
    const state = store.getState();
    expect(state.params).toEqual(explicit);
    expect(state.preset).toBe("m3-expressive");
    expect(paramsOfSpec(spec).params).toEqual(FRESH_PARAMS);
  });

  it("C-HASH-16 a draft beats a fresh design, and says so", () => {
    const newSeed = seedSequence();
    const { store } = makeStore({ storage: draftOf(), newSeed });
    expect(store.getState().spec).toEqual(roundSpec());
    expect(store.getState().preset).toBe("bento");
    expect(store.getState().status.notice).toEqual({ kind: "draft-restored" });
    expect(newSeed).not.toHaveBeenCalled();
  });

  it("C-HASH-16 a bad hash with a draft opens the draft and the notice says so", () => {
    const { location } = fakeLocation("#s=AAAA");
    const { store } = makeStore({ location, storage: draftOf() });
    expect(store.getState().spec).toEqual(roundSpec());
    expect(store.getState().status.notice).toEqual({
      kind: "link",
      reason: "corrupt",
      fallback: "draft",
    });
  });

  it("C-HASH-16 a bad hash without a draft opens a fresh design and the notice says so", () => {
    const { location } = fakeLocation("#s=");
    const { store } = makeStore({ location });
    expect(store.getState().spec).toEqual(freshSpec());
    expect(store.getState().preset).toBe("default");
    expect(store.getState().status.notice).toEqual({
      kind: "link",
      reason: "corrupt",
      fallback: "fresh",
    });
  });

  it("C-HASH-16 a hash with no link opens the draft or a fresh design with no banner", () => {
    const { location } = fakeLocation("#about");
    const { store } = makeStore({ location });
    expect(store.getState().spec).toEqual(freshSpec());
    expect(store.getState().status.notice).toBeNull();
  });

  it("C-HASH-17 a first load with a valid hash writes no draft until the first commit", () => {
    const { location } = fakeLocation(writeHash(roundSpec()));
    const { store, stub, storage } = makeStore({ location });
    vi.advanceTimersByTime(DEBOUNCE_MS * 10);
    expect(storage.setItem).not.toHaveBeenCalled();
    store.getState().setParams({ chroma: "vivid" });
    stub.reply(1);
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(storage.setItem).toHaveBeenCalledOnce();
  });

  it.each([
    ["a ratio of 9", { type: { context: "product", ratio: 9 } }],
    ["an unknown pairing id", { pairing: "comic-sans" }],
    ["a field that disagrees with the spec", { radius: "sharp" }],
  ])("C-DRAFT-13 a matching draft with %s is not used: paramsOfSpec, preset null", (_, change) => {
    const spec = roundSpec();
    const params = { ...paramsOfSpec(spec).params, ...change };
    const { location } = fakeLocation(writeHash(spec));
    const { store } = makeStore({ location, storage: draftOf(spec, params, "bento") });
    const state = store.getState();
    expect(state.params).toEqual(paramsOfSpec(spec).params);
    expect(state.preset).toBeNull();
    expect(generate(resolveParams(state.params, state.seed), state.seed)).toEqual(state.spec);
  });

  it("a draft restore whose params fail falls back to paramsOfSpec and drops the preset", () => {
    const spec = roundSpec();
    const { store } = makeStore({ storage: draftOf(spec, { ...FRESH_PARAMS, chroma: "loud" }) });
    expect(store.getState().params).toEqual(paramsOfSpec(spec).params);
    expect(store.getState().preset).toBeNull();
  });
});

describe("drafts from the store (RF2)", () => {
  it("C-DRAFT-11 writes the draft after the hash's debounce, once per burst", () => {
    const { store, stub, storage, clock } = makeStore();
    for (let i = 0; i < 5; i++) {
      store.getState().regenerate();
      stub.reply(lastPosted(stub).id);
      clock.advance(50);
      vi.advanceTimersByTime(50);
    }
    expect(storage.setItem).not.toHaveBeenCalled();
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(storage.setItem).toHaveBeenCalledOnce();
    // The stub's fake specs do not regenerate from their params, so read the stored value as JSON.
    const state = store.getState();
    expect(JSON.parse(storage.items.get(DRAFT_KEY) ?? "")).toEqual({
      v: 1,
      link: encodeSpec(state.spec),
      params: state.params,
      preset: state.preset,
    });
  });

  it("C-DRAFT-04 a QuotaExceededError sets status.draft off; a later write sets it on", () => {
    const { store, stub, storage } = makeStore();
    storage.setItem.mockImplementationOnce(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    store.getState().setParams({ radius: "round" });
    stub.reply(1);
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(store.getState().status.draft).toBe("off");
    store.getState().setParams({ radius: "sharp" });
    stub.reply(2);
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(store.getState().status.draft).toBe("on");
  });

  it("C-DRAFT-10 with a storage whose every method throws, the studio still works and drafts are off", () => {
    const storage = throwingStorage();
    const { store, stub, location } = makeStore({ storage });
    store.getState().setParams({ radius: "round" });
    stub.reply(1);
    store.getState().regenerate();
    stub.reply(2);
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(store.getState().status.draft).toBe("off");
    expect(readHash(location.hash)).toEqual({ kind: "spec", spec: store.getState().spec });
    store.getState().undo();
    expect(store.getState().params.radius).toBe("round");
    store.getState().redo();
    expect(store.getState().history).toHaveLength(2);
    store.getState().startFresh();
    stub.reply(3);
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(store.getState().preset).toBe("default");
    expect(storage.getItem).toHaveBeenCalled();
  });

  it("dispose saves a pending draft but leaves the URL alone", () => {
    const { store, stub, storage, history } = makeStore();
    store.getState().setParams({ radius: "round" });
    stub.reply(1);
    store.getState().dispose();
    expect(readDraft(storage)?.spec).toEqual(store.getState().spec);
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(history.replaceState).not.toHaveBeenCalled();
  });

  it("flush with nothing pending writes nothing", () => {
    const { store, storage, history } = makeStore();
    store.getState().flush();
    expect(history.replaceState).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(writeDraft(null, { ...store.getState() })).toEqual({ ok: false });
  });
});
