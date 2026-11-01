import { strToU8 } from "fflate";
import { describeType } from "../engine/color/guards";
import { canonicalize } from "./canonical";
import type { DesignSpec } from "./schema";

// FNV-1a 64: the offset basis 0xcbf29ce484222325 and the prime 2^40 + 0x1b3. The state lives in
// four 16-bit limbs, lowest first, so every product stays an exact integer in a double; the
// ES2017 target rules out BigInt literals, and BigInt arithmetic is slower besides.
const BASIS: readonly [number, number, number, number] = [0x2325, 0x8422, 0x9ce4, 0xcbf2];
const PRIME_LOW = 0x1b3;

function bytesOf(input: string | Uint8Array): Uint8Array {
  if (typeof input === "string") return strToU8(input);
  if (input instanceof Uint8Array) return input;
  throw new TypeError(
    `fnv1a64: input must be a string or a Uint8Array, got ${describeType(input)}`,
  );
}

const limbHex = (limb: number): string => limb.toString(16).padStart(4, "0");

/**
 * FNV-1a 64 as 16 lowercase hex digits (spec R-21, R-25). A string hashes as its UTF-8 bytes,
 * from fflate's `strToU8`, so the core needs no `TextEncoder`; a `Uint8Array` hashes as given.
 * `specId` and the share link's trailer both use it.
 */
export function fnv1a64(input: string | Uint8Array): string {
  const bytes = bytesOf(input);
  let [h0, h1, h2, h3] = BASIS;
  for (let i = 0; i < bytes.length; i++) {
    h0 ^= bytes[i];
    // Times the prime: 0x1b3 limb by limb, plus 2^40, which shifts h0 and h1 by 40 bits into
    // limbs 2 and 3 (16 × 2 + 8). Carries move up; bits past 64 drop out of the top limb.
    const t0 = h0 * PRIME_LOW;
    const t1 = h1 * PRIME_LOW + (t0 >>> 16);
    const t2 = h2 * PRIME_LOW + (h0 << 8) + (t1 >>> 16);
    const t3 = h3 * PRIME_LOW + (h1 << 8) + (t2 >>> 16);
    h0 = t0 & 0xffff;
    h1 = t1 & 0xffff;
    h2 = t2 & 0xffff;
    h3 = t3 & 0xffff;
  }
  return limbHex(h3) + limbHex(h2) + limbHex(h1) + limbHex(h0);
}

/** A spec's identity: FNV-1a 64 of its canonical string (spec R-21), 16 lowercase hex digits. */
export function specId(spec: DesignSpec): string {
  return fnv1a64(canonicalize(spec));
}
