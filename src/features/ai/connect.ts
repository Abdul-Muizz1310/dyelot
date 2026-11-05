import { type AiModule, assertFunction } from "@/features/ai/load";
import { isKey, readCapped, type Stores, storeKey } from "@/features/ai/visitor-key";
import type { StorageLike } from "@/features/studio/drafts";
import { assertRecord, assertString, describeType, isRecord } from "@/features/studio/guards";

// The visitor key's PKCE sign-in with OpenRouter (docs/specs/04-ai.md, R4-33, DR-0040, section 10.4).
// `startConnect` makes the verifier, its S256 challenge and the state from the browser's own random
// bytes and keeps them in session storage; `finishConnect` checks the callback in 10.4's order, the
// state before any exchange, and removes the record before it exchanges anything (a record that
// cannot be removed is not used), so a code is exchanged once at most. The exchange follows no
// redirect, reads a capped reply and gives up at 15,000 ms. The key then goes only into the
// visitor's own storage (visitor-key.ts), or nowhere when the browser refuses to keep it.

/** The record of a sign-in that started here: session storage, one tab. */
export const CONNECT_STORAGE = "dyelot:connect";
/** The studio's hash to return to after the sign-in. */
export const RETURN_STORAGE = "dyelot:return";

export type ConnectResult =
  | { ok: true; returnTo: string }
  | {
      ok: false;
      reason: "not-started" | "state-mismatch" | "denied" | "exchange-failed" | "storage-refused";
    };

type ConnectRecord = {
  readonly v: 1;
  readonly verifier: string;
  readonly state: string;
  readonly remember: boolean;
};

