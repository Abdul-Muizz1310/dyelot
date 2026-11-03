import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  FONT_CATALOG,
  type FontEntry,
  fontFiles,
  fontStack,
  genericness,
  genericnessOf,
  HIGH_GENERICNESS_FAMILIES,
  isHighGenericnessFamily,
  validateCatalog,
} from "@/engine/fonts/catalog";
import { PAIRINGS } from "@/engine/fonts/pairings";

// Cases are the C-FONT-nn rows of docs/specs/02-studio.md, section 6.2. C-FONT-17 to C-FONT-21
// (the copy script) live in tests/unit/scripts/copy-fonts.test.ts.

const ROOT = path.resolve(import.meta.dirname, "../../../..");

const TABLE_IDS = [
  "host-grotesk",
  "fragment-mono",
  "schibsted-grotesk",
  "source-serif-4",
  "gloock",
  "albert-sans",
  "young-serif",
  "onest",
  "bodoni-moda",
  "familjen-grotesk",
  "literata",
  "spline-sans",
  "spline-sans-mono",
  "hubot-sans",
  "mona-sans",
  "martian-mono",
  "funnel-display",
  "funnel-sans",
  "zalando-sans-expanded",
  "zalando-sans",
  "unbounded",
  "golos-text",
  "archivo",
  "courier-prime",
  "big-shoulders",
  "red-hat-text",
  "tiny5",
  "doto",
  "red-hat-mono",
  "redaction",
  "commissioner",
  "atkinson-hyperlegible-next",
  "atkinson-hyperlegible-mono",
  "google-sans-flex",
  "google-sans-code",
  "anybody",
  "science-gothic",
  "hanken-grotesk",
  "geist",
  "geist-mono",
];

const STATIC_IDS = [
  "fragment-mono",
  "gloock",
  "young-serif",
  "courier-prime",
  "tiny5",
  "redaction",
];

const SANS = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
const SERIF = 'ui-serif, Georgia, "Times New Roman", serif';
const MONO = 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';

const entry = (over: Partial<FontEntry> = {}): FontEntry => ({
  id: "x-font",
  family: "X Font",
  category: "sans",
  variable: true,
  axes: ["wght"],
  weights: [100, 900],
  license: "OFL-1.1",
  popularity: 100,
  fallback: SANS,
  ...over,
});

