import type { StorageLike } from "@/features/studio/drafts";

// Test doubles for the browser providers of Task 4.9 (docs/specs/04-ai.md, section 14.9): storage
// that keeps its items in a map, storage that refuses every call, and OpenRouter's reply bodies.

/** A `StorageLike` that keeps its items in memory, as `sessionStorage` or `localStorage` does. */
export class MemoryStorage implements StorageLike {
  readonly items = new Map<string, string>();

  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.items.set(key, String(value));
  }

  removeItem(key: string): void {
    this.items.delete(key);
  }
}

/** A `StorageLike` whose every call throws, as a blocked or sandboxed storage does. */
export const THROWING_STORAGE: StorageLike = {
  getItem() {
    throw new DOMException("The operation is insecure.", "SecurityError");
  },
  setItem() {
    throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
  },
  removeItem() {
    throw new DOMException("The operation is insecure.", "SecurityError");
  },
};

/** An OpenRouter chat reply body whose message content is `content`. */
export const chatBody = (content: string): string =>
  JSON.stringify({ choices: [{ message: { content } }] });

/** A JSON reply with this status. */
export const jsonResponse = (status: number, body: unknown): Response =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** One call a fake `fetch` received. */
export type Call = { readonly url: string; readonly init: RequestInit };

/**
 * A fake `fetch` that records its calls and answers each with the next of `answers`: a Response, an
 * Error to reject with, or a function of the call. Past the list it rejects.
 */
export function fakeFetch(
  answers: readonly (Response | Error | ((call: Call) => Promise<Response>))[],
): { fetch: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const send = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = { url: String(input), init: init ?? {} };
    calls.push(call);
    const answer = answers[calls.length - 1];
    if (answer === undefined) throw new TypeError("fakeFetch: no answer left");
    if (answer instanceof Error) throw answer;
    return typeof answer === "function" ? answer(call) : answer;
  }) as typeof globalThis.fetch;
  return { fetch: send, calls };
}
