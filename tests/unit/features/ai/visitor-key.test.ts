import { afterEach, describe, expect, it, vi } from "vitest";
import * as ai from "@/ai";
import {
  askWithKey,
  clearKey,
  fetchModels,
  KEY_STORAGE,
  readKey,
  storeKey,
} from "@/features/ai/visitor-key";
import {
  BRIEF_IN,
  BRIEF_OUT,
  TEST_KEY,
  TEXT_SLUGS,
  VIBE_IN,
  VIBE_OUT,
  VISION_SLUGS,
} from "../../ai/fixtures";
import {
  type Call,
  chatBody,
  fakeFetch,
  jsonResponse,
  MemoryStorage,
  THROWING_STORAGE,
} from "./support";

// C-KEY4-04 to C-KEY4-06 of docs/specs/04-ai.md, section 14.9 (R4-29, R4-33, R4-34): the visitor's
// key in the browser's storage, the calls it makes straight to OpenRouter, and the slugs the browser
// learns from /api/ai/models. The key never goes to dyelot's origin and no error message holds it.

const CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const REFERER = "http://localhost:3100";
const OTHER_KEY = "sk-or-test-fedcba9876543210";
const MODELS = { text: [...TEXT_SLUGS], vision: [...VISION_SLUGS] };
const signal = () => new AbortController().signal;
const ok = (output: unknown = BRIEF_OUT) => new Response(chatBody(JSON.stringify(output)));
const status = (code: number) => new Response("{}", { status: code });

const stores = () => ({ session: new MemoryStorage(), local: new MemoryStorage() });

const brief = (fetch: typeof globalThis.fetch, over: Record<string, unknown> = {}) =>
  askWithKey(ai, "brief", BRIEF_IN, {
    fetch,
    key: TEST_KEY,
    models: MODELS,
    signal: signal(),
    referer: REFERER,
    ...over,
  });

const BRIEF_PARSED = (() => {
  const parsed = ai.parseOutput("brief", BRIEF_IN, BRIEF_OUT);
  if (!parsed.ok) throw new Error("BRIEF_OUT must parse");
  return parsed.output;
})();

afterEach(() => {
  vi.useRealTimers();
});

