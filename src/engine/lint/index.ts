import { assertFinite, assertHex, describeType, MODES } from "../color/guards";
import { PALETTE_NAMES } from "../color/palette";
import { ROLE_NAMES } from "../color/roles";
import { STEPS } from "../color/scale";
import { runRules } from "./rules";
import type { Finding, LintedSpec, LintOptions } from "./types";

export { gamutExcess } from "./rules";

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

/** An object that is neither null nor an array, or a TypeError naming `path`. */
function assertRecord(value: unknown, path: string): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`lintSpec: ${path} must be an object, got ${describeType(value)}`);
  }
}

/**
 * R-05 checks of what the rules read: the palettes (8, each scale of 11 steps in both modes), the
 * roles (46 per mode, each a lowercase #rrggbb) and, when present, the type section. A wrong type
 * is a TypeError and an out-of-domain value a RangeError; every message starts `lintSpec:`.
 */
function assertLintable(spec: unknown): asserts spec is LintedSpec {
  assertRecord(spec, "spec");
  assertRecord(spec.color, "spec.color");
  const { palettes, roles } = spec.color;
  assertRecord(spec.color.params, "spec.color.params");
  assertRecord(palettes, "spec.color.palettes");
  assertRecord(roles, "spec.color.roles");
  for (const name of PALETTE_NAMES) {
    const palette = palettes[name];
    assertRecord(palette, `spec.color.palettes.${name}`);
    for (const mode of MODES) {
      const scale = palette[mode];
      if (!Array.isArray(scale) || scale.length !== STEPS.length) {
        throw new TypeError(
          `lintSpec: spec.color.palettes.${name}.${mode} must hold ${STEPS.length} steps`,
        );
      }
      for (const [i, step] of (scale as unknown[]).entries()) {
        assertRecord(step, `spec.color.palettes.${name}.${mode}[${i}]`);
      }
    }
  }
  for (const mode of MODES) {
    const set = roles[mode];
    assertRecord(set, `spec.color.roles.${mode}`);
    for (const role of ROLE_NAMES) {
      assertHex(set[role], `lintSpec: spec.color.roles.${mode}.${role}`);
    }
  }
  if (spec.type === undefined) return;
  assertRecord(spec.type, "spec.type");
  assertRecord(spec.type.families, "spec.type.families");
  if (typeof spec.type.families.display !== "string") {
    throw new TypeError(
      `lintSpec: spec.type.families.display must be a string, got ${describeType(spec.type.families.display)}`,
    );
  }
  const { steps } = spec.type;
  const body = Array.isArray(steps)
    ? steps.find((step: unknown) => (step as { name?: unknown } | null)?.name === "body")
    : undefined;
  if (body === undefined) {
    throw new TypeError("lintSpec: spec.type.steps must hold a step named body");
  }
  assertFinite(body.sizePx, "lintSpec: spec.type.steps.body.sizePx");
}

/**
 * Checks a design system against the 20 measured rules of the M1 spec section 6.8 and the four
 * taste rules T1 to T4 (M2 spec section 5.4), and returns its findings, sorted by severity, rule
 * id, mode and subject. It reads the spec and nothing else and does not mutate it. The input is
 * checked first (R-05); a stored number that is NaN or infinite throws a RangeError, so no
 * finding carries one. `options.catalog` replaces the font catalog, for tests.
 */
export function lintSpec(spec: LintedSpec, options: LintOptions = {}): readonly Finding[] {
  assertLintable(spec);
  assertRecord(options, "options");
  if (options.catalog !== undefined && !Array.isArray(options.catalog as unknown)) {
    throw new TypeError(
      `lintSpec: options.catalog must be an array, got ${describeType(options.catalog)}`,
    );
  }
  for (const [i, font] of ((options.catalog ?? []) as unknown[]).entries()) {
    assertRecord(font, `options.catalog[${i}]`);
  }
  assertFiniteNumbers(spec, "spec");
  return runRules(spec, options).sort(compare);
}
