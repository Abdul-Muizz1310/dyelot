import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { flavorFiles } from "@/export/flavor";
import { receiptJson } from "@/export/receipt";
import { themeCss } from "@/export/theme-css";
import type { BundleFile } from "@/export/types";
import { ORIGIN, SPEC } from "./golden-support";

// `STUB_FILES` of docs/specs/03-export.md, section 4: the 20 paths of a 21-file bundle other than
// `receipt.json`, each with the text `"stub <path>\n"`, except `app/theme.css`, which holds the real
// CSS so the checker's hash check holds. The receipt can be tested before the bundle exists.

// Three font items, as a design with three distinct loadable families has (section 4).
const FONT_IDS = ["inter", "lora", "jetbrains-mono"];

const PATHS: readonly string[] = [
  "DESIGN.md",
  "AGENTS.md.snippet",
  "prompt.md",
  "app/theme.css",
  "registry/untitled.json",
  ...FONT_IDS.map((id) => `registry/font-${id}.json`),
  "tokens/base.tokens.json",
  "tokens/light.tokens.json",
  "tokens/dark.tokens.json",
  "tokens/design.resolver.json",
  "tokens/figma/light.tokens.json",
  "tokens/figma/dark.tokens.json",
  "design.toon",
  "motion/motion.css",
  "motion/motion.ts",
  "motion/gsap.ts",
  "skills/untitled-design/SKILL.md",
  "scripts/dyelot-check.mjs",
];

export const STUB_FILES: readonly BundleFile[] = PATHS.map((path) => ({
  path,
  text: path === "app/theme.css" ? themeCss(SPEC, ORIGIN) : `stub ${path}\n`,
}));

// `APP` and `SHADCN_APP` of section 4: a fresh temporary folder per call, removed after the file's
// tests. `files` maps a path to its text, or to `null` to delete a file the scaffold wrote.

export type AppFiles = Readonly<Record<string, string | null>>;

const FOLDERS: string[] = [];

function readFixtureText(relative: string): string {
  return readFileSync(path.join(process.cwd(), relative), "utf8");
}

function put(dir: string, files: AppFiles): void {
  for (const [relative, text] of Object.entries(files)) {
    const target = path.join(dir, relative);
    if (text === null) {
      rmSync(target, { force: true });
      continue;
    }
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, text);
  }
}

function freshFolder(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "dyelot-check-"));
  FOLDERS.push(dir);
  return dir;
}

function writeBundle(dir: string): void {
  const files: Record<string, string> = { "receipt.json": receiptJson(SPEC, STUB_FILES, ORIGIN) };
  for (const file of STUB_FILES) files[file.path] = file.text;
  put(dir, files);
}

/** `app/theme.css`, `app/globals.css` importing it, the stub bundle's files and `receipt.json`. */
export function APP(files: AppFiles = {}): string {
  const dir = freshFolder();
  writeBundle(dir);
  put(dir, { "app/globals.css": '@import "./theme.css";\n', ...files });
  return dir;
}

/** shadcn's scaffold: its full `globals.css`, `components.json`, `button.tsx`, then the bundle. */
export function SHADCN_APP(files: AppFiles = {}): string {
  const dir = freshFolder();
  writeBundle(dir);
  put(dir, {
    "app/globals.css": readFixtureText("tests/fixtures/import/shadcn-neutral.css"),
    "components.json": JSON.stringify(
      {
        $schema: "https://ui.shadcn.com/schema.json",
        style: "new-york",
        rsc: true,
        tsx: true,
        tailwind: {
          config: "",
          css: "app/globals.css",
          baseColor: "neutral",
          cssVariables: true,
          prefix: "",
        },
        aliases: {
          components: "@/components",
          utils: "@/lib/utils",
          ui: "@/components/ui",
          lib: "@/lib",
          hooks: "@/hooks",
        },
        iconLibrary: "lucide",
      },
      null,
      2,
    ),
    "components/ui/button.tsx": readFixtureText("tests/fixtures/shadcn/button.tsx.txt"),
    ...files,
  });
  return dir;
}

/** The four flavor files R5-26 moves into `src/components/`, outside the checker's own set. */
const MOVED: readonly (readonly [bundlePath: string, moved: string])[] = [
  ["flavor/flavor.mjs", "src/components/flavor.mjs"],
  ["flavor/flavor-react.tsx", "src/components/flavor-react.tsx"],
  ["flavor/flavor.css", "src/components/flavor.css"],
  ["flavor/remotion/brand-intro.tsx", "src/components/brand-intro.tsx"],
];

/** `FLAVOR_APP` of docs/specs/05-motion-3d.md, section 4: `APP()` with the nine flavor files at their paths (listed in the receipt) and four moved copies. */
export function FLAVOR_APP(files: AppFiles = {}): string {
  const flavor = flavorFiles(SPEC, ORIGIN);
  const dir = freshFolder();
  const listed = [...STUB_FILES, ...flavor];
  const written: Record<string, string> = { "receipt.json": receiptJson(SPEC, listed, ORIGIN) };
  for (const file of listed) written[file.path] = file.text;
  for (const [from, to] of MOVED) {
    written[to] = (flavor.find((file) => file.path === from) as { text: string }).text;
  }
  put(dir, { ...written, "app/globals.css": '@import "./theme.css";\n', ...files });
  return dir;
}

/** Removes every folder `APP` and `SHADCN_APP` made; call it from `afterAll`. */
export function cleanFolders(): void {
  for (const dir of FOLDERS.splice(0)) rmSync(dir, { recursive: true, force: true });
}
