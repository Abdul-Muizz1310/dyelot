import { type DirectionParams, generateSystem } from "@/engine";
import type { DesignSpec } from "@/spec";
import { assertRecord, describeType } from "./guards";
import { type GenerateReply, type GenerateRequest, parseReply, runGenerate } from "./protocol";

// The store's way to the generator (spec R2-13 item 2, R2-29). `createGenerateClient` keeps one
// request in flight and at most one pending, so holding Space never lines stale work up behind
// the newest request. The browser client runs the generator in a Web Worker; when `Worker` is
// missing or its constructor throws, an inline client runs it on a microtask, with the same ids.

/** One request in flight, at most one pending: the latest wins (R2-29). */
export type GenerateFlow = {
  /** Posts the request now, or makes it the one pending request, replacing any other. */
  request(request: GenerateRequest): void;
  /** Call when a reply arrives: it frees the slot and posts the pending request, if any. */
  reply(reply: GenerateReply): void;
  /** Forgets the pending request; the one in flight stays in flight. */
  drop(): void;
};

/**
 * Flow control in front of `post`. A request is posted only when none is in flight; while one is,
 * a new request replaces the pending one, so a superseded request is never posted. The reply for
 * the request in flight posts the pending request. A reply for any other id changes nothing: a
 * duplicate never frees the slot twice. Ids must increase (the store numbers them 1, 2, 3). The
 * slot is taken before `post` runs, so a transport that replies inside `post` frees it at once; a
 * `post` that throws leaves the slot free.
 */
export function createGenerateClient(post: (request: GenerateRequest) => void): GenerateFlow {
  if (typeof post !== "function") {
    throw new TypeError(`createGenerateClient: post must be a function, got ${describeType(post)}`);
  }
  let inFlight: number | null = null;
  let pending: GenerateRequest | null = null;
  let lastId = 0;
  const send = (request: GenerateRequest) => {
    inFlight = request.id;
    try {
      post(request);
    } catch (error) {
      if (inFlight === request.id) inFlight = null;
      throw error;
    }
  };
  return {
    request(request) {
      assertRecord(request, "createGenerateClient: request");
      const { id } = request;
      if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= lastId) {
        throw new RangeError(
          `createGenerateClient: request.id must be an integer above ${lastId}, got ${String(id)}`,
        );
      }
      lastId = id;
      if (inFlight === null) send(request);
      else pending = request;
    },
    reply(reply) {
      assertRecord(reply, "createGenerateClient: reply");
      if (reply.id !== inFlight) return;
      inFlight = null;
      const next = pending;
      pending = null;
      if (next !== null) send(next);
    },
    drop() {
      pending = null;
    },
  };
}

/** What the store calls (its `deps.client`): the generator, the replies and a stop. */
export type StudioClient = {
  /**
   * Generates on the calling thread and throws what the generator throws. Only for the first load's
   * fresh design, which has nothing to show before it; every change goes through `request`.
   */
  generateNow(params: DirectionParams, seed: string): DesignSpec;
  /** Asks for a spec; the reply comes later, through the subscribers. */
  request(request: GenerateRequest): void;
  /** Hears every reply; returns the unsubscribe. */
  subscribe(listener: (reply: GenerateReply) => void): () => void;
  /** Forgets the pending request: undo, redo, a load, start fresh and revert supersede it. */
  drop(): void;
  /** Stops the client: nothing is posted or delivered afterwards. */
  dispose(): void;
};

/** Where requests go: a worker, a microtask, or a test's hand. */
export type Transport = { send(request: GenerateRequest): void; close(): void };

/**
 * A `StudioClient` over a transport. `open` receives the function the transport calls with each
 * reply; the client puts `createGenerateClient` in front of `send`, so the transport sees at most
 * one request at a time.
 */
