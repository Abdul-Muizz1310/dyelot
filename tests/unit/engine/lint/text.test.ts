import { describe, expect, it } from "vitest";
import { perceptualLc } from "@/engine/color/contrast";
import { hexToRgb } from "@/engine/color/convert";
import { lintSpec } from "@/engine/lint";
import { defaultSpec } from "../../spec/support";
import { copyOf, expectFinding, expectSilent, hex, loose, ratioOf, withId } from "./support";

// C1, C2, C4 and C5: the text rules (C-LINT-01 to 08 and C-LINT-49).

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

  it("checks all 13 pairs in both modes", () => {
    const spec = copyOf();
    for (const mode of ["light", "dark"] as const) {
      const roles = loose(spec).color.roles[mode];
      for (const name of Object.keys(roles)) roles[name] = "#808080";
    }
    expect(withId(lintSpec(spec), "C1")).toHaveLength(26);
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
