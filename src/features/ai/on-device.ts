import type { AiFeature, FeatureInput, FeatureOutput, ProviderFailure, TierOutcome } from "@/ai";
import { type AiModule, assertFunction, assertSignal, checkAsk } from "@/features/ai/load";
import type { StorageLike } from "@/features/studio/drafts";
import { assertRecord, describeType, isOneOf, isRecord } from "@/features/studio/guards";

// The on-device provider (docs/specs/04-ai.md, R4-31, DR-0039, section 10.2): Chrome's Prompt API,
// on the main thread only (it is not available in workers). Every call reaches `LanguageModel`
// through the value it is given, never through a global, so the tests drive a fake. The state is
// read in try/catch; a session holds the system message and is destroyed on every path once made;
// the prompt runs under the action's signal joined with a 60,000 ms timeout; the reply is read as
// readReply reads a chat reply (JSON, then parseOutput). Only the four text features run here.

export type OnDeviceState = "absent" | "unavailable" | "downloadable" | "downloading" | "available";

/** The on-device switch, remembered per browser in local storage: on only when it holds "on". */
export const ON_DEVICE_STORAGE = "dyelot:on-device";

type OnDeviceFailure = Extract<ProviderFailure, { provider: "on-device" }>;
export type OnDeviceResult<F extends AiFeature> =
  | { readonly ok: true; readonly output: FeatureOutput[F] }
  | { readonly ok: false; readonly failure: OnDeviceFailure };

/** The answers `availability` may give (R4-31); anything else reads as unavailable. */
const STATES = ["unavailable", "downloadable", "downloading", "available"] as const;
/** The features the on-device model runs: vibe needs image input with a constraint, undocumented. */
const TEXT_FEATURES: readonly AiFeature[] = ["brief", "refine", "rationale", "critique"];
/** The prompt's own deadline, joined with the action's signal (R4-31). */
const PROMPT_TIMEOUT_MS = 60_000;
const SWITCH_ON = "on";

/** The part of a Prompt API session this provider uses. */
type Session = {
  prompt(input: string, options: Record<string, unknown>): unknown;
  destroy(): unknown;
};
/** The part of `LanguageModel` this provider uses. */
type LanguageModelLike = {
  availability?: (options: unknown) => unknown;
  create(options: Record<string, unknown>): unknown;
};

/** R4-31's OPTIONS, a fresh object for each call, so no call can change another's. */
function options(): {
  expectedInputs: { type: "text"; languages: string[] }[];
  expectedOutputs: { type: "text"; languages: string[] }[];
} {
  return {
    expectedInputs: [{ type: "text", languages: ["en"] }],
    expectedOutputs: [{ type: "text", languages: ["en"] }],
  };
}

/** An object or a function (Chrome's `LanguageModel` is a class), whose members can be read. */
function isHost(value: unknown): value is Record<string, unknown> {
  return (typeof value === "object" && value !== null) || typeof value === "function";
}

function isModel(value: unknown): value is LanguageModelLike {
  return isHost(value) && typeof value.create === "function";
}

function isSession(value: unknown): value is Session {
  return isHost(value) && typeof value.prompt === "function" && typeof value.destroy === "function";
}

/** Ends a session; a destroy that throws changes nothing the action already has. */
function end(session: Session): void {
  try {
    session.destroy();
  } catch {
    // The session is gone either way.
  }
}

function checkStorage(value: unknown, name: string): asserts value is StorageLike | null {
  const storage =
    isRecord(value) &&
    typeof value.getItem === "function" &&
    typeof value.setItem === "function" &&
    typeof value.removeItem === "function";
  if (value !== null && !storage) {
    throw new TypeError(`${name} must be a storage or null, got ${describeType(value)}`);
  }
}

/** The on-device model never runs vibe (R4-31): asking for it is a RangeError naming `caller`. */
function checkTextFeature(feature: AiFeature, caller: string): void {
  if (!TEXT_FEATURES.includes(feature)) {
    throw new RangeError(`${caller}: the on-device model never runs ${feature}`);
  }
}

