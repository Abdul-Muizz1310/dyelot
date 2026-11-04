import { describe, expect, it } from "vitest";
import { type Hex, hexToRgb, round6 } from "@/engine";
import { figmaFiles } from "@/export/figma";
import { themeModel } from "@/export/model";
import type { DesignSpec } from "@/spec";
import { GOLDENS, SPEC } from "./golden-support";
import { formatValidator } from "./schema-support";

// C-FIG-01 to 06 of docs/specs/03-export.md, section 10.5 (R3-18, 6.5).

type Json = Record<string, unknown>;
type Token = { path: string[]; node: Json };
const NAME = "Test Design";
const PATHS = ["tokens/figma/light.tokens.json", "tokens/figma/dark.tokens.json"];

function parsed(spec: DesignSpec = SPEC): Json[] {
  return figmaFiles(spec, NAME).map((f) => JSON.parse(f.text) as Json);
}
function tokens(node: Json, trail: string[] = [], out: Token[] = []): Token[] {
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith("$") || typeof child !== "object" || child === null) continue;
    if ("$value" in child) out.push({ path: [...trail, key], node: child as Json });
    else tokens(child as Json, [...trail, key], out);
  }
  return out;
}
function count(list: Token[], type: string, head?: string): number {
  return list.filter((t) => t.node.$type === type && (head === undefined || t.path[0] === head))
    .length;
}

describe("C-FIG-01 the two files", () => {
  it("hold 188 tokens each, with equal names and types", () => {
    const files = figmaFiles(SPEC, NAME);
    expect(files.map((f) => f.path)).toEqual(PATHS);
    for (const f of files) expect(f.text).toBe(`${JSON.stringify(JSON.parse(f.text), null, 2)}\n`);
    const [light, dark] = parsed().map((f) => tokens(f)) as [Token[], Token[]];
    expect(light).toHaveLength(188);
    expect(count(light, "color")).toBe(134);
    expect(count(light, "fontFamily")).toBe(3);
    expect(count(light, "dimension", "size")).toBe(10);
    expect(count(light, "dimension", "line-height")).toBe(10);
    expect(count(light, "dimension", "space")).toBe(12);
    expect(count(light, "dimension", "radius")).toBe(6);
    expect(count(light, "duration")).toBe(7);
    expect(count(light, "number")).toBe(6);
    expect(dark.map((t) => [t.path, t.node.$type])).toEqual(
      light.map((t) => [t.path, t.node.$type]),
    );
  });
});

describe("C-FIG-02 types and units", () => {
  it("uses only the five types, px, s and single-string families", () => {
    const model = themeModel(SPEC);
    const [light] = parsed().map((f) => tokens(f)) as [Token[]];
    for (const token of light) {
      expect(["color", "dimension", "duration", "number", "fontFamily"]).toContain(
        token.node.$type,
      );
      const value = token.node.$value as Json;
      if (token.node.$type === "dimension") expect(value.unit).toBe("px");
      if (token.node.$type === "duration") expect(value.unit).toBe("s");
      if (token.node.$type === "fontFamily") expect(typeof value).toBe("string");
    }
    const byPath = (p: string) => light.find((t) => t.path.join(".") === p)?.node.$value;
    expect(byPath("font.display")).toBe(model.families.display.family);
    expect(byPath("font.body")).toBe(model.families.body.family);
    expect(byPath("font.mono")).toBe(model.families.mono.family);
    model.durations.forEach((d) => {
      expect(byPath(`duration.${d.name}`)).toEqual({
        value: round6(Number.parseFloat(d.value) / 1000),
        unit: "s",
      });
    });
    for (const step of SPEC.type.steps) {
      expect(byPath(`size.${step.name}`)).toEqual({ value: step.sizePx, unit: "px" });
      expect(byPath(`line-height.${step.name}`)).toEqual({ value: step.lineHeightPx, unit: "px" });
    }
    expect(byPath("radius.full")).toEqual({ value: 9999, unit: "px" });
    expect(byPath("spring.smooth.bounce")).toBe(SPEC.motion.springs.smooth.bounce);
    expect(byPath("spring.smooth.visual-duration")).toBe(SPEC.motion.springs.smooth.visualDuration);
  });
});

describe("C-FIG-03 colors", () => {
  it("are srgb with round6 components, and only the colors differ", () => {
    const [light, dark] = parsed().map((f) => tokens(f)) as [Token[], Token[]];
    light.forEach((token, index) => {
      const other = dark[index] as Token;
      if (token.node.$type !== "color") {
        expect(other.node.$value).toEqual(token.node.$value);
        return;
      }
      for (const t of [token, other]) {
        const value = t.node.$value as { colorSpace: string; components: number[]; hex: string };
        expect(value.colorSpace).toBe("srgb");
        expect(value.hex).toMatch(/^#[0-9a-f]{6}$/);
        const [r, g, b] = hexToRgb(value.hex as Hex);
        expect(value.components).toEqual([round6(r), round6(g), round6(b)]);
        const n = Number.parseInt(value.hex.slice(1), 16);
        expect(value.components).toEqual(
          [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => round6(c / 255)),
        );
      }
    });
    const model = themeModel(SPEC);
    const first = light.find((t) => t.path.join(".") === "color.role.primary");
    expect(((first?.node.$value ?? {}) as Json).hex).toBe(
      model.roles.find((r) => r.name === "primary")?.light,
    );
  });
});

describe("C-FIG-04 the format schema", () => {
  it.each(GOLDENS.map((g) => [g.id, g.spec] as const))("%s", (_id, spec) => {
    const validate = formatValidator();
    for (const file of parsed(spec)) expect(validate(file)).toBe(true);
  });
});

describe("C-FIG-05 mutated copies fail", () => {
  const [light] = parsed(GOLDENS[0]?.spec) as [Json];
  const validate = formatValidator();
  const copy = (): Json => structuredClone(light);
  const at = (root: Json, ...keys: string[]): Json =>
    keys.reduce<Json>((node, key) => node[key] as Json, root);
  it("accepts the original", () => expect(validate(light)).toBe(true));
  it("rejects a dimension in em", () => {
    const doc = copy();
    at(doc, "space", "4").$value = { value: 16, unit: "em" };
    expect(validate(doc)).toBe(false);
  });
  it("rejects a duration in m", () => {
    const doc = copy();
    at(doc, "duration", "base").$value = { value: 1, unit: "m" };
    expect(validate(doc)).toBe(false);
  });
  it("rejects a color of a hex string", () => {
    const doc = copy();
    at(doc, "color", "role", "primary").$value = "#ff0000";
    expect(validate(doc)).toBe(false);
  });
});

describe("C-FIG-06 inputs", () => {
  it("throws a TypeError naming figmaFiles for a null spec", () => {
    expect(() => figmaFiles(null as never, "x")).toThrow(TypeError);
    expect(() => figmaFiles(null as never, "x")).toThrow(/figmaFiles/);
    expect(() => figmaFiles(SPEC, 3 as never)).toThrow(TypeError);
  });
  it("throws a RangeError for a name that is not plain text", () => {
    expect(() => figmaFiles(SPEC, "a\u0000b")).toThrow(RangeError);
    expect(() => figmaFiles(SPEC, "a\u0000b")).toThrow(/figmaFiles/);
  });
});
