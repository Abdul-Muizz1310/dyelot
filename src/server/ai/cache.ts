import { isFreeSlug, type TierName } from "@/ai";

// The per-instance cache of successes (docs/specs/04-ai.md, R4-19 and section 11.5): no "use cache",
// at most `max` entries in memory for `ttlMs` each, least recently used out first. The key is
// `cacheKey(feature, input, version)` from @/ai; only a tier's success is stored, with its slug, tier
// and attempts, so a hit answers with the path that first produced it. The result is stored as a
// deep-frozen clone, so neither the caller nor any hit can change what a later hit is served.

export type CachedResult = {
  readonly result: unknown;
  readonly slug: string;
  readonly tier: TierName;
  readonly attempts: number;
};
export type AiCache = {
  get(key: string): CachedResult | undefined;
  set(key: string, value: CachedResult): void;
  size(): number;
};

const MAX_DEFAULT = 256;
const TTL_DEFAULT_MS = 86_400_000;
/** One attempt per tier, three tiers at most (R4-12). */
const MAX_ATTEMPTS = 3;
/** Every tier name, once: the compiler checks this record against `TierName`. */
const TIER_NAMES: Readonly<Record<TierName, true>> = {
  primary: true,
  fast: true,
  fallback: true,
  "vision-1": true,
  "vision-2": true,
  "vision-3": true,
};

type Entry = { readonly value: CachedResult; readonly storedAt: number };

function describeType(value: unknown): string {
  if (value === null) return "null";
  return Array.isArray(value) ? "array" : typeof value;
}

/** An integer of at least 1, or `fallback` when undefined. */
function positiveInteger(value: unknown, fallback: number, name: string): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number") {
    throw new TypeError(`createAiCache: ${name} must be a number, got ${describeType(value)}`);
  }
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`createAiCache: ${name} must be an integer of at least 1, got ${value}`);
  }
  return value;
}

function checkKey(key: unknown, caller: string): asserts key is string {
  if (typeof key !== "string") {
    throw new TypeError(`${caller}: key must be a string, got ${describeType(key)}`);
  }
}

/** `value` with every object and array inside it frozen; a value seen already is skipped. */
function deepFreeze(value: unknown): void {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const item of Object.values(value)) deepFreeze(item);
}

/** A deep-frozen clone of `result`, or a TypeError when it holds what cannot be cloned. */
function frozenClone(result: unknown, at: string): unknown {
  let clone: unknown;
  try {
    clone = structuredClone(result);
  } catch {
    throw new TypeError(`${at}.result must hold only data that can be cloned, such as JSON`);
  }
  deepFreeze(clone);
  return clone;
}

/** A frozen copy of a success with its four fields only, each checked, the result a deep clone. */
function storedValue(value: unknown): CachedResult {
  const at = "AiCache.set: value";
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${at} must be an object, got ${describeType(value)}`);
  }
  const { result, slug, tier, attempts } = value as Readonly<Record<string, unknown>>;
  if (result === undefined) throw new TypeError(`${at}.result must be defined`);
  if (typeof slug !== "string") {
    throw new TypeError(`${at}.slug must be a string, got ${describeType(slug)}`);
  }
  if (!isFreeSlug(slug)) throw new RangeError(`${at}.slug must be a free slug, got ${slug}`);
  if (typeof tier !== "string") {
    throw new TypeError(`${at}.tier must be a string, got ${describeType(tier)}`);
  }
  if (!Object.hasOwn(TIER_NAMES, tier)) {
    throw new RangeError(`${at}.tier must be a tier name, got ${JSON.stringify(tier)}`);
  }
  if (typeof attempts !== "number") {
    throw new TypeError(`${at}.attempts must be a number, got ${describeType(attempts)}`);
  }
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > MAX_ATTEMPTS) {
    throw new RangeError(
      `${at}.attempts must be an integer from 1 to ${MAX_ATTEMPTS}, got ${attempts}`,
    );
  }
  const stored = frozenClone(result, at);
  return Object.freeze({ result: stored, slug, tier: tier as TierName, attempts });
}

/**
 * A cache of successes on the injected clock `now`: `get` returns an entry younger than `ttlMs` and
 * makes it the most recent, deleting an older one or one whose clock has stepped back (a negative
 * age); `set` stores or replaces an entry, making it the most recent, and evicts the least recent
 * once the size passes `max`. Every entry it serves is deep-frozen.
 */
export function createAiCache(args: { now: () => number; max?: number; ttlMs?: number }): AiCache {
  if (typeof args !== "object" || args === null || Array.isArray(args)) {
    throw new TypeError(`createAiCache: args must be an object, got ${describeType(args)}`);
  }
  const { now } = args;
  if (typeof now !== "function") {
    throw new TypeError(`createAiCache: args.now must be a function, got ${describeType(now)}`);
  }
  const max = positiveInteger(args.max, MAX_DEFAULT, "args.max");
  const ttlMs = positiveInteger(args.ttlMs, TTL_DEFAULT_MS, "args.ttlMs");
  /** Insertion order is recency: the first key is the least recently used. */
  const entries = new Map<string, Entry>();

  const clock = (caller: string): number => {
    const time: unknown = now();
    if (typeof time !== "number") {
      throw new TypeError(`${caller}: now() must return a number, got ${describeType(time)}`);
    }
    if (!Number.isFinite(time))
      throw new RangeError(`${caller}: now() must be finite, got ${time}`);
    return time;
  };

  return Object.freeze({
    get(key: string): CachedResult | undefined {
      checkKey(key, "AiCache.get");
      const entry = entries.get(key);
      if (entry === undefined) return undefined;
      const time = clock("AiCache.get");
      entries.delete(key);
      const age = time - entry.storedAt;
      if (age < 0 || age >= ttlMs) return undefined;
      entries.set(key, entry);
      return entry.value;
    },
    set(key: string, value: CachedResult): void {
      checkKey(key, "AiCache.set");
      const stored = storedValue(value);
      const storedAt = clock("AiCache.set");
      entries.delete(key);
      entries.set(key, { value: stored, storedAt });
      if (entries.size > max) {
        const oldest = entries.keys().next();
        if (!oldest.done) entries.delete(oldest.value);
      }
    },
    size(): number {
      return entries.size;
    },
  });
}
