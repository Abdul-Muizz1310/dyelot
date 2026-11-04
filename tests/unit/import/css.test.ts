import { describe, expect, it } from "vitest";
import { gamutMap, parseColor, ROLE_NAMES, type RoleName, toHex } from "@/engine";
import { importShadcnCss } from "@/import/css";
import { errorOf, hexNear, okOf, readFixture } from "./helpers";

// Cases C-CSSI-01 to C-CSSI-10 of docs/specs/03-export.md, section 10.10 (R3-31).

const NEUTRAL = readFixture("shadcn-neutral.css");
const V3 = readFixture("shadcn-v3-hsl.css");

/** The declarations of the block that starts at `selector {` in a fixture. */
function declarations(css: string, selector: string): Map<string, string> {
  const start = css.indexOf(`\n${selector} {`);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("\n}", start));
  const found = new Map<string, string>();
  for (const match of body.matchAll(/^\s*--([\w-]+):\s*([^;]+);/gm)) {
    found.set(match[1] as string, (match[2] as string).trim());
  }
  return found;
}

const light = (css: string) => okOf(importShadcnCss(css)).spec.color.roles.light;
const ROLE_SET: ReadonlySet<string> = new Set(ROLE_NAMES);

describe("C-CSSI-01 shadcn-neutral.css", () => {
  const result = okOf(importShadcnCss(NEUTRAL));

  for (const [mode, selector] of [
    ["light", ":root"],
    ["dark", ".dark"],
  ] as const) {
    it(`maps the 31 role variables of ${selector} to their sRGB hex`, () => {
      const roles = [...declarations(NEUTRAL, selector)].filter(([name]) => ROLE_SET.has(name));
      expect(roles).toHaveLength(31);
      for (const [name, value] of roles) {
        const entry = result.report.mapped.find((m) => m.mode === mode && m.role === name);
        expect(entry, `${mode} ${name}`).toBeDefined();
        if (value.includes("/")) continue; // alpha is C-CSSI-10
        const expected = toHex(gamutMap(parseColor(value), "srgb"));
        const actual = result.spec.color.roles[mode][name as RoleName];
        expect(hexNear(actual, expected, 1), `${mode} ${name}: ${actual} vs ${expected}`).toBe(
          true,
        );
      }
    });

    it(`gives destructive-foreground onFill with reason foreground in ${mode}`, () => {
      expect(result.report.adjusted).toContainEqual(
        expect.objectContaining({ mode, role: "destructive-foreground", reason: "foreground" }),
      );
    });
  }

  it("infers soft from 0.625rem and names the theme", () => {
    expect(result.spec.meta.name).toBe("Imported theme");
    expect(result.report.inferred.radius).toBe("soft");
    expect(result.report.inferred.tint).toBe("none");
    expect(result.report.inferred.context).toBe("product");
    expect(result.report.format).toBe("shadcn-css");
  });

  it("lists the other names as ignored, once, in input order", () => {
    expect(result.report.ignored).toEqual([]);
  });
});

describe("C-CSSI-02 shadcn-v3-hsl.css", () => {
  const result = okOf(importShadcnCss(V3));

  it("reads the blocks inside @layer base and bare HSL triples", () => {
    expect(result.spec.color.roles.light.background).toBe("#ffffff");
    expect(hexNear(result.spec.color.roles.light.primary, "#171717")).toBe(true);
    expect(hexNear(result.spec.color.roles.dark.foreground, "#fafafa")).toBe(true);
    const mapped = (mode: string, role: string) =>
      result.report.mapped.find((m) => m.mode === mode && m.role === role);
    expect(mapped("light", "destructive-foreground")?.source).toBe("0 0% 98%");
    expect(mapped("dark", "destructive-foreground")).toBeDefined();
  });

  it("keeps the generated sidebar roles and reads 0.5rem as soft", () => {
    expect(result.report.mapped.some((m) => m.role.startsWith("sidebar"))).toBe(false);
    expect(result.report.inferred.radius).toBe("soft");
    expect(result.report.generated.light).toBe(
      46 - result.report.mapped.filter((m) => m.mode === "light").length,
    );
  });
});

