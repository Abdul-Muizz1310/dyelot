// The injected fetch of the server tests (docs/specs/04-ai.md, R4-58: unit tests inject fetch, and
// no test reaches the network). Shared by guard.test.ts, transport.test.ts and, from Task 4.7b, the
// handler's tests.

/** One call the fake fetch received: its URL and its init, `{}` when none was given. */
export type Call = { readonly url: string; readonly init: RequestInit };

/** A fetch that records each call, in order, and answers it with `answer`. */
export function recording(answer: (call: Call) => Promise<Response>): {
  readonly calls: Call[];
  readonly fetch: typeof globalThis.fetch;
} {
  const calls: Call[] = [];
  const fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(input), init: init ?? {} };
    calls.push(call);
    return answer(call);
  }) as typeof globalThis.fetch;
  return { calls, fetch };
}

/** A fetch answer that never settles and ignores the abort. */
export const never = (): Promise<Response> => new Promise<Response>(() => {});

/** A fetch answer that rejects as the platform's fetch does when its signal aborts, and not before. */
export const abortable = (call: Call): Promise<Response> =>
  new Promise<Response>((_, reject) => {
    call.init.signal?.addEventListener("abort", () =>
      reject(new DOMException("This operation was aborted", "AbortError")),
    );
  });

/** Whether `promise` has settled, without waiting for it. */
export async function settled(promise: Promise<unknown>): Promise<boolean> {
  let done = false;
  promise.then(
    () => {
      done = true;
    },
    () => {
      done = true;
    },
  );
  await Promise.resolve();
  await Promise.resolve();
  return done;
}
