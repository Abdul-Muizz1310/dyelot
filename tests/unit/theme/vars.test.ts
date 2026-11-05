import { readFileSync } from "node:fs";
import path from "node:path";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  applyPreset,
  type DirectionParams,
  fontStack,
  formatOklch,
  generateSystem,
  type Hex,
  hexToRgb,
  PALETTE_NAMES,
  PRESET_IDS,
  ROLE_NAMES,
  STEPS,
  simulate,
  toHex,
  typeWeights,
} from "@/engine";
import type { DesignSpec } from "@/spec";
import { densityVars, feelSpring, themeVars } from "@/theme/vars";

// Cases are the C-THEME-nn rows of docs/specs/02-studio.md, section 6.6 (Task 2.5a). The property
// names are written out from section 5.6, so the tests do not borrow the implementation's lists.

const BASE: DirectionParams = {
  harmony: "analogous",
  chroma: "balanced",
  neutralTint: "brand",
  gamut: "srgb",
  scaleMode: "standard",
  contrastLevel: "AA",
  type: { context: "product" },
  radius: "soft",
  depth: "soft",
  motion: "brisk",
};

const cache = new Map<string, DesignSpec>();
/** One generated spec per key and test file: generation is the slow part of this suite. */
function spec(key: string, patch: Partial<DirectionParams>, seed = "seed-1"): DesignSpec {
  let hit = cache.get(key);
  if (hit === undefined) {
    hit = generateSystem({ ...BASE, ...patch }, seed);
    cache.set(key, hit);
  }
  return hit;
}
const SOFT = () => spec("soft", {});
const CALM_LAYERED = () =>
  spec("calm-layered", { depth: "layered", motion: "calm", type: { context: "marketing" } });
const PLAYFUL_FLAT = () =>
  spec("playful-flat", { depth: "flat", motion: "playful", type: { context: "editorial" } });

const STEP_NAMES = [
  "caption",
  "label",
  "body-sm",
  "body",
  "lead",
  "h4",
  "h3",
  "h2",
  "h1",
  "display",
] as const;
const UNITS = [0, 1, 2, 3, 4, 6, 8, 12, 16, 20, 24, 32] as const;
const RADII = ["sm", "md", "lg", "xl", "2xl"] as const;
const DURATIONS = ["instant", "fast", "quick", "base", "slow", "slower", "slowest"] as const;
const EASINGS = ["standard", "decelerate", "accelerate", "emphasized"] as const;
const HEX = /^#[0-9a-f]{6}$/;

/** The 207 names of section 5.6 and R3-06, in order. */
const NAMES: readonly string[] = [
  ...ROLE_NAMES.map((role) => `--${role}`),
  ...PALETTE_NAMES.flatMap((palette) => STEPS.map((step) => `--${palette}-${step}`)),
  ...STEP_NAMES.flatMap((step) => [`--text-${step}`, `--leading-${step}`, `--tracking-${step}`]),
  "--font-display",
  "--font-body",
  "--font-mono",
  "--weight-heading",
  "--weight-label",
  "--weight-body",
  ...UNITS.map((unit) => `--space-${unit}`),
  ...RADII.map((name) => `--radius-${name}`),
  "--radius-full",
  ...[1, 2, 3, 4, 5].map((level) => `--shadow-${level}`),
  ...DURATIONS.map((name) => `--duration-${name}`),
  ...EASINGS.map((name) => `--ease-${name}`),
  "--spring-duration",
  "--spring-bounce",
  "--icon-stroke",
];

/** A deep copy that tests may change. */
function clone(value: DesignSpec): DesignSpec {
  return structuredClone(value);
}

const SHADOW =
  /^0 \d+(\.\d+)?px \d+(\.\d+)?px 0 oklch\(\d\.\d{4} \d\.\d{4} (\d+\.\d{2}|none) \/ \d(\.\d+)?\), 0 \d+(\.\d+)?px \d+(\.\d+)?px 0 oklch\(\d\.\d{4} \d\.\d{4} (\d+\.\d{2}|none) \/ \d(\.\d+)?\)$/;