describe("C-KEY4-04 the key in session or local storage", () => {
  it("C-KEY4-04 readKey prefers session storage, then local storage, and says which", () => {
    const both = stores();
    both.session.setItem(KEY_STORAGE, TEST_KEY);
    both.local.setItem(KEY_STORAGE, OTHER_KEY);
    expect(readKey(both)).toEqual({ key: TEST_KEY, remembered: false });
    const local = stores();
    local.local.setItem(KEY_STORAGE, OTHER_KEY);
    expect(readKey(local)).toEqual({ key: OTHER_KEY, remembered: true });
    expect(readKey(stores())).toBeNull();
    expect(readKey({ session: null, local: null })).toBeNull();
  });

  it("C-KEY4-04 readKey reads a stored value that is not a key as no key", () => {
    for (const value of ["short", `${TEST_KEY} x`, "k".repeat(401), ""]) {
      const held = stores();
      held.session.setItem(KEY_STORAGE, value);
      expect(readKey(held), JSON.stringify(value)).toBeNull();
    }
  });

  it("C-KEY4-04 storeKey(…, true) writes local storage only and storeKey(…, false) session only", () => {
    const remembered = stores();
    storeKey(remembered, TEST_KEY, true);
    expect(remembered.local.getItem(KEY_STORAGE)).toBe(TEST_KEY);
    expect(remembered.session.getItem(KEY_STORAGE)).toBeNull();
    const tab = stores();
    storeKey(tab, TEST_KEY, false);
    expect(tab.session.getItem(KEY_STORAGE)).toBe(TEST_KEY);
    expect(tab.local.getItem(KEY_STORAGE)).toBeNull();
  });

  it("C-KEY4-04 storeKey takes an older copy out of the other store, so the choice holds", () => {
    const held = stores();
    held.session.setItem(KEY_STORAGE, OTHER_KEY);
    storeKey(held, TEST_KEY, true);
    expect(held.session.getItem(KEY_STORAGE)).toBeNull();
    expect(readKey(held)).toEqual({ key: TEST_KEY, remembered: true });
    held.local.setItem(KEY_STORAGE, OTHER_KEY);
    storeKey(held, TEST_KEY, false);
    expect(held.local.getItem(KEY_STORAGE)).toBeNull();
    expect(readKey(held)).toEqual({ key: TEST_KEY, remembered: false });
  });

  it("C-KEY4-04 clearKey empties both stores", () => {
    const held = stores();
    held.session.setItem(KEY_STORAGE, TEST_KEY);
    held.local.setItem(KEY_STORAGE, OTHER_KEY);
    clearKey(held);
    expect(held.session.items.size).toBe(0);
    expect(held.local.items.size).toBe(0);
    expect(readKey(held)).toBeNull();
  });

  it("C-KEY4-04 a storage that throws reads as no key, and clearKey never throws out", () => {
    expect(readKey({ session: THROWING_STORAGE, local: THROWING_STORAGE })).toBeNull();
    const local = new MemoryStorage();
    local.setItem(KEY_STORAGE, OTHER_KEY);
    expect(readKey({ session: THROWING_STORAGE, local })).toEqual({
      key: OTHER_KEY,
      remembered: true,
    });
    expect(() => clearKey({ session: THROWING_STORAGE, local: THROWING_STORAGE })).not.toThrow();
    expect(() => clearKey({ session: null, local: null })).not.toThrow();
    clearKey({ session: THROWING_STORAGE, local });
    expect(local.items.size).toBe(0);
  });

  it("C-KEY4-04 storeKey throws, without the key in its message, when the store it needs refuses", () => {
    for (const [held, remember] of [
      [{ session: THROWING_STORAGE, local: new MemoryStorage() }, false],
      [{ session: new MemoryStorage(), local: null }, true],
    ] as const) {
      let message = "";
      try {
        storeKey(held, TEST_KEY, remember);
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toMatch(/^storeKey: /);
      expect(message).not.toContain(TEST_KEY);
    }
  });

  it("C-KEY4-04 storeKey refuses a value that is not a key, and never names it", () => {
    const wrong = (value: unknown) => value as never;
    for (const bad of [
      "sk-or-short",
      "sk-or-test 0123456789abcdef",
      "k".repeat(401),
      "ключ".repeat(6),
    ]) {
      let error: unknown;
      try {
        storeKey(stores(), bad, false);
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeInstanceOf(RangeError);
      expect((error as Error).message).toMatch(/^storeKey: key must be 20 to 400/);
      expect((error as Error).message).not.toContain(bad);
    }
    expect(() => storeKey(stores(), wrong(5), false)).toThrow(TypeError);
    expect(() => storeKey(stores(), TEST_KEY, wrong("yes"))).toThrow(
      /^storeKey: remember must be a boolean/,
    );
    expect(() => storeKey(wrong(null), TEST_KEY, false)).toThrow(TypeError);
    expect(() => readKey(wrong({ session: "x", local: null }))).toThrow(
      /^readKey: stores\.session must be a storage or null/,
    );
  });
});

describe("C-KEY4-05 askWithKey calls OpenRouter from the browser", () => {
  it("C-KEY4-05 posts buildChatRequest's request for the first text slug with Bearer <visitor key>", async () => {
    const { fetch, calls } = fakeFetch([ok()]);
    const result = await brief(fetch);
    const expected = ai.buildChatRequest({
      feature: "brief",
      input: BRIEF_IN,
      slug: TEXT_SLUGS[0],
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: TEST_KEY,
      referer: REFERER,
    });
    expect(calls).toHaveLength(1);
    const [call] = calls as [Call];
    expect(call.url).toBe(CHAT_URL);
    expect(call.init.method).toBe("POST");
    expect(call.init.headers).toEqual(expected.headers);
    expect((call.init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TEST_KEY}`);
    expect(call.init.body).toBe(expected.body);
    expect(call.init.credentials).toBe("omit");
    expect(call.init.redirect).toBe("error");
    expect(result).toEqual({
      ok: true,
      output: BRIEF_PARSED,
      path: { provider: "visitor-key", slug: TEXT_SLUGS[0], attempts: 1 },
    });
  });

  it("C-KEY4-05 uses the vision slugs for vibe", async () => {
    const { fetch, calls } = fakeFetch([ok(VIBE_OUT)]);
    const result = await askWithKey(ai, "vibe", VIBE_IN, {
      fetch,
      key: TEST_KEY,
      models: MODELS,
      signal: signal(),
      referer: REFERER,
    });
    expect(JSON.parse(String(calls[0]?.init.body)).model).toBe(VISION_SLUGS[0]);
    expect(result).toEqual({
      ok: true,
      output: VIBE_OUT,
      path: { provider: "visitor-key", slug: VISION_SLUGS[0], attempts: 1 },
    });
  });

  it("C-KEY4-05 skips a slug that fails isFreeSlug", async () => {
    const { fetch, calls } = fakeFetch([ok()]);
    const models = { text: ["paid/model", "test/text-2", TEXT_SLUGS[1]], vision: [] };
    const result = await brief(fetch, { models });
    expect(calls).toHaveLength(1);
    expect(JSON.parse(String(calls[0]?.init.body)).model).toBe(TEXT_SLUGS[1]);
    expect(result).toMatchObject({ ok: true, path: { slug: TEXT_SLUGS[1], attempts: 1 } });
  });

  it.each([
    ["no free text slug", { text: ["paid/model"], vision: [...VISION_SLUGS] }, "brief"],
    ["no text slug at all", { text: [], vision: [...VISION_SLUGS] }, "brief"],
    ["no vision slug for vibe", { text: [...TEXT_SLUGS], vision: [] }, "vibe"],
  ])("C-KEY4-05 gives no-models with no call when %s is left", async (_, models, feature) => {
    const { fetch, calls } = fakeFetch([]);
    const input = feature === "vibe" ? VIBE_IN : BRIEF_IN;
    const result = await askWithKey(ai, feature as "brief", input as typeof BRIEF_IN, {
      fetch,
      key: TEST_KEY,
      models,
      signal: signal(),
      referer: REFERER,
    });
    expect(result).toEqual({
      ok: false,
      failure: { provider: "visitor-key", reason: "no-models" },
    });
    expect(calls).toEqual([]);
  });

  it("C-KEY4-05 moves to the next slug after a 429", async () => {
    const { fetch, calls } = fakeFetch([status(429), ok()]);
    const result = await brief(fetch);
    expect(calls.map((call) => JSON.parse(String(call.init.body)).model)).toEqual([
      TEXT_SLUGS[0],
      TEXT_SLUGS[1],
    ]);
    expect(result).toEqual({
      ok: true,
      output: BRIEF_PARSED,
      path: { provider: "visitor-key", slug: TEXT_SLUGS[1], attempts: 2 },
    });
  });

  it.each([401, 403])(
    "C-KEY4-05 stops with refused after one call when OpenRouter answers %i",
    async (code) => {
      const { fetch, calls } = fakeFetch([status(code), ok(), ok()]);
      expect(await brief(fetch)).toEqual({
        ok: false,
        failure: { provider: "visitor-key", reason: "refused" },
      });
      expect(calls).toHaveLength(1);
    },
  );

  it("C-KEY4-05 gives failed after three failures, one per slug", async () => {
    const { fetch, calls } = fakeFetch([
      status(500),
      new TypeError("Failed to fetch"),
      new Response(chatBody("not json")),
    ]);
    expect(await brief(fetch)).toEqual({
      ok: false,
      failure: { provider: "visitor-key", reason: "failed" },
    });
    expect(calls).toHaveLength(3);
  });

  it("C-KEY4-05 makes three attempts at most and calls a repeated slug once", async () => {
    const models = {
      text: [TEXT_SLUGS[0], TEXT_SLUGS[0], TEXT_SLUGS[1], TEXT_SLUGS[2], "test/text-4:free"],
      vision: [],
    };
    const { fetch, calls } = fakeFetch([status(500), status(500), status(500), ok()]);
    expect(await brief(fetch, { models })).toMatchObject({ ok: false });
    expect(calls.map((call) => JSON.parse(String(call.init.body)).model)).toEqual([...TEXT_SLUGS]);
  });

  it("C-KEY4-05 reads a status outside 100 to 599 and a body over 262,144 bytes as a failed tier", async () => {
    const odd = { status: 0, body: null } as unknown as Response;
    const huge = new Response(
      chatBody(JSON.stringify({ ...BRIEF_OUT, name: "x".repeat(270_000) })),
    );
    const { fetch, calls } = fakeFetch([odd, huge, ok()]);
    expect(await brief(fetch)).toMatchObject({
      ok: true,
      path: { slug: TEXT_SLUGS[2], attempts: 3 },
    });
    expect(calls).toHaveLength(3);
  });

  it("C-KEY4-05 reads a 200 with no body as a failed tier", async () => {
    const { fetch, calls } = fakeFetch([new Response(null, { status: 200 }), ok()]);
    expect(await brief(fetch)).toMatchObject({
      ok: true,
      path: { slug: TEXT_SLUGS[1], attempts: 2 },
    });
    expect(calls).toHaveLength(2);
  });

  it("C-KEY4-05 cuts a call that rejects at the deadline and a body that never ends at 20,000 ms", async () => {
    vi.useFakeTimers();
    const rejectsOnAbort = (call: Call) =>
      new Promise<Response>((_, reject) => {
        call.init.signal?.addEventListener("abort", () =>
          reject(new DOMException("", "AbortError")),
        );
      });
    const endless = async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('{"choices":'));
          },
        }),
      );
    const { fetch, calls } = fakeFetch([rejectsOnAbort, endless, async () => ok()]);
    const pending = brief(fetch);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(calls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(await pending).toMatchObject({ ok: true, path: { slug: TEXT_SLUGS[2], attempts: 3 } });
  });

  it("C-KEY4-05 gives each tier 20,000 ms, then aborts its call and moves on", async () => {
    vi.useFakeTimers();
    const seen: AbortSignal[] = [];
    const never = (call: Call) => {
      seen.push(call.init.signal as AbortSignal);
      return new Promise<Response>(() => {});
    };
    const { fetch, calls } = fakeFetch([never, async () => ok()]);
    const pending = brief(fetch);
    await vi.advanceTimersByTimeAsync(19_999);
    expect(calls).toHaveLength(1);
    expect(seen[0]?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(seen[0]?.aborted).toBe(true);
    expect(await pending).toMatchObject({ ok: true, path: { slug: TEXT_SLUGS[1], attempts: 2 } });
  });

  it("C-KEY4-05 makes no call after the action is canceled, before or during a tier", async () => {
    const before = new AbortController();
    before.abort();
    const first = fakeFetch([ok()]);
    expect(await brief(first.fetch, { signal: before.signal })).toEqual({
      ok: false,
      failure: { provider: "visitor-key", reason: "failed" },
    });
    expect(first.calls).toEqual([]);

    const during = new AbortController();
    const second = fakeFetch([
      (call) =>
        new Promise<Response>((_, reject) => {
          call.init.signal?.addEventListener("abort", () =>
            reject(new DOMException("", "AbortError")),
          );
          during.abort();
        }),
      ok(),
    ]);
    expect(await brief(second.fetch, { signal: during.signal })).toEqual({
      ok: false,
      failure: { provider: "visitor-key", reason: "failed" },
    });
    expect(second.calls).toHaveLength(1);
  });

  it("C-KEY4-05 sends the key to OpenRouter alone and never names it in an error", async () => {
    const { fetch, calls } = fakeFetch([status(500), status(500), status(500)]);
    await brief(fetch);
    for (const call of calls) expect(call.url.startsWith(`${ai.OPENROUTER_ORIGIN}/`)).toBe(true);
    const wrong = (value: unknown) => value as never;
    for (const bad of ["sk-or-short", `${TEST_KEY} `]) {
      let message = "";
      try {
        await brief(fakeFetch([]).fetch, { key: bad });
      } catch (error) {
        message = (error as Error).message;
        expect(error).toBeInstanceOf(RangeError);
      }
      expect(message).toMatch(/^askWithKey: deps\.key must be 20 to 400/);
      expect(message).not.toContain(bad.trim());
    }
    await expect(brief(fakeFetch([]).fetch, { key: wrong(42) })).rejects.toThrow(TypeError);
  });

  it("C-KEY4-05 throws TypeError or RangeError naming askWithKey for what it cannot ask", async () => {
    const { fetch, calls } = fakeFetch([]);
    const wrong = (value: unknown) => value as never;
    await expect(
      askWithKey(ai, wrong("poem"), wrong(BRIEF_IN), {
        fetch,
        key: TEST_KEY,
        models: MODELS,
        signal: signal(),
        referer: REFERER,
      }),
    ).rejects.toThrow(/^askWithKey: feature must be one of/);
    await expect(
      askWithKey(ai, "brief", wrong({ brief: "" }), {
        fetch,
        key: TEST_KEY,
        models: MODELS,
        signal: signal(),
        referer: REFERER,
      }),
    ).rejects.toThrow(/^askWithKey: input is not a brief input/);
    await expect(brief(fetch, { models: wrong({ text: "x", vision: [] }) })).rejects.toThrow(
      /^askWithKey: deps\.models\.text must be an array/,
    );
    await expect(brief(fetch, { models: wrong({ text: [1], vision: [] }) })).rejects.toThrow(
      TypeError,
    );
    await expect(brief(fetch, { referer: "localhost:3100" })).rejects.toThrow(
      /^askWithKey: deps\.referer must be an http or https origin/,
    );
    await expect(brief(fetch, { fetch: wrong(null) })).rejects.toThrow(TypeError);
    await expect(brief(fetch, { signal: wrong("stop") })).rejects.toThrow(TypeError);
    expect(calls).toEqual([]);
  });
});

describe("C-KEY4-06 fetchModels reads GET /api/ai/models", () => {
  it("C-KEY4-06 gets /api/ai/models on dyelot's origin with no key and gives the two lists", async () => {
    const body = { text: [...TEXT_SLUGS], vision: [VISION_SLUGS[0]] };
    const { fetch, calls } = fakeFetch([jsonResponse(200, body)]);
    expect(await fetchModels({ fetch })).toEqual(body);
    expect(calls).toHaveLength(1);
    const [call] = calls as [Call];
    expect(call.url).toBe("/api/ai/models");
    expect(call.init.method).toBe("GET");
    expect(call.init.credentials).toBe("same-origin");
    expect(call.init.headers).toBeUndefined();
    expect(call.init.body).toBeUndefined();
  });

  it.each([
    ["a 503", jsonResponse(503, { ok: false, code: "not-configured" })],
    ["a 200 of another shape", jsonResponse(200, { text: TEXT_SLUGS[0], vision: [] })],
    ["a 200 with another key", jsonResponse(200, { text: [], vision: [], extra: [] })],
    ["a 200 without vision", jsonResponse(200, { text: [...TEXT_SLUGS] })],
    ["a 200 with a slug that is not a string", jsonResponse(200, { text: [1], vision: [] })],
    [
      "a 200 with four text slugs",
      jsonResponse(200, { text: [...TEXT_SLUGS, "a/b:free"], vision: [] }),
    ],
    ["a 200 that is not JSON", new Response("<html>", { status: 200 })],
    ["a 200 that is an array", jsonResponse(200, [[], []])],
    ["a rejecting fetch", new TypeError("Failed to fetch")],
  ])("C-KEY4-06 gives null for %s", async (_, answer) => {
    expect(await fetchModels({ fetch: fakeFetch([answer]).fetch })).toBeNull();
  });

  it("C-KEY4-06 throws TypeError naming fetchModels for a fetch that is not a function", async () => {
    await expect(fetchModels({ fetch: 1 as never })).rejects.toThrow(
      /^fetchModels: deps\.fetch must be a function/,
    );
  });
});
