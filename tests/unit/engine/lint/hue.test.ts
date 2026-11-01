import { describe, expect, it } from "vitest";
import { parseColor } from "@/engine/color/parse";
import { generateSystem } from "@/engine/generate";
import { lintSpec } from "@/engine/lint";
import { DEFAULT_PARAMS, defaultSpec } from "../../spec/support";
import { copyOf, expectSilent, loose, withId } from "./support";

// P1: the disliked dark yellow-green (C-LINT-40 and 41).

describe("P1 dark yellow-green steps", () => {
  it("C-LINT-40 stays silent on the base spec (primary hue 289)", () => {
    expect(defaultSpec().color.palettes.primary.hue).toBe(289);
    expectSilent(defaultSpec(), "P1");
  });

  it("C-LINT-41 reports primary 600 and 700 for a locked oklch(0.6 0.12 111)", () => {
    const spec = generateSystem(
      { ...DEFAULT_PARAMS, primary: parseColor("oklch(0.6 0.12 111)") },
      "seed-1",
    );
    const light = withId(lintSpec(spec), "P1").filter((f) => f.mode === "light");
    const subjects = light.map((f) => f.subject);
    expect(subjects).toEqual(expect.arrayContaining(["primary-600", "primary-700"]));
    for (const finding of light) {
      expect(finding.severity).toBe("info");
      expect(finding.measured).toBeLessThan(0.65);
      expect(finding.threshold).toBe(0.65);
      expect(finding.source).toBe("Palmer and Schloss, via Material Color Utilities");
      const step = Number(finding.subject.split("-")[1]);
      const entry = spec.color.palettes.primary.light.find((s) => s.step === step);
      expect(finding.measured).toBe(entry?.oklch.l);
    }
  });

  it("fires only when hue, chroma and lightness all hold, on primary, secondary and accent", () => {
    const spec = copyOf();
    const set = (palette: string, oklch: object) => {
      loose(spec).color.palettes[palette].light[6].oklch = oklch;
    };
    set("primary", { l: 0.5, c: 0.1, h: 90 });
    set("secondary", { l: 0.5, c: 0.1, h: 111 });
    set("accent", { l: 0.65, c: 0.1, h: 100 });
    set("success", { l: 0.5, c: 0.1, h: 100 });
    loose(spec).color.palettes.primary.light[7].oklch = { l: 0.5, c: 0.04, h: 100 };
    loose(spec).color.palettes.secondary.light[7].oklch = { l: 0.5, c: 0.1, h: 111.5 };
    const subjects = withId(lintSpec(spec), "P1").map((f) => f.subject);
    expect(subjects).toEqual(["primary-600", "secondary-600"]);
  });
});
