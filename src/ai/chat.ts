import {
  assertInteger,
  assertOneOf,
  assertRecord,
  assertString,
  describeType,
  isRecord,
} from "./assert";
import { isFreeSlug } from "./cascade";
import {
  AI_FEATURES,
  type AiFeature,
  type FeatureInput,
  type FeatureOutput,
  inputSchema,
  outputJsonSchema,
  parseOutput,
} from "./features";
import { PROMPTS } from "./prompts";

// One OpenRouter call (docs/specs/04-ai.md, R4-08 to R4-11 and section 6.3): the request the server
// sends with its key and the browser with the visitor's, and the reader that sorts every reply into
// an output or one of six failure kinds. No AI SDK: one non-streaming POST, built and read here, sent
// by the shells.

/** The browser's OpenRouter origin (R4-14): the visitor key always calls it. */
export const OPENROUTER_ORIGIN = "https://openrouter.ai";

/** The text between the prompt file's body and the output's JSON Schema (R4-10). */
export const SCHEMA_PREAMBLE =
  "\n\nReply with one JSON object and nothing else, with no prose around it. It must match this JSON Schema:\n";

export type ChatRequest = {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
};
export type ChatPart =
  | { readonly type: "text"; readonly text: string }
  | { readonly type: "image_url"; readonly image_url: { readonly url: string } };
/** What a transport hands back: the reply's status and body text, or why there was none. */
export type ChatResponse =
  | { readonly status: number; readonly text: string }
  | { readonly kind: "timeout" | "network" };

/** The six ways a tier fails (R4-11), the one list the route reply's reader checks too. */
export const FAILURE_KINDS = Object.freeze([
  "http",
  "timeout",
  "empty",
  "json",
  "schema",
  "range",
] as const);
export type FailureKind = (typeof FAILURE_KINDS)[number];

export type Usage = {
  readonly prompt: number;
  readonly completion: number;
  readonly cached: number;
  readonly reasoning: number;
  readonly cost: number;
};
export type TierOutcome<F extends AiFeature> =
  | {
      readonly ok: true;
      readonly output: FeatureOutput[F];
      readonly content: string;
      readonly usage: Usage | null;
    }
  | {
      readonly ok: false;
      readonly kind: FailureKind;
      readonly status?: number;
      readonly content?: string;
      readonly usage: Usage | null;
    };