export function clientOver(
  open: (deliver: (reply: GenerateReply) => void) => Transport,
): StudioClient {
  const listeners = new Set<(reply: GenerateReply) => void>();
  let closed = false;
  const transport = open((reply) => {
    if (closed) return;
    try {
      flow.reply(reply);
    } finally {
      // A pending request that cannot be posted must not hide the reply that arrived.
      for (const listener of [...listeners]) listener(reply);
    }
  });
  const flow = createGenerateClient((request) => transport.send(request));
  return {
    generateNow: (params, seed) => generateSystem(params, seed),
    request(request) {
      if (!closed) flow.request(request);
    },
    drop() {
      flow.drop();
    },
    subscribe(listener) {
      if (typeof listener !== "function") {
        throw new TypeError(
          `subscribe: listener must be a function, got ${describeType(listener)}`,
        );
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      if (closed) return;
      closed = true;
      listeners.clear();
      transport.close();
    },
  };
}

/** Runs `runGenerate` on a microtask, so a reply never arrives inside the call that asked for it. */
const inlineSend =
  (deliver: (reply: GenerateReply) => void) =>
  (request: GenerateRequest): void => {
    queueMicrotask(() => deliver(runGenerate(request)));
  };

/** The client without a worker (R2-13 item 2): the same ids and flow, on the main thread. */
export function createInlineClient(): StudioClient {
  return clientOver((deliver) => ({ send: inlineSend(deliver), close() {} }));
}

type WorkerEvent = { readonly data?: unknown; preventDefault?(): void };

/** The part of `Worker` the client uses. */
export type WorkerLike = {
  postMessage(message: GenerateRequest): void;
  addEventListener(
    type: "message" | "error" | "messageerror",
    listener: (event: WorkerEvent) => void,
  ): void;
  terminate(): void;
};

/**
 * The generator's worker. Turbopack bundles a worker from `new Worker(new URL(...,
 * import.meta.url))` written in this form (Next.js docs: `03-api-reference/08-turbopack.md`, magic
 * comments and `turbopackWorkerAssetPrefix`): `next build` emits a same-origin
 * `turbopack-worker-*.js` bootstrap that loads the module chunks with `importScripts`, so Turbopack
 * starts it as a classic worker and drops `type`. The CSP allows `worker-src 'self' blob:`.
 */
export function spawnGenerateWorker(): WorkerLike {
  return new Worker(new URL("./generate.worker.ts", import.meta.url), { type: "module" });
}

/**
 * A worker transport. If the worker fails (it does not load, a reply cannot be cloned or read), the
 * transport says so on the console, ends the worker, reruns the request in flight inline and stays
 * inline: the studio keeps working instead of waiting for a reply that will not come.
 */
function workerTransport(worker: WorkerLike, deliver: (reply: GenerateReply) => void): Transport {
  let current: GenerateRequest | null = null;
  let inline = false;
  const settle = (reply: GenerateReply) => {
    if (current?.id === reply.id) current = null;
    deliver(reply);
  };
  const runInline = inlineSend(settle);
  const fail = (what: string) => {
    if (inline) return;
    inline = true;
    worker.terminate();
    console.error(
      `dyelot studio: the generator worker failed (${what}); generating on the main thread.`,
    );
    if (current !== null) runInline(current);
  };
  worker.addEventListener("message", (event) => {
    const reply = parseReply(event.data);
    if (reply === null) fail("an unreadable reply");
    else settle(reply);
  });
  worker.addEventListener("error", (event) => {
    // The failure is handled here: keep the browser from reporting it as uncaught.
    event.preventDefault?.();
    fail("error");
  });
  worker.addEventListener("messageerror", () => fail("messageerror"));
  return {
    send(request) {
      current = request;
      if (inline) runInline(request);
      else worker.postMessage(request);
    },
    close() {
      if (!inline) worker.terminate();
      inline = true;
    },
  };
}

/**
 * The browser's client: the generator in a Web Worker, or the inline client when `Worker` is
 * missing or `spawn` throws (R2-13 item 2).
 */
export function createStudioClient(spawn: () => WorkerLike = spawnGenerateWorker): StudioClient {
  let worker: WorkerLike;
  try {
    worker = spawn();
  } catch {
    return createInlineClient();
  }
  return clientOver((deliver) => workerTransport(worker, deliver));
}
