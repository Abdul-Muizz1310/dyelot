import { afterEach, describe, expect, it, vi } from "vitest";
import { createCascadeGate, readGuard } from "@/server/ai/guard";
import { TEST_KEY } from "../ai/fixtures";
import { abortable, never, recording, settled } from "./fetch-fakes";

// C-QUOTA-01 of docs/specs/04-ai.md, section 14.7: the guard's read of OpenRouter's `GET /key`
// (R4-16, section 11.3), with an injected fetch that records its calls and fake timers. C-GATE-01:
// the cascade gate's piece alone (R4-17 (b), section 11.3); Task 4.7b checks the route's use of it
// (C-ROUTE-13).

const BASE = "http://127.0.0.1:3199/api/v1";
/** C-AI-20's body. */
const keyBody = (remaining: unknown) => ({
  data: { free_model_daily_requests: { used: 12, limit: 50, remaining } },
});
const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

type GuardArgs = Parameters<typeof readGuard>[0];
const argsFor = (fetch: typeof globalThis.fetch, timeoutMs = 5000): GuardArgs => ({
  fetch,
  baseUrl: BASE,
  apiKey: TEST_KEY,
  timeoutMs,
});

afterEach(() => {
  vi.useRealTimers();
});

describe("C-QUOTA-01 readGuard reads GET {base}/key", () => {
  it("C-QUOTA-01 sends GET {base}/key with the bearer key and returns 38 for C-AI-20's body", async () => {
    const { calls, fetch } = recording(() => json(keyBody(38)));
    await expect(readGuard(argsFor(fetch))).resolves.toBe(38);
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call?.url).toBe(`${BASE}/key`);
    expect(call?.init.method).toBe("GET");
    expect(call?.init.headers).toStrictEqual({ Authorization: `Bearer ${TEST_KEY}` });
    expect(call?.init.body).toBeUndefined();
    expect(call?.init.signal).toBeInstanceOf(AbortSignal);
    expect(call?.init.signal?.aborted).toBe(false);
  });

  it('C-QUOTA-01 never lets the bearer key follow a redirect: redirect is "error"', async () => {
    const { calls, fetch } = recording(() => json(keyBody(38)));
    await readGuard(argsFor(fetch));
    expect(calls[0]?.init.redirect).toBe("error");
  });

  it("C-QUOTA-01 asks Next.js never to cache the read", async () => {
    const { calls, fetch } = recording(() => json(keyBody(38)));
    await readGuard(argsFor(fetch));
    expect(calls[0]?.init.cache).toBe("no-store");
  });

  it("C-QUOTA-01 returns 0 and 50 as read, and null for a field readKeyRemaining refuses", async () => {
    for (const [remaining, expected] of [
      [0, 0],
      [50, 50],
      ["38", null],
      [-1, null],
      [undefined, null],
    ] as const) {
      const { fetch } = recording(() => json(keyBody(remaining)));
      await expect(readGuard(argsFor(fetch)), String(remaining)).resolves.toBe(expected);
    }
    const { fetch } = recording(() => json({ data: {} }));
    await expect(readGuard(argsFor(fetch))).resolves.toBeNull();
  });

  it("C-QUOTA-01 returns null after 5,000 ms when fetch never answers, and aborts its signal then", async () => {
    vi.useFakeTimers();
    const { calls, fetch } = recording(never);
    const pending = readGuard(argsFor(fetch, 5000));
    await vi.advanceTimersByTimeAsync(4999);
    expect(await settled(pending)).toBe(false);
    expect(calls[0]?.init.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toBeNull();
    expect(calls[0]?.init.signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("C-QUOTA-01 a re-read's 2,000 ms timeout gives null when fetch rejects on the abort", async () => {
    vi.useFakeTimers();
    const { fetch } = recording(abortable);
    const pending = readGuard(argsFor(fetch, 2000));
    await vi.advanceTimersByTimeAsync(1999);
    expect(await settled(pending)).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toBeNull();
  });

  it("C-QUOTA-01 returns null when the body never ends, at the timeout", async () => {
    vi.useFakeTimers();
    const endless = new ReadableStream<Uint8Array>({ start() {} });
    const { fetch } = recording(() => Promise.resolve(new Response(endless, { status: 200 })));
    const pending = readGuard(argsFor(fetch, 5000));
    await vi.advanceTimersByTimeAsync(4999);
    expect(await settled(pending)).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toBeNull();
  });

  it("C-QUOTA-01 clears its timer once the read is done", async () => {
    vi.useFakeTimers();
    const { fetch } = recording(() => json(keyBody(38)));
    await expect(readGuard(argsFor(fetch))).resolves.toBe(38);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([500, 503, 429, 404, 401, 301])(
    "C-QUOTA-01 returns null for a status %i, outside 200 to 299, even with a valid body",
    async (status) => {
      const { fetch } = recording(() => json(keyBody(38), status));
      await expect(readGuard(argsFor(fetch))).resolves.toBeNull();
    },
  );

  it.each([
    ["HTML", "<html>Bad gateway</html>"],
    ["an empty body", ""],
    ["half an object", '{"data":'],
    ["a JSON string", '"38"'],
  ])(
    "C-QUOTA-01 returns null for a body that is not JSON or not the /key shape: %s",
    async (_, text) => {
      const { fetch } = recording(() => Promise.resolve(new Response(text, { status: 200 })));
      await expect(readGuard(argsFor(fetch))).resolves.toBeNull();
    },
  );

  it("C-QUOTA-01 returns null for a network error, never throwing", async () => {
    const { fetch } = recording(() => Promise.reject(new TypeError("fetch failed")));
    await expect(readGuard(argsFor(fetch))).resolves.toBeNull();
    const throwing = (() => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof globalThis.fetch;
    await expect(readGuard(argsFor(throwing))).resolves.toBeNull();
  });

  it.each([
    ["args null", null, TypeError],
    ["args a string", "args", TypeError],
    ["no fetch", { fetch: undefined }, TypeError],
    ["a fetch that is not a function", { fetch: "fetch" }, TypeError],
    ["a base URL 5", { baseUrl: 5 }, TypeError],
    ["a base URL with a trailing slash", { baseUrl: `${BASE}/` }, RangeError],
    ["an ftp base URL", { baseUrl: "ftp://x/api" }, RangeError],
    ["a base URL with a query", { baseUrl: `${BASE}?a=1` }, RangeError],
    ["a key 5", { apiKey: 5 }, TypeError],
    ["a key with a space", { apiKey: "sk-or test-0123456789abcdef" }, RangeError],
    ["a key of 19 characters", { apiKey: TEST_KEY.slice(0, 19) }, RangeError],
    ["a timeout of 5000 as text", { timeoutMs: "5000" }, TypeError],
    ["a timeout of 0", { timeoutMs: 0 }, RangeError],
    ["a timeout of -1", { timeoutMs: -1 }, RangeError],
    ["a timeout of 1.5", { timeoutMs: 1.5 }, RangeError],
    ["an endless timeout", { timeoutMs: Number.POSITIVE_INFINITY }, RangeError],
    ["a timeout past setTimeout's limit", { timeoutMs: 2 ** 31 }, RangeError],
  ] as const)(
    "C-QUOTA-01 %s is refused, naming readGuard, before any fetch",
    async (_, changes, type) => {
      const { calls, fetch } = recording(never);
      const args =
        typeof changes === "object" && changes !== null
          ? { ...argsFor(fetch), ...changes }
          : changes;
      await expect(readGuard(args as unknown as GuardArgs)).rejects.toThrow(type);
      await expect(readGuard(args as unknown as GuardArgs)).rejects.toThrow(/^readGuard: /);
      expect(calls).toHaveLength(0);
    },
  );

  it("C-QUOTA-01 a visitor's signal reaches fetch, and its abort gives null at once", async () => {
    vi.useFakeTimers();
    const visitor = new AbortController();
    const { calls, fetch } = recording(never);
    const pending = readGuard({ ...argsFor(fetch), signal: visitor.signal });
    await vi.advanceTimersByTimeAsync(100);
    expect(calls[0]?.init.signal?.aborted).toBe(false);
    visitor.abort();
    expect(calls[0]?.init.signal?.aborted).toBe(true);
    await expect(pending).resolves.toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("C-QUOTA-01 a fetch that rejects on the visitor's abort gives null too", async () => {
    const visitor = new AbortController();
    const { fetch } = recording(abortable);
    const pending = readGuard({ ...argsFor(fetch), signal: visitor.signal });
    visitor.abort();
    await expect(pending).resolves.toBeNull();
  });

  it("C-QUOTA-01 an already-aborted signal gives null and sends nothing", async () => {
    const { calls, fetch } = recording(() => json(keyBody(38)));
    await expect(readGuard({ ...argsFor(fetch), signal: AbortSignal.abort() })).resolves.toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("C-QUOTA-01 a signal that is not an AbortSignal is a TypeError naming readGuard", async () => {
    const { calls, fetch } = recording(never);
    for (const signal of [null, "abort", { aborted: false }]) {
      const args = { ...argsFor(fetch), signal } as unknown as GuardArgs;
      await expect(readGuard(args), String(signal)).rejects.toThrow(TypeError);
      await expect(readGuard(args)).rejects.toThrow(/^readGuard: args\.signal /);
    }
    expect(calls).toHaveLength(0);
  });

  it("C-QUOTA-01 names a null base URL or key as null, not object", async () => {
    const { fetch } = recording(never);
    await expect(
      readGuard({ ...argsFor(fetch), baseUrl: null } as unknown as GuardArgs),
    ).rejects.toThrow(/^readGuard: args\.baseUrl must be a string, got null$/);
    await expect(
      readGuard({ ...argsFor(fetch), apiKey: null } as unknown as GuardArgs),
    ).rejects.toThrow(/^readGuard: args\.apiKey must be a string, got null$/);
  });

  it("C-QUOTA-01 never puts the key in an error message", async () => {
    const key = "sk-or-bad key-0123456789abcdef";
    const { fetch } = recording(never);
    const error = await readGuard({ ...argsFor(fetch), apiKey: key }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RangeError);
    expect(String((error as Error).message)).not.toContain("0123456789abcdef");
  });
});

describe("C-GATE-01 the cascade gate alone", () => {
  it("C-GATE-01 enter() gives a release when no cascade holds the gate, then null until it is released", () => {
    const gate = createCascadeGate();
    const release = gate.enter();
    expect(release).toBeTypeOf("function");
    expect(gate.enter()).toBeNull();
    expect(gate.enter()).toBeNull();
    release?.();
    const next = gate.enter();
    expect(next).toBeTypeOf("function");
    expect(gate.enter()).toBeNull();
  });

  it("C-GATE-01 a release works once: a second call, after another request entered, frees nothing", () => {
    const gate = createCascadeGate();
    const first = gate.enter();
    first?.();
    const second = gate.enter();
    expect(second).toBeTypeOf("function");
    first?.();
    expect(gate.enter()).toBeNull();
    second?.();
    second?.();
    expect(gate.enter()).toBeTypeOf("function");
    expect(gate.enter()).toBeNull();
  });

  it("C-GATE-01 a request answered busy holds nothing it could release", () => {
    const gate = createCascadeGate();
    const holder = gate.enter();
    const busy = gate.enter();
    expect(busy).toBeNull();
    expect(gate.enter()).toBeNull();
    holder?.();
    expect(gate.enter()).toBeTypeOf("function");
  });

  it("C-GATE-01 each gate is its own: one per server instance", () => {
    const first = createCascadeGate();
    const second = createCascadeGate();
    const release = first.enter();
    expect(second.enter()).toBeTypeOf("function");
    release?.();
    expect(second.enter()).toBeNull();
    expect(first.enter()).toBeTypeOf("function");
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.keys(first)).toEqual(["enter"]);
  });
});
