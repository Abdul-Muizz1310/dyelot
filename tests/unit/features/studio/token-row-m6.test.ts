import { describe, expect, it } from "vitest";
import { tokenRow } from "@/features/studio/token-row";
import type { DesignSpec } from "@/spec";

// C-HYG6-08 of docs/specs/06-gallery.md, section 14 (R6-42): tokenRow checks its shape.

const call = (spec: unknown) => () => tokenRow(spec as DesignSpec, "light", "primary", 500);

describe("tokenRow shape checks (R6-42)", () => {
  it("C-HYG6-08 names the missing path and starts with tokenRow", () => {
    expect(call({})).toThrow(
      new TypeError("tokenRow: spec.color must be an object, got undefined"),
    );
    expect(call({ color: { palettes: {} } })).toThrow(
      new TypeError("tokenRow: spec.color.palettes.primary must be an object, got undefined"),
    );
    expect(call({ color: {} })).toThrow(/^tokenRow: spec\.color\.palettes must be an object/);
    expect(call({ color: { palettes: { primary: {} } } })).toThrow(
      "tokenRow: spec.color.palettes.primary.light must be an array, got undefined",
    );
    expect(call({ color: { palettes: { primary: { light: [] } } } })).toThrow(
      "tokenRow: spec.color.roles must be an object, got undefined",
    );
    expect(call({ color: { palettes: { primary: { light: [] } }, roles: {} } })).toThrow(
      "tokenRow: spec.color.roles.light must be an object, got undefined",
    );
  });
});