/**
 * The state of Chrome's built-in model (10.2): `absent` without a `LanguageModel`, else what
 * `availability(OPTIONS)` answers, with a throw, a rejection or any other answer read as
 * `unavailable`. `lm` is `globalThis.LanguageModel`, or undefined.
 */
export async function onDeviceState(lm: unknown): Promise<OnDeviceState> {
  if (lm === undefined || lm === null) return "absent";
  try {
    if (!isHost(lm) || typeof lm.availability !== "function") return "unavailable";
    const state: unknown = await lm.availability(options());
    return isOneOf(state, STATES) ? state : "unavailable";
  } catch {
    return "unavailable";
  }
}

/**
 * Runs one session (R4-31) and gives the model's raw reply, throwing on any failure: no
 * `LanguageModel`, a canceled action, a `create` or `prompt` that throws, the 60,000 ms timeout, or
 * a reply that is not text. The session holds `chatMessages(feature, input).system`; the prompt is
 * the user message with `outputJsonSchema` as its constraint, left out of the context
 * (`omitResponseConstraintInput`) because the system message already holds it. The session is
 * destroyed on every path once made, one that arrives after the timeout included. `askOnDevice`
 * and the dev eval page use it.
 */
export async function promptOnDevice<F extends AiFeature>(
  ai: AiModule,
  feature: F,
  input: FeatureInput[F],
  deps: { lm: unknown; signal: AbortSignal },
): Promise<string> {
  checkAsk(ai, feature, input, "promptOnDevice");
  checkTextFeature(feature, "promptOnDevice");
  assertRecord(deps, "promptOnDevice: deps");
  const { lm, signal: action } = deps;
  assertSignal(action, "promptOnDevice: deps.signal");
  if (!isModel(lm)) {
    throw new TypeError(
      `promptOnDevice: lm must be a LanguageModel with create, got ${describeType(lm)}`,
    );
  }
  if (action.aborted) throw new Error("promptOnDevice: the action was canceled");
  const { system, user } = ai.chatMessages(feature, input);
  // Only vibe's user message is a list of parts, and vibe never runs here.
  if (typeof user !== "string") throw new TypeError("promptOnDevice: the user message is not text");
  const responseConstraint = ai.outputJsonSchema(feature, input);

  const controller = new AbortController();
  const { signal } = controller;
  const cancel = () => controller.abort();
  action.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(cancel, PROMPT_TIMEOUT_MS);
  const stopped = new Promise<never>((_, reject) => {
    signal.addEventListener(
      "abort",
      () => reject(new Error("promptOnDevice: the prompt was stopped")),
      { once: true },
    );
  });
  stopped.catch(() => {});
  // A create that throws at once becomes a rejection, like one that fails later.
  const creating = new Promise<unknown>((resolve) => {
    resolve(
      lm.create({ ...options(), initialPrompts: [{ role: "system", content: system }], signal }),
    );
  });
  let session: Session | null = null;
  try {
    const created = await Promise.race([creating, stopped]);
    if (!isSession(created)) throw new TypeError("promptOnDevice: create gave no session");
    session = created;
    const prompting = Promise.resolve(
      created.prompt(user, {
        responseConstraint,
        omitResponseConstraintInput: true,
        signal,
      }),
    );
    prompting.catch(() => {});
    const reply = await Promise.race([prompting, stopped]);
    if (signal.aborted) throw new Error("promptOnDevice: the prompt was stopped");
    if (typeof reply !== "string") throw new TypeError("promptOnDevice: the reply is not text");
    return reply;
  } finally {
    clearTimeout(timer);
    action.removeEventListener("abort", cancel);
    if (session !== null) end(session);
    else
      creating.then(
        (late) => (isSession(late) ? end(late) : undefined),
        () => {},
      );
  }
}

/**
 * The model's text read as readReply reads a chat reply's content (R4-31): one JSON object after
 * trimming and one surrounding code fence, then `parseOutput`. The text rides in a chat body so
 * both readers take the very same steps.
 */