describe("C-THEME-01 the 207 properties", () => {
  it.each(["light", "dark"] as const)("lists the names of section 5.6 in order for %s", (mode) => {
    const vars = themeVars(SOFT(), mode);
    expect(NAMES).toHaveLength(207);
    expect(Object.keys(vars)).toEqual(NAMES);
  });
});

describe("C-THEME-02 roles", () => {
  it.each(["light", "dark"] as const)("emits the 46 roles for %s", (mode) => {
    const s = SOFT();
    const vars = themeVars(s, mode);
    expect(ROLE_NAMES).toHaveLength(46);
    for (const role of ROLE_NAMES) expect(vars[`--${role}`]).toBe(s.color.roles[mode][role]);
  });
});

describe("C-THEME-03 scales", () => {
  it.each(["light", "dark"] as const)("emits the 88 steps for %s", (mode) => {
    const s = SOFT();
    const vars = themeVars(s, mode);
    let seen = 0;
    for (const palette of PALETTE_NAMES) {
      s.color.palettes[palette][mode].forEach((entry, index) => {
        expect(entry.step).toBe(STEPS[index]);
        expect(vars[`--${palette}-${entry.step}`]).toBe(entry.hex);
        seen += 1;
      });
    }
    expect(seen).toBe(88);
  });
});

describe("C-THEME-04 stored hexes only", () => {
  it.each(["light", "dark"] as const)("every color value is a stored hex for %s", (mode) => {
    const s = SOFT();
    const stored = new Set<string>([
      ...Object.values(s.color.roles[mode]),
      ...PALETTE_NAMES.flatMap((p) => s.color.palettes[p][mode].map((e) => e.hex)),
    ]);
    const vars = themeVars(s, mode);
    const colors = NAMES.slice(0, 134).map((name) => vars[name]);
    expect(colors).toHaveLength(134);
    for (const value of colors) {
      expect(value).toMatch(HEX);
      expect(stored.has(value as string)).toBe(true);
    }
  });
});

describe("C-THEME-05 type steps", () => {
  it("writes size, line height and tracking for the 10 steps", () => {
    const s = SOFT();
    const vars = themeVars(s, "light");
    expect(s.type.steps).toHaveLength(10);
    for (const step of s.type.steps) {
      expect(vars[`--text-${step.name}`]).toBe(`${step.sizePx}px`);
      expect(vars[`--leading-${step.name}`]).toBe(`${step.lineHeightPx}px`);
      expect(vars[`--tracking-${step.name}`]).toBe(`${step.trackingEm}em`);
    }
  });
});

