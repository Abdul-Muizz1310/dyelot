import { describe, expect, it } from "vitest";
import { perceptualLc } from "@/engine/color/contrast";
import { hexToRgb } from "@/engine/color/convert";
import { lintSpec } from "@/engine/lint";
import { defaultSpec } from "../../spec/support";
import { copyOf, expectFinding, expectSilent, hex, loose, ratioOf, withId } from "./support";

// C1, C2, C4 and C5: the text rules (C-LINT-01 to 08, 49 and 55).

describe("C1 text pairs reach 4.5", () => {
  it("C-LINT-01 stays silent for #767676 on white (4.5422)", () => {
    const spec = copyOf();
    loose(spec).color.roles.light.foreground = "#767676";
    expectSilent(spec, "C1", "foreground/background");
  });

  it("C-LINT-02 reports #777777 on white (4.4781) as an error", () => {
    const spec = copyOf();
    loose(spec).color.roles.light.foreground = "#777777";
    const found = expectFinding(spec, {
      id: "C1",
      severity: "error",
      mode: "light",
      subject: "foreground/background",
      measured: ratioOf("#777777", "#ffffff"),
      threshold: 4.5,
    });
    expect(found.measured).toBeCloseTo(4.4781, 4);
    expect(found.source).toBe("WCAG 2.2 SC 1.4.3, 1.4.6");
  });

  it("C-LINT-49 reports the destructive subtle pair at ratio 1, silent on the base spec", () => {
    const base = defaultSpec();
    expectSilent(base, "C1", "destructive-subtle-foreground/destructive-subtle");
    const roles = base.color.roles.light;
    expect(
      ratioOf(roles["destructive-subtle-foreground"], roles["destructive-subtle"]),
    ).toBeGreaterThan(10);
    const spec = copyOf();
    loose(spec).color.roles.light["destructive-subtle-foreground"] = roles["destructive-subtle"];
    expectFinding(spec, {
      id: "C1",
      severity: "error",
      mode: "light",
      subject: "destructive-subtle-foreground/destructive-subtle",
      measured: 1,
      threshold: 4.5,
    });
  });

  it("C-LINT-55 checks every listed pair and role: one gray for every role fails each one", () => {
    const spec = copyOf();
    for (const mode of ["light", "dark"] as const) {
      const roles = loose(spec).color.roles[mode];
      for (const name of Object.keys(roles)) roles[name] = "#808080";
    }
    const findings = lintSpec(spec);
    // The lists of spec sections 6.5 and 6.8, written out here apart from the implementation.
    const charts = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"];
    const views = ["none", "protan", "deutan", "tritan"];
    const expected: Record<string, readonly string[]> = {
      C1: [
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
      ],
      C2: ["primary", "destructive", "success", "warning", "info"].map((r) => `${r}/background`),
      C4: [
        "foreground/background",
        "card-foreground/card",
        "popover-foreground/popover",
        "sidebar-foreground/sidebar",
      ],
      C5: [
        "primary-foreground/primary",
        "sidebar-primary-foreground/sidebar-primary",
        "destructive-foreground/destructive",
        "success-foreground/success",
        "warning-foreground/warning",
        "info-foreground/info",
      ],
      N1: ["input/background", "input/card"],
      N2: charts.flatMap((chart) => [`${chart}/background`, `${chart}/card`]),
      N3: ["border/background"],
      F1: ["ring/background", "ring/card", "ring/muted"],
      S1: ["status", "chart"].flatMap((set) => views.map((view) => `${set}/${view}`)),
      S2: ["destructive/success"],
    };
    for (const [id, subjects] of Object.entries(expected)) {
      for (const mode of ["light", "dark"] as const) {
        const found = findings.filter((f) => f.id === id && f.mode === mode).map((f) => f.subject);
        expect(found.sort(), `${id} ${mode}`).toEqual([...subjects].sort());
      }
    }
    // Counts as the review computed them: C2 10, C4 8, C5 12, N1 4, N2 20, F1 6, both modes.
    const count = (id: string) => withId(findings, id).length;
    expect([count("C1"), count("C2"), count("C4"), count("C5")]).toEqual([26, 10, 8, 12]);
    expect([count("N1"), count("N2"), count("N3"), count("F1")]).toEqual([4, 20, 2, 6]);
    expect([count("S1"), count("S2")]).toEqual([16, 2]);
    // The dark-mode role rules: a mid-gray foreground is not off-white, and the card meets the page.
    expect(findings.filter((f) => f.id.startsWith("D")).map((f) => `${f.id} ${f.subject}`)).toEqual(
      ["D2 foreground", "D4 card/background"],
    );
  });
});

describe("C2 large-text roles reach 3 against the background", () => {
  it("C-LINT-03 stays silent on the base spec", () => {
    expectSilent(defaultSpec(), "C2");
  });

  it("C-LINT-04 reports #ffd166 warning on white (1.442)", () => {
    const spec = copyOf();
    loose(spec).color.roles.light.warning = "#ffd166";
    const found = expectFinding(spec, {
      id: "C2",
      severity: "error",
      mode: "light",
      subject: "warning/background",
      measured: ratioOf("#ffd166", "#ffffff"),
      threshold: 3,
    });
    // biome-ignore lint/suspicious/noApproximativeNumericConstant: the spec's measured ratio, not log2(e)
    expect(found.measured).toBeCloseTo(1.442, 3);
    expect(found.source).toBe("WCAG 2.2 SC 1.4.3 (large text)");
  });
});

describe("C4 body text perceptual contrast (advisory)", () => {
  it("C-LINT-05 stays silent on the base spec", () => {
    expectSilent(defaultSpec(), "C4");
  });

  it("C-LINT-06 warns for #767676 on white (abs(Lc) 71.57)", () => {
    const spec = copyOf();
    loose(spec).color.roles.light.foreground = "#767676";
    const found = expectFinding(spec, {
      id: "C4",
      severity: "warn",
      mode: "light",
      subject: "foreground/background",
      measured: Math.abs(perceptualLc(hexToRgb(hex("#767676")), hexToRgb(hex("#ffffff")))),
      threshold: 75,
    });
    expect(found.measured).toBeCloseTo(71.57, 2);
    expect(found.source).toBe("perceptual contrast guidance (advisory)");
  });

  it("measures light text on a dark fill by magnitude", () => {
    const spec = copyOf();
    loose(spec).color.roles.dark.foreground = "#777777";
    const dark = spec.color.roles.dark.background;
    expectFinding(spec, {
      id: "C4",
      severity: "warn",
      mode: "dark",
      subject: "foreground/background",
      measured: Math.abs(perceptualLc(hexToRgb(hex("#777777")), hexToRgb(dark))),
      threshold: 75,
    });
  });
});

describe("C5 text on fills reaches 4.5", () => {
  it("C-LINT-07 stays silent on the base spec", () => {
    expectSilent(defaultSpec(), "C5");
  });

  it("C-LINT-08 reports primary-foreground equal to primary (ratio 1)", () => {
    const spec = copyOf();
    loose(spec).color.roles.light["primary-foreground"] = spec.color.roles.light.primary;
    const found = expectFinding(spec, {
      id: "C5",
      severity: "error",
      mode: "light",
      subject: "primary-foreground/primary",
      measured: 1,
      threshold: 4.5,
    });
    expect(found.source).toBe("WCAG 2.2 SC 1.4.3");
  });
});
