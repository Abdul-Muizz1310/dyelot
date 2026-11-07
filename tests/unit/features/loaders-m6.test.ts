import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { importsOf } from "../engine/guard-support";

// C-HYG6-04 of docs/specs/06-gallery.md, section 14 (R6-40).

const ROOT = path.join(import.meta.dirname, "../../..");
const LOADERS = [
  ["src/features/ai/load.ts", "loadAi", "@/ai"],
  ["src/features/export/useBundle.ts", "loadExport", "@/export"],
  ["src/features/import/ImportDialog.tsx", "loadImport", "@/import"],
] as const;

describe("the three loaders (R6-40)", () => {
  it.each(LOADERS)("C-HYG6-04 %s defines %s as loadOnce(() => import(%s))", (file, name, entry) => {
    const text = readFileSync(path.join(ROOT, file), "utf8");
    expect(text).toMatch(
      new RegExp(
        `(?:export )?const ${name} = loadOnce\\(\\(\\) =>\\s*import\\("${entry.replace("/", "\\/")}"\\)\\s*\\)`,
      ),
    );
    expect(text).not.toMatch(/loading \?\?=/);
    expect(importsOf(file, text).some((i) => i.dynamic && i.specifier === entry)).toBe(true);
    expect(importsOf(file, text).some((i) => i.specifier === "@/lib/load-once")).toBe(true);
  });
});
