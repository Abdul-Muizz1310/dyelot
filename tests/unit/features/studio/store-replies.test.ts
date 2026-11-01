import { afterEach, describe, expect, it, vi } from "vitest";
import { clientOver, type StudioClient } from "@/features/studio/client";
import type { GenerateReply, GenerateRequest } from "@/features/studio/protocol";
import { writeHash } from "@/features/studio/url";
import { type DesignSpec, normalizeSpec } from "@/spec";
import { without } from "../../spec/support";
import { fakeSpec, lastPosted, makeStore, type Stub } from "./store-support";
import { fakeLocation, freshSpec, seedSequence } from "./support";

// Cases are C-WORK-03 to C-WORK-09, C-WORK-15, C-WORK-16, C-STORE-14, C-STORE-24 and C-STORE-40 of
// docs/specs/02-studio.md, section 6.7 (Review Focus 4, R2-13 item 3, R2-29): replies in any order
// never leave the canvas on a stale spec.

/** The id a fake reply wrote into `meta.name`: which request the held spec came from. */
const sourceOf = (spec: DesignSpec): string => spec.meta.name;

/** Issues `count` changes with distinct parameters, so each posts a request. */
function issue(stub: Stub, change: (i: number) => void, count: number): number[] {
  const before = stub.posted.length;
  for (let i = 0; i < count; i++) change(i);
  return stub.posted.slice(before).map((request) => request.id);
}

const radii = ["round", "sharp", "soft"] as const;

afterEach(() => {
  vi.useRealTimers();
});

describe("out-of-order replies (RF4)", () => {
  it("C-WORK-03 replies 2, 3, 1: request 3's spec stays, reply 1 changes nothing, two apply", () => {
    const { store, stub } = makeStore();
    const ids = issue(stub, (i) => store.getState().setParams({ radius: radii[i] }), 3);
    expect(ids).toEqual([1, 2, 3]);
    stub.reply(2);
    expect(sourceOf(store.getState().spec)).toBe("r2");
    stub.reply(3);
    expect(sourceOf(store.getState().spec)).toBe("r3");
    const settled = store.getState();
    stub.reply(1);
    expect(store.getState()).toBe(settled);
    expect(store.getState().history).toHaveLength(2);
    expect(store.getState().params.radius).toBe("soft");
  });

  it("C-WORK-04 replies 3, 2, 1: only reply 3 applies", () => {
    const { store, stub } = makeStore();
    issue(stub, (i) => store.getState().setParams({ radius: radii[i] }), 3);
    stub.reply(3);
    const settled = store.getState();
    stub.reply(2);
    stub.reply(1);
    expect(store.getState()).toBe(settled);
    expect(sourceOf(settled.spec)).toBe("r3");
    expect(settled.history).toHaveLength(1);
  });

  it("C-WORK-05 replies 1, 2, 3 in order each apply", () => {
    const { store, stub } = makeStore();
    issue(stub, (i) => store.getState().setParams({ radius: radii[i] }), 3);
    for (const id of [1, 2, 3]) {
      stub.reply(id);
      expect(sourceOf(store.getState().spec)).toBe(`r${id}`);
    }
    expect(store.getState().history).toHaveLength(3);
  });

  it("C-WORK-05 with one coalesce key, in-order replies commit as one entry", () => {
    const { store, stub, clock } = makeStore();
    issue(
      stub,
      (i) => {
        clock.advance(100);
        store.getState().setParams({ radius: radii[i] }, { coalesce: "radius" });
      },
      3,
    );
    for (const id of [1, 2, 3]) stub.reply(id);
    expect(store.getState().history).toHaveLength(1);
    expect(sourceOf(store.getState().spec)).toBe("r3");
  });

  it("C-WORK-06 drops a duplicate reply and a reply above the newest issued id", () => {
    const { store, stub } = makeStore();
    issue(stub, (i) => store.getState().setParams({ radius: radii[i] }), 2);
    stub.reply(1);
    const settled = store.getState();
    stub.reply(1);
    stub.deliver({ id: 3, ok: true, spec: freshSpec() });
    stub.deliver({ id: 99, ok: false, error: { name: "Error", message: "x" } });
    expect(store.getState()).toBe(settled);
    stub.reply(2);
    expect(sourceOf(store.getState().spec)).toBe("r2");
  });

  it("C-WORK-07 drops an error reply that is not newer than the last applied, with no notice", () => {
    const { store, stub } = makeStore();
    issue(stub, (i) => store.getState().setParams({ radius: radii[i] }), 2);
    stub.reply(2);
    const settled = store.getState();
    stub.fail(1);
    stub.fail(2);
    expect(store.getState()).toBe(settled);
    expect(settled.status).toMatchObject({ phase: "idle", notice: null });
  });

  it("leaves an older error reply to the newer request, which then decides", () => {
    const { store, stub } = makeStore();
    issue(stub, (i) => store.getState().setParams({ radius: radii[i] }), 2);
    stub.fail(1);
    expect(store.getState().status).toMatchObject({ phase: "generating", notice: null });
    stub.reply(2);
    expect(store.getState().status).toMatchObject({ phase: "idle", notice: null });
    expect(sourceOf(store.getState().spec)).toBe("r2");
  });

  it("C-WORK-08 drops a reply whose spec fails normalizeSpec and sets a failed status", () => {
    const { store, stub } = makeStore();
    store.getState().setParams({ radius: "round" });
    const broken = without(fakeSpec(lastPosted(stub), freshSpec), [
      "color",
      "roles",
      "light",
      "ring",
    ]);
    stub.reply(1, broken as DesignSpec);
    const state = store.getState();
    expect(state.spec).toEqual(freshSpec());
    expect(state.history).toEqual([]);
    expect(state.status.phase).toBe("failed");
    expect(state.status.notice).toEqual({
      kind: "generation",
      message: expect.stringContaining("color.roles.light.ring"),
    });
  });

  it("C-WORK-09 every applied spec has passed normalizeSpec", () => {
    const { store, stub } = makeStore();
    store.getState().setParams({ radius: "round" });
    const raw = fakeSpec(lastPosted(stub), freshSpec);
    expect(raw.color.palettes.primary.light[0].oklch.l).toBe(0.97123456789);
    stub.reply(1, raw);
    const { spec } = store.getState();
    expect(spec.color.palettes.primary.light[0].oklch.l).toBe(0.971235);
    expect(spec).toEqual(normalizeSpec(raw));
    expect(store.getState().history[0]?.spec).toEqual(freshSpec());
  });
});

