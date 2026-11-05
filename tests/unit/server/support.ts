import type { AiFeature, FeatureInput } from "@/ai";
import { createAiCache } from "@/server/ai/cache";
import type { TracingEnv } from "@/server/ai/env";
import { createCascadeGate } from "@/server/ai/guard";
import type { AiDeps } from "@/server/ai/handle";
import type { GenerationRecord, TraceName, Tracer } from "@/server/ai/trace";
import {
  BRIEF_IN,
  CRITIQUE_IN,
  NOW,
  RATIONALE_IN,
  REFINE_IN,
  readOutputs,
  TEST_ENV,
  VIBE_IN,
} from "../ai/fixtures";
import { oracleMac } from "./cap-oracle";
import type { Call } from "./fetch-fakes";

// The handler's test support (docs/specs/04-ai.md, section 14.7): a fetch that answers OpenRouter's
// `/key` and `/chat/completions` from a script, a reply held until the test lets it go, a fake
// tracer, the fake deps of `handleAi`, and the requests a browser would send. No test reaches the
// network (R4-58); every key and secret here is the made-up value of section 4.

export { oracleMac, SECRET_BYTES } from "./cap-oracle";
export { abortable, type Call, never, settled } from "./fetch-fakes";

export const SITE_ORIGIN = "https://dyelot.vercel.app";
export const BASE = "http://127.0.0.1:3199/api/v1";
/** R4-24's policy, the one every reply of both routes carries. */
export const API_POLICY = "default-src 'none'; frame-ancestors 'none';";

/** The five features' fixture inputs and the outputs a tier answers with (section 4). */
export const INPUTS: { readonly [F in AiFeature]: FeatureInput[F] } = {
  brief: BRIEF_IN,
  refine: REFINE_IN,
  vibe: VIBE_IN,
  rationale: RATIONALE_IN,
  critique: CRITIQUE_IN,
};
export const OUTPUTS = readOutputs();

/** One answer of the fake fetch to one call. */
export type Answer = (call: Call) => Promise<Response>;

/**
 * A fetch that records every call and answers `GET …/key` and `POST …/chat/completions` from their
 * own scripts, in order. A call with no answer left, or to another URL, is recorded in `unexpected`
 * and rejects, so a test can tell an extra call from a failed tier.
 */
export function recordingFetch(script: {
  readonly key?: readonly Answer[];
  readonly chat?: readonly Answer[];
}) {
  const calls: Call[] = [];
  const unexpected: string[] = [];
  let keys = 0;
  let chats = 0;
  const fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(input), init: init ?? {} };
    calls.push(call);
    let answer: Answer | undefined;
    if (call.url === `${BASE}/key`) answer = script.key?.[keys++];
    else if (call.url === `${BASE}/chat/completions`) answer = script.chat?.[chats++];
    if (answer === undefined) {
      unexpected.push(call.url);
      return Promise.reject(new Error(`recordingFetch: no answer for ${call.url}`));
    }
    return answer(call);
  }) as typeof globalThis.fetch;
  return {
    calls,
    fetch,
    unexpected,
    keyCalls: () => calls.filter((call) => call.url.endsWith("/key")),
    chatCalls: () => calls.filter((call) => call.url.endsWith("/chat/completions")),
  };
}
export type Recording = ReturnType<typeof recordingFetch>;

/** An answer with this JSON body and status. */
export const json =
  (body: unknown, status = 200): Answer =>
  () =>
    Promise.resolve(new Response(JSON.stringify(body), { status }));

/** `/key`'s answer with C-AI-20's shape and this `remaining`. */
export const keyAnswer = (remaining: unknown): Answer =>
  json({ data: { free_model_daily_requests: { used: 0, limit: 50, remaining } } });

/** A key body without the field the guard reads. */
export const keyWithoutRemaining: Answer = json({ data: { free_model_daily_requests: {} } });

