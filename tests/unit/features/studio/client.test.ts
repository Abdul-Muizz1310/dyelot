import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clientOver,
  createGenerateClient,
  createInlineClient,
  createStudioClient,
  spawnGenerateWorker,
  type WorkerLike,
} from "@/features/studio/client";
import type { GenerateReply, GenerateRequest } from "@/features/studio/protocol";
import { writeHash } from "@/features/studio/url";
import { withValue } from "../../spec/support";
import { makeStore } from "./store-support";
import { FRESH_PARAMS, fakeLocation, freshSpec, resolvedFresh } from "./support";

// Cases are C-WORK-10, C-WORK-13 and C-WORK-14 of docs/specs/02-studio.md, section 6.7 (R2-13 item
// 2, R2-29): one request in flight, at most one pending, the latest wins. C-WORK-15 and C-WORK-16
// put this client in front of the store and live in store-replies.test.ts.

/** A request with bad params: the generator answers it at once with an error, so it is cheap. */
const cheap = (id: number): GenerateRequest => ({
  id,
  params: { ...FRESH_PARAMS, chroma: "loud" as never },
  seed: "seed-1",
});
const ok = (id: number): GenerateReply => ({ id, ok: true, spec: freshSpec() });

/** Lets queued microtasks run. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("createGenerateClient", () => {
  it("C-WORK-13 posts the first of five requests at once, then only the fifth", () => {
    const posted: number[] = [];
    const client = createGenerateClient((request) => posted.push(request.id));
    for (let id = 1; id <= 5; id++) client.request(cheap(id));
    expect(posted).toEqual([1]);
    client.reply(ok(1));
    expect(posted).toEqual([1, 5]);
    client.reply(ok(5));
    expect(posted).toEqual([1, 5]);
  });

  it("C-WORK-14 posts nothing on a reply with no pending request", () => {
    const posted: number[] = [];
    const client = createGenerateClient((request) => posted.push(request.id));
    client.request(cheap(1));
    client.reply(ok(1));
    expect(posted).toEqual([1]);
    client.request(cheap(2));
    expect(posted).toEqual([1, 2]);
  });

  it("C-WORK-14 posts a pending request exactly once, even when its trigger repeats", () => {
    const posted: number[] = [];
    const client = createGenerateClient((request) => posted.push(request.id));
    client.request(cheap(1));
    client.request(cheap(2));
    client.reply(ok(1));
    client.reply(ok(1));
    expect(posted).toEqual([1, 2]);
  });

  it("ignores a reply for a request that is not in flight, so the slot stays taken", () => {
    const posted: number[] = [];
    const client = createGenerateClient((request) => posted.push(request.id));
    client.request(cheap(3));
    client.request(cheap(4));
    client.reply(ok(2));
    client.reply(ok(4));
    expect(posted).toEqual([3]);
    client.reply(ok(3));
    expect(posted).toEqual([3, 4]);
  });

  it("leaves nothing in flight when post throws, so the next request posts", () => {
    const posted: number[] = [];
    let fail = true;
    const client = createGenerateClient((request) => {
      if (fail) throw new Error("DataCloneError");
      posted.push(request.id);
    });
    expect(() => client.request(cheap(1))).toThrow("DataCloneError");
    fail = false;
    client.request(cheap(2));
    expect(posted).toEqual([2]);
  });

  it("frees the slot when post replies at once, before post returns (I1)", () => {
    const posted: number[] = [];
    let client: ReturnType<typeof createGenerateClient> | undefined;
    client = createGenerateClient((request) => {
      posted.push(request.id);
      client?.reply(ok(request.id));
    });
    for (let id = 1; id <= 3; id++) client.request(cheap(id));
    expect(posted).toEqual([1, 2, 3]);
  });

  it("drop clears the pending request and leaves the one in flight (M2)", () => {
    const posted: number[] = [];
    const client = createGenerateClient((request) => posted.push(request.id));
    client.request(cheap(1));
    client.request(cheap(2));
    client.drop();
    client.reply(ok(1));
    expect(posted).toEqual([1]);
    client.drop();
    client.request(cheap(3));
    expect(posted).toEqual([1, 3]);
  });

  it("rejects ids that do not increase, a request that is not one, and a post that is not a function", () => {
    const client = createGenerateClient(() => {});
    client.request(cheap(2));
    expect(() => client.request(cheap(2))).toThrow(RangeError);
    expect(() => client.request(cheap(1))).toThrow(/^createGenerateClient: request.id/);
    expect(() => client.request(cheap(0))).toThrow(RangeError);
    expect(() => client.request(null as never)).toThrow(TypeError);
    expect(() => client.reply(null as never)).toThrow(TypeError);
    expect(() => createGenerateClient(null as never)).toThrow(TypeError);
    expect(() => createGenerateClient(null as never)).toThrow(/^createGenerateClient: post/);
  });
});

describe("clientOver", () => {
  /** A transport the test answers by hand. */
  function manual() {
    const sent: GenerateRequest[] = [];
    let deliver: (reply: GenerateReply) => void = () => {};
    let closed = 0;
    const client = clientOver((onReply) => {
      deliver = onReply;
      return { send: (request) => sent.push(request), close: () => closed++ };
    });
    return {
      client,
      sent,
      deliver: (reply: GenerateReply) => deliver(reply),
      closed: () => closed,
    };
  }

  it("keeps the queue moving when the transport replies inside send (I1)", () => {
    const sent: number[] = [];
    const heard: number[] = [];
    const client = clientOver((deliver) => ({
      send: (request) => {
        sent.push(request.id);
        deliver(ok(request.id));
      },
      close() {},
    }));
    client.subscribe((reply) => heard.push(reply.id));
    for (let id = 1; id <= 3; id++) client.request(cheap(id));
    expect(sent).toEqual([1, 2, 3]);
    expect(heard).toEqual([1, 2, 3]);
  });

  it("hands a reply to the subscribers even when posting the pending request throws (M3)", () => {
    const sent: number[] = [];
    let deliver: (reply: GenerateReply) => void = () => {};
    const client = clientOver((onReply) => {
      deliver = onReply;
      return {
        send: (request) => {
          if (request.id === 2) throw new Error("DataCloneError");
          sent.push(request.id);
        },
        close() {},
      };
    });
    const heard: number[] = [];
    client.subscribe((reply) => heard.push(reply.id));
    client.request(cheap(1));
    client.request(cheap(2));
    expect(() => deliver(ok(1))).toThrow("DataCloneError");
    expect(heard).toEqual([1]);
    client.request(cheap(3));
    expect(sent).toEqual([1, 3]);
  });

  it("drop forgets the pending request, so the reply in flight posts nothing (M2)", () => {
    const { client, sent, deliver } = manual();
    client.request(cheap(1));
    client.request(cheap(2));
    client.drop();
    deliver(ok(1));
    expect(sent.map((r) => r.id)).toEqual([1]);
    client.request(cheap(3));
    expect(sent.map((r) => r.id)).toEqual([1, 3]);
  });

  it("hands every reply to the subscribers and posts the pending request", () => {
    const { client, sent, deliver } = manual();
    const heard: number[] = [];
    client.subscribe((reply) => heard.push(reply.id));
    client.request(cheap(1));
    client.request(cheap(2));
    client.request(cheap(3));
    expect(sent.map((r) => r.id)).toEqual([1]);
    deliver(ok(1));
    expect(heard).toEqual([1]);
    expect(sent.map((r) => r.id)).toEqual([1, 3]);
  });

  it("stops after an unsubscribe and after dispose, and closes the transport once", () => {
    const { client, sent, deliver, closed } = manual();
    const heard: number[] = [];
    const unsubscribe = client.subscribe((reply) => heard.push(reply.id));
    client.request(cheap(1));
    unsubscribe();
    deliver(ok(1));
    expect(heard).toEqual([]);
    client.subscribe((reply) => heard.push(reply.id));
    client.request(cheap(2));
    client.dispose();
    client.dispose();
    deliver(ok(2));
    client.request(cheap(3));
    expect(heard).toEqual([]);
    expect(sent.map((r) => r.id)).toEqual([1, 2]);
    expect(closed()).toBe(1);
  });

  it("generates now on the calling thread, and throws what the generator throws", () => {
    const { client, sent } = manual();
    expect(client.generateNow(resolvedFresh(), "seed-1")).toEqual(freshSpec());
    expect(() => client.generateNow(resolvedFresh(), "")).toThrow(RangeError);
    expect(sent).toEqual([]);
  });

  it("rejects a listener that is not a function", () => {
    expect(() => manual().client.subscribe(null as never)).toThrow(TypeError);
  });
});

