import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { generateSystem } from "@/engine/generate";
import { lintSpec } from "@/engine/lint";
import { type Finding, RULE_IDS } from "@/engine/lint/types";
import type { DesignSpec } from "@/spec/schema";
import {
  anySeedText,
  DEFAULT_PARAMS,
  deepFreeze,
  defaultSpec,
  numberPaths,
  PROPERTY_TIMEOUT,
  withValue,
} from "../../spec/support";
import { copyOf, loose } from "./support";

// The linter as a whole: order, ids, purity, finiteness and the base spec (C-LINT-42 to 47).

const ALL_IDS = [
  "C1",
  "C2",
  "C4",
  "C5",
  "N1",
  "N2",
  "N3",
  "F1",
  "S1",
  "S2",
  "K1",
  "K2",
  "K4",
  "G1",
  "G3",
  "D1",
  "D2",
  "D3",
  "D4",
  "P1",
];

const SEVERITY = { error: 0, warn: 1, info: 2 } as const;
const MODE = { light: 0, dark: 1 } as const;

/** The order of R-23, written apart from the implementation. */
function inOrder(a: Finding, b: Finding): boolean {
  if (a.severity !== b.severity) return SEVERITY[a.severity] < SEVERITY[b.severity];
  if (a.id !== b.id) return a.id < b.id;
  if (a.mode !== b.mode) return MODE[a.mode] < MODE[b.mode];
  return a.subject <= b.subject;
}

/** A base spec broken so that every one of the 20 rules fires. */
function brokenSpec(): DesignSpec {
  const spec = copyOf();
  const s = loose(spec);
  const light = s.color.roles.light;
  const dark = s.color.roles.dark;
  light.foreground = "#777777"; // C1, C4
  light.warning = "#ffd166"; // C2
  light["primary-foreground"] = light.primary; // C5
  light.input = "#eeeeee"; // N1
  light["chart-2"] = light["chart-1"]; // S1
  light["chart-3"] = "#fafafa"; // N2
  light.ring = "#f0f0f0"; // F1
  light.success = light.destructive; // S2
  const primary = s.color.palettes.primary.light;
  [primary[3].oklch.l, primary[4].oklch.l] = [primary[4].oklch.l, primary[3].oklch.l]; // K1
  primary[1].oklch.l = primary[0].oklch.l - 0.005; // K2
  primary[5].oklch = { l: 0.7, c: 0.4, h: 145 }; // G1, K4
  s.color.palettes.neutral.light[5].oklch = { l: 0.5, c: 0, h: 120 }; // G3
  primary[6].oklch = { l: 0.5, c: 0.1, h: 100 }; // P1
  dark.background = "#000000"; // D1
  dark.foreground = "#ffffff"; // D2
  s.color.palettes.primary.dark[6].oklch.c = s.color.palettes.primary.light[6].oklch.c + 0.05; // D3
  dark.card = dark.background; // D4
  return spec;
}

describe("lintSpec", () => {
  it("C-LINT-47 is silent on the base spec except N3 info in both modes", () => {
    const findings = lintSpec(defaultSpec());
    const loud = findings.filter((f) => f.id !== "N3");
    expect(loud).toEqual([]);
    expect(findings.filter((f) => f.id === "N3").map((f) => [f.severity, f.mode])).toEqual([
      ["info", "light"],
      ["info", "dark"],
    ]);
  });

  it("C-LINT-43 has exactly the 20 rule ids; every finding has a clean source and finite numbers", () => {
    expect([...RULE_IDS]).toEqual(ALL_IDS);
    const findings = lintSpec(brokenSpec());
    expect(new Set(findings.map((f) => f.id))).toEqual(new Set(ALL_IDS));
    for (const finding of findings) {
      expect(finding.source.length).toBeGreaterThan(0);
      expect(finding.source.toLowerCase()).not.toContain("apca");
      expect(Number.isFinite(finding.measured)).toBe(true);
      expect(Number.isFinite(finding.threshold)).toBe(true);
    }
    for (const finding of findings.filter((f) => f.id.startsWith("D"))) {
      expect(finding.mode).toBe("dark");
    }
  });

  it("C-LINT-42 sorts by severity, then id, then mode (light first), then subject", () => {
    const roles = Object.keys(defaultSpec().color.roles.light);
    const anyHex = fc
      .integer({ min: 0, max: 0xffffff })
      .map((n) => `#${n.toString(16).padStart(6, "0")}`);
    const edit = fc.record({
      mode: fc.constantFrom("light", "dark"),
      role: fc.constantFrom(...roles),
      hex: anyHex,
    });
    fc.assert(
      fc.property(
        fc.array(edit, { minLength: 1, maxLength: 20 }),
        fc.boolean(),
        (edits, broken) => {
          const spec = broken ? brokenSpec() : copyOf();
          for (const e of edits) loose(spec).color.roles[e.mode][e.role] = e.hex;
          const findings = lintSpec(spec);
          for (let i = 1; i < findings.length; i++) {
            expect(inOrder(findings[i - 1], findings[i])).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it(
    "C-LINT-44 finds zero errors in generateSystem output (200 seeds, default params)",
    () => {
      fc.assert(
        fc.property(anySeedText, (seed) => {
          const errors = lintSpec(generateSystem(DEFAULT_PARAMS, seed)).filter(
            (f) => f.severity === "error",
          );
          expect(errors).toEqual([]);
        }),
        { numRuns: 200 },
      );
    },
    PROPERTY_TIMEOUT,
  );

  it("C-LINT-45 is deterministic and accepts a deep-frozen spec without mutating it", () => {
    const frozen = deepFreeze(brokenSpec());
    const before = structuredClone(frozen);
    expect(lintSpec(frozen)).toEqual(lintSpec(brokenSpec()));
    expect(frozen).toEqual(before);
    expect(Object.isFrozen(defaultSpec())).toBe(true);
    expect(lintSpec(defaultSpec())).toEqual(lintSpec(defaultSpec()));
  });

  it("C-LINT-46 throws RangeError for NaN or Infinity in any stored number", () => {
    const spec = defaultSpec();
    const paths = numberPaths(spec);
    const picks = [
      ["color", "palettes", "primary", "light", 5, "oklch", "l"],
      ["color", "palettes", "neutral", "dark", 0, "oklch", "c"],
      ["color", "palettes", "accent", "light", 2, "oklch", "h"],
      ["color", "palettes", "info", "hue"],
      ["type", "steps", 3, "sizePx"],
      ...paths.filter((_, i) => i % 97 === 0),
    ];
    for (const path of picks) {
      for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) {
        const broken = withValue(spec, path, bad) as DesignSpec;
        expect(() => lintSpec(broken), path.join(".")).toThrow(RangeError);
      }
    }
  });
});
