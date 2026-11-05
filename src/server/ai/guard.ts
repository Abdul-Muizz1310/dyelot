import { readKeyRemaining } from "@/ai";
import { SERVER_KEY } from "./env";
import { checkCallArgs, describeType, fetchCapped } from "./transport";

// The shared pool's guard and the cascade gate (docs/specs/04-ai.md, R4-16, R4-17 and section 11.3).
// readGuard reads OpenRouter's `GET /key` and fails closed: any failure is null, which guardVerdict
// (@/ai) turns into `guard-unavailable`. The gate lets one cascade run per server instance, and only
// the request that entered it can let it go, once.

/** A base URL as readAiEnv gives it: an origin and a path, with no query, hash or trailing slash. */
const BASE_URL = /^https?:\/\/[^\s/?#]+(?:\/[^\s?#]*)?$/;

/**
 * The free pool's remaining requests from `GET {baseUrl}/key` with the server key and
 * `redirect: "error"`, read under `timeoutMs` (5,000 ms for the first read, 2,000 ms for a re-read):
 * `readKeyRemaining` of the JSON body, or null for a timeout, a network error or redirect, a status
 * outside 200 to 299, a body that is not JSON, or the visitor's `signal` (R4-16), which sends
 * nothing when it has already aborted. It rejects only for an argument of the wrong type or outside
 * its domain, before any fetch, and no message holds the key.
 */
export async function readGuard(args: {
  fetch: typeof fetch;
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  signal?: AbortSignal;
}): Promise<number | null> {
  checkCallArgs(args, "readGuard");
  const { baseUrl, apiKey } = args;
  if (typeof baseUrl !== "string") {
    throw new TypeError(`readGuard: args.baseUrl must be a string, got ${describeType(baseUrl)}`);
  }
  if (!BASE_URL.test(baseUrl) || baseUrl.endsWith("/")) {
    throw new RangeError(
      "readGuard: args.baseUrl must be an http or https URL with no query, hash or trailing slash",
    );
  }
  if (typeof apiKey !== "string") {
    throw new TypeError(`readGuard: args.apiKey must be a string, got ${describeType(apiKey)}`);
  }
  if (!SERVER_KEY.test(apiKey)) {
    throw new RangeError(
      "readGuard: args.apiKey must be 20 to 200 printable ASCII characters with no space",
    );
  }
  const response = await fetchCapped(
    args.fetch,
    `${baseUrl}/key`,
    { method: "GET", headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" },
    args.timeoutMs,
    args.signal,
  );
  if ("kind" in response || response.status < 200 || response.status > 299) return null;
  try {
    return readKeyRemaining(JSON.parse(response.text));
  } catch {
    return null;
  }
}

/** Lets the gate go; once only, so a second call frees nothing. */
export type CascadeRelease = () => void;
/** `now`: the request's time in ms, the handler's one reading of its injected clock (R4-16). */
export type CascadeGate = { enter(now: number): CascadeRelease | null };

/**
 * A hold this old is stale: `maxDuration` (70 s) and 5 s more. An invocation the platform ended
 * without running its `finally` can then hold the gate no longer than this (R4-17 (b)).
 */
export const GATE_STALE_MS = 75_000;

/**
 * The cascade gate of R4-17 (b), one per server instance: `enter(now)` gives a release when no
 * cascade holds the gate, or when the hold was entered `GATE_STALE_MS` or more before `now`, and
 * then holds it from `now`; it gives null while a younger hold stands (a clock stepped back included).
 * Only the holder has a release, and it is tied to its own hold and works once: a second call, a call
 * after another request entered, or a stale holder's call after a takeover changes nothing, and a
 * request answered `busy` holds nothing it could release. The holder calls it in a `finally`.
 */
export function createCascadeGate(): CascadeGate {
  let hold: { readonly since: number } | null = null;
  return Object.freeze({
    enter(now: number): CascadeRelease | null {
      if (typeof now !== "number") {
        throw new TypeError(`CascadeGate.enter: now must be a number, got ${describeType(now)}`);
      }
      if (!Number.isFinite(now) || now < 0) {
        throw new RangeError(`CascadeGate.enter: now must be a time in ms, got ${now}`);
      }
      if (hold !== null && now - hold.since < GATE_STALE_MS) return null;
      const mine = { since: now };
      hold = mine;
      return () => {
        if (hold === mine) hold = null;
      };
    },
  });
}
