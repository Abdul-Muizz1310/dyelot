import type { AiFeature, FeatureInput } from "@/ai";
import { assertOneOf, describeType, isRecord } from "@/features/studio/guards";

// The AI core's loader (docs/specs/04-ai.md, R4-04 and section 5.6): app code reaches `@/ai` only
// through this `import()`, memoized per page and forgotten when it fails, as `@/export` is loaded
// (R3-38), so the first load of the studio fetches no chunk of src/ai (I-M4-09). The providers take
// the loaded module as an argument and never import it.

/** The `@/ai` entry as `import()` gives it. */
export type AiModule = typeof import("@/ai");

let loading: Promise<AiModule> | null = null;

/** The AI entry, loaded once; a failed load is forgotten so that the next action asks the network again. */
export function loadAi(): Promise<AiModule> {
  loading ??= import("@/ai").catch((error: unknown) => {
    loading = null;
    throw error;
  });
  return loading;
}

/**
 * What every provider is asked, checked (R-05), each error naming `caller`: the loaded module, a
 * feature of `AI_FEATURES` (else a RangeError) and an input its feature's schema accepts (an input
 * that is not an object is a TypeError, any other it rejects a RangeError).
 */
export function checkAsk<F extends AiFeature>(
  ai: AiModule,
  feature: F,
  input: FeatureInput[F],
  caller: string,
): void {
  if (!isRecord(ai)) {
    throw new TypeError(`${caller}: ai must be the @/ai module, got ${describeType(ai)}`);
  }
  assertOneOf(feature, ai.AI_FEATURES, `${caller}: feature`);
  if (!isRecord(input)) {
    throw new TypeError(`${caller}: input must be an object, got ${describeType(input)}`);
  }
  const result = ai.inputSchema(feature).safeParse(input);
  if (!result.success) {
    throw new RangeError(
      `${caller}: input is not a ${feature} input (${result.error.issues[0]?.message})`,
    );
  }
}

/** Whether `value` is an AbortSignal; else a TypeError naming `name`. */
export function assertSignal(value: unknown, name: string): asserts value is AbortSignal {
  if (!(value instanceof AbortSignal)) {
    throw new TypeError(`${name} must be an AbortSignal, got ${describeType(value)}`);
  }
}

/** Whether `value` is a function; else a TypeError naming `name`. */
export function assertFunction(
  value: unknown,
  name: string,
): asserts value is (...args: never[]) => unknown {
  if (typeof value !== "function") {
    throw new TypeError(`${name} must be a function, got ${describeType(value)}`);
  }
}