describe("C-THEME-06 and C-THEME-28 the fluid display step", () => {
  const display = (s: DesignSpec) => s.type.steps[9];

  it.each([CALM_LAYERED, PLAYFUL_FLAT])(
    "keeps the clamp string in marketing and editorial",
    (make) => {
      const s = make();
      expect(display(s).clamp).toMatch(/^clamp\(/);
      expect(themeVars(s, "light")["--text-display"]).toBe(display(s).clamp);
      expect(themeVars(s, "light", { units: "vw" })["--text-display"]).toBe(display(s).clamp);
    },
  );

  it("writes <sizePx>px in a context without a fluid display", () => {
    const s = SOFT();
    expect(display(s).clamp).toBeUndefined();
    expect(themeVars(s, "light")["--text-display"]).toBe(`${display(s).sizePx}px`);
    expect(themeVars(s, "light", { units: "cqi" })["--text-display"]).toBe(
      `${display(s).sizePx}px`,
    );
  });

  it.each([CALM_LAYERED, PLAYFUL_FLAT])("writes every vw as cqi under units cqi", (make) => {
    const s = make();
    const clamp = display(s).clamp as string;
    const value = themeVars(s, "light", { units: "cqi" })["--text-display"] as string;
    expect(clamp).toContain("vw");
    expect(value).toBe(clamp.replaceAll("vw", "cqi"));
    expect(value).not.toContain("vw");
  });
});

describe("R3-06 type weights", () => {
  it("writes the integers of typeWeights, whatever the mode or vision", () => {
    const s = SOFT();
    const { heading, label, body } = typeWeights(s);
    for (const vars of [
      themeVars(s, "light"),
      themeVars(s, "dark"),
      themeVars(s, "light", { vision: "protan" }),
    ]) {
      expect(vars["--weight-heading"]).toBe(String(heading));
      expect(vars["--weight-label"]).toBe(String(label));
      expect(vars["--weight-body"]).toBe(String(body));
    }
  });
});

describe("C-THEME-07 and C-THEME-08 font families", () => {
  it("uses fontStack of the three families", () => {
    const s = SOFT();
    const vars = themeVars(s, "light");
    expect(vars["--font-display"]).toMatch(/^"[^"]+", /);
    expect(vars["--font-body"]).toMatch(/^"[^"]+", /);
    expect(vars["--font-mono"]).toMatch(/^"[^"]+", .*monospace$/);
  });

  it("matches the catalog entry of each family", () => {
    const s = SOFT();
    const vars = themeVars(s, "light");
    expect(vars["--font-display"]).toBe(fontStack(s.type.families.display));
    expect(vars["--font-body"]).toBe(fontStack(s.type.families.body));
    expect(vars["--font-mono"]).toBe(fontStack(s.type.families.mono));
  });

  it("falls back to the sans or mono stack for an id outside the catalog", () => {
    const s = clone(SOFT());
    s.type.families = { display: "not-in-catalog", body: "also-missing", mono: "nope-mono" };
    const vars = themeVars(s, "light");
    expect(vars["--font-display"]).toBe(
      'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    );
    expect(vars["--font-body"]).toBe(vars["--font-display"]);
    expect(vars["--font-mono"]).toBe('ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace');
  });
});

describe("C-THEME-09 to C-THEME-10 space and radius", () => {
  it("writes the 12 space units", () => {
    const vars = themeVars(SOFT(), "light");
    for (const unit of UNITS) expect(vars[`--space-${unit}`]).toBe(`${unit * 4}px`);
    expect(vars["--space-0"]).toBe("0px");
  });

  it("writes the radii and the full radius", () => {
    const s = SOFT();
    const vars = themeVars(s, "light");
    for (const name of RADII) expect(vars[`--radius-${name}`]).toBe(`${s.shape.radii[name]}px`);
    expect(vars["--radius-full"]).toBe("9999px");
  });
});

describe("C-THEME-11 to C-THEME-13 shadows", () => {
  it("C-THEME-11 and C-THEME-13 soft writes the stored layers, key then ambient, colored by formatOklch with the alpha inside", () => {
    const s = SOFT();
    const vars = themeVars(s, "light");
    const [key, ambient] = s.depth.shadows[2] as [
      (typeof s.depth.shadows)[1][0],
      (typeof s.depth.shadows)[1][0],
    ];
    const color = (l: typeof key) => formatOklch(l.color).replace(/\)$/, ` / ${l.alpha})`);
    expect(vars["--shadow-2"]).toBe(
      `0 ${key.offsetY}px ${key.blur}px 0 ${color(key)}, 0 ${ambient.offsetY}px ${ambient.blur}px 0 ${color(ambient)}`,
    );
    expect(vars["--shadow-2"]).toMatch(
      /^0 4px 8px 0 oklch\(.+ \/ 0\.1\), 0 2px 4px 0 oklch\(.+ \/ 0\.06\)$/,
    );
    for (const level of [1, 2, 3, 4, 5]) expect(vars[`--shadow-${level}`]).toMatch(SHADOW);
  });

  it("C-THEME-12 flat writes none for the five shadows", () => {
    const vars = themeVars(PLAYFUL_FLAT(), "light");
    for (const level of [1, 2, 3, 4, 5]) expect(vars[`--shadow-${level}`]).toBe("none");
  });

  it("C-THEME-12 layered scales offset, blur and alpha by 1.5", () => {
    const vars = themeVars(CALM_LAYERED(), "light");
    expect(vars["--shadow-2"]).toMatch(
      /^0 6px 12px 0 oklch\(.+ \/ 0\.15\), 0 3px 6px 0 oklch\(.+ \/ 0\.09\)$/,
    );
    expect(vars["--shadow-5"]).toMatch(/^0 15px 30px 0 /);
  });

  it("C-THEME-12 layered caps alpha at 1", () => {
    const s = clone(CALM_LAYERED());
    const layer = s.depth.shadows[1][0];
    layer.alpha = 0.9;
    expect(themeVars(s, "light")["--shadow-1"]).toMatch(/^0 3px 6px 0 oklch\([^)]* \/ 1\), /);
  });
});

