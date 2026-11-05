import { afterEach, describe, expect, it, vi } from "vitest";
import { buildChatRequest, type ChatRequest, readReply } from "@/ai";
import { sendChat } from "@/server/ai/transport";
import { BRIEF_IN, BRIEF_OUT, TEST_KEY, TEXT_SLUGS } from "../ai/fixtures";

// C-TRANS-01 of docs/specs/04-ai.md, section 14.7: the server transport sends the request @/ai built
// and gives back what readReply reads (R4-11, R4-12, section 5.4), with an injected fetch that records
// its calls and fake timers. No test reaches the network.

const BASE = "http://127.0.0.1:3199/api/v1";
const REQUEST: ChatRequest = buildChatRequest({
  feature: "brief",
  input: BRIEF_IN,
  slug: TEXT_SLUGS[0],
  baseUrl: BASE,
  apiKey: TEST_KEY,
  referer: "https://dyelot.vercel.app",
});
const CAP = 262_144;
const REPLY = JSON.stringify({
  choices: [{ message: { content: JSON.stringify(BRIEF_OUT) } }],
  usage: { prompt_tokens: 900, completion_tokens: 120, cost: 0 },
});

type Call = { readonly url: string; readonly init: RequestInit };

/** A fetch that records each call and answers it with `answer`. */
function recording(answer: (call: Call) => Promise<Response>) {
  const calls: Call[] = [];
  const fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(input), init: init ?? {} };
    calls.push(call);
    return answer(call);
  }) as typeof globalThis.fetch;
  return { calls, fetch };
}

const reply = (text: string | ReadableStream<Uint8Array>, status = 200) =>
  Promise.resolve(new Response(text, { status }));
/** A fetch answer that never settles and ignores the abort. */
const never = () => new Promise<Response>(() => {});
/** A fetch answer that rejects as the platform's fetch does when its signal aborts. */
const abortable = (call: Call) =>
  new Promise<Response>((_, reject) => {
    call.init.signal?.addEventListener("abort", () =>
      reject(new DOMException("This operation was aborted", "AbortError")),
    );
  });

