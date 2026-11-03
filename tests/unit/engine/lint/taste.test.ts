import { describe, expect, it } from "vitest";
import { PALETTE_NAMES } from "@/engine/color/palette";
import { parseColor } from "@/engine/color/parse";
import { STEPS } from "@/engine/color/scale";
import type { FontEntry } from "@/engine/fonts/catalog";
import { generateSystem } from "@/engine/generate";
import { lintSpec } from "@/engine/lint";
import { TAILWIND_HEXES } from "@/engine/lint/tailwind";
import { type Finding, RULE_IDS } from "@/engine/lint/types";
import type { DesignSpec } from "@/spec/schema";
import { DEFAULT_PARAMS, deepFreeze, defaultSpec } from "../../spec/support";
import { copyOf, loose } from "./support";
import { deriveTailwind } from "./tailwind-source";

// Cases are the C-TASTE-nn rows of docs/specs/02-studio.md, section 6.4 (Task 2.4). Fixtures start
// from SPEC, the base spec `generateSystem(DEFAULT_PARAMS, "seed-1")`. C-TASTE-22 (every M1 lint
// case passes unmodified except C-LINT-43 and C-LINT-47) has no test of its own: the M1 lint files
// beside this one carry it, and they run as M1 wrote them.

const only = (spec: DesignSpec, id: string, options?: Parameters<typeof lintSpec>[1]): Finding[] =>
  lintSpec(spec, options).filter((f) => f.id === id);

const withDisplay = (display: string): DesignSpec => {
  const spec = copyOf();
  loose(spec).type.families.display = display;
  return spec;
};
const withHue = (hue: number): DesignSpec => {
  const spec = copyOf();
  loose(spec).color.palettes.primary.hue = hue;
  return spec;
};
const withBody = (sizePx: number, context = "product"): DesignSpec => {
  const spec = copyOf();
  loose(spec).type.context = context;
  const body = loose(spec).type.steps.find((s: { name: string }) => s.name === "body");
  body.sizePx = sizePx;
  return spec;
};
const TAILWIND = deriveTailwind();
const hexOf = (name: string): string => {
  const found = TAILWIND.entries.find((entry) => entry.name === name);
  if (found === undefined) throw new Error(`no tailwind color ${name}`);
  return found.hex;
};
const withStepHex = (palette: string, mode: "light" | "dark", step: number, hex: string) => {
  const spec = copyOf();
  loose(spec).color.palettes[palette][mode][STEPS.indexOf(step as never)].hex = hex;
  return spec;
};

const fontFixture = (id: string, popularity: number): FontEntry => ({
  id,
  family: `Fixture ${id}`,
  category: "sans",
  variable: true,
  axes: ["wght"],
  weights: [100, 900],
  license: "OFL-1.1",
  popularity,
  fallback: "sans-serif",
});

describe("RULE_IDS", () => {
  it("C-TASTE-01 is M1's 20 ids followed by T1 to T4", () => {
    expect(RULE_IDS).toHaveLength(24);
    expect([...RULE_IDS].slice(20)).toEqual(["T1", "T2", "T3", "T4"]);
    expect(Object.isFrozen(RULE_IDS)).toBe(true);
  });
});

describe("T1 overused display face", () => {
  it("C-TASTE-02 passes for host-grotesk", () => {
    expect(only(defaultSpec(), "T1")).toEqual([]);
  });

  it("C-TASTE-03 fails for geist with the exact finding", () => {
    expect(only(withDisplay("geist"), "T1")).toEqual([
      {
        id: "T1",
        severity: "warn",
        mode: "light",
        subject: "display",
        measured: 1,
        threshold: 0.8,
        source: "research D2, D4: overused display face",
      },
    ]);
  });

  it("C-TASTE-04 fires at popularity 40 and not at 41 (fixture catalog)", () => {
    const catalog = [fontFixture("fx-40", 40), fontFixture("fx-41", 41)];
    const hit = only(withDisplay("fx-40"), "T1", { catalog });
    expect(hit).toHaveLength(1);
    expect(hit[0]?.measured).toBeCloseTo(0.80402, 4);
    expect(only(withDisplay("fx-41"), "T1", { catalog })).toEqual([]);
  });

  it("C-TASTE-05 skips a display id outside the catalog", () => {
    expect(only(withDisplay("not-a-font"), "T1")).toEqual([]);
  });
});

