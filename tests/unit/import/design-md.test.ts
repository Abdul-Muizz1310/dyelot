import { describe, expect, it } from "vitest";
import { generateSystem, paramsOfSpec, ROLE_NAMES, resolveParams } from "@/engine";
import { designMd } from "@/export/design-md";
import { importDesignMd } from "@/import/design-md";
import { detectImport } from "@/import/detect";
import { IMPORT_MAX_BYTES } from "@/import/report";
import { type DesignSpec, normalizeSpec } from "@/spec";
import { GOLDENS, ORIGIN } from "../export/golden-support";
import { DEFAULT_PARAMS } from "../spec/support";
import { errorOf, hexNear, okOf, readFixture } from "./helpers";

// C-DMI-01 to 12 and the importDesignMd halves of C-IMP-01, 02, 04, 05 and 12 of
// docs/specs/03-export.md, section 10 (R3-30, R3-32, section 8).

const README = readFixture("design-md-readme.md");

/** A DESIGN.md of a front matter (without fences) and a body. */
function md(front: string, body = ""): string {
  return `---\n${front}\n---\n${body}`;
}

const PRIMARY = 'colors:\n  primary: "#3a6ea5"';

describe("C-IMP-01 importDesignMd with a first argument that is not a string", () => {
  it("throws a TypeError naming the function", () => {
    for (const value of [undefined, null, 1, {}, [], true, Symbol("s")]) {
      expect(() => importDesignMd(value as never)).toThrow(TypeError);
      expect(() => importDesignMd(value as never)).toThrow(/importDesignMd/);
    }
  });
});

describe("C-IMP-02 importDesignMd and the size limit", () => {
  it("rejects 262,145 bytes and accepts 262,144", () => {
    const over = errorOf(importDesignMd("a".repeat(IMPORT_MAX_BYTES + 1)));
    expect(over.code).toBe("too-large");
    expect(over.message).toBe(
      "That is larger than 256 KB. Import a DESIGN.md or a theme stylesheet of at most 256 KB.",
    );
    expect(errorOf(importDesignMd(`${"é".repeat(131_072)}a`)).code).toBe("too-large");
    expect(errorOf(importDesignMd("a".repeat(IMPORT_MAX_BYTES))).code).not.toBe("too-large");
    expect(errorOf(importDesignMd(`﻿${"a".repeat(IMPORT_MAX_BYTES)}`)).code).toBe("too-large");
  });
});

describe("C-IMP-04 importDesignMd and an empty text", () => {
  it("gives empty for nothing, white space and a lone byte-order mark", () => {
    for (const text of ["", "   \n\t", "﻿"]) {
      const error = errorOf(importDesignMd(text));
      expect(error.code).toBe("empty");
      expect(error.message).toBe(
        "The import is empty. Paste a DESIGN.md or a shadcn theme, or choose a file.",
      );
    }
  });
});

describe("C-IMP-05 importDesignMd and binary text", () => {
  it("gives binary for U+0000 and for 1 in 100 U+FFFD", () => {
    const nul = errorOf(importDesignMd(`${md(PRIMARY)}\u0000`));
    expect(nul.code).toBe("binary");
    expect(nul.message).toBe("That does not look like text. Choose a .md or a .css file.");
    expect(errorOf(importDesignMd("a".repeat(990) + "�".repeat(10))).code).toBe("binary");
    expect(errorOf(importDesignMd("a".repeat(991) + "�".repeat(9))).code).not.toBe("binary");
  });
});

describe("C-IMP-12 detectImport on a DESIGN.md", () => {
  it("reads the README example as design-md", () => {
    expect(detectImport(README)).toBe("design-md");
    expect(detectImport(README, "x.md")).toBe("design-md");
  });
});

describe("C-DMI-01 the README example", () => {
  it("imports, maps the role-named colors and ignores the others", () => {
    const result = okOf(importDesignMd(README));
    expect(result.report.format).toBe("design-md");
    expect(result.report.exact).toBe(false);
    expect(result.report.mapped.map((m) => m.role).sort()).toEqual(["primary", "secondary"]);
    expect(result.report.ignored).toEqual(expect.arrayContaining(["tertiary", "neutral"]));
    expect(result.report.ignored).not.toContain("primary");
    expect(hexNear(result.spec.color.roles.light.primary, "#1a1c1e", 1)).toBe(true);
    expect(result.spec.meta.name).toBe("Heritage");
    expect(result.spec.meta.createdWith).toBe("import");
    expect(result.spec).toEqual(normalizeSpec(result.spec));
  });

  it("reads the same text again to the same spec", () => {
    expect(okOf(importDesignMd(README)).spec).toEqual(okOf(importDesignMd(README)).spec);
  });
});