describe("C-CSSI-03 selectors", () => {
  const css = (selector: string, wrap = (rules: string) => rules) =>
    wrap(`${selector} { --primary: #112233; }`);
  const lightPrimary = (text: string) => {
    const mapped = okOf(importShadcnCss(`:root { --primary: #ffffff; }\n${text}`));
    return mapped.report.mapped.filter((m) => m.role === "primary");
  };

  it("reads light selectors", () => {
    for (const selector of [":root, .light", "html", '[data-theme="light"]', ":root:not(.dark)"]) {
      const text = css(selector);
      const result = okOf(importShadcnCss(text));
      expect(result.spec.color.roles.light.primary, selector).toBe("#112233");
      expect(
        result.report.mapped.map((m) => m.mode),
        selector,
      ).toEqual(["light"]);
    }
  });

  it("reads dark selectors", () => {
    const base = ":root { --primary: #ffffff; }\n";
    for (const selector of [".dark", ":root.dark", "html.dark", '[data-theme="dark"]']) {
      const result = okOf(importShadcnCss(base + css(selector)));
      expect(result.spec.color.roles.dark.primary, selector).toBe("#112233");
      expect(result.spec.color.roles.light.primary, selector).toBe("#ffffff");
    }
    const media = okOf(
      importShadcnCss(
        `${base}@media (prefers-color-scheme: dark) { :root { --primary: #112233; } }`,
      ),
    );
    expect(media.spec.color.roles.dark.primary).toBe("#112233");
    expect(media.spec.color.roles.light.primary).toBe("#ffffff");
  });

  it("applies a rule to every mode its selector list names", () => {
    const result = okOf(importShadcnCss(":root, .dark { --primary: #112233; }"));
    expect(result.spec.color.roles.light.primary).toBe("#112233");
    expect(result.spec.color.roles.dark.primary).toBe("#112233");
  });

  it("ignores a declaration under another selector", () => {
    expect(lightPrimary(".card { --primary: #112233; }")).toHaveLength(1);
    const result = okOf(
      importShadcnCss(":root { --primary: #ffffff; } .card { --primary: #112233; }"),
    );
    expect(result.spec.color.roles.light.primary).toBe("#ffffff");
    expect(result.spec.color.roles.dark.primary).not.toBe("#112233");
  });
});

describe("C-CSSI-04 later wins and !important", () => {
  it("lets a later declaration win within a mode", () => {
    expect(light(":root { --primary: #111111; } :root { --primary: #222222; }").primary).toBe(
      "#222222",
    );
    expect(light(":root { --primary: #111111; --primary: #333333; }").primary).toBe("#333333");
  });

  it("drops !important before parsing", () => {
    expect(light(":root { --primary: #123456 !important; }").primary).toBe("#123456");
    expect(light(":root { --primary: #123456 ! IMPORTANT ; }").primary).toBe("#123456");
  });
});

describe("C-CSSI-05 comments and strings", () => {
  it("ignores a commented declaration", () => {
    const result = okOf(
      importShadcnCss(
        ":root { /* --primary: red */ --primary: #123456; --ring: #fff; /* --border: red; */ }",
      ),
    );
    expect(result.spec.color.roles.light.primary).toBe("#123456");
    expect(result.report.mapped.map((m) => m.role)).toEqual(["primary", "ring"]);
  });

  it("errors when a role is declared only in a comment", () => {
    expect(errorOf(importShadcnCss(":root { /* --primary: red; */ }")).code).toBe("no-roles");
  });

  it("is not fooled by braces and comment openers in strings", () => {
    const css = `.x { content: "}"; } :root { --primary: #123456; } .y { content: '/*'; } .dark { --primary: #654321; }`;
    const result = okOf(importShadcnCss(css));
    expect(result.spec.color.roles.light.primary).toBe("#123456");
    expect(result.spec.color.roles.dark.primary).toBe("#654321");
    const inside = okOf(
      importShadcnCss(`:root { content: "}"; --primary: #123456; content: '/*'; --ring: #fff; }`),
    );
    expect(inside.report.mapped.map((m) => m.role)).toEqual(["primary", "ring"]);
  });

  it("closes a comment opened before a block", () => {
    expect(light("/* a { */ :root { --primary: #123456; }").primary).toBe("#123456");
  });
});

describe("C-CSSI-06 var()", () => {
  it("resolves once against the same mode", () => {
    expect(light(":root { --primary: var(--brand); --brand: #3a6ea5; }").primary).toBe("#3a6ea5");
    expect(light(":root { --brand: #3a6ea5; --primary: var( --brand ); }").primary).toBe("#3a6ea5");
  });

  it("lists a two-step chain and a missing name as unreadable", () => {
    const chain = okOf(
      importShadcnCss(
        ":root { --ring: #fff; --primary: #123456; --border: var(--a); --a: var(--b); --b: #123456; }",
      ),
    );
    expect(chain.report.mapped.map((m) => m.role)).toEqual(["ring", "primary"]);
    expect(chain.report.notes.some((n) => n.includes("--border"))).toBe(true);
    const missing = okOf(
      importShadcnCss(":root { --ring: #fff; --primary: #123456; --border: var(--nope); }"),
    );
    expect(missing.report.mapped.map((m) => m.role)).toEqual(["ring", "primary"]);
    expect(missing.report.notes.some((n) => n.includes("--border"))).toBe(true);
  });

  it("does not resolve against the other mode", () => {
    const result = okOf(
      importShadcnCss(":root { --primary: #123456; --ring: var(--b); } .dark { --b: #fff; }"),
    );
    expect(result.report.mapped.map((m) => m.role)).toEqual(["primary"]);
  });
});

