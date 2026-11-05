import {
  AI_FEATURES,
  type AiFeature,
  type FailureKind,
  type FeatureInput,
  type TierName,
  type Usage,
} from "@/ai";
import { describeType } from "./transport";

// What a trace holds (docs/specs/04-ai.md, R4-52 and section 11.6): one trace per action that
// reaches the cascade, one generation per chat attempt. The handler hands a `Tracer` plain records;
// these helpers turn them into 11.6's fields, so an image goes as its size, never its data URL, and
// nothing here ever sees the server key, the cookie or the cookie secret. `langfuse.ts` sends them.

export type TraceName =
  | "read-brief"
  | "refine-design"
  | "read-image-vibe"
  | "write-rationale"
  | "critique-findings";

/** Each feature's trace name (R4-52). */
export const TRACE_NAMES: Readonly<Record<AiFeature, TraceName>> = Object.freeze({
  brief: "read-brief",
  refine: "refine-design",
  vibe: "read-image-vibe",
  rationale: "write-rationale",
  critique: "critique-findings",
});

/** The name of every generation (11.6). */
export const GENERATION_NAME = "call-openrouter";

export type GenerationRecord = {
  readonly tier: TierName;
  readonly slug: string;
  /** `traceMessages` of the request's body. */
  readonly messages: unknown;
  /** The reply's content, or null when none was read. */
  readonly reply: string | null;
  readonly usage: Usage | null;
  readonly failure: { readonly kind: FailureKind; readonly status?: number } | null;
  readonly startMs: number;
  readonly endMs: number;
};
export type ActionTrace = {
  generation(record: GenerationRecord): void;
  end(output: { outcome: "ok" | "all-tiers-failed"; tier?: TierName }): void;
};
export type Tracer = {
  action(
    name: TraceName,
    attributes: { feature: AiFeature; environment: string; input: unknown },
  ): ActionTrace;
  flush(): Promise<void>;
};

const NO_ACTION: ActionTrace = Object.freeze({
  generation(): void {},
  end(): void {},
});

/** The tracer with tracing off: it makes nothing and flushes at once. */
export const NO_TRACER: Tracer = Object.freeze({
  action: (): ActionTrace => NO_ACTION,
  flush: (): Promise<void> => Promise.resolve(),
});

/** A data URL's base64 payload, as `vibeInput` and the input schema give it. */
const BASE64_DATA_URL = /^data:[^,;]+;base64,([A-Za-z0-9+/]*)(={0,2})$/;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The bytes a base64 data URL decodes to, or a RangeError naming `caller`. */
function decodedBytes(url: unknown, caller: string): number {
  const match = typeof url === "string" ? BASE64_DATA_URL.exec(url) : null;
  if (match === null) throw new RangeError(`${caller}: an image must be a base64 data URL`);
  return Math.floor(((match[1] as string).length * 3) / 4);
}

/** An image's size: positive integers, a TypeError or a RangeError naming `caller`. */
function checkSize(image: unknown, caller: string): { width: number; height: number } {
  if (!isRecord(image)) {
    throw new TypeError(`${caller}: image must be an object, got ${describeType(image)}`);
  }
  for (const side of ["width", "height"] as const) {
    const value = image[side];
    if (typeof value !== "number") {
      throw new TypeError(`${caller}: image.${side} must be a number, got ${describeType(value)}`);
    }
    if (!Number.isInteger(value) || value < 1) {
      throw new RangeError(`${caller}: image.${side} must be a positive integer, got ${value}`);
    }
  }
  return { width: image.width as number, height: image.height as number };
}

/**
 * The messages of a chat request's body (R4-10), as a trace holds them: each part as sent, but an
 * `image_url` part becomes `{ type: "image", bytes, width, height }`, `bytes` the data URL's decoded
 * length and the size from the vibe input, since the body carries only the data URL.
 */
