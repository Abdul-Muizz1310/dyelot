import type { AiFeature, AiPath, FeatureInput, FeatureOutput, ProviderFailure } from "@/ai";
import { type AiModule, assertFunction, assertSignal, checkAsk } from "@/features/ai/load";
import { assertRecord } from "@/features/studio/guards";

// The shared-route client (docs/specs/04-ai.md, R4-35 and section 11.1): it posts the input as JSON
// to dyelot's own `/api/ai/<feature>`, reads the reply with `readRouteReply`, checks a 200's result
// again with `parseOutput`, and hands back the visitor's remaining shared actions as the reply gave
// them. It never sees the visitor's key (R4-29): that key only ever goes to OpenRouter.

type SharedPath = Extract<AiPath, { provider: "shared" }>;
type SharedFailure = Extract<ProviderFailure, { provider: "shared" }>;

export type SharedResult<F extends AiFeature> =
  | {
      readonly ok: true;
      readonly output: FeatureOutput[F];
      readonly path: SharedPath;
      readonly remaining: number;
    }
  | { readonly ok: false; readonly failure: SharedFailure; readonly remaining: number | null };

const UNREACHABLE = Object.freeze({
  ok: false,
  failure: Object.freeze({ provider: "shared", reason: "unreachable" }),
  remaining: null,
} as const);
/** An HTTP status; anything else (an opaque 0 among them) is no reply at all. */
const MIN_STATUS = 100;
const MAX_STATUS = 599;

/** The reply's status and its body read as JSON (undefined when it is not JSON), or null when no reply came. */
async function post(
  feature: AiFeature,
  input: unknown,
  deps: { fetch: typeof fetch; signal: AbortSignal },
): Promise<{ status: number; json: unknown } | null> {
  try {
    const response = await deps.fetch(`/api/ai/${feature}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      credentials: "same-origin",
      signal: deps.signal,
    });
    const { status } = response;
    if (!Number.isInteger(status) || status < MIN_STATUS || status > MAX_STATUS) return null;
    const text = await response.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    return { status, json };
  } catch {
    return null;
  }
}

/**
 * One action on dyelot's shared quota (R4-35). Every reply of 11.1 maps to its code; a 200 whose
 * result fails `parseOutput` is `invalid`; a fetch that rejects (a network error or a cancel) and a
 * reply of any other shape are `unreachable`. `remaining` is the reply's, or null when it carried none.
 */
export async function askShared<F extends AiFeature>(
  ai: AiModule,
  feature: F,
  input: FeatureInput[F],
  deps: { fetch: typeof fetch; signal: AbortSignal },
): Promise<SharedResult<F>> {
  checkAsk(ai, feature, input, "askShared");
  assertRecord(deps, "askShared: deps");
  assertFunction(deps.fetch, "askShared: deps.fetch");
  assertSignal(deps.signal, "askShared: deps.signal");
  const answer = await post(feature, input, deps);
  if (answer === null) return UNREACHABLE;
  const reply = ai.readRouteReply(feature, answer.status, answer.json);
  if (!reply.ok) {
    return {
      ok: false,
      failure: { provider: "shared", reason: reply.code },
      remaining: reply.remaining,
    };
  }
  const parsed = ai.parseOutput(feature, input, reply.result);
  if (!parsed.ok) {
    return {
      ok: false,
      failure: { provider: "shared", reason: "invalid" },
      remaining: reply.remaining,
    };
  }
  return { ok: true, output: parsed.output, path: reply.path, remaining: reply.remaining };
}
