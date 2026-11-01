import { describe, expect, it } from "vitest";
import { oklchToRgb, rgbToOklch } from "@/engine/color/convert";
import { normalizeSeed } from "@/engine/color/palette";
import { parseColor } from "@/engine/color/parse";
import { generateSystem } from "@/engine/generate";
import { gamutExcess, lintSpec } from "@/engine/lint";
import { DEFAULT_PARAMS, defaultSpec, graySpec } from "../../spec/support";
import { copyOf, expectFinding, expectSilent, loose, withId } from "./support";

// G1 and G3: gamut and achromatic hue (C-LINT-28 to 31, 48 and 50).

/** The largest channel excess outside [0, 1], computed here apart from the linter. */
function excessOf(rgb: readonly number[]): number {
  return Math.max(0, ...rgb.map((v) => -v), ...rgb.map((v) => v - 1));
}

describe("G1 every stored color sits in the spec's gamut", () => {
  it("C-LINT-28 stays silent on the base spec", () => {
    expectSilent(defaultSpec(), "G1");
  });

  it("C-LINT-29 reports oklch(0.7 0.4 145) at primary light 500", () => {
    const spec = copyOf();
    const color = { l: 0.7, c: 0.4, h: 145 };
    loose(spec).color.palettes.primary.light[5].oklch = color;
    const found = expectFinding(spec, {
      id: "G1",
      severity: "error",
      mode: "light",
      subject: "primary-500",
      measured: excessOf(oklchToRgb(color, "srgb")),
      threshold: 2e-4,
    });
    expect(found.measured).toBeGreaterThan(2e-4);
    expect(found.source).toBe("CSS Color 4");
  });

  it("measures in the spec's gamut: the same color passes in P3 when it fits", () => {
    const spec = copyOf();
    loose(spec).color.params.gamut = "p3";
    loose(spec).color.palettes.primary.light[5].oklch = { l: 0.7, c: 0.25, h: 145 };
    expectSilent(spec, "G1");
    loose(spec).color.params.gamut = "srgb";
    expect(withId(lintSpec(spec), "G1").map((f) => f.subject)).toEqual(["primary-500"]);
  });

  it("allows 2e-4 and no more", () => {
    expect(gamutExcess({ l: 0.5, c: 0, h: null }, "srgb")).toBe(0);
    expect(gamutExcess(rgbToOklch([1.0002, 0.5, 0.5], "srgb"), "srgb")).toBeCloseTo(2e-4, 9);
  });

  it("C-LINT-48 raises no G1 for locked #0000ff, #00ff00, #ff00ff, #00fd1b and oklch(0.7 0.3 145)", () => {
    for (const text of ["#0000ff", "#00ff00", "#ff00ff", "#00fd1b", "oklch(0.7 0.3 145)"]) {
      const spec = generateSystem({ ...DEFAULT_PARAMS, primary: parseColor(text) }, "seed-1");
      const stored = spec.color.params.primary;
      expect(stored, text).toBeDefined();
      expect(withId(lintSpec(spec), "G1"), text).toEqual([]);
    }
    // The stored #0000ff really leaves [0, 1], by about 1.8e-6: G1's tolerance is what admits it.
    const blue = normalizeSeed(parseColor("#0000ff"));
    expect(gamutExcess(blue, "srgb")).toBeGreaterThan(1e-6);
    expect(gamutExcess(blue, "srgb")).toBeLessThan(2e-6);
  }, 60_000);

  /** The worst G1 excess of every hex whose stored seed `channels` yields. */
  function sweep(each: (visit: (r: number, g: number, b: number) => void) => void) {
    let worst = 0;
    let worstHex = "";
    let count = 0;
    each((r, g, b) => {
      count++;
      const text = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
      const seed = normalizeSeed(parseColor(text));
      const excess = gamutExcess(seed, "srgb");
      if (excess > worst) {
        worst = excess;
        worstHex = text;
      }
    });
    return { worst, worstHex, count };
  }

  it("C-LINT-50 keeps every boundary hex (a 00 or ff channel) within 2e-4; worst #00fd1b", () => {
    const result = sweep((visit) => {
      for (let r = 0; r < 256; r++) {
        for (let g = 0; g < 256; g++) {
          for (let b = 0; b < 256; b++) {
            const edge = (v: number) => v === 0 || v === 255;
            if (edge(r) || edge(g) || edge(b)) visit(r, g, b);
          }
        }
      }
    });
    expect(result.count).toBe(390_152);
    expect(result.worstHex).toBe("#00fd1b");
    expect(result.worst).toBeCloseTo(1.347e-4, 7);
    expect(result.worst).toBeLessThanOrEqual(2e-4);
  }, 120_000);

  it.runIf(process.env.DYELOT_EXHAUSTIVE === "1")(
    "C-LINT-50 keeps all 16,777,216 hexes within 2e-4 (DYELOT_EXHAUSTIVE=1)",
    () => {
      const result = sweep((visit) => {
        for (let r = 0; r < 256; r++) {
          for (let g = 0; g < 256; g++) {
            for (let b = 0; b < 256; b++) visit(r, g, b);
          }
        }
      });
      expect(result.count).toBe(16_777_216);
      expect(result.worstHex).toBe("#00fd1b");
      expect(result.worst).toBeLessThanOrEqual(2e-4);
    },
    1_800_000,
  );
});

describe("G3 an achromatic color has no hue", () => {
  it("C-LINT-30 stays silent on a tint-none spec whose neutral steps are c 0, h null", () => {
    const spec = graySpec();
    for (const mode of ["light", "dark"] as const) {
      for (const step of spec.color.palettes.neutral[mode]) {
        expect(step.oklch.c).toBe(0);
        expect(step.oklch.h).toBeNull();
      }
    }
    expectSilent(spec, "G3");
  });

  it("C-LINT-31 reports neutral-500 with c 0 and h 120", () => {
    const spec = copyOf(graySpec());
    loose(spec).color.palettes.neutral.light[5].oklch.h = 120;
    const found = expectFinding(spec, {
      id: "G3",
      severity: "error",
      mode: "light",
      subject: "neutral-500",
      measured: 0,
      threshold: 4e-6,
    });
    expect(found.source).toBe("CSS Color 4 (powerless hue)");
  });
});
