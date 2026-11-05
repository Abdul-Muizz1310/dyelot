import { describe, expect, it } from "vitest";
import { AI_FEATURES, type AiFeature, briefInput, buildChatRequest } from "@/ai";
import { type AiDeps, handleAi } from "@/server/ai/handle";
import {
  type GenerationRecord,
  generationFields,
  NO_TRACER,
  TRACE_NAMES,
  traceInput,
  traceMessages,
} from "@/server/ai/trace";
import { TEST_KEY, TEST_SECRET, TEXT_SLUGS, TODAY, VISION_SLUGS } from "../ai/fixtures";
import {
  BASE,
  capValue,
  chatAnswer,
  fakeTracer,
  held,
  INPUTS,
  keyAnswer,
  makeDeps,
  OUTPUTS,
  post,
  read,
  recordingFetch,
  SITE_ORIGIN,
  settled,
  statusAnswer,
  TRACING_ENV,
} from "./support";

// C-TRACE-01 and C-TRACE-02 of docs/specs/04-ai.md, section 14.7: what a trace holds (R4-52, section
// 11.6) and how the handler makes, ends and flushes it, through a fake tracer. langfuse.test.ts reads
// the Langfuse tracer's spans back.

const USAGE = {
  prompt_tokens: 100,
  completion_tokens: 20,
  prompt_tokens_details: { cached_tokens: 10 },
  completion_tokens_details: { reasoning_tokens: 5 },
  cost: 0.002,
};
const BRIEF_CONTENT = JSON.stringify(OUTPUTS.brief);
const COOKIE = `dyelot_ai=${capValue(TODAY, 1)}`;

/** The bytes a data URL's base64 decodes to, by node's Buffer. */
const decodedLength = (dataUrl: string) =>
  Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64").length;

/** A deps with tracing on and a fake tracer behind `tracerFor`. */
function traced(
  script: Parameters<typeof recordingFetch>[0],
  throwAt?: Parameters<typeof fakeTracer>[0],
  overrides: Partial<AiDeps> = {},
) {
  const recording = recordingFetch(script);
  const fake = fakeTracer(throwAt);
  const made = makeDeps({
    env: TRACING_ENV,
    fetch: recording.fetch,
    tracerFor: () => fake.tracer,
    ...overrides,
  });
  return { ...made, recording, fake };
}

