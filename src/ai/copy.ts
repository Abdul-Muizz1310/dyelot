import { assertOneOf, assertRecord, assertString } from "./assert";
import { isFreeSlug } from "./cascade";
import { AI_FEATURES, type AiFeature } from "./features";
import type { AiPath, RouteCode } from "./route-reply";

// The AI layer's labels and sentences (docs/specs/04-ai.md, R4-30, R4-57 and section 10.3), word for
// word. "AI" appears only in the shared route's name; a rule-based label says "(no model)".

export type ProviderFailure =
  | { readonly provider: "on-device"; readonly reason: "unavailable" | "not-downloaded" | "failed" }
  | { readonly provider: "visitor-key"; readonly reason: "refused" | "no-models" | "failed" }
  | { readonly provider: "shared"; readonly reason: RouteCode | "unreachable" | "invalid" };

type Provider = AiPath["provider"];

/** The providers in the router's order (R4-30): a failure hands on only to a later one. */
const ORDER: readonly Provider[] = ["on-device", "visitor-key", "shared", "rules"];
/** The text features, the only ones the on-device model runs (R4-31). */
const ON_DEVICE_FEATURES: readonly AiFeature[] = ["brief", "refine", "rationale", "critique"];

const RULE_LABELS: Readonly<Record<AiFeature, string>> = {
  brief: "the word list (no model)",
  refine: "the steer words (no model)",
  vibe: "the image's colors (no model)",
  rationale: "the preset's text (no model)",
  critique: "the findings list (no model)",
};

/** `<verb>` of 10.3. */
const VERBS: Readonly<Record<AiFeature, string>> = {
  brief: "read the brief",
  refine: "read the request",
  vibe: "read the image",
  rationale: "write the rationale",
  critique: "rank the findings",
};

/** `<next>` of 10.3 for the rules, per feature. */
const RULE_NEXT: Readonly<Record<AiFeature, string>> = {
  brief: "the word list",
  refine: "the steer words",
  vibe: "the image's colors",
  rationale: "the preset's text",
  critique: "the findings list",
};

const ON_DEVICE: Readonly<Record<string, (verb: string) => string>> = {
  unavailable: () => "Chrome's built-in model is not available on this device",
  "not-downloaded": () => "Chrome's built-in model is not downloaded yet",
  failed: (verb) => `Chrome's built-in model could not ${verb}`,
};

const VISITOR_KEY: Readonly<Record<string, (verb: string) => string>> = {
  refused: () => "OpenRouter refused your key",
  "no-models": () => "Your OpenRouter key has no free model to use here",
  failed: (verb) => `Your OpenRouter key's models could not ${verb}`,
};

const UNREACHED = () => "The shared quota could not be reached";

/** Every route code has its sentence: a new code fails this record's type. */
const SHARED: Readonly<Record<RouteCode | "unreachable" | "invalid", (verb: string) => string>> = {
  "not-configured": () => "The shared quota is off here",
  "forbidden-origin": () => "The shared quota refused this page's address",
  busy: () => "The shared quota is busy with another request",
  "visitor-cap": () => "You have used today's 3 shared actions",
  "pool-low": () => "The shared quota is nearly used up for today",
  "guard-unavailable": () => "The shared quota could not be checked",
  "all-tiers-failed": (verb) => `The shared quota's models could not ${verb}`,
  unreachable: UNREACHED,
  invalid: UNREACHED,
  "bad-request": UNREACHED,
  "too-large": UNREACHED,
  "unknown-feature": UNREACHED,
};

const REASONS: Readonly<
  Record<ProviderFailure["provider"], Readonly<Record<string, (verb: string) => string>>>
> = {
  "on-device": ON_DEVICE,
  "visitor-key": VISITOR_KEY,
  shared: SHARED,
};

/** The label of a path, checked for `caller`. */
function label(path: AiPath, feature: AiFeature, caller: string): string {
  assertRecord(path, `${caller}: path`);
  assertOneOf(path.provider, ORDER, `${caller}: path.provider`);
  assertOneOf(feature, AI_FEATURES, `${caller}: feature`);
  if (path.provider === "on-device") return "Chrome's built-in model";
  if (path.provider === "rules") return RULE_LABELS[feature];
  assertString(path.slug, `${caller}: path.slug`);
  if (!isFreeSlug(path.slug)) {
    throw new RangeError(
      `${caller}: path.slug must be a free slug, got ${JSON.stringify(path.slug)}`,
    );
  }
  return path.provider === "shared"
    ? `dyelot's shared AI (${path.slug})`
    : `your OpenRouter key (${path.slug})`;
}

/** What made a result, as R4-57 names it: "Chrome's built-in model", "the word list (no model)" … */
export function providerLabel(path: AiPath, feature: AiFeature): string {
  return label(path, feature, "providerLabel");
}

/** The result's line: "Made with <label>." */
export function madeWith(path: AiPath, feature: AiFeature): string {
  return `Made with ${label(path, feature, "madeWith")}.`;
}

/**
 * The sentence of section 10.3 for a provider that failed, naming what dyelot used next: a later
 * provider of the router's order. On-device runs only the text features, so it never fails for vibe.
 */
export function failureSentence(
  failure: ProviderFailure,
  feature: AiFeature,
  next: Provider,
): string {
  assertRecord(failure, "failureSentence: failure");
  assertOneOf(
    failure.provider,
    ["on-device", "visitor-key", "shared"] as const,
    "failureSentence: failure.provider",
  );
  const reasons = REASONS[failure.provider];
  assertOneOf(failure.reason, Object.keys(reasons), "failureSentence: failure.reason");
  assertOneOf(feature, AI_FEATURES, "failureSentence: feature");
  assertOneOf(next, ORDER, "failureSentence: next");
  if (ORDER.indexOf(next) <= ORDER.indexOf(failure.provider)) {
    throw new RangeError(
      `failureSentence: next must come after "${failure.provider}", got ${JSON.stringify(next)}`,
    );
  }
  if (failure.provider === "on-device" && !ON_DEVICE_FEATURES.includes(feature)) {
    throw new RangeError(`failureSentence: the on-device model never runs ${feature}`);
  }
  const used =
    next === "visitor-key"
      ? "your OpenRouter key"
      : next === "shared"
        ? "its shared quota"
        : RULE_NEXT[feature];
  const sentence = reasons[failure.reason];
  return `${sentence(VERBS[feature])}, so dyelot used ${used}.`;
}