describe("the catalog", () => {
  it("C-FONT-01 holds 40 entries with unique ids of lowercase letters, digits and hyphens", () => {
    expect(FONT_CATALOG).toHaveLength(40);
    for (const font of FONT_CATALOG) expect(font.id).toMatch(/^[a-z0-9-]+$/);
    expect(new Set(FONT_CATALOG.map((font) => font.id)).size).toBe(40);
  });

  it("C-FONT-02 holds exactly the 40 ids of the table, in order", () => {
    expect(FONT_CATALOG.map((font) => font.id)).toEqual(TABLE_IDS);
  });

  it("C-FONT-02 derives each id from the family name", () => {
    for (const font of FONT_CATALOG) {
      expect(font.id).toBe(font.family.toLowerCase().replaceAll(" ", "-"));
    }
  });

  it("C-FONT-03 gives every entry its nine fields, each of the right type", () => {
    for (const font of FONT_CATALOG) {
      expect(Object.keys(font).sort(), font.id).toEqual(
        [
          "axes",
          "category",
          "family",
          "fallback",
          "id",
          "license",
          "popularity",
          "variable",
          "weights",
        ].sort(),
      );
      expect(typeof font.family).toBe("string");
      expect(["sans", "serif", "mono", "display"]).toContain(font.category);
      expect(typeof font.variable).toBe("boolean");
      expect(Array.isArray(font.axes)).toBe(true);
      expect(Array.isArray(font.weights)).toBe(true);
      expect(font.license).toBe("OFL-1.1");
      expect(Number.isInteger(font.popularity), font.id).toBe(true);
      expect(font.popularity).toBeGreaterThanOrEqual(1);
      expect(font.fallback.length).toBeGreaterThan(0);
    }
  });

  it("C-FONT-04 uses every pairing family from the catalog, and every family bar the Geist pair", () => {
    const ids = new Set(FONT_CATALOG.map((font) => font.id));
    const used = new Set<string>();
    for (const pairing of PAIRINGS) {
      for (const id of [pairing.display, pairing.body, pairing.mono]) {
        expect(ids.has(id), `${pairing.id}: ${id}`).toBe(true);
        used.add(id);
      }
    }
    const unused = FONT_CATALOG.map((font) => font.id).filter((id) => !used.has(id));
    expect(unused.sort()).toEqual(["geist", "geist-mono"]);
  });

  it.each(["host-grotesk", "fragment-mono", "geist", "geist-mono"])("C-FONT-05 holds %s", (id) => {
    expect(FONT_CATALOG.some((font) => font.id === id)).toBe(true);
  });

  it("C-FONT-06 gives variable entries the wght axis and a weight range, static ones neither", () => {
    for (const font of FONT_CATALOG) {
      if (font.variable) {
        expect(font.axes, font.id).toEqual(["wght"]);
        expect(font.weights, font.id).toHaveLength(2);
        expect(font.weights[0], font.id).toBeLessThan(font.weights[1] as number);
      } else {
        expect(font.axes, font.id).toEqual([]);
        expect(font.weights[0], font.id).toBe(400);
        for (const weight of font.weights) expect([400, 700], font.id).toContain(weight);
        expect(
          [...font.weights].sort((a, b) => a - b),
          font.id,
        ).toEqual(font.weights);
      }
    }
  });

  it("C-FONT-06 marks 34 entries variable and the six R2-03 families static", () => {
    expect(FONT_CATALOG.filter((font) => font.variable)).toHaveLength(34);
    expect(
      FONT_CATALOG.filter((font) => !font.variable)
        .map((font) => font.id)
        .sort(),
    ).toEqual([...STATIC_IDS].sort());
    const tiny5 = FONT_CATALOG.find((font) => font.id === "tiny5");
    expect(tiny5?.weights).toEqual([400]);
  });

  it("C-FONT-07 gives each entry the fallback stack of its category", () => {
    const expected = { sans: SANS, display: SANS, serif: SERIF, mono: MONO } as const;
    for (const font of FONT_CATALOG) expect(font.fallback, font.id).toBe(expected[font.category]);
  });

  it("freezes the catalog, its entries and their lists", () => {
    expect(Object.isFrozen(FONT_CATALOG)).toBe(true);
    for (const font of FONT_CATALOG) {
      expect(Object.isFrozen(font), font.id).toBe(true);
      expect(Object.isFrozen(font.axes), font.id).toBe(true);
      expect(Object.isFrozen(font.weights), font.id).toBe(true);
    }
    expect(() => (FONT_CATALOG as FontEntry[]).push(entry())).toThrow(TypeError);
  });
});

