import { InMemorySpanExporter, type ReadableSpan } from "@opentelemetry/sdk-trace-base";
import { describe, expect, it } from "vitest";
import { createLangfuseTracer } from "@/server/ai/langfuse";
import { TEXT_SLUGS } from "../ai/fixtures";
import { INPUTS, OUTPUTS } from "./support";

// C-TRACE-01 of docs/specs/04-ai.md, section 14.7, for the Langfuse tracer (R4-52, R4-60, section
// 11.6): 11.6's fields as its spans carry them, read back from an in-memory exporter, so no test
// reaches Langfuse. The handler's side of C-TRACE-01 and C-TRACE-02 is in trace.test.ts.

const BRIEF_CONTENT = JSON.stringify(OUTPUTS.brief);

/** Every span the exporter received, by name. */
function byName(spans: readonly ReadableSpan[], name: string): ReadableSpan[] {
  return spans.filter((span) => span.name === name);
}

describe("C-TRACE-01 the Langfuse tracer writes 11.6's fields onto its spans", () => {
  const TRACING = {
    publicKey: "pk-lf-test-public",
    secretKey: "sk-lf-test-secret-0123456789",
    baseUrl: "https://us.cloud.langfuse.com",
    environment: "test",
  };

  it("C-TRACE-01 one trace span with its name, tags, environment, input and output, and one generation per attempt under it", async () => {
    const exporter = new InMemorySpanExporter();
    const tracer = createLangfuseTracer(TRACING, exporter);
    const action = tracer.action("read-brief", {
      feature: "brief",
      environment: "test",
      input: INPUTS.brief,
    });
    action.generation({
      tier: "primary",
      slug: TEXT_SLUGS[0],
      messages: [{ role: "user", content: "x" }],
      reply: null,
      usage: null,
      failure: { kind: "http", status: 500 },
      startMs: 1_793_880_000_000,
      endMs: 1_793_880_000_250,
    });
    action.generation({
      tier: "fast",
      slug: TEXT_SLUGS[1],
      messages: [{ role: "user", content: "x" }],
      reply: BRIEF_CONTENT,
      usage: { prompt: 100, completion: 20, cached: 10, reasoning: 5, cost: 0 },
      failure: null,
      startMs: 1_793_880_000_300,
      endMs: 1_793_880_000_900,
    });
    action.end({ outcome: "ok", tier: "fast" });
    await tracer.flush();
    const spans = exporter.getFinishedSpans();
    const [root] = byName(spans, "read-brief");
    const generations = byName(spans, "call-openrouter");
    expect(root).toBeDefined();
    expect(generations).toHaveLength(2);
    const attributes = root?.attributes ?? {};
    expect(attributes["langfuse.trace.name"]).toBe("read-brief");
    expect(attributes["langfuse.trace.tags"]).toEqual(["dyelot", "brief"]);
    expect(attributes["langfuse.environment"]).toBe("test");
    expect(JSON.parse(String(attributes["langfuse.trace.input"]))).toEqual(INPUTS.brief);
    expect(JSON.parse(String(attributes["langfuse.trace.output"]))).toEqual({
      outcome: "ok",
      tier: "fast",
    });
    const [failed, answered] = generations;
    for (const generation of generations) {
      expect(generation.parentSpanContext?.spanId).toBe(root?.spanContext().spanId);
      expect(generation.spanContext().traceId).toBe(root?.spanContext().traceId);
      expect(generation.attributes["langfuse.observation.type"]).toBe("generation");
      expect(generation.attributes["langfuse.environment"]).toBe("test");
    }
    expect(failed?.attributes["langfuse.observation.model.name"]).toBe(TEXT_SLUGS[0]);
    expect(failed?.attributes["langfuse.observation.level"]).toBe("ERROR");
    expect(failed?.attributes["langfuse.observation.status_message"]).toBe("http");
    // The SDK writes each metadata value as JSON, one attribute per key.
    const metadata = (span: ReadableSpan | undefined, key: string) =>
      JSON.parse(String(span?.attributes[`langfuse.observation.metadata.${key}`]));
    expect(metadata(failed, "tier")).toBe("primary");
    expect(metadata(failed, "status")).toBe(500);
    expect(metadata(answered, "tier")).toBe("fast");
    expect(answered?.attributes["langfuse.observation.metadata.status"]).toBeUndefined();
    expect(failed?.startTime).toEqual([1_793_880_000, 0]);
    expect(failed?.endTime).toEqual([1_793_880_000, 250_000_000]);
    expect(answered?.attributes["langfuse.observation.output"]).toBe(BRIEF_CONTENT);
    expect(JSON.parse(String(answered?.attributes["langfuse.observation.usage_details"]))).toEqual({
      input: 90,
      input_cached_tokens: 10,
      output: 15,
      output_reasoning_tokens: 5,
    });
    expect(JSON.parse(String(answered?.attributes["langfuse.observation.cost_details"]))).toEqual({
      total: 0,
    });
    expect(answered?.attributes["langfuse.observation.level"]).toBeUndefined();
    expect(JSON.stringify(spans.map((span) => span.attributes))).not.toContain(TRACING.secretKey);
  });
});