describe("C-DMI-02 the alias table", () => {
  const ALIASES: readonly (readonly [string, string])[] = [
    ["surface", "background"],
    ["background", "background"],
    ["on-surface", "foreground"],
    ["on-background", "foreground"],
    ["text", "foreground"],
    ["on-primary", "primary-foreground"],
    ["error", "destructive"],
    ["on-error", "destructive-foreground"],
    ["outline", "border"],
  ];

  it.each(ALIASES)("maps %s to %s", (name, role) => {
    const result = okOf(importDesignMd(md(`${PRIMARY}\n  ${name}: "#102030"`)));
    const entry = result.report.mapped.find((m) => m.role === role);
    expect(entry).toMatchObject({ mode: "light", source: "#102030" });
    expect(result.report.ignored).not.toContain(name);
    expect(hexNear(result.spec.color.roles.light[role as never], "#102030", 1)).toBe(true);
  });

  it("maps every role name to itself", () => {
    const front = `colors:\n${ROLE_NAMES.map((role) => `  ${role}: "#445566"`).join("\n")}`;
    const result = okOf(importDesignMd(md(front)));
    expect(result.report.mapped.map((m) => m.role).sort()).toEqual([...ROLE_NAMES].sort());
    expect(result.report.ignored).toEqual([]);
  });

  it("ignores neutral and brand-50", () => {
    const result = okOf(
      importDesignMd(md(`${PRIMARY}\n  neutral: "#eeeeee"\n  brand-50: "#fafafa"`)),
    );
    expect(result.report.ignored).toEqual(expect.arrayContaining(["neutral", "brand-50"]));
    expect(result.report.mapped.map((m) => m.role)).toEqual(["primary"]);
  });

  it("lets a role name win over an alias of the same role", () => {
    const result = okOf(
      importDesignMd(md(`${PRIMARY}\n  surface: "#111111"\n  background: "#fefefe"`)),
    );
    expect(hexNear(result.spec.color.roles.light.background, "#fefefe", 1)).toBe(true);
    expect(result.report.ignored).toContain("surface");
  });

  it("skips a color it cannot read and says so", () => {
    const result = okOf(importDesignMd(md(`${PRIMARY}\n  border: "not a color"`)));
    expect(result.report.mapped.map((m) => m.role)).toEqual(["primary"]);
    expect(result.report.notes.join(" ")).toContain("border");
  });
});

describe("C-DMI-03 the seeds", () => {
  const seed = (front: string) => okOf(importDesignMd(md(front))).spec.color.params;

  it("takes the secondary seed from a secondary with chroma of at least 0.04", () => {
    expect(seed(`${PRIMARY}\n  secondary: "oklch(0.6 0.1 150)"`).secondary).toBeDefined();
    expect(seed(`${PRIMARY}\n  secondary: "oklch(0.6 0.03 150)"`).secondary).toBeUndefined();
    expect(seed(PRIMARY).secondary).toBeUndefined();
  });

  it("takes the accent seed from tertiary, else accent", () => {
    const fromTertiary = seed(`${PRIMARY}\n  tertiary: "oklch(0.6 0.1 30)"`).accent;
    expect(fromTertiary?.h).toBeCloseTo(30, 0);
    const fromAccent = seed(`${PRIMARY}\n  accent: "oklch(0.6 0.1 200)"`).accent;
    expect(fromAccent?.h).toBeCloseTo(200, 0);
    const both = seed(
      `${PRIMARY}\n  accent: "oklch(0.6 0.1 200)"\n  tertiary: "oklch(0.6 0.1 30)"`,
    );
    expect(both.accent?.h).toBeCloseTo(30, 0);
    expect(seed(`${PRIMARY}\n  tertiary: "oklch(0.6 0.03 30)"`).accent).toBeUndefined();
  });
});

