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
export type CascadeGate = { enter(): CascadeRelease | null };

/**
 * The cascade gate of R4-17 (b), one per server instance: `enter()` gives a release when no cascade
 * holds the gate, and then holds it, or null while one does. Only the holder has a release, and it
 * works once: a second call, or a call after another request entered, changes nothing, and a request
 * answered `busy` holds nothing it could release. The holder calls it in a `finally`.
 */
export function createCascadeGate(): CascadeGate {
  let held = false;
  return Object.freeze({
    enter(): CascadeRelease | null {
      if (held) return null;
      held = true;
      let open = true;
      return () => {
        if (!open) return;
        open = false;
        held = false;
      };
    },
  });
}
