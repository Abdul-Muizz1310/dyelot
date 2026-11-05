import {
  AI_FEATURES,
  type AiFeature,
  buildChatRequest,
  CAP_COOKIE,
  cacheKey,
  capSetCookie,
  cascadePlan,
  type FailureKind,
  type FeatureInput,
  guardVerdict,
  inputSchema,
  PROMPTS,
  readReply,
  type Tier,
  type TierName,
  type TierOutcome,
  VISITOR_CAP,
} from "@/ai";
import type { AiCache, CachedResult } from "./cache";
import { deriveCapKey, signCap, verifyCap } from "./cap";
import { secondsToUtcMidnight, utcDay } from "./clock";
import { type AiEnv, type EnvSource, readAiEnv, readSlugs, type TracingEnv } from "./env";
import { type CascadeGate, readGuard } from "./guard";
import {
  type ActionTrace,
  NO_TRACER,
  TRACE_NAMES,
  type Tracer,
  traceInput,
  traceMessages,
} from "./trace";
import { describeType, sendChat } from "./transport";

// The shared-quota route (docs/specs/04-ai.md, R4-15 to R4-18, R4-21, R4-23, R4-24, R4-52 and
// section 11). Each POST runs R4-16's checks in order: the feature, the origin, the environment, the
// body, the cap cookie, the cache, the cascade gate, the guard, then at most three tiers. It fails
// closed: a guard it cannot read refuses. Only the request that entered the gate leaves it, once, on
// every path. Only a success is cached. No reply, log line or trace holds the key, the cookie secret
// or a cookie, and a failure's upstream text never leaves this file. Everything that can change is
// injected, so the tests run it with a fake fetch, clock, cache, gate and tracer.

export type AiDeps = {
  readonly env: EnvSource;
  readonly fetch: typeof fetch;
  readonly now: () => number;
  readonly cache: AiCache;
  readonly gate: CascadeGate;
  readonly tracerFor: (tracing: TracingEnv) => Tracer;
  readonly after: (task: Promise<unknown>) => void;
  readonly log: (line: string) => void;
  readonly siteOrigin: string;
};

/** The first `/key` read's timeout and a re-read's (R4-16, R4-17). */
const GUARD_TIMEOUT_MS = 5000;
const REREAD_TIMEOUT_MS = 2000;
/** Each tier's own timeout (R4-12). */
const TIER_TIMEOUT_MS = 20_000;
/** The body caps of R4-15. */
const BODY_MAX_BYTES = 32_768;
const VIBE_BODY_MAX_BYTES = 1_572_864;
/** A first read below `reserve + 6` re-reads `/key` before tiers 2 and 3 (R4-17 (c)). */
const REREAD_MARGIN = 6;
/** R4-24's policy: an API reply runs nothing and is framed nowhere. */
const API_POLICY = "default-src 'none'; frame-ancestors 'none';";
const ORIGIN = /^https?:\/\/[^\s/?#]+$/;
const TOO_LARGE = Symbol("too-large");

type Failure = {
  readonly tier: TierName;
  readonly slug: string;
  readonly kind: FailureKind;
  readonly status?: number;
};

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The lines each log has written, so a line goes out once per server instance (R4-20, R4-52). */
const LOGGED = new WeakMap<object, Set<string>>();

function logOnce(log: (line: string) => void, line: string): void {
  let lines = LOGGED.get(log);
  if (lines === undefined) {
    lines = new Set();
    LOGGED.set(log, lines);
  }
  if (lines.has(line)) return;
  lines.add(line);
  log(line);
}

const badVariable = (variable: string) => `dyelot ai: ${variable} is missing or invalid.`;
const tracingFailed = (step: "action" | "generation" | "end" | "flush") =>
  `dyelot ai: tracing failed (${step}).`;

/** A reply of 11.1 with R4-24's headers, and the cap cookie when the action counted. */
function reply(status: number, body: Readonly<Record<string, unknown>>, setCookie?: string) {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Content-Security-Policy": API_POLICY,
  });
  if (setCookie !== undefined) headers.set("Set-Cookie", setCookie);
  return new Response(JSON.stringify(body), { status, headers });
}

const notConfigured = () => reply(503, { ok: false, code: "not-configured" });

/** 11.1's 200 body, its keys in the table's order. */
function success(feature: AiFeature, value: CachedResult, remaining: number) {
  const { result, slug, tier, attempts } = value;
  return {
    ok: true,
    feature,
    result,
    path: { provider: "shared", slug, tier, attempts },
    remaining,
  };
}