describe("T2 purple on white", () => {
  it("C-TASTE-06 fails at hue 280 with threshold 265 and at hue 290 with 300", () => {
    const base = { id: "T2", severity: "warn", mode: "light", subject: "primary" } as const;
    const source = "research D4: purple on white";
    expect(only(withHue(280), "T2")).toEqual([{ ...base, measured: 280, threshold: 265, source }]);
    expect(only(withHue(290), "T2")).toEqual([{ ...base, measured: 290, threshold: 300, source }]);
  });

  it("C-TASTE-07 fires at 265 and 300, not at 264.99 or 300.01", () => {
    expect(only(withHue(265), "T2")).toHaveLength(1);
    expect(only(withHue(300), "T2")).toHaveLength(1);
    expect(only(withHue(264.99), "T2")).toEqual([]);
    expect(only(withHue(300.01), "T2")).toEqual([]);
  });

  it("C-TASTE-08 is silent for a locked primary and for a page that is not #ffffff", () => {
    const locked = generateSystem(
      { ...DEFAULT_PARAMS, primary: parseColor("oklch(0.55 0.2 285)") },
      "seed-1",
    );
    expect(locked.color.palettes.primary.hue).toBeGreaterThanOrEqual(265);
    expect(locked.color.palettes.primary.hue).toBeLessThanOrEqual(300);
    expect(only(locked, "T2")).toEqual([]);
    const off = withHue(280);
    loose(off).color.roles.light.background = "#fafafa";
    expect(only(off, "T2")).toEqual([]);
  });

  it("C-TASTE-09 never reports mode dark", () => {
    for (const hue of [265, 280, 290, 300]) {
      for (const finding of only(withHue(hue), "T2")) expect(finding.mode).toBe("light");
    }
  });

  it("C-TASTE-17 fires on SPEC, which is why C-LINT-47 filters to M1 ids", () => {
    const spec = defaultSpec();
    expect(spec.color.palettes.primary.hue).toBeCloseTo(289, 0);
    expect(spec.color.roles.light.background).toBe("#ffffff");
    expect(only(spec, "T2")).toHaveLength(1);
  });
});

describe("T3 Tailwind defaults", () => {
  it("C-TASTE-10 fails for indigo-500 at primary step 600, light", () => {
    const spec = withStepHex("primary", "light", 600, hexOf("indigo-500"));
    expect(only(spec, "T3")).toEqual([
      {
        id: "T3",
        severity: "warn",
        mode: "light",
        subject: "primary-600",
        measured: 0,
        threshold: 0,
        source: "research D4: Tailwind defaults used verbatim",
      },
    ]);
  });

  it("C-TASTE-11 reads dark steps and covers all 8 palettes", () => {
    for (const palette of PALETTE_NAMES) {
      for (const mode of ["light", "dark"] as const) {
        const hits = only(withStepHex(palette, mode, 500, hexOf("rose-400")), "T3");
        expect(hits.map((f) => [f.mode, f.subject])).toEqual([[mode, `${palette}-500`]]);
      }
    }
  });

  it("C-TASTE-12 derives 26 palettes, 286 entries and 283 distinct hexes from theme.css", () => {
    const { entries, palettes, hexes } = TAILWIND;
    expect(palettes).toHaveLength(26);
    expect(palettes).toEqual(expect.arrayContaining(["mauve", "olive", "mist", "taupe"]));
    expect(entries).toHaveLength(286);
    expect(hexes.size).toBe(283);
    expect(hexes.has("#000000" as never)).toBe(false);
    expect(hexes.has("#ffffff" as never)).toBe(false);
    expect(new Set(TAILWIND_HEXES)).toEqual(hexes);
    expect(TAILWIND_HEXES).toHaveLength(283);
    expect(Object.isFrozen(TAILWIND_HEXES)).toBe(true);
  });

  it("C-TASTE-16 reads steps 300 to 800 only", () => {
    const hex = hexOf("emerald-500");
    for (const step of [300, 400, 500, 600, 700, 800]) {
      expect(only(withStepHex("accent", "light", step, hex), "T3")).toHaveLength(1);
    }
    for (const step of [50, 100, 200, 900, 950]) {
      expect(only(withStepHex("accent", "light", step, hex), "T3")).toEqual([]);
    }
  });
});

