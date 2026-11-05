import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  buildChatRequest,
  type ChatResponse,
  chatMessages,
  FAILURE_KINDS,
  OPENROUTER_ORIGIN,
  readReply,
  SCHEMA_PREAMBLE,
  stableJson,
} from "@/ai/chat";
import {
  AI_FEATURES,
  type AiFeature,
  type FeatureInput,
  outputJsonSchema,
  parseOutput,
} from "@/ai/features";
import { PROMPTS } from "@/ai/prompts";
import {
  BRIEF_IN,
  CRITIQUE_IN,
  RATIONALE_IN,
  REFINE_IN,
  readOutputs,
  TEST_KEY,
  TEXT_SLUGS,
  VIBE_IN,
  VISION_SLUGS,
} from "./fixtures";

// C-AI-07 to C-AI-11 and C-AI-RF4 of docs/specs/04-ai.md, section 14.2: the OpenRouter request
// (R4-08, R4-09), its two messages (R4-10, section 6.3) and the reply reader with its six failure
// kinds (R4-11). The server's transport and the browser's visitor key both send what
// `buildChatRequest` builds and read what comes back with `readReply`.

const BASE = "https://openrouter.ai/api/v1";
const MOCK_BASE = "http://127.0.0.1:3199/api/v1";
const REFERER = "https://dyelot.vercel.app";

const INPUTS: { readonly [F in AiFeature]: FeatureInput[F] } = {
  brief: BRIEF_IN,
  refine: REFINE_IN,
  vibe: VIBE_IN,
  rationale: RATIONALE_IN,
  critique: CRITIQUE_IN,
};
const OUTPUTS: { readonly [F in AiFeature]: unknown } = readOutputs();
const SLUGS: { readonly [F in AiFeature]: string } = {
  brief: TEXT_SLUGS[0],
  refine: TEXT_SLUGS[1],
  vibe: VISION_SLUGS[0],
  rationale: TEXT_SLUGS[2],
  critique: TEXT_SLUGS[0],
};

type Args = Parameters<typeof buildChatRequest>[0];
const ARGS: Args = {
  feature: "brief",
  input: BRIEF_IN,
  slug: "test/text-1:free",
  baseUrl: BASE,
  apiKey: TEST_KEY,
  referer: REFERER,
};
const argsFor = (feature: AiFeature): Args =>
  ({ ...ARGS, feature, input: INPUTS[feature], slug: SLUGS[feature] }) as Args;

/** The request body as JSON. */
const bodyOf = (args: Args): Record<string, unknown> =>
  JSON.parse(buildChatRequest(args).body) as Record<string, unknown>;

// ——— Replies ———

const USAGE = {
  prompt_tokens: 812,
  completion_tokens: 640,
  total_tokens: 1452,
  prompt_tokens_details: { cached_tokens: 128 },
  completion_tokens_details: { reasoning_tokens: 512 },
  cost: 0.000125,
};
const READ_USAGE = { prompt: 812, completion: 640, cached: 128, reasoning: 512, cost: 0.000125 };

/** A chat completion's body with one choice whose message holds `content`. */
function completion(content: unknown, extra: Record<string, unknown> = { usage: USAGE }): string {
  return JSON.stringify({
    id: "gen-1",
    object: "chat.completion",
    model: "test/text-1:free",
    choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content } }],
    ...extra,
  });
}
const ok200 = (content: unknown, extra?: Record<string, unknown>): ChatResponse => ({
  status: 200,
  text: completion(content, extra),
});
const read = (response: ChatResponse, feature: AiFeature = "brief") =>
  readReply(feature, INPUTS[feature] as never, response);
const json = (feature: AiFeature) => JSON.stringify(OUTPUTS[feature]);
/** The output parseOutput gives for a feature's fixture. */
const parsed = (feature: AiFeature, value: unknown = OUTPUTS[feature]) => {
  const result = parseOutput(feature, INPUTS[feature] as never, value);
  if (!result.ok) throw new Error(`fixture ${feature} failed: ${result.kind}`);
  return result.output;
};

/** `text` padded with spaces after its JSON to exactly `bytes` UTF-8 bytes. */
function padded(text: string, bytes: number): string {
  const size = new TextEncoder().encode(text).length;
  return text + " ".repeat(bytes - size);
}