function checkFunction(value: unknown, name: string, caller: string): void {
  if (typeof value !== "function") {
    throw new TypeError(`${caller}: deps.${name} must be a function, got ${describeType(value)}`);
  }
}

/** The handler's wiring: a wrong one is a bug of the shell, never a visitor's input (R-05). */
function checkDeps(deps: unknown): asserts deps is AiDeps {
  if (!isRecord(deps)) {
    throw new TypeError(`handleAi: deps must be an object, got ${describeType(deps)}`);
  }
  if (!isRecord(deps.env)) {
    throw new TypeError(`handleAi: deps.env must be an object, got ${describeType(deps.env)}`);
  }
  checkFunction(deps.fetch, "fetch", "handleAi");
  checkFunction(deps.now, "now", "handleAi");
  const { cache, gate, siteOrigin } = deps;
  if (
    !isRecord(cache) ||
    typeof cache.get !== "function" ||
    typeof cache.set !== "function" ||
    typeof cache.size !== "function"
  ) {
    throw new TypeError(
      `handleAi: deps.cache must be an AiCache with get, set and size, got ${describeType(cache)}`,
    );
  }
  if (!isRecord(gate) || typeof gate.enter !== "function") {
    throw new TypeError(
      `handleAi: deps.gate must be a CascadeGate with enter, got ${describeType(gate)}`,
    );
  }
  for (const name of ["tracerFor", "after", "log"] as const) {
    checkFunction(deps[name], name, "handleAi");
  }
  if (typeof siteOrigin !== "string") {
    throw new TypeError(
      `handleAi: deps.siteOrigin must be a string, got ${describeType(siteOrigin)}`,
    );
  }
  if (!ORIGIN.test(siteOrigin)) {
    throw new RangeError(
      `handleAi: deps.siteOrigin must be an http or https origin, got ${JSON.stringify(siteOrigin)}`,
    );
  }
}

/** The one reading of the clock (R4-16): the day, the count and Max-Age all use it. */
function readNow(deps: AiDeps): number {
  const now: unknown = deps.now();
  if (typeof now !== "number") {
    throw new TypeError(`handleAi: deps.now() must return a number, got ${describeType(now)}`);
  }
  if (!Number.isFinite(now) || now < 0) {
    throw new RangeError(`handleAi: deps.now() must return a time in ms, got ${now}`);
  }
  return now;
}

const isFeature = (feature: string): feature is AiFeature =>
  (AI_FEATURES as readonly string[]).includes(feature);

/**
 * R4-23: the `Origin` is the site's own, or the request's own (its protocol and `Host`), which
 * local runs and the end-to-end server need. A missing `Origin`, `null` or any other is refused.
 */
function originAllowed(request: Request, siteOrigin: string): boolean {
  const origin = request.headers.get("origin");
  if (origin === null) return false;
  if (origin === siteOrigin) return true;
  const host = request.headers.get("host");
  if (host === null) return false;
  return origin === `${new URL(request.url).protocol}//${host}`;
}

/**
 * The body as text: `TOO_LARGE` when its declared `Content-Length` or the bytes read pass `cap`
 * (reading stops there), null when it cannot be read or is not UTF-8.
 */
async function readBody(request: Request, cap: number): Promise<string | null | typeof TOO_LARGE> {
  const declared = request.headers.get("content-length");
  if (declared !== null && /^\d+$/.test(declared) && Number(declared) > cap) return TOO_LARGE;
  if (request.body === null) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > cap) {
        reader.cancel().catch(() => {});
        return TOO_LARGE;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/**
 * The feature's input from the body's text, as `inputSchema` reads it (its output, not the raw JSON),
 * or null when the text is not JSON or the schema refuses it.
 */
function parseInput(feature: AiFeature, text: string): FeatureInput[AiFeature] | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  const checked = inputSchema(feature).safeParse(value);
  return checked.success ? (checked.data as FeatureInput[AiFeature]) : null;
}

/** The highest count among the request's cap cookies for `today`; 0 when none verifies. */
async function capCount(key: CryptoKey, request: Request, today: string): Promise<number> {
  const header = request.headers.get("cookie") ?? "";
  const values = header.split(";").flatMap((pair) => {
    const at = pair.indexOf("=");
    return at !== -1 && pair.slice(0, at).trim() === CAP_COOKIE ? [pair.slice(at + 1).trim()] : [];
  });
  const counts = await Promise.all(values.map((value) => verifyCap(key, value, today)));
  return Math.max(0, ...counts);
}

