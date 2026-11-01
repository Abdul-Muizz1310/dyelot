import { describe, expect, it } from "vitest";
import { lintSpec } from "@/engine/lint";
import { defaultSpec } from "../../spec/support";
import { copyOf, expectFinding, expectSilent, loose, ratioOf, withId } from "./support";

// N1, N2, N3 and F1: the non-text contrast rules (C-LINT-09 to 16).

describe("N1 input against background and card", () => {
  it("C-LINT-09 stays silent on the base spec (input is neutral-600)", () => {
    const spec = defaultSpec();
    expect(spec.color.roles.light.input).toBe(spec.color.palettes.neutral.light[6].hex);
    expect(ratioOf(spec.color.roles.light.input, spec.color.roles.light.card)).toBeGreaterThan(4);
    expectSilent(spec, "N1");
  });

  it("C-LINT-10 reports input on neutral-400 against background and card", () => {
    const spec = copyOf();
    const input = spec.color.palettes.neutral.light[4].hex;
    loose(spec).color.roles.light.input = input;
    const roles = spec.color.roles.light;
    for (const fill of ["background", "card"] as const) {
      const found = expectFinding(spec, {
        id: "N1",
        severity: "error",
        mode: "light",
        subject: `input/${fill}`,
        measured: ratioOf(input, roles[fill]),
        threshold: 3,
      });
      expect(found.measured).toBeLessThan(3);
      expect(found.source).toBe("WCAG 2.2 SC 1.4.11");
    }
    expect(withId(lintSpec(spec), "N1")).toHaveLength(2);
  });
});

describe("N2 chart marks against background and card", () => {
  it("C-LINT-11 stays silent on the base spec", () => {
    expectSilent(defaultSpec(), "N2");
  });

  it("C-LINT-12 reports a #222222 chart-3 in dark mode", () => {
    const spec = copyOf();
    loose(spec).color.roles.dark["chart-3"] = "#222222";
    const roles = spec.color.roles.dark;
    for (const fill of ["background", "card"] as const) {
      const found = expectFinding(spec, {
        id: "N2",
        severity: "error",
        mode: "dark",
        subject: `chart-3/${fill}`,
        measured: ratioOf("#222222", roles[fill]),
        threshold: 3,
      });
      expect(found.measured).toBeLessThan(3);
    }
  });
});

describe("N3 border against background (info)", () => {
  it("C-LINT-13 stays silent for a neutral-500 border", () => {
    const spec = copyOf();
    loose(spec).color.roles.light.border = spec.color.palettes.neutral.light[5].hex;
    loose(spec).color.roles.dark.border = spec.color.palettes.neutral.dark[5].hex;
    expectSilent(spec, "N3");
  });

  it("C-LINT-14 reports the base border (about 1.32) as info in both modes", () => {
    const spec = defaultSpec();
    for (const mode of ["light", "dark"] as const) {
      const roles = spec.color.roles[mode];
      const found = expectFinding(spec, {
        id: "N3",
        severity: "info",
        mode,
        subject: "border/background",
        measured: ratioOf(roles.border, roles.background),
        threshold: 3,
      });
      expect(found.measured).toBeCloseTo(1.32, 1);
      expect(found.source).toBe("WCAG 2.2 SC 1.4.11 (decorative dividers are exempt)");
    }
  });
});

describe("F1 ring against background, card and muted", () => {
  it("C-LINT-15 stays silent on the base spec (ring is primary-600)", () => {
    const spec = defaultSpec();
    expect(spec.color.roles.light.ring).toBe(spec.color.palettes.primary.light[6].hex);
    expectSilent(spec, "F1");
  });

  it("C-LINT-16 reports a primary-300 ring against all three surfaces", () => {
    const spec = copyOf();
    const ring = spec.color.palettes.primary.light[3].hex;
    loose(spec).color.roles.light.ring = ring;
    const roles = spec.color.roles.light;
    for (const fill of ["background", "card", "muted"] as const) {
      const found = expectFinding(spec, {
        id: "F1",
        severity: "error",
        mode: "light",
        subject: `ring/${fill}`,
        measured: ratioOf(ring, roles[fill]),
        threshold: 3,
      });
      expect(found.measured).toBeLessThan(3);
      expect(found.source).toBe("WCAG 2.2 SC 1.4.11, 2.4.13");
    }
  });
});
