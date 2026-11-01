import { deflateRawSync } from "node:zlib";
import { vi } from "vitest";
import { type DirectionParams, generateSystem } from "@/engine";
import type { DesignSpec } from "@/spec";
import { deepFreeze, linkOfDeflated } from "../../spec/support";

// Shared fixtures for the studio cases of docs/specs/02-studio.md, sections 6.7 and 6.8. `FRESH` is
// the first-load state with `newSeed` stubbed to return "seed-1" (section 4, Fixtures).

/** The `default` preset's parameters with the studio's gamut, written out from spec section 5.3. */
export const FRESH_PARAMS: DirectionParams = Object.freeze({
  harmony: "analogous",
  chroma: "balanced",
  neutralTint: "brand",
  gamut: "srgb",
  scaleMode: "standard",
  contrastLevel: "AA",
  type: Object.freeze({ context: "product" }),
  radius: "soft",
  depth: "soft",
  motion: "brisk",
});

const generated = new Map<string, DesignSpec>();

/** `generateSystem(params, seed)`, once per params and seed in a test file, frozen. */
export function generate(params: DirectionParams, seed: string): DesignSpec {
  const key = JSON.stringify([params, seed]);
  const hit = generated.get(key);
  if (hit !== undefined) return hit;
  const spec = deepFreeze(generateSystem(params, seed));
  generated.set(key, spec);
  return spec;
}

/** `FRESH_PARAMS` with the pairing `choosePairing("seed-1")` picks (spec R2-05: "young-onest"). */
export function resolvedFresh(): DirectionParams {
  return { ...FRESH_PARAMS, pairing: "young-onest" };
}

/** The spec of `FRESH`: `generateSystem(resolveParams(FRESH_PARAMS, "seed-1"), "seed-1")`. */
export const freshSpec = (): DesignSpec => generate(resolvedFresh(), "seed-1");

/** An in-memory `localStorage`. */
export function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    items,
    getItem: vi.fn((key: string) => items.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      items.set(key, String(value));
    }),
    removeItem: vi.fn((key: string) => {
      items.delete(key);
    }),
  };
}

/** A storage whose every method throws, as a blocked or full `localStorage` does (RF2). */
export function throwingStorage() {
  const fail = (): never => {
    throw new DOMException("The operation is insecure.", "SecurityError");
  };
  return { getItem: vi.fn(fail), setItem: vi.fn(fail), removeItem: vi.fn(fail) };
}

/** A clock the test moves by hand (spec section 4: a fake `clock` drives every coalesce window). */
export function fakeClock(start = 1_000_000) {
  let now = start;
  return {
    now: () => now,
    advance(ms: number) {
      now += ms;
    },
  };
}

/** `newSeed` that returns the given seeds in turn, then `seed-<n>` for the n-th call. */
export function seedSequence(...seeds: string[]) {
  let calls = 0;
  return vi.fn(() => {
    const seed = seeds[calls] ?? `seed-${calls + 1}`;
    calls++;
    return seed;
  });
}

/** A location and a history whose `replaceState` writes the hash the way a browser does. */
export function fakeLocation(hash = "") {
  const location = { hash, pathname: "/studio", search: "" };
  const history = {
    replaceState: vi.fn((_data: unknown, _unused: string, url?: string | URL | null) => {
      const text = String(url ?? "");
      const at = text.indexOf("#");
      location.hash = at === -1 ? "" : text.slice(at);
    }),
  };
  return { location, history };
}

/**
 * A link whose payload is any JSON value (R-22's format around Node's deflate). The bytes are
 * copied into this realm's Uint8Array: jsdom's global is not Node's, so a Buffer fails the
 * codec's `instanceof` check.
 */
export function linkOfValue(value: unknown): string {
  const deflated = deflateRawSync(Buffer.from(JSON.stringify(value), "utf8"), { level: 9 });
  return linkOfDeflated(new Uint8Array(deflated));
}
