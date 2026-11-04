import { describe, expect, it, vi } from "vitest";
import { generateSystem, lintSpec } from "@/engine";
import { paramsOfSpec } from "@/features/studio/params";
import { rebuildOutcome } from "@/features/studio/rebuild";
import { createStudioStore, type Studio } from "@/features/studio/store";
import { writeHash } from "@/features/studio/url";
import { specId } from "@/spec";
import { SPEC } from "../../export/golden-support";
import { ONE_FAIL } from "../../export/one-fail-support";
import { lastPosted, makeStore, stubClient } from "./store-support";
import { fakeLocation, memoryStorage } from "./support";

// C-STOR3-08 to 10 and C-REB-01 to 03 of docs/specs/03-export.md, section 10.11 (R3-33, R3-42).

const snapshotOf = (spec: typeof SPEC) => {
  const { params } = paramsOfSpec(spec);
  return { params, seed: spec.meta.seed, spec, preset: null, provenance: "loaded" as const };
};

/** A store that opens `spec` from a link, with a spy on the client's `generateNow`. */
function openLink(spec: typeof SPEC) {
  const stub = stubClient();
  const generateNow = vi.spyOn(stub.client, "generateNow");
  const { location, history } = fakeLocation(writeHash(spec));
  const made = makeStore({ stub, location, history });
  return { ...made, generateNow };
}

describe("rebuildOutcome", () => {
  it("C-REB-01 is passes when the parameters regenerate a design with no error", () => {
    expect(lintSpec(ONE_FAIL).filter((f) => f.severity === "error")).toHaveLength(1);
    expect(rebuildOutcome(snapshotOf(ONE_FAIL), generateSystem)).toBe("passes");
  });

  it("C-REB-02 is fails for a failing result and throws for a generator that throws", () => {
    expect(rebuildOutcome(snapshotOf(ONE_FAIL), () => ONE_FAIL)).toBe("fails");
    const forced = () => {
      throw new RangeError("forced");
    };
    expect(() => rebuildOutcome(snapshotOf(ONE_FAIL), forced)).not.toThrow();
    expect(rebuildOutcome(snapshotOf(ONE_FAIL), forced)).toBe("throws");
  });

  it("C-REB-03 throws TypeError naming rebuildOutcome for a bad snapshot or generate", () => {
    const good = snapshotOf(ONE_FAIL);
    const { params: _params, ...noParams } = good;
    const { seed: _seed, ...noSeed } = good;
    for (const bad of [null, "x", 3, noParams, noSeed]) {
      expect(() => rebuildOutcome(bad as never, generateSystem)).toThrow(TypeError);
      expect(() => rebuildOutcome(bad as never, generateSystem)).toThrow(/rebuildOutcome/);
    }
    for (const bad of [null, undefined, "f", {}]) {
      expect(() => rebuildOutcome(good, bad as never)).toThrow(TypeError);
      expect(() => rebuildOutcome(good, bad as never)).toThrow(/rebuildOutcome/);
    }
  });

  it("calls generate with the snapshot's params and seed", () => {
    const generate = vi.fn(() => SPEC);
    const good = snapshotOf(ONE_FAIL);
    rebuildOutcome(good, generate);
    expect(generate).toHaveBeenCalledExactlyOnceWith(good.params, good.seed);
  });
});

