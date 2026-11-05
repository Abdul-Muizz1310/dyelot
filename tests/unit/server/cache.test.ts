import { describe, expect, it } from "vitest";
import { type CachedResult, createAiCache } from "@/server/ai/cache";
import { BRIEF_OUT, NOW, TEXT_SLUGS } from "../ai/fixtures";

// C-CACHE-01 and C-CACHE-02 of docs/specs/04-ai.md, section 14.7: the per-instance cache of successes
// (R4-19, section 11.5), least recently used out first, with an injected clock.

const DAY_MS = 86_400_000;
const hit = (n: number): CachedResult => ({
  result: { ...BRIEF_OUT, name: `Lot ${n}` },
  slug: TEXT_SLUGS[0],
  tier: "primary",
  attempts: 1,
});

/** A cache on a clock the test moves. */
function cacheAt(start = NOW, options: { max?: number; ttlMs?: number } = {}) {
  let time = start;
  const cache = createAiCache({ now: () => time, ...options });
  return {
    cache,
    at(ms: number) {
      time = ms;
    },
  };
}

describe("C-CACHE-01 the cache keeps 256 successes for a day, least recently used out first", () => {
  it("C-CACHE-01 the 257th set evicts the least recently used entry", () => {
    const { cache } = cacheAt();
    for (let i = 0; i < 256; i += 1) cache.set(`key-${i}`, hit(i));
    expect(cache.size()).toBe(256);
    cache.set("key-256", hit(256));
    expect(cache.size()).toBe(256);
    expect(cache.get("key-0")).toBeUndefined();
    expect(cache.get("key-1")).toEqual(hit(1));
    expect(cache.get("key-256")).toEqual(hit(256));
  });

  it("C-CACHE-01 a get makes an entry the most recent", () => {
    const { cache } = cacheAt();
    for (let i = 0; i < 256; i += 1) cache.set(`key-${i}`, hit(i));
    expect(cache.get("key-0")).toEqual(hit(0));
    cache.set("key-256", hit(256));
    expect(cache.get("key-0")).toEqual(hit(0));
    expect(cache.get("key-1")).toBeUndefined();
    expect(cache.get("key-2")).toEqual(hit(2));
  });

  it("C-CACHE-01 an entry is a hit at 86,399,999 ms and a miss, deleted, at 86,400,000", () => {
    const { cache, at } = cacheAt();
    cache.set("brief:v2:abc", hit(1));
    cache.set("brief:v2:def", hit(2));
    at(NOW + DAY_MS - 1);
    expect(cache.get("brief:v2:abc")).toEqual(hit(1));
    expect(cache.size()).toBe(2);
    at(NOW + DAY_MS);
    expect(cache.get("brief:v2:abc")).toBeUndefined();
    expect(cache.size()).toBe(1);
    at(NOW);
    expect(cache.get("brief:v2:abc")).toBeUndefined();
  });

  it("C-CACHE-01 a get does not extend an entry's day", () => {
    const { cache, at } = cacheAt();
    cache.set("k", hit(1));
    at(NOW + DAY_MS - 1);
    expect(cache.get("k")).toEqual(hit(1));
    at(NOW + DAY_MS);
    expect(cache.get("k")).toBeUndefined();
  });

  it("C-CACHE-01 a set replaces an entry, restarts its day and makes it the most recent", () => {
    const { cache, at } = cacheAt(NOW, { max: 2 });
    cache.set("a", hit(1));
    cache.set("b", hit(2));
    at(NOW + 1000);
    cache.set("a", { ...hit(3), slug: TEXT_SLUGS[1], tier: "fast", attempts: 2 });
    expect(cache.size()).toBe(2);
    cache.set("c", hit(4));
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toEqual({ ...hit(3), slug: TEXT_SLUGS[1], tier: "fast", attempts: 2 });
    at(NOW + 1000 + DAY_MS - 1);
    expect(cache.get("a")).toBeDefined();
  });

  it("C-CACHE-01 takes max and ttlMs, and defaults to 256 and a day", () => {
    const { cache, at } = cacheAt(NOW, { max: 1, ttlMs: 10 });
    cache.set("a", hit(1));
    cache.set("b", hit(2));
    expect(cache.size()).toBe(1);
    expect(cache.get("a")).toBeUndefined();
    at(NOW + 9);
    expect(cache.get("b")).toEqual(hit(2));
    at(NOW + 10);
    expect(cache.get("b")).toBeUndefined();
  });

  it("C-CACHE-01 stores the result, slug, tier and attempts only, frozen, apart from the caller's object", () => {
    const { cache } = cacheAt();
    const value = { ...hit(1), cached: true } as CachedResult;
    cache.set("k", value);
    const stored = cache.get("k");
    expect(stored).toStrictEqual(hit(1));
    expect(Object.isFrozen(stored)).toBe(true);
    (value as { attempts: number }).attempts = 3;
    expect(cache.get("k")?.attempts).toBe(1);
  });

  it("C-CACHE-01 two caches share nothing", () => {
    const first = cacheAt().cache;
    const second = cacheAt().cache;
    first.set("k", hit(1));
    expect(second.get("k")).toBeUndefined();
    expect(second.size()).toBe(0);
  });
});

