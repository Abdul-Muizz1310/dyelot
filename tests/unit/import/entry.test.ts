import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as entry from "@/import";

// C-ENTRY3-02, the import part (R3-38), and C-GUARD3-05 of docs/specs/03-export.md.

const ROOT = path.resolve(import.meta.dirname, "../../..");
const IMPORT_DIR = path.join(ROOT, "src/import");
const EXPORT_DIR = path.join(ROOT, "src/export");
const ALLOWED = new Set(["sha256", "design-md-tokens"]);

describe("C-ENTRY3-02 the import entry", () => {
  it("exports exactly importDesignMd, importShadcnCss, detectImport and IMPORT_MAX_BYTES", () => {
    expect(Object.keys(entry).sort()).toEqual(
      ["IMPORT_MAX_BYTES", "detectImport", "importDesignMd", "importShadcnCss"].sort(),
    );
    expect(entry.IMPORT_MAX_BYTES).toBe(262_144);
    expect(typeof entry.importDesignMd).toBe("function");
    expect(typeof entry.importShadcnCss).toBe("function");
    expect(typeof entry.detectImport).toBe("function");
  });

  it("types the results through the entry", () => {
    const result: entry.ImportResult = entry.importShadcnCss(":root { --primary: #3a6ea5; }");
    const report: entry.ImportReport | undefined = result.ok ? result.report : undefined;
    const error: entry.ImportError | undefined = result.ok ? undefined : result.error;
    expect(report?.format ?? error).toBe("shadcn-css");
  });
});

/** The modules of src/export that `source`, written in `file`, imports. */
function exportImports(file: string, source: string): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+)["']/g)) {
    const specifier = match[1] as string;
    let resolved: string | null = null;
    if (/^@\/export(\/|$)/.test(specifier)) {
      resolved = path.join(EXPORT_DIR, specifier.slice("@/export".length));
    } else if (specifier.startsWith(".")) {
      resolved = path.resolve(path.dirname(file), specifier);
    }
    if (resolved === null) continue;
    if (resolved !== EXPORT_DIR && !resolved.startsWith(EXPORT_DIR + path.sep)) continue;
    found.push(path.basename(resolved));
  }
  return found;
}

function offenders(file: string, source: string): string[] {
  return exportImports(file, source).filter((name) => !ALLOWED.has(name));
}

describe("C-GUARD3-05 src/import reaches src/export only for sha256 and design-md-tokens", () => {
  const files = readdirSync(IMPORT_DIR, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.ts$/.test(entry.name))
    .map((entry) => path.join(entry.parentPath, entry.name));

  it("finds no other import from src/export", () => {
    expect(files.length).toBeGreaterThan(0);
    const bad = files.flatMap((file) =>
      offenders(file, readFileSync(file, "utf8")).map((name) => `${path.basename(file)}: ${name}`),
    );
    expect(bad).toEqual([]);
  });

  it("reports a probe that imports ../export/zip", () => {
    const file = path.join(IMPORT_DIR, "probe.ts");
    expect(offenders(file, 'import { zipBundle } from "../export/zip";')).toEqual(["zip"]);
    expect(offenders(file, 'import { zipBundle } from "@/export/zip";')).toEqual(["zip"]);
    expect(offenders(file, 'const x = await import("../export/index");')).toEqual(["index"]);
    expect(offenders(file, 'import { sha256 } from "@/export/sha256";')).toEqual([]);
    expect(offenders(file, 'import { x } from "../export/design-md-tokens";')).toEqual([]);
    expect(offenders(file, 'import { x } from "./build";')).toEqual([]);
  });
});
