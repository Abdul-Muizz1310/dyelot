import { createHash, webcrypto } from "node:crypto";
import { describe, expect, it } from "vitest";
import * as ai from "@/ai";
import {
  CONNECT_STORAGE,
  finishConnect,
  RETURN_STORAGE,
  saveReturn,
  startConnect,
} from "@/features/ai/connect";
import { KEY_STORAGE } from "@/features/ai/visitor-key";
import { TEST_KEY } from "../../ai/fixtures";
import { type Call, fakeFetch, jsonResponse, MemoryStorage, THROWING_STORAGE } from "./support";

// C-KEY4-01 to C-KEY4-03 of docs/specs/04-ai.md, section 14.9 (R4-33, DR-0040, section 10.4): the
// PKCE sign-in with OpenRouter. The verifier and the state come from the injected random bytes, the
// record lives in session storage, the state is checked before any exchange, a code is exchanged
// once at most, and the key lands only in the visitor's own storage.

const ORIGIN = "http://localhost:3100";
const KEYS_URL = "https://openrouter.ai/api/v1/auth/keys";
const VERIFIER_BYTES = Uint8Array.from({ length: 32 }, (_, i) => (i * 7 + 3) % 256);
const STATE_BYTES = Uint8Array.from({ length: 16 }, (_, i) => 250 - i * 5);
const VERIFIER = Buffer.from(VERIFIER_BYTES).toString("base64url");
const STATE = Buffer.from(STATE_BYTES).toString("base64url");

/** Web Crypto with random bytes fixed by length: 32 for the verifier, 16 for the state. */
const fixedCrypto = {
  getRandomValues<T extends ArrayBufferView | null>(array: T): T {
    const target = array as unknown as Uint8Array;
    target.set(target.length === 32 ? VERIFIER_BYTES : STATE_BYTES);
    return array;
  },
  subtle: webcrypto.subtle,
} as unknown as Crypto;

const record = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ v: 1, verifier: VERIFIER, state: STATE, remember: false, ...over });

function started(over: Record<string, unknown> = {}, hash: string | null = "#s=abc") {
  const session = new MemoryStorage();
  const local = new MemoryStorage();
  session.setItem(CONNECT_STORAGE, record(over));
  if (hash !== null) session.setItem(RETURN_STORAGE, hash);
  return { session, local };
}

const keyReply = (key: unknown = TEST_KEY) => jsonResponse(200, { key, user_id: "user_1" });