describe("C-DMI-04 the type tokens", () => {
  const front = (typography: string) => `${PRIMARY}\ntypography:\n${typography}`;
  const ctx = (typography: string) =>
    okOf(importDesignMd(md(front(typography)))).report.inferred.context;

  it("reads the body size from body, else body-md, else the first body*", () => {
    const tok = (name: string, px: number) =>
      `  ${name}:\n    fontFamily: Inter\n    fontSize: ${px}px`;
    expect(ctx(`${tok("body-md", 12)}\n${tok("body", 18)}`)).toBe("editorial");
    expect(ctx(`${tok("body-sm", 18)}\n${tok("body-md", 12)}`)).toBe("dense");
    expect(ctx(`${tok("body-lg", 12)}\n${tok("body-sm", 18)}`)).toBe("dense");
    expect(ctx(tok("caption", 12))).toBe("product");
  });

  it("reads the display size from display, display-lg, then display* or headline*", () => {
    const tok = (name: string, px: number) =>
      `  ${name}:\n    fontFamily: Inter\n    fontSize: ${px}px`;
    const body = tok("body", 18);
    expect(ctx(`${body}\n${tok("display", 64)}\n${tok("display-lg", 10)}`)).toBe("marketing");
    expect(ctx(`${body}\n${tok("display-lg", 64)}`)).toBe("marketing");
    expect(ctx(`${body}\n${tok("display-sm", 64)}`)).toBe("marketing");
    expect(ctx(`${body}\n${tok("headline-md", 64)}`)).toBe("marketing");
    expect(ctx(`${body}\n${tok("h1", 64)}`)).toBe("editorial");
  });

  it("reads the families from the tokens and the mono family from mono or code", () => {
    const result = okOf(
      importDesignMd(
        md(
          front(
            [
              "  display:\n    fontFamily: Young Serif\n    fontSize: 4rem",
              "  body:\n    fontFamily: Onest\n    fontSize: 1rem",
              "  label:\n    fontFamily: Space Grotesk",
              "  code-sm:\n    fontFamily: Fragment Mono\n    fontSize: 14px",
            ].join("\n"),
          ),
        ),
      ),
    );
    expect(result.spec.type.families).toEqual({
      display: "young-serif",
      body: "onest",
      mono: "fragment-mono",
    });
    expect(result.report.inferred.context).toBe("product");
  });

  it("reads rem sizes at 16 px", () => {
    expect(ctx("  body:\n    fontSize: 0.875rem")).toBe("dense");
  });

  it("reads the radius from rounded.lg, else rounded.md", () => {
    const radius = (rounded: string) =>
      okOf(importDesignMd(md(`${PRIMARY}\nrounded:\n${rounded}`))).report.inferred.radius;
    expect(radius("  lg: 0px")).toBe("sharp");
    expect(radius("  lg: 0px\n  md: 24px")).toBe("sharp");
    expect(radius("  md: 0px")).toBe("sharp");
    expect(radius("  lg: 9999px")).not.toBe("sharp");
    expect(okOf(importDesignMd(md(PRIMARY))).report.inferred.radius).toBe("soft");
  });
});

