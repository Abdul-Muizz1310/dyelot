import { describe, expect, it } from "vitest";
import {
  freshParams,
  generateSystem,
  lintSpec,
  type Oklch,
  oklchToRgb,
  onFill,
  presetOf,
  ROLE_NAMES,
  resolveParams,
} from "@/engine";
import { sha256 } from "@/export/sha256";
import { buildImport, type ImportDraft } from "@/import/build";
import { importShadcnCss } from "@/import/css";
import { detectImport } from "@/import/detect";
import { IMPORT_MAX_BYTES } from "@/import/report";
import { normalizeSpec } from "@/spec";
import { errorOf, hexNear, okOf, readFixture } from "./helpers";

// Cases C-IMP-nn of docs/specs/03-export.md, section 10.10, for the shadcn CSS importer, the shared
// build (R3-29) and detectImport. The DESIGN.md halves belong to Task 3.12.

const MESSAGES = {
  empty: "The import is empty. Paste a DESIGN.md or a shadcn theme, or choose a file.",
  "too-large":
    "That is larger than 256 KB. Import a DESIGN.md or a theme stylesheet of at most 256 KB.",
  binary: "That does not look like text. Choose a .md or a .css file.",
  "no-roles":
    "No theme colors were found. A shadcn theme defines variables such as --background and --primary in :root.",
} as const;

const NEUTRAL = readFixture("shadcn-neutral.css");

/** A draft of the least a draft holds; `over` replaces fields. */
function draft(over: Partial<ImportDraft> = {}): ImportDraft {
  return {
    source: "shadcn-css",
    normalized: "x",
    primary: { l: 0.55, c: 0.15, h: 250 },
    roles: { light: {}, dark: {} },
    text: {},
    report: { ignored: [], truncated: [], notes: [] },
    ...over,
  };
}

const color = (rgb: readonly [number, number, number], alpha = 1, source = "x") => ({
  rgb,
  alpha,
  inGamut: true,
  source,
});

describe("C-IMP-01 a first argument that is not a string", () => {
  it("throws a TypeError naming the function", () => {
    for (const value of [undefined, null, 1, {}, [], true, Symbol("s")]) {
      expect(() => importShadcnCss(value as never)).toThrow(TypeError);
      expect(() => importShadcnCss(value as never)).toThrow(/importShadcnCss/);
      expect(() => detectImport(value as never)).toThrow(TypeError);
      expect(() => detectImport(value as never)).toThrow(/detectImport/);
    }
    for (const name of [1, null, {}, true]) {
      expect(() => detectImport("x", name as never)).toThrow(TypeError);
      expect(() => detectImport("x", name as never)).toThrow(/detectImport/);
    }
  });
});

describe("C-IMP-02 the size limit", () => {
  it("rejects 262,145 bytes and accepts 262,144", () => {
    expect(IMPORT_MAX_BYTES).toBe(262_144);
    const over = errorOf(importShadcnCss("a".repeat(262_145)));
    expect(over.code).toBe("too-large");
    expect(over.message).toBe(MESSAGES["too-large"]);
    expect(errorOf(importShadcnCss(`${"é".repeat(131_072)}a`)).code).toBe("too-large");
    expect(errorOf(importShadcnCss("a".repeat(262_144))).code).not.toBe("too-large");
    expect(errorOf(importShadcnCss("é".repeat(131_072))).code).not.toBe("too-large");
  });

  it("counts the raw text, before the byte-order mark is dropped", () => {
    // 262,144 bytes of text plus a three-byte mark is over the limit.
    expect(errorOf(importShadcnCss(`﻿${"a".repeat(262_144)}`)).code).toBe("too-large");
  });
});

describe("C-IMP-04 an empty text", () => {
  it("gives empty for nothing, white space and a lone byte-order mark", () => {
    for (const text of ["", "   \n\t", "﻿"]) {
      const error = errorOf(importShadcnCss(text));
      expect(error.code).toBe("empty");
      expect(error.message).toBe(MESSAGES.empty);
    }
  });
});

describe("C-IMP-05 binary text", () => {
  it("gives binary for U+0000 and for 1 in 100 U+FFFD", () => {
    const nul = errorOf(importShadcnCss(`:root { --primary: red; }\u0000`));
    expect(nul.code).toBe("binary");
    expect(nul.message).toBe(MESSAGES.binary);
    expect(errorOf(importShadcnCss("a".repeat(990) + "�".repeat(10))).code).toBe("binary");
    expect(errorOf(importShadcnCss("a".repeat(991) + "�".repeat(9))).code).not.toBe("binary");
  });
});

