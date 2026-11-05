import type { ChatRequest, ChatResponse } from "@/ai";

// The server's transport (docs/specs/04-ai.md, R4-08, R4-11, R4-12 and section 5.4): it sends the
// request @/ai built with the injected fetch and hands back what readReply reads. It never throws for
// an upstream answer: a timeout, a rejected fetch, a body that fails mid-read or a status readReply
// would refuse (outside 100 to 599) each become a failed tier here.

/** The most bytes of a body either transport reads (R4-11). */
export const REPLY_MAX_BYTES = 262_144;
/** setTimeout's longest delay; a longer one fires at once. */
const TIMEOUT_MAX_MS = 2_147_483_647;
const MIN_STATUS = 100;
const MAX_STATUS = 599;
const URL_PATTERN = /^https?:\/\/\S+$/;

const TIMEOUT: ChatResponse = Object.freeze({ kind: "timeout" });
const NETWORK: ChatResponse = Object.freeze({ kind: "network" });

export type CallArgs = { readonly fetch: typeof fetch; readonly timeoutMs: number };

function describeType(value: unknown): string {
  if (value === null) return "null";
  return Array.isArray(value) ? "array" : typeof value;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The fetch and the timeout every network call takes: a TypeError or a RangeError naming `caller`. */
export function checkCallArgs(args: unknown, caller: string): asserts args is CallArgs {
  if (!isRecord(args)) {
    throw new TypeError(`${caller}: args must be an object, got ${describeType(args)}`);
  }
  if (typeof args.fetch !== "function") {
    throw new TypeError(
      `${caller}: args.fetch must be a function, got ${describeType(args.fetch)}`,
    );
  }
  const { timeoutMs } = args;
  if (typeof timeoutMs !== "number") {
    throw new TypeError(
      `${caller}: args.timeoutMs must be a number, got ${describeType(timeoutMs)}`,
    );
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > TIMEOUT_MAX_MS) {
    throw new RangeError(
      `${caller}: args.timeoutMs must be an integer from 1 to ${TIMEOUT_MAX_MS}, got ${timeoutMs}`,
    );
  }
}

/** A request @/ai built; a header's value is never named, so the key cannot reach a message. */
function checkRequest(request: unknown): asserts request is ChatRequest {
  if (!isRecord(request)) {
    throw new TypeError(`sendChat: request must be an object, got ${describeType(request)}`);
  }
  const { url, headers, body } = request;
  if (typeof url !== "string") {
    throw new TypeError(`sendChat: request.url must be a string, got ${describeType(url)}`);
  }
  if (!URL_PATTERN.test(url)) {
    throw new RangeError("sendChat: request.url must be an http or https URL with no white space");
  }
  if (!isRecord(headers)) {
    throw new TypeError(
      `sendChat: request.headers must be an object, got ${describeType(headers)}`,
    );
  }
  for (const [name, value] of Object.entries(headers)) {
    if (typeof value !== "string") {
      throw new TypeError(
        `sendChat: request.headers[${JSON.stringify(name)}] must be a string, got ${describeType(value)}`,
      );
    }
  }
  if (typeof body !== "string") {
    throw new TypeError(`sendChat: request.body must be a string, got ${describeType(body)}`);
  }
}

/**
 * At most `REPLY_MAX_BYTES` of the body, decoded as UTF-8. A body past the cap is not read further
 * and gives "", which readReply reads as `empty`, as it reads a body over the cap (R4-11). An abort
 * cancels the read, so a body that never ends cannot hold the reader.
 */
async function readCapped(response: Response, signal: AbortSignal): Promise<string> {
  const { body } = response;
  if (!body) return "";
  const reader = body.getReader();
  const stop = () => {
    reader.cancel().catch(() => {});
  };
  signal.addEventListener("abort", stop, { once: true });
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > REPLY_MAX_BYTES) {
        stop();
        return "";
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder().decode(bytes);
  } finally {
    signal.removeEventListener("abort", stop);
  }
}

/**
 * One call under a deadline: the status and the capped body text, `{ kind: "timeout" }` when
 * `timeoutMs` runs out first (the call's signal aborts then, and the answer does not wait for a
 * fetch that ignores it), or `{ kind: "network" }` for a fetch that throws or rejects, a body that
 * fails mid-read, or a status outside 100 to 599. The timer is cleared once the call settles.
 */
export async function fetchCapped(
  send: typeof fetch,
  url: string,
  init: Omit<RequestInit, "signal">,
  timeoutMs: number,
): Promise<ChatResponse> {
  const controller = new AbortController();
  const { signal } = controller;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<ChatResponse>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(TIMEOUT);
    }, timeoutMs);
  });
  const call = async (): Promise<ChatResponse> => {
    try {
      const response = await send(url, { ...init, signal });
      const { status } = response;
      if (!Number.isInteger(status) || status < MIN_STATUS || status > MAX_STATUS) return NETWORK;
      const text = await readCapped(response, signal);
      return signal.aborted ? TIMEOUT : Object.freeze({ status, text });
    } catch {
      return signal.aborted ? TIMEOUT : NETWORK;
    }
  };
  try {
    return await Promise.race([call(), deadline]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Sends a request `buildChatRequest` made: `POST` with its URL, headers and body, aborted at
 * `timeoutMs` (a tier's 20,000 ms, R4-12). The answer goes to readReply as it is.
 */
export async function sendChat(
  request: ChatRequest,
  args: { fetch: typeof fetch; timeoutMs: number },
): Promise<ChatResponse> {
  checkRequest(request);
  checkCallArgs(args, "sendChat");
  return fetchCapped(
    args.fetch,
    request.url,
    { method: "POST", headers: { ...request.headers }, body: request.body, cache: "no-store" },
    args.timeoutMs,
  );
}
