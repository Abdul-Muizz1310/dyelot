import { after } from "next/server";
import { createAiCache } from "./cache";
import type { TracingEnv } from "./env";
import { createCascadeGate } from "./guard";
import type { AiDeps } from "./handle";
import { createLangfuseTracer } from "./langfuse";
import type { Tracer } from "./trace";

// The routes' real deps (docs/specs/04-ai.md, section 5.4): process.env, the platform's fetch, the
// clock, one cache and one cascade gate per server instance (module level, so every request of the
// instance shares them, R4-17 (b) and R4-19), next/server's `after`, console.error, and the Langfuse
// tracer of langfuse.ts. The routes are covered by the flows, not by a unit floor (section 15).

const cache = createAiCache({ now: () => Date.now() });
const gate = createCascadeGate();

/** The instance's Langfuse tracer, made once for the settings it was made with. */
let langfuse: { readonly tracing: TracingEnv; readonly tracer: Tracer } | null = null;

function sameTracing(a: TracingEnv, b: TracingEnv): boolean {
  return (
    a.publicKey === b.publicKey &&
    a.secretKey === b.secretKey &&
    a.baseUrl === b.baseUrl &&
    a.environment === b.environment
  );
}

function tracerFor(tracing: TracingEnv): Tracer {
  if (langfuse === null || !sameTracing(langfuse.tracing, tracing)) {
    langfuse = { tracing, tracer: createLangfuseTracer(tracing) };
  }
  return langfuse.tracer;
}

/** One log for the instance, so handleAi's once-per-instance lines go out once. */
function log(line: string): void {
  console.error(line);
}

/** The deps of `handleAi` and `handleModels` on the server, for the site's origin. */
export function serverDeps(siteOrigin: string): AiDeps {
  return {
    env: process.env,
    fetch: globalThis.fetch.bind(globalThis),
    now: () => Date.now(),
    cache,
    gate,
    tracerFor,
    after: (task) => after(task),
    log,
    siteOrigin,
  };
}
