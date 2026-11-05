import { assertOneOf, assertRecord, assertString, describeType } from "./assert";
import { AI_FEATURES, type AiFeature } from "./features";

// The cascade plan (docs/specs/04-ai.md, R4-12 and R4-13): one action tries at most three tiers on
// one provider path, in order, each a free slug from the environment.

/** The text features' tiers and the vision tiers, each in cascade order (not in the entry). */
export const TEXT_TIERS = Object.freeze(["primary", "fast", "fallback"] as const);
export const VISION_TIERS = Object.freeze(["vision-1", "vision-2", "vision-3"] as const);
export type TierName = (typeof TEXT_TIERS)[number] | (typeof VISION_TIERS)[number];
export type Tier = { readonly tier: TierName; readonly slug: string };

const FREE_SLUG = /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*:free$/;
/** So `model:<slug>` fits `meta.createdWith`. */
const SLUG_MAX = 120;

/** Whether `value` is an OpenRouter slug of a free model: `<vendor>/<model>:free`, at most 120 characters. */
export function isFreeSlug(value: string): boolean {
  assertString(value, "isFreeSlug: value");
  return value.length <= SLUG_MAX && FREE_SLUG.test(value);
}

/** A list of one group's tiers: each named from the group, in its order, once, with a free slug. */
function checkGroup(list: unknown, names: readonly TierName[], name: string): readonly Tier[] {
  if (!Array.isArray(list)) {
    throw new TypeError(`cascadePlan: ${name} must be an array, got ${describeType(list)}`);
  }
  let last = -1;
  return list.map((entry: unknown, i) => {
    const at = `cascadePlan: ${name}[${i}]`;
    assertRecord(entry, at);
    assertString(entry.slug, `${at}.slug`);
    assertOneOf(entry.tier, names, `${at}.tier`);
    const index = names.indexOf(entry.tier);
    if (index <= last) {
      throw new RangeError(`${at}.tier must come after the tier before it, got "${entry.tier}"`);
    }
    last = index;
    if (!isFreeSlug(entry.slug)) {
      throw new RangeError(`${at}.slug must be a free slug, got ${JSON.stringify(entry.slug)}`);
    }
    return { tier: entry.tier, slug: entry.slug };
  });
}

/**
 * The tiers one action tries, in order: the text tiers for the four text features, the vision tiers
 * for vibe. A missing tier is absent from its list; a slug an earlier tier holds is dropped.
 */
export function cascadePlan(
  feature: AiFeature,
  tiers: { readonly text: readonly Tier[]; readonly vision: readonly Tier[] },
): readonly Tier[] {
  assertOneOf(feature, AI_FEATURES, "cascadePlan: feature");
  assertRecord(tiers, "cascadePlan: tiers");
  const text = checkGroup(tiers.text, TEXT_TIERS, "tiers.text");
  const vision = checkGroup(tiers.vision, VISION_TIERS, "tiers.vision");
  const group = feature === "vibe" ? vision : text;
  return group.filter((tier, i) => group.findIndex((other) => other.slug === tier.slug) === i);
}