describe("provenance", () => {
  it("C-STOR3-08 marks generator replies generated and links and drafts loaded, through undo and redo", () => {
    const { store, stub, clock } = makeStore();
    expect(store.getState().provenance).toBe("generated");
    const step = (action: (s: Studio) => void) => {
      clock.advance(2_000);
      action(store.getState());
      stub.reply(lastPosted(stub).id);
    };
    step((s) => s.setParams({ radius: "sharp" }));
    step((s) => s.applyPreset("editorial"));
    step((s) => s.regenerate());
    step((s) => s.toggleLock("primary"));
    step((s) => s.rebuild());
    expect(store.getState().provenance).toBe("generated");
    expect(store.getState().history.every((h) => h.provenance === "generated")).toBe(true);

    // A link opens a loaded design.
    store.getState().loadFromHash(writeHash(ONE_FAIL));
    expect(store.getState().provenance).toBe("loaded");
    step((s) => s.setParams({ radius: "sharp" }));
    step((s) => s.setParams({ radius: "round" }));
    expect(store.getState().provenance).toBe("generated");
    store.getState().undo();
    expect(store.getState().provenance).toBe("generated");
    store.getState().undo();
    expect(store.getState().provenance).toBe("loaded");
    store.getState().redo();
    expect(store.getState().provenance).toBe("generated");
    store.getState().redo();
    expect(store.getState().provenance).toBe("generated");

    // The first load from a hash, and from a draft, is loaded.
    expect(openLink(ONE_FAIL).store.getState().provenance).toBe("loaded");
    const first = makeStore();
    first.store.getState().flush();
    first.clock.advance(1);
    first.store.getState().setParams({ radius: "sharp" });
    first.stub.reply(lastPosted(first.stub).id);
    first.store.getState().flush();
    const restored = createStudioStore({
      ...first.deps,
      client: stubClient().client,
      storage: first.storage,
      location: fakeLocation().location,
    });
    expect(restored.getState().provenance).toBe("loaded");
    // A fresh first load is the studio's own generation.
    expect(
      createStudioStore({
        ...first.deps,
        client: stubClient().client,
        storage: memoryStorage(),
        location: fakeLocation().location,
      }).getState().provenance,
    ).toBe("generated");
  });

  it("C-STOR3-09 rebuild issues one request from the held params and seed and commits as generated", () => {
    const { store, stub, generateNow } = openLink(ONE_FAIL);
    expect(specId(store.getState().spec)).toBe(specId(ONE_FAIL));
    const { params, seed } = store.getState();
    const before = stub.posted.length;
    store.getState().rebuild();
    expect(stub.posted).toHaveLength(before + 1);
    const request = lastPosted(stub);
    expect(request.seed).toBe(seed);
    expect(request.params).toEqual(params);
    stub.reply(request.id, SPEC);
    const state = store.getState();
    expect(specId(state.spec)).toBe(specId(SPEC));
    expect(state.provenance).toBe("generated");
    expect(state.history).toHaveLength(1);
    expect(specId(state.history[0]?.spec ?? SPEC)).toBe(specId(ONE_FAIL));
    store.getState().undo();
    expect(specId(store.getState().spec)).toBe(specId(ONE_FAIL));
    expect(store.getState().provenance).toBe("loaded");
    expect(generateNow.mock.calls.length).toBe(1);
  });
});

describe("the memoized outcome", () => {
  it("C-STOR3-10 classifies a held blocked design once, and again only for another design", () => {
    const { store, stub, generateNow } = openLink(ONE_FAIL);
    const { params, seed } = store.getState();
    expect(generateNow).toHaveBeenCalledTimes(1);
    expect(generateNow).toHaveBeenCalledWith(params, seed);
    expect(store.getState().outcome).toBe("passes");
    for (const mode of ["dark", "light", "dark"] as const) store.getState().setView({ mode });
    store.getState().dismissNotice();
    expect(generateNow).toHaveBeenCalledTimes(1);

    // Undo and redo to the same design hit the memo.
    store.getState().rebuild();
    stub.reply(lastPosted(stub).id, SPEC);
    store.getState().undo();
    store.getState().redo();
    store.getState().undo();
    expect(generateNow).toHaveBeenCalledTimes(1);

    // A second blocked design is one call more.
    const other = { ...ONE_FAIL, meta: { ...ONE_FAIL.meta, name: "Other" } };
    store.getState().loadFromHash(writeHash(other));
    expect(generateNow).toHaveBeenCalledTimes(2);
  });

  it("C-STOR3-10 never calls generateNow for a loaded design with no error", () => {
    const { store, generateNow } = openLink(SPEC);
    expect(store.getState().outcome).toBeNull();
    expect(generateNow).not.toHaveBeenCalled();
  });

  it("holds a thrown generator as the outcome throws", () => {
    const stub = stubClient();
    vi.spyOn(stub.client, "generateNow").mockImplementation(() => {
      throw new RangeError("forced");
    });
    const { location, history } = fakeLocation(writeHash(ONE_FAIL));
    const { store } = makeStore({ stub, location, history });
    expect(store.getState().outcome).toBe("throws");
  });
});
