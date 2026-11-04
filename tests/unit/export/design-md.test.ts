import { describe, expect, it } from "vitest";
import {
  generateSystem,
  PALETTE_NAMES,
  PRESETS,
  ROLE_NAMES,
  resolveParams,
  typeWeights,
} from "@/engine";
import { designMd } from "@/export/design-md";
import { designMdTokens } from "@/export/design-md-tokens";
import { familyName } from "@/export/fonts";
import { fmt4 } from "@/export/format";
import { describeDesign, USE_FOR } from "@/export/prose";
import { editLink, mdText, yamlString } from "@/export/text";
import { themeCss } from "@/export/theme-css";
import type { DesignSpec } from "@/spec";
import { DEFAULT_PARAMS } from "../spec/support";
import { bodyLines, outsideFences, parseFront, splitFrontMatter } from "./design-md-support";
import { GOLDENS, ORIGIN, SPEC } from "./golden-support";

// C-DMD-01 to 13, 17 to 19 of docs/specs/03-export.md, section 10.8 (R3-10, R3-21, R3-22, 6.9).

const TEXT = designMd(SPEC, ORIGIN);
const FRONT = parseFront(TEXT) as Record<string, Record<string, Record<string, unknown>>> &
  Record<string, unknown>;
const STEP_NAMES = SPEC.type.steps.map((step) => step.name);

function specWith(patch: {
  name?: string;
  oneLiner?: string;
  direction?: { thesis: string };
  rules?: { do: string[]; dont: string[] };
  type?: { context: "product" | "dense" };
}): DesignSpec {
  return generateSystem(resolveParams({ ...DEFAULT_PARAMS, ...patch }, "seed-1"), "seed-1");
}

function golden(id: string): DesignSpec {
  return (GOLDENS.find((g) => g.id === id) as { spec: DesignSpec }).spec;
}