describe("C-DMI-05 the text", () => {
  it("takes the name from the front matter, else the first heading, else a default", () => {
    const name = (text: string) => okOf(importDesignMd(text)).spec.meta.name;
    expect(name(md(`name: Tide\n${PRIMARY}`, "# Heading\n"))).toBe("Tide");
    expect(name(md(PRIMARY, "Intro\n\n# Heading\n\n# Second\n"))).toBe("Heading");
    expect(name(md(PRIMARY))).toBe("Imported design");
    expect(name(md(PRIMARY, "```\n# In a fence\n```\n"))).toBe("Imported design");
  });

  it("takes the one-liner from the description", () => {
    const result = okOf(importDesignMd(md(`description: Tide tables for harbors\n${PRIMARY}`)));
    expect(result.spec.meta.oneLiner).toBe("Tide tables for harbors");
    const long = okOf(importDesignMd(md(`description: ${"word ".repeat(60)}\n${PRIMARY}`)));
    expect(long.spec.meta.oneLiner?.length).toBeLessThanOrEqual(140);
    expect(long.report.truncated).toContain("oneLiner");
  });

  it("takes the thesis from the first paragraph of Overview", () => {
    const body =
      "# T\n\n## Overview\n\nFirst line\nsecond line.\n\nSecond paragraph.\n\n## Colors\n\nNo.\n";
    const result = okOf(importDesignMd(md(PRIMARY, body)));
    expect(result.spec.direction?.thesis).toBe("First line second line.");
    const cut = okOf(importDesignMd(md(PRIMARY, `## Overview\n\n${"word ".repeat(100)}\n`)));
    expect(cut.spec.direction?.thesis?.length).toBeLessThanOrEqual(280);
    expect(cut.report.truncated).toContain("thesis");
    expect(
      okOf(importDesignMd(md(PRIMARY, "## Colors\n\nWords.\n"))).spec.direction,
    ).toBeUndefined();
  });

  it("takes the rules from the bullets under Do's and Don'ts", () => {
    const body = [
      "## Do's and Don'ts",
      "",
      "- Do use the primary for actions",
      "- Don't use it for text",
      "* Do keep copy short",
      "- Note without a prefix",
      "- Dont forget",
      "- Done is not a rule",
      "",
      "## Other",
      "",
      "- Do not read this",
    ].join("\n");
    const result = okOf(importDesignMd(md(PRIMARY, body)));
    expect(result.spec.rules).toEqual({
      do: ["use the primary for actions", "keep copy short"],
      dont: ["use it for text"],
    });
    expect(result.report.truncated).toEqual([]);
  });

  it("keeps the first 20 rules of each kind and lists the field", () => {
    const dos = Array.from({ length: 22 }, (_, i) => `- Do rule number ${i}`);
    const donts = Array.from({ length: 21 }, (_, i) => `- Don't rule number ${i}`);
    const body = ["## Do's and Don'ts", "", ...dos, ...donts].join("\n");
    const result = okOf(importDesignMd(md(PRIMARY, body)));
    expect(result.spec.rules.do).toHaveLength(20);
    expect(result.spec.rules.dont).toHaveLength(20);
    expect(result.spec.rules.do[19]).toBe("rule number 19");
    expect(result.report.truncated).toEqual(expect.arrayContaining(["do", "dont"]));
    const long = okOf(
      importDesignMd(md(PRIMARY, `## Do's and Don'ts\n\n- Do ${"word ".repeat(80)}\n`)),
    );
    expect(long.report.truncated).toContain("do");
  });
});

describe("C-DMI-06 YAML blocks in the body", () => {
  it("adds the groups of a yaml fence", () => {
    const body =
      '## Colors\n\n```yaml\ncolors:\n  primary: "#336699"\n  secondary: "#996633"\n```\n';
    const result = okOf(importDesignMd(md("name: Tide", body)));
    expect(result.report.mapped.map((m) => m.role)).toEqual(["primary", "secondary"]);
  });

  it("reads a document that has only yaml blocks", () => {
    const text = '# Tide\n\n```yaml\ncolors:\n  primary: "#3a6ea5"\n```\n';
    const result = okOf(importDesignMd(text));
    expect(result.report.mapped.map((m) => m.role)).toEqual(["primary"]);
    expect(result.spec.meta.name).toBe("Tide");
  });

  it("ignores a yaml fence inside another fence", () => {
    const outer = `\`\`\`\`markdown\n\`\`\`yaml\ncolors:\n  primary: "#ff0000"\n\`\`\`\n\`\`\`\`\n`;
    expect(errorOf(importDesignMd(outer)).code).toBe("no-primary");
    const tilde = `~~~\n\`\`\`yaml\ncolors:\n  primary: "#ff0000"\n\`\`\`\n~~~\n`;
    expect(errorOf(importDesignMd(tilde)).code).toBe("no-primary");
    const both = md(PRIMARY, outer);
    expect(okOf(importDesignMd(both)).report.mapped.map((m) => m.role)).toEqual(["primary"]);
  });

  it("merges groups from the front matter and a fence", () => {
    const body = "```yaml\nrounded:\n  lg: 0px\n```\n";
    expect(okOf(importDesignMd(md(PRIMARY, body))).report.inferred.radius).toBe("sharp");
  });
});

