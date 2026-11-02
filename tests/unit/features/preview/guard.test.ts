import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generateSystem, ROLE_NAMES } from "@/engine";
import { freshParams, resolveParams } from "@/features/studio/params";
import { densityVars, themeVars } from "@/theme/vars";
import { deriveTailwind } from "../../engine/lint/tailwind-source";
import {
  bridgeVariables,
  findViolations,
  houseColors,
  madderFiles,
  previewFiles,
} from "./guard-rules";

// The preview source guard of docs/specs/02-studio.md, section 6.10: C-GUARD-01 to C-GUARD-06. The
// canvas is styled only by the spec's custom properties (I-M2-04), so no file under
// src/features/preview names a color of its own.

const ROOT = path.resolve(import.meta.dirname, "../../../..");
const PREVIEW = path.join(ROOT, "src/features/preview");

const PALETTE = "palette class";
const WHITE_BLACK = "white or black utility";
const HOUSE = "house color utility";
const ARBITRARY = "named color in an arbitrary value";
const DARK = "dark variant";
const HEX = "hex literal";
const FUNCTION = "color function";
const MIX = "color-mix over";
const NAMED = "named color";
const OUTSIDE = "variable outside the bridge";

describe("C-GUARD-01 findViolations flags every color that is not a spec variable", () => {
  it.each([
    ["bg-indigo-500", PALETTE],
    ["bg-mauve-500", PALETTE],
    ["text-slate-700", PALETTE],
    ["border-red-200", PALETTE],
    ["ring-blue-500/50", PALETTE],
    ["dark:bg-black", DARK],
    ["bg-white", WHITE_BLACK],
    ["bg-[#fff]", HEX],
    ["color: #fff", HEX],
    ["fill: rgb(0 0 0 / 0.1)", FUNCTION],
    ["stroke: oklch(0.6 0.1 20)", FUNCTION],
    ["color: rebeccapurple", NAMED],
    ["color-mix(in oklab, #fff 20%, transparent)", MIX],
    ['style={{ color: "red" }}', NAMED],
    ["[data-canvas] { --kit-scrim: white; }", NAMED],
    ['style={{ "--kit-value": "red" }}', NAMED],
    ["color: var(--primary, red);", NAMED],
    ["background-color: Canvas;", NAMED],
    ["color: CanvasText;", NAMED],
    ["border: 1px solid ButtonBorder;", NAMED],
    ["color: AccentColor;", NAMED],
    ["-webkit-text-fill-color: white;", NAMED],
    ["-webkit-tap-highlight-color: red;", NAMED],
    ["color: var(--panel)", OUTSIDE],
    ["background: var(--page)", OUTSIDE],
    ["bg-(--panel)", OUTSIDE],
    ["text-[var(--fg-muted)]", OUTSIDE],
    // Only roleVar's own checked body is allowed, not any function that borrows its name.
    ['function roleVar(role: string): string {\n  return "var(--panel)";\n}\n', OUTSIDE],
    // biome-ignore lint/suspicious/noTemplateCurlyInString: a source sample, not a template
    ["function roleVar(role: string): string {\n  return `var(--${role})`;\n}\n", OUTSIDE],
  ])("flags %s as a %s", (source, rule) => {
    expect(findViolations(source)).toContainEqual(expect.stringContaining(rule));
  });

  it.each([
    ['className="hover:text-white"', WHITE_BLACK],
    ["background: hsl(20 50% 50%)", FUNCTION],
    ["outline-color: lab(50 20 20)", FUNCTION],
    ["fill: color(display-p3 1 0 0)", FUNCTION],
    ["background: color-mix(in srgb, red 20%, transparent)", MIX],
    ["background: color-mix(in oklab, currentColor 20%, transparent)", MIX],
    ["background: color-mix(in oklab, var(--primary, #fff) 20%, transparent)", MIX],
    ['fill="black"', NAMED],
    ["text-[navy]", ARBITRARY],
    ["bg-panel", HOUSE],
    ["text-fg-muted", HOUSE],
    ["border-control-edge", HOUSE],
    ["bg-accent-madder", HOUSE],
    ["border-border-bright", HOUSE],
    ["shadow-[0_0_0_1px_#000]", HEX],
    ["from-emerald-400 to-sky-500", PALETTE],
    ["color: var(--accent-madder)", OUTSIDE],
    ["box-shadow: 0 0 0 1px var(--border-bright)", OUTSIDE],
    // biome-ignore lint/suspicious/noTemplateCurlyInString: a source sample, not a template
    ["`var(--chrome-${name})`", OUTSIDE],
    // A template's fixed prefix must end in "-": an empty or open prefix names anything.
    // biome-ignore lint/suspicious/noTemplateCurlyInString: a source sample, not a template
    ["`var(--${role})`", OUTSIDE],
    // biome-ignore lint/suspicious/noTemplateCurlyInString: a source sample, not a template
    ["`var(--p${x})`", OUTSIDE],
    ["text-(color:--panel)", OUTSIDE],
    ["bg-(color:--fg-muted)", OUTSIDE],
    ["color: VAR(--panel)", OUTSIDE],
  ])("also flags %s as a %s", (source, rule) => {
    expect(findViolations(source)).toContainEqual(expect.stringContaining(rule));
  });

  it("names what it flags, once per hit", () => {
    expect(findViolations('className="bg-indigo-500 text-slate-700"')).toHaveLength(2);
    expect(findViolations("color: #fff").join(" ")).toContain("#fff");
  });

  it("takes its palette names from the same derivation as T3's table (R2-09)", () => {
    const { palettes } = deriveTailwind();
    expect(palettes).toHaveLength(26);
    for (const palette of palettes) {
      expect(findViolations(`bg-${palette}-500`), palette).toContainEqual(
        expect.stringContaining(PALETTE),
      );
    }
  });
});

