import { describe, expect, it } from "vitest";
import {
  applyPreset,
  freshParams,
  generateSystem,
  PALETTE_NAMES,
  ROLE_NAMES,
  resolveParams,
  STEPS,
  typeWeights,
} from "@/engine";
import { cssFontStack } from "@/export/fonts";
import { themeModel } from "@/export/model";
import { editLink } from "@/export/text";
import { themeCss } from "@/export/theme-css";
import { type DesignSpec, encodeSpec, lotTag, specId } from "@/spec";
import { themeVars } from "@/theme/vars";
import { DEFAULT_PARAMS } from "../spec/support";
import { GOLDENS, ORIGIN, SPEC } from "./golden-support";

// C-CSS-01 to 10, 14, 15 and 16 of docs/specs/03-export.md, section 10.4 (R3-13, R3-14, 6.1, 6.2).

type Declaration = readonly [name: string, value: string];
type Blocks = Record<string, Declaration[]>;

/** Reads the four blocks of a theme.css back into their declarations. */
function readBlocks(css: string): Blocks {
  const blocks: Blocks = {};
  const pattern = /^(@theme inline|@theme|:root|\.dark) \{\n([\s\S]*?)\n\}$/gm;
  for (const match of css.matchAll(pattern)) {
    const [, selector, body] = match as unknown as [string, string, string];
    expect(blocks[selector], `${selector} appears once`).toBeUndefined();
    blocks[selector] = body.split("\n").map((line) => {
      const parsed = /^ {2}(--[\w*-]+): (.+);$/.exec(line);
      expect(parsed, line).not.toBeNull();
      return [parsed?.[1] as string, parsed?.[2] as string] as const;
    });
  }
  return blocks;
}

const names = (declarations: readonly Declaration[] | undefined) =>
  (declarations ?? []).map(([name]) => name);
const declared = (declarations: readonly Declaration[] | undefined, name: string) =>
  (declarations ?? []).find(([n]) => n === name)?.[1];

const CSS = themeCss(SPEC, ORIGIN);
const BLOCKS = readBlocks(CSS);
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
];
const STEP_COLORS = PALETTE_NAMES.flatMap((palette) => STEPS.map((step) => `${palette}-${step}`));

function designOf(patch: Parameters<typeof generateSystem>[0]): DesignSpec {
  return generateSystem(patch, "seed-1");
}

