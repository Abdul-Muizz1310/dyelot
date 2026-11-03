import { describe, expect, it } from "vitest";
import { lintSpec } from "@/engine/lint";
import type { DesignSpec } from "@/spec/schema";
import { defaultSpec } from "../../spec/support";
import { copyOf, loose } from "./support";

// R-05 checks of lintSpec (Task 2.4, spec C-ENTRY-14 and C-ENTRY-15): a wrong type is a TypeError,
// an out-of-domain value a RangeError, and every message names `lintSpec`.

describe("lintSpec input checks", () => {
  it("throws TypeError for a spec that is not an object or has no color section", () => {
    for (const bad of [null, undefined, 3, "x", []]) {
      expect(() => lintSpec(bad as never)).toThrow(TypeError);
      expect(() => lintSpec(bad as never)).toThrow(/^lintSpec:/);
    }
    expect(() => lintSpec({} as never)).toThrow(/^lintSpec: spec\.color/);
    expect(() => lintSpec({ color: null } as never)).toThrow(TypeError);
  });

  it("throws TypeError for a null or missing palette", () => {
    for (const mutate of [
      (spec: DesignSpec) => {
        delete loose(spec).color.palettes.info;
      },
      (spec: DesignSpec) => {
        loose(spec).color.palettes.neutral = null;
      },
      (spec: DesignSpec) => {
        loose(spec).color.palettes = null;
      },
    ]) {
      const spec = copyOf();
      mutate(spec);
      expect(() => lintSpec(spec)).toThrow(TypeError);
      expect(() => lintSpec(spec)).toThrow(/^lintSpec:/);
    }
  });

  it("throws TypeError for a scale that does not hold 11 steps", () => {
    for (const mode of ["light", "dark"] as const) {
      const spec = copyOf();
      loose(spec).color.palettes.primary[mode] = spec.color.palettes.primary[mode].slice(1);
      expect(() => lintSpec(spec)).toThrow(TypeError);
      expect(() => lintSpec(spec)).toThrow(/^lintSpec: spec\.color\.palettes\.primary\./);
    }
    const notArray = copyOf();
    loose(notArray).color.palettes.accent.light = {};
    expect(() => lintSpec(notArray)).toThrow(TypeError);
  });

  it("throws an error starting lintSpec: for a role that is not a hex", () => {
    for (const bad of ["#FFF", "red", "#12345", "#ABCDEF"]) {
      const spec = copyOf();
      loose(spec).color.roles.light.primary = bad;
      expect(() => lintSpec(spec)).toThrow(RangeError);
      expect(() => lintSpec(spec)).toThrow(/^lintSpec: spec\.color\.roles\.light\.primary/);
    }
    const nonString = copyOf();
    loose(nonString).color.roles.dark.ring = 5;
    expect(() => lintSpec(nonString)).toThrow(TypeError);
    const missing = copyOf();
    delete loose(missing).color.roles.dark.ring;
    expect(() => lintSpec(missing)).toThrow(/^lintSpec:/);
    const noMode = copyOf();
    delete loose(noMode).color.roles.dark;
    expect(() => lintSpec(noMode)).toThrow(TypeError);
  });

  it("throws TypeError for missing color params, a null step and a bad catalog", () => {
    const noParams = copyOf();
    delete loose(noParams).color.params;
    expect(() => lintSpec(noParams)).toThrow(TypeError);
    expect(() => lintSpec(noParams)).toThrow(/^lintSpec: spec\.color\.params/);
    const nullParams = copyOf();
    loose(nullParams).color.params = null;
    expect(() => lintSpec(nullParams)).toThrow(/^lintSpec: spec\.color\.params/);
    const nullStep = copyOf();
    loose(nullStep).color.palettes.primary.light[3] = null;
    expect(() => lintSpec(nullStep)).toThrow(TypeError);
    expect(() => lintSpec(nullStep)).toThrow(
      /^lintSpec: spec\.color\.palettes\.primary\.light\[3\]/,
    );
    expect(() => lintSpec(defaultSpec(), { catalog: [null as never] })).toThrow(TypeError);
    expect(() => lintSpec(defaultSpec(), { catalog: [null as never] })).toThrow(/^lintSpec:/);
    expect(() => lintSpec(defaultSpec(), { catalog: "x" as never })).toThrow(/^lintSpec:/);
  });

  it("accepts the base spec", () => {
    expect(() => lintSpec(defaultSpec())).not.toThrow();
  });
});