describe("C-IMP-06 normalization", () => {
  it("gives equal specs and reports for LF, CRLF, CR and a byte-order mark", () => {
    const lf = NEUTRAL;
    const variants = [
      lf.replace(/\n/g, "\r\n"),
      lf.replace(/\n/g, "\r"),
      `﻿${lf}`,
      `﻿${lf.replace(/\n/g, "\r\n")}`,
    ];
    const base = okOf(importShadcnCss(lf));
    for (const text of variants) {
      const result = okOf(importShadcnCss(text));
      expect(result.spec).toEqual(base.spec);
      expect(result.report).toEqual(base.report);
    }
  });
});

describe("C-IMP-07 the deterministic seed", () => {
  it("gives the same id twice and seeds from the normalized text", () => {
    const a = okOf(importShadcnCss(NEUTRAL));
    const b = okOf(importShadcnCss(NEUTRAL));
    expect(a.spec).toEqual(b.spec);
    expect(a.spec.meta.seed).toBe(`import-${sha256(NEUTRAL).slice(0, 16)}`);
    const crlf = okOf(importShadcnCss(`﻿${NEUTRAL.replace(/\n/g, "\r\n")}`));
    expect(crlf.spec.meta.seed).toBe(a.spec.meta.seed);
  });
});

describe("C-IMP-08 inference", () => {
  const tint = (
    rgb: readonly [number, number, number],
    primary: Oklch = { l: 0.5, c: 0.15, h: 250 },
  ) => okOf(buildImport(draft({ primary, tintFrom: rgb }))).report.inferred.tint;

  /** An sRGB triple of the given OKLCH. */
  const rgbOf = (l: number, c: number, h: number): readonly [number, number, number] =>
    oklchToRgb({ l, c, h }, "srgb");

  it("reads the tint from the muted color", () => {
    expect(tint(rgbOf(0.95, 0.004, 100))).toBe("none");
    expect(tint(rgbOf(0.95, 0.02, 270), { l: 0.5, c: 0.15, h: 250 })).toBe("brand");
    expect(tint(rgbOf(0.95, 0.02, 60))).toBe("warm");
    expect(tint(rgbOf(0.95, 0.02, 250), { l: 0.5, c: 0.15, h: 100 })).toBe("cool");
    expect(tint(rgbOf(0.95, 0.02, 350), { l: 0.5, c: 0.15, h: 150 })).toBe("warm");
    expect(tint(rgbOf(0.95, 0.02, 140), { l: 0.5, c: 0.15, h: 250 })).toBe("cool");
  });

  it("reads the radius, nearest set first and the rounder on a tie", () => {
    const radius = (value?: number) =>
      okOf(buildImport(draft(value === undefined ? {} : { radiusPx: { value, from: "css" } })))
        .report.inferred.radius;
    expect(radius(10)).toBe("soft");
    expect(radius(14)).toBe("round");
    expect(radius(8)).toBe("soft");
    expect(radius(0)).toBe("sharp");
    expect(radius(40)).toBe("round");
    expect(radius()).toBe("soft");
  });

  it("reads the radius from rounded.md when lg is absent", () => {
    const radius = (value: number) =>
      okOf(buildImport(draft({ radiusPx: { value, from: "md" } }))).report.inferred.radius;
    // md is 2, 8 and 12 in the three sets.
    expect(radius(2)).toBe("sharp");
    expect(radius(8)).toBe("soft");
    expect(radius(10)).toBe("round");
  });

  it("reads the context from the body and display sizes", () => {
    const context = (bodyPx?: number, displayPx?: number) =>
      okOf(
        buildImport(
          draft({
            ...(bodyPx === undefined ? {} : { bodyPx }),
            ...(displayPx === undefined ? {} : { displayPx }),
          }),
        ),
      ).report.inferred.context;
    expect(context(14)).toBe("dense");
    expect(context(16)).toBe("product");
    expect(context(18, 64)).toBe("marketing");
    expect(context(18, 48)).toBe("editorial");
    expect(context(18)).toBe("editorial");
    expect(context(14.9)).toBe("dense");
    expect(context(15)).toBe("product");
    expect(context(17.9)).toBe("product");
    expect(context()).toBe("product");
  });

  it("sets the pairing from three families and a custom font from others", () => {
    const pairing = okOf(
      buildImport(
        draft({
          families: { display: "host-grotesk", body: "host-grotesk", mono: "fragment-mono" },
        }),
      ),
    );
    expect(pairing.report.inferred.pairing).toBe("host-grotesk");
    expect(pairing.report.inferred.customFonts).toBe(false);
    expect(pairing.spec.type.families).toEqual({
      display: "host-grotesk",
      body: "host-grotesk",
      mono: "fragment-mono",
    });
    const custom = okOf(buildImport(draft({ families: { body: "inter" } })));
    expect(custom.report.inferred.pairing).toBeNull();
    expect(custom.report.inferred.customFonts).toBe(true);
    expect(custom.spec.type.families.body).toBe("inter");
  });
});