describe("C-CSS-01 the layout", () => {
  it("is three header lines, the custom variant and four blocks in order", () => {
    const lines = CSS.split("\n");
    expect(lines[0]).toMatch(/^\/\* .* \*\/$/);
    expect(lines[1]).toMatch(/^\/\* .* \*\/$/);
    expect(lines[2]).toMatch(/^\/\* .* \*\/$/);
    expect(lines[3]).toBe("@custom-variant dark (&:is(.dark *));");
    expect(lines[4]).toBe("");
    const order = lines.filter((line) => /^(@theme inline|@theme|:root|\.dark) \{$/.test(line));
    expect(order).toEqual(["@theme {", ":root {", ".dark {", "@theme inline {"]);
    expect(Object.keys(BLOCKS)).toHaveLength(4);
  });

  it("separates blocks by one empty line, indents by two spaces and ends with one newline", () => {
    expect(CSS).not.toContain("\r");
    expect(CSS).not.toMatch(/[ \t]$/m);
    expect(CSS).not.toMatch(/\n\n\n/);
    expect(CSS.endsWith("}\n")).toBe(true);
    expect(CSS.endsWith("\n\n")).toBe(false);
    expect(CSS).toMatch(/\}\n\n:root \{/);
    expect(CSS).toMatch(/\}\n\n\.dark \{/);
    expect(CSS).toMatch(/\}\n\n@theme inline \{/);
    for (const line of CSS.split("\n")) {
      if (/^ /.test(line)) expect(line).toMatch(/^ {2}--/);
    }
  });

  it("holds no comment but the three header lines", () => {
    expect(CSS.match(/\/\*/g)).toHaveLength(3);
  });
});

describe("C-CSS-02 the header", () => {
  it("names the design, the lot, the edit link and the fixed line", () => {
    const [first, second, third] = CSS.split("\n");
    const lot = lotTag(specId(SPEC));
    expect(first).toBe(`/* dyelot design system: ${SPEC.meta.name} (LOT ${lot}) */`);
    expect(second).toBe(
      `/* Made with dyelot. Edit this design: ${ORIGIN}/studio#s=${encodeSpec(SPEC)} */`,
    );
    expect(second).toContain(editLink(SPEC, ORIGIN));
    expect(third).toBe(
      "/* Generated: change the design in the studio and export it again, not by hand. */",
    );
  });

  it("writes a name holding */ as * / and keeps the comment closed", () => {
    const named = structuredClone(SPEC);
    named.meta.name = "Tide */ body { color: red }";
    const css = themeCss(named, ORIGIN);
    const [first] = css.split("\n");
    expect(first).toContain("Tide * / body");
    expect(css.indexOf("*/")).toBe((first as string).length - 2);
  });
});

describe("C-CSS-03 @theme", () => {
  const theme = BLOCKS["@theme"];
  it("holds 86 declarations in order", () => {
    expect(theme).toHaveLength(86);
    const expected = [
      "--color-*",
      "--color-white",
      "--color-black",
      "--font-display",
      "--font-heading",
      "--font-body",
      "--font-sans",
      "--font-mono",
      "--font-weight-heading",
      "--font-weight-label",
      "--font-weight-body",
      ...STEP_NAMES.flatMap((s) => [
        `--text-${s}`,
        `--text-${s}--line-height`,
        `--text-${s}--letter-spacing`,
        `--text-${s}--font-weight`,
      ]),
      ...STEP_NAMES.map((s) => `--leading-${s}`),
      ...STEP_NAMES.map((s) => `--tracking-${s}`),
      "--spacing",
      "--radius-sm",
      "--radius-md",
      "--radius-lg",
      "--radius-xl",
      "--radius-2xl",
      "--shadow-1",
      "--shadow-2",
      "--shadow-3",
      "--shadow-4",
      "--shadow-5",
      "--ease-standard",
      "--ease-decelerate",
      "--ease-accelerate",
      "--ease-emphasized",
    ];
    expect(names(theme)).toEqual(expected);
    expect(declared(theme, "--color-*")).toBe("initial");
    expect(declared(theme, "--color-white")).toBe("#ffffff");
    expect(declared(theme, "--color-black")).toBe("#000000");
    expect(declared(theme, "--spacing")).toBe("4px");
  });
});

describe("C-CSS-04 and C-CSS-05 :root, .dark and @theme inline", () => {
  const light = themeVars(SPEC, "light");
  const dark = themeVars(SPEC, "dark");
  const colorNames = [...ROLE_NAMES, ...STEP_COLORS];

  it("writes 145 declarations in :root, equal to the bridge", () => {
    const root = BLOCKS[":root"];
    expect(root).toHaveLength(145);
    expect(names(root)).toEqual([
      "--radius",
      ...colorNames.map((n) => `--${n}`),
      "--duration-instant",
      "--duration-fast",
      "--duration-quick",
      "--duration-base",
      "--duration-slow",
      "--duration-slower",
      "--duration-slowest",
      "--spring-duration",
      "--spring-bounce",
      "--icon-stroke",
    ]);
    expect(declared(root, "--radius")).toBe(light["--radius-lg"]);
    for (const [name, value] of root ?? []) {
      if (name !== "--radius") expect(value, name).toBe(light[name]);
    }
  });

  it("writes 134 declarations in .dark, equal to the bridge", () => {
    const darkBlock = BLOCKS[".dark"];
    expect(names(darkBlock)).toEqual(colorNames.map((n) => `--${n}`));
    expect(darkBlock).toHaveLength(134);
    for (const [name, value] of darkBlock ?? []) expect(value, name).toBe(dark[name]);
  });

  it("maps every role and step in @theme inline", () => {
    const inline = BLOCKS["@theme inline"];
    expect(inline).toHaveLength(134);
    expect(inline).toEqual(colorNames.map((n) => [`--color-${n}`, `var(--${n})`]));
  });
});

describe("C-CSS-06 every golden equals the bridge", () => {
  const isBridgeName = (name: string) =>
    /^--(text|leading|tracking|radius-(sm|md|lg|xl|2xl)|shadow|duration|ease|spring|icon)-/.test(
      name,
    );

  it.each(GOLDENS.map((g) => [g.id, g.spec] as const))("%s", (_id, spec) => {
    const css = readBlocks(themeCss(spec, ORIGIN));
    const light = themeVars(spec, "light");
    const dark = themeVars(spec, "dark");
    for (const block of ["@theme", ":root"]) {
      for (const [name, value] of css[block] ?? []) {
        // The stacks and weights are theme.css's own values (R3-13).
        if (name.startsWith("--font-") || (name.startsWith("--text-") && name.includes("--", 2))) {
          continue;
        }
        if (isBridgeName(name) || light[name] !== undefined) {
          expect(value, `${block} ${name}`).toBe(light[name]);
        }
      }
    }
    for (const [name, value] of css[".dark"] ?? []) expect(value, name).toBe(dark[name]);
    const shadows = [1, 2, 3, 4, 5].map((n) => declared(css["@theme"], `--shadow-${n}`) as string);
    if (spec.depth.style === "flat") expect(shadows).toEqual(Array(5).fill("none"));
    else for (const shadow of shadows) expect(shadow).toMatch(/oklch\([^)]* \/ [\d.]+\)/);
  });
});