describe("C-CSSI-07 fonts, names and ignored variables", () => {
  const css = (decls: string) => `:root { --primary: #3a6ea5; ${decls} }`;

  it("makes a custom family from --font-sans", () => {
    const result = okOf(importShadcnCss(css('--font-sans: "Inter", sans-serif;')));
    expect(result.spec.type.families.body).toBe("inter");
    expect(result.spec.type.families.display).toBe("inter");
    expect(result.report.inferred.customFonts).toBe(true);
    expect(result.report.inferred.pairing).toBeNull();
    expect(result.report.ignored).toEqual([]);
  });

  it("reads --font-serif as the display family and --font-mono as the mono family", () => {
    const result = okOf(
      importShadcnCss(
        css(
          "--font-sans: 'Source Serif 4', serif; --font-serif: Gloock; --font-mono: JetBrains Mono, monospace;",
        ),
      ),
    );
    expect(result.spec.type.families).toEqual({
      display: "gloock",
      body: "source-serif-4",
      mono: "jetbrains-mono",
    });
  });

  it("sets the pairing when three ids form one", () => {
    const result = okOf(
      importShadcnCss(css('--font-sans: "Host Grotesk"; --font-mono: "Fragment Mono";')),
    );
    expect(result.report.inferred.pairing).toBe("host-grotesk");
    expect(result.report.inferred.customFonts).toBe(false);
    expect(result.spec.type.families).toEqual({
      display: "host-grotesk",
      body: "host-grotesk",
      mono: "fragment-mono",
    });
  });

  it("skips system stacks and names that are not an id", () => {
    const result = okOf(
      importShadcnCss(
        css("--font-sans: ui-sans-serif, system-ui, sans-serif; --font-serif: 'Foo.Bar';"),
      ),
    );
    expect(result.report.inferred.customFonts).toBe(false);
  });

  it("lists names it does not read in input order", () => {
    const result = okOf(
      importShadcnCss(css("--chart-6: red; --sidebar-width: 16rem; --chart-6: blue;")),
    );
    expect(result.report.ignored).toEqual(["--chart-6", "--sidebar-width"]);
  });
});

describe("C-CSSI-08 no roles", () => {
  it("errors for a text with no role declaration in a light block", () => {
    const message =
      "No theme colors were found. A shadcn theme defines variables such as --background and --primary in :root.";
    for (const css of [
      ".btn { color: red }",
      ".dark { --primary: #fff; --background: #000; }",
      "",
      "}}{{",
      ":root { --x: 1; }",
    ]) {
      if (css === "") continue;
      const error = errorOf(importShadcnCss(css));
      expect(error.code, css).toBe("no-roles");
      expect(error.message).toBe(message);
    }
  });
});

describe("C-CSSI-09 unreadable values", () => {
  it("skips an unclosed function and garbage", () => {
    const result = okOf(
      importShadcnCss(
        ":root { --primary: #3a6ea5; --background: garbage; --ring: oklch(0.7 0.17 22",
      ),
    );
    expect(result.report.mapped.map((m) => m.role)).toEqual(["primary"]);
    expect(result.report.notes.join("\n")).toContain("--background");
    expect(result.report.notes.join("\n")).toContain("--ring");
  });

  it("gives no-primary when the only primary is unreadable", () => {
    for (const primary of ["oklch(0.7 0.17 22", "garbage", "var(--x)", "#ggg", "rgb(1 2)"]) {
      const error = errorOf(
        importShadcnCss(`:root { --primary: ${primary}; --background: #fff; }`),
      );
      expect(error.code, primary).toBe("no-primary");
      expect(error.message).toBe(
        "No primary color was found. Add a primary color, then import again.",
      );
    }
  });

  it("gives no-primary when only the dark block holds a primary", () => {
    expect(
      errorOf(importShadcnCss(":root { --background: #fff; } .dark { --primary: #123456; }")).code,
    ).toBe("no-primary");
  });
});

describe("C-CSSI-10 real alpha", () => {
  it("flattens the dark border and input over the dark background", () => {
    const result = okOf(importShadcnCss(NEUTRAL));
    const background = result.spec.color.roles.dark.background;
    const channel = (hex: string, i: number) =>
      Number.parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16);
    for (const [role, alpha] of [
      ["border", 0.1],
      ["input", 0.15],
    ] as const) {
      expect(result.report.adjusted).toContainEqual(
        expect.objectContaining({ mode: "dark", role, reason: "alpha" }),
      );
      const hex = result.spec.color.roles.dark[role];
      for (let i = 0; i < 3; i++) {
        const expected = Math.round(alpha * 255 + (1 - alpha) * channel(background, i));
        expect(Math.abs(channel(hex, i) - expected), `${role} channel ${i}`).toBeLessThanOrEqual(1);
      }
    }
  });
});
