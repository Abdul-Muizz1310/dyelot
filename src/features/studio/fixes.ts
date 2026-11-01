import {
  CONTRAST_LEVELS,
  type ContrastLevel,
  type DirectionParams,
  type Finding,
  RULE_IDS,
} from "@/engine";
import { assertOneOf, assertRecord } from "./guards";
import type { ParamsPatch } from "./params";

// The inspector's fix actions (spec R2-10, section 5.8). `fixFor` is pure and never regenerates: the
// button applies its patch through the store's `setParams`, so the worker does the regeneration.

/** The level each fixable rule needs. K3 is not a rule of the linter yet, so it has no row. */
const FIX_TARGETS: Readonly<Partial<Record<Finding["id"], ContrastLevel>>> = Object.freeze({
  C1: "AA+",
  C5: "AAA",
  N1: "AAA",
  F1: "AAA",
});

/**
 * The patch that fixes a finding by raising the contrast level: C1 to `AA+`, and C5, N1 and F1 to
 * `AAA`. Null for any other rule, and when the current level is already at or above the target.
 */
export function fixFor(finding: Finding, params: DirectionParams): ParamsPatch | null {
  assertRecord(finding, "fixFor: finding");
  assertOneOf(finding.id, RULE_IDS, "fixFor: finding.id");
  assertRecord(params, "fixFor: params");
  const current = params.contrastLevel;
  assertOneOf(current, CONTRAST_LEVELS, "fixFor: params.contrastLevel");
  const target = FIX_TARGETS[finding.id];
  if (target === undefined) return null;
  return CONTRAST_LEVELS.indexOf(target) > CONTRAST_LEVELS.indexOf(current)
    ? { contrastLevel: target }
    : null;
}
