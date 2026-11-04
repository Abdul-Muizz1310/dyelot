import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import fc from "fast-check";
import { afterAll, describe, expect, it } from "vitest";
import { CONTRAST_CHECKS, type Hex, hexToRgb, ROLE_NAMES, wcagRatio } from "@/engine";
import { type CheckIo, main, nodeIo, wcag } from "@/export/checker/dyelot-check.mjs";
import { trunc4 } from "@/export/format";
import { receiptJson } from "@/export/receipt";
import { lotTag, specId } from "@/spec";
import { APP, type AppFiles, cleanFolders, SHADCN_APP, STUB_FILES } from "./checker-support";
import { ORIGIN, SPEC } from "./golden-support";

// C-CHK-01 to 23, 27 to 30 and C-CHK-RF5 of docs/specs/03-export.md, section 10.7, in process
// through `main(argv, io)`. C-CHK-24 and 26 spawn node: tests/unit/export/checker-entry.test.ts.

afterAll(cleanFolders);

const SEED = 3010;
const rgb = (hex: string) => hexToRgb(hex as Hex);
const THEME = STUB_FILES.find((file) => file.path === "app/theme.css")?.text as string;
const LOT = lotTag(specId(SPEC));

interface Run {
  code: number;
  out: string;
  lines: string[];
  err: string;
  // biome-ignore lint/suspicious/noExplicitAny: parsed report JSON, read by key
  json: Record<string, any>;
}

function run(args: readonly string[], cwd = process.cwd(), over: Partial<CheckIo> = {}): Run {
  const out: string[] = [];
  const err: string[] = [];
  const io: CheckIo = {
    ...nodeIo,
    cwd,
    out: (text) => out.push(text),
    err: (text) => err.push(text),
    ...over,
  };
  const code = main(args, io);
  const text = out.join("");
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  let json = {};
  if (args.includes("--json")) json = JSON.parse(text);
  return { code, out: text, lines, err: err.join(""), json };
}

const check = (dir: string, ...more: string[]) => run(["--root", dir, "--json", ...more]);
const codes = (r: Run): string[] => r.json.findings.map((f: { code: string }) => f.code);
const last = (r: Run): string => r.lines[r.lines.length - 1] as string;

/** A global stylesheet that is itself the theme: the 46 roles and `--radius` (the registry route). */
function registryCss(edit: (css: string) => string = (css) => css): string {
  const receipt = JSON.parse(receiptJson(SPEC, STUB_FILES, ORIGIN)) as {
    roles: Record<"light" | "dark", Record<string, string>>;
    radius: string;
  };
  const block = (selector: string, mode: "light" | "dark", extra: string[]) =>
    `${selector} {\n${[...extra, ...ROLE_NAMES.map((name) => `  --${name}: ${receipt.roles[mode][name]};`)].join("\n")}\n}\n`;
  return edit(
    `${block(":root", "light", [`  --radius: ${receipt.radius};`])}\n${block(".dark", "dark", [])}`,
  );
}

function require_(file: string, dir: string): string {
  // biome-ignore lint/style/noNonNullAssertion: a scaffold file
  return nodeIo.readFile(path.join(dir, file))!;
}

const registryApp = (edit?: (css: string) => string, files: AppFiles = {}): string =>
  APP({ "app/globals.css": registryCss(edit), "app/theme.css": null, ...files });