describe("C-DMI-07 YAML that cannot be read", () => {
  const message = (line: number) =>
    `The YAML on line ${line} could not be read. Check its indentation and quotes, then import again.`;

  it("reports a tab-indented line with its line in the whole file", () => {
    const text = md('colors:\n\tprimary: "#3a6ea5"');
    const error = errorOf(importDesignMd(text));
    expect(error.code).toBe("yaml");
    expect(error.line).toBe(3);
    expect(error.message).toBe(message(3));
  });

  it("reports an unclosed quote", () => {
    const error = errorOf(importDesignMd(md('name: "Tide\ncolors:\n  primary: "#3a6ea5"')));
    expect(error.code).toBe("yaml");
    expect(error.line).toBeGreaterThanOrEqual(2);
  });

  it("reports a repeated key at its line", () => {
    const error = errorOf(
      importDesignMd(md('colors:\n  primary: "#3a6ea5"\n  primary: "#000000"')),
    );
    expect(error.code).toBe("yaml");
    expect(error.line).toBe(4);
  });

  it("counts lines in the whole file for an error in a body block", () => {
    const text = "# T\n\ntext\n\n```yaml\ncolors:\n\tprimary: red\n```\n";
    const error = errorOf(importDesignMd(text));
    expect(error.code).toBe("yaml");
    expect(error.line).toBe(7);
  });

  it("counts the lines of a leading comment", () => {
    const error = errorOf(importDesignMd(`<!-- a\nb -->\n${md("colors:\n\tprimary: red")}`));
    expect(error.line).toBe(5);
  });
});

describe("C-DMI-08 anchors and aliases", () => {
  const message = (line: number) =>
    `The YAML uses an anchor or an alias on line ${line}. Write the values out in full, then import again.`;

  it.each([
    ["an anchor on a map", 'colors: &c\n  primary: "#3a6ea5"', 2],
    ["an anchor on a scalar", 'colors:\n  primary: &p "#3a6ea5"', 3],
    ["an anchor on a key", 'colors:\n  &k primary: "#3a6ea5"', 3],
    ["an anchor on the root", '&root\ncolors:\n  primary: "#3a6ea5"', 2],
    ["an alias", 'colors:\n  primary: &p "#3a6ea5"\n  secondary: *p', 3],
    ["an alias as a value", 'colors:\n  primary: "#3a6ea5"\n  secondary: *p', 4],
    ["an alias as a key", 'colors:\n  primary: "#3a6ea5"\n  *k : 1', 4],
  ])("gives yaml-alias for %s", (_name, front, line) => {
    const error = errorOf(importDesignMd(md(front)));
    expect(error.code).toBe("yaml-alias");
    expect(error.line).toBe(line);
    expect(error.message).toBe(message(line));
  });

  it("reads a << key as a plain key and ignores it", () => {
    const result = okOf(importDesignMd(md(`${PRIMARY}\n  "<<": "#112233"`)));
    expect(result.report.ignored).toContain("<<");
  });
});

describe("C-DMI-09 a group twice and too much YAML", () => {
  it("gives yaml-group-twice for colors in the front matter and a yaml block", () => {
    const text = md(PRIMARY, '```yaml\ncolors:\n  secondary: "#336699"\n```\n');
    const error = errorOf(importDesignMd(text));
    expect(error.code).toBe("yaml-group-twice");
    expect(error.message).toBe(
      "The YAML defines colors twice. Keep one definition, then import again.",
    );
  });

  it("gives yaml-too-large for 65,537 bytes of YAML and reads 65,536", () => {
    const base = 'colors:\n  primary: "#3a6ea5"\n';
    const yaml = (bytes: number) => `${base}# ${"a".repeat(bytes - base.length - 2)}`;
    const exact = md(yaml(65_536));
    expect(new TextEncoder().encode(yaml(65_536)).length).toBe(65_536);
    expect(okOf(importDesignMd(exact)).report.mapped).toHaveLength(1);
    const error = errorOf(importDesignMd(md(yaml(65_537))));
    expect(error.code).toBe("yaml-too-large");
    expect(error.message).toBe(
      "The YAML holds more than 64 KB. Keep the tokens under 64 KB, then import again.",
    );
  });

  it("counts the YAML of every block together", () => {
    const half = `# ${"a".repeat(33_000)}`;
    const text = `---\n${half}\ncolors:\n  primary: red\n---\n\`\`\`yaml\n${half}\nrounded: {}\n\`\`\`\n`;
    expect(errorOf(importDesignMd(text)).code).toBe("yaml-too-large");
  });
});