describe("superseded in-flight replies", () => {
  it("C-STORE-14 a reply issued before an undo is dropped", () => {
    const { store, stub } = makeStore();
    issue(stub, () => store.getState().setParams({ radius: "round" }), 1);
    stub.reply(1);
    store.getState().setParams({ chroma: "vivid" });
    store.getState().undo();
    const undone = store.getState();
    stub.reply(2);
    expect(store.getState()).toBe(undone);
    expect(undone.spec).toEqual(freshSpec());
    expect(undone.status.phase).toBe("idle");
  });

  it("C-STORE-14 a reply issued before a redo is dropped", () => {
    const { store, stub } = makeStore();
    issue(stub, () => store.getState().setParams({ radius: "round" }), 1);
    stub.reply(1);
    store.getState().undo();
    store.getState().setParams({ chroma: "vivid" });
    store.getState().redo();
    const redone = store.getState();
    stub.reply(2);
    expect(store.getState()).toBe(redone);
    expect(sourceOf(redone.spec)).toBe("r1");
  });

  it("drops a reply issued before loadFromHash and before revert", () => {
    const { store, stub } = makeStore();
    store.getState().setParams({ radius: "round" });
    const other = fakeSpec({ id: 9, params: lastPosted(stub).params, seed: "seed-9" }, freshSpec);
    store.getState().loadFromHash(writeHash(normalizeSpec(other)));
    stub.reply(1);
    expect(sourceOf(store.getState().spec)).toBe("r9");
    store.getState().setParams({ radius: "sharp" });
    store.getState().revert();
    stub.reply(2);
    expect(sourceOf(store.getState().spec)).toBe("r9");
    expect(store.getState().status.phase).toBe("idle");
  });

  it("C-STORE-24 is generating while the newest request is pending, idle once its reply applies", () => {
    const { store, stub } = makeStore();
    expect(store.getState().status.phase).toBe("idle");
    issue(stub, (i) => store.getState().setParams({ radius: radii[i] }), 2);
    expect(store.getState().status.phase).toBe("generating");
    stub.reply(1);
    expect(store.getState().status.phase).toBe("generating");
    stub.reply(2);
    expect(store.getState().status.phase).toBe("idle");
  });

  it("C-STORE-40 startFresh drops replies issued before it and applies its own", () => {
    const { store, stub } = makeStore({ newSeed: seedSequence("seed-1", "seed-5") });
    store.getState().setParams({ radius: "round" });
    store.getState().startFresh();
    expect(lastPosted(stub)).toMatchObject({ id: 2, seed: "seed-5" });
    stub.reply(1);
    expect(store.getState().spec).toEqual(freshSpec());
    stub.reply(2);
    expect(sourceOf(store.getState().spec)).toBe("r2");
    expect(store.getState().seed).toBe("seed-5");
  });

  it("applies a reply that arrives inside the request call", () => {
    const sync: StudioClient = {
      generateNow: () => freshSpec(),
      request: (request) =>
        listener?.({ id: request.id, ok: true, spec: fakeSpec(request, freshSpec) }),
      subscribe: (next) => {
        listener = next;
        return () => {
          listener = undefined;
        };
      },
      dispose: () => {},
    };
    let listener: ((reply: GenerateReply) => void) | undefined;
    const { store } = makeStore({ client: sync });
    store.getState().setParams({ radius: "round" });
    expect(store.getState().status.phase).toBe("idle");
    expect(sourceOf(store.getState().spec)).toBe("r1");
    expect(store.getState().history).toHaveLength(1);
  });
});