describe("C-CACHE-02 a wrong argument is refused (R-05)", () => {
  const now = () => NOW;

  it.each([
    ["max 0", { now, max: 0 }],
    ["max -1", { now, max: -1 }],
    ["max 1.5", { now, max: 1.5 }],
    ["max Infinity", { now, max: Number.POSITIVE_INFINITY }],
    ["ttlMs -1", { now, ttlMs: -1 }],
    ["ttlMs 0", { now, ttlMs: 0 }],
    ["ttlMs NaN", { now, ttlMs: Number.NaN }],
    ["ttlMs 0.5", { now, ttlMs: 0.5 }],
  ])("C-CACHE-02 createAiCache with %s throws RangeError naming itself", (_, args) => {
    expect(() => createAiCache(args)).toThrow(RangeError);
    expect(() => createAiCache(args)).toThrow(/^createAiCache: /);
  });

  it.each([
    ["args null", null],
    ["no now", {}],
    ["now a number", { now: NOW }],
    ["max as text", { now, max: "256" }],
    ["ttlMs as text", { now, ttlMs: "86400000" }],
  ])("C-CACHE-02 createAiCache with %s throws TypeError naming itself", (_, args) => {
    const call = () => createAiCache(args as unknown as Parameters<typeof createAiCache>[0]);
    expect(call).toThrow(TypeError);
    expect(call).toThrow(/^createAiCache: /);
  });

  it("C-CACHE-02 get(5) throws TypeError, and so does set with a key that is not a string", () => {
    const { cache } = cacheAt();
    expect(() => cache.get(5 as unknown as string)).toThrow(TypeError);
    expect(() => cache.get(5 as unknown as string)).toThrow(/^AiCache\.get: /);
    expect(() => cache.set(5 as unknown as string, hit(1))).toThrow(TypeError);
    expect(() => cache.set(5 as unknown as string, hit(1))).toThrow(/^AiCache\.set: /);
  });

  it.each([
    ["a value null", null, TypeError],
    ["no result", { slug: TEXT_SLUGS[0], tier: "primary", attempts: 1 }, TypeError],
    ["a slug 5", { ...hit(1), slug: 5 }, TypeError],
    ["a slug that is not free", { ...hit(1), slug: "test/text-1" }, RangeError],
    ["a tier 5", { ...hit(1), tier: 5 }, TypeError],
    ["a tier outside the six", { ...hit(1), tier: "turbo" }, RangeError],
    ["attempts as text", { ...hit(1), attempts: "1" }, TypeError],
    ["attempts 0", { ...hit(1), attempts: 0 }, RangeError],
    ["attempts 4", { ...hit(1), attempts: 4 }, RangeError],
    ["attempts 1.5", { ...hit(1), attempts: 1.5 }, RangeError],
  ])("C-CACHE-02 set with %s throws, naming AiCache.set, and stores nothing", (_, value, type) => {
    const { cache } = cacheAt();
    expect(() => cache.set("k", value as unknown as CachedResult)).toThrow(type);
    expect(() => cache.set("k", value as unknown as CachedResult)).toThrow(/^AiCache\.set: /);
    expect(cache.size()).toBe(0);
  });

  it("C-CACHE-02 a clock that gives no finite number is refused at get and set", () => {
    let time: unknown = NOW;
    const cache = createAiCache({ now: () => time as number });
    cache.set("k", hit(1));
    for (const [bad, type] of [
      ["1793880000000", TypeError],
      [undefined, TypeError],
      [Number.NaN, RangeError],
      [Number.POSITIVE_INFINITY, RangeError],
    ] as const) {
      time = bad;
      expect(() => cache.get("k"), String(bad)).toThrow(type);
      expect(() => cache.get("k")).toThrow(/^AiCache\.get: /);
      expect(() => cache.set("j", hit(2)), String(bad)).toThrow(type);
      expect(() => cache.set("j", hit(2))).toThrow(/^AiCache\.set: /);
    }
    time = NOW;
    expect(cache.size()).toBe(1);
  });
});