describe("C-IMP-09 the overlay", () => {
  it("gamut-maps an out-of-gamut primary and reports gamut", () => {
    const result = okOf(
      importShadcnCss(":root { --background: #fff; --primary: oklch(0.7 0.4 145); }"),
    );
    const hex = result.spec.color.roles.light.primary;
    expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    const entry = result.report.adjusted.find((a) => a.role === "primary" && a.reason === "gamut");
    expect(entry).toMatchObject({ mode: "light", from: "oklch(0.7 0.4 145)", to: hex });
  });

  it("flattens alpha over the mode's background", () => {
    const result = okOf(
      importShadcnCss(
        ":root { --background: #ffffff; --primary: #3a6ea5; --border: rgb(0 0 0 / 50%); }",
      ),
    );
    expect(hexNear(result.spec.color.roles.light.border, "#808080")).toBe(true);
    const entry = result.report.adjusted.find((a) => a.role === "border");
    expect(entry).toMatchObject({ mode: "light", reason: "alpha" });
  });

  it("flattens over the generated background when none is imported", () => {
    const result = okOf(
      importShadcnCss(":root { --primary: #3a6ea5; --border: rgb(0 0 0 / 50%); }"),
    );
    expect(result.report.adjusted.some((a) => a.role === "border" && a.reason === "alpha")).toBe(
      true,
    );
  });

  it("gives a primary without its foreground onFill(primary)", () => {
    const result = okOf(importShadcnCss(":root { --primary: #3a6ea5; }"));
    const { primary, "primary-foreground": fg } = result.spec.color.roles.light;
    expect(primary).toBe("#3a6ea5");
    const rgb = [1, 3, 5].map((i) => Number.parseInt(primary.slice(i, i + 2), 16) / 255);
    expect(fg).toBe(onFill([rgb[0] as number, rgb[1] as number, rgb[2] as number]));
    expect(result.report.adjusted).toContainEqual(
      expect.objectContaining({
        mode: "light",
        role: "primary-foreground",
        reason: "foreground",
        to: fg,
      }),
    );
  });

  it("keeps an imported foreground and keeps the generated dark roles without a dark block", () => {
    const result = okOf(
      importShadcnCss(":root { --primary: #3a6ea5; --primary-foreground: #fefefe; }"),
    );
    expect(result.spec.color.roles.light["primary-foreground"]).toBe("#fefefe");
    expect(result.report.adjusted.some((a) => a.role === "primary-foreground")).toBe(false);
    expect(result.report.generated.dark).toBe(46);
    expect(result.report.generated.darkGenerated).toBe(true);
    expect(result.report.generated.light).toBe(44);
  });
});

describe("C-IMP-10 the result", () => {
  it("is an import, at AA, matching no preset", () => {
    const { spec, report } = okOf(importShadcnCss(NEUTRAL));
    expect(spec.meta.createdWith).toBe("import");
    expect(spec.color.params.contrastLevel).toBe("AA");
    expect(presetOf(spec)).toBeNull();
    expect(report.format).toBe("shadcn-css");
    expect(report.exact).toBe(false);
    expect(spec).toEqual(normalizeSpec(spec));
    const light = report.mapped.filter((m) => m.mode === "light").length;
    expect(report.generated.light).toBe(ROLE_NAMES.length - light);
  });

  it("lists mapped roles in input order", () => {
    const { report } = okOf(
      importShadcnCss(":root { --ring: #333; --primary: #3a6ea5; --background: #fff; }"),
    );
    expect(report.mapped.map((m) => m.role)).toEqual(["ring", "primary", "background"]);
  });

  it("caps ignored at 50 and counts the rest", () => {
    const names = Array.from({ length: 60 }, (_, i) => `--x${i}`);
    const css = `:root { --primary: #3a6ea5; ${names.map((n) => `${n}: 1;`).join(" ")} }`;
    const { report } = okOf(importShadcnCss(css));
    expect(report.ignored).toEqual(names.slice(0, 50));
    expect(report.ignoredMore).toBe(10);
  });
});