/** A tier's failure as a reply lists it: the status for `http` alone, and never upstream text. */
function failureOf(tier: Tier, outcome: Extract<TierOutcome<AiFeature>, { ok: false }>): Failure {
  const { kind, status } = outcome;
  return kind === "http"
    ? { tier: tier.tier, slug: tier.slug, kind, status: status ?? 0 }
    : { tier: tier.tier, slug: tier.slug, kind };
}

/** What `handleAi` hands its `after` task: the tracer to flush once a trace was made. */
type Flush = { tracer: Tracer | null };

/**
 * The action's trace (R4-52): with tracing off, `NO_TRACER`'s, which records nothing; with it on, one
 * trace from the tracer `tracerFor` gives. A throw there is logged once and the action goes on with
 * `NO_TRACER`. `traced` says whether the records are worth building.
 */
function startTrace(
  deps: AiDeps,
  env: AiEnv,
  feature: AiFeature,
  input: FeatureInput[AiFeature],
  flush: Flush,
): { readonly trace: ActionTrace; readonly traced: boolean } {
  const name = TRACE_NAMES[feature];
  const { tracing } = env;
  const untraced = () => ({
    trace: NO_TRACER.action(name, { feature, environment: "", input: null }),
    traced: false,
  });
  if (tracing === null) return untraced();
  try {
    const tracer = deps.tracerFor(tracing);
    const trace = tracer.action(name, {
      feature,
      environment: tracing.environment,
      input: traceInput(feature, input),
    });
    flush.tracer = tracer;
    return { trace, traced: true };
  } catch {
    logOnce(deps.log, tracingFailed("action"));
    return untraced();
  }
}

/** Runs one tracing step; a throw is logged once per instance and changes nothing else. */
function traceStep(deps: AiDeps, step: "generation" | "end", run: () => void): void {
  try {
    run();
  } catch {
    logOnce(deps.log, tracingFailed(step));
  }
}

/**
 * One action on the shared quota (R4-16). It registers `after` with a promise that settles once the
 * reply is built and then flushes the trace, before any other work, so the flush outlives the reply.
 * A wrong `deps`, `feature` or `request` is a TypeError or a RangeError naming `handleAi`.
 */
export async function handleAi(feature: string, request: Request, deps: AiDeps): Promise<Response> {
  checkDeps(deps);
  if (typeof feature !== "string") {
    throw new TypeError(`handleAi: feature must be a string, got ${describeType(feature)}`);
  }
  if (!(request instanceof Request)) {
    throw new TypeError(`handleAi: request must be a Request, got ${describeType(request)}`);
  }
  const flush: Flush = { tracer: null };
  let built!: () => void;
  const replied = new Promise<void>((resolve) => {
    built = resolve;
  });
  deps.after(
    replied
      .then(() => flush.tracer?.flush())
      .catch(() => logOnce(deps.log, tracingFailed("flush"))),
  );
  try {
    return await respond(feature, request, deps, flush);
  } finally {
    built();
  }
}

