import { describe, expect, it } from "vitest";
import { formatOklch, PALETTE_NAMES, ROLE_NAMES, STEPS } from "@/engine";
import { themeCss } from "@/export/theme-css";
import { swatchName, tokenRow } from "@/features/studio/token-row";
import { ORIGIN, SPEC } from "../../export/golden-support";

// Cases C-VT-03, C-VT-04, C-VT-05 and C-VT-09 (swatchName's half) of docs/specs/05-motion-3d.md,
// section 14 (ruling R5-47, section 5.4).

describe("tokenRow", () => {
  it("C-VT-03 gives the token, class, variable, hex, OKLCH, contrast and roles of a step", () => {
    const step = SPEC.color.palettes.primary.light.find((s) => s.step === 500);
    if (step === undefined) throw new Error("no primary 500");
    const row = tokenRow(SPEC, "light", "primary", 500);
    expect(row.token).toBe("--color-primary-500");
    expect(row.utility).toBe("bg-primary-500");
    expect(row.cssVar).toBe("var(--primary-500)");
    expect(row.hex).toBe(step.hex);
    expect(row.oklch).toBe(formatOklch(step.oklch));
    expect(row.contrast).toBe(`${step.contrast.toFixed(2)}:1`);
    expect(row.roles).toEqual(
      ROLE_NAMES.filter((role) => SPEC.color.roles.light[role] === step.hex),
    );
  });

  it("C-VT-03 lists the roles in ROLE_NAMES order and gives [] for a step no role uses", () => {
    let used = 0;
    let unused = 0;
    for (const palette of PALETTE_NAMES) {
      for (const step of STEPS) {
        const { roles } = tokenRow(SPEC, "dark", palette, step);
        const order = roles.map((role) => ROLE_NAMES.indexOf(role));
        expect(order).toEqual([...order].sort((a, b) => a - b));
        if (roles.length > 0) used += 1;
        else unused += 1;
      }
    }
    expect(used).toBeGreaterThan(0);
    expect(unused).toBeGreaterThan(0);
  });

  it("C-VT-03 reads the shown mode's role hexes", () => {
    const light = tokenRow(SPEC, "light", "primary", 500);
    const dark = tokenRow(SPEC, "dark", "primary", 500);
    const darkStep = SPEC.color.palettes.primary.dark.find((s) => s.step === 500);
    expect(dark.hex).toBe(darkStep?.hex);
    expect(light.roles).toEqual(
      ROLE_NAMES.filter((role) => SPEC.color.roles.light[role] === light.hex),
    );
  });

  it("C-VT-03 names a variable that themeCss declares in :root and .dark", () => {
    const css = themeCss(SPEC, ORIGIN);
    const name = tokenRow(SPEC, "light", "primary", 500).cssVar.slice("var(".length, -1);
    expect(name).toBe("--primary-500");
    const root = css.slice(css.indexOf(":root"), css.indexOf(".dark {"));
    const dark = css.slice(css.indexOf(".dark {"), css.indexOf("@theme inline"));
    expect(root).toContain(`${name}:`);
    expect(dark).toContain(`${name}:`);
  });

  it("C-VT-04 throws RangeError for another mode, palette or step, naming tokenRow", () => {
    for (const call of [
      () => tokenRow(SPEC, "dim" as never, "primary", 500),
      () => tokenRow(SPEC, "light", "teal" as never, 500),
      () => tokenRow(SPEC, "light", "primary", 450 as never),
    ]) {
      expect(call).toThrow(RangeError);
      expect(call).toThrow(/^tokenRow/);
    }
  });

  it("C-VT-04 throws RangeError for a spec whose palette lacks the step", () => {
    const gutted = {
      color: { palettes: { primary: { light: [], dark: [] } }, roles: { light: {}, dark: {} } },
    } as never;
    expect(() => tokenRow(gutted, "light", "primary", 500)).toThrow(RangeError);
  });

  it("C-VT-04 throws TypeError for a wrong type, checked before any domain", () => {
    for (const call of [
      () => tokenRow(null as never, "light", "primary", 500),
      () => tokenRow(SPEC, 5 as never, "primary", 500),
      () => tokenRow(SPEC, "light", 5 as never, 500),
      () => tokenRow(SPEC, "light", "primary", "500" as never),
      () => tokenRow(SPEC, "dim" as never, "teal" as never, "x" as never),
    ]) {
      expect(call).toThrow(TypeError);
      expect(call).toThrow(/^tokenRow/);
    }
  });
});

describe("swatchName", () => {
  it("C-VT-05 is dyelot-swatch-<palette>-<step>, distinct for all 88", () => {
    expect(swatchName("primary", 500)).toBe("dyelot-swatch-primary-500");
    const names = PALETTE_NAMES.flatMap((palette) =>
      STEPS.map((step) => swatchName(palette, step)),
    );
    expect(names).toHaveLength(88);
    expect(new Set(names).size).toBe(88);
  });

  it("C-VT-09 swatchName throws TypeError for a wrong type and RangeError for another palette or step", () => {
    expect(() => swatchName(5 as never, 500)).toThrow(TypeError);
    expect(() => swatchName("primary", "500" as never)).toThrow(TypeError);
    expect(() => swatchName("teal" as never, 500)).toThrow(RangeError);
    expect(() => swatchName("primary", 450 as never)).toThrow(RangeError);
    for (const call of [
      () => swatchName(5 as never, 500),
      () => swatchName("teal" as never, 500),
      () => swatchName("primary", 450 as never),
    ]) {
      expect(call).toThrow(/^swatchName/);
    }
  });
});
