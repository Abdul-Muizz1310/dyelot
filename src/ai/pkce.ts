import { assertRecord, assertString, describeType } from "./assert";
import { OPENROUTER_ORIGIN } from "./chat";

// The pure half of the visitor key's PKCE sign-in (docs/specs/04-ai.md, R4-33 and section 10.4):
// base64url, the authorize URL and the callback's query. The random bytes, the SHA-256 digest and
// the storage are the browser shell's work (src/features/ai/connect.ts); the server signs its cap
// cookie's MAC with the same base64url.

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
/** The S256 challenge: base64url of a SHA-256 digest, 43 characters. */
const CHALLENGE = /^[A-Za-z0-9_-]{43}$/;
/** The state: base64url of 16 random bytes, 22 characters. */
const STATE = /^[A-Za-z0-9_-]{22}$/;
const CALLBACK_PATH = "/connect/callback";
/** The hosts OpenRouter accepts a plain-http callback from (section 10.4). */
const LOCAL_HOSTS: readonly string[] = ["localhost", "127.0.0.1"];
/** A callback's code or state longer than this is not read (section 10.4). */
const PARAM_MAX = 512;

/** RFC 4648 section 5 (base64url) with no padding. */
export function base64url(bytes: Uint8Array): string {
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError(`base64url: bytes must be a Uint8Array, got ${describeType(bytes)}`);
  }
  let out = "";
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n =
      ((bytes[i] as number) << 16) | ((bytes[i + 1] as number) << 8) | (bytes[i + 2] as number);
    out +=
      ALPHABET[n >> 18] + ALPHABET[(n >> 12) & 63] + ALPHABET[(n >> 6) & 63] + ALPHABET[n & 63];
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = (bytes[i] as number) << 16;
    out += ALPHABET[n >> 18] + ALPHABET[(n >> 12) & 63];
  } else if (rest === 2) {
    const n = ((bytes[i] as number) << 16) | ((bytes[i + 1] as number) << 8);
    out += ALPHABET[n >> 18] + ALPHABET[(n >> 12) & 63] + ALPHABET[(n >> 6) & 63];
  }
  return out;
}

/** The callback, parsed, or null when it is not a URL at all. */
function parseUrl(text: string): URL | null {
  try {
    return new URL(text);
  } catch {
    return null;
  }
}

/**
 * Whether `callbackUrl` is one OpenRouter may send the code to: https, or http on localhost or
 * 127.0.0.1, with the path /connect/callback, no query, hash or credentials, and written as the
 * browser writes it (so the redirect lands on the very URL the visitor started from).
 */
function isCallback(callbackUrl: string): boolean {
  if (callbackUrl.includes("?") || callbackUrl.includes("#")) return false;
  const url = parseUrl(callbackUrl);
  if (url === null || url.href !== callbackUrl) return false;
  const secure =
    url.protocol === "https:" || (url.protocol === "http:" && LOCAL_HOSTS.includes(url.hostname));
  return secure && url.pathname === CALLBACK_PATH && url.username === "" && url.password === "";
}

/**
 * OpenRouter's authorize URL (section 10.4), exactly:
 * `https://openrouter.ai/auth?callback_url=<encoded>&code_challenge=<challenge>&code_challenge_method=S256&state=<state>&key_label=dyelot`.
 */
export function authorizeUrl(args: {
  callbackUrl: string;
  challenge: string;
  state: string;
}): string {
  assertRecord(args, "authorizeUrl: args");
  const { callbackUrl, challenge, state } = args;
  assertString(callbackUrl, "authorizeUrl: args.callbackUrl");
  assertString(challenge, "authorizeUrl: args.challenge");
  assertString(state, "authorizeUrl: args.state");
  if (!isCallback(callbackUrl)) {
    throw new RangeError(
      `authorizeUrl: args.callbackUrl must be an https URL, or http on localhost or 127.0.0.1, whose path is ${CALLBACK_PATH} with no query or hash, got ${JSON.stringify(callbackUrl)}`,
    );
  }
  if (!CHALLENGE.test(challenge)) {
    throw new RangeError(
      `authorizeUrl: args.challenge must be 43 base64url characters, got ${challenge.length} characters`,
    );
  }
  if (!STATE.test(state)) {
    throw new RangeError(
      `authorizeUrl: args.state must be 22 base64url characters, got ${state.length} characters`,
    );
  }
  return (
    `${OPENROUTER_ORIGIN}/auth?callback_url=${encodeURIComponent(callbackUrl)}` +
    `&code_challenge=${challenge}&code_challenge_method=S256&state=${state}&key_label=dyelot`
  );
}

/** One parameter of the callback's query: null when absent, empty or over 512 characters. */
function param(params: URLSearchParams, name: string): string | null {
  const value = params.get(name);
  return value === null || value.length === 0 || value.length > PARAM_MAX ? null : value;
}

/** The code and the state of the callback's query (`location.search`), each null when unusable. */
export function readCallback(search: string): {
  readonly code: string | null;
  readonly state: string | null;
} {
  assertString(search, "readCallback: search");
  const params = new URLSearchParams(search);
  return { code: param(params, "code"), state: param(params, "state") };
}