describe("the store behind createGenerateClient (R2-29)", () => {
  /** A client over a transport that replies after `delay` ms of fake time with a fake spec. */
  function slowClient(delay: number) {
    const sent: GenerateRequest[] = [];
    const client = clientOver((deliver) => ({
      send(request) {
        sent.push(request);
        setTimeout(
          () => deliver({ id: request.id, ok: true, spec: fakeSpec(request, freshSpec) }),
          delay,
        );
      },
      close() {},
    }));
    return { client, sent };
  }

  /** A store that opens FRESH's spec from a link, so it generates nothing on first load. */
  const linked = () => fakeLocation(writeHash(freshSpec())).location;

  it("C-WORK-15 keeps ids increasing across superseded requests, and the reply rule holds", () => {
    vi.useFakeTimers();
    const { client, sent } = slowClient(200);
    const { store } = makeStore({ client, location: linked() });
    for (const radius of ["round", "sharp", "soft", "round", "sharp"] as const) {
      store.getState().setParams({ radius });
    }
    expect(sent.map((request) => request.id)).toEqual([1]);
    vi.advanceTimersByTime(200);
    expect(sourceOf(store.getState().spec)).toBe("r1");
    expect(sent.map((request) => request.id)).toEqual([1, 5]);
    store.getState().setParams({ radius: "round" });
    vi.advanceTimersByTime(400);
    expect(sent.map((request) => request.id)).toEqual([1, 5, 6]);
    expect(sourceOf(store.getState().spec)).toBe("r6");
    expect(store.getState().history).toHaveLength(3);
    expect(store.getState().status.phase).toBe("idle");
  });

  it("C-WORK-16 30 requests in 1 s against a 200 ms worker post at most 6, and request 30's reply lands last", () => {
    vi.useFakeTimers();
    const { client, sent } = slowClient(200);
    const { store, clock } = makeStore({ client, location: linked() });
    for (let i = 0; i < 30; i++) {
      store.getState().regenerate();
      clock.advance(33);
      vi.advanceTimersByTime(33);
    }
    vi.advanceTimersByTime(1_000);
    expect(sent.length).toBeLessThanOrEqual(6);
    expect(sent[sent.length - 1]?.id).toBe(30);
    expect(sourceOf(store.getState().spec)).toBe("r30");
    expect(store.getState().seed).toBe(sent[sent.length - 1]?.seed);
    expect(store.getState().status.phase).toBe("idle");
    expect(store.getState().history).toHaveLength(1);
  });
});