describe("C-TRACE-01 what a trace holds", () => {
  it("C-TRACE-01 an action that reaches the cascade makes one trace named by its feature, tagged by the attributes", async () => {
    const context = traced({ key: [keyAnswer(50)], chat: [chatAnswer(BRIEF_CONTENT, USAGE)] });
    await handleAi("brief", post("brief", INPUTS.brief), context.deps);
    expect(context.fake.actions).toHaveLength(1);
    const [action] = context.fake.actions;
    expect(action?.name).toBe("read-brief");
    expect(action?.attributes).toEqual({
      feature: "brief",
      environment: "test",
      input: INPUTS.brief,
    });
    expect(action?.ends).toEqual([{ outcome: "ok", tier: "primary" }]);
  });

  it("C-TRACE-01 names each feature's trace as R4-52 does", () => {
    expect(TRACE_NAMES).toEqual({
      brief: "read-brief",
      refine: "refine-design",
      vibe: "read-image-vibe",
      rationale: "write-rationale",
      critique: "critique-findings",
    });
    expect(Object.isFrozen(TRACE_NAMES)).toBe(true);
  });

  it("C-TRACE-01 each feature's action is traced under its name", async () => {
    for (const feature of AI_FEATURES) {
      const answer = chatAnswer(JSON.stringify(OUTPUTS[feature]));
      const context = traced({ key: [keyAnswer(50)], chat: [answer] });
      await handleAi(feature, post(feature, INPUTS[feature]), context.deps);
      expect(
        context.fake.actions.map((action) => action.name),
        feature,
      ).toEqual([TRACE_NAMES[feature]]);
    }
  });

  it("C-TRACE-01 makes one generation per chat attempt with the slug, the messages, the reply, the usage and the failure", async () => {
    const context = traced({
      key: [keyAnswer(50)],
      chat: [statusAnswer(500), chatAnswer("not json", USAGE), chatAnswer(BRIEF_CONTENT, USAGE)],
    });
    await handleAi("brief", post("brief", INPUTS.brief), context.deps);
    const generations = context.fake.actions[0]?.generations as GenerationRecord[];
    expect(
      generations.map(({ tier, slug, reply, failure }) => ({ tier, slug, reply, failure })),
    ).toEqual([
      { tier: "primary", slug: TEXT_SLUGS[0], reply: null, failure: { kind: "http", status: 500 } },
      { tier: "fast", slug: TEXT_SLUGS[1], reply: "not json", failure: { kind: "json" } },
      { tier: "fallback", slug: TEXT_SLUGS[2], reply: BRIEF_CONTENT, failure: null },
    ]);
    expect(generations.map((generation) => generation.usage)).toEqual([
      null,
      { prompt: 100, completion: 20, cached: 10, reasoning: 5, cost: 0.002 },
      { prompt: 100, completion: 20, cached: 10, reasoning: 5, cost: 0.002 },
    ]);
    const bodies = context.recording.chatCalls().map((call) => String(call.init.body));
    expect(generations.map((generation) => generation.messages)).toEqual(
      bodies.map((body) => traceMessages(body)),
    );
    expect(context.fake.actions[0]?.ends).toEqual([{ outcome: "ok", tier: "fallback" }]);
  });

  it("C-TRACE-01 times each generation from the clock around its call", async () => {
    let time = 1_793_880_000_000;
    const now = () => {
      time += 10;
      return time;
    };
    const context = traced(
      { key: [keyAnswer(50)], chat: [statusAnswer(500), chatAnswer(BRIEF_CONTENT)] },
      undefined,
      { now },
    );
    await handleAi("brief", post("brief", INPUTS.brief), context.deps);
    const generations = context.fake.actions[0]?.generations ?? [];
    expect(generations).toHaveLength(2);
    for (const generation of generations) {
      expect(generation.endMs).toBeGreaterThan(generation.startMs);
    }
    expect((generations[1] as GenerationRecord).startMs).toBeGreaterThanOrEqual(
      (generations[0] as GenerationRecord).endMs,
    );
  });

  it("C-TRACE-01 ends with all-tiers-failed when every tier failed", async () => {
    const context = traced({
      key: [keyAnswer(50)],
      chat: [statusAnswer(500), statusAnswer(502), statusAnswer(429)],
    });
    await handleAi("brief", post("brief", INPUTS.brief), context.deps);
    expect(context.fake.actions[0]?.generations).toHaveLength(3);
    expect(context.fake.actions[0]?.ends).toEqual([{ outcome: "all-tiers-failed" }]);
  });

  it("C-TRACE-01 a vibe image is { type: image, bytes, width, height } in the trace input and the messages, with no data URL anywhere", async () => {
    const context = traced({
      key: [keyAnswer(50)],
      chat: [chatAnswer(JSON.stringify(OUTPUTS.vibe), USAGE)],
    });
    await handleAi("vibe", post("vibe", INPUTS.vibe), context.deps);
    const image = {
      type: "image",
      bytes: decodedLength(INPUTS.vibe.image.dataUrl),
      width: INPUTS.vibe.image.width,
      height: INPUTS.vibe.image.height,
    };
    const [action] = context.fake.actions;
    expect(action?.name).toBe("read-image-vibe");
    expect(action?.attributes.input).toEqual({ clusters: INPUTS.vibe.clusters, image });
    const messages = action?.generations[0]?.messages as { content: unknown }[];
    expect(messages[1]?.content).toEqual([expect.objectContaining({ type: "text" }), image]);
    expect(JSON.stringify(context.fake.actions)).not.toContain("data:");
    expect(JSON.stringify(context.fake.actions)).not.toContain("base64");
  });

  it("C-TRACE-01 the tracer never sees the server key, the cookie or the cookie secret", async () => {
    const context = traced({
      key: [keyAnswer(50)],
      chat: [statusAnswer(500), chatAnswer(BRIEF_CONTENT, USAGE)],
    });
    await handleAi("brief", post("brief", INPUTS.brief, { cookie: COOKIE }), context.deps);
    const seen = JSON.stringify(context.fake.actions);
    for (const secret of [TEST_KEY, TEST_SECRET, capValue(TODAY, 1), capValue(TODAY, 2)]) {
      expect(seen).not.toContain(secret);
    }
    expect(seen).not.toContain(TRACING_ENV.LANGFUSE_SECRET_KEY);
  });

  it("C-TRACE-01 generationFields splits the usage into 11.6's exclusive buckets and names the cost", () => {
    const fields = generationFields({
      tier: "fast",
      slug: TEXT_SLUGS[1],
      messages: [{ role: "user", content: "x" }],
      reply: BRIEF_CONTENT,
      usage: { prompt: 100, completion: 20, cached: 10, reasoning: 5, cost: 0.002 },
      failure: null,
      startMs: 1,
      endMs: 2,
    });
    expect(fields).toEqual({
      model: TEXT_SLUGS[1],
      input: [{ role: "user", content: "x" }],
      output: BRIEF_CONTENT,
      usageDetails: { input: 90, input_cached_tokens: 10, output: 15, output_reasoning_tokens: 5 },
      costDetails: { total: 0.002 },
      metadata: { tier: "fast" },
    });
  });

  it("C-TRACE-01 generationFields marks a failure ERROR with its kind, and a status in the metadata for http", () => {
    const record: GenerationRecord = {
      tier: "primary",
      slug: TEXT_SLUGS[0],
      messages: [],
      reply: null,
      usage: null,
      failure: { kind: "http", status: 503 },
      startMs: 1,
      endMs: 2,
    };
    expect(generationFields(record)).toEqual({
      model: TEXT_SLUGS[0],
      input: [],
      output: null,
      metadata: { tier: "primary", status: 503 },
      level: "ERROR",
      statusMessage: "http",
    });
    expect(generationFields({ ...record, failure: { kind: "range" }, reply: "x" })).toMatchObject({
      output: "x",
      metadata: { tier: "primary" },
      level: "ERROR",
      statusMessage: "range",
    });
  });

  it("C-TRACE-01 clamps each usage bucket at 0, as readReply keeps negative numbers as sent", () => {
    const fields = generationFields({
      tier: "fast",
      slug: TEXT_SLUGS[1],
      messages: [],
      reply: null,
      usage: { prompt: 5, completion: -2, cached: 10, reasoning: -1, cost: -0.5 },
      failure: { kind: "empty" },
      startMs: 1,
      endMs: 2,
    });
    expect(fields.usageDetails).toEqual({
      input: 0,
      input_cached_tokens: 10,
      output: 0,
      output_reasoning_tokens: 0,
    });
    expect(fields.costDetails).toEqual({ total: 0 });
  });

  it("C-TRACE-01 generationFields refuses what is not a record", () => {
    expect(() => generationFields(null as never)).toThrow(TypeError);
    expect(() => generationFields(null as never)).toThrow(/^generationFields: /);
  });

  it("C-TRACE-01 traceMessages gives a brief body's two messages as sent", () => {
    const request = buildChatRequest({
      feature: "brief",
      input: INPUTS.brief,
      slug: TEXT_SLUGS[0],
      baseUrl: BASE,
      apiKey: TEST_KEY,
      referer: SITE_ORIGIN,
    });
    const body = JSON.parse(request.body);
    expect(traceMessages(request.body)).toEqual(body.messages);
    expect(JSON.stringify(traceMessages(request.body))).not.toContain(TEST_KEY);
  });

  it("C-TRACE-01 traceMessages turns a vibe image part into { type: image, bytes, width, height }", () => {
    const request = buildChatRequest({
      feature: "vibe",
      input: INPUTS.vibe,
      slug: VISION_SLUGS[0],
      baseUrl: BASE,
      apiKey: TEST_KEY,
      referer: SITE_ORIGIN,
    });
    const messages = traceMessages(request.body, { width: 2, height: 2 }) as {
      role: string;
      content: unknown;
    }[];
    const sent = JSON.parse(request.body).messages;
    expect(messages[0]).toEqual(sent[0]);
    expect(messages[1]?.content).toEqual([
      sent[1].content[0],
      { type: "image", bytes: decodedLength(INPUTS.vibe.image.dataUrl), width: 2, height: 2 },
    ]);
    expect(JSON.stringify(messages)).not.toContain("data:image");
  });

  it("C-TRACE-01 counts the bytes of a padded, an unpadded and a longer image", () => {
    for (const payload of ["/9j/4A==", "/9j/4AAQ", "/9j/4AA=", "/9j/4AAQSk"]) {
      const body = JSON.stringify({
        messages: [
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${payload}` } },
            ],
          },
        ],
      });
      const messages = traceMessages(body, { width: 1, height: 1 }) as {
        content: { bytes: number }[];
      }[];
      expect(messages[0]?.content[0]?.bytes, payload).toBe(Buffer.from(payload, "base64").length);
    }
  });

  it("C-TRACE-01 traceMessages refuses a body that is not a request's, and an image part with no size", () => {
    expect(() => traceMessages(5 as never)).toThrow(TypeError);
    expect(() => traceMessages(5 as never)).toThrow(/^traceMessages: body /);
    expect(() => traceMessages("{")).toThrow(RangeError);
    expect(() => traceMessages('{"messages":{}}')).toThrow(/^traceMessages: /);
    const vibe = JSON.stringify({
      messages: [
        {
          role: "user",
          content: [{ type: "image_url", image_url: { url: "data:image/jpeg;base64,AAAA" } }],
        },
      ],
    });
    expect(() => traceMessages(vibe)).toThrow(RangeError);
    expect(() => traceMessages(vibe, { width: 0, height: 2 })).toThrow(RangeError);
    expect(() => traceMessages(vibe, { width: "2", height: 2 } as never)).toThrow(TypeError);
    const remote = vibe.replace("data:image/jpeg;base64,AAAA", "https://x.test/a.jpg");
    expect(() => traceMessages(remote, { width: 2, height: 2 })).toThrow(/^traceMessages: /);
  });

  it("C-TRACE-01 traceInput keeps a text feature's input and sizes a vibe image", () => {
    expect(traceInput("brief", INPUTS.brief)).toEqual(INPUTS.brief);
    expect(traceInput("critique", INPUTS.critique)).toEqual(INPUTS.critique);
    expect(traceInput("vibe", INPUTS.vibe)).toEqual({
      clusters: INPUTS.vibe.clusters,
      image: {
        type: "image",
        bytes: decodedLength(INPUTS.vibe.image.dataUrl),
        width: 2,
        height: 2,
      },
    });
    expect(() => traceInput("poem" as AiFeature, INPUTS.brief)).toThrow(/^traceInput: /);
  });

  it("C-TRACE-01 NO_TRACER makes nothing and flushes at once", async () => {
    const action = NO_TRACER.action("read-brief", {
      feature: "brief",
      environment: "x",
      input: {},
    });
    expect(() => action.generation({} as never)).not.toThrow();
    expect(() => action.end({ outcome: "ok" })).not.toThrow();
    await expect(NO_TRACER.flush()).resolves.toBeUndefined();
    expect(Object.isFrozen(NO_TRACER)).toBe(true);
  });
});

describe("C-TRACE-02 when a trace is made, ended and flushed", () => {
  it("C-TRACE-02 after is called before the first fetch, with a promise that waits for the reply, then flushes", async () => {
    const hold = held();
    let aftersAtFirstFetch = -1;
    const context = traced({
      key: [
        (call) => {
          aftersAtFirstFetch = context.afters.length;
          return keyAnswer(50)(call);
        },
      ],
      chat: [hold.answer],
    });
    const pending = handleAi("brief", post("brief", INPUTS.brief), context.deps);
    const call = await hold.called;
    expect(aftersAtFirstFetch).toBe(1);
    const task = context.afters[0] as Promise<unknown>;
    expect(await settled(task)).toBe(false);
    expect(context.fake.counts.flushes).toBe(0);
    hold.release(await chatAnswer(BRIEF_CONTENT)(call));
    expect((await pending).status).toBe(200);
    await task;
    expect(context.fake.counts.flushes).toBe(1);
    expect(context.afters).toHaveLength(1);
  });

  it.each([
    ["a 404", "poem", {}, {}],
    ["a 403", "brief", {}, { origin: null }],
    ["a 429", "brief", {}, { cookie: `dyelot_ai=${capValue(TODAY, 3)}` }],
    ["a first-read pool-low", "brief", { key: [keyAnswer(37)] }, {}],
    ["a first-read guard-unavailable", "brief", { key: [statusAnswer(500)] }, {}],
  ] as const)(
    "C-TRACE-02 %s makes no trace and flushes nothing",
    async (_, feature, script, options) => {
      const context = traced(script);
      await handleAi(feature, post(feature, INPUTS.brief, options), context.deps);
      expect(context.fake.actions).toEqual([]);
      expect(context.afters).toHaveLength(1);
      await context.afters[0];
      expect(context.fake.counts.flushes).toBe(0);
    },
  );

  it("C-TRACE-02 a cache hit makes no trace", async () => {
    const context = traced({ key: [keyAnswer(50)], chat: [chatAnswer(BRIEF_CONTENT)] });
    await handleAi("brief", post("brief", INPUTS.brief), context.deps);
    expect(context.fake.actions).toHaveLength(1);
    const hit = await handleAi("brief", post("brief", INPUTS.brief), context.deps);
    expect(hit.status).toBe(200);
    expect(context.fake.actions).toHaveLength(1);
  });

  it.each(["action", "generation", "end", "flush"] as const)(
    "C-TRACE-02 a tracer whose %s throws leaves every reply byte for byte the same and logs once per instance",
    async (step) => {
      const script = () => ({
        key: [keyAnswer(50), keyAnswer(50)],
        chat: [statusAnswer(500), chatAnswer(BRIEF_CONTENT, USAGE), chatAnswer(BRIEF_CONTENT)],
      });
      const calm = traced(script());
      const broken = traced(script(), step);
      const briefs = [INPUTS.brief, briefInput("A second brief, for the second action", {})];
      for (const brief of briefs) {
        const want = await read(
          await handleAi("brief", post("brief", brief, { cookie: COOKIE }), calm.deps),
        );
        const got = await read(
          await handleAi("brief", post("brief", brief, { cookie: COOKIE }), broken.deps),
        );
        expect(got.status).toBe(want.status);
        expect([...got.headers]).toEqual([...want.headers]);
        expect(got.text).toBe(want.text);
      }
      await Promise.all(broken.afters);
      expect(broken.lines).toEqual([`dyelot ai: tracing failed (${step}).`]);
      expect(calm.lines).toEqual([]);
    },
  );

  it("C-TRACE-02 a tracerFor that throws is logged as the action step, and the reply stands", async () => {
    const recording = recordingFetch({ key: [keyAnswer(50)], chat: [chatAnswer(BRIEF_CONTENT)] });
    const { deps, lines, afters } = makeDeps({ env: TRACING_ENV, fetch: recording.fetch });
    const reply = await handleAi("brief", post("brief", INPUTS.brief), deps);
    expect(reply.status).toBe(200);
    await Promise.all(afters);
    expect(lines).toEqual(["dyelot ai: tracing failed (action)."]);
  });

  it("C-TRACE-02 with tracing off, NO_TRACER is used: tracerFor is never called", async () => {
    const recording = recordingFetch({ key: [keyAnswer(50)], chat: [chatAnswer(BRIEF_CONTENT)] });
    const { deps, tracings, lines, afters } = makeDeps({ fetch: recording.fetch });
    const reply = await handleAi("brief", post("brief", INPUTS.brief), deps);
    expect(reply.status).toBe(200);
    await Promise.all(afters);
    expect(tracings).toEqual([]);
    expect(lines).toEqual([]);
  });

  it("C-TRACE-02 tracerFor gets the tracing settings of the environment", async () => {
    const context = traced({ key: [keyAnswer(50)], chat: [chatAnswer(BRIEF_CONTENT)] });
    let given: unknown;
    context.deps = {
      ...context.deps,
      tracerFor: (tracing) => {
        given = tracing;
        return context.fake.tracer;
      },
    };
    await handleAi("brief", post("brief", INPUTS.brief), context.deps);
    expect(given).toEqual({
      publicKey: TRACING_ENV.LANGFUSE_PUBLIC_KEY,
      secretKey: TRACING_ENV.LANGFUSE_SECRET_KEY,
      baseUrl: TRACING_ENV.LANGFUSE_BASE_URL,
      environment: "test",
    });
  });
});