/** An upstream error with a body the route must never pass on. */
export const UPSTREAM_TEXT = "upstream says: rate limited for sk-or-upstream-secret";
export const statusAnswer =
  (status: number): Answer =>
  () =>
    Promise.resolve(new Response(UPSTREAM_TEXT, { status }));

/** A fetch that rejects, as a refused connection does. */
export const throwing: Answer = () => Promise.reject(new TypeError("fetch failed"));

/** A chat completion whose content is `content`, with `usage` when given. */
export const chatAnswer = (content: string, usage?: unknown): Answer =>
  json({
    id: "gen-test",
    choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content } }],
    ...(usage === undefined ? {} : { usage }),
  });

/** A tier that answers the feature's fixture output. */
export const outputAnswer = (feature: AiFeature, usage?: unknown): Answer =>
  chatAnswer(JSON.stringify(OUTPUTS[feature]), usage);

/**
 * An answer that waits: `called` resolves with the call once fetch was called, and the answer then
 * settles with the response given to `release`, or rejects as the platform's fetch does when the
 * call's signal aborts first.
 */
export function held(): {
  readonly answer: Answer;
  readonly called: Promise<Call>;
  release(response: Response): void;
} {
  let onCall!: (call: Call) => void;
  const called = new Promise<Call>((resolve) => {
    onCall = resolve;
  });
  let onRelease!: (response: Response) => void;
  const released = new Promise<Response>((resolve) => {
    onRelease = resolve;
  });
  const answer: Answer = (call) => {
    onCall(call);
    return new Promise<Response>((resolve, reject) => {
      call.init.signal?.addEventListener("abort", () =>
        reject(new DOMException("This operation was aborted", "AbortError")),
      );
      released.then(resolve);
    });
  };
  return { answer, called, release: onRelease };
}

/** An answer that calls `answer` and tells the test it was called. */
export function watched(answer: Answer): {
  readonly answer: Answer;
  readonly called: Promise<Call>;
} {
  let onCall!: (call: Call) => void;
  const called = new Promise<Call>((resolve) => {
    onCall = resolve;
  });
  return {
    answer: (call) => {
      onCall(call);
      return answer(call);
    },
    called,
  };
}

/** What a fake tracer saw of one action. */
export type TracedAction = {
  readonly name: TraceName;
  readonly attributes: { feature: AiFeature; environment: string; input: unknown };
  readonly generations: GenerationRecord[];
  readonly ends: { outcome: "ok" | "all-tiers-failed"; tier?: string }[];
};

/** A tracer that records everything it is given, and throws at `throwAt` when asked to. */
export function fakeTracer(throwAt?: "action" | "generation" | "end" | "flush") {
  const actions: TracedAction[] = [];
  const counts = { flushes: 0 };
  const tracer: Tracer = {
    action(name, attributes) {
      if (throwAt === "action") throw new Error("the tracer failed in action");
      const traced: TracedAction = { name, attributes, generations: [], ends: [] };
      actions.push(traced);
      return {
        generation(record) {
          if (throwAt === "generation") throw new Error("the tracer failed in generation");
          traced.generations.push(record);
        },
        end(output) {
          if (throwAt === "end") throw new Error("the tracer failed in end");
          traced.ends.push(output);
        },
      };
    },
    flush() {
      counts.flushes += 1;
      if (throwAt === "flush") return Promise.reject(new Error("the tracer failed in flush"));
      return Promise.resolve();
    },
  };
  return { tracer, actions, counts };
}

/** The Langfuse trio and `APP_ENV` beside TEST_ENV: tracing on, with made-up values. */
export const TRACING_ENV: Readonly<Record<string, string>> = Object.freeze({
  ...TEST_ENV,
  LANGFUSE_PUBLIC_KEY: "pk-lf-test-public",
  LANGFUSE_SECRET_KEY: "sk-lf-test-secret-0123456789",
  LANGFUSE_BASE_URL: "https://us.cloud.langfuse.com",
  APP_ENV: "test",
});

