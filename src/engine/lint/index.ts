import { runRules } from "./rules";
import type { Finding, LintedSpec } from "./types";

export { gamutExcess } from "./rules";
export type { Finding, LintedSpec, RuleId, Severity } from "./types";
export { RULE_IDS } from "./types";

const SEVERITY_RANK = { error: 0, warn: 1, info: 2 } as const;
const MODE_RANK = { light: 0, dark: 1 } as const;

/** Code-unit order, the same on every platform (no locale). */
const compareText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** R-23: severity (error, warn, info), then id, then mode (light first), then subject. */
function compare(a: Finding, b: Finding): number {
  return (
    SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
    compareText(a.id, b.id) ||
    MODE_RANK[a.mode] - MODE_RANK[b.mode] ||
    compareText(a.subject, b.subject)
  );
}

/** Throws RangeError at the first number that is not finite, naming its path (spec I-03). */
function assertFiniteNumbers(value: unknown, path: string): void {
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new RangeError(`lintSpec: ${path} must be finite, got ${value}`);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  for (const [key, item] of Object.entries(value)) assertFiniteNumbers(item, `${path}.${key}`);
}

/**
 * Checks a design system against the 20 measured rules of spec section 6.8 and returns its
 * findings, sorted by severity, rule id, mode and subject. It reads the spec and nothing else and
 * does not mutate it. Callers parse the spec at the boundary; a stored number that is NaN or
 * infinite throws a RangeError, so no finding carries one.
 */
export function lintSpec(spec: LintedSpec): readonly Finding[] {
  assertFiniteNumbers(spec, "spec");
  return runRules(spec).sort(compare);
}