describe("C-CSS-07 type companions", () => {
  it("copies leading and tracking and ties each weight to its role", () => {
    const theme = BLOCKS["@theme"];
    for (const step of STEP_NAMES) {
      expect(declared(theme, `--text-${step}--line-height`)).toBe(
        declared(theme, `--leading-${step}`),
      );
      expect(declared(theme, `--text-${step}--letter-spacing`)).toBe(
        declared(theme, `--tracking-${step}`),
      );
      const role = ["display", "h1", "h2", "h3", "h4"].includes(step)
        ? "heading"
        : step === "label"
          ? "label"
          : "body";
      expect(declared(theme, `--text-${step}--font-weight`)).toBe(`var(--font-weight-${role})`);
    }
  });

  it.each(["marketing", "editorial"] as const)("writes a %s display clamp with vw", (context) => {
    const spec = designOf({ ...DEFAULT_PARAMS, type: { context } });
    const display = declared(readBlocks(themeCss(spec, ORIGIN))["@theme"], "--text-display");
    expect(display).toMatch(/^clamp\(.*vw.*\)$/);
  });
});

describe("C-CSS-08 fonts and weights", () => {
  it.each<readonly [string, DesignSpec]>([
    ["host-grotesk pairing", SPEC],
    ...GOLDENS.map((g): readonly [string, DesignSpec] => [g.id, g.spec]),
  ])("%s", (_id, spec) => {
    const theme = readBlocks(themeCss(spec, ORIGIN))["@theme"];
    const { display, body, mono } = spec.type.families;
    expect(declared(theme, "--font-display")).toBe(cssFontStack(display, "display"));
    expect(declared(theme, "--font-heading")).toBe(cssFontStack(display, "display"));
    expect(declared(theme, "--font-body")).toBe(cssFontStack(body, "body"));
    expect(declared(theme, "--font-sans")).toBe(cssFontStack(body, "body"));
    expect(declared(theme, "--font-mono")).toBe(cssFontStack(mono, "mono"));
    const weights = typeWeights(spec);
    expect(declared(theme, "--font-weight-heading")).toBe(String(weights.heading));
    expect(declared(theme, "--font-weight-label")).toBe(String(weights.label));
    expect(declared(theme, "--font-weight-body")).toBe(String(weights.body));
  });

  it("starts a variable stack with Fontsource's name and a static one with the family", () => {
    const theme = BLOCKS["@theme"];
    expect(declared(theme, "--font-body")).toMatch(/^"Host Grotesk Variable", "Host Grotesk",/);
    expect(declared(theme, "--font-mono")).toMatch(/^"Fragment Mono",/);
  });
});

describe("C-CSS-09 the calm design", () => {
  it("writes the scaled durations and no --space-", () => {
    const calm = designOf({ ...DEFAULT_PARAMS, motion: "calm" });
    const css = themeCss(calm, ORIGIN);
    const root = readBlocks(css)[":root"];
    const durations = (root ?? []).filter(([n]) => n.startsWith("--duration-")).map(([, v]) => v);
    expect(durations).toEqual(["63ms", "125ms", "188ms", "250ms", "375ms", "500ms", "500ms"]);
    expect(declared(root, "--radius")).toBe(declared(readBlocks(css)["@theme"], "--radius-lg"));
    expect(css).not.toContain("--space-");
  });
});

describe("C-CSS-10 every golden", () => {
  it.each(GOLDENS.map((g) => [g.id, g.spec] as const))(
    "%s is clean, complete and stable",
    (_id, spec) => {
      const css = themeCss(spec, ORIGIN);
      const blocks = readBlocks(css);
      for (const [selector, declarations] of Object.entries(blocks)) {
        for (const [name, value] of declarations) {
          expect(value, `${selector} ${name}`).not.toMatch(/[;{}]/);
        }
      }
      for (const role of ROLE_NAMES) {
        expect(names(blocks[":root"]).filter((n) => n === `--${role}`)).toHaveLength(1);
        expect(names(blocks[".dark"]).filter((n) => n === `--${role}`)).toHaveLength(1);
      }
      expect(themeCss(spec, ORIGIN)).toBe(css);
    },
  );
});