describe("C-THEME-14 to C-THEME-17 motion and icons", () => {
  const ms = (vars: Readonly<Record<string, string>>) =>
    DURATIONS.map((name) => vars[`--duration-${name}`]);

  it("C-THEME-14 keeps the stored durations for brisk and playful", () => {
    for (const s of [SOFT(), PLAYFUL_FLAT()]) {
      expect(ms(themeVars(s, "light"))).toEqual(
        DURATIONS.map((name) => `${s.motion.durations[name]}ms`),
      );
    }
  });

  it("C-THEME-14 scales calm by 1.25, rounds ties up and caps at 500", () => {
    expect(ms(themeVars(CALM_LAYERED(), "light"))).toEqual(
      [63, 125, 188, 250, 375, 500, 500].map((n) => `${n}ms`),
    );
  });

  it("C-THEME-15 writes the four easings", () => {
    const vars = themeVars(SOFT(), "light");
    expect(vars["--ease-standard"]).toBe("cubic-bezier(0.2, 0, 0, 1)");
    expect(vars["--ease-decelerate"]).toBe("cubic-bezier(0, 0, 0, 1)");
    expect(vars["--ease-accelerate"]).toBe("cubic-bezier(0.3, 0, 1, 1)");
    expect(vars["--ease-emphasized"]).toBe("cubic-bezier(0.05, 0.7, 0.1, 1)");
  });

  it.each([
    [CALM_LAYERED, "0.4", "0", { visualDuration: 0.4, bounce: 0 }],
    [SOFT, "0.25", "0.1", { visualDuration: 0.25, bounce: 0.1 }],
    [PLAYFUL_FLAT, "0.5", "0.35", { visualDuration: 0.5, bounce: 0.35 }],
  ] as const)("C-THEME-16 follows the feel's spring", (make, duration, bounce, spring) => {
    const s = make();
    const vars = themeVars(s, "light");
    expect(vars["--spring-duration"]).toBe(duration);
    expect(vars["--spring-bounce"]).toBe(bounce);
    expect(feelSpring(s.motion)).toEqual(spring);
  });

  it("C-THEME-17 writes the icon stroke", () => {
    const s = SOFT();
    expect(themeVars(s, "light")["--icon-stroke"]).toBe(String(s.components.icons.strokePx));
  });
});

describe("C-THEME-18 modes differ in roles and scales only", () => {
  it("keeps every other property equal", () => {
    for (const s of [SOFT(), CALM_LAYERED()]) {
      const light = themeVars(s, "light");
      const dark = themeVars(s, "dark");
      for (const name of NAMES.slice(134)) expect(dark[name]).toBe(light[name]);
      expect(dark["--background"]).not.toBe(light["--background"]);
    }
  });
});

