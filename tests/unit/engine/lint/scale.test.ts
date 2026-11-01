import { describe, expect, it } from "vitest";
import { parseColor } from "@/engine/color/parse";
import { STEPS, stepChroma } from "@/engine/color/scale";
import type { Mode } from "@/engine/color/types";
import { generateSystem } from "@/engine/generate";
import { lintSpec } from "@/engine/lint";
import type { DesignSpec } from "@/spec/schema";
import { DEFAULT_PARAMS, defaultSpec } from "../../spec/support";
import { copyOf, expectFinding, expectSilent, loose, withId } from "./support";

// K1, K2 and K4: the scale rules (C-LINT-22 to 27, 53 and 54).

const specs = new Map<string, DesignSpec>();

/** DEFAULT_PARAMS with `primary` locked to `text`, in even or standard scale mode, cached. */
function lockedSpec(text: string, scaleMode: "even" | "standard" = "even"): DesignSpec {
  const key = `${scaleMode} ${text}`;
  let spec = specs.get(key);
  if (spec === undefined) {
    spec = generateSystem({ ...DEFAULT_PARAMS, scaleMode, primary: parseColor(text) }, "seed-1");
    specs.set(key, spec);
  }
  return spec;
}

/** The even group cap of primary and accent at one step: the formula's minimum over the pair. */
function pairCap(spec: DesignSpec, mode: Mode, index: number): number {
  return Math.min(
    ...(["primary", "accent"] as const).map((name) => {
      const palette = spec.color.palettes[name];
      return stepChroma(
        { hue: palette.hue, peakChroma: palette.peakChroma, mode, gamut: "srgb" },
        index,
        palette[mode][index].oklch.l,
      );
    }),
  );
}

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

describe("K4 in even mode skips a seeded step for every palette of the seed's group", () => {
  it.each(["#808000", "#606020", "#20a0a0", "#60a0a0"])(
    "C-LINT-53 raises no K4 for a locked %s in even mode",
    (text) => {
      const spec = lockedSpec(text);
      expect(spec.color.palettes.primary.peakChroma).toBe(spec.color.palettes.accent.peakChroma);
      expect(withId(lintSpec(spec), "K4")).toEqual([]);
    },
    60_000,
  );

  it("C-LINT-54 still warns on a real drift at a step that holds no seed", () => {
    const base = lockedSpec("#808000");
    expect(base.color.palettes.primary.seedStep).toEqual({ light: 500, dark: 500 });
    for (const [name, mode, index] of [
      ["accent", "light", 3],
      ["primary", "light", 3],
      ["accent", "dark", 6],
    ] as const) {
      const spec = copyOf(base);
      const step = loose(spec).color.palettes[name][mode][index];
      step.oklch.c += 0.02;
      expectFinding(spec, {
        id: "K4",
        severity: "warn",
        mode,
        subject: `${name}-${STEPS[index]}`,
        measured: Math.abs(step.oklch.c - pairCap(spec, mode, index)),
        threshold: 0.01,
      });
    }
  });

  it("C-LINT-54 skips per mode and step: a seed at light 400 does not cover dark 400", () => {
    const base = lockedSpec("#f66c6d");
    expect(base.color.palettes.primary.seedStep).toEqual({ light: 400, dark: 600 });
    const light = copyOf(base);
    loose(light).color.palettes.accent.light[4].oklch.c += 0.02;
    expectSilent(light, "K4");
    const dark = copyOf(base);
    loose(dark).color.palettes.accent.dark[4].oklch.c += 0.02;
    expect(withId(lintSpec(dark), "K4").map((f) => `${f.mode} ${f.subject}`)).toEqual([
      "dark accent-400",
    ]);
  });

  it("C-LINT-54 finds the seeded step by its hex when seedStep is absent (R-10)", () => {
    const even = lockedSpec("#7f00ff");
    const primary = even.color.palettes.primary;
    expect(primary.seedStep).toBeUndefined();
    expect(primary.light[6].hex).toBe("#7f00ff");
    expectSilent(even, "K4");
    const drifted = copyOf(even);
    loose(drifted).color.palettes.accent.light[6].oklch.c += 0.02;
    expectSilent(drifted, "K4");
    // Standard mode solves each palette alone, so the seed's own step is measured and reported.
    const standard = withId(lintSpec(lockedSpec("#7f00ff", "standard")), "K4");
    expect(standard.map((f) => `${f.mode} ${f.subject}`)).toEqual(["light primary-600"]);
  });

  it("C-LINT-58 K4 reads the locked seeds in even mode only", () => {
    // Standard mode measures every step against its own formula, so the seeds play no part: a
    // stored seed the engine could not read changes nothing there.
    const standard = copyOf(lockedSpec("#7f00ff", "standard"));
    loose(standard).color.params.primary = { l: 2, c: 0, h: null };
    expect(withId(lintSpec(standard), "K4").map((f) => `${f.mode} ${f.subject}`)).toEqual([
      "light primary-600",
    ]);
    const even = copyOf(lockedSpec("#7f00ff"));
    loose(even).color.params.primary = { l: 2, c: 0, h: null };
    expect(() => lintSpec(even)).toThrow(RangeError);
  });
});
