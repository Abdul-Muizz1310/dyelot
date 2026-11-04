import { describe, expect, it } from "vitest";
import {
  CONTRAST_CHECKS,
  hexToRgb,
  lintSpec,
  measureSpec,
  PALETTE_NAMES,
  summarize,
  wcagRatio,
} from "@/engine";
import { minPairwiseDeltaE, VIEWS } from "@/engine/color/deltae";
import { STORED_GAMUT_TOLERANCE } from "@/engine/color/guards";
import type { RoleName } from "@/engine/color/roles";
import { gamutExcess } from "@/engine/lint";
import { CONTRAST_CHECKS as CHECKS_OF_HOME, measureSpec as measureOfHome } from "@/engine/measure";
import type { DesignSpec } from "@/spec";
import lintBefore from "./__fixtures__/lint-before-m3.json";
import { PRESET_GOLDENS, SPEC } from "./measure-support";

// Cases C-MEAS-01 and C-MEAS-03 to C-MEAS-08 (docs/specs/03-export.md, ruling R3-08).
// C-MEAS-02 lives in measure-agreement.test.ts.

const C1 = [
  "foreground/background",
  "card-foreground/card",
  "popover-foreground/popover",
  "sidebar-foreground/sidebar",
  "muted-foreground/muted",
  "muted-foreground/background",
  "secondary-foreground/secondary",
  "accent-foreground/accent",
  "sidebar-accent-foreground/sidebar-accent",
  "success-subtle-foreground/success-subtle",
  "warning-subtle-foreground/warning-subtle",
  "info-subtle-foreground/info-subtle",
  "destructive-subtle-foreground/destructive-subtle",
];
const C2 = ["primary", "destructive", "success", "warning", "info"].map((r) => `${r}/background`);
const C5 = [
  "primary-foreground/primary",
  "sidebar-primary-foreground/sidebar-primary",
  "destructive-foreground/destructive",
  "success-foreground/success",
  "warning-foreground/warning",
  "info-foreground/info",
];
const N1 = ["input/background", "input/card"];
const N2 = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"].flatMap((r) => [
  `${r}/background`,
  `${r}/card`,
]);
const N3 = ["border/background"];
const F1 = ["ring/background", "ring/card", "ring/muted"];
const EXPECTED = [
  ["C1", C1, 4.5, "text"],
  ["C2", C2, 3, "large-text"],
  ["C5", C5, 4.5, "text"],
  ["N1", N1, 3, "ui"],
  ["N2", N2, 3, "ui"],
  ["N3", N3, 3, "ui"],
  ["F1", F1, 3, "ui"],
] as const;

const withRole = (spec: DesignSpec, mode: "light" | "dark", role: RoleName, hex: string) =>
  ({
    ...spec,
    color: {
      ...spec.color,
      roles: { ...spec.color.roles, [mode]: { ...spec.color.roles[mode], [role]: hex } },
    },
  }) as DesignSpec;

describe("CONTRAST_CHECKS", () => {
  it("C-MEAS-01 lists the 40 checks of the linter in its order", () => {
    expect(CONTRAST_CHECKS).toBe(CHECKS_OF_HOME);
    expect(CONTRAST_CHECKS).toHaveLength(40);
    expect(new Set(CONTRAST_CHECKS.map((c) => c.id)).size).toBe(40);
    expect(CONTRAST_CHECKS[0]?.id).toBe("C1:foreground/background");
    expect(CONTRAST_CHECKS[39]?.id).toBe("F1:ring/muted");
    expect(CONTRAST_CHECKS.map((c) => c.id)).toEqual(
      EXPECTED.flatMap(([rule, pairs]) => pairs.map((pair) => `${rule}:${pair}`)),
    );
    for (const [rule, pairs, threshold, kind] of EXPECTED) {
      const entries = CONTRAST_CHECKS.filter((c) => c.rule === rule);
      expect(entries.map((c) => `${c.foreground}/${c.background}`)).toEqual(pairs);
      for (const entry of entries) {
        expect(entry.threshold).toBe(threshold);
        expect(entry.kind).toBe(kind);
        expect(entry.required).toBe(rule !== "N3");
      }
    }
    expect(CONTRAST_CHECKS.filter((c) => c.rule === "C1")).toHaveLength(13);
    expect(Object.isFrozen(CONTRAST_CHECKS)).toBe(true);
    for (const entry of CONTRAST_CHECKS) expect(Object.isFrozen(entry)).toBe(true);
  });
});