/** The most bytes of a reply body either transport reads (R4-11). */
const REPLY_MAX_BYTES = 262_144;
const RESPONSE_KINDS = ["timeout", "network"] as const;
const MIN_STATUS = 100;
const MAX_STATUS = 599;
/** The server's key is 20 to 200 characters (11.4) and a visitor's 20 to 400 (R4-33). */
const API_KEY = /^[\x21-\x7e]{20,400}$/;
/** An origin: a protocol, then a host and port with no path, query, hash or white space. */
const ORIGIN = /^https?:\/\/[^\s/?#]+$/;
/** A base URL: an origin and a path with no query, hash, white space or trailing slash. */
const BASE_URL = /^https?:\/\/[^\s/?#]+(?:\/[^\s?#]*)?$/;
const FENCE = "```";

// ——— stableJson ———

function isPlainObject(value: object): boolean {
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function writeJson(value: unknown, ancestors: Set<object>, at: string): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new RangeError(`stableJson: ${at} must be a finite number, got ${value}`);
    }
    return JSON.stringify(value);
  }
  if (typeof value !== "object" || !(Array.isArray(value) || isPlainObject(value))) {
    const type = typeof value === "object" ? "an object of a class" : describeType(value);
    throw new TypeError(`stableJson: ${at} must be a JSON value, got ${type}`);
  }
  if (ancestors.has(value)) throw new TypeError(`stableJson: ${at} must not hold itself`);
  ancestors.add(value);
  let text: string;
  if (Array.isArray(value)) {
    const items: string[] = [];
    for (let i = 0; i < value.length; i += 1) {
      items.push(writeJson(value[i], ancestors, `${at}[${i}]`));
    }
    text = `[${items.join(",")}]`;
  } else {
    const record = value as Readonly<Record<string, unknown>>;
    const fields = Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${writeJson(record[key], ancestors, `${at}.${key}`)}`);
    text = `{${fields.join(",")}}`;
  }
  ancestors.delete(value);
  return text;
}

/**
 * JSON with the keys of every object sorted (by UTF-16 code unit) and no white space (R4-10), so
 * equal values give equal text. A value JSON cannot hold is a TypeError; a non-finite number, a
 * RangeError.
 */
export function stableJson(value: unknown): string {
  return writeJson(value, new Set(), "value");
}

// ——— The messages and the request ———

/** The input, checked: a TypeError for a value that is not an object, else a RangeError. */
function checkInput<F extends AiFeature>(
  feature: F,
  input: unknown,
  caller: string,
): FeatureInput[F] {
  assertRecord(input, `${caller}: input`);
  const result = inputSchema(feature).safeParse(input);
  if (!result.success) {
    throw new RangeError(
      `${caller}: input is not a ${feature} input (${result.error.issues[0]?.message})`,
    );
  }
  return input as FeatureInput[F];
}

type Messages = { readonly system: string; readonly user: string | readonly ChatPart[] };

/** R4-10's two messages for an input already checked. */
function messagesFor<F extends AiFeature>(feature: F, input: FeatureInput[F]): Messages {
  const system =
    PROMPTS[feature].body + SCHEMA_PREAMBLE + JSON.stringify(outputJsonSchema(feature, input));
  if (feature !== "vibe") return Object.freeze({ system, user: stableJson(input) });
  const { image, ...rest } = input as FeatureInput["vibe"];
  const parts: readonly ChatPart[] = Object.freeze([
    Object.freeze({ type: "text", text: stableJson(rest) } as const),
    Object.freeze({ type: "image_url", image_url: Object.freeze({ url: image.dataUrl }) } as const),
  ]);
  return Object.freeze({ system, user: parts });
}

/**
 * The system message (the prompt file's body, `SCHEMA_PREAMBLE`, then the output's JSON Schema) and
 * the user message (`stableJson` of the input; for vibe a text part without the image, then the
 * image as an `image_url` part). The request builder and the on-device adapter both use it.
 */
export function chatMessages<F extends AiFeature>(feature: F, input: FeatureInput[F]): Messages {
  assertOneOf(feature, AI_FEATURES, "chatMessages: feature");
  return messagesFor(feature, checkInput(feature, input, "chatMessages"));
}

/**
 * R4-09's request: `POST {baseUrl}/chat/completions` with exactly four headers and a body whose keys
 * come in this order: model, messages, response_format, plugins, max_tokens, temperature, usage.
 * It never holds `provider`, `require_parameters` or `models`.
 */
export function buildChatRequest<F extends AiFeature>(args: {
  feature: F;
  input: FeatureInput[F];
  slug: string;
  baseUrl: string;
  apiKey: string;
  referer: string;
}): ChatRequest {
  assertRecord(args, "buildChatRequest: args");
  const { feature, slug, baseUrl, apiKey, referer } = args;
  assertOneOf(feature, AI_FEATURES, "buildChatRequest: feature");
  const input = checkInput(feature, args.input, "buildChatRequest");
  assertString(slug, "buildChatRequest: slug");
  if (!isFreeSlug(slug)) {
    throw new RangeError(`buildChatRequest: slug must be a free slug, got ${JSON.stringify(slug)}`);
  }
  assertString(baseUrl, "buildChatRequest: baseUrl");
  if (!BASE_URL.test(baseUrl) || baseUrl.endsWith("/")) {
    throw new RangeError(
      `buildChatRequest: baseUrl must be an http or https URL with no query, hash or trailing slash, got ${JSON.stringify(baseUrl)}`,
    );
  }
  assertString(apiKey, "buildChatRequest: apiKey");
  if (!API_KEY.test(apiKey)) {
    throw new RangeError(
      "buildChatRequest: apiKey must be 20 to 400 printable ASCII characters with no space",
    );
  }
  assertString(referer, "buildChatRequest: referer");
  if (!ORIGIN.test(referer)) {
    throw new RangeError(
      `buildChatRequest: referer must be an http or https origin, got ${JSON.stringify(referer)}`,
    );
  }
  const { system, user } = messagesFor(feature, input);
  const prompt = PROMPTS[feature];
  const body = {
    model: slug,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    plugins: [{ id: "response-healing" }],
    max_tokens: prompt.maxTokens,
    temperature: prompt.temperature,
    usage: { include: true },
  };
  return Object.freeze({
    url: `${baseUrl}/chat/completions`,
    headers: Object.freeze({
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": referer,
      "X-OpenRouter-Title": "dyelot",
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(body),
  });
}

// ——— The reply ———

/** Whether `text` takes more than `limit` bytes in UTF-8. */
function utf8BytesOver(text: string, limit: number): boolean {
  if (text.length > limit) return true;
  if (text.length * 3 <= limit) return false;
  return new TextEncoder().encode(text).length > limit;
}

/** JSON.parse that gives `undefined` for text that is not JSON. */
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

const finiteOr0 = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

/** R4-11's usage: null without a `usage` object, else each field, 0 when missing or not finite. */
function readUsage(body: Readonly<Record<string, unknown>>): Usage | null {
  const { usage } = body;
  if (!isRecord(usage)) return null;
  const prompt = isRecord(usage.prompt_tokens_details) ? usage.prompt_tokens_details : {};
  const completion = isRecord(usage.completion_tokens_details)
    ? usage.completion_tokens_details
    : {};
  return {
    prompt: finiteOr0(usage.prompt_tokens),
    completion: finiteOr0(usage.completion_tokens),
    cached: finiteOr0(prompt.cached_tokens),
    reasoning: finiteOr0(completion.reasoning_tokens),
    cost: finiteOr0(usage.cost),
  };
}

/** `choices[0].message.content` when it is a non-empty string, else null. */
function readContent(body: Readonly<Record<string, unknown>>): string | null {
  const { choices } = body;
  if (!Array.isArray(choices)) return null;
  const choice: unknown = choices[0];
  if (!isRecord(choice) || !isRecord(choice.message)) return null;
  const { content } = choice.message;
  return typeof content === "string" && content.length > 0 ? content : null;
}

/**
 * The content as one JSON object, after trimming and after removing one surrounding code fence (a
 * first line that starts with three backticks and a last line of three backticks), or null.
 */
function readObject(content: string): Readonly<Record<string, unknown>> | null {
  let text = content.trim();
  const lines = text.split("\n");
  if (lines.length >= 2 && lines[0]?.startsWith(FENCE) && lines[lines.length - 1] === FENCE) {
    text = lines.slice(1, -1).join("\n");
  }
  const value = parseJson(text);
  return isRecord(value) ? value : null;
}

function checkResponse(response: unknown): asserts response is ChatResponse {
  assertRecord(response, "readReply: response");
  if ("kind" in response) {
    assertOneOf(response.kind, RESPONSE_KINDS, "readReply: response.kind");
    return;
  }
  assertInteger(response.status, MIN_STATUS, MAX_STATUS, "readReply: response.status");
  assertString(response.text, "readReply: response.text");
}

/**
 * One tier's reply, read (R4-11): the output `parseOutput` accepted, or one of the six failure
 * kinds. It never throws for a reply; it throws only for a feature outside `AI_FEATURES`, an input
 * its schema rejects, or a response that is not a `ChatResponse`.
 */
export function readReply<F extends AiFeature>(
  feature: F,
  input: FeatureInput[F],
  response: ChatResponse,
): TierOutcome<F> {
  assertOneOf(feature, AI_FEATURES, "readReply: feature");
  const held = checkInput(feature, input, "readReply");
  checkResponse(response);
  if ("kind" in response) {
    return response.kind === "timeout"
      ? { ok: false, kind: "timeout", usage: null }
      : { ok: false, kind: "http", status: 0, usage: null };
  }
  const { status, text } = response;
  if (status < 200 || status > 299) return { ok: false, kind: "http", status, usage: null };
  const body = utf8BytesOver(text, REPLY_MAX_BYTES) ? undefined : parseJson(text);
  if (!isRecord(body)) return { ok: false, kind: "empty", usage: null };
  const usage = readUsage(body);
  const content = readContent(body);
  if (content === null) return { ok: false, kind: "empty", usage };
  const value = readObject(content);
  if (value === null) return { ok: false, kind: "json", content, usage };
  const result = parseOutput(feature, held, value);
  return result.ok
    ? { ok: true, output: result.output, content, usage }
    : { ok: false, kind: result.kind, content, usage };
}
