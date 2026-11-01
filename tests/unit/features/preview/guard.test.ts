import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { deriveTailwind } from "../../engine/lint/tailwind-source";
import { findViolations, houseColors, madderFiles, previewFiles } from "./guard-rules";

// The preview source guard of docs/specs/02-studio.md, section 6.10: C-GUARD-01 to C-GUARD-05. The
// canvas is styled only by the spec's custom properties (I-M2-04), so no file under
// src/features/preview names a color of its own.

const ROOT = path.resolve(import.meta.dirname, "../../../..");
const PREVIEW = path.join(ROOT, "src/features/preview");

describe("C-GUARD-01 findViolations flags every color that is not a spec variable", () => {
  it.each([
    "bg-indigo-500",
    "bg-mauve-500",
    "text-slate-700",
    "border-red-200",
    "ring-blue-500/50",
    "dark:bg-black",
    "bg-white",
    "bg-[#fff]",
    "color: #fff",
    "fill: rgb(0 0 0 / 0.1)",
    "stroke: oklch(0.6 0.1 20)",
    "color: rebeccapurple",
    "color-mix(in oklab, #fff 20%, transparent)",
    'style={{ color: "red" }}',
  ])("flags %s", (source) => {
    expect(findViolations(source)).not.toEqual([]);
  });

  it.each([
    'className="hover:text-white"',
    "background: hsl(20 50% 50%)",
    "outline-color: lab(50 20 20)",
    "fill: color(display-p3 1 0 0)",
    "background: color-mix(in srgb, red 20%, transparent)",
    "background: color-mix(in oklab, currentColor 20%, transparent)",
    "background: color-mix(in oklab, var(--primary, #fff) 20%, transparent)",
    'fill="black"',
    "text-[navy]",
    "bg-panel",
    "text-fg-muted",
    "border-control-edge",
    "bg-accent-madder",
    "border-border-bright",
    "shadow-[0_0_0_1px_#000]",
    "from-emerald-400 to-sky-500",
  ])("also flags %s", (source) => {
    expect(findViolations(source)).not.toEqual([]);
  });

  it("names what it flags, once per hit", () => {
    expect(findViolations('className="bg-indigo-500 text-slate-700"')).toHaveLength(2);
    expect(findViolations("color: #fff").join(" ")).toContain("#fff");
  });

  it("takes its palette names from the same derivation as T3's table (R2-09)", () => {
    const { palettes } = deriveTailwind();
    expect(palettes).toHaveLength(26);
    for (const palette of palettes) {
      expect(findViolations(`bg-${palette}-500`), palette).not.toEqual([]);
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
  it("lists the chrome files that name madder: the focus ring and the primary action", () => {
    expect(madderFiles(ROOT)).toEqual(["src/app/globals.css", "src/features/studio/chrome.ts"]);
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