describe("createInlineClient", () => {
  it("C-WORK-10 answers asynchronously with runGenerate and the same id handling", async () => {
    const client = createInlineClient();
    const heard: GenerateReply[] = [];
    client.subscribe((reply) => heard.push(reply));
    client.request(cheap(1));
    client.request(cheap(2));
    client.request(cheap(3));
    expect(heard).toEqual([]);
    await settle();
    expect(heard.map((reply) => reply.id)).toEqual([1, 3]);
    expect(heard.every((reply) => !reply.ok)).toBe(true);
  });

  it("delivers nothing after dispose", async () => {
    const client = createInlineClient();
    const heard: number[] = [];
    client.subscribe((reply) => heard.push(reply.id));
    client.request(cheap(1));
    client.dispose();
    await settle();
    expect(heard).toEqual([]);
  });
});

/** A Worker the test drives: it records posts and lets the test fire its events. */
class FakeWorker {
  readonly posted: unknown[] = [];
  readonly listeners = new Map<
    string,
    ((event: { data?: unknown; preventDefault?(): void }) => void)[]
  >();
  terminated = 0;
  postMessage(message: unknown) {
    this.posted.push(message);
  }
  addEventListener(type: string, listener: (event: { data?: unknown }) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  terminate() {
    this.terminated++;
  }
  emit(type: string, event: { data?: unknown; preventDefault?(): void } = {}) {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

describe("createStudioClient", () => {
  it("C-WORK-10 falls back to the inline client when Worker is undefined", async () => {
    expect(typeof Worker).toBe("undefined");
    const client = createStudioClient();
    const heard: number[] = [];
    client.subscribe((reply) => heard.push(reply.id));
    client.request(cheap(1));
    await settle();
    expect(heard).toEqual([1]);
  });

  it("C-WORK-10 falls back to the inline client when the Worker constructor throws", async () => {
    const client = createStudioClient(() => {
      throw new DOMException("blocked by the content security policy", "SecurityError");
    });
    const heard: number[] = [];
    client.subscribe((reply) => heard.push(reply.id));
    client.request(cheap(1));
    client.request(cheap(2));
    await settle();
    expect(heard).toEqual([1, 2]);
  });

  it("posts requests to the worker and hands its parsed replies on, one in flight", () => {
    const worker = new FakeWorker();
    const client = createStudioClient(() => worker as WorkerLike);
    const heard: GenerateReply[] = [];
    client.subscribe((reply) => heard.push(reply));
    client.request(cheap(1));
    client.request(cheap(2));
    client.request(cheap(3));
    expect(worker.posted).toEqual([cheap(1)]);
    worker.emit("message", { data: ok(1) });
    expect(heard).toEqual([ok(1)]);
    expect(worker.posted).toEqual([cheap(1), cheap(3)]);
    client.dispose();
    expect(worker.terminated).toBe(1);
    worker.emit("message", { data: ok(3) });
    expect(heard).toEqual([ok(1)]);
  });

  it("hands a worker reply whose spec fails the schema on; the store rejects it (M4, C-WORK-08)", () => {
    const worker = new FakeWorker();
    const client = createStudioClient(() => worker as WorkerLike);
    const { store } = makeStore({
      client,
      location: fakeLocation(writeHash(freshSpec())).location,
    });
    store.getState().setParams({ radius: "round" });
    expect(worker.posted).toHaveLength(1);
    const broken = withValue(freshSpec(), ["color", "roles", "light", "ring"], "#FFF");
    worker.emit("message", { data: { id: 1, ok: true, spec: broken } });
    const { spec, status } = store.getState();
    expect(spec).toEqual(freshSpec());
    expect(status.phase).toBe("failed");
    expect(status.notice).toEqual({
      kind: "generation",
      message: expect.stringContaining("color.roles.light.ring"),
    });
  });

  it.each([
    ["an error event", "error", {}],
    ["a messageerror event", "messageerror", {}],
    ["an unreadable reply", "message", { data: "garbage" }],
  ])(
    "moves to the main thread after %s and reruns the request in flight",
    async (_, type, event) => {
      const logged = vi.spyOn(console, "error").mockImplementation(() => {});
      const worker = new FakeWorker();
      const client = createStudioClient(() => worker as WorkerLike);
      const heard: number[] = [];
      client.subscribe((reply) => heard.push(reply.id));
      client.request(cheap(1));
      client.request(cheap(2));
      const preventDefault = vi.fn();
      worker.emit(type, { ...event, preventDefault });
      expect(worker.terminated).toBe(1);
      expect(logged).toHaveBeenCalledOnce();
      expect(logged.mock.calls[0]?.[0]).toMatch(/generator worker failed/);
      if (type === "error") expect(preventDefault).toHaveBeenCalled();
      await settle();
      await settle();
      expect(heard).toEqual([1, 2]);
      client.request(cheap(3));
      await settle();
      expect(heard).toEqual([1, 2, 3]);
      expect(worker.posted).toEqual([cheap(1)]);
      worker.emit("error", {});
      expect(logged).toHaveBeenCalledOnce();
    },
  );

  it("keeps the request in flight after a stray reply, and reruns that one if the worker fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const worker = new FakeWorker();
    const client = createStudioClient(() => worker as WorkerLike);
    const heard: number[] = [];
    client.subscribe((reply) => heard.push(reply.id));
    client.request(cheap(4));
    worker.emit("message", { data: ok(3) });
    expect(heard).toEqual([3]);
    worker.emit("error", {});
    await settle();
    expect(heard).toEqual([3, 4]);
  });

  it("does not terminate a worker twice when it failed before dispose", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const worker = new FakeWorker();
    const client = createStudioClient(() => worker as WorkerLike);
    worker.emit("error", {});
    client.dispose();
    expect(worker.terminated).toBe(1);
  });
});

describe("spawnGenerateWorker", () => {
  it("builds a module worker from generate.worker.ts next to the client", () => {
    const built: { url: string; options: unknown }[] = [];
    vi.stubGlobal(
      "Worker",
      class {
        constructor(url: URL | string, options: unknown) {
          built.push({ url: String(url), options });
        }
      },
    );
    spawnGenerateWorker();
    expect(built).toHaveLength(1);
    expect(built[0]?.url).toMatch(/\/src\/features\/studio\/generate\.worker\.ts(\?.*)?$/);
    expect(built[0]?.options).toEqual({ type: "module" });
  });
});
