import { expect } from "vitest";
import { wcagRatio } from "@/engine/color/contrast";
import { hexToRgb, rgbToOklch } from "@/engine/color/convert";
import type { Hex } from "@/engine/color/types";
import { lintSpec } from "@/engine/lint";
import type { Finding } from "@/engine/lint/types";
import type { DesignSpec } from "@/spec/schema";
import { defaultSpec } from "../../spec/support";

// Fixtures for the C-LINT-nn cases of docs/specs/01-color-engine.md, section 6.8: the base spec
// is generateSystem(DEFAULT_PARAMS, "seed-1"), copied and overridden per case.

/** A mutable deep copy of a spec, for targeted overrides. */
export function copyOf(spec: DesignSpec = defaultSpec()): DesignSpec {
  return structuredClone(spec);
}

/** Mutable access for overrides: the schema types are read-only. */
// biome-ignore lint/suspicious/noExplicitAny: test-only override of read-only fixture data
export const loose = (spec: DesignSpec): any => spec;

export const hex = (text: string): Hex => text as Hex;

/** WCAG ratio of two hexes, measured with the engine's own function. */
export const ratioOf = (a: string, b: string): number =>
  wcagRatio(hexToRgb(hex(a)), hexToRgb(hex(b)));

/** OKLCH lightness of a hex, measured with the engine's own function. */
export const lightnessOf = (text: string): number => rgbToOklch(hexToRgb(hex(text)), "srgb").l;

export const withId = (findings: readonly Finding[], id: string): Finding[] =>
  findings.filter((finding) => finding.id === id);

/** Asserts a finding with these fields exists; `measured` and `threshold` compare at 1e-9. */
export function expectFinding(
  spec: DesignSpec,
  expected: Omit<Finding, "source" | "measured" | "threshold"> & {
    measured: number;
    threshold: number;
  },
): Finding {
  const findings = lintSpec(spec);
  const match = findings.find(
    (f) =>
      f.id === expected.id &&
      f.mode === expected.mode &&
      f.subject === expected.subject &&
      f.severity === expected.severity,
  );
  expect(match, JSON.stringify(findings.filter((f) => f.id === expected.id))).toBeDefined();
  const found = match as Finding;
  expect(found.measured).toBeCloseTo(expected.measured, 9);
  expect(found.threshold).toBeCloseTo(expected.threshold, 9);
  return found;
}

/** Asserts that no finding has this id (and subject, when given). */
export function expectSilent(spec: DesignSpec, id: string, subject?: string): void {
  const hits = lintSpec(spec).filter(
    (f) => f.id === id && (subject === undefined || f.subject === subject),
  );
  expect(hits).toEqual([]);
}