describe("designMd front matter", () => {
  it("C-DMD-01: starts with ---, lists the keys in order, ends in one LF newline", () => {
    expect(TEXT.startsWith("---\n")).toBe(true);
    expect(Object.keys(FRONT)).toEqual([
      "version",
      "name",
      "description",
      "colors",
      "typography",
      "rounded",
      "spacing",
      "components",
    ]);
    expect(FRONT.version).toBe("alpha");
    expect(FRONT.description).toBe(describeDesign(SPEC));
    const oneLiner = specWith({ oneLiner: "A calm tide chart." });
    expect(parseFront(designMd(oneLiner, ORIGIN)).description).toBe("A calm tide chart.");
    expect(TEXT).not.toContain("\r");
    expect(TEXT.endsWith("\n")).toBe(true);
    expect(TEXT.endsWith("\n\n")).toBe(false);
  });

  it("C-DMD-02: colors holds the 46 light roles in ROLE_NAMES order", () => {
    const colors = FRONT.colors as unknown as Record<string, string>;
    expect(Object.keys(colors)).toEqual([...ROLE_NAMES]);
    for (const role of ROLE_NAMES) {
      expect(colors[role]).toBe(SPEC.color.roles.light[role]);
      expect(TEXT).toContain(`  ${role}: "${SPEC.color.roles.light[role]}"\n`);
    }
  });

  it("C-DMD-03: typography holds the 10 steps with their families, sizes and weights", () => {
    const typography = FRONT.typography as unknown as Record<string, Record<string, unknown>>;
    expect(Object.keys(typography)).toEqual(STEP_NAMES);
    const weights = typeWeights(SPEC);
    for (const step of SPEC.type.steps) {
      const heading = ["display", "h1", "h2", "h3", "h4"].includes(step.name);
      const role = heading ? "heading" : step.name === "label" ? "label" : "body";
      expect(typography[step.name]).toEqual({
        fontFamily: familyName(heading ? SPEC.type.families.display : SPEC.type.families.body),
        fontSize: `${fmt4(step.sizePx)}px`,
        fontWeight: weights[role],
        lineHeight: `${fmt4(step.lineHeightPx)}px`,
        letterSpacing: `${fmt4(step.trackingEm)}em`,
      });
    }
  });

  it("C-DMD-03: display steps name the display family and the others the body family", () => {
    const spec = golden("editorial");
    const typography = parseFront(designMd(spec, ORIGIN)).typography as Record<
      string,
      { fontFamily: string }
    >;
    const display = typography.display?.fontFamily;
    const body = typography.body?.fontFamily;
    expect(display).not.toBe(body);
    for (const name of ["display", "h1", "h2", "h3", "h4"]) {
      expect(typography[name]?.fontFamily).toBe(display);
    }
    for (const name of ["caption", "label", "body-sm", "body", "lead"]) {
      expect(typography[name]?.fontFamily).toBe(body);
    }
  });

  it("C-DMD-04: rounded and spacing", () => {
    const { shape, space } = SPEC;
    expect(FRONT.rounded).toEqual({
      sm: `${fmt4(shape.radii.sm)}px`,
      md: `${fmt4(shape.radii.md)}px`,
      lg: `${fmt4(shape.radii.lg)}px`,
      xl: `${fmt4(shape.radii.xl)}px`,
      "2xl": `${fmt4(shape.radii["2xl"])}px`,
      full: "9999px",
    });
    const spacing = FRONT.spacing as unknown as Record<string, string>;
    expect(Object.keys(spacing)).toEqual([
      "0",
      "1",
      "2",
      "3",
      "4",
      "6",
      "8",
      "12",
      "16",
      "20",
      "24",
      "32",
    ]);
    ["0", "1", "2", "3", "4", "6", "8", "12", "16", "20", "24", "32"].forEach((key, i) => {
      expect(spacing[key]).toBe(`${fmt4(4 * Number(key))}px`);
      expect(space.scale[i]).toBe(4 * Number(key));
    });
  });

  it("C-DMD-05: 29 components in table order whose references cover the 46 roles", () => {
    const components = FRONT.components as unknown as Record<string, Record<string, string>>;
    expect(Object.keys(components)).toEqual([
      "page",
      "card",
      "popover",
      "sidebar",
      "muted-panel",
      "muted-text",
      "button-primary",
      "button-secondary",
      "menu-item-active",
      "sidebar-item-active",
      "sidebar-button-primary",
      "button-destructive",
      "alert-destructive",
      "badge-success",
      "alert-success",
      "badge-warning",
      "alert-warning",
      "badge-info",
      "alert-info",
      "divider",
      "input-outline",
      "focus-ring",
      "sidebar-divider",
      "sidebar-focus-ring",
      "chart-1",
      "chart-2",
      "chart-3",
      "chart-4",
      "chart-5",
    ]);
    expect(components.page).toEqual({
      backgroundColor: "{colors.background}",
      textColor: "{colors.foreground}",
      typography: "{typography.body}",
    });
    expect(components["button-primary"]).toEqual({
      backgroundColor: "{colors.primary}",
      textColor: "{colors.primary-foreground}",
      typography: "{typography.label}",
      rounded: "{rounded.md}",
      height: "40px",
    });
    expect(components["muted-text"]).toEqual({
      backgroundColor: "{colors.background}",
      textColor: "{colors.muted-foreground}",
      typography: "{typography.body-sm}",
    });
    expect(components.divider).toEqual({ backgroundColor: "{colors.border}" });
    expect(components["chart-3"]).toEqual({ backgroundColor: "{colors.chart-3}" });
    const refs = new Set(
      [...JSON.stringify(components).matchAll(/\{colors\.([a-z0-9-]+)\}/g)].map((m) => m[1]),
    );
    expect([...refs].sort()).toEqual([...ROLE_NAMES].sort());
  });

  it("C-DMD-06: designMdTokens deep-equals the parsed front matter for every golden", () => {
    for (const { id, spec } of GOLDENS) {
      expect(designMdTokens(spec), id).toEqual(parseFront(designMd(spec, ORIGIN)));
    }
  });

  it("C-DMD-18: the front matter is plain, quoted and free of anchors", () => {
    for (const { id, spec } of GOLDENS) {
      const text = designMd(spec, ORIGIN);
      const { front } = splitFrontMatter(text);
      expect(front, id).not.toMatch(/[&*]\w|<<|^\s*!/m);
      expect(designMd(spec, ORIGIN)).toBe(text);
      const tokens = designMdTokens(spec) as Record<string, Record<string, unknown>>;
      for (const value of Object.values(tokens.colors as Record<string, string>)) {
        expect(value).toMatch(/^#[0-9a-f]{6}$/);
      }
      for (const line of front.split("\n")) {
        if (/^\s+(?:colors\.)?[\w-]+: "#/.test(line)) expect(line).toMatch(/: "#[0-9a-f]{6}"$/);
        if (/^\s+(fontSize|lineHeight|letterSpacing): /.test(line)) {
          expect(line, line).toMatch(/: "-?\d+(\.\d+)?(px|em)"$/);
        }
        if (/^\s+fontWeight: /.test(line)) expect(line).toMatch(/: \d+$/);
      }
      for (const group of ["rounded", "spacing"]) {
        for (const value of Object.values(tokens[group] as Record<string, string>)) {
          expect(value).toMatch(/^\d+(\.\d+)?px$/);
        }
      }
      const keys = front.split("\n").filter((line) => /^ {2}\S/.test(line) && !line.includes('"#'));
      expect(keys.length).toBeGreaterThan(0);
    }
  });
});

describe("designMd body", () => {
  it("C-DMD-07: the headings are exactly these, in order", () => {
    const headings = bodyLines(TEXT).filter((line) => /^#{1,6} /.test(line));
    expect(headings).toEqual([
      `# ${mdText(SPEC.meta.name)}`,
      "## Overview",
      "## Colors",
      "## Typography",
      "## Layout",
      "## Elevation & Depth",
      "## Shapes",
      "## Components",
      "## Do's and Don'ts",
      "## Dark mode",
      "## Motion",
      "## Accessibility",
      "## Install",
      "## Self-check before you finish",
    ]);
    expect(headings[8]?.charCodeAt(5)).toBe(0x27);
  });

  it("C-DMD-08: Overview holds the sentence, the link and, for a preset, its style and traits", () => {
    const link = editLink(SPEC, ORIGIN);
    expect(TEXT).toContain(`Made with dyelot. Edit this design: ${link}\n`);
    expect(TEXT).toContain(describeDesign(SPEC));
    const glass = designMd(golden("glass"), ORIGIN);
    expect(glass).toContain(`Style: ${PRESETS.glass.label}. ${PRESETS.glass.summary}`);
    expect(glass).toContain(
      "Traits the tokens cannot hold yet: Backdrop blur of 12 to 24 px, A 10 to 25% white fill, A reduced-transparency fallback.",
    );
    expect(designMd(golden("default"), ORIGIN)).not.toContain("Traits the tokens");
    const thesis = designMd(specWith({ direction: { thesis: "Tides *rule*." } as never }), ORIGIN);
    expect(thesis).toContain("Tides \\*rule\\*.");
  });

  it("C-DMD-09: Colors holds the 46-row table in ROLE_NAMES order", () => {
    const rows = bodyLines(TEXT).filter(
      (line) => /^\| `/.test(line) && line.split("|").length === 6,
    );
    expect(bodyLines(TEXT)).toContain("| Role | Light | Dark | Use for |");
    const colorRows = rows.filter((row) =>
      ROLE_NAMES.some((role) => row.startsWith(`| \`${role}\` |`)),
    );
    expect(colorRows).toHaveLength(46);
    ROLE_NAMES.forEach((role, i) => {
      expect(colorRows[i]).toBe(
        `| \`${role}\` | ${SPEC.color.roles.light[role]} | ${SPEC.color.roles.dark[role]} | ${USE_FOR[role]} |`,
      );
    });
    for (const role of ROLE_NAMES) {
      expect(USE_FOR[role].length).toBeLessThanOrEqual(90);
      expect(USE_FOR[role]).not.toMatch(/[*_`[\]<>|#]/);
    }
    for (const name of PALETTE_NAMES) expect(TEXT).toContain(name);
    expect(TEXT).toContain("`app/theme.css`");
    expect(TEXT).toContain("`tokens/`");
  });

  it("C-DMD-10: Typography, Layout, Elevation and Shapes", () => {
    const lines = bodyLines(TEXT);
    expect(TEXT).toContain("`@fontsource-variable/host-grotesk`");
    expect(TEXT).toContain("`@fontsource/fragment-mono`");
    expect(lines).toContain("| Step | Size | Line height | Tracking | Weight |");
    const stepRows = lines.filter((line) =>
      STEP_NAMES.some((name) => line.startsWith(`| \`${name}\` |`)),
    );
    expect(stepRows).toHaveLength(10);
    expect(TEXT).toContain("4 px base");
    expect(TEXT).toContain("8 px rhythm");
    expect(TEXT).toContain("12 units");
    expect(TEXT).toContain(`Depth style: ${SPEC.depth.style}`);
    for (const level of [1, 2, 3, 4, 5]) expect(TEXT).toContain(`shadow-${level}`);
    expect(TEXT).toContain("elevation by surface lightness");
    for (const radius of ["sm", "md", "lg", "xl", "2xl"] as const) {
      expect(TEXT).toContain(`${radius} ${fmt4(SPEC.shape.radii[radius])} px`);
    }
    expect(TEXT).toContain("inner radius = outer radius − padding");
    expect(TEXT).toContain(`${SPEC.components.icons.library}`);
  });

  it("C-DMD-11: Do's and Don'ts, guards reworded, fixed lines last", () => {
    const rules = { do: ["use one accent"], dont: ["mix *two* grids"] };
    const text = designMd(specWith({ rules }), ORIGIN);
    expect(text).toContain("- Do use one accent");
    expect(text).toContain("- Don't mix \\*two\\* grids");
    const brutal = designMd(golden("neo-brutalism"), ORIGIN);
    expect(brutal).toContain(
      "Hard offset shadows belong to this style; do not mix them with soft shadows.",
    );
    expect(brutal).not.toContain("Hard shadows exist only here");
    const section = (t: string) =>
      t.slice(t.indexOf("## Do's and Don'ts"), t.indexOf("## Dark mode")).trim().split("\n");
    const fixed = (t: string) => section(t).slice(-4);
    expect(fixed(TEXT)).toEqual([
      "- Do pair every fill with its foreground role.",
      "- Don't write a raw hex, rgb(), hsl() or oklch() value in a component.",
      "- Don't use Tailwind's default palette classes such as bg-blue-500.",
      "- Don't set body text under 16 px.",
    ]);
    expect(fixed(designMd(golden("dark-dev-tool"), ORIGIN))[3]).toBe(
      "- Don't set body text under 14 px.",
    );
    const retro = designMd(golden("retro-futurism"), ORIGIN);
    expect(retro).toContain("- Never set saturated text on a saturated fill of a far hue.");
    expect(retro).not.toContain("No vibration");
  });

  it("C-DMD-12: Install and Self-check, filled", () => {
    const link = editLink(SPEC, ORIGIN);
    expect(TEXT).toContain(
      "Two routes put this system into a Next.js app with Tailwind CSS v4. Pick one.",
    );
    expect(TEXT).toContain(
      "npm install @fontsource-variable/host-grotesk @fontsource/fragment-mono",
    );
    expect(TEXT).toContain("`npx shadcn@latest add ./registry/untitled.json`");
    expect(TEXT).toContain(
      ", then `npx shadcn@latest add ./registry/font-<id>.json` for each font file",
    );
    expect(TEXT).toContain("`registry/font-host-grotesk.json`");
    expect(TEXT).toContain("`registry/font-fragment-mono.json`");
    expect(TEXT).toContain(
      `Never edit \`receipt.json\` or \`app/theme.css\` by hand to make the check pass; change the design in the studio and export it again: ${link}\n`,
    );
    expect(TEXT).toContain("measures the 78 required contrast pairs again");
    const install = TEXT.slice(TEXT.indexOf("## Install"), TEXT.indexOf("## Self-check"));
    expect(install.trimEnd().endsWith(`\`\`\`css\n${themeCss(SPEC, ORIGIN)}\n\`\`\``)).toBe(true);

    const redaction = generateSystem(
      resolveParams({ ...DEFAULT_PARAMS, name: "Red" }, "seed-1"),
      "seed-1",
    );
    const swapped: DesignSpec = {
      ...redaction,
      type: {
        ...redaction.type,
        families: { display: "redaction", body: "redaction", mono: "redaction" },
      },
    };
    const none = designMd(swapped, ORIGIN);
    expect(none).toContain("`npx shadcn@latest add ./registry/red.json`");
    expect(none).not.toContain("registry/font-");
    expect(none).not.toContain("for each font file");

    const outside: DesignSpec = {
      ...redaction,
      type: {
        ...redaction.type,
        families: { display: "zzz-unknown", body: "zzz-unknown", mono: "zzz-unknown" },
      },
    };
    const text = designMd(outside, ORIGIN);
    expect(text).not.toContain("zzz-unknown`");
    expect(text).not.toContain("npm install zzz");
  });

  it("C-DMD-13: user text is escaped in the body and quoted in the front matter", () => {
    const name = "My *bold* [link](x) <b>#1";
    const spec = specWith({ name });
    const text = designMd(spec, ORIGIN);
    expect(text).toContain(`\n# ${mdText(name)}\n`);
    expect(splitFrontMatter(text).front).toContain(`name: ${yamlString(name)}\n`);
    const scrubbed = outsideFences(splitFrontMatter(text).body)
      .replace(/\\./g, "")
      .replace(/`[^`\n]*`/g, "")
      .replace(/\*\*/g, "");
    expect(scrubbed.match(/.*[*[\]<].*/g) ?? []).toEqual([]);
  });
});

describe("designMd failures", () => {
  it("C-DMD-17: a bad spec is a TypeError and a bad origin a RangeError, both naming designMd", () => {
    expect(() => designMd("x" as never, ORIGIN)).toThrow(TypeError);
    expect(() => designMd("x" as never, ORIGIN)).toThrow(/designMd/);
    for (const origin of ["http://dyelot.vercel.app", "https://dyelot.vercel.app/x"]) {
      expect(() => designMd(SPEC, origin)).toThrow(RangeError);
      expect(() => designMd(SPEC, origin)).toThrow(/designMd/);
    }
    expect(() => designMd(SPEC, 5 as never)).toThrow(TypeError);
  });

  it("C-DMD-19: null is a TypeError naming the function", () => {
    expect(() => designMdTokens(null as never)).toThrow(TypeError);
    expect(() => designMdTokens(null as never)).toThrow(/designMdTokens/);
    expect(() => designMd(null as never, ORIGIN)).toThrow(TypeError);
    expect(() => designMd(null as never, ORIGIN)).toThrow(/designMd:/);
  });
});