describe("C-DMI-10 exact re-import", () => {
  it("returns the golden spec for each of the 14 presets", () => {
    const presets = GOLDENS.filter((g) => g.id !== "imported-shadcn");
    expect(presets).toHaveLength(14);
    for (const { id, spec } of presets) {
      const result = okOf(importDesignMd(designMd(spec, ORIGIN)));
      expect(result.report.exact, id).toBe(true);
      expect(result.report.format).toBe("design-md");
      expect(result.report.notes, id).toEqual([]);
      expect(result.spec, id).toEqual(normalizeSpec(spec));
    }
  });
});

describe("C-DMI-11 an edited file", () => {
  const spec = (GOLDENS[3] as (typeof GOLDENS)[number]).spec;
  const text = designMd(spec, ORIGIN);
  const was = spec.color.roles.light.primary;

  it("takes the token path and names the reason", () => {
    const edited = text.replace(`  primary: "${was}"`, '  primary: "#aa3355"');
    expect(edited).not.toBe(text);
    const result = okOf(importDesignMd(edited));
    expect(result.report.exact).toBe(false);
    expect(result.report.notes).toContain("The edit link was ignored because the tokens changed.");
    expect(hexNear(result.spec.color.roles.light.primary, "#aa3355", 1)).toBe(true);
  });

  it("takes the token path with a note when the link cannot be read", () => {
    const edited = text.replace(/studio#s=[A-Za-z0-9_-]+/g, "studio#s=AAAA");
    const result = okOf(importDesignMd(edited));
    expect(result.report.exact).toBe(false);
    expect(result.report.notes).toContain("The edit link could not be read.");
    expect(result.report.notes).not.toContain(
      "The edit link was ignored because the tokens changed.",
    );
  });

  it("reads an angle-bracket autolink", () => {
    const link = /https:\/\/[^\s*]+\/studio#s=[A-Za-z0-9_-]+/.exec(text)?.[0] as string;
    const bare = text.split(link).join(`<${link}>`);
    expect(okOf(importDesignMd(bare)).report.exact).toBe(true);
  });

  it("has no link note when the file has no link, and reads its prose (R3-30)", () => {
    const stripped = text.replace(/studio#s=[A-Za-z0-9_-]+/g, "studio");
    const result = okOf(importDesignMd(stripped));
    expect(result.report.exact).toBe(false);
    expect(result.report.notes).toEqual([]);
    // With no link to decode, the Do's and Don'ts bullets are the rules, as for any foreign file.
    expect(result.spec.rules.do).toContain("pair every fill with its foreground role.");
  });

  // A design with every text field set, in words that mdText escapes (R3-32).
  const TEXTED: DesignSpec = generateSystem(
    resolveParams(
      {
        ...paramsOfSpec(spec).params,
        oneLiner: "Reads the *tide* at_dawn, #1 [draft]",
        direction: {
          thesis: "Calm surfaces; one *bold* accent_x.",
          adjectives: ["calm", "salt-worn"],
          like: ["harbor charts"],
          unlike: ["neon <glow>"],
        },
        rules: {
          do: ["use *bold* sparingly_x", "keep `code` in mono"],
          dont: ["stack [two] shadows"],
        },
      },
      spec.meta.seed,
    ),
    spec.meta.seed,
  );
  const withPrimary = (file: string, from: DesignSpec, hex: string): string => {
    const line = `  primary: "${from.color.roles.light.primary}"`;
    expect(file).toContain(line);
    return file.replace(line, `  primary: "${hex}"`);
  };

  it("takes the decoded spec's name, one line, direction and rules, never dyelot's prose", () => {
    const result = okOf(importDesignMd(withPrimary(designMd(TEXTED, ORIGIN), TEXTED, "#aa3355")));
    expect(result.report.exact).toBe(false);
    expect(result.report.notes).toContain("The edit link was ignored because the tokens changed.");
    expect(hexNear(result.spec.color.roles.light.primary, "#aa3355", 1)).toBe(true);
    expect(result.spec.meta.name).toBe(TEXTED.meta.name);
    expect(result.spec.meta.oneLiner).toBe(TEXTED.meta.oneLiner);
    expect(result.spec.direction).toEqual(TEXTED.direction);
    expect(result.spec.rules).toEqual(TEXTED.rules);
    expect(result.report.truncated).toEqual([]);
    // A design with no text gets none: not the describeDesign sentence, nor the fixed bullets.
    const plain = okOf(importDesignMd(withPrimary(text, spec, "#aa3355")));
    expect(plain.report.exact).toBe(false);
    expect(plain.spec.meta.name).toBe(spec.meta.name);
    expect(plain.spec.meta.oneLiner).toBeUndefined();
    expect(plain.spec.direction).toBeUndefined();
    expect(plain.spec.rules).toEqual({ do: [], dont: [] });
    expect(plain.report.truncated).toEqual([]);
  });

  it("takes an edited front matter name, and the decoded spec's name when it is not plain text", () => {
    const file = withPrimary(designMd(TEXTED, ORIGIN), TEXTED, "#aa3355");
    const nameLine = `name: "${TEXTED.meta.name}"`;
    expect(file).toContain(nameLine);
    const renamed = okOf(importDesignMd(file.replace(nameLine, 'name: "Harbor *Lights* #2"')));
    expect(renamed.report.exact).toBe(false);
    expect(renamed.spec.meta.name).toBe("Harbor *Lights* #2");
    expect(renamed.spec.meta.oneLiner).toBe(TEXTED.meta.oneLiner);
    expect(renamed.spec.direction).toEqual(TEXTED.direction);
    expect(renamed.spec.rules).toEqual(TEXTED.rules);
    expect(renamed.report.truncated).toEqual([]);
    // A name that is not valid plain text, or is too long, or is gone, falls back to the decoded one.
    for (const line of ['name: " padded"', `name: "${"n".repeat(81)}"`, "name: 5", ""]) {
      const fallback = okOf(importDesignMd(file.replace(nameLine, line)));
      expect(fallback.spec.meta.name, line).toBe(TEXTED.meta.name);
      expect(fallback.report.truncated, line).toEqual([]);
    }
  });

  it("neither grows the rules nor adds backslashes over two export and import rounds", () => {
    let current = TEXTED;
    for (const hex of ["#aa3355", "#335599"]) {
      const next = okOf(importDesignMd(withPrimary(designMd(current, ORIGIN), current, hex)));
      expect(next.report.exact).toBe(false);
      expect(next.spec.meta.oneLiner).toBe(TEXTED.meta.oneLiner);
      expect(next.spec.direction).toEqual(TEXTED.direction);
      expect(next.spec.rules).toEqual(TEXTED.rules);
      current = next.spec;
    }
    const words = JSON.stringify([current.meta.oneLiner, current.direction, current.rules]);
    expect(words).not.toContain("\\\\");
  });
});

describe("C-DMI-12 a file without a primary", () => {
  it("gives no-primary without front matter and without a yaml block", () => {
    const error = errorOf(importDesignMd("# Tide\n\nJust words.\n"));
    expect(error.code).toBe("no-primary");
    expect(error.message).toBe(
      "No primary color was found. Add a primary color, then import again.",
    );
  });

  it("gives no-primary when no color maps to primary", () => {
    expect(errorOf(importDesignMd(md('colors:\n  secondary: "#336699"'))).code).toBe("no-primary");
    expect(errorOf(importDesignMd(md("colors:\n  primary: nope"))).code).toBe("no-primary");
    expect(errorOf(importDesignMd(md("name: x"))).code).toBe("no-primary");
    expect(errorOf(importDesignMd(md("- a\n- b"))).code).toBe("no-primary");
    expect(errorOf(importDesignMd(md("colors: [1, 2]"))).code).toBe("no-primary");
  });

  it("generates every other role from a front matter with only colors.primary", () => {
    const result = okOf(importDesignMd(md(PRIMARY)));
    expect(result.report.generated).toEqual({ light: 45, dark: 46, darkGenerated: true });
    expect(hexNear(result.spec.color.roles.light.primary, "#3a6ea5", 1)).toBe(true);
    const base = generateSystem(resolveParams({ ...DEFAULT_PARAMS }, "seed-1"), "seed-1");
    expect(Object.keys(result.spec.color.roles.light)).toHaveLength(
      Object.keys(base.color.roles.light).length,
    );
  });
});