describe("validateCatalog", () => {
  it("C-FONT-08 reports nothing for the real catalog and for a valid one", () => {
    expect(validateCatalog(FONT_CATALOG)).toEqual([]);
    expect(validateCatalog([entry(), entry({ id: "y-font" })])).toEqual([]);
  });

  it("C-FONT-08 reports a duplicate id", () => {
    const problems = validateCatalog([entry(), entry()]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/duplicate id "x-font"/);
  });

  it.each(["Upper", "has space"])("C-FONT-08 reports the id %j", (id) => {
    const problems = validateCatalog([entry({ id })]);
    expect(problems.some((problem) => problem.includes(`id "${id}"`))).toBe(true);
  });

  it("C-FONT-08 reports a license other than OFL-1.1", () => {
    const problems = validateCatalog([entry({ license: "Apache-2.0" as never })]);
    expect(problems.some((problem) => /license/.test(problem))).toBe(true);
  });

  it.each([0, 1.5])("C-FONT-08 reports a popularity of %s", (popularity) => {
    const problems = validateCatalog([entry({ popularity })]);
    expect(problems.some((problem) => /popularity/.test(problem))).toBe(true);
  });

  it("C-FONT-08 reports an empty fallback", () => {
    const problems = validateCatalog([entry({ fallback: "" })]);
    expect(problems.some((problem) => /fallback/.test(problem))).toBe(true);
  });

  it("C-FONT-08 reports a variable entry with one weight", () => {
    const problems = validateCatalog([entry({ weights: [400] })]);
    expect(problems.some((problem) => /weights/.test(problem))).toBe(true);
  });

  it("C-FONT-08 reports a static entry without a 400 or with a weight outside 400 and 700", () => {
    const noRegular = validateCatalog([entry({ variable: false, axes: [], weights: [700] })]);
    expect(noRegular.some((problem) => /weights/.test(problem))).toBe(true);
    const odd = validateCatalog([entry({ variable: false, axes: [], weights: [400, 500] })]);
    expect(odd.some((problem) => /weights/.test(problem))).toBe(true);
  });

  it("C-FONT-08 reports a variable entry without the wght axis and a static one with an axis", () => {
    expect(validateCatalog([entry({ axes: [] })]).some((problem) => /axes/.test(problem))).toBe(
      true,
    );
    const staticAxes = entry({ variable: false, axes: ["wght"], weights: [400] });
    expect(validateCatalog([staticAxes]).some((problem) => /axes/.test(problem))).toBe(true);
  });

  it("C-FONT-08 reports a null or non-object entry as a problem, never a crash", () => {
    for (const bad of [null, undefined, 3, "x"]) {
      const problems = validateCatalog([bad as never]);
      expect(problems, String(bad)).toHaveLength(1);
      expect(problems[0]).toMatch(/entry 0 must be an object/);
    }
  });

  it("C-FONT-08 reports a missing or non-array axes and weights as a problem", () => {
    const noAxes = { ...entry(), axes: undefined } as unknown as FontEntry;
    const noWeights = { ...entry(), weights: "400" } as unknown as FontEntry;
    expect(validateCatalog([noAxes]).some((problem) => /axes/.test(problem))).toBe(true);
    expect(validateCatalog([noWeights]).some((problem) => /weights/.test(problem))).toBe(true);
    const staticNoWeights = { ...entry({ variable: false }), axes: [], weights: null };
    expect(
      validateCatalog([staticNoWeights as unknown as FontEntry]).some((p) => /weights/.test(p)),
    ).toBe(true);
  });

  it("C-FONT-08 reports a family with a quote or a backslash", () => {
    for (const family of ['Bad "Font"', "Bad\\Font"]) {
      const problems = validateCatalog([entry({ family })]);
      expect(
        problems.some((problem) => /family/.test(problem)),
        family,
      ).toBe(true);
    }
    expect(validateCatalog([entry({ family: "" })]).some((p) => /family/.test(p))).toBe(true);
  });

  it("C-FONT-08 throws TypeError for a catalog that is not an array", () => {
    expect(() => validateCatalog(null as never)).toThrow(TypeError);
    expect(() => validateCatalog(null as never)).toThrow(/^validateCatalog:/);
  });
});

