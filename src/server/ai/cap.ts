import { base64url, capMacInput, formatCapCookie, parseCapCookie, VISITOR_CAP } from "@/ai";
import { describeType } from "./transport";

// The visitor cap cookie's signature (docs/specs/04-ai.md, R4-18 and section 11.2), with Web Crypto:
// an HMAC-SHA256 key derived by HKDF-SHA256 from the cookie secret, a MAC over `v1.<day>.<count>`
// in base64url, and a check by `crypto.subtle.verify`, which compares in constant time. A cookie
// that is missing, malformed, mis-signed or of another day counts as 0, never as an error.

/** The HKDF info; a new version rotates every cookie at once. */
const INFO = new TextEncoder().encode("dyelot/ai-cap/v1");
/** The shortest cookie secret readAiEnv accepts (section 11.4). */
const SECRET_MIN_BYTES = 32;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** A MAC's 32 bytes in base64url without padding. */
const MAC_BYTES = 32;

/**
 * The HMAC key of the cap cookie: HKDF-SHA256 of `secret` with an empty salt and the info
 * `dyelot/ai-cap/v1`, 256 bits, usable to sign and verify and never exported.
 */
export async function deriveCapKey(secret: Uint8Array): Promise<CryptoKey> {
  if (!(secret instanceof Uint8Array)) {
    throw new TypeError(`deriveCapKey: secret must be a Uint8Array, got ${describeType(secret)}`);
  }
  if (secret.length < SECRET_MIN_BYTES) {
    throw new RangeError(
      `deriveCapKey: secret must hold at least ${SECRET_MIN_BYTES} bytes, got ${secret.length}`,
    );
  }
  // A copy of the bytes, on an ArrayBuffer of its own, is what importKey takes.
  const material = await crypto.subtle.importKey("raw", new Uint8Array(secret), "HKDF", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: INFO },
    material,
    { name: "HMAC", hash: "SHA-256", length: 256 },
    false,
    ["sign", "verify"],
  );
}

/** An HMAC-SHA256 key that can sign and verify: a TypeError or a RangeError naming `caller`. */
function checkKey(key: unknown, caller: string): asserts key is CryptoKey {
  if (!(key instanceof CryptoKey)) {
    throw new TypeError(`${caller}: key must be a CryptoKey, got ${describeType(key)}`);
  }
  const { name, hash } = key.algorithm as { name: string; hash?: { name: string } };
  const usable = key.usages.includes("sign") && key.usages.includes("verify");
  if (name !== "HMAC" || hash?.name !== "SHA-256" || !usable) {
    throw new RangeError(`${caller}: key must be an HMAC SHA-256 key that can sign and verify`);
  }
}

/** A day written YYYY-MM-DD: a TypeError or a RangeError naming `caller` and `name`. */
function checkDay(day: unknown, caller: string, name: string): asserts day is string {
  if (typeof day !== "string") {
    throw new TypeError(`${caller}: ${name} must be a string, got ${describeType(day)}`);
  }
  if (!DAY.test(day)) {
    throw new RangeError(`${caller}: ${name} must be YYYY-MM-DD, got ${JSON.stringify(day)}`);
  }
}

/** The bytes of a base64url text, or null when the text is not their one canonical spelling. */
function decodeMac(mac: string): Uint8Array<ArrayBuffer> | null {
  const standard = mac.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(standard.padEnd(Math.ceil(mac.length / 4) * 4, "="));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  // 43 characters carry 258 bits for 32 bytes: a last character whose two spare bits differ decodes
  // to the same bytes, so only the spelling base64url gives back is the MAC.
  return bytes.length === MAC_BYTES && base64url(bytes) === mac ? bytes : null;
}

/** The cookie's value for `count` actions on `day`: `v1.<day>.<count>.<mac>`. */
export async function signCap(key: CryptoKey, day: string, count: number): Promise<string> {
  checkKey(key, "signCap");
  checkDay(day, "signCap", "day");
  if (typeof count !== "number") {
    throw new TypeError(`signCap: count must be a number, got ${describeType(count)}`);
  }
  if (!Number.isInteger(count) || count < 0 || count > VISITOR_CAP) {
    throw new RangeError(
      `signCap: count must be an integer from 0 to ${VISITOR_CAP}, got ${count}`,
    );
  }
  const signed = new TextEncoder().encode(capMacInput(day, count));
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, signed));
  return formatCapCookie(day, count, base64url(mac));
}

/**
 * The count a cookie value holds for `today`, or 0 when the value is missing, does not read as a cap
 * cookie, names another day, or carries a MAC that `crypto.subtle.verify` refuses.
 */
export async function verifyCap(
  key: CryptoKey,
  value: string | undefined,
  today: string,
): Promise<number> {
  checkKey(key, "verifyCap");
  if (value !== undefined && typeof value !== "string") {
    throw new TypeError(
      `verifyCap: value must be a string or undefined, got ${describeType(value)}`,
    );
  }
  checkDay(today, "verifyCap", "today");
  const cookie = parseCapCookie(value);
  if (cookie === null || cookie.day !== today) return 0;
  const mac = decodeMac(cookie.mac);
  if (mac === null) return 0;
  const signed = new TextEncoder().encode(cookie.signed);
  return (await crypto.subtle.verify("HMAC", key, mac, signed)) ? cookie.count : 0;
}