describe("C-THEME-19 to C-THEME-20 color vision", () => {
  it.each(["protan", "deutan", "tritan"] as const)(
    "simulates %s on color values only",
    (vision) => {
      const s = SOFT();
      const plain = themeVars(s, "light");
      const seen = themeVars(s, "light", { vision });
      for (const name of NAMES.slice(0, 134)) {
        expect(seen[name]).toBe(toHex(simulate(hexToRgb(plain[name] as Hex), vision)));
      }
      for (const name of NAMES.slice(134)) expect(seen[name]).toBe(plain[name]);
      expect(seen["--primary-500"]).not.toBe(plain["--primary-500"]);
    },
  );

  it("matches the result without options when vision is absent", () => {
    const s = SOFT();
    const plain = themeVars(s, "dark");
    expect(themeVars(s, "dark", {})).toEqual(plain);
    expect(themeVars(s, "dark", { vision: undefined })).toEqual(plain);
  });
});

describe("C-THEME-21 and C-THEME-22 frozen, pure and distinct", () => {
  it("freezes the result, leaves the input alone and repeats itself", () => {
    const s = clone(SOFT());
    const before = JSON.stringify(s);
    const first = themeVars(s, "light");
    expect(Object.isFrozen(first)).toBe(true);
    expect(JSON.stringify(s)).toBe(before);
    expect(themeVars(s, "light")).toEqual(first);
  });

  it("has 207 distinct names", () => {
    expect(new Set(Object.keys(themeVars(SOFT(), "light"))).size).toBe(207);
  });
});

describe("C-THEME-23 no value can leave its declaration", () => {
  it("holds over presets and seeds", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...PRESET_IDS),
        fc.string({ minLength: 1, maxLength: 12 }),
        fc.constantFrom("light", "dark", "cqi") as fc.Arbitrary<"light" | "dark" | "cqi">,
        (preset, seed, pick) => {
          const s = generateSystem(applyPreset(BASE, preset), seed);
          const mode = pick === "dark" ? "dark" : "light";
          const vars = themeVars(s, mode, pick === "cqi" ? { units: "cqi" } : undefined);
          for (const value of Object.values(vars)) {
            expect(value.length).toBeGreaterThan(0);
            expect(value).not.toMatch(/[;{}<]/);
          }
        },
      ),
      { numRuns: 25 },
    );
  }, 120_000);
});

