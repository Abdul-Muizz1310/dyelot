import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DesignSpecSchema } from "@/spec/schema";
import { z } from "@/spec/zod";
import { defaultSpec } from "./support";

// The production CSP has no 'unsafe-eval', so the spec model must parse without the Function
// constructor (spec 6.7, ruling of Task 1.8). Every schema imports z from src/spec/zod.ts.

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
  it("parses a whole design spec with zero Function-constructor calls", () => {
    const spec = defaultSpec();
    const calls = functionCallsDuring(() => {
      expect(DesignSpecSchema.parse(spec)).toEqual(spec);
      z.object({ fresh: z.string() }).parse({ fresh: "a schema built after import" });
    });
    expect(calls).toBe(0);
  });

  it("is a probe that sees zod's compiled parsers when jitless is off", () => {
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

  it("is the only module under src/ that imports zod itself", () => {
    const root = path.resolve(import.meta.dirname, "../../..");
    const biome = JSON.parse(readFileSync(path.join(root, "biome.json"), "utf8"));
    const rule = biome.linter.rules.style.noRestrictedImports;
    expect(rule.level).toBe("error");
    expect(Object.keys(rule.options.paths)).toEqual(["zod"]);
  });
});
