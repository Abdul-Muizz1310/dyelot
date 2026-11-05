import { LangfuseSpanProcessor } from "@langfuse/otel";
import {
  LangfuseOtelSpanAttributes,
  setLangfuseTracerProvider,
  startObservation,
} from "@langfuse/tracing";
import { BasicTracerProvider, type SpanExporter } from "@opentelemetry/sdk-trace-base";
import type { TracingEnv } from "./env";
import { GENERATION_NAME, generationFields, type Tracer } from "./trace";

// The Langfuse tracer (docs/specs/04-ai.md, R4-52, R4-60 and section 11.6), the one file that imports
// the tracing packages (R4-05). Its spans go through a `BasicTracerProvider` that only Langfuse's
// tracing uses, with no global registration and no context manager, so each generation names its
// trace span as its parent, and the trace's name, tags, input and output are set on that span itself:
// with no context manager, `propagateAttributes` sets nothing (Task 4.0, probe 6). The processor
// batches; the handler's `after` flushes it once the reply is built.

/**
 * A `Tracer` that sends to Langfuse with `tracing`'s keys, base URL and environment. `exporter`
 * replaces the OTLP exporter, so a test can read the spans back without a network.
 */
export function createLangfuseTracer(tracing: TracingEnv, exporter?: SpanExporter): Tracer {
  const processor = new LangfuseSpanProcessor({
    publicKey: tracing.publicKey,
    secretKey: tracing.secretKey,
    baseUrl: tracing.baseUrl,
    environment: tracing.environment,
    // No data URL ever reaches a span (traceMessages), so there is no media to look for.
    mediaUploadEnabled: false,
    ...(exporter === undefined ? {} : { exporter }),
  });
  setLangfuseTracerProvider(new BasicTracerProvider({ spanProcessors: [processor] }));
  return {
    action(name, { feature, environment, input }) {
      const trace = startObservation(name, { input, environment });
      trace.otelSpan.setAttributes({
        [LangfuseOtelSpanAttributes.TRACE_NAME]: name,
        [LangfuseOtelSpanAttributes.TRACE_TAGS]: ["dyelot", feature],
        [LangfuseOtelSpanAttributes.TRACE_INPUT]: JSON.stringify(input),
      });
      const parentSpanContext = trace.otelSpan.spanContext();
      return {
        generation(record) {
          const generation = startObservation(
            GENERATION_NAME,
            { ...generationFields(record), environment },
            { asType: "generation", startTime: new Date(record.startMs), parentSpanContext },
          );
          generation.end(new Date(record.endMs));
        },
        end(output) {
          trace.update({ output });
          trace.otelSpan.setAttribute(
            LangfuseOtelSpanAttributes.TRACE_OUTPUT,
            JSON.stringify(output),
          );
          trace.end();
        },
      };
    },
    flush: () => processor.forceFlush(),
  };
}
