import { describeType } from "./color/guards";

/**
 * cyrb53 (public domain) over the UTF-16 code units of `text`, with seed 0. Math.imul keeps every
 * step in 32 bits, so every platform gets the same 53-bit result. No Unicode normalization runs:
 * "é" and "e" plus a combining accent are different seeds.
 */
function cyrb53(text: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ unit, 2654435761);
    h2 = Math.imul(h2 ^ unit, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** mulberry32 (public domain): a generator of 32-bit state, one closure per stream. */
function mulberry32(seed32: number): () => number {
  let state = seed32;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The engine's only source of randomness. Any string is a seed, including "". The seed goes
 * through cyrb53 into the 32-bit state of mulberry32, so the same seed draws the same stream on
 * every platform. Each call returns an independent generator whose values lie in [0, 1).
 */
export function seededRandom(seed: string): () => number {
  if (typeof seed !== "string") {
    throw new TypeError(`seededRandom: seed must be a string, got ${describeType(seed)}`);
  }
  return mulberry32(cyrb53(seed) >>> 0);
}
