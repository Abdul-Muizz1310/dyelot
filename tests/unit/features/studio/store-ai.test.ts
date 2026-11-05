import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import type { AiChange, AiPatch } from "@/ai";
import { type Finding, generateSystem, PRESETS, applyPreset as presetParams } from "@/engine";
import { fixFor } from "@/features/studio/fixes";
import { type ParamsPatch, resolveParams } from "@/features/studio/params";
import { type GenerateRequest, runGenerate } from "@/features/studio/protocol";
import type { Studio } from "@/features/studio/store";
import { writeHash } from "@/features/studio/url";
import { importShadcnCss } from "@/import";
import type { DesignSpec } from "@/spec";
import { readFixture } from "../../import/helpers";
import { withValue } from "../../spec/support";
import { fakeSpec, lastPosted, makeStore, type Stub } from "./store-support";
import { FRESH_PARAMS, fakeLocation, freshSpec, resolvedFresh } from "./support";

// Cases C-STOR4-01 to C-STOR4-10 of docs/specs/04-ai.md, section 14.1 (R4-37, R4-44, R4-56): the
// store keeps `createdWith` in every snapshot, sends it only for an AI or lexicon intent, and
// `applyAi` applies a change as one commit. M2's StubClient, a fake clock and fake timers.

const RESULT = importShadcnCss(readFixture("shadcn-neutral.css"));
if (!RESULT.ok) throw new Error("the shadcn fixture did not import");
const IMPORT = RESULT;

/** A C1 finding at AA: its fix raises the design to AA+ (R2-10). */
const C1: Finding = {
  id: "C1",
  severity: "error",
  mode: "light",
  subject: "text/background",
  measured: 4.2,
  threshold: 4.5,
  source: "test",
};

/** The snapshot fields of the state, `createdWith` included. */
const snap = (studio: Studio) => ({
  params: studio.params,
  seed: studio.seed,
  spec: studio.spec,
  preset: studio.preset,
  provenance: studio.provenance,
  createdWith: studio.createdWith,
});

function requestOf(stub: Stub, id: number): GenerateRequest {
  const request = stub.posted.find((item) => item.id === id);
  if (request === undefined) throw new Error(`stub: request ${id} was never posted`);
  return request;
}

/** Replies to request `id` with the stub's fake spec, stamped as the worker stamps it. */
function replyStamped(stub: Stub, id: number): void {
  const request = requestOf(stub, id);
  const spec = withValue(
    fakeSpec(request, freshSpec),
    ["meta", "createdWith"],
    request.createdWith ?? "controls",
  ) as DesignSpec;
  stub.reply(id, spec);
}

/** Replies to request `id` with what the real worker protocol answers. */
function replyReal(stub: Stub, id: number): void {
  stub.deliver(runGenerate(requestOf(stub, id)));
}

/** The error `run` throws; fails the test when it returns. */
function thrown(run: () => unknown): Error {
  try {
    run();
  } catch (error) {
    if (error instanceof Error) return error;
    throw new Error(`threw a non-Error: ${String(error)}`);
  }
  throw new Error("expected a throw, but the call returned");
}

/** A request's keys, sorted: an M2 request has exactly id, params and seed. */
const keysOf = (request: GenerateRequest) => Object.keys(request).sort();

