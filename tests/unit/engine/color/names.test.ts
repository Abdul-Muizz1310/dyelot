import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hexToRgb, rgbToOklch } from "@/engine/color/convert";
import { indexNames, nearestName } from "@/engine/color/names";
import { parseColor } from "@/engine/color/parse";
import type { Hex, Oklch } from "@/engine/color/types";

// Cases are the C-NAME-nn rows of docs/specs/02-studio.md, section 6.5 (Task 2.4).

const ROOT = path.resolve(import.meta.dirname, "../../../..");
const LIST = [
  { name: "Madder", hex: "#f66c6d" },
  { name: "Fern", hex: "#4f7942" },
  { name: "Slate", hex: "#708090" },
  { name: "Ink", hex: "#101820" },
  { name: "Bone", hex: "#e3dac9" },
];
const colorOf = (hex: string): Oklch => rgbToOklch(hexToRgb(hex as Hex), "srgb");

describe("nearestName", () => {
  const index = indexNames(LIST);

  it("C-NAME-01 returns the exact entry for a color in the list", () => {
    for (const entry of LIST) {
      expect(nearestName(colorOf(entry.hex), index)).toEqual({ ...entry, deltaEOK: 0 });
    }
  });

  it("C-NAME-02 gives the same name one hex code away, within 0.005", () => {
    const near = nearestName(colorOf("#f66c6e"), index);
    expect(near.name).toBe("Madder");
    expect(near.deltaEOK).toBeGreaterThan(0);
    expect(near.deltaEOK).toBeLessThan(0.005);
  });

  it("C-NAME-03 keeps the earlier entry on a tie", () => {
    const tied = indexNames([
      { name: "First", hex: "#336699" },
      { name: "Second", hex: "#336699" },
    ]);
    expect(nearestName(colorOf("#336699"), tied).name).toBe("First");
    const reversed = indexNames([
      { name: "Second", hex: "#336699" },
      { name: "First", hex: "#336699" },
    ]);
    expect(nearestName(colorOf("#336699"), reversed).name).toBe("Second");
  });

  it("C-NAME-04 finds a name for an achromatic color", () => {
    const result = nearestName({ l: 0.55, c: 0, h: null }, index);
    expect(result.name).toBe("Slate");
    expect(Number.isFinite(result.deltaEOK)).toBe(true);
  });

  it("C-NAME-06 accepts the real bestof list", async () => {
    const { colornames } = await import("color-name-list/bestof");
    expect(colornames.length).toBeGreaterThan(1000);
    for (const entry of colornames) {
      expect(entry.name.length).toBeGreaterThan(0);
      expect(entry.hex).toMatch(/^#[0-9a-f]{6}$/);
    }
    const real = indexNames(colornames);
    const sample = colornames[123] as { name: string; hex: string };
    expect(nearestName(colorOf(sample.hex), real).deltaEOK).toBe(0);
  });
});

describe("indexNames", () => {
  it("C-NAME-05 returns a frozen index and leaves the list alone", () => {
    const list = Object.freeze(LIST.map((entry) => Object.freeze({ ...entry })));
    const copy = structuredClone(LIST);
    const index = indexNames(list);
    expect(Object.isFrozen(index)).toBe(true);
    expect(list).toEqual(copy);
  });

  it("C-NAME-08 rejects an empty list, a bad hex and a non-array", () => {
    expect(() => indexNames([])).toThrow(RangeError);
    expect(() => indexNames([])).toThrow(/^indexNames:/);
    expect(() => indexNames([LIST[0] as never, { name: "Bad", hex: "#FFF" }])).toThrow(RangeError);
    expect(() => indexNames([LIST[0] as never, { name: "Bad", hex: "#FFF" }])).toThrow(
      /^indexNames: .*\[1\]/,
    );
    expect(() => indexNames("x" as never)).toThrow(TypeError);
    expect(() => indexNames(null as never)).toThrow(/^indexNames:/);
    expect(() => indexNames([null as never])).toThrow(TypeError);
    expect(() => indexNames([{ name: "", hex: "#336699" }])).toThrow(RangeError);
    expect(() => indexNames([{ name: 3 as never, hex: "#336699" }])).toThrow(TypeError);
  });

  it("C-NAME-09 rejects a color that is not an Oklch", () => {
    const index = indexNames(LIST);
    expect(() => nearestName("#fff" as never, index)).toThrow(TypeError);
    expect(() => nearestName("#fff" as never, index)).toThrow(/^nearestName:/);
    expect(() => nearestName({ c: 0.1, h: 10 } as never, index)).toThrow(TypeError);
    expect(() => nearestName({ l: Number.NaN, c: 0.1, h: 10 }, index)).toThrow(RangeError);
    expect(() => nearestName(parseColor("#336699"), null as never)).toThrow(TypeError);
  });
});

/** A static import or re-export of the list: `import x from`, a multi-line `{ … } from`, or a bare `import "…"`. */
const STATIC_IMPORT =
  /(^|[;\n])\s*(import|export)\s+(?:[^"';()]*?\bfrom\s*)?["']color-name-list|(^|[;\n])\s*import\s*["']color-name-list/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory()
      ? sourceFiles(full)
      : /\.(ts|tsx|css)$/.test(entry)
        ? [full]
        : [];
  });
}

describe("the list stays out of the engine", () => {
  it("C-NAME-07 static-import pattern catches every static form and no dynamic one", () => {
    for (const bad of [
      'import { colornames } from "color-name-list/bestof";',
      'import {\n  colornames,\n  other,\n} from "color-name-list";',
      'import "color-name-list/bestof";',
      'import type { ColorName } from "color-name-list";',
      'export { colornames } from "color-name-list/bestof";',
      "import x from 'color-name-list';",
    ]) {
      expect(bad, bad).toMatch(STATIC_IMPORT);
    }
    expect('const m = await import("color-name-list/bestof");').not.toMatch(STATIC_IMPORT);
  });

  it("C-NAME-07 names color-name-list only in src/features/studio/names.ts, in a dynamic import", () => {
    const allowed = path.join(ROOT, "src/features/studio/names.ts");
    const naming = sourceFiles(path.join(ROOT, "src")).filter((file) =>
      readFileSync(file, "utf8").includes("color-name-list"),
    );
    expect(naming.filter((file) => file !== allowed)).toEqual([]);
    for (const file of naming) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(STATIC_IMPORT);
      expect(source).toMatch(/import\(\s*["']color-name-list/);
    }
    const names = readFileSync(path.join(ROOT, "src/engine/color/names.ts"), "utf8");
    expect(names).not.toContain("color-name-list");
  });
});