describe("C-IMP-11 an import that fails the linter still succeeds", () => {
  it("returns ok for shadcn-neutral.css", () => {
    const { spec } = okOf(importShadcnCss(NEUTRAL));
    const errors = lintSpec(spec).filter((finding) => finding.severity === "error");
    expect(errors.length).toBeGreaterThan(0);
    expect(spec.meta.name).toBe("Imported theme");
  });
});

describe("C-IMP-12 detectImport", () => {
  it("trusts a file name", () => {
    expect(detectImport(":root { --primary: red }", "x.md")).toBe("design-md");
    expect(detectImport("# title", "theme.css")).toBe("shadcn-css");
    expect(detectImport("x", "x.markdown")).toBe("design-md");
    expect(detectImport("---\nname: x\n---", "THEME.CSS")).toBe("shadcn-css");
  });

  it("reads the text without a name", () => {
    expect(detectImport("\n\n---\nname: x\n---\n")).toBe("design-md");
    expect(detectImport("# T\n\n## Colors\n")).toBe("design-md");
    expect(detectImport(":root {\n}")).toBe("shadcn-css");
    expect(detectImport(".dark{ }")).toBe("shadcn-css");
    expect(detectImport("a { --primary: red }")).toBe("shadcn-css");
    expect(detectImport("--background : red")).toBe("shadcn-css");
    expect(detectImport("hello")).toBeNull();
    expect(detectImport("")).toBeNull();
  });
});

describe("C-IMP-13 buildImport rejects a bad draft", () => {
  it("throws a TypeError for a non-object", () => {
    for (const value of [null, undefined, 1, "x", []]) {
      expect(() => buildImport(value as never)).toThrow(TypeError);
      expect(() => buildImport(value as never)).toThrow(/buildImport/);
    }
  });

  it("throws for a primary out of range and for roles that are not objects", () => {
    expect(() => buildImport(draft({ primary: { l: 1.5, c: 0.1, h: 10 } }))).toThrow(RangeError);
    expect(() => buildImport(draft({ primary: { l: 1.5, c: 0.1, h: 10 } }))).toThrow(/buildImport/);
    expect(() => buildImport(draft({ roles: { light: 3, dark: {} } as never }))).toThrow(TypeError);
    expect(() => buildImport(draft({ roles: { light: 3, dark: {} } as never }))).toThrow(
      /buildImport/,
    );
    expect(() => buildImport(draft({ roles: { light: {}, dark: null } as never }))).toThrow(
      /buildImport/,
    );
    expect(() => buildImport(draft({ normalized: 5 as never }))).toThrow(TypeError);
    expect(() => buildImport(draft({ primary: null as never }))).toThrow(/buildImport/);
    expect(() =>
      buildImport(draft({ roles: { light: { nope: color([0, 0, 0]) }, dark: {} } as never })),
    ).toThrow(RangeError);
    expect(() =>
      buildImport(draft({ roles: { light: { primary: { rgb: [0, 0] } }, dark: {} } as never })),
    ).toThrow(/buildImport/);
    expect(() => buildImport(draft({ radiusPx: { value: -1, from: "css" } }))).toThrow(RangeError);
    expect(() => buildImport(draft({ bodyPx: Number.NaN }))).toThrow(RangeError);
    expect(() => buildImport(draft({ source: "pdf" as never }))).toThrow(RangeError);
    expect(() => buildImport(draft({ report: null as never }))).toThrow(TypeError);
  });

  it("throws for a direction that is not one, or that comes with a thesis", () => {
    const bad: [unknown, ErrorConstructor][] = [
      [{ direction: 5 }, TypeError],
      [{ direction: { thesis: 5 } }, TypeError],
      [{ direction: { like: [1] } }, TypeError],
      [{ thesis: "a", direction: { thesis: "b" } }, RangeError],
      [{ verbatim: "yes" }, TypeError],
      // A direction comes only with verbatim text (a decoded spec's), a thesis only without.
      [{ direction: { thesis: "b" } }, RangeError],
      [{ verbatim: true, thesis: "a" }, RangeError],
      // Verbatim text must already be what a spec holds.
      [{ verbatim: true, name: " padded" }, RangeError],
      [{ verbatim: true, oneLiner: "x".repeat(141) }, RangeError],
      [{ verbatim: true, direction: {} }, RangeError],
      [{ verbatim: true, do: [""] }, RangeError],
    ];
    for (const [text, kind] of bad) {
      expect(() => buildImport(draft({ text: text as never }))).toThrow(kind);
      expect(() => buildImport(draft({ text: text as never }))).toThrow(/buildImport/);
    }
  });
});