describe("genericness", () => {
  it.each([
    [1, 1],
    [200, 0],
    [100, 0.50251],
    [41, 0.79899],
    [40, 0.80402],
    [500, 0],
  ])("C-FONT-09 scores popularity %d as %d", (popularity, score) => {
    expect(genericnessOf(popularity)).toBeCloseTo(score, 5);
  });

  it("C-FONT-10 scores geist and geist-mono 1 whatever their popularity", () => {
    const catalog = FONT_CATALOG.map((font) =>
      font.id.startsWith("geist") ? { ...font, popularity: 999 } : font,
    );
    expect(genericness("geist", catalog)).toBe(1);
    expect(genericness("geist-mono", catalog)).toBe(1);
    expect(genericness("host-grotesk", catalog)).toBeCloseTo(genericnessOf(111), 10);
  });

  it("C-FONT-11 matches the high list by name, with four prefix entries", () => {
    for (const name of [
      "Inter",
      "Roboto",
      "Open Sans",
      "Space Grotesk",
      "Instrument Serif",
      "IBM Plex Sans",
      "Cormorant Garamond",
      "DM Serif Display",
      "Crimson Pro",
    ]) {
      expect(isHighGenericnessFamily(name), name).toBe(true);
    }
    for (const name of ["Inter Tight", "Host Grotesk", "Albert Sans", "IBM", "Cormorantx"]) {
      expect(isHighGenericnessFamily(name), name).toBe(false);
    }
  });

  it("C-FONT-13 throws TypeError when the catalog is not an array", () => {
    expect(() => genericness("onest", null as never)).toThrow(TypeError);
    expect(() => genericness("onest", {} as never)).toThrow(
      /^genericness: catalog must be an array/,
    );
  });

  it("C-FONT-13 throws TypeError when the family is not a string", () => {
    expect(() => isHighGenericnessFamily(3 as never)).toThrow(TypeError);
    expect(() => isHighGenericnessFamily(3 as never)).toThrow(/^isHighGenericnessFamily:/);
  });

  it("C-FONT-12 holds the research list", () => {
    expect([...HIGH_GENERICNESS_FAMILIES]).toEqual([
      "Inter",
      "Roboto",
      "Open Sans",
      "Lato",
      "Montserrat",
      "Poppins",
      "Nunito",
      "DM Sans",
      "Plus Jakarta Sans",
      "Outfit",
      "Manrope",
      "Figtree",
      "Geist",
      "Geist Mono",
      "Space Grotesk",
      "Space Mono",
      "Fraunces",
      "Playfair Display",
      "Cormorant",
      "Lora",
      "Crimson",
      "Newsreader",
      "Syne",
      "IBM Plex",
      "DM Serif",
      "Instrument Sans",
      "Instrument Serif",
    ]);
    expect(Object.isFrozen(HIGH_GENERICNESS_FAMILIES)).toBe(true);
  });

  it("C-FONT-11 puts only the Geist pair of the catalog on the list", () => {
    const high = FONT_CATALOG.filter((font) => isHighGenericnessFamily(font.family)).map(
      (font) => font.id,
    );
    expect(high).toEqual(["geist", "geist-mono"]);
  });

  it("C-FONT-13 throws RangeError for an unknown id and TypeError for a non-string", () => {
    expect(() => genericness("nope")).toThrow(RangeError);
    expect(() => genericness("nope")).toThrow(/^genericness:/);
    expect(() => genericness(3 as never)).toThrow(TypeError);
    expect(() => genericness(3 as never)).toThrow(/^genericness:/);
  });

  it("C-FONT-13 throws RangeError for a popularity below 1 or NaN, TypeError for a non-number", () => {
    expect(() => genericnessOf(0)).toThrow(RangeError);
    expect(() => genericnessOf(Number.NaN)).toThrow(RangeError);
    expect(() => genericnessOf("5" as never)).toThrow(TypeError);
    expect(() => genericnessOf(0)).toThrow(/^genericnessOf:/);
  });

  it("C-FONT-23 scores the display faces against the 2026-11-01 metadata", () => {
    // R2-03 item 6 as amended: the metadata of 2026-11-01 gives archivo 14 and bodoni-moda 40,
    // so both display faces sit at or above the T1 line (0.8). This case pins what the catalog holds.
    const over = [];
    for (const pairing of PAIRINGS) {
      if (genericness(pairing.display) >= 0.8) over.push(pairing.display);
    }
    expect(over.sort()).toEqual(["archivo", "bodoni-moda"]);
    expect(genericness("archivo")).toBeCloseTo(0.9347, 3);
    expect(genericness("bodoni-moda")).toBeCloseTo(0.804, 3);
  });
});