describe("C-THEME-24 to C-THEME-26 and C-THEME-29 failures", () => {
  it("C-THEME-24 rejects a mode other than light and dark", () => {
    expect(() => themeVars(SOFT(), "sepia" as never)).toThrow(RangeError);
    expect(() => themeVars(SOFT(), "sepia" as never)).toThrow(/themeVars/);
  });

  it("C-THEME-24 rejects a non-string mode", () => {
    expect(() => themeVars(SOFT(), 1 as never)).toThrow(TypeError);
    expect(() => themeVars(SOFT(), 1 as never)).toThrow(/themeVars/);
  });

  it("C-THEME-24 rejects an unknown or non-string vision", () => {
    expect(() => themeVars(SOFT(), "light", { vision: "x" as never })).toThrow(RangeError);
    expect(() => themeVars(SOFT(), "light", { vision: "x" as never })).toThrow(/themeVars/);
    expect(() => themeVars(SOFT(), "light", { vision: 3 as never })).toThrow(TypeError);
  });

  it("rejects options that are not an object", () => {
    expect(() => themeVars(SOFT(), "light", null as never)).toThrow(TypeError);
    expect(() => themeVars(SOFT(), "light", "vw" as never)).toThrow(/themeVars/);
  });

  it.each([null, "spec", 4, undefined, [], {}, { color: {} }, { color: { roles: null } }])(
    "C-THEME-25 rejects a spec that is not an object with color.roles: %j",
    (bad) => {
      expect(() => themeVars(bad as never, "light")).toThrow(TypeError);
      expect(() => themeVars(bad as never, "light")).toThrow(/themeVars/);
    },
  );

  it.each(["red", "#FFF", "#fff;x", "#ABCDEF"])("C-THEME-26 rejects the role value %j", (bad) => {
    const s = clone(SOFT());
    (s.color.roles.light as Record<string, unknown>).primary = bad;
    expect(() => themeVars(s, "light")).toThrow(RangeError);
    expect(() => themeVars(s, "light")).toThrow(/primary/);
    expect(() => themeVars(s, "dark")).not.toThrow();
  });

  it("rejects a scale hex that is not a stored hex", () => {
    const s = clone(SOFT());
    (s.color.palettes.danger.dark[3] as { hex: string }).hex = "#12";
    expect(() => themeVars(s, "dark")).toThrow(/danger-300/);
  });

  it.each(["a;b", "has space", "", "A", "x".repeat(65), "<b>"])(
    "rejects the family id %j",
    (id) => {
      const s = clone(SOFT());
      s.type.families.body = id;
      expect(() => themeVars(s, "light")).toThrow(RangeError);
      expect(() => themeVars(s, "light")).toThrow(/themeVars/);
    },
  );

  it("rejects a non-string family id with TypeError", () => {
    const s = clone(SOFT());
    (s.type.families as Record<string, unknown>).mono = 7;
    expect(() => themeVars(s, "light")).toThrow(TypeError);
  });

  it("rejects a number that is not finite", () => {
    const s = clone(SOFT());
    s.type.steps[3].sizePx = Number.NaN;
    expect(() => themeVars(s, "light")).toThrow(RangeError);
    expect(() => themeVars(s, "light")).toThrow(/themeVars/);
  });

  it("rejects a value that holds a forbidden character", () => {
    const s = clone(CALM_LAYERED());
    (s.type.steps[9] as { clamp: string }).clamp = "clamp(1rem; 2rem)";
    expect(() => themeVars(s, "light")).toThrow(RangeError);
    expect(() => themeVars(s, "light")).toThrow(/--text-display/);
  });

  it("C-THEME-29 rejects units px with RangeError and a non-string units with TypeError", () => {
    expect(() => themeVars(SOFT(), "light", { units: "px" as never })).toThrow(RangeError);
    expect(() => themeVars(SOFT(), "light", { units: "px" as never })).toThrow(/themeVars/);
    expect(() => themeVars(SOFT(), "light", { units: 1 as never })).toThrow(TypeError);
  });

  it("throws TypeError for a role that is not a string and a missing mode or palettes", () => {
    const s = clone(SOFT());
    (s.color.roles.light as Record<string, unknown>).primary = 12;
    expect(() => themeVars(s, "light")).toThrow(TypeError);
    expect(() => themeVars(s, "light")).toThrow(/primary/);
    const noMode = clone(SOFT());
    (noMode.color.roles as Record<string, unknown>).dark = undefined;
    expect(() => themeVars(noMode, "dark")).toThrow(TypeError);
    expect(() => themeVars(noMode, "dark")).toThrow(/themeVars/);
    const noPalettes = clone(SOFT());
    (noPalettes.color as Record<string, unknown>).palettes = null;
    expect(() => themeVars(noPalettes, "light")).toThrow(TypeError);
    expect(() => themeVars(noPalettes, "light")).toThrow(/themeVars/);
    const noPalette = clone(SOFT());
    (noPalette.color.palettes as Record<string, unknown>).info = undefined;
    expect(() => themeVars(noPalette, "light")).toThrow(TypeError);
  });

  it("throws TypeError for a number written as text and RangeError for Infinity", () => {
    const s = clone(SOFT());
    (s.type.steps[3] as Record<string, unknown>).sizePx = "16";
    expect(() => themeVars(s, "light")).toThrow(TypeError);
    const t = clone(SOFT());
    t.type.steps[3].sizePx = Number.POSITIVE_INFINITY;
    expect(() => themeVars(t, "light")).toThrow(RangeError);
  });

  it("does not trust the names of the type steps or the scale entries", () => {
    const nine = clone(SOFT());
    (nine.type.steps as unknown[]).pop();
    expect(() => themeVars(nine, "light")).toThrow(TypeError);
    expect(() => themeVars(nine, "light")).toThrow(/themeVars.*got 9/);
    const renamed = clone(SOFT());
    (renamed.type.steps[2] as { name: string }).name = "x:red";
    expect(() => themeVars(renamed, "light")).toThrow(RangeError);
    expect(() => themeVars(renamed, "light")).toThrow(/themeVars/);
    const twelve = clone(SOFT());
    (twelve.color.palettes.primary.light as unknown[]).push(
      twelve.color.palettes.primary.light[10],
    );
    expect(() => themeVars(twelve, "light")).toThrow(TypeError);
    expect(() => themeVars(twelve, "light")).toThrow(/themeVars.*got 12/);
    const wrongStep = clone(SOFT());
    (wrongStep.color.palettes.accent.dark[4] as { step: number }).step = 500;
    expect(() => themeVars(wrongStep, "dark")).toThrow(RangeError);
    expect(() => themeVars(wrongStep, "dark")).toThrow(/themeVars/);
  });

  it("type-checks the clamp string", () => {
    for (const units of ["vw", "cqi"] as const) {
      const s = clone(CALM_LAYERED());
      (s.type.steps[9] as Record<string, unknown>).clamp = 5;
      expect(() => themeVars(s, "light", { units })).toThrow(TypeError);
      expect(() => themeVars(s, "light", { units })).toThrow(/themeVars.*clamp/);
    }
  });

  it("names themeVars for a missing section, shadow row or springs", () => {
    const noType = clone(SOFT());
    (noType as Record<string, unknown>).type = undefined;
    expect(() => themeVars(noType, "light")).toThrow(TypeError);
    expect(() => themeVars(noType, "light")).toThrow(/themeVars/);
    const noShadow = clone(SOFT());
    (noShadow.depth.shadows as unknown[])[3] = undefined;
    expect(() => themeVars(noShadow, "light")).toThrow(TypeError);
    expect(() => themeVars(noShadow, "light")).toThrow(/themeVars/);
    const noSprings = clone(SOFT());
    (noSprings.motion as Record<string, unknown>).springs = undefined;
    expect(() => themeVars(noSprings, "light")).toThrow(TypeError);
    expect(() => themeVars(noSprings, "light")).toThrow(/themeVars/);
    expect(() => feelSpring(noSprings.motion)).toThrow(/feelSpring/);
  });

  it("names themeVars for an unknown feel and types the depth style", () => {
    const feel = clone(SOFT());
    (feel.motion as { feel: string }).feel = "slow";
    expect(() => themeVars(feel, "light")).toThrow(RangeError);
    expect(() => themeVars(feel, "light")).toThrow(/themeVars/);
    const depth = clone(SOFT());
    (depth.depth as Record<string, unknown>).style = 5;
    expect(() => themeVars(depth, "light")).toThrow(TypeError);
    expect(() => themeVars(depth, "light")).toThrow(/themeVars/);
  });

  it("requires four finite numbers in an easing", () => {
    const short = clone(SOFT());
    (short.motion.easings as Record<string, unknown>).standard = [0.2, 0];
    expect(() => themeVars(short, "light")).toThrow(RangeError);
    expect(() => themeVars(short, "light")).toThrow(/themeVars.*standard/);
    const text = clone(SOFT());
    (text.motion.easings as Record<string, unknown>).standard = "0.2,0,0,1";
    expect(() => themeVars(text, "light")).toThrow(TypeError);
    const word = clone(SOFT());
    (word.motion.easings.standard as unknown[])[1] = "x";
    expect(() => themeVars(word, "light")).toThrow(TypeError);
  });

  it("checks shadow layers before it scales them", () => {
    const text = clone(SOFT());
    (text.depth.shadows[1][0] as Record<string, unknown>).offsetY = "2";
    expect(() => themeVars(text, "light")).toThrow(TypeError);
    const huge = clone(CALM_LAYERED());
    huge.depth.shadows[1][0].offsetY = 1.7e308;
    expect(() => themeVars(huge, "light")).toThrow(RangeError);
  });

  it("caps alpha for layered only", () => {
    const soft = clone(SOFT());
    soft.depth.shadows[1][0].alpha = 1.2;
    expect(themeVars(soft, "light")["--shadow-1"]).toMatch(/ \/ 1\.2\), /);
  });

  it("rejects prototype keys as a motion feel", () => {
    for (const feel of ["constructor", "toString", "__proto__"]) {
      expect(() => feelSpring({ ...SOFT().motion, feel: feel as never })).toThrow(RangeError);
    }
    expect(() => feelSpring({ ...SOFT().motion, feel: 3 as never })).toThrow(TypeError);
  });

  it("rejects a motion that is not an object in feelSpring", () => {
    expect(() => feelSpring(null as never)).toThrow(TypeError);
    expect(() => feelSpring(null as never)).toThrow(/feelSpring/);
    expect(() => feelSpring({ ...SOFT().motion, feel: "slow" as never })).toThrow(RangeError);
  });

  it("rejects a depth style it does not know", () => {
    const s = clone(SOFT());
    (s.depth as { style: string }).style = "glow";
    expect(() => themeVars(s, "light")).toThrow(RangeError);
  });
});