describe("measureSpec", () => {
  const measured = measureSpec(SPEC);

  it("C-MEAS-03 orders 80 contrast, 16 separation and 176 gamut entries", () => {
    expect(measureOfHome).toBe(measureSpec);
    expect(measured.contrast).toHaveLength(80);
    expect(measured.contrast.map((m) => [m.mode, m.check])).toEqual(
      (["light", "dark"] as const).flatMap((mode) =>
        CONTRAST_CHECKS.map((check) => [mode, check.id]),
      ),
    );
    expect(measured.separation).toHaveLength(16);
    expect(measured.separation.map((m) => [m.mode, m.set, m.view])).toEqual(
      (["light", "dark"] as const).flatMap((mode) =>
        (["status", "chart"] as const).flatMap((set) =>
          (["none", "protan", "deutan", "tritan"] as const).map((view) => [mode, set, view]),
        ),
      ),
    );
    expect(measured.gamut).toHaveLength(176);
    const steps = SPEC.color.palettes.primary.light.map((s) => s.step);
    expect(measured.gamut.map((m) => [m.mode, m.palette, m.step])).toEqual(
      (["light", "dark"] as const).flatMap((mode) =>
        PALETTE_NAMES.flatMap((palette) => steps.map((step) => [mode, palette, step])),
      ),
    );
    const numbers = [
      ...measured.contrast.flatMap((m) => [m.ratio, m.lc]),
      ...measured.separation.map((m) => m.minDeltaE),
      ...measured.gamut.map((m) => m.excess),
    ];
    expect(numbers.every(Number.isFinite)).toBe(true);
  });

  it("C-MEAS-04 reads the same measures as S1 and G1", () => {
    const status: RoleName[] = ["success", "warning", "destructive", "info"];
    const chart: RoleName[] = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"];
    for (const entry of measured.separation) {
      const roles = entry.set === "status" ? status : chart;
      const smallest = minPairwiseDeltaE(
        roles.map((r) => hexToRgb(SPEC.color.roles[entry.mode][r])),
      );
      expect(entry.minDeltaE).toBe(smallest[entry.view]);
    }
    expect(VIEWS).toHaveLength(4);
    for (const entry of measured.gamut) {
      const step = SPEC.color.palettes[entry.palette][entry.mode].find(
        (s) => s.step === entry.step,
      );
      expect(entry.excess).toBe(
        gamutExcess(step?.oklch ?? { l: 0, c: 0, h: null }, SPEC.color.params.gamut),
      );
    }
    for (const entry of measured.contrast) {
      const check = CONTRAST_CHECKS.find((c) => c.id === entry.check);
      const roles = SPEC.color.roles[entry.mode];
      const ratio = wcagRatio(
        hexToRgb(roles[check?.foreground ?? "ring"]),
        hexToRgb(roles[check?.background ?? "ring"]),
      );
      expect(entry.ratio).toBe(ratio);
      expect(entry.pass).toBe(ratio >= (check?.threshold ?? 0));
    }
  });
});

describe("summarize", () => {
  it("C-MEAS-05 counts the measurements and the findings", () => {
    const findings = lintSpec(SPEC);
    const count = (severity: string) => findings.filter((f) => f.severity === severity).length;
    expect(summarize(measureSpec(SPEC), findings, "srgb")).toEqual({
      pass: true,
      contrast: { checks: 80, required: 78, requiredPass: 78, advisoryBelow: 2 },
      separation: { checks: 16, below: findings.filter((f) => f.id === "S1").length },
      gamut: { gamut: "srgb", values: 176, outside: 0 },
      lint: { error: count("error"), warn: count("warn"), info: count("info") },
    });
    expect(Object.keys(summarize(measureSpec(SPEC), findings, "srgb"))).toEqual([
      "pass",
      "contrast",
      "separation",
      "gamut",
      "lint",
    ]);
    const failing = withRole(SPEC, "light", "secondary-foreground", "#858585");
    const summary = summarize(measureSpec(failing), lintSpec(failing), "srgb");
    expect(summary.pass).toBe(false);
    expect(summary.contrast.requiredPass).toBe(77);
    expect(summary.lint.error).toBe(1);
  });

  it("C-MEAS-05 counts a gamut value above the stored tolerance as outside", () => {
    const base = measureSpec(SPEC);
    const gamut = base.gamut.map((m, i) =>
      i < 2
        ? { ...m, excess: STORED_GAMUT_TOLERANCE + 1e-9 }
        : i < 3
          ? { ...m, excess: STORED_GAMUT_TOLERANCE }
          : m,
    );
    expect(summarize({ ...base, gamut }, [], "p3").gamut).toEqual({
      gamut: "p3",
      values: 176,
      outside: 2,
    });
  });
});

describe("failures", () => {
  it("C-MEAS-06 names the function in each error", () => {
    expect(() => measureSpec(null as never)).toThrow(TypeError);
    expect(() => measureSpec(null as never)).toThrow("measureSpec");
    const bad = withRole(SPEC, "dark", "ring", "red");
    expect(() => measureSpec(bad)).toThrow(RangeError);
    expect(() => measureSpec(bad)).toThrow(/measureSpec.*ring/);
    const upper = withRole(SPEC, "light", "card", "#ABCDEF");
    expect(() => measureSpec(upper)).toThrow(RangeError);
    const measured = measureSpec(SPEC);
    const short = { ...measured, contrast: measured.contrast.slice(0, 79) };
    expect(() => summarize(short, [], "srgb")).toThrow(RangeError);
    expect(() => summarize(short, [], "srgb")).toThrow("summarize");
    expect(() => summarize(measured, {} as never, "srgb")).toThrow(TypeError);
    expect(() => summarize(measured, {} as never, "srgb")).toThrow("summarize");
    expect(() => summarize(measured, [], "rec2020" as never)).toThrow(RangeError);
    expect(() => summarize(measured, [], "rec2020" as never)).toThrow("summarize");
    expect(() => summarize(null as never, [], "srgb")).toThrow(TypeError);
  });
});

describe("goldens", () => {
  it("C-MEAS-07 keeps every lint finding of every golden", () => {
    const now: Record<string, unknown> = { SPEC: lintSpec(SPEC) };
    for (const { id, spec } of PRESET_GOLDENS) now[id] = lintSpec(spec);
    expect(PRESET_GOLDENS).toHaveLength(14);
    expect(JSON.parse(JSON.stringify(now))).toEqual(lintBefore);
  });

  it.each([{ id: "SPEC", spec: SPEC }, ...PRESET_GOLDENS])(
    "C-MEAS-08 passes 78 of 78 required checks for $id",
    ({ spec }) => {
      const summary = summarize(measureSpec(spec), lintSpec(spec), spec.color.params.gamut);
      expect(summary.contrast.required).toBe(78);
      expect(summary.contrast.requiredPass).toBe(78);
      expect(summary.contrast.advisoryBelow).toBe(2);
      expect(summary.lint.error).toBe(0);
    },
  );
});
