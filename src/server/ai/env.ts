import { isFreeSlug, type Tier, type TierName } from "@/ai";

// The AI environment, read at the boundary (docs/specs/04-ai.md, R4-20 and section 11.4). Each value
// is stripped of a leading U+FEFF and edge white space (lesson-invisible-bytes), then validated in
// 11.4's order; the first bad variable is named, and its value never leaves this file: no result,
// error or log line holds it.

export type TracingEnv = {
  readonly publicKey: string;
  readonly secretKey: string;
  readonly baseUrl: string;
  readonly environment: string;
};
export type AiEnv = {
  readonly apiKey: string;
  readonly cookieSecret: Uint8Array;
  readonly reserve: number;
  readonly baseUrl: string;
  readonly text: readonly Tier[];
  readonly vision: readonly Tier[];
  readonly tracing: TracingEnv | null;
  /** The variable that turned tracing off, or null when tracing is on or not configured at all. */
  readonly tracingProblem: string | null;
};
export type EnvSource = Readonly<Record<string, string | undefined>>;

type Refused = { readonly ok: false; readonly variable: string };
type Slugs = {
  readonly ok: true;
  readonly text: readonly Tier[];
  readonly vision: readonly Tier[];
};

/** The server's key: 20 to 200 printable ASCII characters, no space (the guard checks it too). */
export const SERVER_KEY = /^[\x21-\x7e]{20,200}$/;
/** Base64 or base64url, padded or not. */
const BASE64 = /^[A-Za-z0-9+/_-]+={0,2}$/;
const SECRET_MIN_BYTES = 32;
/** An integer from 0 to 1000 in plain digits: no sign, decimal point, exponent or leading zero. */
const RESERVE = /^(?:0|[1-9]\d{0,3})$/;
const RESERVE_MAX = 1000;
const RESERVE_DEFAULT = 35;
const BASE_URL_DEFAULT = "https://openrouter.ai/api/v1";
const LOCAL_HOSTS = ["localhost", "127.0.0.1"];
const APP_ENV = /^(?!langfuse)[a-z0-9_-]{1,40}$/;
const APP_ENV_DEFAULT = "production";

/** The slug variables of R4-13, each with its tier, in cascade order. */
const TEXT_VARIABLES: ReadonlyArray<readonly [string, TierName]> = [
  ["OPENROUTER_MODEL_PRIMARY", "primary"],
  ["OPENROUTER_MODEL_FAST", "fast"],
  ["OPENROUTER_MODEL_FALLBACK", "fallback"],
];
const VISION_VARIABLES: ReadonlyArray<readonly [string, TierName]> = [
  ["OPENROUTER_VISION_MODEL_1", "vision-1"],
  ["OPENROUTER_VISION_MODEL_2", "vision-2"],
  ["OPENROUTER_VISION_MODEL_3", "vision-3"],
];
const LANGFUSE_VARIABLES = ["LANGFUSE_PUBLIC_KEY", "LANGFUSE_SECRET_KEY", "LANGFUSE_BASE_URL"];

function describeType(value: unknown): string {
  if (value === null) return "null";
  return Array.isArray(value) ? "array" : typeof value;
}

function checkSource(source: unknown, caller: string): asserts source is EnvSource {
  if (typeof source !== "object" || source === null || Array.isArray(source)) {
    throw new TypeError(`${caller}: source must be an object, got ${describeType(source)}`);
  }
}

/**
 * The variable's value with a leading U+FEFF and edge white space (CR and LF included) removed, or
 * null when that leaves nothing. A value that is not a string is a wiring bug: a TypeError naming
 * the variable and the value's type, never the value.
 */
function stripped(source: EnvSource, name: string, caller: string): string | null {
  const value: unknown = source[name];
  if (value === undefined) return null;
  if (typeof value !== "string") {
    throw new TypeError(`${caller}: ${name} must be a string or unset, got ${describeType(value)}`);
  }
  const text = value.replace(/^\uFEFF/, "").trim();
  return text === "" ? null : text;
}

