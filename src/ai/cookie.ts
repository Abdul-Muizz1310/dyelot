import { assertInteger, assertString, describeType } from "./assert";

// The cap cookie's format (docs/specs/04-ai.md, R4-18 and section 11.2): `v1.<day>.<count>.<mac>`, the
// MAC an HMAC-SHA256 over `v1.<day>.<count>` in base64url without padding. Signing and verifying are
// the server shell's work (Web Crypto); this writes and reads the text.

export const CAP_COOKIE = "dyelot_ai";
/** Shared actions per visitor per UTC day. */
export const VISITOR_CAP = 3;

export type CapCookie = {
  readonly day: string;
  readonly count: number;
  readonly mac: string;
  /** The text the MAC signs: `v1.<day>.<count>`. */
  readonly signed: string;
};

const VALUE = /^v1\.(\d{4}-\d{2}-\d{2})\.([0-3])\.([A-Za-z0-9_-]{43})$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAC = /^[A-Za-z0-9_-]{43}$/;
/** One UTC day, the longest a counted action's cookie lives. */
const MAX_AGE_MAX = 86_400;

/** The cookie's fields, or null for a value that is missing or not of the pattern. */
export function parseCapCookie(value: string | undefined): CapCookie | null {
  if (value === undefined) return null;
  assertString(value, "parseCapCookie: value");
  const match = VALUE.exec(value);
  if (match === null) return null;
  const [, day, count, mac] = match;
  return { day, count: Number(count), mac, signed: `v1.${day}.${count}` };
}

function assertDay(day: unknown, caller: string): asserts day is string {
  assertString(day, `${caller}: day`);
  if (!DAY.test(day)) {
    throw new RangeError(`${caller}: day must be YYYY-MM-DD, got ${JSON.stringify(day)}`);
  }
}

/** The text the MAC signs: `v1.<day>.<count>`, the count from 0 to 3. */
export function capMacInput(day: string, count: number): string {
  assertDay(day, "capMacInput");
  assertInteger(count, 0, VISITOR_CAP, "capMacInput: count");
  return `v1.${day}.${count}`;
}

/** The cookie's value: `v1.<day>.<count>.<mac>`, the MAC 43 base64url characters. */
export function formatCapCookie(day: string, count: number, mac: string): string {
  assertDay(day, "formatCapCookie");
  assertInteger(count, 0, VISITOR_CAP, "formatCapCookie: count");
  assertString(mac, "formatCapCookie: mac");
  if (!MAC.test(mac)) {
    throw new RangeError(`formatCapCookie: mac must be 43 base64url characters, got ${mac.length}`);
  }
  return `v1.${day}.${count}.${mac}`;
}

/** The `Set-Cookie` line of a counted action; `maxAge` is the seconds to the next UTC midnight. */
export function capSetCookie(value: string, maxAge: number): string {
  if (typeof value !== "string") {
    throw new TypeError(`capSetCookie: value must be a string, got ${describeType(value)}`);
  }
  if (parseCapCookie(value) === null) {
    throw new RangeError("capSetCookie: value must be a cap cookie value");
  }
  assertInteger(maxAge, 1, MAX_AGE_MAX, "capSetCookie: maxAge");
  return `${CAP_COOKIE}=${value}; Path=/api/ai; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
}
