import { readFileSync } from "node:fs";
import path from "node:path";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyPreset,
  choosePairing,
  hexToRgb,
  normalizeSeed,
  PAIRINGS,
  PRESETS,
  parseColor,
  rgbToOklch,
} from "@/engine";
import { DIRECTION_PARAM_KEYS, parseParams, resolveParams } from "@/features/studio/params";
import { runGenerate } from "@/features/studio/protocol";
import {
  createStudioStore,
  randomSeed,
  type Studio,
  type StudioStore,
  useStudio,
} from "@/features/studio/store";
import { writeHash } from "@/features/studio/url";
import { type DesignSpec, normalizeSpec, specId } from "@/spec";
import { withValue } from "../../spec/support";
import { lastPosted, makeStore, type Stub, stubClient } from "./store-support";
import {
  FRESH_PARAMS,
  fakeLocation,
  freshSpec,
  generate,
  linkOfValue,
  seedSequence,
} from "./support";

// Cases are the C-STORE-nn rows of docs/specs/02-studio.md, section 6.7 that are not about reply
// order (store-replies.test.ts), persistence (store-persist.test.ts), the I-M2-01 property
// (store-property.test.ts) or the measured lock bounds (store-lock-*.test.ts).

const ROOT = path.resolve(import.meta.dirname, "../../../..");

/** The snapshot fields of the state, for comparing what undo and redo restore. */
const snap = (studio: Studio) => ({
  params: studio.params,
  seed: studio.seed,
  spec: studio.spec,
  preset: studio.preset,
});

