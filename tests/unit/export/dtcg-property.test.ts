import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { generateSystem } from "@/engine";
import { anyDirection, anySeedText, PROPERTY_TIMEOUT } from "../spec/support";
import { type Json, PATHS, parsed, walk } from "./dtcg-support";
import { formatValidator, resolverValidator } from "./schema-support";

// C-DTCG-14 of docs/specs/03-export.md, section 10.5 (R3-17): the slow property.

describe("C-DTCG-14 property", () => {
  it(
    "every file validates and every value is finite and in range",
    () => {
      const format = formatValidator();
      const resolver = resolverValidator();
      fc.assert(
        fc.property(anyDirection, anySeedText, (params, seed) => {
          const spec = generateSystem(params, seed);
          const files = parsed(spec);
          for (const path of PATHS.slice(0, 3)) expect(format(files[path])).toBe(true);
          expect(resolver(files["tokens/design.resolver.json"])).toBe(true);
          // A name may hold "NaN" as text, so the check skips descriptions; NaN would read as null.
          const values = JSON.stringify(files, (key, v) =>
            key === "$description" || key === "description" ? "" : v,
          );
          expect(values).not.toMatch(/NaN|Infinity|null/);
          for (const path of PATHS.slice(1, 3)) {
            for (const token of walk(files[path] as Json).tokens) {
              const value = token.node.$value as { components: (number | string)[]; hex: string };
              expect(value.hex).toMatch(/^#[0-9a-f]{6}$/);
              const [l, c, h] = value.components as [number, number, number | string];
              expect(l).toBeGreaterThanOrEqual(0);
              expect(l).toBeLessThanOrEqual(1);
              expect(c).toBeGreaterThanOrEqual(0);
              if (h !== "none") {
                expect(h).toBeGreaterThanOrEqual(0);
                expect(h).toBeLessThan(360);
              }
            }
          }
        }),
        { numRuns: 1000, seed: 3007 },
      );
    },
    PROPERTY_TIMEOUT,
  );
});
