import { readFileSync } from "node:fs";
import path from "node:path";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { ROLE_NAMES } from "@/engine";
import { cssFontStack, familyName, fontPackage } from "@/export/fonts";
import { describeDesign, USE_FOR } from "@/export/prose";
import { cssComment, editLink, mdText, slug, yamlString } from "@/export/text";
import { themeCss } from "@/export/theme-css";
import { encodeSpec, isPlainText } from "@/spec";
import { ORIGIN, SPEC } from "./golden-support";

// C-TEXT-01 to 08 of docs/specs/03-export.md, section 10.3 (R3-10, section 6.1, R3-22).

const LONG_NAME = `${"Saltmarsh".repeat(8)}`.slice(0, 80);
const SEED = 3006;
const plain = fc
  .string({ unit: "grapheme", minLength: 1, maxLength: 40 })
  .filter((text) => isPlainText(text));
const awkward = fc
  .array(
    fc.constantFrom(
      "#",
      ":",
      "- ",
      "yes",
      "null",
      "@",
      "%",
      "{",
      "&",
      "a",
      "b",
      " ",
      "*",
      "\\",
      '"',
    ),
    { minLength: 1, maxLength: 12 },
  )
  .map((parts) => parts.join(""))
  .filter((text) => isPlainText(text));

describe("C-TEXT-01 slug", () => {
  it.each([
    ["Saltmarsh Tide", "saltmarsh-tide"],
    ["Crème Brûlée!", "creme-brulee"],
    ["Łódź Straße", "lodz-strasse"],
    ["  --A__B--  ", "a-b"],
    ["日本", "design"],
    ["!!!", "design"],
    ["", "design"],
    ["Æon Œuvre Þor Ðin Ĳsel", "aeon-oeuvre-thor-din-ijsel"],
    ["a×b÷c", "a-b-c"],
    ["ſ ı İ ŉ Ŋ", "s-i-i-n-ng"],
  ])("%s gives %s", (text, expected) => {
    expect(slug(text)).toBe(expected);
  });

  it("cuts LONG_NAME to its first 48 characters, lowercased, with no trailing dash", () => {
    expect(slug(LONG_NAME)).toBe(LONG_NAME.slice(0, 48).toLowerCase());
  });

  it("trims the dash a cut leaves", () => {
    const text = `${"a".repeat(47)} b`;
    expect(slug(text)).toBe("a".repeat(47));
  });

  it("folds every letter of U+00C0 to U+017F to ASCII", () => {
    for (let code = 0xc0; code <= 0x17f; code += 1) {
      if (code === 0xd7 || code === 0xf7) continue;
      expect(slug(String.fromCodePoint(code))).toMatch(/^[a-z]+$/);
    }
  });
});

describe("C-TEXT-02 slug over full Unicode", () => {
  it("always matches the slug pattern in at most 48 characters", () => {
    fc.assert(
      fc.property(fc.string({ unit: "binary", maxLength: 80 }), (text) => {
        const out = slug(text);
        expect(out).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
        expect(out.length).toBeLessThanOrEqual(48);
      }),
      { numRuns: 1000, seed: SEED },
    );
  });

  it("src/export/text.ts holds no .normalize(", () => {
    const source = readFileSync(path.join(process.cwd(), "src/export/text.ts"), "utf8");
    expect(source).not.toContain(".normalize(");
  });
});