describe("C-AI-07 buildChatRequest builds R4-09's request", () => {
  it("C-AI-07 OPENROUTER_ORIGIN is https://openrouter.ai", () => {
    expect(OPENROUTER_ORIGIN).toBe("https://openrouter.ai");
  });

  it("C-AI-07 posts to <base>/chat/completions", () => {
    expect(buildChatRequest(ARGS).url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(buildChatRequest({ ...ARGS, baseUrl: MOCK_BASE }).url).toBe(
      "http://127.0.0.1:3199/api/v1/chat/completions",
    );
    expect(buildChatRequest({ ...ARGS, baseUrl: `${OPENROUTER_ORIGIN}/api/v1` }).url).toBe(
      `${BASE}/chat/completions`,
    );
  });

  it("C-AI-07 sends exactly the four headers of R4-09, the key as a bearer token", () => {
    const { headers } = buildChatRequest(ARGS);
    expect(headers).toStrictEqual({
      Authorization: "Bearer sk-or-test-0123456789abcdef",
      "HTTP-Referer": "https://dyelot.vercel.app",
      "X-OpenRouter-Title": "dyelot",
      "Content-Type": "application/json",
    });
    expect(Object.keys(headers)).toEqual([
      "Authorization",
      "HTTP-Referer",
      "X-OpenRouter-Title",
      "Content-Type",
    ]);
    expect(buildChatRequest({ ...ARGS, referer: "http://localhost:3108" }).headers).toMatchObject({
      "HTTP-Referer": "http://localhost:3108",
    });
  });

  it("C-AI-07 writes the body's keys in R4-09's order with the brief prompt's max_tokens 4000 and temperature 0.4", () => {
    const body = bodyOf(ARGS);
    expect(Object.keys(body)).toEqual([
      "model",
      "messages",
      "response_format",
      "plugins",
      "max_tokens",
      "temperature",
      "usage",
    ]);
    expect(body.model).toBe("test/text-1:free");
    expect(body.response_format).toStrictEqual({ type: "json_object" });
    expect(body.plugins).toStrictEqual([{ id: "response-healing" }]);
    expect(body.max_tokens).toBe(4000);
    expect(body.temperature).toBe(0.4);
    expect(body.usage).toStrictEqual({ include: true });
  });

  it("C-AI-07 holds no provider, require_parameters or models key", () => {
    for (const feature of AI_FEATURES) {
      const body = bodyOf(argsFor(feature));
      expect(body, feature).not.toHaveProperty("provider");
      expect(body, feature).not.toHaveProperty("require_parameters");
      expect(body, feature).not.toHaveProperty("models");
    }
  });

  it("C-AI-07 takes each feature's max_tokens and temperature from its prompt file, json_object for every tier", () => {
    const temperatures = { brief: 0.4, refine: 0.2, vibe: 0.3, rationale: 0.6, critique: 0.2 };
    for (const feature of AI_FEATURES) {
      const body = bodyOf(argsFor(feature));
      expect(body.model, feature).toBe(SLUGS[feature]);
      expect(body.max_tokens, feature).toBe(PROMPTS[feature].maxTokens);
      expect(body.temperature, feature).toBe(PROMPTS[feature].temperature);
      expect(body.temperature, feature).toBe(temperatures[feature]);
      expect(body.response_format, feature).toStrictEqual({ type: "json_object" });
    }
  });

  it("C-AI-07 writes the body as one compact JSON object", () => {
    const { body } = buildChatRequest(ARGS);
    expect(body).toBe(JSON.stringify(JSON.parse(body)));
    expect(body.startsWith('{"model":"test/text-1:free","messages":[')).toBe(true);
  });

  it("C-AI-07 freezes the request and its headers", () => {
    const request = buildChatRequest(ARGS);
    expect(Object.isFrozen(request)).toBe(true);
    expect(Object.isFrozen(request.headers)).toBe(true);
  });

  it.each([
    ["args null", null, TypeError],
    ["args a string", "brief", TypeError],
    ["a feature 5", { ...ARGS, feature: 5 }, TypeError],
    ['a feature "haiku"', { ...ARGS, feature: "haiku" }, RangeError],
    ["an input null", { ...ARGS, input: null }, TypeError],
    ["another feature's input", { ...ARGS, feature: "critique" }, RangeError],
    ["an input of 0 characters", { ...ARGS, input: { brief: "", locked: {} } }, RangeError],
    ["a slug 5", { ...ARGS, slug: 5 }, TypeError],
    ['a slug "openrouter/free"', { ...ARGS, slug: "openrouter/free" }, RangeError],
    ["a slug without :free", { ...ARGS, slug: "google/gemma-4-26b-a4b-it" }, RangeError],
    ["a base URL 5", { ...ARGS, baseUrl: 5 }, TypeError],
    ["an empty base URL", { ...ARGS, baseUrl: "" }, RangeError],
    ["a base URL with a trailing /", { ...ARGS, baseUrl: `${BASE}/` }, RangeError],
    ["a base URL of ftp", { ...ARGS, baseUrl: "ftp://openrouter.ai/api/v1" }, RangeError],
    ["a base URL with a query", { ...ARGS, baseUrl: `${BASE}?x=1` }, RangeError],
    ["a base URL with a hash", { ...ARGS, baseUrl: `${BASE}#x` }, RangeError],
    ["a base URL with a space", { ...ARGS, baseUrl: "https://open router.ai/api/v1" }, RangeError],
    ["a key 5", { ...ARGS, apiKey: 5 }, TypeError],
    ["a key of 19 characters", { ...ARGS, apiKey: "sk-or-0123456789abc" }, RangeError],
    ["a key of 401 characters", { ...ARGS, apiKey: "k".repeat(401) }, RangeError],
    ["a key with a space", { ...ARGS, apiKey: "sk-or-test 0123456789abcdef" }, RangeError],
    ["a key with a line break", { ...ARGS, apiKey: "sk-or-test-0123456789\r\nX: y" }, RangeError],
    [
      "a key with a non-ASCII letter",
      { ...ARGS, apiKey: "sk-or-test-0123456789abcdé" },
      RangeError,
    ],
    ["a referer 5", { ...ARGS, referer: 5 }, TypeError],
    ["a referer with a path", { ...ARGS, referer: "https://dyelot.vercel.app/studio" }, RangeError],
    ["a referer with a trailing /", { ...ARGS, referer: "https://dyelot.vercel.app/" }, RangeError],
    ["a referer without a protocol", { ...ARGS, referer: "dyelot.vercel.app" }, RangeError],
    ["a referer with a line break", { ...ARGS, referer: "https://a.app\r\nX: y" }, RangeError],
  ] as const)("C-AI-07 %s is refused, naming buildChatRequest", (_, args, type) => {
    expect(() => buildChatRequest(args as unknown as Args)).toThrow(type);
    expect(() => buildChatRequest(args as unknown as Args)).toThrow(/^buildChatRequest: /);
  });

  it("C-AI-07 accepts a key of 20 and of 400 printable ASCII characters", () => {
    for (const apiKey of ["k".repeat(20), "~".repeat(400), "sk-or-v1-!#$%&'*+/=?^_`{|}~"]) {
      expect(buildChatRequest({ ...ARGS, apiKey }).headers.Authorization).toBe(`Bearer ${apiKey}`);
    }
  });
});

describe("C-AI-08 the messages: the prompt, the schema and the input", () => {
  it("C-AI-08 SCHEMA_PREAMBLE is R4-10's text", () => {
    expect(SCHEMA_PREAMBLE).toBe(
      "\n\nReply with one JSON object and nothing else, with no prose around it. It must match this JSON Schema:\n",
    );
  });

  it('C-AI-08 chatMessages("brief", BRIEF_IN) is the body, the preamble and the schema, then stableJson of the input', () => {
    expect(chatMessages("brief", BRIEF_IN)).toStrictEqual({
      system:
        PROMPTS.brief.body + SCHEMA_PREAMBLE + JSON.stringify(outputJsonSchema("brief", BRIEF_IN)),
      user: stableJson(BRIEF_IN),
    });
    expect(chatMessages("brief", BRIEF_IN).user).toBe(
      '{"brief":"Kyoto tea house at dusk, calm and exact","locked":{}}',
    );
  });

  it("C-AI-08 each text feature's user message is stableJson of its input", () => {
    for (const feature of ["brief", "refine", "rationale", "critique"] as const) {
      const messages = chatMessages(feature, INPUTS[feature] as never);
      expect(messages.user, feature).toBe(stableJson(INPUTS[feature]));
      expect(messages.system, feature).toBe(
        PROMPTS[feature].body +
          SCHEMA_PREAMBLE +
          JSON.stringify(outputJsonSchema(feature, INPUTS[feature] as never)),
      );
    }
  });

  it("C-AI-08 vibe's user message is a text part without image, then an image_url part with the data URL", () => {
    const { system, user } = chatMessages("vibe", VIBE_IN);
    expect(system).toBe(
      PROMPTS.vibe.body + SCHEMA_PREAMBLE + JSON.stringify(outputJsonSchema("vibe", VIBE_IN)),
    );
    expect(user).toStrictEqual([
      { type: "text", text: stableJson({ clusters: VIBE_IN.clusters }) },
      { type: "image_url", image_url: { url: VIBE_IN.image.dataUrl } },
    ]);
    const [text] = user as readonly { type: string; text: string }[];
    expect(Object.keys(JSON.parse(text?.text ?? "null"))).toEqual(["clusters"]);
    expect(text?.text).not.toContain("data:image");
  });

  it("C-AI-08 buildChatRequest's two messages are exactly chatMessages'", () => {
    for (const feature of AI_FEATURES) {
      const { system, user } = chatMessages(feature, INPUTS[feature] as never);
      expect(bodyOf(argsFor(feature)).messages, feature).toStrictEqual([
        { role: "system", content: system },
        { role: "user", content: user },
      ]);
    }
  });

  it("C-AI-08 freezes the messages and vibe's parts", () => {
    const messages = chatMessages("vibe", VIBE_IN);
    expect(Object.isFrozen(messages)).toBe(true);
    expect(Object.isFrozen(messages.user)).toBe(true);
    for (const part of messages.user as readonly object[]) expect(Object.isFrozen(part)).toBe(true);
  });

  it.each(AI_FEATURES)("C-AI-08 the %s JSON Schema equals its stored snapshot", async (feature) => {
    const schema = outputJsonSchema(feature, INPUTS[feature] as never);
    await expect(`${JSON.stringify(schema, null, 2)}\n`).toMatchFileSnapshot(
      `../../fixtures/ai/schemas/${feature}.json`,
    );
  });

  it.each([
    ["a feature 5", 5, BRIEF_IN, TypeError],
    ['a feature "haiku"', "haiku", BRIEF_IN, RangeError],
    ["an input null", "brief", null, TypeError],
    ["an input that is an array", "brief", [BRIEF_IN], TypeError],
    ["another feature's input", "vibe", BRIEF_IN, RangeError],
    ["a brief of 501 characters", "brief", { brief: "a".repeat(501), locked: {} }, RangeError],
  ] as const)("C-AI-08 chatMessages refuses %s, naming itself", (_, feature, input, type) => {
    const call = () => chatMessages(feature as AiFeature, input as never);
    expect(call).toThrow(type);
    expect(call).toThrow(/^chatMessages: /);
  });
});

/** An array whose first item is a hole. */
function holey(): unknown[] {
  const items: unknown[] = [];
  items[1] = 3;
  return items;
}

describe("C-AI-08 stableJson: keys sorted at every depth, no white space", () => {
  it("C-AI-08 sorts the keys of every object and keeps each array's order", () => {
    expect(stableJson({ b: [{ d: 1, c: "x y" }, 2], a: null, "": true, A: false })).toBe(
      '{"":true,"A":false,"a":null,"b":[{"c":"x y","d":1},2]}',
    );
    expect(stableJson({ z: { y: { x: [3, 1, 2] } } })).toBe('{"z":{"y":{"x":[3,1,2]}}}');
  });

  it("C-AI-08 gives the same text for objects built with their keys in another order", () => {
    expect(stableJson({ a: 1, b: { c: 2, d: 3 } })).toBe(stableJson({ b: { d: 3, c: 2 }, a: 1 }));
    expect(stableJson(BRIEF_IN)).toBe(stableJson({ locked: {}, brief: BRIEF_IN.brief }));
  });

  it("C-AI-08 writes strings, numbers and literals as JSON.stringify does", () => {
    for (const value of ['a"b\\c\n é\u{1F375}', 0, -0, 1.5, -2e-7, 1e21, 359, true, false, null]) {
      expect(stableJson(value)).toBe(JSON.stringify(value));
    }
    expect(stableJson([])).toBe("[]");
    expect(stableJson({})).toBe("{}");
    expect(stableJson(Object.create(null))).toBe("{}");
  });

  it("C-AI-08 reads every input fixture back to an equal value", () => {
    for (const feature of AI_FEATURES) {
      expect(JSON.parse(stableJson(INPUTS[feature])), feature).toStrictEqual(
        JSON.parse(JSON.stringify(INPUTS[feature])),
      );
    }
  });

  it.each([
    ["undefined", undefined, TypeError],
    ["a function", () => 1, TypeError],
    ["a symbol", Symbol("x"), TypeError],
    ["a bigint", BigInt(1), TypeError],
    ["a Date", new Date(0), TypeError],
    ["a Map", new Map(), TypeError],
    ["an undefined property", { a: undefined }, TypeError],
    ["an undefined item", [1, undefined], TypeError],
    ["a hole in an array", holey(), TypeError],
    ["NaN", Number.NaN, RangeError],
    ["Infinity inside an object", { a: [Number.POSITIVE_INFINITY] }, RangeError],
    ["-Infinity", Number.NEGATIVE_INFINITY, RangeError],
  ])("C-AI-08 stableJson refuses %s, naming itself", (_, value, type) => {
    expect(() => stableJson(value)).toThrow(type);
    expect(() => stableJson(value)).toThrow(/^stableJson: /);
  });

  it("C-AI-08 stableJson refuses a cycle with a TypeError and allows a shared value", () => {
    const loop: Record<string, unknown> = { a: 1 };
    loop.self = { back: loop };
    expect(() => stableJson(loop)).toThrow(TypeError);
    expect(() => stableJson(loop)).toThrow(/^stableJson: /);
    const shared = { x: 1 };
    expect(stableJson({ a: shared, b: [shared] })).toBe('{"a":{"x":1},"b":[{"x":1}]}');
  });
});

describe("C-AI-09 readReply reads a valid reply", () => {
  it("C-AI-09 a 200 with valid content gives ok with the output, the content and the usage", () => {
    const content = json("brief");
    expect(read(ok200(content))).toStrictEqual({
      ok: true,
      output: parsed("brief"),
      content,
      usage: READ_USAGE,
    });
  });

  it.each(AI_FEATURES)("C-AI-09 reads the %s fixture", (feature) => {
    const result = read(ok200(json(feature)), feature);
    expect(result).toStrictEqual({
      ok: true,
      output: parsed(feature),
      content: json(feature),
      usage: READ_USAGE,
    });
  });

  it("C-AI-09 gives the output parseOutput cleaned, and the content as the model wrote it", () => {
    const content = JSON.stringify({ ...(OUTPUTS.brief as object), name: "  Dusk  Tea " });
    const result = readReply("brief", BRIEF_IN, ok200(content));
    expect(result.ok && result.output.name).toBe("Dusk Tea");
    expect(result.content).toBe(content);
  });

  it("C-AI-09 reads any status from 200 to 299", () => {
    for (const status of [200, 201, 299]) {
      expect(read({ status, text: completion(json("brief")) }).ok, String(status)).toBe(true);
    }
  });

  it("C-AI-09 reads a missing usage field, or one that is not a finite number, as 0", () => {
    expect(read(ok200(json("brief"), { usage: {} })).usage).toStrictEqual({
      prompt: 0,
      completion: 0,
      cached: 0,
      reasoning: 0,
      cost: 0,
    });
    const odd = {
      prompt_tokens: "812",
      completion_tokens: null,
      prompt_tokens_details: 128,
      completion_tokens_details: { reasoning_tokens: true },
      cost: [0.1],
    };
    expect(read(ok200(json("brief"), { usage: odd })).usage).toStrictEqual({
      prompt: 0,
      completion: 0,
      cached: 0,
      reasoning: 0,
      cost: 0,
    });
    const partial = { completion_tokens: 7, prompt_tokens_details: {}, cost: 0 };
    expect(read(ok200(json("brief"), { usage: partial })).usage).toStrictEqual({
      prompt: 0,
      completion: 7,
      cached: 0,
      reasoning: 0,
      cost: 0,
    });
  });

  it("C-AI-09 reads a usage number JSON writes as infinite (1e999) as 0", () => {
    const text = completion(json("brief"), { usage: { prompt_tokens: 7 } }).replace(
      '"prompt_tokens":7',
      '"prompt_tokens":1e999,"cost":-1e999',
    );
    expect(read({ status: 200, text }).usage).toStrictEqual({
      prompt: 0,
      completion: 0,
      cached: 0,
      reasoning: 0,
      cost: 0,
    });
  });

  it.each([
    ["no usage key", {}],
    ["usage null", { usage: null }],
    ["usage a number", { usage: 5 }],
    ["usage a string", { usage: "812" }],
    ["usage an array", { usage: [USAGE] }],
  ])("C-AI-09 a body with %s gives usage null", (_, extra) => {
    expect(read(ok200(json("brief"), extra))).toStrictEqual({
      ok: true,
      output: parsed("brief"),
      content: json("brief"),
      usage: null,
    });
  });

  it.each([
    ["```json and ```", `\`\`\`json\n${json("brief")}\n\`\`\``],
    ["``` and ```", `\`\`\`\n${json("brief")}\n\`\`\``],
    [
      "a fence around indented JSON",
      `\`\`\`json\n${JSON.stringify(OUTPUTS.brief, null, 2)}\n\`\`\``,
    ],
    ["a fence with white space around it", `\n  \`\`\`JSON\r\n${json("brief")}\r\n\`\`\`\n `],
    ["white space and no fence", `\n\t ${json("brief")} \n`],
  ])("C-AI-09 content in %s reads the same", (_, content) => {
    expect(read(ok200(content))).toStrictEqual({
      ok: true,
      output: parsed("brief"),
      content,
      usage: READ_USAGE,
    });
  });
});

describe("C-AI-10 readReply sorts every failure into one of six kinds", () => {
  it("C-AI-10 FailureKind lists the six kinds of R4-11, frozen", () => {
    expect(FAILURE_KINDS).toEqual(["http", "timeout", "empty", "json", "schema", "range"]);
    expect(Object.isFrozen(FAILURE_KINDS)).toBe(true);
  });

  it.each([429, 500, 401, 403, 404, 502, 503, 100, 199, 300, 599])(
    "C-AI-10 status %i is http with the status and no body text, even over valid content",
    (status) => {
      expect(read({ status, text: completion(json("brief")) })).toStrictEqual({
        ok: false,
        kind: "http",
        status,
        usage: null,
      });
    },
  );

  it("C-AI-10 a rejected request (network) is http with status 0", () => {
    expect(read({ kind: "network" })).toStrictEqual({
      ok: false,
      kind: "http",
      status: 0,
      usage: null,
    });
  });

  it("C-AI-10 a timeout is timeout", () => {
    expect(read({ kind: "timeout" })).toStrictEqual({ ok: false, kind: "timeout", usage: null });
  });

  it.each([
    ["not json", "not json"],
    ["{}", "{}"],
    ["choices: []", JSON.stringify({ choices: [] })],
    ['content ""', completion("", {})],
    ["content null", completion(null, {})],
    ["an empty body", ""],
    ["a body null", "null"],
    ["a body that is an array", JSON.stringify([{ message: { content: json("brief") } }])],
    ["a body that is a string", JSON.stringify(json("brief"))],
    [
      "choices that are an object",
      JSON.stringify({ choices: { 0: { message: { content: "x" } } } }),
    ],
    ["a choice null", JSON.stringify({ choices: [null] })],
    ["a choice without a message", JSON.stringify({ choices: [{ text: json("brief") }] })],
    ["a message that is a string", JSON.stringify({ choices: [{ message: json("brief") }] })],
    ["content that is a number", completion(5, {})],
    ["content that is an array of parts", completion([{ type: "text", text: json("brief") }], {})],
    ["content that is an object", completion(OUTPUTS.brief, {})],
    ["a cut body", completion(json("brief")).slice(0, -3)],
  ])("C-AI-10 a body with %s is empty", (_, text) => {
    expect(read({ status: 200, text })).toStrictEqual({ ok: false, kind: "empty", usage: null });
  });

  it("C-AI-10 an empty reply still reads its usage", () => {
    expect(read(ok200(""))).toStrictEqual({ ok: false, kind: "empty", usage: READ_USAGE });
    expect(read({ status: 200, text: JSON.stringify({ usage: USAGE }) })).toStrictEqual({
      ok: false,
      kind: "empty",
      usage: READ_USAGE,
    });
  });

  it("C-AI-10 a body of 262,145 bytes is empty, and one of 262,144 bytes reads", () => {
    const text = completion(json("brief"));
    expect(read({ status: 200, text: padded(text, 262_144) }).ok).toBe(true);
    expect(read({ status: 200, text: padded(text, 262_145) })).toStrictEqual({
      ok: false,
      kind: "empty",
      usage: null,
    });
  });

  it("C-AI-10 counts the body's UTF-8 bytes, not its characters", () => {
    const text = completion(json("brief"), { usage: USAGE, note: "é".repeat(131_072) });
    expect(text.length).toBeLessThan(262_144);
    expect(read({ status: 200, text })).toStrictEqual({ ok: false, kind: "empty", usage: null });
    const fits = completion(json("brief"), { usage: USAGE, note: "é".repeat(130_000) });
    expect(read({ status: 200, text: fits }).ok).toBe(true);
  });

  it.each([
    ["hello", "hello"],
    ["[1]", "[1]"],
    ["an unclosed fence", `\`\`\`json\n${json("brief")}`],
    ["a closing fence alone", `${json("brief")}\n\`\`\``],
    ["a fence on one line", `\`\`\`${json("brief")}\`\`\``],
    ["two fences", `\`\`\`json\n\`\`\`json\n${json("brief")}\n\`\`\`\n\`\`\``],
    ["an empty fence", "```\n```"],
    ["a fence with text after it", `\`\`\`json\n${json("brief")}\n\`\`\`\nDone.`],
    ["prose around the JSON", `Here it is: ${json("brief")} Hope this helps.`],
    ["two objects", `${json("brief")} {}`],
    ["white space only", " \n\t "],
    ["null", "null"],
    ["a number", "150"],
    ["a JSON string", JSON.stringify(json("brief"))],
    ["a cut tail", json("brief").slice(0, -1)],
  ])("C-AI-10 content %s is json, with the content kept", (_, content) => {
    expect(read(ok200(content))).toStrictEqual({
      ok: false,
      kind: "json",
      content,
      usage: READ_USAGE,
    });
  });

  it.each([
    ["brief", "an unknown key", { ...(OUTPUTS.brief as object), mood: "calm" }, "schema"],
    ["brief", "no parameter field", { name: "Dusk Tea" }, "schema"],
    ["refine", 'an op "setDensity"', { ops: [{ op: "setDensity" }], summary: "x" }, "schema"],
    ["critique", "an empty object", {}, "schema"],
    ["brief", "a hue of 360", { ...(OUTPUTS.brief as object), hues: { primary: 360 } }, "range"],
    [
      "brief",
      'a preset "vaporwave"',
      { ...(OUTPUTS.brief as object), preset: "vaporwave" },
      "range",
    ],
    [
      "vibe",
      'a roleMap id "c9"',
      { ...(OUTPUTS.vibe as object), roleMap: { primary: "c9" } },
      "range",
    ],
    [
      "rationale",
      "a color in the thesis",
      { ...(OUTPUTS.rationale as object), thesis: "Warm #3a6ea5 tones." },
      "range",
    ],
  ] as const)(
    "C-AI-10 a %s output with %s is %s, as C-AI-05 and C-AI-06",
    (feature, _, value, kind) => {
      const content = JSON.stringify(value);
      expect(parseOutput(feature, INPUTS[feature] as never, value)).toStrictEqual({
        ok: false,
        kind,
      });
      expect(read(ok200(content), feature)).toStrictEqual({
        ok: false,
        kind,
        content,
        usage: READ_USAGE,
      });
    },
  );

  it("C-AI-10 a fenced output that fails parseOutput keeps the content as read", () => {
    const content = `\`\`\`json\n${JSON.stringify({ name: "Dusk Tea" })}\n\`\`\``;
    expect(read(ok200(content, {}))).toStrictEqual({
      ok: false,
      kind: "schema",
      content,
      usage: null,
    });
  });

  it.each([
    ["a feature 5", 5, BRIEF_IN, { status: 200, text: "" }, TypeError],
    ['a feature "haiku"', "haiku", BRIEF_IN, { status: 200, text: "" }, RangeError],
    ["an input null", "brief", null, { status: 200, text: "" }, TypeError],
    ["another feature's input", "critique", BRIEF_IN, { status: 200, text: "" }, RangeError],
    ["a response null", "brief", BRIEF_IN, null, TypeError],
    ["a response that is a string", "brief", BRIEF_IN, "200", TypeError],
    ["a response {}", "brief", BRIEF_IN, {}, TypeError],
    ["a status that is a string", "brief", BRIEF_IN, { status: "200", text: "" }, TypeError],
    ["a status of 99", "brief", BRIEF_IN, { status: 99, text: "" }, RangeError],
    ["a status of 600", "brief", BRIEF_IN, { status: 600, text: "" }, RangeError],
    ["a status of 200.5", "brief", BRIEF_IN, { status: 200.5, text: "" }, RangeError],
    ["a text that is a number", "brief", BRIEF_IN, { status: 200, text: 5 }, TypeError],
    ["a response with no text", "brief", BRIEF_IN, { status: 200 }, TypeError],
    ['a kind "abort"', "brief", BRIEF_IN, { kind: "abort" }, RangeError],
    ["a kind that is a number", "brief", BRIEF_IN, { kind: 5 }, TypeError],
  ] as const)(
    "C-AI-10 readReply refuses %s, naming itself",
    (_, feature, input, response, type) => {
      const call = () => readReply(feature as AiFeature, input as never, response as never);
      expect(call).toThrow(type);
      expect(call).toThrow(/^readReply: /);
    },
  );
});

// ——— The properties ———

/** `text` with `remove` characters at `at` (wrapped to its length) replaced by `insert`. */
function splice(text: string, at: number, remove: number, insert: string): string {
  const i = at % (text.length + 1);
  return text.slice(0, i) + insert + text.slice(i + remove);
}

const featureArb = fc.constantFrom(...AI_FEATURES);
const editArb = fc.tuple(fc.nat(), fc.nat({ max: 8 }), fc.string({ maxLength: 4 }));

/** A reply body: any JSON, any string, a valid reply, or a valid reply cut and spliced. */
const bodyArb = (feature: AiFeature) =>
  fc.oneof(
    { arbitrary: fc.json(), weight: 2 },
    { arbitrary: fc.string(), weight: 2 },
    { arbitrary: fc.constant(completion(json(feature))), weight: 1 },
    {
      arbitrary: editArb.map(([at, n, s]) => splice(completion(json(feature)), at, n, s)),
      weight: 3,
    },
    {
      arbitrary: editArb.map(([at, n, s]) => completion(splice(json(feature), at, n, s))),
      weight: 4,
    },
    {
      arbitrary: fc.jsonValue().map((value) => completion(JSON.stringify(value))),
      weight: 1,
    },
  );

const responseArb = (feature: AiFeature): fc.Arbitrary<ChatResponse> =>
  fc.oneof(
    {
      arbitrary: fc.record({
        status: fc.oneof(fc.constant(200), fc.integer({ min: 100, max: 599 })),
        text: bodyArb(feature),
      }),
      weight: 10,
    },
    {
      arbitrary: fc.constantFrom({ kind: "timeout" as const }, { kind: "network" as const }),
      weight: 1,
    },
  );

describe("C-AI-11 readReply never throws", () => {
  it("C-AI-11 property, 1,000 runs: any status and body gives ok with an output parseOutput accepts, or one of the six kinds", () => {
    const seen = new Set<string>();
    fc.assert(
      fc.property(
        featureArb.chain((feature) => fc.tuple(fc.constant(feature), responseArb(feature))),
        ([feature, response]) => {
          const result = readReply(feature, INPUTS[feature] as never, response);
          seen.add(result.ok ? "ok" : result.kind);
          if (result.ok) {
            expect(parseOutput(feature, INPUTS[feature] as never, result.output).ok).toBe(true);
            expect(typeof result.content).toBe("string");
          } else {
            expect(FAILURE_KINDS).toContain(result.kind);
            expect("status" in result).toBe(result.kind === "http");
          }
          if ("kind" in response) {
            expect(result).toMatchObject(
              response.kind === "timeout" ? { kind: "timeout" } : { kind: "http", status: 0 },
            );
          } else if (response.status < 200 || response.status > 299) {
            expect(result).toStrictEqual({
              ok: false,
              kind: "http",
              status: response.status,
              usage: null,
            });
          }
        },
      ),
      { numRuns: 1000, seed: 4002 },
    );
    for (const kind of ["ok", "http", "timeout", "empty", "json", "schema"]) {
      expect([...seen], kind).toContain(kind);
    }
  });
});

// C-AI-RF4: valid outputs, each mutated in one way that R4-38 or R4-11 refuses (or, for a fence,
// one R4-11 removes).

/** Each fixture output, and a refine whose first op is a shiftHue, so it holds a number. */
const VALID: readonly (readonly [AiFeature, unknown])[] = [
  ...AI_FEATURES.map((feature) => [feature, OUTPUTS[feature]] as const),
  [
    "refine",
    {
      ops: [{ op: "shiftHue", slot: "primary", degrees: 10 }, ...readOutputs().refine.ops],
      summary: "A cooler primary.",
    },
  ],
];

type Path = readonly (string | number)[];

/** Every path below the root: to each value inside the output, containers included. */
function paths(value: unknown, at: Path = []): Path[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => [[...at, i], ...paths(item, [...at, i])]);
  }
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, item]) => [
      [...at, key],
      ...paths(item, [...at, key]),
    ]);
  }
  return [];
}

