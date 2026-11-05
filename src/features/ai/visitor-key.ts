import type {
  AiFeature,
  AiPath,
  ChatRequest,
  ChatResponse,
  FeatureInput,
  FeatureOutput,
  ProviderFailure,
  Tier,
  TierName,
} from "@/ai";
import { type AiModule, assertFunction, assertSignal, checkAsk } from "@/features/ai/load";
import type { StorageLike } from "@/features/studio/drafts";
import { assertRecord, assertString, describeType, isRecord } from "@/features/studio/guards";

// The visitor's own OpenRouter key (docs/specs/04-ai.md, R4-29, R4-33, R4-34, DR-0040): where the
// browser keeps it, the slugs it may use, and the calls it makes with it. The key lives only in the
// visitor's session storage, or local storage when they chose "Remember on this device"; every call
// that carries it goes from the browser straight to `OPENROUTER_ORIGIN`, never to dyelot's origin,
// and no error message, log or trace holds it. This is the one file of src that names its storage key.

/** The storage key of the visitor's OpenRouter key; C-GUARD4-09 keeps it to this file. */
export const KEY_STORAGE = "dyelot:openrouter-key";

/** The two stores the key may live in; either is null where the browser gives none. */
export type Stores = { readonly session: StorageLike | null; readonly local: StorageLike | null };
export type Models = { readonly text: readonly string[]; readonly vision: readonly string[] };

type KeyPath = Extract<AiPath, { provider: "visitor-key" }>;
type KeyFailure = Extract<ProviderFailure, { provider: "visitor-key" }>;
export type KeyResult<F extends AiFeature> =
  | { readonly ok: true; readonly output: FeatureOutput[F]; readonly path: KeyPath }
  | { readonly ok: false; readonly failure: KeyFailure };