async function respond(
  feature: string,
  request: Request,
  deps: AiDeps,
  flush: Flush,
): Promise<Response> {
  const now = readNow(deps);
  // (1) The feature.
  if (!isFeature(feature)) return reply(404, { ok: false, code: "unknown-feature" });
  // (2) The origin.
  if (!originAllowed(request, deps.siteOrigin)) {
    return reply(403, { ok: false, code: "forbidden-origin" });
  }
  // (3) The environment, and a tier for the feature.
  const read = readAiEnv(deps.env);
  if (!read.ok) {
    logOnce(deps.log, badVariable(read.variable));
    return notConfigured();
  }
  const { env } = read;
  if (env.tracingProblem !== null) {
    logOnce(deps.log, `dyelot ai: ${env.tracingProblem} is missing or invalid, so tracing is off.`);
  }
  const plan = cascadePlan(feature, env);
  if (plan.length === 0) return notConfigured();
  // (4) The body: its size, then JSON, then the input schema.
  const text = await readBody(request, feature === "vibe" ? VIBE_BODY_MAX_BYTES : BODY_MAX_BYTES);
  if (text === TOO_LARGE) return reply(413, { ok: false, code: "too-large" });
  const input = text === null ? null : parseInput(feature, text);
  if (input === null) return reply(400, { ok: false, code: "bad-request" });
  // (5) The cap cookie.
  const today = utcDay(now);
  const capKey = await deriveCapKey(env.cookieSecret);
  const count = await capCount(capKey, request, today);
  if (count >= VISITOR_CAP) return reply(429, { ok: false, code: "visitor-cap", remaining: 0 });
  const left = VISITOR_CAP - count;
  // (6) The cache: a hit makes no call and does not count.
  const key = cacheKey(feature, input, PROMPTS[feature].version);
  const hit = deps.cache.get(key);
  if (hit !== undefined) return reply(200, success(feature, hit, left));
  // (7) The cascade gate: only the request that entered it leaves it, once, on every path. A hold
  // older than GATE_STALE_MS is taken over (R4-17 (b)).
  const release = deps.gate.enter(now);
  if (release === null) return reply(503, { ok: false, code: "busy", remaining: left });
  try {
    return await guardAndCascade({
      deps,
      env,
      feature,
      input,
      signal: request.signal,
      plan,
      key,
      left,
      flush,
      counted: async () =>
        capSetCookie(await signCap(capKey, today, count + 1), secondsToUtcMidnight(now)),
    });
  } finally {
    release();
  }
}

/** One action past the gate: what the guard and the tiers need from the request. */
type Action = {
  readonly deps: AiDeps;
  readonly env: AiEnv;
  readonly feature: AiFeature;
  readonly input: FeatureInput[AiFeature];
  readonly signal: AbortSignal;
  readonly plan: readonly Tier[];
  /** The cache key of the input. */
  readonly key: string;
  /** The visitor's actions left before this one: 3 − count. */
  readonly left: number;
  readonly flush: Flush;
  /** The cap cookie's `Set-Cookie` line with the count raised by one. */
  readonly counted: () => Promise<string>;
};

/**
 * R4-16 steps 8 and 9: the guard reads `/key` with 5,000 ms and fails closed; an admitted action runs
 * the tiers, re-reading `/key` with 2,000 ms before tiers 2 and 3 when the first read was below
 * `reserve + 6` (R4-17 (c)).
 */
async function guardAndCascade(action: Action): Promise<Response> {
  const { deps, env, signal, left } = action;
  const guard = { fetch: deps.fetch, baseUrl: env.baseUrl, apiKey: env.apiKey, signal };
  const first = await readGuard({ ...guard, timeoutMs: GUARD_TIMEOUT_MS });
  const verdict = guardVerdict(first, env.reserve);
  if (verdict !== "ok") return reply(503, { ok: false, code: verdict, remaining: left });
  const rereads = (first as number) < env.reserve + REREAD_MARGIN;
  return cascade(action, async () =>
    rereads
      ? guardVerdict(await readGuard({ ...guard, timeoutMs: REREAD_TIMEOUT_MS }), env.reserve)
      : "ok",
  );
}

/** The error's name for a log line, never its message, which could hold a value. */
const errorName = (error: unknown): string =>
  error instanceof Error ? error.name : describeType(error);

/**
 * The tiers of R4-12 after the guard admitted the action (R4-16 step 9). A tier is sent only while
 * the visitor's signal is live; before tier 1 a cancel answers as a first-read abort does (503
 * `guard-unavailable`, not counted), and before tier 2 or 3 it stops the cascade (502 with the
 * failures so far). The trace starts with the first attempt. From that attempt on the action counts
 * against the cap on every path: a success (200), a re-read's refusal (503), every tier failing
 * (502), and a fault that throws after it, which is logged once by its name and answered with what
 * the action has, its result or its failures.
 */