/** The bytes of a base64 or base64url text, or null when it is neither. */
function decodeBase64(text: string): Uint8Array | null {
  if (!BASE64.test(text)) return null;
  const padded = text.includes("=");
  if (padded ? text.length % 4 !== 0 : text.length % 4 === 1) return null;
  const standard = text.replace(/-/g, "+").replace(/_/g, "/");
  try {
    const binary = atob(padded ? standard : standard.padEnd(Math.ceil(text.length / 4) * 4, "="));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

/** The parsed URL, or null when `text` is not one. */
function parseUrl(text: string): URL | null {
  try {
    return new URL(text);
  } catch {
    return null;
  }
}

/**
 * OpenRouter's base URL: `https:`, or `http:` on localhost or 127.0.0.1; no credentials, query or
 * hash; one trailing slash dropped, and no other left (buildChatRequest appends the paths).
 */
function readBaseUrl(text: string): string | null {
  const url = parseUrl(text);
  if (url === null || text.includes("?") || text.includes("#")) return null;
  const local = url.protocol === "http:" && LOCAL_HOSTS.includes(url.hostname);
  if (url.protocol !== "https:" && !local) return null;
  if (url.username !== "" || url.password !== "") return null;
  const base = url.href.endsWith("/") ? url.href.slice(0, -1) : url.href;
  return base.endsWith("/") ? null : base;
}

/** One group's tiers from its variables: an unset one is skipped, a set one must be a free slug. */
function readGroup(
  source: EnvSource,
  variables: ReadonlyArray<readonly [string, TierName]>,
  caller: string,
): readonly Tier[] | Refused {
  const tiers: Tier[] = [];
  for (const [name, tier] of variables) {
    const slug = stripped(source, name, caller);
    if (slug === null) continue;
    if (!isFreeSlug(slug)) return { ok: false, variable: name };
    tiers.push(Object.freeze({ tier, slug }));
  }
  return Object.freeze(tiers);
}

function slugsOf(source: EnvSource, caller: string): Slugs | Refused {
  const text = readGroup(source, TEXT_VARIABLES, caller);
  if ("ok" in text) return text;
  const vision = readGroup(source, VISION_VARIABLES, caller);
  if ("ok" in vision) return vision;
  return { ok: true, text, vision };
}

/**
 * The text and vision tiers from the slug variables alone (R4-13, R4-21): an unset or empty
 * variable skips its tier, and a set one that fails `isFreeSlug` is named. It reads no secret.
 */
export function readSlugs(source: EnvSource): Slugs | Refused {
  checkSource(source, "readSlugs");
  return slugsOf(source, "readSlugs");
}

/**
 * Tracing's settings (11.4's last rows): on with all three Langfuse variables and an `https:` base
 * URL, else off. A partial or bad set, or a bad `APP_ENV` beside the trio, names the first variable
 * at fault; with no Langfuse variable at all, tracing is off with no problem.
 */
function readTracing(source: EnvSource): {
  readonly tracing: TracingEnv | null;
  readonly problem: string | null;
} {
  const values = LANGFUSE_VARIABLES.map((name) => stripped(source, name, "readAiEnv"));
  const appEnv = stripped(source, "APP_ENV", "readAiEnv");
  if (values.every((value) => value === null)) return { tracing: null, problem: null };
  const missing = values.indexOf(null);
  if (missing !== -1) return { tracing: null, problem: LANGFUSE_VARIABLES[missing] as string };
  const [publicKey, secretKey, baseUrl] = values as [string, string, string];
  if (parseUrl(baseUrl)?.protocol !== "https:") {
    return { tracing: null, problem: "LANGFUSE_BASE_URL" };
  }
  if (appEnv !== null && !APP_ENV.test(appEnv)) return { tracing: null, problem: "APP_ENV" };
  const environment = appEnv ?? APP_ENV_DEFAULT;
  return { tracing: Object.freeze({ publicKey, secretKey, baseUrl, environment }), problem: null };
}

/**
 * The AI environment (R4-20): each variable stripped, then checked in section 11.4's order,
 * stopping at the first bad one, which is named and never shown. The Langfuse variables and
 * `APP_ENV` never make the environment invalid; they only turn tracing off.
 */
export function readAiEnv(source: EnvSource): { readonly ok: true; readonly env: AiEnv } | Refused {
  checkSource(source, "readAiEnv");
  const apiKey = stripped(source, "OPENROUTER_API_KEY", "readAiEnv");
  if (apiKey === null || !SERVER_KEY.test(apiKey))
    return { ok: false, variable: "OPENROUTER_API_KEY" };
  const secretText = stripped(source, "DYELOT_COOKIE_SECRET", "readAiEnv");
  const cookieSecret = secretText === null ? null : decodeBase64(secretText);
  if (cookieSecret === null || cookieSecret.length < SECRET_MIN_BYTES) {
    return { ok: false, variable: "DYELOT_COOKIE_SECRET" };
  }
  const reserveText = stripped(source, "DYELOT_AI_RESERVE", "readAiEnv");
  const reserve = reserveText === null ? RESERVE_DEFAULT : Number(reserveText);
  if (reserveText !== null && (!RESERVE.test(reserveText) || reserve > RESERVE_MAX)) {
    return { ok: false, variable: "DYELOT_AI_RESERVE" };
  }
  const baseText = stripped(source, "OPENROUTER_BASE_URL", "readAiEnv");
  const baseUrl = baseText === null ? BASE_URL_DEFAULT : readBaseUrl(baseText);
  if (baseUrl === null) return { ok: false, variable: "OPENROUTER_BASE_URL" };
  const slugs = slugsOf(source, "readAiEnv");
  if (!slugs.ok) return slugs;
  const { tracing, problem } = readTracing(source);
  const env: AiEnv = Object.freeze({
    apiKey,
    cookieSecret,
    reserve,
    baseUrl,
    text: slugs.text,
    vision: slugs.vision,
    tracing,
    tracingProblem: problem,
  });
  return { ok: true, env };
}
