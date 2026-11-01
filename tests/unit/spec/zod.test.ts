import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DesignSpecSchema } from "@/spec/schema";
import { z } from "@/spec/zod";
import { defaultSpec } from "./support";

// The production CSP has no 'unsafe-eval', so the spec model must parse without the Function
// constructor (spec 6.7, ruling of Task 1.8). Every schema imports z from src/spec/zod.ts.

const ROOT = path.resolve(import.meta.dirname, "../../..");
/** An import of the bare "zod" package, static or dynamic. */
const IMPORTS_ZOD = /(?:\bfrom\s*|\bimport\s*\(\s*)["']zod["']/;

/** Runs `work` with the global Function constructor replaced by a counting proxy. */
function functionCallsDuring(work: () => void): number {
  const original = globalThis.Function;
  let calls = 0;
  globalThis.Function = new Proxy(original, {
    apply(target, self, args) {
      calls += 1;
      return Reflect.apply(target, self, args);
    },
    construct(target, args, newTarget) {
      calls += 1;
      return Reflect.construct(target, args, newTarget);
    },
  });
  try {
    work();
  } finally {
    globalThis.Function = original;
  }
  return calls;
}

describe("the shared zod instance", () => {
  it("C-URL-17 parses a whole design spec with zero Function-constructor calls", () => {
    const spec = defaultSpec();
    let parsed: unknown;
    let fresh: unknown;
    // Only the parsing runs inside the window; vitest's own expect stays outside it.
    const calls = functionCallsDuring(() => {
      parsed = DesignSpecSchema.parse(spec);
      fresh = z.object({ fresh: z.string() }).parse({ fresh: "a schema built after import" });
    });
    expect(calls).toBe(0);
    expect(parsed).toEqual(spec);
    expect(fresh).toEqual({ fresh: "a schema built after import" });
  });

  it("C-URL-17 is a probe that sees zod's compiled parsers when jitless is off", () => {
    z.config({ jitless: false });
    try {
      const calls = functionCallsDuring(() => {
        z.object({ probe: z.number() }).parse({ probe: 1 });
      });
      expect(calls).toBeGreaterThan(0);
    } finally {
      z.config({ jitless: true });
    }
  });

  it("C-URL-17 is the only module under src/ that imports zod itself", () => {
    const src = path.join(ROOT, "src");
    const files = readdirSync(src, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.[cm]?[jt]sx?$/.test(entry.name))
      .map((entry) => path.join(entry.parentPath, entry.name));
    // The scan must reach real files, or it would pass by looking at nothing.
    expect(files).toContain(path.join(src, "spec/schema.ts"));
    const importers = files
      .filter((file) => IMPORTS_ZOD.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(ROOT, file));
    expect(importers).toEqual(["src/spec/zod.ts"]);
  });

  it("C-URL-17 recognizes an import of zod however it is written", () => {
    for (const text of [
      'import { z } from "zod";',
      "import * as z from 'zod'",
      'await import("zod")',
    ]) {
      expect(IMPORTS_ZOD.test(text), text).toBe(true);
    }
    for (const text of ['import { z } from "./zod";', 'import x from "zod-mini"', "// zod"]) {
      expect(IMPORTS_ZOD.test(text), text).toBe(false);
    }
  });

  it("C-URL-17 restricts the zod import path in biome.json, so the linter refuses a new one", () => {
    const biome = JSON.parse(readFileSync(path.join(ROOT, "biome.json"), "utf8"));
    const rule = biome.linter.rules.style.noRestrictedImports;
    expect(rule.level).toBe("error");
    expect(Object.keys(rule.options.paths)).toEqual(["zod"]);
  });
});
