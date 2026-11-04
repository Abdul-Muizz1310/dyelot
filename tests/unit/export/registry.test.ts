import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FONT_CATALOG, generateSystem, PAIRINGS, PALETTE_NAMES, ROLE_NAMES, STEPS } from "@/engine";
import { cssFontStack, familyName, NEXT_FONT_MISSING } from "@/export/fonts";
import { themeModel } from "@/export/model";
import { describeDesign } from "@/export/prose";
import { registryItems } from "@/export/registry";
import { DEFAULT_PARAMS } from "../spec/support";
import { GOLDENS, SPEC } from "./golden-support";
import { registryValidator } from "./schema-support";

// C-REG-01 to 12 of docs/specs/03-export.md, section 10.4 (R3-16, 6.3).

const SLUG = "tide";
const SCHEMA = "https://ui.shadcn.com/schema/registry-item.json";
const FONT_DATA = JSON.parse(
  readFileSync(
    path.join(
      process.cwd(),
      "node_modules/next/dist/compiled/@next/font/dist/google/font-data.json",
    ),
    "utf8",
  ),
) as Record<string, { weights: string[] }>;

type Item = Record<string, unknown> & {
  cssVars: {
    theme: Record<string, string>;
    light: Record<string, string>;
    dark: Record<string, string>;
  };
  font?: Record<string, unknown>;
};
const parse = (text: string) => JSON.parse(text) as Item;
const itemsOf = (spec = SPEC) => registryItems(spec, SLUG);
const themeOf = (spec = SPEC) => parse((itemsOf(spec)[0] as { text: string }).text);

function withPairing(id: string) {
  return generateSystem({ ...DEFAULT_PARAMS, pairing: id }, "seed-1");
}

describe("C-REG-01 the theme item", () => {
  it("has the keys in order and the documented values", () => {
    const [file] = itemsOf();
    expect(file?.path).toBe(`registry/${SLUG}.json`);
    expect(file?.text.endsWith("}\n")).toBe(true);
    expect(file?.text).toBe(`${JSON.stringify(parse(file?.text as string), null, 2)}\n`);
    const item = parse(file?.text as string);
    expect(Object.keys(item)).toEqual([
      "$schema",
      "name",
      "type",
      "title",
      "description",
      "cssVars",
    ]);
    expect(item.$schema).toBe(SCHEMA);
    expect(item.name).toBe(SLUG);
    expect(item.type).toBe("registry:theme");
    expect(item.title).toBe(SPEC.meta.name);
    expect(item.description).toBe(`${describeDesign(SPEC)} Made with dyelot.`);
  });

  it("describes with the one-liner when there is one", () => {
    const spec = structuredClone(SPEC);
    spec.meta.oneLiner = "Calm tides for dashboards.";
    expect(themeOf(spec).description).toBe("Calm tides for dashboards. Made with dyelot.");
  });
});

describe("C-REG-02 cssVars light and dark", () => {
  it("holds 135 and 134 keys with the model's hexes and no --", () => {
    const { light, dark } = themeOf().cssVars;
    const model = themeModel(SPEC);
    expect(Object.keys(light)).toHaveLength(135);
    expect(Object.keys(dark)).toHaveLength(134);
    expect(Object.keys(light)[0]).toBe("radius");
    expect(Object.keys(light).slice(1, 47)).toEqual([...ROLE_NAMES]);
    expect(Object.keys(dark).slice(0, 46)).toEqual([...ROLE_NAMES]);
    expect(Object.keys(dark).slice(46)).toEqual(
      PALETTE_NAMES.flatMap((palette) => STEPS.map((step) => `${palette}-${step}`)),
    );
    expect(light.radius).toBe(model.radii.radius);
    for (const color of [...model.roles, ...model.steps]) {
      expect(light[color.name]).toBe(color.light);
      expect(dark[color.name]).toBe(color.dark);
    }
    for (const key of [...Object.keys(light), ...Object.keys(dark)]) expect(key).not.toMatch(/^--/);
  });
});

