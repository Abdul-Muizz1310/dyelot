import { readdirSync } from "node:fs";
import path from "node:path";

// The helpers the repository guards share (R5 preflight rulings 14 and 16): moved unchanged from
// repo-guards.test.ts so the M5 guards import them rather than copy them.

export const ROOT = path.resolve(import.meta.dirname, "../../..");
export const ENGINE_DIR = path.join(ROOT, "src/engine");
export const SPEC_DIR = path.join(ROOT, "src/spec");
export const THEME_DIR = path.join(ROOT, "src/theme");
const CODE_FILE = /\.[cm]?[jt]sx?$/;

/**
 * A folder the Biome probes of tests/unit/engine/entry.test.ts write under src for a moment and
 * remove: a file listed while it exists may be gone by the time a guard reads it, so no walk
 * lists it.
 */
export const PROBE_DIR = "__entry-probe__";
export const inProbe = (file: string): boolean => file.split(path.sep).includes(PROBE_DIR);

/** Every code file under `directory`, or none when the folder does not exist yet. */
export function codeFiles(directory: string): string[] {
  try {
    return readdirSync(directory, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && CODE_FILE.test(entry.name))
      .map((entry) => path.join(entry.parentPath, entry.name))
      .filter((file) => !inProbe(file));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

/**
 * Removes `//` and block comments so a comment that names a forbidden API cannot trip a grep.
 * String and template literals pass through untouched, so a `//` inside "https://…" does not
 * hide the code after it.
 */
export function stripComments(source: string): string {
  let out = "";
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    const next = source[i + 1];
    if (char === "/" && next === "/") {
      while (i < source.length && source[i] !== "\n") i++;
    } else if (char === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2);
      i = end === -1 ? source.length : end + 2;
      out += " ";
    } else if (char === '"' || char === "'" || char === "`") {
      out += char;
      i++;
      while (i < source.length && source[i] !== char) {
        out += source[i];
        if (source[i] === "\\") {
          i++;
          out += source[i] ?? "";
        }
        i++;
      }
      out += source[i] ?? "";
      i++;
    } else {
      out += char;
      i++;
    }
  }
  return out;
}

// The patterns of C-REPO-01, with the controller's two refinements: `new Date` tolerates any
// whitespace, and a bare `Date(` call counts as well.
export const FORBIDDEN: ReadonlyArray<readonly [name: string, pattern: RegExp]> = [
  ["Math.random", /Math\.random/],
  ["new Date", /\bnew\s+Date\b/],
  ["Date call", /\bDate\s*\(/],
  ["Date.now, Date.parse or Date.UTC", /\bDate\.(?:now|parse|UTC)\b/],
  ["window.", /\bwindow\./],
  ["document.", /\bdocument\./],
  ["navigator.", /\bnavigator\./],
  ["web storage", /\b(?:localStorage|sessionStorage|indexedDB)\b/],
  ["process", /\bprocess\.(?:env|argv|cwd|exit|platform)\b/],
  ["Buffer", /\bBuffer\.(?:from|alloc)\b/],
  ["require", /\brequire\(/],
];