describe("C-KEY4-01 startConnect and saveReturn", () => {
  it("C-KEY4-01 stores { v: 1, verifier, state, remember } under dyelot:connect from the injected bytes", async () => {
    const session = new MemoryStorage();
    await startConnect(ai, { crypto: fixedCrypto, session, origin: ORIGIN, remember: false });
    const stored = JSON.parse(String(session.getItem(CONNECT_STORAGE)));
    expect(stored).toEqual({ v: 1, verifier: VERIFIER, state: STATE, remember: false });
    expect(Object.keys(stored)).toEqual(["v", "verifier", "state", "remember"]);
    expect(stored.verifier).toHaveLength(43);
    expect(stored.state).toHaveLength(22);
  });

  it("C-KEY4-01 returns the authorize URL whose challenge is the base64url SHA-256 of the verifier", async () => {
    const session = new MemoryStorage();
    const url = await startConnect(ai, {
      crypto: fixedCrypto,
      session,
      origin: ORIGIN,
      remember: true,
    });
    const challenge = createHash("sha256").update(VERIFIER).digest("base64url");
    expect(url).toBe(
      ai.authorizeUrl({ callbackUrl: `${ORIGIN}/connect/callback`, challenge, state: STATE }),
    );
    expect(JSON.parse(String(session.getItem(CONNECT_STORAGE))).remember).toBe(true);
  });

  it("C-KEY4-01 makes a new verifier and state from the browser's own random bytes", async () => {
    const session = new MemoryStorage();
    await startConnect(ai, {
      crypto: webcrypto as Crypto,
      session,
      origin: ORIGIN,
      remember: false,
    });
    const first = JSON.parse(String(session.getItem(CONNECT_STORAGE)));
    await startConnect(ai, {
      crypto: webcrypto as Crypto,
      session,
      origin: ORIGIN,
      remember: false,
    });
    const second = JSON.parse(String(session.getItem(CONNECT_STORAGE)));
    expect(first.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.state).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(second.verifier).not.toBe(first.verifier);
    expect(second.state).not.toBe(first.state);
  });

  it("C-KEY4-01 saveReturn stores the hash under dyelot:return and ignores a storage that throws", () => {
    const session = new MemoryStorage();
    saveReturn(session, "#s=abc");
    expect(session.getItem(RETURN_STORAGE)).toBe("#s=abc");
    expect(() => saveReturn(THROWING_STORAGE, "#s=abc")).not.toThrow();
    expect(() => saveReturn(null, "#s=abc")).not.toThrow();
    expect(() => saveReturn(session, 5 as never)).toThrow(/^saveReturn: hash must be a string/);
    expect(() => saveReturn({} as never, "#s=abc")).toThrow(
      /^saveReturn: session must be a storage or null/,
    );
  });

  it("C-KEY4-01 startConnect refuses, storing nothing, without Web Crypto or with a wrong origin", async () => {
    const session = new MemoryStorage();
    const noSubtle = { getRandomValues: fixedCrypto.getRandomValues } as unknown as Crypto;
    await expect(
      startConnect(ai, { crypto: noSubtle, session, origin: ORIGIN, remember: false }),
    ).rejects.toThrow(/^startConnect: deps\.crypto must be Web Crypto/);
    await expect(
      startConnect(ai, { crypto: undefined as never, session, origin: ORIGIN, remember: false }),
    ).rejects.toThrow(TypeError);
    await expect(
      startConnect(ai, {
        crypto: fixedCrypto,
        session,
        origin: "https://dyelot.vercel.app/studio",
        remember: false,
      }),
    ).rejects.toThrow(/^startConnect: deps\.origin must be an http or https origin/);
    await expect(
      startConnect(ai, { crypto: fixedCrypto, session, origin: ORIGIN, remember: "no" as never }),
    ).rejects.toThrow(/^startConnect: deps\.remember must be a boolean/);
    await expect(
      startConnect(ai, {
        crypto: fixedCrypto,
        session: null as never,
        origin: ORIGIN,
        remember: false,
      }),
    ).rejects.toThrow(/^startConnect: deps\.session must be a storage/);
    expect(session.items.size).toBe(0);
  });

  it("C-KEY4-01 startConnect lets a storage that throws reject, so the page can say so", async () => {
    await expect(
      startConnect(ai, {
        crypto: fixedCrypto,
        session: THROWING_STORAGE,
        origin: ORIGIN,
        remember: false,
      }),
    ).rejects.toThrow(DOMException);
  });
});

describe("C-KEY4-02 finishConnect exchanges the code once and keeps the key in the browser", () => {
  it("C-KEY4-02 posts exactly { code, code_verifier, code_challenge_method: S256 } to OpenRouter", async () => {
    const stores = started();
    const { fetch, calls } = fakeFetch([keyReply()]);
    await finishConnect(ai, { search: `?code=C&state=${STATE}`, stores, fetch });
    expect(calls).toHaveLength(1);
    const [call] = calls as [Call];
    expect(call.url).toBe(KEYS_URL);
    expect(call.init.method).toBe("POST");
    expect(call.init.headers).toEqual({ "Content-Type": "application/json" });
    expect(call.init.body).toBe(
      JSON.stringify({ code: "C", code_verifier: VERIFIER, code_challenge_method: "S256" }),
    );
    expect(call.init.credentials).toBe("omit");
    expect(call.init.referrerPolicy).toBe("no-referrer");
  });

  it("C-KEY4-02 stores the key in session storage, removes both records and returns to the saved hash", async () => {
    const stores = started();
    const { fetch } = fakeFetch([keyReply()]);
    const result = await finishConnect(ai, { search: `?code=C&state=${STATE}`, stores, fetch });
    expect(result).toEqual({ ok: true, returnTo: "/studio#s=abc" });
    expect(stores.session.getItem(KEY_STORAGE)).toBe(TEST_KEY);
    expect(stores.local.getItem(KEY_STORAGE)).toBeNull();
    expect(stores.session.getItem(CONNECT_STORAGE)).toBeNull();
    expect(stores.session.getItem(RETURN_STORAGE)).toBeNull();
  });

  it("C-KEY4-02 stores the key in local storage only when the visitor chose to remember it", async () => {
    const stores = started({ remember: true });
    const { fetch } = fakeFetch([keyReply()]);
    await finishConnect(ai, { search: `?code=C&state=${STATE}`, stores, fetch });
    expect(stores.local.getItem(KEY_STORAGE)).toBe(TEST_KEY);
    expect(stores.session.getItem(KEY_STORAGE)).toBeNull();
  });

  it.each([
    ["#x", "/studio"],
    ["#s=", "/studio#s="],
    ["", "/studio"],
    [null, "/studio"],
  ])("C-KEY4-02 returns, for a saved hash of %j, to %s", async (hash, returnTo) => {
    const stores = started({}, hash);
    const { fetch } = fakeFetch([keyReply()]);
    expect(await finishConnect(ai, { search: `?code=C&state=${STATE}`, stores, fetch })).toEqual({
      ok: true,
      returnTo,
    });
  });

  it("C-KEY4-02 returns to /studio when the saved hash cannot be read", async () => {
    const stores = started();
    const session = {
      getItem: (key: string) => {
        if (key === RETURN_STORAGE) throw new DOMException("", "SecurityError");
        return stores.session.getItem(key);
      },
      setItem: stores.session.setItem.bind(stores.session),
      removeItem: stores.session.removeItem.bind(stores.session),
    };
    const { fetch } = fakeFetch([keyReply()]);
    const result = await finishConnect(ai, {
      search: `?code=C&state=${STATE}`,
      stores: { session, local: stores.local },
      fetch,
    });
    expect(result).toEqual({ ok: true, returnTo: "/studio" });
  });
});