describe("C-CSS-14 and C-CSS-16 guards", () => {
  it("throws TypeError naming themeCss for null", () => {
    expect(() => themeCss(null as never, ORIGIN)).toThrow(TypeError);
    expect(() => themeCss(null as never, ORIGIN)).toThrow("themeCss");
  });

  it("throws the bridge's RangeError for a role that is not a lowercase hex", () => {
    const bad = structuredClone(SPEC);
    bad.color.roles.light.primary = "#FFF" as never;
    expect(() => themeCss(bad, ORIGIN)).toThrow(RangeError);
    expect(() => themeCss(bad, ORIGIN)).toThrow(/themeVars.*primary/);
  });

  it("rejects an origin that is not an https origin", () => {
    for (const bad of ["http://dyelot.vercel.app", "https://dyelot.vercel.app/"]) {
      expect(() => themeCss(SPEC, bad)).toThrow(RangeError);
      expect(() => themeCss(SPEC, bad)).toThrow("editLink");
    }
    expect(() => editLink(SPEC, 42 as never)).toThrow(TypeError);
  });

  it("throws TypeError naming themeModel for null", () => {
    expect(() => themeModel(null as never)).toThrow(TypeError);
    expect(() => themeModel(null as never)).toThrow("themeModel");
  });

  it("refuses a name that is not plain text", () => {
    const bad = structuredClone(SPEC);
    bad.meta.name = "a\nb";
    expect(() => themeCss(bad, ORIGIN)).toThrow(RangeError);
  });
});

describe("C-CSS-15 the theme model", () => {
  const model = themeModel(SPEC);
  const light = themeVars(SPEC, "light");
  const dark = themeVars(SPEC, "dark");

  it("lists 46 roles and 88 steps with both modes' hexes", () => {
    expect(model.roles.map((r) => r.name)).toEqual([...ROLE_NAMES]);
    expect(model.roles).toHaveLength(46);
    expect(model.steps).toHaveLength(88);
    expect(model.steps.map((s) => s.name)).toEqual(STEP_COLORS);
    for (const color of [...model.roles, ...model.steps]) {
      expect(color.light).toBe(light[`--${color.name}`]);
      expect(color.dark).toBe(dark[`--${color.name}`]);
    }
  });

  it("describes the three families", () => {
    expect(model.families.display).toEqual({
      id: "host-grotesk",
      family: "Host Grotesk",
      stack: cssFontStack("host-grotesk", "display"),
      package: "@fontsource-variable/host-grotesk",
      nextImport: "Host_Grotesk",
    });
    expect(model.families.body.nextImport).toBe("Host_Grotesk");
    expect(model.families.mono.package).toBe("@fontsource/fragment-mono");
    expect(model.families.mono.nextImport).toBe("Fragment_Mono");
  });

  it("gives no next/font import for redaction or a family outside the catalog", () => {
    const custom = structuredClone(SPEC);
    custom.type.families.display = "redaction";
    custom.type.families.body = "inter";
    const families = themeModel(custom).families;
    expect(families.display.nextImport).toBeNull();
    expect(families.display.package).toBe("@fontsource/redaction");
    expect(families.body.nextImport).toBeNull();
    expect(families.body.package).toBeNull();
  });

  it("lists 10 type steps with their roles' weights", () => {
    expect(model.typeSteps.map((s) => s.name)).toEqual(STEP_NAMES);
    const weights = typeWeights(SPEC);
    expect(model.weights).toEqual(weights);
    for (const step of model.typeSteps) {
      expect(step.size).toBe(light[`--text-${step.name}`]);
      expect(step.lineHeight).toBe(light[`--leading-${step.name}`]);
      expect(step.tracking).toBe(light[`--tracking-${step.name}`]);
      const heading = ["display", "h1", "h2", "h3", "h4"].includes(step.name);
      expect(step.weight).toBe(
        heading ? weights.heading : step.name === "label" ? weights.label : weights.body,
      );
    }
  });

  it("carries radii, shadows, durations, easings, spring and stroke from the bridge", () => {
    expect(model.radii.radius).toBe(model.radii.lg);
    expect(model.radii.lg).toBe(light["--radius-lg"]);
    expect(model.radii["2xl"]).toBe(light["--radius-2xl"]);
    expect(model.shadows).toEqual([1, 2, 3, 4, 5].map((n) => light[`--shadow-${n}`]));
    expect(model.durations).toHaveLength(7);
    for (const { name, value } of model.durations) expect(value).toBe(light[`--duration-${name}`]);
    expect(model.easings).toHaveLength(4);
    for (const { name, value } of model.easings) expect(value).toBe(light[`--ease-${name}`]);
    expect(model.spring).toEqual({
      duration: light["--spring-duration"],
      bounce: light["--spring-bounce"],
    });
    expect(model.iconStroke).toBe(light["--icon-stroke"]);
  });
});

describe("a preset sets the theme", () => {
  it("writes different CSS for different designs", () => {
    const other = generateSystem(
      resolveParams({ ...applyPreset(freshParams(), "neo-brutalism") }, "seed-1"),
      "seed-1",
    );
    expect(themeCss(other, ORIGIN)).not.toBe(CSS);
  });
});