/** Whether `promise` has settled, without waiting for it. */
async function settled(promise: Promise<unknown>): Promise<boolean> {
  let done = false;
  promise.then(
    () => {
      done = true;
    },
    () => {
      done = true;
    },
  );
  await Promise.resolve();
  await Promise.resolve();
  return done;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("C-TRANS-01 sendChat posts the request and gives back the reply", () => {
  it("C-TRANS-01 posts the request's URL, headers and body and returns { status, text }", async () => {
    const { calls, fetch } = recording(() => reply(REPLY));
    const response = await sendChat(REQUEST, { fetch, timeoutMs: 20_000 });
    expect(response).toStrictEqual({ status: 200, text: REPLY });
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call?.url).toBe(`${BASE}/chat/completions`);
    expect(call?.url).toBe(REQUEST.url);
    expect(call?.init.method).toBe("POST");
    expect(call?.init.headers).toStrictEqual({ ...REQUEST.headers });
    expect(call?.init.body).toBe(REQUEST.body);
    expect(call?.init.signal).toBeInstanceOf(AbortSignal);
    expect(call?.init.signal?.aborted).toBe(false);
    expect(call?.init.cache).toBe("no-store");
  });

  it("C-TRANS-01 hands readReply a reply it reads to the output", async () => {
    const { fetch } = recording(() => reply(REPLY));
    const outcome = readReply(
      "brief",
      BRIEF_IN,
      await sendChat(REQUEST, { fetch, timeoutMs: 20_000 }),
    );
    expect(outcome.ok).toBe(true);
    expect(outcome.ok && outcome.output).toEqual(BRIEF_OUT);
  });

  it("C-TRANS-01 returns the status and text of a reply outside 200 to 299", async () => {
    for (const status of [500, 503, 429, 404]) {
      const { fetch } = recording(() => reply("upstream text", status));
      const response = await sendChat(REQUEST, { fetch, timeoutMs: 20_000 });
      expect(response).toStrictEqual({ status, text: "upstream text" });
      expect(readReply("brief", BRIEF_IN, response)).toEqual({
        ok: false,
        kind: "http",
        status,
        usage: null,
      });
    }
  });

  it("C-TRANS-01 with no answer it aborts at timeoutMs and returns { kind: 'timeout' }", async () => {
    vi.useFakeTimers();
    const { calls, fetch } = recording(never);
    const pending = sendChat(REQUEST, { fetch, timeoutMs: 20_000 });
    await vi.advanceTimersByTimeAsync(19_999);
    expect(await settled(pending)).toBe(false);
    expect(calls[0]?.init.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toStrictEqual({ kind: "timeout" });
    expect(calls[0]?.init.signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    expect(readReply("brief", BRIEF_IN, await pending)).toEqual({
      ok: false,
      kind: "timeout",
      usage: null,
    });
  });

  it("C-TRANS-01 a fetch that rejects on the abort is a timeout too", async () => {
    vi.useFakeTimers();
    const { fetch } = recording(abortable);
    const pending = sendChat(REQUEST, { fetch, timeoutMs: 20_000 });
    await vi.advanceTimersByTimeAsync(20_000);
    await expect(pending).resolves.toStrictEqual({ kind: "timeout" });
  });

  it("C-TRANS-01 a body that never ends is a timeout at timeoutMs", async () => {
    vi.useFakeTimers();
    const endless = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"choices":'));
      },
    });
    const { fetch } = recording(() => reply(endless));
    const pending = sendChat(REQUEST, { fetch, timeoutMs: 20_000 });
    await vi.advanceTimersByTimeAsync(19_999);
    expect(await settled(pending)).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toStrictEqual({ kind: "timeout" });
  });

  it("C-TRANS-01 a rejecting fetch gives { kind: 'network' }, which readReply reads as http 0", async () => {
    const { fetch } = recording(() => Promise.reject(new TypeError("fetch failed")));
    const response = await sendChat(REQUEST, { fetch, timeoutMs: 20_000 });
    expect(response).toStrictEqual({ kind: "network" });
    expect(readReply("brief", BRIEF_IN, response)).toEqual({
      ok: false,
      kind: "http",
      status: 0,
      usage: null,
    });
    const throwing = (() => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof globalThis.fetch;
    await expect(sendChat(REQUEST, { fetch: throwing, timeoutMs: 20_000 })).resolves.toStrictEqual({
      kind: "network",
    });
  });

  it("C-TRANS-01 a body that fails while it is read gives { kind: 'network' }", async () => {
    const broken = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"choices":'));
        controller.error(new TypeError("terminated"));
      },
    });
    const { fetch } = recording(() => reply(broken));
    await expect(sendChat(REQUEST, { fetch, timeoutMs: 20_000 })).resolves.toStrictEqual({
      kind: "network",
    });
  });

  it.each([0, 99, 600, 1000, 200.5, Number.NaN])(
    "C-TRANS-01 a status %s, outside 100 to 599, is a failed tier, never passed on",
    async (status) => {
      const odd = { status, body: null } as unknown as Response;
      const { fetch } = recording(() => Promise.resolve(odd));
      const response = await sendChat(REQUEST, { fetch, timeoutMs: 20_000 });
      expect(response).toStrictEqual({ kind: "network" });
      expect(() => readReply("brief", BRIEF_IN, response)).not.toThrow();
    },
  );

  it("C-TRANS-01 reads a body of exactly 262,144 bytes, and readReply reads it", async () => {
    const padded = REPLY + " ".repeat(CAP - REPLY.length);
    const { fetch } = recording(() => reply(padded));
    const response = await sendChat(REQUEST, { fetch, timeoutMs: 20_000 });
    expect(response).toStrictEqual({ status: 200, text: padded });
    expect(readReply("brief", BRIEF_IN, response).ok).toBe(true);
  });

  it("C-TRANS-01 stops at a body past 262,144 bytes and gives text readReply reads as empty", async () => {
    const over = `${REPLY}${" ".repeat(CAP - REPLY.length)} `;
    const { fetch } = recording(() => reply(over));
    const response = await sendChat(REQUEST, { fetch, timeoutMs: 20_000 });
    expect(response).toStrictEqual({ status: 200, text: "" });
    expect(readReply("brief", BRIEF_IN, response)).toEqual({
      ok: false,
      kind: "empty",
      usage: null,
    });
  });

  it("C-TRANS-01 reads no further than the cap from an endless body, and cancels it", async () => {
    let pulled = 0;
    let canceled = false;
    const endless = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          pulled += 1;
          controller.enqueue(new Uint8Array(65_536).fill(0x20));
        },
        cancel() {
          canceled = true;
        },
      },
      { highWaterMark: 0 },
    );
    const { fetch } = recording(() => reply(endless));
    await expect(sendChat(REQUEST, { fetch, timeoutMs: 20_000 })).resolves.toStrictEqual({
      status: 200,
      text: "",
    });
    expect(pulled).toBeLessThanOrEqual(6);
    expect(canceled).toBe(true);
  });

  it("C-TRANS-01 decodes UTF-8 split across chunks", async () => {
    const bytes = new TextEncoder().encode('{"word":"teé"}');
    const split = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 12));
        controller.enqueue(bytes.slice(12));
        controller.close();
      },
    });
    const { fetch } = recording(() => reply(split));
    await expect(sendChat(REQUEST, { fetch, timeoutMs: 20_000 })).resolves.toStrictEqual({
      status: 200,
      text: '{"word":"teé"}',
    });
  });

  it("C-TRANS-01 reads a reply with no body as empty text", async () => {
    const { fetch } = recording(() => Promise.resolve(new Response(null, { status: 204 })));
    await expect(sendChat(REQUEST, { fetch, timeoutMs: 20_000 })).resolves.toStrictEqual({
      status: 204,
      text: "",
    });
  });

  it("C-TRANS-01 clears its timer once the reply is read", async () => {
    vi.useFakeTimers();
    const { fetch } = recording(() => reply(REPLY));
    await sendChat(REQUEST, { fetch, timeoutMs: 20_000 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    ["a request null", null, {}, TypeError],
    ["a request a string", "POST", {}, TypeError],
    ["a URL 5", { ...REQUEST, url: 5 }, {}, TypeError],
    ["an ftp URL", { ...REQUEST, url: "ftp://x/chat/completions" }, {}, RangeError],
    ["a URL with white space", { ...REQUEST, url: `${BASE}/chat completions` }, {}, RangeError],
    ["headers null", { ...REQUEST, headers: null }, {}, TypeError],
    ["a header 5", { ...REQUEST, headers: { ...REQUEST.headers, "X-Count": 5 } }, {}, TypeError],
    ["a body 5", { ...REQUEST, body: 5 }, {}, TypeError],
    ["args null", REQUEST, null, TypeError],
    ["no fetch", REQUEST, { fetch: undefined }, TypeError],
    ["a timeout as text", REQUEST, { timeoutMs: "20000" }, TypeError],
    ["a timeout of 0", REQUEST, { timeoutMs: 0 }, RangeError],
    ["a timeout of 1.5", REQUEST, { timeoutMs: 1.5 }, RangeError],
    ["a timeout past setTimeout's limit", REQUEST, { timeoutMs: 2 ** 31 }, RangeError],
  ] as const)(
    "C-TRANS-01 %s is refused, naming sendChat, before any fetch",
    async (_, request, changes, type) => {
      const { calls, fetch } = recording(never);
      const args = changes === null ? null : { fetch, timeoutMs: 20_000, ...changes };
      const call = () =>
        sendChat(
          request as unknown as ChatRequest,
          args as unknown as Parameters<typeof sendChat>[1],
        );
      await expect(call()).rejects.toThrow(type);
      await expect(call()).rejects.toThrow(/^sendChat: /);
      expect(calls).toHaveLength(0);
    },
  );

  it("C-TRANS-01 never puts the request's headers, key included, in an error message", async () => {
    const { fetch } = recording(never);
    const bad = { ...REQUEST, headers: { ...REQUEST.headers, Authorization: 5 } };
    const error = await sendChat(bad as unknown as ChatRequest, { fetch, timeoutMs: 20_000 }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(TypeError);
    expect(String((error as Error).message)).not.toContain(TEST_KEY);
  });
});