/** A key: 20 to 400 printable ASCII characters with no space (R4-33). */
const KEY = /^[\x21-\x7e]{20,400}$/;
/** An origin: a protocol, then a host and port with no path, query, hash or white space. */
const ORIGIN = /^https?:\/\/[^\s/?#]+$/;
/** One action makes at most three attempts on one path, one per tier (R4-12, R4-34). */
const MAX_ATTEMPTS = 3;
/** Each tier's own timeout (R4-12). */
const TIER_TIMEOUT_MS = 20_000;
/** The most bytes of a reply body either transport reads (R4-11). */
const REPLY_MAX_BYTES = 262_144;
const MIN_STATUS = 100;
const MAX_STATUS = 599;
const TEXT_TIERS: readonly TierName[] = ["primary", "fast", "fallback"];
const VISION_TIERS: readonly TierName[] = ["vision-1", "vision-2", "vision-3"];

const TIMEOUT: ChatResponse = Object.freeze({ kind: "timeout" });
const NETWORK: ChatResponse = Object.freeze({ kind: "network" });

// ——— The stores ———

function isStorage(value: unknown): value is StorageLike {
  return (
    isRecord(value) &&
    typeof value.getItem === "function" &&
    typeof value.setItem === "function" &&
    typeof value.removeItem === "function"
  );
}

/** The two stores, checked: an object whose `session` and `local` are each a storage or null. */
function checkStores(stores: unknown, caller: string): asserts stores is Stores {
  assertRecord(stores, `${caller}: stores`);
  for (const name of ["session", "local"] as const) {
    const store = stores[name];
    if (store !== null && !isStorage(store)) {
      throw new TypeError(
        `${caller}: stores.${name} must be a storage or null, got ${describeType(store)}`,
      );
    }
  }
}

/**
 * A key, checked: a TypeError for another type, a RangeError for a string that is not a key. The
 * message never holds the value, so the key cannot reach a log through an error.
 */
function checkKey(key: unknown, name: string): asserts key is string {
  if (typeof key !== "string") {
    throw new TypeError(`${name} must be a string, got ${describeType(key)}`);
  }
  if (!KEY.test(key)) {
    throw new RangeError(`${name} must be 20 to 400 printable ASCII characters with no space`);
  }
}

/** Whether `value` is a key: a string of 20 to 400 printable ASCII characters with no space (R4-33). */
export function isKey(value: unknown): value is string {
  return typeof value === "string" && KEY.test(value);
}

/** The key one store holds, or null when it holds none, holds something else or throws. */
function keyIn(store: StorageLike | null): string | null {
  try {
    const value = store?.getItem(KEY_STORAGE) ?? null;
    return isKey(value) ? value : null;
  } catch {
    return null;
  }
}

/** Removes the key from one store; a storage error is swallowed. */
function removeFrom(store: StorageLike | null): void {
  try {
    store?.removeItem(KEY_STORAGE);
  } catch {
    // A store that throws holds nothing this tab can read.
  }
}

/** The stored key, session storage first; `remembered` says it came from local storage. */
export function readKey(stores: Stores): { key: string; remembered: boolean } | null {
  checkStores(stores, "readKey");
  const session = keyIn(stores.session);
  if (session !== null) return { key: session, remembered: false };
  const local = keyIn(stores.local);
  return local === null ? null : { key: local, remembered: true };
}

/**
 * Keeps the key in local storage when the visitor chose to remember it, else in session storage,
 * and takes any older copy out of the other store, so the visitor's choice is the one that holds.
 * It throws an Error naming itself, never the key, when the store it needs is missing or refuses.
 */
export function storeKey(stores: Stores, key: string, remember: boolean): void {
  checkStores(stores, "storeKey");
  checkKey(key, "storeKey: key");
  if (typeof remember !== "boolean") {
    throw new TypeError(`storeKey: remember must be a boolean, got ${describeType(remember)}`);
  }
  const [target, other, name] = remember
    ? [stores.local, stores.session, "local"]
    : [stores.session, stores.local, "session"];
  if (target === null) throw new Error(`storeKey: this browser gives no ${name} storage`);
  try {
    target.setItem(KEY_STORAGE, key);
  } catch (error) {
    throw new Error(`storeKey: the browser refused to keep the key in ${name} storage`, {
      cause: error,
    });
  }
  removeFrom(other);
}

/** Removes the key from both stores ("Disconnect"); storage errors are swallowed. */
export function clearKey(stores: Stores): void {
  checkStores(stores, "clearKey");
  removeFrom(stores.session);
  removeFrom(stores.local);
}

// ——— The slugs ———

/** A list of at most three slugs from the route, or null for any other value. */
function slugList(value: unknown): readonly string[] | null {
  if (!Array.isArray(value) || value.length > MAX_ATTEMPTS) return null;
  return value.every((slug) => typeof slug === "string") ? Object.freeze([...value]) : null;
}

/**
 * The slugs the shared route's environment names (`GET /api/ai/models`, R4-21), read from dyelot's
 * own origin with no key: `{ text, vision }`, or null for any other status, shape or a network error.
 */
export async function fetchModels(deps: { fetch: typeof fetch }): Promise<Models | null> {
  assertRecord(deps, "fetchModels: deps");
  assertFunction(deps.fetch, "fetchModels: deps.fetch");
  try {
    const response = await deps.fetch("/api/ai/models", {
      method: "GET",
      credentials: "same-origin",
    });
    if (response.status !== 200) return null;
    const json: unknown = JSON.parse(await response.text());
    if (!isRecord(json) || Object.keys(json).length !== 2) return null;
    const text = slugList(json.text);
    const vision = slugList(json.vision);
    return text === null || vision === null ? null : Object.freeze({ text, vision });
  } catch {
    return null;
  }
}

/** The models, checked: `{ text, vision }`, each an array of strings. */
function checkModels(models: unknown, name: string): asserts models is Models {
  assertRecord(models, name);
  for (const group of ["text", "vision"] as const) {
    const list = models[group];
    if (!Array.isArray(list)) {
      throw new TypeError(`${name}.${group} must be an array, got ${describeType(list)}`);
    }
    for (const [i, slug] of list.entries()) assertString(slug, `${name}.${group}[${i}]`);
  }
}

/**
 * The tiers the key tries for this feature: the free slugs of its group (text, or vision for
 * vibe), each once, the first three in the route's order, through `cascadePlan`.
 */
function planFor(ai: AiModule, feature: AiFeature, models: Models): readonly Tier[] {
  const tiers = (slugs: readonly string[], names: readonly TierName[]) =>
    [...new Set(slugs.filter((slug) => ai.isFreeSlug(slug)))]
      .slice(0, MAX_ATTEMPTS)
      .map((slug, i): Tier => ({ tier: names[i] as TierName, slug }));
  return ai.cascadePlan(feature, {
    text: tiers(models.text, TEXT_TIERS),
    vision: tiers(models.vision, VISION_TIERS),
  });
}

// ——— The transport ———

/**
 * At most `REPLY_MAX_BYTES` of the body, decoded as UTF-8. A body past the cap is not read further
 * and gives "", which readReply reads as `empty` (R4-11) and the code exchange as no key (10.4).
 * An abort cancels the read. The chat calls and the code exchange both read their replies here.
 */
export async function readCapped(response: Response, signal: AbortSignal): Promise<string> {
  const { body } = response;
  if (!body) return "";
  const reader = body.getReader();
  const stop = () => {
    reader.cancel().catch(() => {});
  };
  signal.addEventListener("abort", stop, { once: true });
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > REPLY_MAX_BYTES) {
        stop();
        return "";
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder().decode(bytes);
  } finally {
    signal.removeEventListener("abort", stop);
  }
}