export function readOnDeviceReply<F extends AiFeature>(
  ai: AiModule,
  feature: F,
  input: FeatureInput[F],
  text: string,
): TierOutcome<F> {
  const body = JSON.stringify({ choices: [{ message: { content: text } }] });
  return ai.readReply(feature, input, { status: 200, text: body });
}

const onDeviceFailure = <F extends AiFeature>(
  reason: OnDeviceFailure["reason"],
): OnDeviceResult<F> => ({ ok: false, failure: { provider: "on-device", reason } });

/**
 * One action on Chrome's built-in model (R4-31, 10.2): `unavailable` when the state is `absent` or
 * `unavailable`, `not-downloaded` when it is `downloadable` or `downloading` (both without
 * `create`), and `failed` for anything that goes wrong once a session is asked for: a throw, the
 * timeout, a cancel, or a reply that fails JSON, the schema or a value check.
 */
export async function askOnDevice<F extends AiFeature>(
  ai: AiModule,
  feature: F,
  input: FeatureInput[F],
  deps: { lm: unknown; signal: AbortSignal },
): Promise<OnDeviceResult<F>> {
  checkAsk(ai, feature, input, "askOnDevice");
  checkTextFeature(feature, "askOnDevice");
  assertRecord(deps, "askOnDevice: deps");
  assertSignal(deps.signal, "askOnDevice: deps.signal");
  const state = await onDeviceState(deps.lm);
  if (state === "absent" || state === "unavailable") return onDeviceFailure("unavailable");
  if (state !== "available") return onDeviceFailure("not-downloaded");
  let text: string;
  try {
    text = await promptOnDevice(ai, feature, input, deps);
  } catch {
    return onDeviceFailure("failed");
  }
  const outcome = readOnDeviceReply(ai, feature, input, text);
  return outcome.ok ? { ok: true, output: outcome.output } : onDeviceFailure("failed");
}

/**
 * The download that "Download the model" starts (R4-31): `create` with a monitor that reports each
 * `downloadprogress` fraction from 0 to 1, then the session it made is destroyed. It resolves true
 * once the model is there, and false for a `create` that throws or no `LanguageModel`.
 */
export async function downloadModel(
  lm: unknown,
  deps: { onProgress(fraction: number): void; signal: AbortSignal },
): Promise<boolean> {
  assertRecord(deps, "downloadModel: deps");
  const { onProgress, signal } = deps;
  assertFunction(onProgress, "downloadModel: deps.onProgress");
  assertSignal(signal, "downloadModel: deps.signal");
  if (!isModel(lm)) return false;
  const monitor = (target: unknown) => {
    if (!isHost(target) || typeof target.addEventListener !== "function") return;
    target.addEventListener("downloadprogress", (event: unknown) => {
      const loaded = isHost(event) ? event.loaded : undefined;
      if (typeof loaded === "number" && loaded >= 0 && loaded <= 1) onProgress(loaded);
    });
  };
  try {
    const session: unknown = await lm.create({ ...options(), monitor, signal });
    if (isSession(session)) end(session);
    return true;
  } catch {
    return false;
  }
}

/** Whether the on-device switch is on: only a stored "on" is; a storage that throws reads as off. */
export function readToggle(local: StorageLike | null): boolean {
  checkStorage(local, "readToggle: local");
  try {
    return local?.getItem(ON_DEVICE_STORAGE) === SWITCH_ON;
  } catch {
    return false;
  }
}

/** Writes the switch: "on", or the key removed; a storage that throws is ignored. */
export function writeToggle(local: StorageLike | null, on: boolean): void {
  checkStorage(local, "writeToggle: local");
  if (typeof on !== "boolean") {
    throw new TypeError(`writeToggle: on must be a boolean, got ${describeType(on)}`);
  }
  try {
    if (on) local?.setItem(ON_DEVICE_STORAGE, SWITCH_ON);
    else local?.removeItem(ON_DEVICE_STORAGE);
  } catch {
    // The switch stays as the browser last kept it.
  }
}