describe("C-KEY4-03 finishConnect refuses every other callback and stores nothing", () => {
  /** Nothing is stored, the record is gone, and the saved hash stays for "Start again". */
  function expectClean(stores: { session: MemoryStorage; local: MemoryStorage }) {
    expect(stores.session.getItem(KEY_STORAGE)).toBeNull();
    expect(stores.local.getItem(KEY_STORAGE)).toBeNull();
    expect(stores.session.getItem(CONNECT_STORAGE)).toBeNull();
  }

  it.each(["", `?state=${STATE}`, "?code=&state=S", "?error=access_denied"])(
    "C-KEY4-03 gives denied for %j before any other check, with no fetch",
    async (search) => {
      for (const stores of [
        started(),
        { session: new MemoryStorage(), local: new MemoryStorage() },
      ]) {
        const { fetch, calls } = fakeFetch([keyReply()]);
        expect(await finishConnect(ai, { search, stores, fetch })).toEqual({
          ok: false,
          reason: "denied",
        });
        expect(calls).toEqual([]);
        expectClean(stores);
      }
    },
  );

  it.each([
    ["no record", null],
    ["a record that is not JSON", "{v:1"],
    ["a record of another version", record({ v: 2 })],
    ["a record without a verifier", JSON.stringify({ v: 1, state: STATE, remember: false })],
    ["a record with a short verifier", record({ verifier: VERIFIER.slice(1) })],
    ["a record with a short state", record({ state: STATE.slice(1) })],
    ["a record whose remember is not a boolean", record({ remember: "yes" })],
    ["a record with another key", record({ next: "/" })],
  ])("C-KEY4-03 gives not-started for %s, with no fetch", async (_, stored) => {
    const stores = { session: new MemoryStorage(), local: new MemoryStorage() };
    if (stored !== null) stores.session.setItem(CONNECT_STORAGE, stored);
    const { fetch, calls } = fakeFetch([keyReply()]);
    expect(await finishConnect(ai, { search: `?code=C&state=${STATE}`, stores, fetch })).toEqual({
      ok: false,
      reason: "not-started",
    });
    expect(calls).toEqual([]);
    expectClean(stores);
  });

  it("C-KEY4-03 gives not-started when session storage cannot be read, with no fetch", async () => {
    const { fetch, calls } = fakeFetch([keyReply()]);
    const result = await finishConnect(ai, {
      search: `?code=C&state=${STATE}`,
      stores: { session: THROWING_STORAGE, local: new MemoryStorage() },
      fetch,
    });
    expect(result).toEqual({ ok: false, reason: "not-started" });
    expect(calls).toEqual([]);
  });

  it.each([
    ["a missing state", "?code=C"],
    ["an empty state", "?code=C&state="],
    ["another state", "?code=C&state=AAAAAAAAAAAAAAAAAAAAAA"],
    ["a state that differs in case", `?code=C&state=${STATE.toUpperCase()}`],
  ])("C-KEY4-03 gives state-mismatch for %s, with no fetch", async (_, search) => {
    const stores = started();
    const { fetch, calls } = fakeFetch([keyReply()]);
    expect(await finishConnect(ai, { search, stores, fetch })).toEqual({
      ok: false,
      reason: "state-mismatch",
    });
    expect(calls).toEqual([]);
    expectClean(stores);
    expect(stores.session.getItem(RETURN_STORAGE)).toBe("#s=abc");
  });

  it.each([
    ["a 403", jsonResponse(403, { error: { code: 403, message: "Invalid code" } })],
    ["a 400", jsonResponse(400, { error: { code: 400 } })],
    ["a network error", new TypeError("Failed to fetch")],
    ["a body that is not JSON", new Response("<html>", { status: 200 })],
    ["a key of 5", keyReply(5)],
    ["a key of 19 characters", keyReply("sk-or-0123456789abc")],
    ["a key with a space", keyReply("sk-or-test 0123456789abcdef")],
    ["a key of 401 characters", keyReply("k".repeat(401))],
    ["a key outside printable ASCII", keyReply("sk-or-test-0123456789abcdé")],
    ["no key", jsonResponse(200, { user_id: "user_1" })],
  ])("C-KEY4-03 gives exchange-failed for %s and stores nothing", async (_, answer) => {
    const stores = started();
    const { fetch, calls } = fakeFetch([answer]);
    expect(await finishConnect(ai, { search: `?code=C&state=${STATE}`, stores, fetch })).toEqual({
      ok: false,
      reason: "exchange-failed",
    });
    expect(calls).toHaveLength(1);
    expectClean(stores);
    expect(stores.session.getItem(RETURN_STORAGE)).toBe("#s=abc");
  });

  it("C-KEY4-03 gives exchange-failed when the store the key needs refuses it", async () => {
    const stores = started({ remember: true });
    const { fetch } = fakeFetch([keyReply()]);
    const result = await finishConnect(ai, {
      search: `?code=C&state=${STATE}`,
      stores: { session: stores.session, local: null },
      fetch,
    });
    expect(result).toEqual({ ok: false, reason: "exchange-failed" });
    expect(stores.session.getItem(KEY_STORAGE)).toBeNull();
    expect(stores.session.getItem(CONNECT_STORAGE)).toBeNull();
  });

  it("C-KEY4-03 never exchanges a code twice: a second callback with the same query is not-started", async () => {
    const stores = started();
    const { fetch, calls } = fakeFetch([keyReply(), keyReply()]);
    const search = `?code=C&state=${STATE}`;
    expect(await finishConnect(ai, { search, stores, fetch })).toMatchObject({ ok: true });
    expect(await finishConnect(ai, { search, stores, fetch })).toEqual({
      ok: false,
      reason: "not-started",
    });
    expect(calls).toHaveLength(1);
  });

  it("C-KEY4-03 removes the record before the exchange answers, so a second callback meanwhile cannot use it", async () => {
    const stores = started();
    let release: (response: Response) => void = () => {};
    const { fetch, calls } = fakeFetch([
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    ]);
    const search = `?code=C&state=${STATE}`;
    const first = finishConnect(ai, { search, stores, fetch });
    await Promise.resolve();
    expect(stores.session.getItem(CONNECT_STORAGE)).toBeNull();
    expect(await finishConnect(ai, { search, stores, fetch })).toEqual({
      ok: false,
      reason: "not-started",
    });
    release(keyReply());
    expect(await first).toMatchObject({ ok: true });
    expect(calls).toHaveLength(1);
  });

  it("C-KEY4-03 throws TypeError naming finishConnect for arguments of the wrong type", async () => {
    const { fetch } = fakeFetch([]);
    const stores = started();
    await expect(finishConnect(ai, { search: 5 as never, stores, fetch })).rejects.toThrow(
      /^finishConnect: deps\.search must be a string/,
    );
    await expect(
      finishConnect(ai, { search: "", stores: { session: null as never, local: null }, fetch }),
    ).rejects.toThrow(/^finishConnect: deps\.stores\.session must be a storage/);
    await expect(finishConnect(ai, { search: "", stores, fetch: null as never })).rejects.toThrow(
      TypeError,
    );
    await expect(
      finishConnect(ai, {
        search: "",
        stores: { session: stores.session, local: "local" as never },
        fetch,
      }),
    ).rejects.toThrow(/^finishConnect: deps\.stores\.local must be a storage or null/);
    await expect(finishConnect(null as never, { search: "", stores, fetch })).rejects.toThrow(
      /^finishConnect: ai must be the @\/ai module/,
    );
    expect(stores.session.getItem(CONNECT_STORAGE)).not.toBeNull();
  });
});
