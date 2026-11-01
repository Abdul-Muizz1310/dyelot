import { describe, expect, it } from "vitest";
import { generateSystem, hexToRgb, ROLE_NAMES, wcagRatio } from "@/engine";
import { COPY } from "@/features/preview/copy";
import { FRAMES, frameFit } from "@/features/preview/frame";
import {
  BUTTON_VARIANTS,
  KIT_COMPONENTS,
  KIT_STATES,
  statesOf,
} from "@/features/preview/kit/states";
import { swatches, TEXT_PAIRS } from "@/features/preview/swatches";
import { canvasStyle, cssVariables } from "@/features/preview/vars";
import { freshParams, resolveParams } from "@/features/studio/params";
import { densityVars, themeVars } from "@/theme/vars";

// The preview's pure helpers (docs/specs/02-studio.md, sections 7.4 and 7.5, R2-16 item 3, R2-21):
// the fit of a frame wider than the canvas area (F-CANVAS-03), the kitchen sink's swatches and
// ratios (F-TPL-01, F-TPL-02), the kit's states (F-TPL-03) and the edge-case copy (F-CANVAS-09).
// Their R-05 checks: a wrong type is a TypeError, an out-of-domain value a RangeError.

const SPEC = generateSystem(resolveParams(freshParams(), "seed-1"), "seed-1");

describe("frameFit (R2-16 item 3, F-CANVAS-03)", () => {
  it("lists the three frames", () => {
    expect(FRAMES).toEqual([360, 768, 1280]);
    expect(Object.isFrozen(FRAMES)).toBe(true);
  });

  it("keeps a frame that fits at scale 1 and says fit 100%", () => {
    expect(frameFit(1400, 1280)).toEqual({ scale: 1, label: "fit 100%" });
    expect(frameFit(360, 360)).toEqual({ scale: 1, label: "fit 100%" });
  });

  it("scales a wider frame to the area and floors the percent, so a scaled frame never says 100%", () => {
    expect(frameFit(552, 1280)).toEqual({ scale: 552 / 1280, label: "fit 43%" });
    expect(frameFit(1164.8, 1280)).toEqual({ scale: 1164.8 / 1280, label: "fit 91%" });
    expect(frameFit(1279.9, 1280).label).toBe("fit 99%");
    expect(frameFit(328, 768).scale).toBeCloseTo(0.4271, 4);
  });

  it("throws RangeError for an area that is not positive and finite, or an unknown frame", () => {
    for (const area of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => frameFit(area, 360)).toThrow(RangeError);
    }
    expect(() => frameFit(500, 1024 as never)).toThrow(/frameFit: frame/);
    expect(() => frameFit(500, 1024 as never)).toThrow(RangeError);
  });

  it("throws TypeError for a value that is not a number", () => {
    expect(() => frameFit("500" as never, 360)).toThrow(TypeError);
    expect(() => frameFit(500, "360" as never)).toThrow(TypeError);
    expect(() => frameFit(500, "360" as never)).toThrow(/frameFit/);
  });
});

describe("canvasStyle (section 7.4, R2-12, F-CANVAS-01, F-CANVAS-06)", () => {
  it("is themeVars with cqi units and the density's two properties: 206 in all", () => {
    const style = canvasStyle(SPEC, "dark", { vision: "none", density: "compact" });
    expect(style).toEqual({
      ...themeVars(SPEC, "dark", { units: "cqi" }),
      ...densityVars("compact"),
    });
    expect(Object.keys(style)).toHaveLength(206);
  });

  it("recomputes the colors through simulate for a color-vision view", () => {
    expect(canvasStyle(SPEC, "light", { vision: "deutan", density: "dense" })).toEqual({
      ...themeVars(SPEC, "light", { vision: "deutan", units: "cqi" }),
      ...densityVars("dense"),
    });
  });

  it("cssVariables merges groups and rejects a name that is not a custom property", () => {
    expect(cssVariables({ "--a": "1" }, { "--b": "2" })).toEqual({ "--a": "1", "--b": "2" });
    expect(() => cssVariables({ color: "inherit" })).toThrow(RangeError);
    expect(() => cssVariables({ color: "inherit" })).toThrow(/cssVariables/);
  });
});

