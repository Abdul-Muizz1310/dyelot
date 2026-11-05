import type { AiFeature, AiPath, FeatureInput, FeatureOutput, ProviderFailure } from "@/ai";
import type { AiActivity } from "@/features/ai/activity";
import { type AiModule, assertFunction, checkAsk } from "@/features/ai/load";
import { askOnDevice } from "@/features/ai/on-device";
import type { ProviderStep } from "@/features/ai/router";
import { askShared } from "@/features/ai/shared";
import { askWithKey, fetchModels, readKey, type Stores } from "@/features/ai/visitor-key";
import { type StorageLike, safeStorage } from "@/features/studio/drafts";
import { assertRecord, assertString, describeType, isRecord } from "@/features/studio/guards";
import type { CreatedWith } from "@/spec";

// The step planner (docs/specs/04-ai.md, section 10.1, R4-30, R4-36 and 5.6's closing note): the
// router's steps for one action in R4-30's order, with 10.1's skips. The on-device step is planned
// only when the switch is on, the Prompt API is there and the feature is a text one (vibe never
// runs on the device, R4-31); the key's step only when a key is stored; the shared step always.
// A provider that is on but cannot run still has its step, which fails at once with its sentence.
// The router cannot see the feature, so the skips are made here, and `failureSentence` is only ever
// asked for the combinations it allows (controller carry on Task 4.9).

/** What the steps reach the browser through; the tests inject each. */
export type StepDeps = {
  /** `globalThis.LanguageModel`, or undefined where the Prompt API is absent. */
  readonly lm: unknown;
  /** The on-device switch (R4-31). */
  readonly onDevice: boolean;
  readonly stores: Stores;
  readonly fetch: typeof fetch;
  /** The page's origin, sent to OpenRouter as the referer of the key's calls. */
  readonly referer: string;
  /** Where the shared step records the visitor's remaining actions (R4-35). */
  readonly activity: AiActivity;
};

type Step<F extends AiFeature> = ProviderStep<FeatureOutput[F]>;

function checkDeps(deps: unknown): asserts deps is StepDeps {
  assertRecord(deps, "stepsFor: deps");
  if (typeof deps.onDevice !== "boolean") {
    throw new TypeError(
      `stepsFor: deps.onDevice must be a boolean, got ${describeType(deps.onDevice)}`,
    );
  }
  assertRecord(deps.stores, "stepsFor: deps.stores");
  assertFunction(deps.fetch, "stepsFor: deps.fetch");
  assertString(deps.referer, "stepsFor: deps.referer");
  const { activity } = deps;
  if (!isRecord(activity) || typeof activity.getState !== "function") {
    throw new TypeError(
      `stepsFor: deps.activity must be an AI activity, got ${describeType(activity)}`,
    );
  }
}

/**
 * The router's steps for one action (10.1): on-device when the switch is on, the API is present and
 * the feature is not vibe; the visitor key when one is stored (its models read from
 * `GET /api/ai/models`, none read giving `no-models`); and the shared route, which records the
 * visitor's remaining actions in the activity unless the action was canceled or no reply came.
 */
export function stepsFor<F extends AiFeature>(
  ai: AiModule,
  feature: F,
  input: FeatureInput[F],
  deps: StepDeps,
): readonly Step<F>[] {
  checkAsk(ai, feature, input, "stepsFor");
  checkDeps(deps);
  const { lm, onDevice, stores, fetch: send, referer, activity } = deps;
  const steps: Step<F>[] = [];
  if (onDevice && lm !== undefined && lm !== null && feature !== "vibe") {
    steps.push({
      provider: "on-device",
      async run(signal) {
        const result = await askOnDevice(ai, feature, input, { lm, signal });
        return result.ok
          ? { ok: true, output: result.output, path: { provider: "on-device" } }
          : { ok: false, failure: result.failure };
      },
    });
  }
  const stored = readKey(stores);
  if (stored !== null) {
    steps.push({
      provider: "visitor-key",
      async run(signal) {
        const models = await fetchModels({ fetch: send });
        if (models === null) {
          return { ok: false, failure: { provider: "visitor-key", reason: "no-models" } };
        }
        const result = await askWithKey(ai, feature, input, {
          fetch: send,
          key: stored.key,
          models,
          signal,
          referer,
        });
        return result.ok
          ? { ok: true, output: result.output, path: result.path }
          : { ok: false, failure: result.failure };
      },
    });
  }
  steps.push({
    provider: "shared",
    async run(signal) {
      const result = await askShared(ai, feature, input, { fetch: send, signal });
      const replied = result.ok || result.failure.reason !== "unreachable";
      if (replied && !signal.aborted) {
        const off = !result.ok && result.failure.reason === "not-configured";
        activity.getState().setShared(result.remaining, off);
      }
      return result.ok
        ? { ok: true, output: result.output, path: result.path }
        : { ok: false, failure: result.failure };
    },
  });
  return steps;
}

/** `meta.createdWith` for a model's answer (10.1's last column): the shared route names its slug. */
export function createdWithOf(
  path: Exclude<AiPath, { provider: "rules" }>,
): Exclude<CreatedWith, "controls" | "import"> {
  assertRecord(path, "createdWithOf: path");
  switch (path.provider) {
    case "on-device":
      return "on-device";
    case "visitor-key":
      return "visitor-key";
    case "shared":
      assertString(path.slug, "createdWithOf: path.slug");
      return `model:${path.slug}`;
    default:
      throw new RangeError(
        `createdWithOf: path.provider must be a model's, got ${JSON.stringify((path as AiPath).provider)}`,
      );
  }
}

/**
 * The failure sentences of 10.3, in router order: the sentence for `failures[i]` names, as what
 * dyelot used next, the provider of `failures[i + 1]`, else the one that `answered` (the rules when
 * none did). 5.6's closing note.
 */
export function failureLines(
  ai: AiModule,
  failures: readonly ProviderFailure[],
  feature: AiFeature,
  answered: AiPath["provider"],
): readonly string[] {
  if (!Array.isArray(failures)) {
    throw new TypeError(`failureLines: failures must be an array, got ${describeType(failures)}`);
  }
  return failures.map((failure, i) =>
    ai.failureSentence(failure, feature, failures[i + 1]?.provider ?? answered),
  );
}

/** One of the browser's stores, or null where reading it throws or gives none. */
function store(read: () => unknown): StorageLike | null {
  try {
    const value = read();
    return isRecord(value) && typeof value.getItem === "function" ? (value as StorageLike) : null;
  } catch {
    return null;
  }
}

/** The browser's session and local storage, each null where the browser refuses it. */
export function browserStores(): Stores {
  return { session: store(() => window.sessionStorage), local: safeStorage(window) };
}

/** The steps' deps from this browser: the Prompt API, the switch, the stores, fetch and the origin. */
export function browserDeps(activity: AiActivity): StepDeps {
  return {
    lm: (globalThis as { LanguageModel?: unknown }).LanguageModel,
    onDevice: activity.getState().onDevice,
    stores: browserStores(),
    fetch: (input, init) => globalThis.fetch(input, init),
    referer: window.location.origin,
    activity,
  };
}