describe("C-DENSITY densityVars", () => {
  it("C-DENSITY-01 writes the offset and the control height", () => {
    expect(densityVars("comfortable")).toEqual({
      "--density-offset": "0px",
      "--control-height": "40px",
    });
    expect(densityVars("compact")).toEqual({
      "--density-offset": "-4px",
      "--control-height": "36px",
    });
    expect(densityVars("dense")).toEqual({
      "--density-offset": "-8px",
      "--control-height": "32px",
    });
    expect(Object.isFrozen(densityVars("dense"))).toBe(true);
  });

  it("C-DENSITY-02 keeps every control at 24 px or more", () => {
    for (const density of ["comfortable", "compact", "dense"] as const) {
      expect(
        Number.parseFloat(densityVars(density)["--control-height"] as string),
      ).toBeGreaterThanOrEqual(24);
    }
  });

  it("C-DENSITY-03 throws RangeError for an unknown density and TypeError for a non-string", () => {
    expect(() => densityVars("tight" as never)).toThrow(RangeError);
    expect(() => densityVars("constructor" as never)).toThrow(RangeError);
    expect(() => densityVars("constructor" as never)).toThrow(/densityVars/);
    expect(() => densityVars(1 as never)).toThrow(TypeError);
    expect(() => densityVars(1 as never)).toThrow(/densityVars/);
  });
});

describe("C-THEME-27 the bridge is pure", () => {
  const source = readFileSync(path.join(import.meta.dirname, "../../../src/theme/vars.ts"), "utf8");

  it("imports only @/engine and @/spec", () => {
    const specifiers = [
      ...source.matchAll(/(?:from|import)\s*\(?\s*"([^"]+)"/g),
      ...source.matchAll(/\brequire\(\s*"([^"]+)"/g),
    ].map((m) => m[1]);
    expect(specifiers.length).toBeGreaterThan(0);
    for (const specifier of specifiers) expect(["@/engine", "@/spec"]).toContain(specifier);
  });

  it("reads no DOM, storage, network or React", () => {
    expect(source).not.toMatch(/\b(document|window|localStorage|sessionStorage|fetch|navigator)\b/);
    expect(source).not.toMatch(/react/i);
  });

  it("runs in the node project", () => {
    expect(typeof document).toBe("undefined");
  });
});
