import { readKeyRemaining } from "@/ai";
import { SERVER_KEY } from "./env";
import { checkCallArgs, fetchCapped } from "./transport";

// The shared pool's guard and the cascade gate (docs/specs/04-ai.md, R4-16, R4-17 and section 11.3).
// readGuard reads OpenRouter's `GET /key` and fails closed: any failure is null, which guardVerdict
// (@/ai) turns into `guard-unavailable`. The gate lets one cascade run per server instance.

/** A base URL as readAiEnv gives it: an origin and a path, with no query, hash or trailing slash. */
const BASE_URL = /^https?:\/\/[^\s/?#]+(?:\/[^\s?#]*)?$/;

/**
 * The free pool's remaining requests from `GET {baseUrl}/key` with the server key, read under
 * `timeoutMs` (5,000 ms for the first read, 2,000 ms for a re-read): `readKeyRemaining` of the JSON
 * body, or null for a timeout, a network error, a status outside 200 to 299 or a body that is not
 * JSON. It rejects only for an argument of the wrong type or outside its domain, before any fetch,
 * and no message holds the key.
 */
export async function readGuard(args: {
  fetch: typeof fetch;
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
}): Promise<number | null> {
  checkCallArgs(args, "readGuard");
  const { baseUrl, apiKey } = args;
  if (typeof baseUrl !== "string") {
    throw new TypeError(`readGuard: args.baseUrl must be a string, got ${typeof baseUrl}`);
  }
  if (!BASE_URL.test(baseUrl) || baseUrl.endsWith("/")) {
    throw new RangeError(
      "readGuard: args.baseUrl must be an http or https URL with no query, hash or trailing slash",
    );
  }
  if (typeof apiKey !== "string") {
    throw new TypeError(`readGuard: args.apiKey must be a string, got ${typeof apiKey}`);
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
  );
  if ("kind" in response || response.status < 200 || response.status > 299) return null;
  try {
    return readKeyRemaining(JSON.parse(response.text));
  } catch {
    return null;
  }
}

export type CascadeGate = { tryEnter(): boolean; leave(): void };

/**
 * The cascade gate of R4-17 (b), one per server instance: `tryEnter()` is true when no cascade holds
 * it, and then holds it; `leave()` lets it go. Only a request whose `tryEnter()` returned true calls
 * `leave()`, in a `finally`; `leave()` on a gate not held changes nothing.
 */
export function createCascadeGate(): CascadeGate {
  let held = false;
  return Object.freeze({
    tryEnter(): boolean {
      if (held) return false;
      held = true;
      return true;
    },
    leave(): void {
      held = false;
    },
  });
}
