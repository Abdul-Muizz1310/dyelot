import { describe, expect, it } from "vitest";
import { hexToRgb } from "@/engine/color/convert";
import { deltaEOK, minPairwiseDeltaE } from "@/engine/color/deltae";
import { parseColor } from "@/engine/color/parse";
import { lintSpec } from "@/engine/lint";
import { defaultSpec } from "../../spec/support";
import { copyOf, expectFinding, expectSilent, hex, lightnessOf, loose, withId } from "./support";

// S1 and S2: separation of the status and chart sets (C-LINT-17 to 21).

const VIEWS = ["none", "protan", "deutan", "tritan"] as const;
const STATUS = ["success", "warning", "destructive", "info"] as const;

describe("S1 status and chart sets stay apart under each view", () => {
  it("C-LINT-17 stays silent on the base spec; status minimum about 0.086 light", () => {
    const spec = defaultSpec();
    expectSilent(spec, "S1");
    const status = STATUS.map((role) => hexToRgb(spec.color.roles.light[role]));
    const light = minPairwiseDeltaE(status);
    expect(Math.min(...VIEWS.map((v) => light[v]))).toBeGreaterThan(0.08);
  });

  it("C-LINT-18 reports chart-2 equal to chart-1 as four errors measuring 0", () => {
    const spec = copyOf();
    loose(spec).color.roles.light["chart-2"] = spec.color.roles.light["chart-1"];
    for (const view of VIEWS) {
      const found = expectFinding(spec, {
        id: "S1",
        severity: "error",
        mode: "light",
        subject: `chart/${view}`,
        measured: 0,
        threshold: 0.08,
      });
      expect(found.source).toBe("calibrated against Okabe-Ito (RR-0028)");
    }
    expect(withId(lintSpec(spec), "S1")).toHaveLength(4);
  });

  it("C-LINT-19 warns per view for a gray chart set (0.0667, #808080 against #949494)", () => {
    const spec = copyOf();
    const grays = ["#202020", "#808080", "#949494", "#d0d0d0", "#f0f0f0"];
    grays.forEach((gray, i) => {
      loose(spec).color.roles.light[`chart-${i + 1}`] = gray;
    });
    const expected = minPairwiseDeltaE(grays.map((g) => hexToRgb(hex(g))));
    expect(expected.none).toBeCloseTo(deltaEOK(parseColor("#808080"), parseColor("#949494")), 12);
    for (const view of VIEWS) {
      const found = expectFinding(spec, {
        id: "S1",
        severity: "warn",
        mode: "light",
        subject: `chart/${view}`,
        measured: expected[view],
        threshold: 0.08,
      });
      expect(found.measured).toBeCloseTo(0.0667, 3);
    }
  });

  it("checks the status set too", () => {
    const spec = copyOf();
    loose(spec).color.roles.dark.info = spec.color.roles.dark.success;
    expectFinding(spec, {
      id: "S1",
      severity: "error",
      mode: "dark",
      subject: "status/none",
      measured: 0,
      threshold: 0.08,
    });
  });
});

describe("S2 danger and success differ in lightness", () => {
  it("C-LINT-20 stays silent on the base spec (about 0.20 light, 0.17 dark)", () => {
    const spec = defaultSpec();
    expectSilent(spec, "S2");
    const gap = (mode: "light" | "dark") =>
      Math.abs(
        lightnessOf(spec.color.roles[mode].destructive) -
          lightnessOf(spec.color.roles[mode].success),
      );
    expect(gap("light")).toBeCloseTo(0.2, 1);
    expect(gap("dark")).toBeCloseTo(0.17, 1);
  });

  it("C-LINT-21 warns when success equals destructive", () => {
    const spec = copyOf();
    loose(spec).color.roles.light.success = spec.color.roles.light.destructive;
    const found = expectFinding(spec, {
      id: "S2",
      severity: "warn",
      mode: "light",
      subject: "destructive/success",
      measured: 0,
      threshold: 0.1,
    });
    expect(found.source).toBe("red and green collapse under protan and deutan (RR-0028)");
  });
});