describe("C-GUARD-02 findViolations passes the spec's variables and the color keywords", () => {
  it.each([
    "bg-(--primary)",
    "text-[var(--foreground)]",
    'fill="currentColor"',
    "background: transparent",
    "color-mix(in oklab, var(--primary) 20%, transparent)",
    "border-border",
    "text-foreground",
    "color: inherit",
    "outline: 2px solid var(--ring)",
    'style={{ backgroundColor: "var(--card)", boxShadow: "var(--shadow-2)" }}',
    'stroke="currentColor" fill="none"',
    "color-mix(in oklch, var(--muted) 60%, var(--background))",
    'href="#canvas"',
    "data-mode={mode} roles.dark",
    "const view = { light: 1, dark: 2 };",
    "text-sm text-center border-2 shadow-none ring-2 fill-none",
    "[data-canvas] { --kit-fill: var(--primary); }",
    "height: var(--control-height); padding-inline: calc(var(--space-4) + var(--density-offset));",
    "background-color: var(--kit-scrim);",
    // biome-ignore lint/suspicious/noTemplateCurlyInString: a source sample, not a template
    'style={{ "--kit-value": `${value}%` }}',
    // biome-ignore lint/suspicious/noTemplateCurlyInString: a source sample, not a template
    "`var(--text-${step})`",
    "font-family: var(--font-display); stroke-width: var(--icon-stroke);",
    "text-(color:--primary)",
    "style={{ backgroundColor: roleVar(fill), color: roleVar(ink) }}",
    // roleVar is the one place a role's variable is built from a name; it checks the name (R-05).
    // biome-ignore lint/suspicious/noTemplateCurlyInString: a source sample, not a template
    'export function roleVar(role: RoleName): string {\n  assertOneOf(role, ROLE_NAMES, "roleVar: role");\n  return `var(--${role})`;\n}\n',
  ])("passes %s", (source) => {
    expect(findViolations(source)).toEqual([]);
  });

  it("allows a theme color utility only for a role the Tailwind theme maps to its variable", () => {
    const theme = houseColors();
    expect(theme.get("border")).toBe("var(--border)");
    expect(theme.get("foreground")).toBe("var(--foreground)");
    expect([...theme.keys()]).toEqual(
      expect.arrayContaining(["panel", "fg-muted", "control-edge", "accent-madder"]),
    );
  });

  it("derives the variables it allows from themeVars and densityVars, not from a typed list", () => {
    const spec = generateSystem(resolveParams(freshParams(), "seed-1"), "seed-1");
    const written = [
      ...Object.keys(themeVars(spec, "light")),
      ...Object.keys(densityVars("dense")),
    ];
    expect([...bridgeVariables()].sort()).toEqual(written.sort());
    expect(written).toHaveLength(206);
  });
});