/** The fake deps of `handleAi`, with what they recorded: the log lines and the `after` tasks. */
export function makeDeps(overrides: Partial<AiDeps> = {}) {
  const lines: string[] = [];
  const afters: Promise<unknown>[] = [];
  const tracings: TracingEnv[] = [];
  const deps: AiDeps = {
    env: TEST_ENV,
    fetch: recordingFetch({}).fetch,
    now: () => NOW,
    cache: createAiCache({ now: () => NOW }),
    gate: createCascadeGate(),
    tracerFor: (tracing) => {
      tracings.push(tracing);
      throw new Error("tracerFor: no tracer in this test");
    },
    after: (task) => {
      afters.push(task);
    },
    log: (line) => {
      lines.push(line);
    },
    siteOrigin: SITE_ORIGIN,
    ...overrides,
  };
  return { deps, lines, afters, tracings };
}

/** The request a browser on dyelot's origin sends, unless the options say otherwise. */
export function post(
  feature: string,
  body: unknown,
  options: {
    readonly url?: string;
    readonly origin?: string | null;
    readonly host?: string;
    readonly cookie?: string;
    readonly headers?: Readonly<Record<string, string>>;
    readonly signal?: AbortSignal;
  } = {},
): Request {
  const url = options.url ?? `${SITE_ORIGIN}/api/ai/${feature}`;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    host: options.host ?? new URL(url).host,
    ...options.headers,
  };
  const origin = options.origin === undefined ? SITE_ORIGIN : options.origin;
  if (origin !== null) headers.origin = origin;
  if (options.cookie !== undefined) headers.cookie = options.cookie;
  const text = typeof body === "string" ? body : JSON.stringify(body);
  const init: RequestInit & { duplex?: "half" } = { method: "POST", headers, body: text };
  if (options.signal !== undefined) init.signal = options.signal;
  return new Request(url, init);
}

/** A request whose body streams `size` bytes of spaces with no `Content-Length`. */
export function streamed(feature: string, size: number): Request {
  let sent = 0;
  const chunk = new Uint8Array(4096).fill(0x20);
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= size) {
        controller.close();
        return;
      }
      const piece = chunk.subarray(0, Math.min(chunk.length, size - sent));
      sent += piece.length;
      controller.enqueue(piece);
    },
  });
  const init: RequestInit & { duplex: "half" } = {
    method: "POST",
    headers: { origin: SITE_ORIGIN, host: new URL(SITE_ORIGIN).host },
    body: stream,
    duplex: "half",
  };
  return new Request(`${SITE_ORIGIN}/api/ai/${feature}`, init);
}

/** `value` as JSON padded with spaces to exactly `bytes` bytes of UTF-8. */
export function padded(value: unknown, bytes: number): string {
  const text = JSON.stringify(value);
  const size = new TextEncoder().encode(text).length;
  if (size > bytes) throw new RangeError(`padded: the JSON already takes ${size} bytes`);
  return text + " ".repeat(bytes - size);
}

/** A reply read once: its status, headers, text and JSON. */
export async function read(response: Response) {
  const text = await response.text();
  return {
    status: response.status,
    headers: response.headers,
    text,
    json: JSON.parse(text) as Record<string, unknown>,
    setCookie: response.headers.get("set-cookie"),
  };
}
export type Reply = Awaited<ReturnType<typeof read>>;

/** The `name=value` pair a `Set-Cookie` line sets, which the browser sends back. */
export function cookieOf(setCookie: string | null): string {
  if (setCookie === null) throw new Error("cookieOf: the reply set no cookie");
  return setCookie.split(";")[0] as string;
}

/** A cap cookie value signed by the oracle. */
export const capValue = (day: string, count: number): string =>
  `v1.${day}.${count}.${oracleMac(day, count)}`;

/** The `Set-Cookie` line of a counted action at NOW (R4-18). */
export const setCookieLine = (value: string, maxAge = 43200): string =>
  `dyelot_ai=${value}; Path=/api/ai; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
