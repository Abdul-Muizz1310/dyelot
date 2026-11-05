import { decode, encode } from "@toon-format/toon";
import { describe, expect, it } from "vitest";
import { PALETTE_NAMES, ROLE_NAMES, STEPS } from "@/engine";
import { themeModel } from "@/export/model";
import { toonFile } from "@/export/toon";
import type { DesignSpec } from "@/spec";
import { GOLDENS, SPEC } from "./golden-support";

// C-TOON-01 to 06 of docs/specs/03-export.md, section 10.5 (R3-19, 6.6).

function sourceOf(spec: DesignSpec) {
  const model = themeModel(spec);
  const scales = PALETTE_NAMES.flatMap((palette) =>
    (["light", "dark"] as const).map((mode) => ({
      palette,
      mode,
      ...Object.fromEntries(
        STEPS.map((step) => [
          `s${step}`,
          model.steps.find((s) => s.name === `${palette}-${step}`)?.[mode],
        ]),
      ),
    })),
  );
  const roles = model.roles.map((r) => ({ role: r.name, light: r.light, dark: r.dark }));
  return { scales, roles };
}

describe("C-TOON-01 the file", () => {
  it("is encode of the source, byte for byte, with no trailing newline", () => {
    const file = toonFile(SPEC);
    expect(file.path).toBe("design.toon");
    expect(file.text).toBe(encode(sourceOf(SPEC)));
    expect(file.text.endsWith("\n")).toBe(false);
  });
});

describe("C-TOON-02 the scales table", () => {
  it("has the header and 16 rows, palette by palette, light then dark", () => {
    const lines = toonFile(SPEC).text.split("\n");
    expect(lines[0]).toBe(
      "scales[16]{palette,mode,s50,s100,s200,s300,s400,s500,s600,s700,s800,s900,s950}:",
    );
    const model = themeModel(SPEC);
    const rows = lines.slice(1, 17).map((line) => line.trim());
    let i = 0;
    for (const palette of PALETTE_NAMES) {
      for (const mode of ["light", "dark"] as const) {
        const hexes = STEPS.map(
          (step) => `"${model.steps.find((s) => s.name === `${palette}-${step}`)?.[mode]}"`,
        );
        expect(rows[i++]).toBe([palette, mode, ...hexes].join(","));
      }
    }
  });
});

describe("C-TOON-03 the roles table", () => {
  it("has the header and the rows in ROLE_NAMES order", () => {
    const lines = toonFile(SPEC).text.split("\n");
    const at = lines.indexOf("roles[46]{role,light,dark}:");
    expect(at).toBe(17);
    const model = themeModel(SPEC);
    ROLE_NAMES.forEach((role, index) => {
      const r = model.roles[index];
      expect(lines[at + 1 + index]?.trim()).toBe(`${role},"${r?.light}","${r?.dark}"`);
    });
    expect(lines).toHaveLength(at + 1 + 46);
  });
});

describe("C-TOON-04 round trip", () => {
  it.each(GOLDENS.map((g) => [g.id, g.spec] as const))("%s", (_id, spec) => {
    expect(decode(toonFile(spec).text, { strict: true })).toEqual(sourceOf(spec));
  });
});

describe("C-TOON-05 quoting and keys", () => {
  it("quotes every hex, has no integer-like row key, and repeats", () => {
    const { text } = toonFile(SPEC);
    expect(text.match(/#[0-9a-f]{6}/g)).toHaveLength(16 * 11 + 46 * 2);
    expect(text.match(/"#[0-9a-f]{6}"/g)).toHaveLength(16 * 11 + 46 * 2);
    const decoded = decode(text) as { scales: Record<string, unknown>[] };
    for (const row of decoded.scales) {
      for (const key of Object.keys(row)) expect(key).not.toMatch(/^\d+$/);
    }
    expect(toonFile(SPEC)).toEqual(toonFile(SPEC));
  });
});

describe("C-TOON-06 inputs", () => {
  it("throws a TypeError naming toonFile for a null spec", () => {
    expect(() => toonFile(null as never)).toThrow(TypeError);
    expect(() => toonFile(null as never)).toThrow(/toonFile/);
  });
  it("throws a RangeError naming toonFile and the role for a bad hex", () => {
    const bad = structuredClone(SPEC) as DesignSpec;
    (bad.color.roles.light as Record<string, string>).primary = "#FFF";
    expect(() => toonFile(bad)).toThrow(RangeError);
    expect(() => toonFile(bad)).toThrow(/toonFile.*primary/);
  });
});