export function traceMessages(body: string, image?: { width: number; height: number }): unknown {
  if (typeof body !== "string") {
    throw new TypeError(`traceMessages: body must be a string, got ${describeType(body)}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new RangeError("traceMessages: body must be JSON");
  }
  const messages = isRecord(parsed) ? parsed.messages : undefined;
  if (!Array.isArray(messages)) {
    throw new RangeError("traceMessages: body must hold a messages array");
  }
  const size = image === undefined ? null : checkSize(image, "traceMessages");
  return messages.map((message: unknown) => {
    if (!isRecord(message) || !Array.isArray(message.content)) return message;
    const content = message.content.map((part: unknown) => {
      if (!isRecord(part) || part.type !== "image_url") return part;
      if (size === null) {
        throw new RangeError("traceMessages: image must give the size of the body's image");
      }
      const url = isRecord(part.image_url) ? part.image_url.url : undefined;
      return { type: "image", bytes: decodedBytes(url, "traceMessages"), ...size };
    });
    return { ...message, content };
  });
}

/** The feature's input as a trace holds it: a vibe image as `{ type: "image", bytes, width, height }`. */
export function traceInput<F extends AiFeature>(feature: F, input: FeatureInput[F]): unknown {
  if (typeof feature !== "string") {
    throw new TypeError(`traceInput: feature must be a string, got ${describeType(feature)}`);
  }
  if (!(AI_FEATURES as readonly string[]).includes(feature)) {
    throw new RangeError(
      `traceInput: feature must be one of AI_FEATURES, got ${JSON.stringify(feature)}`,
    );
  }
  if (!isRecord(input)) {
    throw new TypeError(`traceInput: input must be an object, got ${describeType(input)}`);
  }
  if (feature !== "vibe") return input;
  const { clusters, image } = input as FeatureInput["vibe"];
  const size = checkSize(image, "traceInput");
  return {
    clusters,
    image: { type: "image", bytes: decodedBytes(image.dataUrl, "traceInput"), ...size },
  };
}

/** A usage bucket, never below 0: readReply keeps the numbers as sent, negative ones included. */
const bucket = (value: number): number => Math.max(0, value);

/** 11.6's generation fields, as `startObservation(…, { asType: "generation" })` takes them. */
export type GenerationFields = {
  readonly model: string;
  readonly input: unknown;
  readonly output: string | null;
  readonly usageDetails?: {
    readonly input: number;
    readonly input_cached_tokens: number;
    readonly output: number;
    readonly output_reasoning_tokens: number;
  };
  readonly costDetails?: { readonly total: number };
  readonly metadata: { readonly tier: TierName; readonly status?: number };
  readonly level?: "ERROR";
  readonly statusMessage?: FailureKind;
};

/**
 * One generation's fields (11.6): the slug as the model, the messages, the reply's content, the
 * usage split into exclusive buckets (`input = prompt − cached`, `output = completion − reasoning`,
 * each at least 0), the cost, the tier and an http status in the metadata, and `ERROR` with the
 * failure's kind when the attempt failed.
 */
export function generationFields(record: GenerationRecord): GenerationFields {
  if (!isRecord(record)) {
    throw new TypeError(`generationFields: record must be an object, got ${describeType(record)}`);
  }
  const { tier, slug, messages, reply, usage, failure } = record;
  const fields: {
    -readonly [K in keyof GenerationFields]: GenerationFields[K];
  } = {
    model: slug,
    input: messages,
    output: reply,
    metadata: failure?.status === undefined ? { tier } : { tier, status: failure.status },
  };
  if (usage !== null) {
    fields.usageDetails = {
      input: bucket(usage.prompt - usage.cached),
      input_cached_tokens: bucket(usage.cached),
      output: bucket(usage.completion - usage.reasoning),
      output_reasoning_tokens: bucket(usage.reasoning),
    };
    fields.costDetails = { total: bucket(usage.cost) };
  }
  if (failure !== null) {
    fields.level = "ERROR";
    fields.statusMessage = failure.kind;
  }
  return fields;
}