describe("C-GUARD-03 and C-GUARD-04 the preview folder", () => {
  it("C-GUARD-04 scans every .css, .ts and .tsx file, kit/ and templates/ included", () => {
    const files = previewFiles(PREVIEW).map((file) => path.relative(PREVIEW, file));
    expect(files.length).toBeGreaterThan(0);
    expect(files.every((file) => /\.(css|ts|tsx)$/.test(file))).toBe(true);
    expect(files.some((file) => file.startsWith(`kit${path.sep}`))).toBe(true);
    expect(files.some((file) => file.startsWith(`templates${path.sep}`))).toBe(true);
    expect(files.some((file) => file.endsWith(".css"))).toBe(true);
    expect(files.some((file) => file.endsWith(".tsx"))).toBe(true);
  });

  it("C-GUARD-04 fails when the folder is empty or unreadable", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "dyelot-preview-"));
    try {
      expect(() => previewFiles(dir)).toThrow(/no \.css, \.ts or \.tsx file/);
      expect(() => previewFiles(path.join(dir, "missing"))).toThrow();
      mkdirSync(path.join(dir, "kit"));
      writeFileSync(path.join(dir, "kit", "a.tsx"), "export {};\n");
      writeFileSync(path.join(dir, "notes.md"), "#fff\n");
      expect(previewFiles(dir).map((file) => path.relative(dir, file))).toEqual([
        path.join("kit", "a.tsx"),
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("C-GUARD-03 finds no violation in any file under src/features/preview", () => {
    const offenders = previewFiles(PREVIEW)
      .map((file) => ({
        file: path.relative(ROOT, file),
        hits: findViolations(readFileSync(file, "utf8")),
      }))
      .filter(({ hits }) => hits.length > 0);
    expect(offenders).toEqual([]);
  });
});

describe("C-GUARD-05 madder stays on the focus ring, the active state and the primary action", () => {
  it("lists the chrome files that name madder: the focus ring, the primary action and the show me outline", () => {
    expect(madderFiles(ROOT)).toEqual([
      "src/app/globals.css",
      "src/features/studio/chrome.ts",
      "src/features/studio/highlight.css",
    ]);
  });

  it("finds madder in chrome.ts only in the primary action's styles", () => {
    const source = readFileSync(path.join(ROOT, "src/features/studio/chrome.ts"), "utf8");
    const declarations = source.split(/\n(?=export const )/);
    const naming = declarations.filter((block) => /accent-madder|f66c6d/i.test(block));
    expect(naming).toHaveLength(1);
    expect(naming[0]).toMatch(/^export const PRIMARY_BUTTON =/);
  });

  it("keeps the madder focus ring in globals.css outside the canvas", () => {
    const css = readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8");
    expect(css).toMatch(/:focus-visible\s*\{\s*outline:\s*2px solid var\(--accent-madder\)/);
  });
});

describe("C-GUARD-06 highlight.css draws the show me outline on the named parts only", () => {
  const css = () =>
    readFileSync(path.join(ROOT, "src/features/studio/highlight.css"), "utf8").replace(
      /\/\*[\s\S]*?\*\//g,
      "",
    );
  /** Each rule of the file: its selectors and its declarations, whitespace collapsed. */
  const rules = () =>
    [...css().matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selectors = "", body = ""]) => ({
      selectors: selectors
        .split(",")
        .map((selector) => selector.trim().replace(/\s+/g, " "))
        .filter(Boolean),
      declarations: body
        .split(";")
        .map((declaration) => declaration.trim().replace(/\s+/g, " "))
        .filter(Boolean),
    }));

  it("holds one rule: the dashed madder outline with its offset, each declaration important", () => {
    const found = rules();
    expect(found).toHaveLength(1);
    expect(found[0]?.declarations).toEqual([
      "outline: 2px dashed var(--accent-madder) !important",
      "outline-offset: 2px !important",
    ]);
  });

  it("selects each of the 46 roles, font-display and font-body once, and the highlighted cells", () => {
    const selectors = rules()[0]?.selectors ?? [];
    const canvas = selectors.filter((selector) => selector !== "[data-show-me-cell]");
    expect(selectors).toContain("[data-show-me-cell]");
    const tokens = canvas.map((selector) => {
      const match =
        /^\[data-show-me~="([a-z0-9-]+)"\] \[data-canvas\] \[data-roles~="([a-z0-9-]+)"\]$/.exec(
          selector,
        );
      expect(match, selector).not.toBeNull();
      expect(match?.[1], selector).toBe(match?.[2]);
      return match?.[1] ?? "";
    });
    expect(tokens).toHaveLength(48);
    expect(new Set(tokens)).toEqual(new Set([...ROLE_NAMES, "font-display", "font-body"]));
  });

  it("keeps data-show-me out of the preview folder: the canvas never draws the outline itself", () => {
    const naming = previewFiles(PREVIEW).filter((file) =>
      readFileSync(file, "utf8").includes("data-show-me"),
    );
    expect(naming).toEqual([]);
  });
});

describe("F-TPL-38 the type steps come only from their .kit-t-<step> classes", () => {
  it("sets --text-<step> in no CSS rule but its step's class, and no style object sets fontSize", () => {
    const offenders: string[] = [];
    for (const file of previewFiles(PREVIEW)) {
      const source = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      const name = path.relative(ROOT, file);
      if (file.endsWith(".css")) {
        for (const match of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
          const [, selector = "", body = ""] = match;
          const sets = [...body.matchAll(/font-size:\s*var\(--text-([a-z0-9-]+)\)/g)];
          for (const [, step] of sets) {
            // The canvas root keeps the body triple; every other text takes its step's class.
            const allowed = [`.kit-t-${step}`, ...(step === "body" ? ["[data-canvas]"] : [])];
            if (!allowed.includes(selector.trim())) offenders.push(`${name}: ${selector.trim()}`);
          }
        }
      } else if (/\bfontSize\s*:/.test(source)) {
        offenders.push(`${name}: fontSize`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