/** A store whose held design was committed by a lexicon change. */
function lexiconStore() {
  const made = makeStore();
  const { store, stub, clock } = made;
  expect(store.getState().applyAi({ patch: { chroma: "vivid" }, createdWith: "lexicon" })).toBe(
    true,
  );
  replyStamped(stub, lastPosted(stub).id);
  expect(store.getState().createdWith).toBe("lexicon");
  clock.advance(2_000);
  return made;
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("createdWith in the store", () => {
  it("C-STOR4-01 FRESH holds controls", () => {
    const { store } = makeStore();
    expect(store.getState().createdWith).toBe("controls");
    expect(store.getState().spec.meta.createdWith).toBe("controls");
  });

  it("C-STOR4-01 a link of a spec stamped model:x/y:free holds that value", () => {
    const spec = generateSystem(resolvedFresh(), "seed-7", { createdWith: "model:x/y:free" });
    const { location } = fakeLocation(writeHash(spec));
    const opened = makeStore({ location });
    expect(opened.store.getState().createdWith).toBe("model:x/y:free");
    expect(opened.store.getState().provenance).toBe("loaded");
    // A link opened later, through the hash, holds it too.
    const { store } = makeStore();
    store.getState().loadFromHash(writeHash(spec));
    expect(store.getState().spec).toEqual(spec);
    expect(store.getState().createdWith).toBe("model:x/y:free");
  });

  it("C-STOR4-01 a restored draft takes its spec's createdWith", () => {
    const first = makeStore();
    first.store.getState().applyAi({ patch: { radius: "round" }, createdWith: "lexicon" });
    replyReal(first.stub, lastPosted(first.stub).id);
    first.store.getState().flush();
    const { store } = makeStore({ storage: first.storage });
    expect(store.getState().status.notice).toEqual({ kind: "draft-restored" });
    expect(store.getState().spec.meta.createdWith).toBe("lexicon");
    expect(store.getState().createdWith).toBe("lexicon");
  });

  it("C-STOR4-01 importDesign holds import", () => {
    const { store } = makeStore();
    store.getState().importDesign(IMPORT);
    expect(store.getState().createdWith).toBe("import");
    expect(store.getState().history[0]?.createdWith).toBe("controls");
  });
});

describe("applyAi", () => {
  it("C-STOR4-02 sends one request with createdWith, and its reply commits one entry holding it", () => {
    expectTypeOf<AiPatch>().toExtend<ParamsPatch>();
    expectTypeOf<AiChange["patch"]>().toEqualTypeOf<AiPatch>();
    const { store, stub } = makeStore();
    const before = snap(store.getState());
    const change: AiChange = { patch: { chroma: "vivid" }, createdWith: "lexicon" };
    expect(store.getState().applyAi(change)).toBe(true);
    expect(stub.posted).toHaveLength(1);
    const request = lastPosted(stub);
    expect(request).toStrictEqual({
      id: request.id,
      params: resolveParams({ ...FRESH_PARAMS, chroma: "vivid" }, "seed-1"),
      seed: "seed-1",
      createdWith: "lexicon",
    });
    replyReal(stub, request.id);
    const state = store.getState();
    expect(state.status.phase).toBe("idle");
    expect(state.history).toEqual([before]);
    expect(state.spec.meta.createdWith).toBe("lexicon");
    expect(state.createdWith).toBe("lexicon");
    expect(state.params).toEqual({ ...FRESH_PARAMS, chroma: "vivid" });
    expect(state.provenance).toBe("generated");
  });

  it("C-STOR4-03 regenerate and a lock toggle send the held createdWith again", () => {
    const { store, stub, clock } = lexiconStore();
    store.getState().regenerate();
    expect(lastPosted(stub).createdWith).toBe("lexicon");
    replyStamped(stub, lastPosted(stub).id);
    expect(store.getState().createdWith).toBe("lexicon");
    clock.advance(2_000);
    store.getState().toggleLock("secondary");
    expect(lastPosted(stub).createdWith).toBe("lexicon");
    replyStamped(stub, lastPosted(stub).id);
    expect(store.getState().createdWith).toBe("lexicon");
    expect(store.getState().spec.meta.createdWith).toBe("lexicon");
  });

  it.each([
    ["setParams", (studio: Studio) => studio.setParams({ radius: "round" })],
    ["applyPreset", (studio: Studio) => studio.applyPreset("editorial")],
    ["setSeedColor", (studio: Studio) => studio.setSeedColor("primary", "#3a6ea5")],
    [
      "a fix",
      (studio: Studio) => {
        const fix = fixFor(C1, studio.params);
        if (fix === null) throw new Error("C1 has a fix at AA");
        studio.setParams(fix);
      },
    ],
  ])("C-STOR4-03 %s sends no createdWith and commits controls", (_, action) => {
    const { store, stub } = lexiconStore();
    const posted = stub.posted.length;
    action(store.getState());
    expect(stub.posted).toHaveLength(posted + 1);
    const request = lastPosted(stub);
    expect(keysOf(request)).toEqual(["id", "params", "seed"]);
    replyStamped(stub, request.id);
    const state = store.getState();
    expect(state.createdWith).toBe("controls");
    expect(state.spec.meta.createdWith).toBe("controls");
    expect(state.history.at(-1)?.createdWith).toBe("lexicon");
  });

  it.each([
    ["regenerate()", (studio: Studio) => studio.regenerate()],
    ["toggleLock(primary)", (studio: Studio) => studio.toggleLock("primary")],
    ["rebuild()", (studio: Studio) => studio.rebuild()],
  ])("C-STOR4-04 after importDesign, %s sends no createdWith and commits controls", (_, action) => {
    const { store, stub } = makeStore();
    store.getState().importDesign(IMPORT);
    expect(store.getState().createdWith).toBe("import");
    action(store.getState());
    expect(stub.posted).toHaveLength(1);
    const request = lastPosted(stub);
    expect(keysOf(request)).toEqual(["id", "params", "seed"]);
    replyStamped(stub, request.id);
    const state = store.getState();
    expect(state.createdWith).toBe("controls");
    expect(state.provenance).toBe("generated");
    expect(state.history.at(-1)?.createdWith).toBe("import");
  });

  it("C-STOR4-05 the preset applies first, with its view mode and density", () => {
    const { store, stub } = makeStore();
    store.getState().setView({ mode: "dark", density: "dense" });
    expect(store.getState().preset).toBeNull();
    const ok = store.getState().applyAi({ preset: "editorial", patch: {}, createdWith: "lexicon" });
    expect(ok).toBe(true);
    const { mode, density } = PRESETS.editorial.view;
    expect(store.getState().view).toMatchObject({ mode, density });
    const request = lastPosted(stub);
    expect(request.params).toEqual(
      resolveParams(presetParams(FRESH_PARAMS, "editorial"), "seed-1"),
    );
    expect(request.createdWith).toBe("lexicon");
    replyStamped(stub, request.id);
    expect(store.getState().preset).toBe("editorial");
    expect(store.getState().history).toHaveLength(1);
  });

  it("C-STOR4-05 a patch that changes a field the preset owns leaves no preset", () => {
    expect(PRESETS.editorial.params.radius).toBe("sharp");
    const { store, stub } = makeStore();
    store
      .getState()
      .applyAi({ preset: "editorial", patch: { radius: "round" }, createdWith: "lexicon" });
    const request = lastPosted(stub);
    expect(request.params).toEqual(
      resolveParams({ ...presetParams(FRESH_PARAMS, "editorial"), radius: "round" }, "seed-1"),
    );
    replyStamped(stub, request.id);
    expect(store.getState().preset).toBeNull();
    expect(store.getState().params.radius).toBe("round");
  });

  it("C-STOR4-05 a density in the change wins over the preset's, and the preset becomes null", () => {
    expect(PRESETS.editorial.view.density).toBe("comfortable");
    const { store, stub } = makeStore();
    store.getState().setView({ mode: "dark" });
    store
      .getState()
      .applyAi({ preset: "editorial", patch: {}, density: "dense", createdWith: "lexicon" });
    expect(store.getState().view).toMatchObject({
      mode: PRESETS.editorial.view.mode,
      density: "dense",
    });
    replyStamped(stub, lastPosted(stub).id);
    expect(store.getState().preset).toBeNull();
    expect(store.getState().params).toEqual(presetParams(FRESH_PARAMS, "editorial"));
    // The preset's own density keeps the preset.
    const again = makeStore();
    again.store
      .getState()
      .applyAi({ preset: "editorial", patch: {}, density: "comfortable", createdWith: "lexicon" });
    replyStamped(again.stub, lastPosted(again.stub).id);
    expect(again.store.getState().preset).toBe("editorial");
  });

  it("C-STOR4-06 one undo restores the previous snapshot, createdWith included; redo the AI one", () => {
    const { store, stub } = makeStore();
    const before = snap(store.getState());
    store.getState().applyAi({ patch: { radius: "round" }, createdWith: "model:x/y:free" });
    replyReal(stub, lastPosted(stub).id);
    const after = snap(store.getState());
    expect(after.createdWith).toBe("model:x/y:free");
    expect(after.spec.meta.createdWith).toBe("model:x/y:free");
    store.getState().undo();
    expect(snap(store.getState())).toEqual(before);
    expect(store.getState().createdWith).toBe("controls");
    store.getState().redo();
    expect(snap(store.getState())).toEqual(after);
  });

  it("C-STOR4-07 a change equal to the held params, preset and createdWith returns false and sends nothing", () => {
    const { store, stub } = makeStore();
    const before = snap(store.getState());
    expect(store.getState().applyAi({ patch: {}, createdWith: "controls" })).toBe(false);
    expect(
      store
        .getState()
        .applyAi({ preset: "default", patch: { radius: "soft" }, createdWith: "controls" }),
    ).toBe(false);
    expect(stub.posted).toEqual([]);
    expect(snap(store.getState())).toEqual(before);
    expect(store.getState().history).toEqual([]);
    expect(store.getState().status.phase).toBe("idle");
  });

  it("C-STOR4-07 a change of createdWith alone sends one request", () => {
    const { store, stub } = makeStore();
    expect(store.getState().applyAi({ patch: {}, createdWith: "lexicon" })).toBe(true);
    expect(stub.posted).toHaveLength(1);
    expect(lastPosted(stub)).toStrictEqual({
      id: 1,
      params: resolveParams(FRESH_PARAMS, "seed-1"),
      seed: "seed-1",
      createdWith: "lexicon",
    });
  });

  it("C-STOR4-07 a density still applies when nothing is sent", () => {
    const { store, stub } = makeStore();
    store.getState().setView({ density: "dense" });
    expect(store.getState().preset).toBeNull();
    const ok = store.getState().applyAi({ patch: {}, density: "compact", createdWith: "controls" });
    expect(ok).toBe(false);
    expect(stub.posted).toEqual([]);
    expect(store.getState().view.density).toBe("compact");
  });

  it("C-STOR4-08 three coalesced calls 200 ms apart commit one history entry", () => {
    const { store, stub, clock } = makeStore();
    for (const chroma of ["vivid", "muted", "vivid"] as const) {
      const ok = store
        .getState()
        .applyAi({ patch: { chroma }, createdWith: "controls" }, { coalesce: "steer" });
      expect(ok).toBe(true);
      replyStamped(stub, lastPosted(stub).id);
      clock.advance(200);
    }
    expect(stub.posted).toHaveLength(3);
    expect(store.getState().history).toHaveLength(1);
    expect(store.getState().params.chroma).toBe("vivid");
  });

  it.each([
    ["null", null, TypeError],
    ["createdWith import", { patch: {}, createdWith: "import" }, RangeError],
    ["createdWith robot", { patch: {}, createdWith: "robot" }, RangeError],
    ["preset x", { preset: "x", patch: {}, createdWith: "lexicon" }, RangeError],
    ["density loose", { patch: {}, density: "loose", createdWith: "lexicon" }, RangeError],
    ["patch { foo: 1 }", { patch: { foo: 1 }, createdWith: "lexicon" }, RangeError],
    // Added boundaries: a wrong type, an unknown field, and a bad patch after a valid preset.
    ["createdWith 5", { patch: {}, createdWith: 5 }, TypeError],
    ["a change with an unknown field", { patch: {}, createdWith: "lexicon", by: 1 }, RangeError],
    [
      "preset editorial with patch { foo: 1 }",
      { preset: "editorial", patch: { foo: 1 }, createdWith: "lexicon" },
      RangeError,
    ],
  ])("C-STOR4-09 %s throws, naming applyAi, and leaves the state as it was", (_, change, kind) => {
    const { store, stub } = makeStore();
    store.getState().setView({ mode: "dark" });
    const before = store.getState();
    const error = thrown(() => store.getState().applyAi(change as never));
    expect(error).toBeInstanceOf(kind);
    expect(error.message).toMatch(/^applyAi: /);
    expect(store.getState()).toBe(before);
    expect(stub.posted).toEqual([]);
  });

  it("C-STOR4-09 options that are not an object throw a TypeError naming applyAi", () => {
    const { store } = makeStore();
    const before = store.getState();
    const error = thrown(() =>
      store.getState().applyAi({ patch: {}, createdWith: "lexicon" }, { coalesce: 5 } as never),
    );
    expect(error).toBeInstanceOf(TypeError);
    expect(error.message).toMatch(/^applyAi: options\.coalesce/);
    expect(store.getState()).toBe(before);
  });

  it("C-STOR4-10 on a controls design every request of M2's actions is { id, params, seed }", () => {
    const { store, stub, clock } = makeStore();
    const actions: ((studio: Studio) => void)[] = [
      (studio) => studio.setParams({ radius: "round" }),
      (studio) => studio.applyPreset("bento"),
      (studio) => studio.regenerate(),
      (studio) => studio.toggleLock("primary"),
      (studio) => studio.toggleLock("primary"),
      (studio) => studio.rebuild(),
      (studio) => {
        studio.setSeedColor("accent", "#b8422e");
      },
      (studio) => studio.startFresh(),
    ];
    for (const action of actions) {
      action(store.getState());
      replyStamped(stub, lastPosted(stub).id);
      clock.advance(2_000);
    }
    expect(stub.posted).toHaveLength(actions.length);
    for (const request of stub.posted) {
      expect(keysOf(request)).toEqual(["id", "params", "seed"]);
      expect(request).toStrictEqual({ id: request.id, params: request.params, seed: request.seed });
    }
    expect(store.getState().createdWith).toBe("controls");
  });
});