function get(value: unknown, path: Path): unknown {
  return path.reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], value);
}

/** A deep copy of `value` with the value at `path` replaced by `make(old)`. */
function replaced(value: unknown, path: Path, make: (old: unknown) => unknown): unknown {
  const copy = structuredClone(value);
  const parent = get(copy, path.slice(0, -1)) as Record<string | number, unknown>;
  const key = path[path.length - 1] as string | number;
  parent[key] = make(parent[key]);
  return copy;
}

const typeOf = (value: unknown) =>
  value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
const OTHER_TYPES: readonly unknown[] = ["x", 5, true, null, [], {}];
const COLORS = [
  "#3a6ea5",
  "#fff",
  "#3a6ea5cc",
  "oklch(0.6 0.1 250)",
  "RGB(1 2 3)",
  "hsl(10 20% 30%)",
  "color(display-p3 1 0 0)",
];
/** Out of range for every number of every output: a hue, a shiftHue's degrees, a finding index. */
const OUT_OF_RANGE = [-61, 360, 1000, 0.5, 1e20, -1e20];

type Mutation =
  | { readonly kind: "value"; readonly name: string; readonly value: unknown }
  | {
      readonly kind: "text";
      readonly name: string;
      readonly content: string;
      readonly heals: boolean;
    };

