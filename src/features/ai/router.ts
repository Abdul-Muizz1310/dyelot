import type { AiPath, ProviderFailure } from "@/ai";
import { assertSignal } from "@/features/ai/load";
import { assertOneOf, describeType, isRecord } from "@/features/studio/guards";

// The provider router (docs/specs/04-ai.md, R4-30, R4-06, R4-56 and section 10.1): it tries the
// steps it is given in R4-30's order (on-device, the visitor's key, the shared route), stops at the
// first that answers, and keeps every failure in order for its sentence of 10.3; when all fail the
// feature's rules answer. A cancel stops it at once: it does not wait for the running step, runs no
// later one, and gives `canceled`. The caller builds the steps: a provider that is off or not there
// has no step (and no sentence); one that is on but cannot run fails at once without I/O.

export type ProviderStep<O> = {
  readonly provider: "on-device" | "visitor-key" | "shared";
  run(
    signal: AbortSignal,
  ): Promise<{ ok: true; output: O; path: AiPath } | { ok: false; failure: ProviderFailure }>;
};

export type RouterResult<O> =
  | {
      readonly kind: "model";
      readonly output: O;
      readonly path: AiPath;
      readonly failures: readonly ProviderFailure[];
    }
  | { readonly kind: "rules"; readonly failures: readonly ProviderFailure[] }
  | { readonly kind: "canceled" };

type StepResult<O> = Awaited<ReturnType<ProviderStep<O>["run"]>>;

/** R4-30's order; the rules are what the router falls to, never a step. */
const ORDER = ["on-device", "visitor-key", "shared"] as const;
const CANCELED = Object.freeze({ kind: "canceled" } as const);

/** The steps, checked: each a provider of `ORDER` with a `run`, every one after the one before it. */
function checkSteps<O>(steps: unknown): asserts steps is readonly ProviderStep<O>[] {
  if (!Array.isArray(steps)) {
    throw new TypeError(`runProviders: steps must be an array, got ${describeType(steps)}`);
  }
  let last = -1;
  steps.forEach((step: unknown, i) => {
    const at = `runProviders: steps[${i}]`;
    if (!isRecord(step)) throw new TypeError(`${at} must be an object, got ${describeType(step)}`);
    assertOneOf(step.provider, ORDER, `${at}.provider`);
    if (typeof step.run !== "function") {
      throw new TypeError(`${at}.run must be a function, got ${describeType(step.run)}`);
    }
    const index = ORDER.indexOf(step.provider);
    if (index <= last) {
      throw new RangeError(
        `${at}.provider must come after the step before it in R4-30's order, got "${step.provider}"`,
      );
    }
    last = index;
  });
}

/**
 * A step's answer, checked: `{ ok }` with a path or a failure of the step's own provider, so every
 * sentence names the provider that really failed and what came next.
 */
function checkResult<O>(
  result: unknown,
  provider: ProviderStep<O>["provider"],
  i: number,
): asserts result is StepResult<O> {
  const at = `runProviders: steps[${i}]`;
  if (!isRecord(result) || typeof result.ok !== "boolean") {
    throw new TypeError(`${at} must answer { ok: true | false, … }, got ${describeType(result)}`);
  }
  const named = result.ok ? result.path : result.failure;
  const said = isRecord(named) ? named.provider : undefined;
  if (said !== provider) {
    const verb = result.ok ? "answered" : "failed";
    throw new RangeError(`${at} ("${provider}") ${verb} as ${JSON.stringify(said ?? null)}`);
  }
}

/**
 * Runs the steps in order (R4-30) and gives the first answer with the failures before it, `rules`
 * with every failure when none answers, or `canceled` when the signal aborts before or during a step.
 * A step that throws rejects the router, unless the action was canceled: a failure is never hidden.
 */
export async function runProviders<O>(
  steps: readonly ProviderStep<O>[],
  signal: AbortSignal,
): Promise<RouterResult<O>> {
  checkSteps<O>(steps);
  assertSignal(signal, "runProviders: signal");
  // The executor runs at once, so `stop` is set before it is read.
  let stop!: () => void;
  const canceled = new Promise<typeof CANCELED>((resolve) => {
    stop = () => resolve(CANCELED);
  });
  signal.addEventListener("abort", stop, { once: true });
  try {
    const failures: ProviderFailure[] = [];
    for (const [i, step] of steps.entries()) {
      if (signal.aborted) return CANCELED;
      // A run that throws at once rejects like one that fails later; a late rejection is not lost.
      const running = new Promise<unknown>((resolve) => resolve(step.run(signal)));
      running.catch(() => {});
      let result: unknown;
      try {
        result = await Promise.race([running, canceled]);
      } catch (error) {
        if (signal.aborted) return CANCELED;
        throw error;
      }
      // `canceled` answers only once the signal has aborted, and a step that answers in the same
      // moment as a cancel is dropped too.
      if (signal.aborted) return CANCELED;
      checkResult<O>(result, step.provider, i);
      if (result.ok) {
        return { kind: "model", output: result.output, path: result.path, failures: [...failures] };
      }
      failures.push(result.failure);
    }
    // With no step left, or none at all, a cancel still wins over the rules.
    return signal.aborted ? CANCELED : { kind: "rules", failures };
  } finally {
    signal.removeEventListener("abort", stop);
  }
}