describe("swatches (F-TPL-01, F-TPL-02)", () => {
  it("pairs each text role with the fill it sits on: 18 pairs", () => {
    expect(TEXT_PAIRS).toEqual({
      foreground: "background",
      "card-foreground": "card",
      "popover-foreground": "popover",
      "muted-foreground": "muted",
      "secondary-foreground": "secondary",
      "accent-foreground": "accent",
      "primary-foreground": "primary",
      "destructive-foreground": "destructive",
      "destructive-subtle-foreground": "destructive-subtle",
      "success-foreground": "success",
      "success-subtle-foreground": "success-subtle",
      "warning-foreground": "warning",
      "warning-subtle-foreground": "warning-subtle",
      "info-foreground": "info",
      "info-subtle-foreground": "info-subtle",
      "sidebar-foreground": "sidebar",
      "sidebar-primary-foreground": "sidebar-primary",
      "sidebar-accent-foreground": "sidebar-accent",
    });
    expect(Object.isFrozen(TEXT_PAIRS)).toBe(true);
  });

  it.each(["light", "dark"] as const)(
    "gives all 46 roles of %s in ROLE_NAMES order with the stored hex",
    (mode) => {
      const rows = swatches(SPEC, mode);
      expect(rows.map((row) => row.role)).toEqual([...ROLE_NAMES]);
      for (const row of rows) expect(row.hex).toBe(SPEC.color.roles[mode][row.role]);
    },
  );

  it.each(["light", "dark"] as const)(
    "measures each text pair of %s with wcagRatio and leaves the other roles unpaired",
    (mode) => {
      const roles = SPEC.color.roles[mode];
      for (const row of swatches(SPEC, mode)) {
        const fill = (TEXT_PAIRS as Record<string, string | undefined>)[row.role];
        if (fill === undefined) {
          expect(row.pair, row.role).toBeNull();
          continue;
        }
        expect(row.pair?.fill).toBe(fill);
        expect(row.pair?.ratio).toBe(
          wcagRatio(hexToRgb(roles[row.role]), hexToRgb(roles[fill as keyof typeof roles])),
        );
      }
      expect(swatches(SPEC, mode).filter((row) => row.pair !== null)).toHaveLength(18);
    },
  );

  it("returns a frozen list and leaves the spec alone", () => {
    const before = JSON.stringify(SPEC);
    const rows = swatches(SPEC, "light");
    expect(Object.isFrozen(rows)).toBe(true);
    expect(Object.isFrozen(rows[0])).toBe(true);
    expect(JSON.stringify(SPEC)).toBe(before);
  });

  it("throws TypeError naming swatches for a spec without roles, and RangeError for a mode", () => {
    expect(() => swatches(null as never, "light")).toThrow(TypeError);
    expect(() => swatches({} as never, "light")).toThrow(/swatches/);
    expect(() => swatches({ color: { roles: {} } } as never, "light")).toThrow(TypeError);
    const holed = structuredClone(SPEC) as { color: { roles: { light: Record<string, unknown> } } };
    delete holed.color.roles.light.ring;
    expect(() => swatches(holed as never, "light")).toThrow(/swatches: .*ring/);
    expect(() => swatches(SPEC, "dim" as never)).toThrow(RangeError);
    expect(() => swatches(SPEC, 1 as never)).toThrow(TypeError);
  });
});

describe("the kit's components and states (section 7.5, F-TPL-03)", () => {
  it("lists the 13 states in the spec's order", () => {
    expect(KIT_STATES).toEqual([
      "default",
      "hover",
      "focus-visible",
      "pressed",
      "selected",
      "indeterminate",
      "disabled",
      "read-only",
      "loading",
      "invalid",
      "success",
      "placeholder",
      "empty",
    ]);
  });

  it("lists the 21 components of section 7.5 and the five button variants", () => {
    expect(KIT_COMPONENTS.map((component) => component.id)).toEqual([
      "button",
      "input",
      "textarea",
      "select",
      "checkbox",
      "radio",
      "switch",
      "tab",
      "menu-item",
      "table-row",
      "card",
      "badge",
      "alert",
      "tooltip",
      "dialog",
      "sheet",
      "toast",
      "avatar",
      "chip",
      "skeleton",
      "progress",
    ]);
    expect(BUTTON_VARIANTS).toEqual(["primary", "secondary", "ghost", "destructive", "link"]);
  });

  it("gives every component at least one state, each a known one, and covers all 13", () => {
    const seen = new Set<string>();
    for (const component of KIT_COMPONENTS) {
      expect(component.states.length, component.id).toBeGreaterThan(0);
      expect(component.states[0], component.id).toMatch(/^(default|loading)$/);
      expect(new Set(component.states).size, component.id).toBe(component.states.length);
      for (const state of component.states) {
        expect(KIT_STATES).toContain(state);
        seen.add(state);
      }
    }
    expect([...seen].sort()).toEqual([...KIT_STATES].sort());
  });

  it("gives a control the interactive states it supports", () => {
    expect(statesOf("button")).toEqual([
      "default",
      "hover",
      "focus-visible",
      "pressed",
      "disabled",
      "loading",
    ]);
    expect(statesOf("checkbox")).toEqual(expect.arrayContaining(["selected", "indeterminate"]));
    expect(statesOf("input")).toEqual(
      expect.arrayContaining(["placeholder", "read-only", "invalid", "success"]),
    );
    expect(statesOf("table-row")).toContain("empty");
  });

  it("is frozen, and statesOf rejects an unknown component", () => {
    expect(Object.isFrozen(KIT_COMPONENTS)).toBe(true);
    expect(Object.isFrozen(KIT_COMPONENTS[0]?.states)).toBe(true);
    expect(() => statesOf("carousel" as never)).toThrow(RangeError);
    expect(() => statesOf(3 as never)).toThrow(TypeError);
  });
});

describe("the canvas copy (R2-21, F-CANVAS-09)", () => {
  it("writes the edge-case copy the ruling lists", () => {
    const edge = COPY.edge;
    expect(edge.word).toMatch(/^\S{40}$/);
    expect(edge.title).toHaveLength(90);
    expect(edge.person.normalize("NFD")).not.toBe(edge.person);
    expect(edge.amount).toBe("1,234,567,890.12");
    expect(edge.items).toEqual([]);
    expect(edge.label).toHaveLength(1);
  });

  it("writes real copy of the same shape, with no emoji and no banned word", () => {
    expect(Object.keys(COPY.real).sort()).toEqual(Object.keys(COPY.edge).sort());
    expect(COPY.real.items.length).toBeGreaterThan(1);
    for (const value of Object.values(COPY.real).flat()) {
      expect(value).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(value).not.toMatch(/\b(simply|just|easy|obviously|basically)\b|!/i);
    }
    expect(Object.isFrozen(COPY.edge.items)).toBe(true);
  });
});