/** One mutation of one valid output: a value that breaks a rule, or a text around valid JSON. */
const mutationArb = (output: unknown): fc.Arbitrary<Mutation> => {
  const all = paths(output);
  const strings = all.filter((path) => typeof get(output, path) === "string");
  const numbers = all.filter((path) => typeof get(output, path) === "number");
  const objects = [[], ...all].filter((path) => typeOf(get(output, path)) === "object");
  const text = JSON.stringify(output);
  const choices: fc.Arbitrary<Mutation>[] = [
    fc
      .tuple(fc.constantFrom(...all), fc.constantFrom(...OTHER_TYPES))
      .filter(([path, other]) => typeOf(other) !== typeOf(get(output, path)))
      .map(
        ([path, other]): Mutation => ({
          kind: "value",
          name: `wrong type at ${path.join(".")}`,
          value: replaced(output, path, () => structuredClone(other)),
        }),
      ),
    fc.tuple(fc.constantFrom(...objects), fc.constantFrom("extra", "mood", "color")).map(
      ([path, key]): Mutation => ({
        kind: "value",
        name: `extra key ${key} at ${path.join(".")}`,
        value:
          path.length === 0
            ? { ...(output as object), [key]: 1 }
            : replaced(output, path, (old) => ({ ...(old as object), [key]: 1 })),
      }),
    ),
    fc.tuple(fc.constantFrom(...strings), fc.constantFrom(...COLORS), fc.nat()).map(
      ([path, color, at]): Mutation => ({
        kind: "value",
        name: `color ${color} at ${path.join(".")}`,
        value: replaced(output, path, (old) => splice(old as string, at, 0, ` ${color} `)),
      }),
    ),
    fc.constantFrom("```json", "```", "```JSON").map(
      (open): Mutation => ({
        kind: "text",
        name: `fence ${open}`,
        content: `${open}\n${text}\n\`\`\``,
        heals: true,
      }),
    ),
    fc.nat({ max: text.length - 1 }).map(
      (end): Mutation => ({
        kind: "text",
        name: `cut at ${end}`,
        content: text.slice(0, end),
        heals: false,
      }),
    ),
    fc
      .tuple(
        fc.constantFrom("", "Here is the JSON: ", "Sure.\n"),
        fc.constantFrom("", " Hope this helps.", "\nThat is all."),
      )
      .filter(([before, after]) => before !== "" || after !== "")
      .map(
        ([before, after]): Mutation => ({
          kind: "text",
          name: "prose around the JSON",
          content: `${before}${text}${after}`,
          heals: false,
        }),
      ),
  ];
  if (numbers.length > 0) {
    choices.push(
      fc.tuple(fc.constantFrom(...numbers), fc.constantFrom(...OUT_OF_RANGE)).map(
        ([path, number]): Mutation => ({
          kind: "value",
          name: `number ${number} at ${path.join(".")}`,
          value: replaced(output, path, () => number),
        }),
      ),
    );
  }
  return fc.oneof(...choices);
};