describe("buildImport text", () => {
  it("cuts text through toPlainText and lists what it cut", () => {
    const long = "word ".repeat(100);
    const result = okOf(
      buildImport(
        draft({
          text: {
            name: "N".repeat(100),
            oneLiner: long,
            thesis: long,
            do: ["Do this", "  ", ...Array.from({ length: 25 }, (_, i) => `Do ${i}`)],
            dont: ["x".repeat(300)],
          },
        }),
      ),
    );
    expect(result.spec.meta.name).toBe("N".repeat(80));
    expect(result.spec.meta.oneLiner?.length).toBeLessThanOrEqual(140);
    expect(result.spec.direction?.thesis?.length).toBeLessThanOrEqual(280);
    expect(result.spec.rules.do).toHaveLength(20);
    expect(result.spec.rules.dont[0]).toHaveLength(200);
    expect(result.report.truncated).toEqual(["name", "oneLiner", "thesis", "do", "dont"]);
  });

  it("keeps a decoded spec's whole direction as it is (R3-32)", () => {
    const direction = {
      thesis: "Calm surfaces.",
      adjectives: ["calm", "salt-worn"],
      like: ["harbor charts"],
      unlike: ["neon"],
    };
    const result = okOf(buildImport(draft({ text: { verbatim: true, direction } })));
    expect(result.spec.direction).toEqual(direction);
    expect(result.report.truncated).toEqual([]);
  });

  it("passes verbatim text unchanged, where prose text is folded (R3-32)", () => {
    const text = {
      name: "Harbor  Lights",
      oneLiner: "Reads\u00a0the  tide",
      do: ["keep  10\u00a0px"],
    };
    const kept = okOf(buildImport(draft({ text: { verbatim: true, ...text } })));
    expect(kept.spec.meta.name).toBe(text.name);
    expect(kept.spec.meta.oneLiner).toBe(text.oneLiner);
    expect(kept.spec.rules).toEqual({ do: text.do, dont: [] });
    expect(kept.report.truncated).toEqual([]);
    const folded = okOf(buildImport(draft({ text })));
    expect(folded.spec.meta.name).toBe("Harbor Lights");
    expect(folded.spec.meta.oneLiner).toBe("Reads the tide");
    expect(folded.spec.rules.do).toEqual(["keep 10 px"]);
  });

  it("names an unnamed design Imported design", () => {
    expect(okOf(buildImport(draft())).spec.meta.name).toBe("Imported design");
  });
});

describe("the build runs the generator on fresh parameters", () => {
  it("keeps the generated palettes of the resolved parameters", () => {
    const seed = `import-${sha256("x").slice(0, 16)}`;
    const base = generateSystem(
      resolveParams(
        {
          ...freshParams(),
          primary: { l: 0.55, c: 0.15, h: 250 },
          contrastLevel: "AA",
          radius: "soft",
          type: { context: "product" },
        },
        seed,
      ),
      seed,
    );
    const result = okOf(buildImport(draft({ normalized: "x" })));
    expect(result.spec.color.palettes).toEqual(base.color.palettes);
    expect(result.spec.meta.seed).toBe(seed);
  });
});

describe("C-PMATCH-04 IMPORTED matches no preset", () => {
  it("gives null for the imported shadcn neutral theme", () => {
    expect(presetOf(okOf(importShadcnCss(NEUTRAL)).spec)).toBeNull();
  });
});