describe("C-REG-03 cssVars theme", () => {
  it("holds the five radii in px and no color", () => {
    const theme = themeOf().cssVars.theme;
    const model = themeModel(SPEC);
    expect(Object.keys(theme).slice(0, 5)).toEqual([
      "radius-sm",
      "radius-md",
      "radius-lg",
      "radius-xl",
      "radius-2xl",
    ]);
    expect(theme["radius-sm"]).toBe(model.radii.sm);
    expect(theme["radius-2xl"]).toBe(model.radii["2xl"]);
    for (const [key, value] of Object.entries(theme)) {
      expect(key).not.toMatch(/^color|^--/);
      expect(value, key).not.toMatch(/#[0-9a-f]{3,8}\b|oklch\(|rgb\(|hsl\(/);
    }
  });
});

describe("C-REG-04 font items", () => {
  it("follows the distinct families in display, body, mono order", () => {
    expect(itemsOf().map((f) => f.path)).toEqual([
      `registry/${SLUG}.json`,
      "registry/font-host-grotesk.json",
      "registry/font-fragment-mono.json",
    ]);
  });

  it("writes three items for the schibsted-serif pairing", () => {
    const spec = withPairing("schibsted-serif");
    const { display, body, mono } = spec.type.families;
    expect(new Set([display, body, mono]).size).toBe(3);
    expect(itemsOf(spec).map((f) => f.path)).toEqual([
      `registry/${SLUG}.json`,
      `registry/font-${display}.json`,
      `registry/font-${body}.json`,
      `registry/font-${mono}.json`,
    ]);
  });

  it("sets the shared family's variable to --font-sans and points the heading at it", () => {
    const theme = themeOf().cssVars.theme;
    expect(theme["font-heading"]).toBe("var(--font-sans)");
    expect(theme["font-sans"]).toBeUndefined();
    expect(theme["font-mono"]).toBeUndefined();
  });
});

describe("C-REG-05 and C-REG-06 a font item", () => {
  it("has the fields, the import, the variable and the weights", () => {
    const spec = withPairing("schibsted-serif");
    const [, ...fonts] = itemsOf(spec);
    const items = fonts.map((f) => parse(f.text));
    const { display, body, mono } = spec.type.families;
    items.forEach((item, index) => {
      const id = [display, body, mono][index] as string;
      expect(Object.keys(item)).toEqual(["$schema", "name", "type", "title", "font"]);
      expect(item.name).toBe(`font-${id}`);
      expect(item.type).toBe("registry:font");
      expect(item.title).toBe(familyName(id));
      expect(item.font?.provider).toBe("google");
      expect(item.font?.subsets).toEqual(["latin"]);
      expect(item.font?.family).toBe(familyName(id));
      expect(item.font?.import).toBe(familyName(id).replaceAll(" ", "_"));
    });
    expect(items.map((i) => i.font?.variable)).toEqual([
      "--font-heading",
      "--font-sans",
      "--font-mono",
    ]);
    const firstFont = items[0]?.font ?? {};
    expect(Object.keys(firstFont)).toEqual([
      "family",
      "provider",
      "import",
      "variable",
      ...("weight" in firstFont ? ["weight"] : []),
      "subsets",
    ]);
  });

  it("writes Source_Serif_4 and lists a static family's weights as strings", () => {
    const serif = withPairing("schibsted-serif");
    const imports = itemsOf(serif)
      .slice(1)
      .map((f) => parse(f.text).font?.import);
    expect(imports).toEqual(["Schibsted_Grotesk", "Source_Serif_4", "Fragment_Mono"]);
    const mono = parse(itemsOf().at(-1)?.text as string);
    expect(mono.font?.weight).toEqual(["400"]);
    const host = parse((itemsOf()[1] as { text: string }).text);
    expect(host.font).not.toHaveProperty("weight");
    expect(host.font?.variable).toBe("--font-sans");
    const courier = structuredClone(SPEC);
    courier.type.families.mono = "courier-prime";
    expect(parse(itemsOf(courier).at(-1)?.text as string).font?.weight).toEqual(["400", "700"]);
  });
});

describe("C-REG-07 a family outside the catalog", () => {
  it("gets no item and its stack goes into cssVars.theme", () => {
    const spec = structuredClone(SPEC);
    spec.type.families.mono = "jetbrains-mono";
    expect(itemsOf(spec).map((f) => f.path)).toEqual([
      `registry/${SLUG}.json`,
      "registry/font-host-grotesk.json",
    ]);
    expect(themeOf(spec).cssVars.theme["font-mono"]).toBe(cssFontStack("jetbrains-mono", "mono"));
  });
});

describe("C-REG-08 NEXT_FONT_MISSING", () => {
  it("is exactly redaction and redaction-redhat gets no Redaction item", () => {
    expect(NEXT_FONT_MISSING).toEqual(["redaction"]);
    const pairing = PAIRINGS.find((p) => p.id === "redaction-redhat");
    expect(pairing?.display).toBe("redaction");
    const spec = withPairing("redaction-redhat");
    expect(itemsOf(spec).map((f) => f.path)).toEqual([
      `registry/${SLUG}.json`,
      "registry/font-red-hat-text.json",
      "registry/font-red-hat-mono.json",
    ]);
    const theme = themeOf(spec).cssVars.theme;
    expect(theme["font-heading"]).toBe(cssFontStack("redaction", "display"));
  });
});

describe("C-REG-09 next/font's font-data.json", () => {
  it("holds every catalog family but the missing ones", () => {
    for (const font of FONT_CATALOG) {
      const missing = NEXT_FONT_MISSING.includes(font.id);
      expect(Object.hasOwn(FONT_DATA, font.family), font.family).toBe(!missing);
    }
  });
});

describe("C-REG-10 every golden's font items name real next/font families", () => {
  it.each(GOLDENS.map((g) => [g.id, g.spec] as const))("%s", (_id, spec) => {
    for (const file of itemsOf(spec).slice(1)) {
      const { font } = parse(file.text);
      const family = String(font?.import).replaceAll("_", " ");
      expect(Object.hasOwn(FONT_DATA, family), family).toBe(true);
      const entry = FONT_CATALOG.find((f) => f.family === family);
      if (entry !== undefined && !entry.variable) {
        for (const weight of (font?.weight ?? []) as string[]) {
          expect(FONT_DATA[family]?.weights, `${family} ${weight}`).toContain(weight);
        }
      }
    }
  });
});

describe("C-REG-11 the items validate against shadcn's schema", () => {
  const validate = registryValidator();

  it.each(GOLDENS.map((g) => [g.id, g.spec] as const))("%s", (_id, spec) => {
    for (const file of itemsOf(spec)) expect(validate(JSON.parse(file.text)), file.path).toBe(true);
  });

  it("rejects mutated copies", () => {
    const [themeFile, fontFile] = itemsOf();
    const theme = JSON.parse((themeFile as { text: string }).text);
    const font = JSON.parse((fontFile as { text: string }).text);
    expect(validate(theme)).toBe(true);
    expect(validate(font)).toBe(true);
    expect(validate({ ...theme, type: "registry:fonts" })).toBe(false);
    expect(validate({ ...font, font: { ...font.font, weight: [400] } })).toBe(false);
    const { font: _font, ...withoutFont } = font;
    expect(validate(withoutFont)).toBe(false);
    expect(validate({ ...theme, font: font.font })).toBe(false);
  });
});

describe("C-REG-12 guards", () => {
  it("throws TypeError naming registryItems for a spec that is not an object", () => {
    expect(() => registryItems(null as never, "x")).toThrow(TypeError);
    expect(() => registryItems(null as never, "x")).toThrow("registryItems");
    expect(() => registryItems(SPEC, 1 as never)).toThrow(TypeError);
  });

  it("throws RangeError for a slug that is empty, long or malformed", () => {
    for (const bad of ["", "a".repeat(49), "A", "a--b", "-a", "a-", "a b"]) {
      expect(() => registryItems(SPEC, bad)).toThrow(RangeError);
      expect(() => registryItems(SPEC, bad)).toThrow("registryItems");
    }
  });
});