async function cascade(
  action: Action,
  reread: () => Promise<"ok" | "pool-low" | "guard-unavailable">,
): Promise<Response> {
  const { deps, env, feature, input, signal, plan, key, left, flush, counted } = action;
  const timed = env.tracing !== null;
  const image = feature === "vibe" ? (input as FeatureInput["vibe"]).image : undefined;
  const failures: Failure[] = [];
  let trace: ActionTrace | null = null;
  let traced = false;
  let ended = false;
  let attempts = 0;
  let answered: CachedResult | null = null;
  const end = (output: Parameters<ActionTrace["end"]>[0]) => {
    if (trace === null || ended) return;
    ended = true;
    const current = trace;
    traceStep(deps, "end", () => current.end(output));
  };
  try {
    for (const [index, tier] of plan.entries()) {
      if (index > 0) {
        // A visitor's cancel starts no further tier (R4-16, R4-56).
        if (signal.aborted) break;
        const again = await reread();
        if (again !== "ok") {
          end({ outcome: "all-tiers-failed" });
          const body = { ok: false, code: again, remaining: left - 1, failures };
          return reply(503, body, await counted());
        }
      }
      const chat = buildChatRequest({
        feature,
        input,
        slug: tier.slug,
        baseUrl: env.baseUrl,
        apiKey: env.apiKey,
        referer: deps.siteOrigin,
      });
      // With tracing on, an attempt is timed by readings around it; the cookie keeps the time read
      // at the start (R4-16).
      const startMs = timed ? deps.now() : 0;
      // Nothing async lies between this check and sendChat's own, so a tier is sent exactly when
      // the signal is live here.
      if (signal.aborted) {
        if (attempts === 0)
          return reply(503, { ok: false, code: "guard-unavailable", remaining: left });
        break;
      }
      if (trace === null) ({ trace, traced } = startTrace(deps, env, feature, input, flush));
      attempts += 1;
      const response = await sendChat(chat, {
        fetch: deps.fetch,
        timeoutMs: TIER_TIMEOUT_MS,
        signal,
      });
      const outcome = readReply(feature, input, response);
      if (outcome.ok) {
        answered = { result: outcome.output, slug: tier.slug, tier: tier.tier, attempts };
      } else {
        failures.push(failureOf(tier, outcome));
      }
      if (timed) {
        const endMs = deps.now();
        const current = trace;
        if (traced) {
          traceStep(deps, "generation", () =>
            current.generation({
              tier: tier.tier,
              slug: tier.slug,
              messages: traceMessages(chat.body, image),
              reply: outcome.content ?? null,
              usage: outcome.usage,
              failure: outcome.ok
                ? null
                : outcome.status === undefined
                  ? { kind: outcome.kind }
                  : { kind: outcome.kind, status: outcome.status },
              startMs,
              endMs,
            }),
          );
        }
      }
      if (answered !== null) {
        deps.cache.set(key, answered);
        end({ outcome: "ok", tier: answered.tier });
        return reply(200, success(feature, answered, left - 1), await counted());
      }
    }
    end({ outcome: "all-tiers-failed" });
    const body = { ok: false, code: "all-tiers-failed", remaining: left - 1, failures };
    return reply(502, body, await counted());
  } catch (error) {
    if (attempts === 0) throw error;
    logOnce(deps.log, `dyelot ai: an action failed after an attempt (${errorName(error)}).`);
    const tried = plan[attempts - 1] as Tier;
    if (answered === null && failures.length < attempts) {
      // The attempt in flight has no outcome: it reads as a call that did not complete (R4-11).
      failures.push({ tier: tried.tier, slug: tried.slug, kind: "http", status: 0 });
    }
    end(
      answered === null ? { outcome: "all-tiers-failed" } : { outcome: "ok", tier: answered.tier },
    );
    const setCookie = await counted();
    if (answered !== null) return reply(200, success(feature, answered, left - 1), setCookie);
    const body = { ok: false, code: "all-tiers-failed", remaining: left - 1, failures };
    return reply(502, body, setCookie);
  }
}

/**
 * `GET /api/ai/models` (R4-21): the text and vision slugs from the slug variables alone, with no call
 * and no secret read; a slug that fails `isFreeSlug` is 503 `not-configured`, logged once by name.
 */
export function handleModels(deps: Pick<AiDeps, "env" | "log">): Response {
  if (!isRecord(deps)) {
    throw new TypeError(`handleModels: deps must be an object, got ${describeType(deps)}`);
  }
  if (!isRecord(deps.env)) {
    throw new TypeError(`handleModels: deps.env must be an object, got ${describeType(deps.env)}`);
  }
  checkFunction(deps.log, "log", "handleModels");
  const slugs = readSlugs(deps.env);
  if (!slugs.ok) {
    logOnce(deps.log, badVariable(slugs.variable));
    return notConfigured();
  }
  return reply(200, {
    text: slugs.text.map((tier) => tier.slug),
    vision: slugs.vision.map((tier) => tier.slug),
  });
}