describe("fontStack and fontFiles", () => {
  it("C-FONT-14 prefixes the quoted family to the fallback of its category", () => {
    expect(fontStack("host-grotesk")).toBe(`"Host Grotesk", ${SANS}`);
    expect(fontStack("source-serif-4")).toBe(`"Source Serif 4", ${SERIF}`);
    expect(fontStack("fragment-mono")).toBe(`"Fragment Mono", ${MONO}`);
  });

  it("C-FONT-15 throws RangeError for an unknown id and TypeError for a non-string", () => {
    expect(() => fontStack("nope")).toThrow(RangeError);
    expect(() => fontStack("nope")).toThrow(/^fontStack:/);
    expect(() => fontStack(3 as never)).toThrow(TypeError);
    expect(() => fontFiles("nope")).toThrow(RangeError);
    expect(() => fontFiles("nope")).toThrow(/^fontFiles:/);
    expect(() => fontFiles(3 as never)).toThrow(TypeError);
  });

  it("C-FONT-16 names the wght file and the license for a variable family", () => {
    expect(fontFiles("host-grotesk")).toEqual(["host-grotesk-latin-wght-normal.woff2", "OFL.txt"]);
  });

  it("C-FONT-16 names one file per copied weight for a static family", () => {
    expect(fontFiles("courier-prime")).toEqual([
      "courier-prime-latin-400-normal.woff2",
      "courier-prime-latin-700-normal.woff2",
      "OFL.txt",
    ]);
    expect(fontFiles("gloock")).toEqual(["gloock-latin-400-normal.woff2", "OFL.txt"]);
  });

  it("C-FONT-16 returns a frozen list", () => {
    expect(Object.isFrozen(fontFiles("gloock"))).toBe(true);
  });
});

describe("package.json and .gitignore", () => {
  const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")) as {
    scripts: Record<string, string>;
    devDependencies: Record<string, string>;
  };

  it("C-FONT-22 runs the copy script in predev and prebuild", () => {
    expect(pkg.scripts.predev).toMatch(/scripts\/copy-fonts\.mjs/);
    expect(pkg.scripts.prebuild).toMatch(/scripts\/copy-fonts\.mjs/);
  });

  it("C-FONT-22 lists one Fontsource devDependency per catalog id", () => {
    for (const font of FONT_CATALOG) {
      const name = `${font.variable ? "@fontsource-variable" : "@fontsource"}/${font.id}`;
      expect(pkg.devDependencies[name], name).toBeDefined();
      const other = `${font.variable ? "@fontsource" : "@fontsource-variable"}/${font.id}`;
      expect(pkg.devDependencies[other], other).toBeUndefined();
    }
    const fontsource = Object.keys(pkg.devDependencies).filter((key) =>
      key.startsWith("@fontsource"),
    );
    expect(fontsource).toHaveLength(40);
  });

  it("C-FONT-22 resolves every listed package in node_modules", () => {
    for (const font of FONT_CATALOG) {
      const name = `${font.variable ? "@fontsource-variable" : "@fontsource"}/${font.id}`;
      const metadata = path.join(ROOT, "node_modules", name, "metadata.json");
      expect(() => readFileSync(metadata), name).not.toThrow();
    }
  });

  it("C-FONT-22 matches variable and weights to the installed Fontsource metadata", () => {
    for (const font of FONT_CATALOG) {
      const dir = font.variable ? "@fontsource-variable" : "@fontsource";
      const metadata = JSON.parse(
        readFileSync(path.join(ROOT, "node_modules", dir, font.id, "metadata.json"), "utf8"),
      ) as {
        weights: number[];
        variable?: { wght?: { min: string; max: string } };
      };
      if (font.variable) {
        const wght = metadata.variable?.wght;
        expect([Number(wght?.min), Number(wght?.max)], font.id).toEqual(font.weights);
      } else {
        const copied = metadata.weights.filter((weight) => weight === 400 || weight === 700);
        expect(copied, font.id).toEqual(font.weights);
      }
    }
  });

  it("C-FONT-22 git-ignores public/fonts", () => {
    const ignore = readFileSync(path.join(ROOT, ".gitignore"), "utf8").split("\n");
    expect(ignore).toContain("public/fonts/");
  });
});