describe("C-AI-RF4 model output that is JSON but wrong", () => {
  it("C-AI-RF4 property, 300 runs: readReply and parseOutput never throw and never return ok for a mutation that breaks a rule", () => {
    const seen = new Set<string>();
    fc.assert(
      fc.property(
        fc
          .constantFrom(...VALID)
          .chain(([feature, output]) =>
            fc.tuple(fc.constant(feature), fc.constant(output), mutationArb(output)),
          ),
        ([feature, output, mutation]) => {
          const input = INPUTS[feature] as never;
          seen.add(mutation.name.split(" ")[0] ?? "");
          if (mutation.kind === "value") {
            const checked = parseOutput(feature, input, mutation.value);
            expect(checked.ok, mutation.name).toBe(false);
            const reply = readReply(feature, input, ok200(JSON.stringify(mutation.value)));
            expect(reply, mutation.name).toStrictEqual({
              ok: false,
              kind: checked.ok ? "ok" : checked.kind,
              content: JSON.stringify(mutation.value),
              usage: READ_USAGE,
            });
            return;
          }
          expect(parseOutput(feature, input, mutation.content).ok, mutation.name).toBe(false);
          const reply = readReply(feature, input, ok200(mutation.content));
          if (mutation.heals) {
            expect(reply, mutation.name).toStrictEqual({
              ok: true,
              output: parsed(feature, output),
              content: mutation.content,
              usage: READ_USAGE,
            });
          } else {
            expect(reply.ok, mutation.name).toBe(false);
            expect(["empty", "json"], mutation.name).toContain(reply.ok ? "ok" : reply.kind);
          }
        },
      ),
      { numRuns: 300, seed: 4002 },
    );
    for (const name of ["wrong", "extra", "color", "number", "fence", "cut", "prose"]) {
      expect([...seen], name).toContain(name);
    }
  });
});