describe("T4 body size", () => {
  it("C-TASTE-14 fails at 15 px in the product context", () => {
    expect(only(withBody(15), "T4")).toEqual([
      {
        id: "T4",
        severity: "warn",
        mode: "light",
        subject: "body",
        measured: 15,
        threshold: 16,
        source: "research D1 rule 20: body size floor",
      },
    ]);
  });

  it("C-TASTE-15 fires below 16 and not at 16, and the dense context is exempt", () => {
    expect(only(withBody(16), "T4")).toEqual([]);
    expect(only(withBody(15.999), "T4")).toHaveLength(1);
    expect(only(withBody(14, "dense"), "T4")).toEqual([]);
  });
});

describe("the taste rules as a group", () => {
  it("C-TASTE-18 skips T1 and T4 without a type section", () => {
    const locked = generateSystem({ ...DEFAULT_PARAMS, primary: parseColor("#1f6f5b") }, "seed-1");
    const colorOnly = lintSpec({ color: locked.color });
    expect(colorOnly.filter((f) => f.id.startsWith("T"))).toEqual([]);
    const m1 = (findings: readonly Finding[]) => findings.filter((f) => !f.id.startsWith("T"));
    expect(m1(colorOnly)).toEqual(m1(lintSpec(locked)));
  });

  it("C-TASTE-19 sorts severity, id, mode, subject across M1 and taste rules", () => {
    const spec = withDisplay("geist");
    loose(spec).color.roles.light.foreground = "#767676"; // C4 (advisory) without a C1 error
    loose(spec).color.palettes.primary.light[1].oklch.l =
      spec.color.palettes.primary.light[0].oklch.l - 0.005; // K2
    const keep = new Set(["C4", "K2", "T1", "N3"]);
    const ids = lintSpec(spec)
      .filter((f) => keep.has(f.id))
      .map((f) => `${f.severity}:${f.id}`);
    expect(ids.slice(0, 3)).toEqual(["warn:C4", "warn:K2", "warn:T1"]);
    expect(ids.slice(3).every((id) => id === "info:N3")).toBe(true);
    expect(ids.slice(3).length).toBeGreaterThan(0);
  });

  it("C-TASTE-20 rejects a malformed type section", () => {
    const badDisplay = copyOf();
    loose(badDisplay).type.families.display = 3;
    expect(() => lintSpec(badDisplay)).toThrow(TypeError);
    expect(() => lintSpec(badDisplay)).toThrow(/^lintSpec:/);
    const noBody = copyOf();
    loose(noBody).type.steps = loose(noBody).type.steps.filter(
      (s: { name: string }) => s.name !== "body",
    );
    expect(() => lintSpec(noBody)).toThrow(TypeError);
    expect(() => lintSpec(noBody)).toThrow(/^lintSpec:/);
    expect(() => lintSpec(withBody(Number.NaN))).toThrow(RangeError);
    expect(() => lintSpec(withBody(Number.POSITIVE_INFINITY))).toThrow(/^lintSpec:/);
  });

  it("C-TASTE-21 does not mutate its input and repeats", () => {
    const frozen = deepFreeze(copyOf());
    const first = lintSpec(frozen);
    expect(lintSpec(frozen)).toEqual(first);
  });

  it("C-TASTE-23 accepts a full DesignSpec and reads its type and shape", () => {
    const spec = withBody(15);
    expect(only(spec, "T4")).toHaveLength(1);
    expect(lintSpec(defaultSpec()).map((f) => f.id)).toContain("T2");
  });
});