describe("the pass and the folder layout", () => {
  it("C-CHK-01: a clean APP passes", () => {
    const dir = APP();
    const r = run(["--root", dir]);
    expect(r.code).toBe(0);
    expect(r.lines[0]).toBe(`dyelot-check · ${LOT} · untitled`);
    expect(r.lines.at(-2)).toBe("92 roles · 78 pairs · 1 files scanned");
    expect(last(r)).toBe("PASS");
    expect(r.err).toBe("");
  });

  it("C-CHK-02: the root is io.cwd, and --receipt reads another path", () => {
    const dir = APP();
    const r = run([], dir);
    expect(r.code).toBe(0);
    expect(last(r)).toBe("PASS");
    const moved = APP({
      "other/r.json": require_("receipt.json", dir),
      "receipt.json": null,
    });
    expect(run(["--root", moved, "--receipt", "other/r.json"], moved).code).toBe(0);
    expect(run(["--root", moved, "--receipt", path.join(moved, "other/r.json")]).code).toBe(0);
  });

  it("C-CHK-03: the first of three global stylesheets decides", () => {
    const nested = APP({
      "app/globals.css": null,
      "src/app/globals.css": '@import "./theme.css";\n',
      "src/app/theme.css": THEME,
      "app/theme.css": null,
    });
    const r = check(nested);
    expect(r.code).toBe(0);
    expect(r.json.checked.theme).toBe("src/app/theme.css");

    const both = APP({ "src/app/globals.css": "this is not a theme\n" });
    expect(check(both).json.checked.theme).toBe("app/theme.css");

    const styles = APP({
      "app/globals.css": null,
      "styles/globals.css": '@import "./theme.css";\n',
      "styles/theme.css": THEME,
      "app/theme.css": null,
    });
    expect(check(styles).json.checked.theme).toBe("styles/theme.css");
  });

  it.each([
    ["double quotes", '@import "./theme.css";\n', "app/theme.css"],
    ["single quotes", "@import './theme.css';\n", "app/theme.css"],
    ["a parent path", '@import "../styles/theme.css";\n', "styles/theme.css"],
    ["url()", '@import url("./theme.css");\n', "app/theme.css"],
    ["bare url()", "@import url(./theme.css);\n", "app/theme.css"],
    ["a layer", '@import "./theme.css" layer(theme);\n', "app/theme.css"],
    [
      "supports and media",
      '@import "./theme.css" supports(display: grid) screen;\n',
      "app/theme.css",
    ],
  ])("C-CHK-04: %s resolves to the named file", (_name, line, themePath) => {
    const dir = APP({
      "app/globals.css": line,
      ...(themePath === "styles/theme.css"
        ? { "styles/theme.css": THEME, "app/theme.css": null }
        : {}),
    });
    const r = check(dir);
    expect(r.code).toBe(0);
    expect(r.json.checked.theme).toBe(themePath);
  });

  it("C-CHK-05: the registry route, case aside", () => {
    const r = check(registryApp());
    expect(r.code).toBe(0);
    expect(r.json.checked.theme).toBe("app/globals.css");
    const upper = check(
      registryApp((css) => css.replace(/#[0-9a-f]{6}/g, (hex) => hex.toUpperCase())),
    );
    expect(upper.code).toBe(0);
  });

  it("C-CHK-06: no global stylesheet is exit 2", () => {
    const dir = APP({ "app/globals.css": null });
    const r = run(["--root", dir]);
    expect(r.code).toBe(2);
    expect(last(r)).toBe(
      "ERROR: No theme found: none of app/globals.css, src/app/globals.css and styles/globals.css exists.",
    );
    expect(r.lines).toHaveLength(1);
  });

  it("C-CHK-07: shadcn's own globals.css has no theme", () => {
    const r = run(["--root", SHADCN_APP()]);
    expect(r.code).toBe(2);
    expect(last(r)).toBe(
      "ERROR: No theme found: app/globals.css imports no theme.css and does not define every role.",
    );
  });
});

describe("the theme against the receipt", () => {
  it("C-CHK-08: one character in a header comment is theme-changed alone", () => {
    const comment = THEME.split("\n")[2] as string;
    const dir = APP({
      "app/theme.css": THEME.replace(comment, `${comment.slice(0, -3)}x${comment.slice(-3)}`),
    });
    const r = check(dir);
    expect(r.code).toBe(1);
    expect(codes(r)).toEqual(["theme-changed"]);
    expect(r.json.findings[0].path).toBeUndefined();
  });

  it("C-CHK-09: a tampered primary", () => {
    const light = SPEC.color.roles.light.primary;
    const dir = APP({
      "app/theme.css": THEME.replace(`--primary: ${light};`, "--primary: #ff0000;"),
    });
    const r = run(["--root", dir]);
    const j = check(dir);
    expect(r.code).toBe(1);
    expect(codes(j)).toContain("theme-changed");
    const mismatch = j.json.findings.find((f: { code: string }) => f.code === "role-mismatch");
    for (const word of ["primary", "light", light, "#ff0000"])
      expect(mismatch.message).toContain(word);
    const expected = CONTRAST_CHECKS.filter(
      (c) =>
        c.required &&
        (c.foreground === "primary" || c.background === "primary") &&
        wcagRatio(
          rgb(c.foreground === "primary" ? "#ff0000" : SPEC.color.roles.light[c.foreground]),
          rgb(c.background === "primary" ? "#ff0000" : SPEC.color.roles.light[c.background]),
        ) < c.threshold,
    ).length;
    const fails = j.json.findings.filter((f: { code: string }) => f.code === "contrast-fails");
    // Dark roles are untouched, so exactly the light pairs with primary fail.
    expect(expected).toBeGreaterThan(0);
    expect(fails).toHaveLength(expected);
    for (const f of fails) expect(f.message).toContain("primary");
    expect(last(r)).toBe(`FAIL (${j.json.findings.length} findings)`);
  });

  it("C-CHK-10: role-missing", () => {
    const r = check(
      registryApp((css) => {
        const at = css.indexOf(".dark");
        return css.slice(0, at) + css.slice(at).replace(/ {2}--ring: [^;]*;\n/, "");
      }),
    );
    expect(r.code).toBe(1);
    expect(codes(r)).toEqual(["role-missing"]);
    expect(r.json.findings[0].message).toContain("ring");
    expect(r.json.findings[0].message).toContain("dark");
  });

  it("C-CHK-11: radius-mismatch", () => {
    const r = check(registryApp((css) => css.replace(/--radius: [^;]*;/, "--radius: 0px;")));
    expect(codes(r)).toEqual(["radius-mismatch"]);
    expect(r.json.findings[0].message).toContain("0px");
  });

  it("C-CHK-12: a renamed mapping, and a later one that shadows", () => {
    const dir = APP({
      "app/theme.css": THEME.replace(
        "--color-primary: var(--primary);",
        "--color-primary: var(--accent);",
      ),
      "app/globals.css":
        '@import "./theme.css";\n@theme inline {\n  --color-ring: var(--primary);\n}\n',
    });
    const r = check(dir);
    const names = r.json.findings.filter((f: { code: string }) => f.code === "theme-name-changed");
    expect(names).toHaveLength(1);
    expect(names[0].message).toContain("--color-primary");
    const shadowed = r.json.findings.filter((f: { code: string }) => f.code === "shadowed");
    expect(shadowed).toHaveLength(1);
    expect(shadowed[0].message).toContain("--color-ring");
  });

  it("C-CHK-13: contrast-fails carries the ratio and the threshold", () => {
    const light = SPEC.color.roles.light;
    const r = check(
      registryApp((css) =>
        css.replace(
          `--muted-foreground: ${light["muted-foreground"]};`,
          "--muted-foreground: #9a9a9a;",
        ),
      ),
    );
    const found = r.json.findings.filter((f: { code: string }) => f.code === "contrast-fails");
    for (const bg of ["muted", "background"]) {
      const finding = found.find((f: { message: string }) =>
        f.message.includes(`C1:muted-foreground/${bg}`),
      );
      expect(finding.message).toContain("light");
      expect(finding.message).toContain(
        trunc4(wcagRatio(rgb("#9a9a9a"), rgb(light[bg as "muted"]))),
      );
      expect(finding.message).toContain("4.5");
    }
    expect(codes(r)).toContain("role-mismatch");
  });
});

describe("shadowed definitions", () => {
  it("C-CHK-14: a later :root, in globals.css or in extra.css", () => {
    const a = check(
      APP({ "app/globals.css": '@import "./theme.css";\n:root { --primary: #000000; }\n' }),
    );
    const shadowed = a.json.findings.filter((f: { code: string }) => f.code === "shadowed");
    expect(shadowed).toHaveLength(1);
    expect(shadowed[0].message).toContain("primary");
    expect(shadowed[0].message).toMatch(/app\/theme\.css:\d+/);
    expect(shadowed[0].message).toContain("app/globals.css:2");
    const b = check(
      APP({
        "app/globals.css": '@import "./theme.css";\n@import "./extra.css";\n',
        "app/extra.css": ":root {\n  --primary: #000000;\n}\n",
      }),
    );
    const found = b.json.findings.filter((f: { code: string }) => f.code === "shadowed");
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain("app/extra.css:2");
  });

  it("C-CHK-15: install route 1 on shadcn's globals.css", () => {
    const base = SHADCN_APP();
    const css = require_("app/globals.css", base);
    const withImport = css.replace(
      '@import "tailwindcss";',
      '@import "tailwindcss";\n@import "./theme.css";',
    );
    const dir = SHADCN_APP({ "app/globals.css": withImport });
    const r = check(dir);
    expect(r.code).toBe(1);
    const block = (name: string) => new RegExp(`${name} \\{([^}]*)\\}`).exec(css)?.[1] as string;
    const defined = (text: string) =>
      [...text.matchAll(/--([a-z0-9-]+):/g)].map((m) => m[1] as string);
    const roles = new Set<string>(ROLE_NAMES);
    const expected =
      defined(block(":root")).filter((n) => roles.has(n) || n === "radius").length +
      defined(block("\\.dark")).filter((n) => roles.has(n)).length;
    const shadowed = r.json.findings.filter((f: { code: string }) => f.code === "shadowed");
    expect(expected).toBeGreaterThan(30);
    expect(shadowed).toHaveLength(expected);
    expect(shadowed.some((f: { message: string }) => f.message.includes("--radius"))).toBe(true);
    expect(codes(r).every((c: string) => c === "shadowed")).toBe(true);
    expect(r.out).not.toContain("button.tsx");

    const stripped = withImport
      .replace(/@custom-variant[^;]*;/, "")
      .replace(/@theme inline \{[^}]*\}/, "")
      .replace(/:root \{[^}]*\}/, "")
      .replace(/\.dark \{[^}]*\}/, "");
    const clean = run(["--root", SHADCN_APP({ "app/globals.css": stripped })]);
    expect(clean.code).toBe(0);
    expect(last(clean)).toBe("PASS");
  });
});