/** Runs `action`, then replies to the request it posted (a fake spec unless `real`). */
function commit(store: StudioStore, stub: Stub, action: (studio: Studio) => void, real = false) {
  const before = stub.posted.length;
  action(store.getState());
  expect(stub.posted.length, "the action posts one request").toBe(before + 1);
  const { id } = lastPosted(stub);
  if (real) stub.replyReal(id);
  else stub.reply(id);
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("the first load with no hash and no draft", () => {
  it("C-STORE-01 is FRESH: the default preset, auto pairing, seed-1, idle, light", () => {
    const { store } = makeStore();
    const state = store.getState();
    expect(state.params).toEqual(FRESH_PARAMS);
    expect(state.params).toEqual({ ...PRESETS.default.params, gamut: "srgb" });
    expect("pairing" in state.params).toBe(false);
    expect(state.preset).toBe("default");
    expect(state.seed).toBe("seed-1");
    expect(state.spec).toEqual(generate(resolveParams(state.params, "seed-1"), "seed-1"));
    const pick = PAIRINGS.find((item) => item.id === choosePairing("seed-1"));
    expect(state.spec.type.families).toEqual({
      display: pick?.display,
      body: pick?.body,
      mono: pick?.mono,
    });
    expect(state.history).toEqual([]);
    expect(state.future).toEqual([]);
    expect(state.status).toEqual({ phase: "idle", notice: null, draft: "on" });
    expect(state.view.mode).toBe("light");
  });

  it("C-STORE-01 generates the fresh design on first load without posting a request", () => {
    const { store, stub } = makeStore();
    expect(stub.posted).toEqual([]);
    expect(store.getState().spec).toEqual(normalizeSpec(freshSpec()));
  });

  it("starts with drafts off when there is no storage", () => {
    const { store } = makeStore({ storage: null });
    expect(store.getState().status.draft).toBe("off");
  });
});

describe("setParams", () => {
  it("C-STORE-03 changes params at once, posts request 1 with the resolved params, then applies the reply", () => {
    const { store, stub } = makeStore();
    store.getState().setParams({ chroma: "vivid" });
    const state = store.getState();
    expect(state.params).toEqual({ ...FRESH_PARAMS, chroma: "vivid" });
    expect(state.status.phase).toBe("generating");
    expect(stub.posted).toEqual([
      {
        id: 1,
        params: resolveParams({ ...FRESH_PARAMS, chroma: "vivid" }, "seed-1"),
        seed: "seed-1",
      },
    ]);
    expect(state.spec).toEqual(freshSpec());
    stub.replyReal(1);
    expect(store.getState().spec).toEqual(
      generate(resolveParams({ ...FRESH_PARAMS, chroma: "vivid" }, "seed-1"), "seed-1"),
    );
    expect(store.getState().spec).not.toEqual(freshSpec());
    expect(store.getState().status.phase).toBe("idle");
  });

  it("C-STORE-04 merges type by key, so a context change keeps the ratio", () => {
    const { store, stub } = makeStore();
    commit(store, stub, (s) => s.setParams({ type: { ratio: 1.25 } }));
    store.getState().setParams({ type: { context: "dense" } });
    expect(store.getState().params.type).toEqual({ context: "dense", ratio: 1.25 });
    store.getState().setParams({ type: { ratio: undefined } });
    expect(store.getState().params.type).toEqual({ context: "dense" });
  });

  it("removes an optional key set to undefined: pairing back to auto, a seed unlocked", () => {
    const { store } = makeStore();
    const seed = normalizeSeed(parseColor("#1f6f5b"));
    store.getState().setParams({ pairing: "funnel", primary: seed, name: "Saltmarsh" });
    expect(store.getState().params).toEqual({
      ...FRESH_PARAMS,
      pairing: "funnel",
      primary: seed,
      name: "Saltmarsh",
    });
    store.getState().setParams({ pairing: undefined, primary: undefined, name: undefined });
    expect(store.getState().params).toEqual(FRESH_PARAMS);
  });

  it("posts nothing when the patch changes nothing", () => {
    const { store, stub } = makeStore();
    store.getState().setParams({ chroma: "balanced", type: { context: "product" } });
    expect(stub.posted).toEqual([]);
    expect(store.getState().status.phase).toBe("idle");
  });

  it("rejects a patch that is not one, with the error naming setParams", () => {
    const { store, stub } = makeStore();
    const { setParams } = store.getState();
    expect(() => setParams(null as never)).toThrow(TypeError);
    expect(() => setParams({ density: "dense" } as never)).toThrow(RangeError);
    expect(() => setParams({ density: "dense" } as never)).toThrow(/^setParams: patch.density/);
    expect(() => setParams({ type: "dense" } as never)).toThrow(/^setParams: patch.type/);
    expect(() => setParams({ type: { size: 1 } } as never)).toThrow(RangeError);
    expect(() => setParams({ harmony: undefined })).toThrow(TypeError);
    expect(() => setParams({ type: undefined })).toThrow(TypeError);
    expect(() => setParams({ type: { context: undefined } })).toThrow(TypeError);
    expect(() => setParams({ primary: { l: 0.5 } } as never)).toThrow(/^setParams: patch.primary/);
    expect(() => setParams({ chroma: "vivid" }, { coalesce: 3 } as never)).toThrow(TypeError);
    expect(stub.posted).toEqual([]);
    expect(store.getState().params).toEqual(FRESH_PARAMS);
  });

  it("accepts exactly the keys parseParams accepts: one list, DIRECTION_PARAM_KEYS (I2)", () => {
    const valid: Record<string, unknown> = {
      primary: { l: 0.5, c: 0.1, h: 30 },
      secondary: { l: 0.5, c: 0.1, h: 30 },
      accent: { l: 0.5, c: 0.1, h: 30 },
      harmony: "triadic",
      chroma: "vivid",
      neutralTint: "warm",
      gamut: "p3",
      scaleMode: "even",
      contrastLevel: "AAA",
      type: { context: "dense" },
      radius: "round",
      depth: "flat",
      motion: "calm",
      pairing: "funnel",
      name: "Saltmarsh",
      density: "dense",
      seed: "seed-2",
      preset: "bento",
      mode: "dark",
      view: {},
    };
    const storeAccepts = (key: string): boolean => {
      const { store } = makeStore();
      try {
        store.getState().setParams({ [key]: valid[key] } as never);
        return true;
      } catch (error) {
        if (error instanceof RangeError && /is not a direction parameter/.test(error.message)) {
          return false;
        }
        throw error;
      }
    };
    const parseAccepts = (key: string): boolean =>
      parseParams({ ...FRESH_PARAMS, [key]: valid[key] }) !== null;
    const keys = Object.keys(valid);
    expect(keys.filter(storeAccepts)).toEqual(keys.filter(parseAccepts));
    expect(keys.filter(storeAccepts).sort()).toEqual([...DIRECTION_PARAM_KEYS].sort());
  });

  it("C-STORE-35 sets preset to null when a preset-owned field changes value", () => {
    const { store } = makeStore();
    store.getState().setParams({ radius: "sharp" });
    expect(store.getState().preset).toBeNull();
  });

  it("C-STORE-35 keeps the preset for a seed color, the gamut and a value a field already has", () => {
    const { store } = makeStore();
    store.getState().setParams({ radius: "soft", gamut: "p3" });
    expect(store.getState().preset).toBe("default");
    expect(store.getState().setSeedColor("primary", "#1f6f5b")).toEqual({ ok: true });
    expect(store.getState().preset).toBe("default");
  });
});

describe("applyPreset", () => {
  it("C-STORE-05 sets the preset's params, preset, mode and density; keeps locks and a higher level", () => {
    const { store, stub } = makeStore();
    const seed = normalizeSeed(parseColor("#1f6f5b"));
    commit(store, stub, (s) => s.setParams({ primary: seed, contrastLevel: "AAA" }));
    const before = store.getState();
    expect(before.history).toHaveLength(1);
    commit(store, stub, (s) => s.applyPreset("dark-dev-tool"));
    const after = store.getState();
    expect(after.params).toEqual(applyPreset(before.params, "dark-dev-tool"));
    expect(after.params.primary).toEqual(seed);
    expect(after.params.contrastLevel).toBe("AAA");
    expect(after.params.pairing).toBe("hubot-mona");
    expect(after.preset).toBe("dark-dev-tool");
    expect(after.view.mode).toBe("dark");
    expect(after.view.density).toBe("dense");
    expect(after.history).toHaveLength(2);
  });

  it("rejects an unknown preset id with RangeError naming applyPreset", () => {
    const { store } = makeStore();
    expect(() => store.getState().applyPreset("nope" as never)).toThrow(RangeError);
    expect(() => store.getState().applyPreset("nope" as never)).toThrow(/^applyPreset: /);
  });
});

describe("regenerate", () => {
  it("C-STORE-06 takes a new seed, keeps a lock, moves the unlocked palettes, re-chooses auto pairing", () => {
    const newSeed = seedSequence("seed-1", "seed-2");
    const { store, stub } = makeStore({ newSeed });
    commit(store, stub, (s) => s.toggleLock("secondary"), true);
    const locked = store.getState();
    commit(store, stub, (s) => s.regenerate(), true);
    const after = store.getState();
    expect(newSeed).toHaveBeenCalledTimes(2);
    expect(after.seed).toBe("seed-2");
    expect(after.params.secondary).toEqual(locked.params.secondary);
    expect(after.spec.color.params.secondary).toEqual(locked.params.secondary);
    expect(after.spec.color.palettes.primary.hue).not.toBe(locked.spec.color.palettes.primary.hue);
    expect(lastPosted(stub).params.pairing).toBe(choosePairing("seed-2"));
    expect("pairing" in after.params).toBe(false);
  });

  it("C-STORE-06 keeps an explicit pairing", () => {
    const { store, stub } = makeStore();
    store.getState().setParams({ pairing: "funnel" });
    store.getState().regenerate();
    expect(lastPosted(stub)).toMatchObject({ seed: "seed-2", params: { pairing: "funnel" } });
    expect(store.getState().params.pairing).toBe("funnel");
  });

  it("fails loudly when newSeed returns something that is not a string", () => {
    const newSeed = vi.fn().mockReturnValueOnce("seed-1").mockReturnValue(7);
    const { store, stub } = makeStore({ newSeed });
    expect(() => store.getState().regenerate()).toThrow(TypeError);
    expect(() => store.getState().regenerate()).toThrow(/^createStudioStore: newSeed\(\)/);
    expect(stub.posted).toEqual([]);
    expect(store.getState().seed).toBe("seed-1");
  });
});

describe("view settings", () => {
  it("C-STORE-07 toggleMode flips the mode, posts nothing and adds no history", () => {
    const { store, stub } = makeStore();
    store.getState().toggleMode();
    expect(store.getState().view.mode).toBe("dark");
    store.getState().toggleMode();
    expect(store.getState().view.mode).toBe("light");
    expect(stub.posted).toEqual([]);
    expect(store.getState().history).toEqual([]);
  });

  it("C-STORE-29 setView changes the view only: no request, no history", () => {
    const { store, stub } = makeStore();
    const before = snap(store.getState());
    store.getState().setView({ frame: 768 });
    store.getState().setView({ template: "dashboard", reducedMotion: true, copy: "edge" });
    store.getState().setView({ vision: "deutan", highlight: { roles: ["ring"], cells: [] } });
    const { view } = store.getState();
    expect(view).toMatchObject({
      frame: 768,
      template: "dashboard",
      reducedMotion: true,
      copy: "edge",
      vision: "deutan",
      highlight: { roles: ["ring"], cells: [] },
    });
    expect(snap(store.getState())).toEqual(before);
    expect(stub.posted).toEqual([]);
    expect(store.getState().history).toEqual([]);
  });

  it("C-STORE-35 nulls the preset when the density changes, and keeps it for the mode and the frame", () => {
    const { store } = makeStore();
    store.getState().toggleMode();
    store.getState().setView({ frame: 360, density: "comfortable" });
    expect(store.getState().preset).toBe("default");
    store.getState().setView({ density: "compact" });
    expect(store.getState().preset).toBeNull();
  });

  it("C-STORE-35 keeps the preset null after a density change, through a reply already on its way", () => {
    const { store, stub } = makeStore();
    store.getState().setParams({ gamut: "p3" });
    expect(store.getState().preset).toBe("default");
    store.getState().setView({ density: "dense" });
    expect(store.getState().preset).toBeNull();
    stub.reply(1);
    expect(store.getState().preset).toBeNull();
    store.getState().undo();
    expect(store.getState().preset).toBeNull();
  });

  it("rejects a view value outside its set with RangeError naming setView", () => {
    const { store } = makeStore();
    const { setView } = store.getState();
    expect(() => setView({ frame: 500 } as never)).toThrow(RangeError);
    expect(() => setView({ frame: 500 } as never)).toThrow(/^setView: patch.frame/);
    expect(() => setView({ mode: "dim" } as never)).toThrow(RangeError);
    expect(() => setView({ vision: "x" } as never)).toThrow(RangeError);
    expect(() => setView({ template: "blog" } as never)).toThrow(RangeError);
    expect(() => setView({ copy: "lorem" } as never)).toThrow(RangeError);
    expect(() => setView({ reducedMotion: "yes" } as never)).toThrow(TypeError);
    expect(() => setView({ highlight: { roles: "ring" } } as never)).toThrow(TypeError);
    expect(() => setView({ zoom: 2 } as never)).toThrow(RangeError);
    expect(() => setView(null as never)).toThrow(TypeError);
  });
});

describe("undo and redo", () => {
  it("C-STORE-08 round-trips n commits: n undos restore each state, n redos return", () => {
    const { store, stub } = makeStore();
    const states = [snap(store.getState())];
    const changes: ((s: Studio) => void)[] = [
      (s) => s.setParams({ chroma: "vivid" }),
      (s) => s.regenerate(),
      (s) => s.setParams({ radius: "round" }),
      (s) => s.applyPreset("bento"),
      (s) => s.setParams({ pairing: "funnel" }),
    ];
    for (const change of changes) {
      commit(store, stub, change);
      states.push(snap(store.getState()));
    }
    expect(store.getState().history).toHaveLength(5);
    for (let i = states.length - 2; i >= 0; i--) {
      store.getState().undo();
      expect(snap(store.getState())).toEqual(states[i]);
    }
    for (let i = 1; i < states.length; i++) {
      store.getState().redo();
      expect(snap(store.getState())).toEqual(states[i]);
    }
    expect(store.getState().future).toEqual([]);
  });

  it("C-STORE-09 clears future when a new commit follows an undo", () => {
    const { store, stub } = makeStore();
    commit(store, stub, (s) => s.setParams({ chroma: "vivid" }));
    store.getState().undo();
    expect(store.getState().future).toHaveLength(1);
    commit(store, stub, (s) => s.setParams({ radius: "round" }));
    expect(store.getState().future).toEqual([]);
  });

  it("C-STORE-10 keeps 100 steps: after 150 commits the oldest 50 are gone", () => {
    const { store, stub, clock } = makeStore();
    const states = [snap(store.getState())];
    for (let i = 0; i < 150; i++) {
      clock.advance(2_000);
      commit(store, stub, (s) => s.regenerate());
      states.push(snap(store.getState()));
    }
    expect(store.getState().history).toHaveLength(100);
    expect(store.getState().history[0]).toEqual(states[50]);
    for (let i = 0; i < 100; i++) store.getState().undo();
    expect(snap(store.getState())).toEqual(states[50]);
    const before = store.getState();
    expect(() => store.getState().undo()).not.toThrow();
    expect(store.getState()).toBe(before);
  });

  it("C-STORE-11 undo with no history and redo with no future change nothing", () => {
    const { store } = makeStore();
    const before = store.getState();
    store.getState().undo();
    store.getState().redo();
    expect(store.getState()).toBe(before);
  });

  it("C-STORE-36 undo and redo restore the preset with the snapshot", () => {
    const { store, stub } = makeStore();
    commit(store, stub, (s) => s.applyPreset("organic"));
    commit(store, stub, (s) => s.setParams({ radius: "sharp" }));
    expect(store.getState().preset).toBeNull();
    store.getState().undo();
    expect(store.getState().preset).toBe("organic");
    store.getState().undo();
    expect(store.getState().preset).toBe("default");
    store.getState().redo();
    store.getState().redo();
    expect(store.getState().preset).toBeNull();
  });
});

describe("coalescing (R2-13 item 6)", () => {
  it("C-STORE-12 commits five calls with one key within 1,000 ms as one entry; undo returns before the first", () => {
    const { store, stub, clock } = makeStore();
    const before = snap(store.getState());
    for (let i = 1; i <= 5; i++) {
      clock.advance(150);
      commit(store, stub, (s) =>
        s.setParams({ type: { ratio: 1.1 + i / 100 } }, { coalesce: "ratio" }),
      );
    }
    expect(store.getState().history).toHaveLength(1);
    expect(store.getState().params.type.ratio).toBe(1.1 + 5 / 100);
    store.getState().undo();
    expect(snap(store.getState())).toEqual(before);
  });

  it("C-STORE-12 merges the same way when the five replies arrive after the five calls", () => {
    const { store, stub, clock } = makeStore();
    for (let i = 1; i <= 5; i++) {
      clock.advance(100);
      store.getState().setParams({ type: { ratio: 1.1 + i / 100 } }, { coalesce: "ratio" });
    }
    for (const request of [...stub.posted]) stub.reply(request.id);
    expect(store.getState().history).toHaveLength(1);
  });

  it("C-STORE-13 commits separately for different keys, no key, or a gap above 1,000 ms", () => {
    const { store, stub, clock } = makeStore();
    commit(store, stub, (s) => s.setParams({ chroma: "vivid" }, { coalesce: "a" }));
    commit(store, stub, (s) => s.setParams({ chroma: "muted" }, { coalesce: "b" }));
    commit(store, stub, (s) => s.setParams({ chroma: "vivid" }));
    commit(store, stub, (s) => s.setParams({ chroma: "muted" }));
    commit(store, stub, (s) => s.setParams({ chroma: "vivid" }, { coalesce: "c" }));
    clock.advance(1_001);
    commit(store, stub, (s) => s.setParams({ chroma: "muted" }, { coalesce: "c" }));
    expect(store.getState().history).toHaveLength(6);
  });

  it("C-STORE-13 merges at a gap of exactly 1,000 ms, and chains a long gesture into one entry", () => {
    const { store, stub, clock } = makeStore();
    commit(store, stub, (s) => s.regenerate());
    for (let i = 0; i < 5; i++) {
      clock.advance(1_000);
      commit(store, stub, (s) => s.regenerate());
    }
    expect(store.getState().history).toHaveLength(1);
  });

  it("does not merge into a commit that undo took back", () => {
    const { store, stub, clock } = makeStore();
    commit(store, stub, (s) => s.regenerate());
    store.getState().undo();
    clock.advance(10);
    commit(store, stub, (s) => s.regenerate());
    expect(store.getState().history).toHaveLength(1);
    store.getState().undo();
    expect(store.getState().seed).toBe("seed-1");
  });

  it("C-STORE-37 five setSeedColor calls with one key within 1,000 ms are one entry; no key commits alone", () => {
    const { store, stub, clock } = makeStore();
    for (const hex of ["#1f6f5b", "#20705c", "#21715d", "#22725e", "#23735f"]) {
      clock.advance(50);
      const before = stub.posted.length;
      expect(store.getState().setSeedColor("primary", hex, { coalesce: "seed:primary" })).toEqual({
        ok: true,
      });
      expect(stub.posted).toHaveLength(before + 1);
      stub.reply(lastPosted(stub).id);
    }
    expect(store.getState().history).toHaveLength(1);
    clock.advance(50);
    store.getState().setSeedColor("primary", "#24745f");
    stub.reply(lastPosted(stub).id);
    expect(store.getState().history).toHaveLength(2);
  });
});

describe("locks and seed colors", () => {
  it("C-STORE-15 locks primary at the shown role's L and C with the palette's hue", () => {
    const { store, stub } = makeStore();
    const spec = store.getState().spec;
    store.getState().toggleLock("primary");
    const shown = rgbToOklch(hexToRgb(spec.color.roles.light.primary), "srgb");
    const seed = normalizeSeed({ l: shown.l, c: shown.c, h: spec.color.palettes.primary.hue });
    expect(store.getState().params.primary).toEqual(seed);
    expect(lastPosted(stub).params.primary).toEqual(seed);
  });

  it.each(["secondary", "accent"] as const)(
    "C-STORE-15 locks %s at the palette's light step 500 with the palette's hue",
    (slot) => {
      const { store } = makeStore();
      const palette = store.getState().spec.color.palettes[slot];
      store.getState().toggleLock(slot);
      const step = palette.light.find((entry) => entry.step === 500);
      expect(store.getState().params[slot]).toEqual(
        normalizeSeed({ l: step?.oklch.l ?? -1, c: step?.oklch.c ?? -1, h: palette.hue }),
      );
    },
  );

  it("C-STORE-15 unlocks a locked seed by removing the key", () => {
    const { store, stub } = makeStore();
    commit(store, stub, (s) => s.toggleLock("accent"));
    expect(store.getState().params.accent).toBeDefined();
    store.getState().toggleLock("accent");
    expect("accent" in store.getState().params).toBe(false);
    expect(stub.posted).toHaveLength(2);
  });

  it("rejects a slot that cannot lock", () => {
    const { store } = makeStore();
    expect(() => store.getState().toggleLock("neutral" as never)).toThrow(RangeError);
    expect(() => store.getState().toggleLock("neutral" as never)).toThrow(/^toggleLock: /);
    expect(() => store.getState().setSeedColor("info" as never, "#fff")).toThrow(RangeError);
    expect(() => store.getState().setSeedColor("primary", 3 as never)).toThrow(TypeError);
  });

  it("C-STORE-16 sets a seed from parseColor, hex or oklch", () => {
    const { store, stub } = makeStore();
    expect(store.getState().setSeedColor("primary", "#1f6f5b")).toEqual({ ok: true });
    expect(store.getState().params.primary).toEqual(normalizeSeed(parseColor("#1f6f5b")));
    expect(store.getState().setSeedColor("secondary", "oklch(0.6 0.15 250)")).toEqual({ ok: true });
    expect(store.getState().params.secondary).toEqual({ l: 0.6, c: 0.15, h: 250 });
    expect(stub.posted).toHaveLength(2);
  });

  it("C-STORE-17 refuses text that is not a color with a message naming the forms, and changes nothing", () => {
    const { store, stub } = makeStore();
    const before = store.getState();
    const result = store.getState().setSeedColor("primary", "banana");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("#rrggbb");
    expect(result.message).toContain("oklch(L C H)");
    expect(store.getState()).toBe(before);
    expect(stub.posted).toEqual([]);
  });
});

describe("a generation that fails", () => {
  it("C-STORE-18 shows a failed status and a generation notice, and keeps the spec and history", () => {
    const { store, stub } = makeStore();
    store.getState().setParams({ chroma: "vivid" });
    stub.fail(1);
    const state = store.getState();
    expect(state.status.phase).toBe("failed");
    expect(state.status.notice).toEqual({
      kind: "generation",
      message: "Step 500 cannot reach 4.5:1.",
    });
    expect(state.spec).toEqual(freshSpec());
    expect(state.history).toEqual([]);
  });

  it("C-STORE-19 revert restores the committed params and clears the notice", () => {
    const { store, stub } = makeStore();
    commit(store, stub, (s) => s.setParams({ radius: "round" }));
    const committed = snap(store.getState());
    store.getState().setParams({ chroma: "vivid" });
    stub.fail(2);
    store.getState().revert();
    const state = store.getState();
    expect(snap(state)).toEqual(committed);
    expect(state.status.notice).toBeNull();
    expect(state.status.phase).toBe("idle");
  });

  it("C-STORE-20 a value outside its set ends in a notice naming params.chroma; the spec stays", () => {
    const { store, stub } = makeStore();
    store.getState().setParams({ chroma: "loud" as never });
    stub.deliver(runGenerate(lastPosted(stub)));
    const { status, spec } = store.getState();
    expect(status.phase).toBe("failed");
    expect(status.notice?.kind).toBe("generation");
    expect(status.notice?.kind === "generation" && status.notice.message).toMatch(/params\.chroma/);
    expect(spec).toEqual(freshSpec());
  });

  it("clears the generation notice when a later change commits", () => {
    const { store, stub } = makeStore();
    store.getState().setParams({ chroma: "vivid" });
    stub.fail(1);
    commit(store, stub, (s) => s.setParams({ radius: "round" }));
    expect(store.getState().status).toMatchObject({ phase: "idle", notice: null });
  });

  it("dismissNotice clears the notice", () => {
    const { store, stub } = makeStore();
    store.getState().setParams({ chroma: "vivid" });
    stub.fail(1);
    store.getState().dismissNotice();
    expect(store.getState().status.notice).toBeNull();
  });
});

describe("loadFromHash", () => {
  const other = () => generate({ ...FRESH_PARAMS, radius: "round", pairing: "funnel" }, "seed-7");

  it("C-STORE-21 loads a valid link: params from paramsOfSpec, its seed and spec; undo returns", () => {
    const { store } = makeStore();
    store.getState().loadFromHash(writeHash(other()));
    const state = store.getState();
    expect(state.spec).toEqual(other());
    expect(state.seed).toBe("seed-7");
    expect(state.params).toEqual({ ...FRESH_PARAMS, radius: "round", pairing: "funnel" });
    expect(state.preset).toBeNull();
    expect(state.history).toHaveLength(1);
    store.getState().undo();
    expect(store.getState().spec).toEqual(freshSpec());
  });

  it.each([
    ["corrupt", () => "#s=AAAA", { reason: "corrupt" }],
    [
      "schema",
      () => {
        const broken = withValue(freshSpec(), ["color", "roles", "light", "ring"], "#FFF");
        return writeHashOf(broken);
      },
      { reason: "schema", issues: ["color.roles.light.ring"] },
    ],
  ])("C-STORE-22 keeps the snapshot for a %s link and sets a link notice", (_, hash, expected) => {
    const { store } = makeStore();
    const before = snap(store.getState());
    store.getState().loadFromHash(hash());
    expect(snap(store.getState())).toEqual(before);
    expect(store.getState().history).toEqual([]);
    expect(store.getState().status.notice).toEqual({
      kind: "link",
      ...expected,
      fallback: "current",
    });
  });

  it("ignores a hash with no link, and a link to the design already held", () => {
    const { store } = makeStore();
    const before = store.getState();
    store.getState().loadFromHash("#about");
    store.getState().loadFromHash(writeHash(freshSpec()));
    expect(store.getState()).toBe(before);
    expect(() => store.getState().loadFromHash(3 as never)).toThrow(TypeError);
  });

  it("C-STORE-28 a link whose fonts match no pairing sets custom-fonts; the next change resets them to auto", () => {
    const { store, stub } = makeStore();
    const custom = withValue(other(), ["type", "families", "display"], "inter") as DesignSpec;
    store.getState().loadFromHash(writeHash(custom));
    expect(store.getState().status.notice).toEqual({ kind: "custom-fonts" });
    expect("pairing" in store.getState().params).toBe(false);
    store.getState().setParams({ chroma: "vivid" });
    expect(lastPosted(stub).params.pairing).toBe(choosePairing("seed-7"));
    stub.reply(lastPosted(stub).id);
    expect(store.getState().status.notice).toBeNull();
  });

  it("C-STORE-38 an auto pairing stays auto through a link; regenerate picks for the new seed", () => {
    const first = makeStore();
    commit(first.store, first.stub, (s) => s.setParams({ chroma: "vivid" }), true);
    const { location } = fakeLocation(writeHash(first.store.getState().spec));
    const { store, stub } = makeStore({ location, newSeed: seedSequence("seed-9") });
    expect("pairing" in store.getState().params).toBe(false);
    store.getState().regenerate();
    expect(lastPosted(stub).params.pairing).toBe(choosePairing("seed-9"));
  });

  it("C-STORE-38 an explicit pairing stays explicit through a link, and regenerate keeps it", () => {
    const first = makeStore();
    commit(first.store, first.stub, (s) => s.setParams({ pairing: "funnel" }), true);
    const { location } = fakeLocation(writeHash(first.store.getState().spec));
    const { store, stub } = makeStore({ location, newSeed: seedSequence("seed-9") });
    expect(store.getState().params.pairing).toBe("funnel");
    store.getState().regenerate();
    expect(lastPosted(stub).params.pairing).toBe("funnel");
  });
});

/** `writeHash` for a spec that fails the schema: the link format around any JSON. */
const writeHashOf = (value: unknown): string => `#s=${linkOfValue(value)}`;

describe("drafts on the first load", () => {
  it("C-STORE-39 a draft with no hash restores its params, seed and preset, with a notice", () => {
    const first = makeStore();
    commit(first.store, first.stub, (s) => s.applyPreset("bento"), true);
    first.store.getState().flush();
    const saved = snap(first.store.getState());
    const { store } = makeStore({ storage: first.storage });
    expect(snap(store.getState())).toEqual(saved);
    expect(store.getState().preset).toBe("bento");
    expect(store.getState().status.notice).toEqual({ kind: "draft-restored" });
  });

  it("C-STORE-39 a link with no matching draft takes paramsOfSpec and preset null", () => {
    const first = makeStore();
    commit(first.store, first.stub, (s) => s.applyPreset("bento"), true);
    first.store.getState().flush();
    const link = generate({ ...FRESH_PARAMS, radius: "round" }, "seed-7");
    const { store } = makeStore({
      storage: first.storage,
      location: fakeLocation(writeHash(link)).location,
    });
    expect(store.getState().spec).toEqual(link);
    expect(store.getState().preset).toBeNull();
    expect(store.getState().status.notice).toBeNull();
  });
});

describe("startFresh", () => {
  it("C-STORE-23 takes a new seed and the default preset, clears notice, hash and draft, adds one entry", () => {
    const { store, stub, storage, history, location } = makeStore();
    commit(store, stub, (s) => s.applyPreset("glass"));
    store.getState().flush();
    expect(storage.items.size).toBe(1);
    store.getState().loadFromHash("#s=AAAA");
    store.getState().startFresh();
    expect(location.hash).toBe("");
    expect(history.replaceState).toHaveBeenLastCalledWith(null, "", "/studio");
    expect(storage.items.size).toBe(0);
    const state = store.getState();
    expect(state.seed).toBe("seed-2");
    expect(state.params).toEqual(FRESH_PARAMS);
    expect(state.preset).toBe("default");
    expect(state.status.notice).toBeNull();
    const entries = state.history.length;
    stub.reply(lastPosted(stub).id);
    expect(store.getState().history).toHaveLength(entries + 1);
  });

  it("keeps the query string when it clears the hash", () => {
    const { location, history } = fakeLocation("#s=AAAA");
    location.search = "?ref=x";
    const { store } = makeStore({ location, history });
    store.getState().startFresh();
    expect(history.replaceState).toHaveBeenLastCalledWith(null, "", "/studio?ref=x");
  });
});

describe("stores, the client and dispose", () => {
  it("C-STORE-25 two stores share no state", () => {
    const a = makeStore();
    const b = makeStore();
    a.store.getState().setParams({ chroma: "vivid" });
    a.store.getState().toggleMode();
    expect(b.store.getState().params).toEqual(FRESH_PARAMS);
    expect(b.store.getState().view.mode).toBe("light");
    expect(b.stub.posted).toEqual([]);
  });

  it("C-STORE-26 calls the generator only through deps.client", () => {
    const source = readFileSync(path.join(ROOT, "src/features/studio/store.ts"), "utf8");
    expect(source).not.toMatch(/\b(generateSystem|runGenerate)\b/);
    const stub = stubClient();
    const generateNow = vi.spyOn(stub.client, "generateNow");
    const { store } = makeStore({ stub });
    expect(generateNow).toHaveBeenCalledOnce();
    expect(generateNow).toHaveBeenCalledWith(resolveParams(FRESH_PARAMS, "seed-1"), "seed-1");
    store.getState().setParams({ chroma: "vivid" });
    store.getState().regenerate();
    expect(stub.posted).toHaveLength(2);
    expect(generateNow).toHaveBeenCalledOnce();
    const linked = stubClient();
    const linkedNow = vi.spyOn(linked.client, "generateNow");
    makeStore({ stub: linked, location: fakeLocation(writeHash(freshSpec())).location });
    expect(linkedNow).not.toHaveBeenCalled();
  });

  it("C-STORE-27 dispose stops the client; later replies and actions change nothing", () => {
    const { store, stub } = makeStore();
    store.getState().setParams({ chroma: "vivid" });
    store.getState().dispose();
    expect(stub.disposals()).toBe(1);
    expect(stub.listeners()).toBe(0);
    const before = store.getState();
    stub.reply(1);
    store.getState().regenerate();
    expect(store.getState().spec).toEqual(freshSpec());
    expect(stub.posted).toHaveLength(1);
    store.getState().dispose();
    expect(stub.disposals()).toBe(1);
    expect(store.getState().spec).toBe(before.spec);
  });

  it("rejects deps that are not deps, with errors naming createStudioStore", () => {
    const { deps } = makeStore();
    expect(() => createStudioStore(null as never)).toThrow(TypeError);
    expect(() => createStudioStore({ ...deps, client: {} as never })).toThrow(
      /^createStudioStore: deps.client/,
    );
    expect(() => createStudioStore({ ...deps, clock: 3 as never })).toThrow(TypeError);
    expect(() => createStudioStore({ ...deps, newSeed: "s" as never })).toThrow(TypeError);
    expect(() => createStudioStore({ ...deps, storage: {} as never })).toThrow(TypeError);
    expect(() => createStudioStore({ ...deps, location: { hash: 1 } as never })).toThrow(TypeError);
    expect(() => createStudioStore({ ...deps, history: {} as never })).toThrow(TypeError);
  });
});

describe("randomSeed", () => {
  it("writes two 32-bit draws from getRandomValues in base 36 (R2-13 item 5)", () => {
    const getRandomValues = vi.fn(<T extends ArrayBufferView | null>(array: T): T => {
      if (array instanceof Uint32Array) array.set([7, 0]);
      return array;
    });
    expect(randomSeed({ getRandomValues })).toBe("70");
    const call = getRandomValues.mock.calls[0]?.[0];
    expect(call).toBeInstanceOf(Uint32Array);
    expect(call?.byteLength).toBe(8);
    getRandomValues.mockImplementation(<T extends ArrayBufferView | null>(array: T): T => {
      if (array instanceof Uint32Array) array.set([4294967295, 123456789]);
      return array;
    });
    expect(randomSeed({ getRandomValues })).toBe(
      (4294967295).toString(36) + (123456789).toString(36),
    );
  });

  it("uses crypto by default and gives a seed the generator accepts", () => {
    const seed = randomSeed();
    expect(seed).toMatch(/^[0-9a-z]{2,14}$/);
    expect(randomSeed()).not.toBe(seed);
  });
});

describe("useStudio", () => {
  it("wraps the store for React and re-renders on a change", () => {
    const { store, stub } = makeStore();
    const { result } = renderHook(() => useStudio(store, (studio) => studio.view.mode));
    expect(result.current).toBe("light");
    act(() => store.getState().toggleMode());
    expect(result.current).toBe("dark");
    expect(stub.posted).toEqual([]);
    expect(specId(store.getState().spec)).toBe(specId(freshSpec()));
  });
});