/**
 * One tier's call from the browser to OpenRouter under its 20,000 ms deadline: the status and the
 * capped body text, `{ kind: "timeout" }` when the deadline passes first (the call is aborted and
 * the answer does not wait for a fetch that ignores it), or `{ kind: "network" }` for a fetch that
 * rejects (a redirect among them), a cancel, a body that fails mid-read or a status outside 100 to
 * 599, which readReply must never see (controller ruling). No cookie goes with it.
 */
async function sendChat(
  send: typeof fetch,
  request: ChatRequest,
  action: AbortSignal,
): Promise<ChatResponse> {
  const controller = new AbortController();
  const { signal } = controller;
  let timedOut = false;
  const cancel = () => controller.abort();
  action.addEventListener("abort", cancel, { once: true });
  const ended = new Promise<ChatResponse>((resolve) => {
    signal.addEventListener("abort", () => resolve(timedOut ? TIMEOUT : NETWORK), { once: true });
  });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TIER_TIMEOUT_MS);
  const call = async (): Promise<ChatResponse> => {
    try {
      const response = await send(request.url, {
        method: "POST",
        headers: { ...request.headers },
        body: request.body,
        signal,
        credentials: "omit",
        cache: "no-store",
        // The key never follows a redirect, as on the server (R4-11).
        redirect: "error",
      });
      const { status } = response;
      if (!Number.isInteger(status) || status < MIN_STATUS || status > MAX_STATUS) return NETWORK;
      const text = await readCapped(response, signal);
      if (signal.aborted) return timedOut ? TIMEOUT : NETWORK;
      return Object.freeze({ status, text });
    } catch {
      return timedOut ? TIMEOUT : NETWORK;
    }
  };
  try {
    return await Promise.race([call(), ended]);
  } finally {
    clearTimeout(timer);
    action.removeEventListener("abort", cancel);
  }
}

const failure = (reason: KeyFailure["reason"]): KeyResult<never> =>
  Object.freeze({ ok: false, failure: Object.freeze({ provider: "visitor-key", reason }) });

/**
 * One action with the visitor's key (R4-34): the same request builder, reader and cascade as the
 * server, over the free slugs of `models`, straight to `https://openrouter.ai/api/v1`. A 401 or 403
 * stops at once (`refused`: the next tier would refuse the key too); no free slug for the feature is
 * `no-models` with no call; three failed tiers, or a cancel, are `failed`. Never traced or logged.
 */
export async function askWithKey<F extends AiFeature>(
  ai: AiModule,
  feature: F,
  input: FeatureInput[F],
  deps: {
    fetch: typeof fetch;
    key: string;
    models: { text: readonly string[]; vision: readonly string[] };
    signal: AbortSignal;
    referer: string;
  },
): Promise<KeyResult<F>> {
  checkAsk(ai, feature, input, "askWithKey");
  assertRecord(deps, "askWithKey: deps");
  const { fetch: send, key, models, signal, referer } = deps;
  assertFunction(send, "askWithKey: deps.fetch");
  checkKey(key, "askWithKey: deps.key");
  checkModels(models, "askWithKey: deps.models");
  assertSignal(signal, "askWithKey: deps.signal");
  assertString(referer, "askWithKey: deps.referer");
  if (!ORIGIN.test(referer)) {
    throw new RangeError(
      `askWithKey: deps.referer must be an http or https origin, got ${JSON.stringify(referer)}`,
    );
  }
  const plan = planFor(ai, feature, models);
  if (plan.length === 0) return failure("no-models");
  const baseUrl = `${ai.OPENROUTER_ORIGIN}/api/v1`;
  for (let i = 0; i < plan.length && !signal.aborted; i += 1) {
    const { slug } = plan[i] as Tier;
    const request = ai.buildChatRequest({ feature, input, slug, baseUrl, apiKey: key, referer });
    const response = await sendChat(send, request, signal);
    if (signal.aborted) break;
    const outcome = ai.readReply(feature, input, response);
    if (outcome.ok) {
      return {
        ok: true,
        output: outcome.output,
        path: { provider: "visitor-key", slug, attempts: i + 1 },
      };
    }
    if (outcome.kind === "http" && (outcome.status === 401 || outcome.status === 403)) {
      return failure("refused");
    }
  }
  return failure("failed");
}
