import { describe, expect, it } from "vitest";
import { stepChroma } from "@/engine/color/scale";
import { generateSystem } from "@/engine/generate";
import { lintSpec } from "@/engine/lint";
import { DEFAULT_PARAMS, defaultSpec } from "../../spec/support";
import { copyOf, expectFinding, expectSilent, loose, withId } from "./support";

// K1, K2 and K4: the scale rules (C-LINT-22 to 27).

describe("K1 lightness moves away from the page", () => {
  it("C-LINT-22 stays silent on the base spec", () => {
    expectSilent(defaultSpec(), "K1");
  });

  it("C-LINT-23 reports swapped L at primary light 300 and 400", () => {
    const spec = copyOf();
    const scale = loose(spec).color.palettes.primary.light;
    const l300 = scale[3].oklch.l;
    const l400 = scale[4].oklch.l;
    scale[3].oklch.l = l400;
    scale[4].oklch.l = l300;
    const found = expectFinding(spec, {
      id: "K1",
      severity: "error",
      mode: "light",
      subject: "primary-300/primary-400",
      measured: l400 - l300,
      threshold: 0,
    });
    expect(found.measured).toBeLessThan(0);
    expect(found.source).toBe("invariant");
    expect(withId(lintSpec(spec), "K1")).toHaveLength(1);
  });

  it("measures dark scales the other way", () => {
    const spec = copyOf();
    const scale = loose(spec).color.palettes.info.dark;
    scale[9].oklch.l = scale[8].oklch.l - 0.01;
    expectFinding(spec, {
      id: "K1",
      severity: "error",
      mode: "dark",
      subject: "info-800/info-900",
      measured: scale[9].oklch.l - scale[8].oklch.l,
      threshold: 0,
    });
  });
});

describe("K2 adjacent steps differ by 0.008", () => {
  it("C-LINT-24 stays silent on the base spec", () => {
    expectSilent(defaultSpec(), "K2");
  });

  it("C-LINT-25 warns when step 100 sits 0.005 below step 50", () => {
    const spec = copyOf();
    const scale = loose(spec).color.palettes.primary.light;
    scale[1].oklch.l = scale[0].oklch.l - 0.005;
    const found = expectFinding(spec, {
      id: "K2",
      severity: "warn",
      mode: "light",
      subject: "primary-50/primary-100",
      measured: Math.abs(scale[0].oklch.l - scale[1].oklch.l),
      threshold: 0.008,
    });
    expect(found.measured).toBeCloseTo(0.005, 9);
    expect(found.source).toBe("CSS JND; Radix measured");
  });
});

describe("K4 chroma follows the expected chroma", () => {
  it("C-LINT-26 stays silent on the base spec", () => {
    expectSilent(defaultSpec(), "K4");
  });

  it("C-LINT-27 warns after taking 0.02 from primary light 500", () => {
    const spec = copyOf();
    const step = loose(spec).color.palettes.primary.light[5];
    const before = step.oklch.c;
    step.oklch.c = before - 0.02;
    const found = expectFinding(spec, {
      id: "K4",
      severity: "warn",
      mode: "light",
      subject: "primary-500",
      measured: Math.abs(
        step.oklch.c -
          stepChroma({ hue: 289, peakChroma: 0.14, mode: "light", gamut: "srgb" }, 5, step.oklch.l),
      ),
      threshold: 0.01,
    });
    expect(found.measured).toBeCloseTo(0.02, 5);
    expect(found.source).toBe("computed (RR-0028)");
  });

  it("measures even mode against the group cap, silent on an even spec", () => {
    const even = generateSystem({ ...DEFAULT_PARAMS, scaleMode: "even" }, "seed-1");
    expectSilent(even, "K4");
    // Lifting one status palette above its group's cap is a finding, though its own envelope allows it.
    const spec = copyOf(even);
    const step = loose(spec).color.palettes.success.light[6];
    step.oklch.c += 0.015;
    const found = withId(lintSpec(spec), "K4");
    expect(found.map((f) => [f.mode, f.subject, f.severity])).toEqual([
      ["light", "success-600", "warn"],
    ]);
    expect(found[0].measured).toBeCloseTo(0.015, 4);
    expect(found[0].threshold).toBe(0.01);
  });
});
