import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { themeCss } from "@/export/theme-css";
import { GOLDENS, ORIGIN, SPEC } from "./golden-support";

// C-CSS-11 to 13 of docs/specs/03-export.md, section 10.4: theme.css through Tailwind 4.3.3's own
// `compile`, with a `loadStylesheet` over `node_modules/tailwindcss` and no network.

type Compiler = { build(candidates: string[]): string };
type Compile = (
  css: string,
  options: {
    base: string;
    loadStylesheet: (
      id: string,
      base: string,
    ) => Promise<{ path: string; base: string; content: string }>;
    onWarn?: (message: string) => void;
  },
) => Promise<Compiler>;

const require = createRequire(path.join(process.cwd(), "package.json"));
const tailwindDir = path.dirname(require.resolve("tailwindcss/package.json"));

async function loadStylesheet(id: string, base: string) {
  let file: string;
  if (id === "tailwindcss") file = path.join(tailwindDir, "index.css");
  else if (id.startsWith("tailwindcss/")) {
    const sub = id.slice("tailwindcss/".length);
    file = path.join(tailwindDir, sub.endsWith(".css") ? sub : `${sub}.css`);
  } else file = path.resolve(base, id);
  return { path: file, base: path.dirname(file), content: await readFile(file, "utf8") };
}

let compile: Compile;
beforeAll(async () => {
  ({ compile } = (await import(pathToFileURL(path.join(tailwindDir, "dist/lib.mjs")).href)) as {
    compile: Compile;
  });
});

/** The theme.css of a spec, compiled with the candidates; warnings are collected, not hidden. */
async function build(css: string, candidates: string[]) {
  const warnings: string[] = [];
  const compiler = await compile(`@import "tailwindcss";\n@import "./theme.css";\n`, {
    base: process.cwd(),
    onWarn: (message) => warnings.push(message),
    loadStylesheet: async (id, base) =>
      id === "./theme.css"
        ? { path: path.join(base, "theme.css"), base, content: css }
        : loadStylesheet(id, base),
  });
  return { output: compiler.build(candidates), warnings };
}

/** The declarations of the rule for a class, or `undefined` when none was written. */
function ruleOf(output: string, selector: string): string | undefined {
  const start = output.indexOf(selector);
  if (start < 0) return undefined;
  return output.slice(start, output.indexOf("\n  }", start) + 4);
}

const CANDIDATES = [
  "bg-primary",
  "text-primary-foreground",
  "bg-primary-600",
  "dark:bg-background",
  "text-body",
  "font-heading",
  "font-mono",
  "rounded-lg",
  "shadow-2",
  "ease-standard",
  "p-3",
  "text-white",
];

describe("C-CSS-11 the candidates compile", () => {
  it("yields a rule for each candidate and the documented values", async () => {
    const { output, warnings } = await build(themeCss(SPEC, ORIGIN), CANDIDATES);
    expect(warnings).toEqual([]);
    for (const selector of [
      ".bg-primary ",
      ".text-primary-foreground ",
      ".bg-primary-600 ",
      ".text-body ",
      ".font-heading ",
      ".font-mono ",
      ".rounded-lg ",
      ".shadow-2 ",
      ".ease-standard ",
      ".p-3 ",
      ".text-white ",
    ]) {
      expect(output, selector).toContain(selector);
    }
    expect(ruleOf(output, ".bg-primary ")).toContain("background-color: var(--primary)");
    expect(ruleOf(output, ".p-3 ")).toContain("calc(var(--spacing) * 3)");
    const dark = ruleOf(output, ".dark\\:bg-background");
    expect(dark).toBeDefined();
    expect(output).toMatch(/:is\(\.dark \*\)/);
  });
});

describe("C-CSS-12 Tailwind's palette is gone", () => {
  it("yields no rule for the default colors and declares none", async () => {
    const { output } = await build(themeCss(SPEC, ORIGIN), [
      "bg-blue-500",
      "text-red-600",
      "bg-slate-50",
      "border-zinc-200",
    ]);
    for (const klass of ["bg-blue-500", "text-red-600", "bg-slate-50", "border-zinc-200"]) {
      expect(output, klass).not.toContain(`.${klass}`);
    }
    expect(output).not.toContain("--color-blue-500");
  });
});

describe("C-CSS-13 every golden compiles", () => {
  it.each(GOLDENS.map((g) => [g.id, g.spec] as const))(
    "%s with no warning or error",
    async (_id, spec) => {
      const { output, warnings } = await build(themeCss(spec, ORIGIN), CANDIDATES);
      expect(warnings).toEqual([]);
      expect(output).toContain(".bg-primary ");
    },
  );

  it.todo("IMPORTED's theme writes its overlaid roles (Task 3.7 adds imported-shadcn to GOLDENS)");
});