describe("C-TEXT-03 mdText", () => {
  it.each([
    ["a*b_c", "a\\*b\\_c"],
    ["[x](y)", "\\[x\\](y)"],
    ["<b>", "\\<b\\>"],
    ["a`b|c~d#e\\f", "a\\`b\\|c\\~d\\#e\\\\f"],
    ["- x", "\\- x"],
    ["+ x", "\\+ x"],
    ["= x", "\\= x"],
    ["12. x", "12\\. x"],
    ["a - b", "a - b"],
    ["1 2. x", "1 2. x"],
  ])("%s gives %s", (text, expected) => {
    expect(mdText(text)).toBe(expected);
  });

  it("removing each backslash before an escaped character gives back the input", () => {
    fc.assert(
      fc.property(fc.oneof(plain, awkward), (text) => {
        expect(mdText(text).replace(/\\([\\`*_[\]<>#|~\-+=.])/g, "$1")).toBe(text);
      }),
      { numRuns: 1000, seed: SEED },
    );
  });
});

describe("C-TEXT-04 yamlString", () => {
  it("escapes a backslash and a double quote", () => {
    expect(yamlString('He said "hi" \\ ok')).toBe('"He said \\"hi\\" \\\\ ok"');
  });

  it("reads back through yaml 2.9.1 as the same string", () => {
    fc.assert(
      fc.property(fc.oneof(plain, awkward), (text) => {
        expect(parse(yamlString(text), { schema: "core" })).toBe(text);
      }),
      { numRuns: 1000, seed: SEED },
    );
  });
});

describe("C-TEXT-05 cssComment", () => {
  it("writes * / for a closing sequence", () => {
    expect(cssComment("a */ b")).toBe("/* a * / b */");
    expect(cssComment("plain")).toBe("/* plain */");
  });

  it("closes at its last two characters and nowhere else", () => {
    fc.assert(
      fc.property(
        fc.oneof(plain, awkward, fc.constantFrom("*/", "a*/b", "**/", "/*", "*")),
        (text) => {
          if (!isPlainText(text)) return;
          const out = cssComment(text);
          expect(out.indexOf("*/")).toBe(out.length - 2);
        },
      ),
      { numRuns: 1000, seed: SEED },
    );
  });
});

describe("C-TEXT-06 the text helpers guard their input", () => {
  const helpers = { slug, mdText, yamlString, cssComment };
  for (const [name, fn] of Object.entries(helpers)) {
    it(`${name} throws TypeError for a non-string`, () => {
      for (const bad of [1, null, undefined, ["a"]]) {
        expect(() => fn(bad as unknown as string)).toThrow(TypeError);
        expect(() => fn(bad as unknown as string)).toThrow(name);
      }
    });
    if (name === "slug") continue;
    it(`${name} throws RangeError for text that is not plain`, () => {
      for (const bad of ["", "a\nb", " a", "a ", "‮a"]) {
        expect(() => fn(bad)).toThrow(RangeError);
        expect(() => fn(bad)).toThrow(name);
      }
    });
  }
});

describe("C-TEXT-07 fonts and prose", () => {
  it("familyName reads the catalog, else the id with dashes as spaces", () => {
    expect(familyName("source-serif-4")).toBe("Source Serif 4");
    expect(familyName("inter")).toBe("inter");
    expect(familyName("jetbrains-mono")).toBe("jetbrains mono");
  });

  it("cssFontStack follows Fontsource's names", () => {
    expect(cssFontStack("host-grotesk", "body")).toMatch(
      /^"Host Grotesk Variable", "Host Grotesk",/,
    );
    expect(cssFontStack("gloock", "display")).toMatch(/^"Gloock",/);
    expect(cssFontStack("gloock", "display")).not.toContain("Variable");
    expect(cssFontStack("inter", "body")).toMatch(/^"inter", ui-sans-serif/);
    expect(cssFontStack("jetbrains-mono", "mono")).toMatch(
      /^"jetbrains mono", ui-monospace.*monospace$/,
    );
    expect(cssFontStack("fragment-mono", "mono")).toMatch(/^"Fragment Mono", ui-monospace/);
  });

  it("fontPackage names the Fontsource package", () => {
    expect(fontPackage("fragment-mono")).toBe("@fontsource/fragment-mono");
    expect(fontPackage("host-grotesk")).toBe("@fontsource-variable/host-grotesk");
    expect(fontPackage("inter")).toBeNull();
  });

  it("describeDesign is one plain sentence that names no hex or color", () => {
    const sentence = describeDesign(SPEC);
    expect(isPlainText(sentence)).toBe(true);
    expect(sentence).toMatch(/\.$/);
    expect(sentence.match(/\./g)).toHaveLength(1);
    expect(sentence).not.toMatch(
      /#[0-9a-f]{3,8}|oklch|\b(red|blue|green|purple|orange|yellow|pink|gray|grey)\b/i,
    );
    expect(sentence).not.toMatch(/\b(simply|just|easy|obviously|basically)\b/i);
  });

  it("describeDesign is stable and varies with the design", () => {
    expect(describeDesign(SPEC)).toBe(describeDesign(SPEC));
    const other = structuredClone(SPEC);
    other.shape.radiusSet = other.shape.radiusSet === "sharp" ? "round" : "sharp";
    expect(describeDesign(other)).not.toBe(describeDesign(SPEC));
  });

  it("USE_FOR gives each of the 46 roles one plain sentence of at most 90 characters", () => {
    expect(Object.keys(USE_FOR)).toEqual([...ROLE_NAMES]);
    expect(ROLE_NAMES).toHaveLength(46);
    for (const role of ROLE_NAMES) {
      const text = USE_FOR[role];
      expect(isPlainText(text), role).toBe(true);
      expect(text.length, role).toBeLessThanOrEqual(90);
      expect(text, role).toMatch(/\.$/);
      expect(text.match(/\./g), role).toHaveLength(1);
      expect(text, role).not.toMatch(/\b(simply|just|easy|obviously|basically)\b/i);
      expect(text, role).not.toContain("!");
      expect(text, role).not.toMatch(/colour|grey|behaviour/i);
    }
    expect(Object.isFrozen(USE_FOR)).toBe(true);
  });
});

describe("C-TEXT-08 the font helpers guard their input", () => {
  it("throw TypeError for a non-string id and RangeError for a bad id", () => {
    for (const [name, fn] of [
      ["familyName", (id: string) => familyName(id)],
      ["cssFontStack", (id: string) => cssFontStack(id, "body")],
      ["fontPackage", (id: string) => fontPackage(id)],
    ] as const) {
      expect(() => fn(1 as unknown as string)).toThrow(TypeError);
      expect(() => fn(1 as unknown as string)).toThrow(name);
      expect(() => fn("Bad Id")).toThrow(RangeError);
      expect(() => fn("Bad Id")).toThrow(name);
    }
  });

  it("cssFontStack throws RangeError for an unknown slot", () => {
    expect(() => cssFontStack("host-grotesk", "heading" as "body")).toThrow(RangeError);
    expect(() => cssFontStack("host-grotesk", "heading" as "body")).toThrow("cssFontStack");
    expect(() => cssFontStack("host-grotesk", 1 as unknown as "body")).toThrow(TypeError);
  });

  it("describeDesign throws RangeError for an unknown choice and TypeError for a wrong type", () => {
    const unknown = structuredClone(SPEC);
    unknown.shape.radiusSet = "pointy" as never;
    expect(() => describeDesign(unknown)).toThrow(RangeError);
    expect(() => describeDesign(unknown)).toThrow("describeDesign");
    const wrong = structuredClone(SPEC);
    wrong.color.params.harmony = 3 as never;
    expect(() => describeDesign(wrong)).toThrow(TypeError);
    expect(() => describeDesign(5 as never)).toThrow(TypeError);
    expect(() => themeCss(5 as never, ORIGIN)).toThrow(TypeError);
  });

  it("describeDesign throws TypeError for null", () => {
    expect(() => describeDesign(null as never)).toThrow(TypeError);
    expect(() => describeDesign(null as never)).toThrow("describeDesign");
  });
});

describe("editLink", () => {
  it("joins the origin, /studio#s= and the encoded spec", () => {
    expect(editLink(SPEC, ORIGIN)).toBe(`${ORIGIN}/studio#s=${encodeSpec(SPEC)}`);
  });

  it("rejects an origin that is not a bare https origin", () => {
    for (const bad of [
      "http://dyelot.vercel.app",
      "https://dyelot.vercel.app/",
      "https://a.b/x",
      "nope",
      "",
    ]) {
      expect(() => editLink(SPEC, bad)).toThrow(RangeError);
      expect(() => editLink(SPEC, bad)).toThrow("editLink");
    }
    expect(() => editLink(SPEC, 42 as unknown as string)).toThrow(TypeError);
    expect(() => editLink(SPEC, 42 as unknown as string)).toThrow("editLink");
  });
});