describe("the scan", () => {
  const scan = (files: AppFiles) => check(APP(files));
  const scanOf = (r: Run) =>
    r.json.findings as { code: string; path: string; line: number; column: number; text: string }[];

  it("C-CHK-16: raw hex", () => {
    const r = scan({
      "src/a.tsx": [
        'const a = { color: "#ff0000" };',
        'const b = { color: "#f00" };',
        'const c = { color: "#f00a" };',
        'const d = { color: "#ff0000aa" };',
        'const e = ["#abcde", "#fffg"]; <a href="#top">x</a>',
      ].join("\n"),
    });
    const found = scanOf(r);
    expect(found.map((f) => [f.code, f.path, f.line, f.column, f.text])).toEqual([
      ["raw-color", "src/a.tsx", 1, 21, "#ff0000"],
      ["raw-color", "src/a.tsx", 2, 21, "#f00"],
      ["raw-color", "src/a.tsx", 3, 21, "#f00a"],
      ["raw-color", "src/a.tsx", 4, 21, "#ff0000aa"],
    ]);
    expect(r.code).toBe(1);
  });

  it("C-CHK-17: color functions with a literal first argument", () => {
    const lines = [
      "a { color: rgb(255 0 0); }",
      "a { color: rgba(0,0,0,.5); }",
      "a { color: hsl(0 100% 50%); }",
      "a { color: hwb(0 0% 0%); }",
      "a { color: lab(50 20 30); }",
      "a { color: lch(50 30 20); }",
      "a { color: oklab(0.5 0.1 0); }",
      "a { color: oklch(0.7 0.1 20); }",
      "a { color: color(display-p3 1 0 0); }",
      "a { color: rgb(var(--x)); }",
      "a { color: oklch(var(--l) 0.1 20); }",
    ];
    const found = scanOf(scan({ "src/a.css": lines.join("\n") }));
    expect(found.map((f) => f.line)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(new Set(found.map((f) => f.code))).toEqual(new Set(["raw-color"]));
  });

  it("C-CHK-18: Tailwind default palette classes", () => {
    const r = scan({
      "src/a.tsx":
        '<p className="bg-blue-500 text-slate-50 hover:border-rose-950 bg-blue-500/50" />\n' +
        '<p className="bg-primary text-primary-600 border-border bg-white text-black bg-white/80 blue-500" />\n',
    });
    const found = scanOf(r);
    expect(found.map((f) => [f.code, f.line, f.text])).toEqual([
      ["palette-class", 1, "bg-blue-500"],
      ["palette-class", 1, "text-slate-50"],
      ["palette-class", 1, "border-rose-950"],
      ["palette-class", 1, "bg-blue-500"],
    ]);
  });

  it("C-CHK-19: arbitrary colors give one finding each", () => {
    const r = scan({
      "src/a.tsx":
        '<p className="bg-[#ff0000]" />\n<p className="text-[rgb(0,0,0)]" />\n<p className="border-[oklch(0.5_0.1_20)]" />\n<p className="bg-[var(--primary)] w-[12px]" />\n',
    });
    expect(scanOf(r).map((f) => [f.code, f.line])).toEqual([
      ["arbitrary-color", 1],
      ["arbitrary-color", 2],
      ["arbitrary-color", 3],
    ]);
  });

  it("C-CHK-20: only the listed extensions are scanned", () => {
    const skipped = ["json", "md", "svg", "txt"];
    const listed = "ts tsx js jsx mjs cjs css scss html vue svelte astro mdx".split(" ");
    const files: Record<string, string> = {};
    for (const ext of [...skipped, ...listed]) files[`src/a.${ext}`] = 'x = "#ff0000"\n';
    const found = scanOf(scan(files));
    expect(found.map((f) => f.path).sort()).toEqual(listed.map((e) => `src/a.${e}`).sort());
  });

  it("C-CHK-22: the marker exempts its own line, with a reason", () => {
    const r = scan({
      "src/a.tsx": [
        'const brand = "#ff0000"; // dyelot-check-ignore: brand color from the logo guidelines',
        'const next = "#00ff00";',
      ].join("\n"),
      "src/b.css": "a { color: #ff0000; } /* dyelot-check-ignore: logo red */",
      "src/c.html": '<i style="color:#ff0000"></i> <!-- dyelot-check-ignore: logo red -->',
      "src/d.tsx": "<i style={{ color: '#ff0000' }} />{/* dyelot-check-ignore: logo red */}",
    });
    expect(scanOf(r).map((f) => [f.path, f.line, f.text])).toEqual([["src/a.tsx", 2, "#00ff00"]]);
    expect(r.json.ignored).toEqual([
      { path: "src/a.tsx", line: 1, reason: "brand color from the logo guidelines" },
      { path: "src/b.css", line: 1, reason: "logo red" },
      { path: "src/c.html", line: 1, reason: "logo red" },
      { path: "src/d.tsx", line: 1, reason: "logo red" },
    ]);
  });

  it("C-CHK-23: a marker without a reason exempts nothing", () => {
    const r = scan({
      "src/a.tsx": [
        'const a = "#ff0000"; // dyelot-check-ignore:',
        'const b = "#ff0000"; // dyelot-check-ignore: ok',
        'const c = "#ff0000"; // dyelot-check-ignore:  a b ',
      ].join("\n"),
    });
    expect(scanOf(r).map((f) => [f.code, f.line])).toEqual([
      ["raw-color", 1],
      ["marker-without-reason", 1],
      ["raw-color", 2],
      ["marker-without-reason", 2],
      ["raw-color", 3],
      ["marker-without-reason", 3],
    ]);
    expect(r.json.ignored).toEqual([]);
  });

  it("C-CHK-29: skipped folders, big files, the bundle's own files, declaration lines", () => {
    const bad = 'const c = "#ff0000";\n';
    const files: Record<string, string> = {
      "src/node_modules/x/a.ts": bad,
      "node_modules/a.ts": bad,
      ".git/a.ts": bad,
      ".next/a.ts": bad,
      "dist/a.ts": bad,
      "build/a.ts": bad,
      "out/a.ts": bad,
      "coverage/a.ts": bad,
      "src/big.ts": `${"x".repeat(1.1 * 1024 * 1024)}\n${bad}`,
      "motion/motion.css": "a { color: #ff0000; }\n",
      "scripts/dyelot-check.mjs": bad,
      "src/decl.css":
        ":root { --primary: #ff0000; }\n.x {\n  --radius: #fff;\n  --color-primary: #abc;\n}\n",
    };
    const r = scan(files);
    expect(r.code).toBe(0);
    expect(r.json.checked.files).toBe(2);
  });

  it("C-CHK-RF5: 5,000 files and a node_modules file", () => {
    const dir = APP({ "packages/a/node_modules/x/index.js": 'const c = "#ff0000";\n' });
    const src = path.join(dir, "src");
    mkdirSync(src, { recursive: true });
    for (let i = 0; i < 5000; i++) {
      writeFileSync(
        path.join(src, `f${i}.tsx`),
        `export const f${i} = () => <p className="p-${i % 9}" />;\n`,
      );
    }
    const reads: string[] = [];
    const started = Date.now();
    const r = run(["--root", dir], dir, {
      readFile: (file) => {
        reads.push(file);
        return nodeIo.readFile(file);
      },
    });
    const elapsed = Date.now() - started;
    expect(r.code).toBe(0);
    expect(elapsed).toBeLessThan(10_000);
    expect(reads.some((file) => file.includes("/node_modules/"))).toBe(false);
    console.log(`C-CHK-RF5: ${elapsed} ms for ${reads.length} reads`);
  });
});

describe("the pairs, the errors and the report", () => {
  it("C-CHK-21: wcag equals the engine's ratio on the full float", () => {
    const roles = SPEC.color.roles;
    const required = CONTRAST_CHECKS.filter((c) => c.required);
    expect(required).toHaveLength(39);
    for (const mode of ["light", "dark"] as const) {
      for (const c of required) {
        const fg = roles[mode][c.foreground];
        const bg = roles[mode][c.background];
        expect(wcag(fg, bg)).toBe(wcagRatio(rgb(fg), rgb(bg)));
      }
    }
    const hex = fc
      .tuple(
        fc.integer({ min: 0, max: 255 }),
        fc.integer({ min: 0, max: 255 }),
        fc.integer({ min: 0, max: 255 }),
      )
      .map(([r, g, b]) => `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`);
    fc.assert(
      fc.property(hex, hex, (a, b) => wcag(a, b) === wcagRatio(rgb(a), rgb(b))),
      { numRuns: 1000, seed: SEED },
    );
  });

  it("C-CHK-27: the exit-2 messages", () => {
    const dir = APP();
    const missing = path.join(dir, "nope");
    const receipt = (text: string) => APP({ "receipt.json": text });
    const real = require_("receipt.json", dir);
    const bad = receipt("not json");
    const format2 = receipt(real.replace("dyelot.check/1", "dyelot.check/2"));
    const noRoles = receipt(
      JSON.stringify({ format: "dyelot.check/1", contrast: [], radius: "1", files: [] }),
    );
    const noReceipt = APP({ "receipt.json": null });
    const cases: [string[], string][] = [
      [["--root", dir, "--fix"], "Unknown option --fix."],
      [["--root", missing], `No folder at ${missing}.`],
      [["--root", noReceipt], `No receipt at ${path.join(noReceipt, "receipt.json")}.`],
      [["--root", bad], `The receipt at ${path.join(bad, "receipt.json")} is not valid JSON.`],
      [["--root", format2], "The receipt's format is dyelot.check/2, not dyelot.check/1."],
      [["--root", dir, "--receipt"], "--receipt needs a path."],
      [["--root"], "--root needs a path."],
      [["--root", noRoles], `The receipt at ${path.join(noRoles, "receipt.json")} lacks roles.`],
    ];
    for (const [args, message] of cases) {
      const r = run(args, dir);
      expect(r.code, args.join(" ")).toBe(2);
      expect(last(r)).toBe(`ERROR: ${message}`);
    }
  });

  it("C-CHK-28: --json", () => {
    const pass = run(["--root", APP(), "--json"]);
    expect(pass.code).toBe(0);
    expect(Object.keys(pass.json)).toEqual([
      "format",
      "result",
      "design",
      "findings",
      "ignored",
      "checked",
    ]);
    expect(pass.json.format).toBe("dyelot.check-report/1");
    expect(pass.json.result).toBe("PASS");
    expect(pass.json.design).toEqual({ specId: specId(SPEC), lot: LOT });
    expect(pass.json.checked).toEqual({ theme: "app/theme.css", roles: 92, pairs: 78, files: 1 });
    expect(pass.out).toBe(`${JSON.stringify(pass.json, null, 2)}\n`);

    const light = SPEC.color.roles.light.primary;
    const dir = APP({
      "app/theme.css": THEME.replace(`--primary: ${light};`, "--primary: #ff0000;"),
    });
    const human = run(["--root", dir]);
    const fail = run(["--root", dir, "--json"]);
    expect(fail.code).toBe(1);
    expect(fail.json.result).toBe("FAIL");
    expect(
      human.lines.filter((l) => /^(theme-changed|role-mismatch|contrast-fails) /.test(l)),
    ).toHaveLength(fail.json.findings.length);

    const none = run(["--root", APP({ "app/globals.css": null }), "--json"]);
    expect(none.code).toBe(2);
    expect(none.json.result).toBe("ERROR");
    expect(none.json.error).toMatch(/^No theme found/);
    expect(none.json.findings).toEqual([]);
    expect(none.json.ignored).toEqual([]);
  });

  it("C-CHK-30: the report lines", () => {
    const dir = APP({
      "src/a.tsx":
        'const a = "#ff0000";\nconst b = "#00ff00"; // dyelot-check-ignore: logo green\n',
      "app/theme.css": THEME.replace(/\n$/, "\n/* x */\n"),
    });
    const r = run(["--root", dir]);
    expect(r.lines[0]).toBe(`dyelot-check · ${LOT} · untitled`);
    expect(r.lines[1]).toMatch(/^theme-changed {2}\S/);
    expect(r.lines[2]).toMatch(/^src\/a\.tsx:1:12 {2}raw-color {2}\S/);
    expect(r.lines[3]).toBe("ignored  src/a.tsx:2  logo green");
    expect(r.lines[4]).toBe("92 roles · 78 pairs · 2 files scanned");
    expect(r.lines[5]).toBe("FAIL (2 findings)");
    expect(r.lines).toHaveLength(6);
    const one = run(["--root", APP({ "src/a.tsx": 'x = "#ff0000"\n' })]);
    expect(last(one)).toBe("FAIL (1 finding)");
  });
});