/** 32 random bytes make a 43-character verifier, 16 a 22-character state (R4-33). */
const VERIFIER_BYTES = 32;
const STATE_BYTES = 16;
const VERIFIER = /^[A-Za-z0-9_-]{43}$/;
const STATE = /^[A-Za-z0-9_-]{22}$/;
const RECORD_KEYS: readonly string[] = ["v", "verifier", "state", "remember"];
/** An origin: a protocol, then a host and port with no path, query, hash or white space. */
const ORIGIN = /^https?:\/\/[^\s/?#]+$/;
const STUDIO = "/studio";
/** The code exchange's deadline (10.4, controller ruling on Task 4.9's review). */
const EXCHANGE_TIMEOUT_MS = 15_000;
/** A studio hash that holds a design; any other returns to a fresh studio. */
const DESIGN_HASH = "#s=";

const fail = (reason: Extract<ConnectResult, { ok: false }>["reason"]): ConnectResult => ({
  ok: false,
  reason,
});

function isStorage(value: unknown): value is StorageLike {
  return (
    isRecord(value) &&
    typeof value.getItem === "function" &&
    typeof value.setItem === "function" &&
    typeof value.removeItem === "function"
  );
}

function checkAi(ai: unknown, caller: string): asserts ai is AiModule {
  if (!isRecord(ai)) {
    throw new TypeError(`${caller}: ai must be the @/ai module, got ${describeType(ai)}`);
  }
}

/**
 * Saves the studio's hash before "Connect your OpenRouter key" opens /connect, so the sign-in can
 * return to the same design. Storage errors are ignored: the sign-in then returns to /studio.
 */
export function saveReturn(session: StorageLike | null, hash: string): void {
  assertString(hash, "saveReturn: hash");
  if (session !== null && !isStorage(session)) {
    throw new TypeError(
      `saveReturn: session must be a storage or null, got ${describeType(session)}`,
    );
  }
  try {
    session?.setItem(RETURN_STORAGE, hash);
  } catch {
    // Without the hash the sign-in returns to a fresh studio.
  }
}

/** Web Crypto with the two calls the sign-in makes, or a TypeError naming `name`. */
function checkCrypto(value: unknown, name: string): asserts value is Crypto {
  const subtle = isRecord(value) ? value.subtle : undefined;
  if (
    !isRecord(value) ||
    typeof value.getRandomValues !== "function" ||
    !isRecord(subtle) ||
    typeof subtle.digest !== "function"
  ) {
    throw new TypeError(
      `${name} must be Web Crypto with getRandomValues and subtle.digest, got ${describeType(value)}`,
    );
  }
}

/**
 * Starts the sign-in ("Continue to OpenRouter"): a verifier of 32 random bytes and a state of 16,
 * both base64url, the verifier's S256 challenge, and `{ v: 1, verifier, state, remember }` in
 * session storage. It returns the authorize URL to navigate to. Without Web Crypto it throws a
 * TypeError; a storage that throws rejects with its own error, and then nothing is stored.
 */
export async function startConnect(
  ai: AiModule,
  deps: { crypto: Crypto; session: StorageLike; origin: string; remember: boolean },
): Promise<string> {
  checkAi(ai, "startConnect");
  assertRecord(deps, "startConnect: deps");
  const { crypto, session, origin, remember } = deps;
  checkCrypto(crypto, "startConnect: deps.crypto");
  if (!isStorage(session)) {
    throw new TypeError(
      `startConnect: deps.session must be a storage, got ${describeType(session)}`,
    );
  }
  assertString(origin, "startConnect: deps.origin");
  if (!ORIGIN.test(origin)) {
    throw new RangeError(
      `startConnect: deps.origin must be an http or https origin, got ${JSON.stringify(origin)}`,
    );
  }
  if (typeof remember !== "boolean") {
    throw new TypeError(
      `startConnect: deps.remember must be a boolean, got ${describeType(remember)}`,
    );
  }
  const verifier = ai.base64url(crypto.getRandomValues(new Uint8Array(VERIFIER_BYTES)));
  const state = ai.base64url(crypto.getRandomValues(new Uint8Array(STATE_BYTES)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = ai.base64url(new Uint8Array(digest));
  const url = ai.authorizeUrl({ callbackUrl: `${origin}/connect/callback`, challenge, state });
  const record: ConnectRecord = { v: 1, verifier, state, remember };
  session.setItem(CONNECT_STORAGE, JSON.stringify(record));
  return url;
}

/** The record as stored, or null when it is not one `startConnect` writes. */
function readRecord(text: string | null): ConnectRecord | null {
  if (text === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;
  const keys = Object.keys(value);
  if (keys.length !== RECORD_KEYS.length || !RECORD_KEYS.every((key) => keys.includes(key))) {
    return null;
  }
  const { v, verifier, state, remember } = value;
  const valid =
    v === 1 &&
    typeof verifier === "string" &&
    VERIFIER.test(verifier) &&
    typeof state === "string" &&
    STATE.test(state) &&
    typeof remember === "boolean";
  return valid ? { v, verifier, state, remember } : null;
}

/**
 * Reads one item of session storage and removes it. It fails closed: an item that cannot be read,
 * or cannot be removed, reads as none, so a record is used only once it is gone from storage.
 */
function take(session: StorageLike, key: string): string | null {
  try {
    const text = session.getItem(key);
    session.removeItem(key);
    return text;
  } catch {
    return null;
  }
}

/**
 * Exchanges the code for a key at OpenRouter: `{ code, code_verifier, code_challenge_method:
 * "S256" }`, with no cookie, no referrer and no redirect followed (a 307 would send the code and the
 * verifier on). It gives the key, or null for a status outside 200 to 299, a network error or a
 * redirect, a body that is not JSON or is over 262,144 bytes, a `key` that is not a key, or no full
 * answer within 15,000 ms (the call is then aborted, and a fetch that ignores its signal is not
 * waited for).
 */
async function exchange(
  ai: AiModule,
  send: typeof fetch,
  code: string,
  verifier: string,
): Promise<string | null> {
  const controller = new AbortController();
  const { signal } = controller;
  const ended = new Promise<null>((resolve) => {
    signal.addEventListener("abort", () => resolve(null), { once: true });
  });
  const timer = setTimeout(() => controller.abort(), EXCHANGE_TIMEOUT_MS);
  const call = async (): Promise<string | null> => {
    try {
      const response = await send(`${ai.OPENROUTER_ORIGIN}/api/v1/auth/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: "S256" }),
        signal,
        credentials: "omit",
        referrerPolicy: "no-referrer",
        cache: "no-store",
        redirect: "error",
      });
      const { status } = response;
      if (!Number.isInteger(status) || status < 200 || status > 299) return null;
      const text = await readCapped(response, signal);
      if (signal.aborted) return null;
      const json: unknown = JSON.parse(text);
      return isRecord(json) && isKey(json.key) ? json.key : null;
    } catch {
      return null;
    }
  };
  try {
    return await Promise.race([call(), ended]);
  } finally {
    clearTimeout(timer);
  }
}

/** Checks the stores `finishConnect` takes: session storage must be there; local may be null. */
function checkStores(stores: unknown): asserts stores is Stores & { session: StorageLike } {
  assertRecord(stores, "finishConnect: deps.stores");
  if (!isStorage(stores.session)) {
    throw new TypeError(
      `finishConnect: deps.stores.session must be a storage, got ${describeType(stores.session)}`,
    );
  }
  if (stores.local !== null && !isStorage(stores.local)) {
    throw new TypeError(
      `finishConnect: deps.stores.local must be a storage or null, got ${describeType(stores.local)}`,
    );
  }
}

/**
 * Finishes the sign-in on /connect/callback (section 10.4). It removes the record first, so no code
 * is ever exchanged twice, then returns `denied` without a code (checked before anything else: a
 * denial carries no state), `not-started` without a record it could read and remove,
 * `state-mismatch` when the state is missing or differs (these three with no request),
 * `exchange-failed` when the exchange fails, and `storage-refused` when the browser will not keep
 * the key in the store the visitor chose (the key is then kept nowhere). On success the key is
 * stored as the visitor chose, `dyelot:return` is removed, and `returnTo` is /studio with the saved
 * hash when it holds a design.
 */
export async function finishConnect(
  ai: AiModule,
  deps: { search: string; stores: Stores & { session: StorageLike }; fetch: typeof fetch },
): Promise<ConnectResult> {
  checkAi(ai, "finishConnect");
  assertRecord(deps, "finishConnect: deps");
  const { search, stores, fetch: send } = deps;
  assertString(search, "finishConnect: deps.search");
  checkStores(stores);
  assertFunction(send, "finishConnect: deps.fetch");
  const { code, state } = ai.readCallback(search);
  const record = readRecord(take(stores.session, CONNECT_STORAGE));
  if (code === null) return fail("denied");
  if (record === null) return fail("not-started");
  if (state === null || state !== record.state) return fail("state-mismatch");
  const key = await exchange(ai, send, code, record.verifier);
  if (key === null) return fail("exchange-failed");
  try {
    // The key, the record and the stores are checked, so only the browser's storage can refuse.
    storeKey(stores, key, record.remember);
  } catch {
    return fail("storage-refused");
  }
  const hash = take(stores.session, RETURN_STORAGE);
  return { ok: true, returnTo: hash?.startsWith(DESIGN_HASH) ? `${STUDIO}${hash}` : STUDIO };
}
