import { createHash } from "node:crypto";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  generateSystem,
  type Hex,
  hexToRgb,
  PALETTE_NAMES,
  ROLE_NAMES,
  rgbToOklch,
  round6,
  roundHue,
  STEPS,
} from "@/engine";
import { dtcgFiles } from "@/export/dtcg";
import { themeModel } from "@/export/model";
import { editLink } from "@/export/text";
import type { DesignSpec } from "@/spec";
import { anyDirection, anySeedText, PROPERTY_TIMEOUT } from "../spec/support";
import { GOLDENS, ORIGIN, SPEC } from "./golden-support";
import { formatValidator, readSchemaFile, resolverValidator } from "./schema-support";

// C-DTCG-01 to 14 of docs/specs/03-export.md, section 10.5 (R3-11, R3-15, R3-17, R3-28, 6.4).

type Json = Record<string, unknown>;
const NAME = "Test Design";
const PATHS = [
  "tokens/base.tokens.json",
  "tokens/light.tokens.json",
  "tokens/dark.tokens.json",
  "tokens/design.resolver.json",
];
const NAME_PATTERN = /^[^${}.][^{}.]*$/;
const INTEGERS = ["0", "1", "2", "3", "4", "6", "8", "12", "16", "20", "24", "32"];

function filesOf(spec: DesignSpec = SPEC) {
  return dtcgFiles(spec, NAME, ORIGIN);
}
function parsed(spec: DesignSpec = SPEC): Record<string, Json> {
  return Object.fromEntries(filesOf(spec).map((f) => [f.path, JSON.parse(f.text) as Json]));
}
function group(root: Json, ...keys: string[]): Json {
  let node: unknown = root;
  for (const key of keys) node = (node as Json)[key];
  return node as Json;
}
function goldenSpec(id: string): DesignSpec {
  const found = GOLDENS.find((g) => g.id === id);
  if (found === undefined) throw new Error(`no golden ${id}`);
  return found.spec;
}

type Token = { path: string[]; node: Json };
/** Every token (an object with `$value`) and every group of a token file. */
function walk(node: Json, trail: string[] = [], tokens: Token[] = [], groups: Json[] = []) {
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith("$") || typeof child !== "object" || child === null) continue;
    if ("$value" in child) tokens.push({ path: [...trail, key], node: child as Json });
    else {
      groups.push(child as Json);
      walk(child as Json, [...trail, key], tokens, groups);
    }
  }
  return { tokens, groups };
}

function oklchOf(hex: string) {
  const { l, c, h } = rgbToOklch(hexToRgb(hex as Hex), "srgb");
  return [round6(l), round6(c), h === null ? "none" : roundHue(h)];
}

describe("C-DTCG-01 the four files", () => {
  it("come in order, each as JSON plus one newline", () => {
    const files = filesOf();
    expect(files.map((f) => f.path)).toEqual(PATHS);
    for (const f of files) {
      expect(f.text).toBe(`${JSON.stringify(JSON.parse(f.text), null, 2)}\n`);
    }
  });
});

describe("C-DTCG-02 base.tokens.json", () => {
  it("holds the groups in order with 56 tokens and the root description", () => {
    const base = parsed()["tokens/base.tokens.json"] as Json;
    expect(Object.keys(base)).toEqual([
      "$description",
      "font",
      "font-weight",
      "type",
      "space",
      "radius",
      "shadow",
      "duration",
      "easing",
      "spring",
    ]);
    expect(base.$description).toBe(`${NAME}. Made with dyelot: ${editLink(SPEC, ORIGIN)}`);
    const count = (name: string) => Object.keys(base[name] as Json).length;
    expect(
      [
        "font",
        "font-weight",
        "type",
        "space",
        "radius",
        "shadow",
        "duration",
        "easing",
        "spring",
      ].map(count),
    ).toEqual([3, 3, 10, 12, 6, 5, 7, 4, 3]);
    for (const spring of Object.values(base.spring as Json)) {
      expect(Object.keys(spring as Json)).toEqual(["visual-duration", "bounce"]);
    }
    expect(walk(base).tokens).toHaveLength(56);
  });
});

describe("C-DTCG-03 every token carries its own $type", () => {
  it.each(GOLDENS.map((g) => [g.id, g.spec] as const))("%s", (_id, spec) => {
    const files = parsed(spec);
    for (const path of PATHS) {
      const file = files[path] as Json;
      const { tokens, groups } = walk(file);
      if (path.endsWith("resolver.json")) continue;
      for (const token of tokens) {
        expect(typeof token.node.$type, token.path.join(".")).toBe("string");
        for (const part of token.path) expect(part).toMatch(NAME_PATTERN);
      }
      for (const g of groups) expect(g.$type).toBeUndefined();
      expect(file.$type).toBeUndefined();
    }
  });
});

describe("C-DTCG-04 colors", () => {
  it("hold the stored OKLCH of a step and the converted OKLCH of a role", () => {
    for (const mode of ["light", "dark"] as const) {
      const file = parsed()[`tokens/${mode}.tokens.json`] as Json;
      expect(Object.keys(file)).toEqual(["color"]);
      expect(Object.keys(group(file, "color"))).toEqual(["role", "scale"]);
      expect(Object.keys(group(file, "color", "role"))).toEqual([...ROLE_NAMES]);
      const { tokens } = walk(file);
      expect(tokens).toHaveLength(134);
      for (const token of tokens) expect(token.node.$type).toBe("color");
      for (const palette of PALETTE_NAMES) {
        const scale = group(file, "color", "scale", palette);
        expect(Object.keys(scale)).toEqual(STEPS.map(String));
        SPEC.color.palettes[palette][mode].forEach((entry, index) => {
          const value = (scale[String(STEPS[index])] as Json).$value as Json;
          const { l, c, h } = entry.oklch;
          expect(value.colorSpace).toBe("oklch");
          expect(value.components).toEqual([
            round6(l),
            round6(c),
            h === null ? "none" : roundHue(h),
          ]);
        });
      }
      for (const role of ROLE_NAMES) {
        const value = (group(file, "color", "role")[role] as Json).$value as Json;
        expect(value.components, role).toEqual(oklchOf(SPEC.color.roles[mode][role]));
      }
    }
  });
  it("write a null hue as none (SPEC's white background)", () => {
    const light = parsed()["tokens/light.tokens.json"] as Json;
    const background = (group(light, "color", "role").background as Json).$value as Json;
    expect((background.components as unknown[])[2]).toBe("none");
  });
});

describe("C-DTCG-05 hexes and mode parity", () => {
  it("keep the stored hex and the same names and types in both modes", () => {
    const model = themeModel(SPEC);
    const files = parsed();
    const light = walk(files["tokens/light.tokens.json"] as Json).tokens;
    const dark = walk(files["tokens/dark.tokens.json"] as Json).tokens;
    expect(dark.map((t) => [t.path, t.node.$type])).toEqual(
      light.map((t) => [t.path, t.node.$type]),
    );
    const byName = new Map([...model.roles, ...model.steps].map((c) => [c.name, c]));
    for (const mode of ["light", "dark"] as const) {
      for (const token of mode === "light" ? light : dark) {
        const [, kind, first, second] = token.path as [string, string, string, string];
        const name = kind === "role" ? first : `${first}-${second}`;
        expect((token.node.$value as Json).hex, token.path.join(".")).toBe(
          byName.get(name)?.[mode],
        );
      }
    }
  });
});

describe("C-DTCG-06 typography", () => {
  it("writes each step as a typography token", () => {
    const model = themeModel(SPEC);
    const base = parsed()["tokens/base.tokens.json"] as Json;
    const type = group(base, "type");
    expect(Object.keys(type)).toEqual(model.typeSteps.map((s) => s.name));
    for (const step of SPEC.type.steps) {
      const token = type[step.name] as Json;
      const value = token.$value as Json;
      const slot = ["display", "h1", "h2", "h3", "h4"].includes(step.name) ? "display" : "body";
      expect(token.$type).toBe("typography");
      expect(value.fontFamily).toEqual((group(base, "font", slot) as Json).$value);
      expect(value.fontSize).toEqual({ value: step.sizePx, unit: "px" });
      expect(value.fontWeight).toBe(model.typeSteps.find((s) => s.name === step.name)?.weight);
      expect(value.letterSpacing).toEqual({
        value: round6(step.trackingEm * step.sizePx),
        unit: "px",
      });
      expect(value.lineHeight).toBe(round6(step.lineHeightPx / step.sizePx));
      if (step.name === "display" && step.clamp !== undefined) {
        expect(token.$description).toContain(step.clamp);
      } else {
        expect(token.$description).toBeUndefined();
      }
    }
    expect(group(base, "font", "display").$type).toBe("fontFamily");
    expect(Array.isArray(group(base, "font", "display").$value)).toBe(true);
    expect(Object.values(group(base, "font-weight")).map((t) => (t as Json).$value)).toEqual([
      model.weights.heading,
      model.weights.label,
      model.weights.body,
    ]);
  });
});

describe("C-DTCG-07 space, radius, duration, easing, spring", () => {
  it("equals the spec and the bridge", () => {
    const base = parsed()["tokens/base.tokens.json"] as Json;
    const space = group(base, "space");
    expect(Object.keys(space)).toEqual(INTEGERS);
    INTEGERS.forEach((key, index) => {
      expect((space[key] as Json).$value).toEqual({ value: SPEC.space.scale[index], unit: "px" });
      expect((space[key] as Json).$type).toBe("dimension");
    });
    const radius = group(base, "radius");
    expect(Object.keys(radius)).toEqual(["sm", "md", "lg", "xl", "2xl", "full"]);
    expect((radius.full as Json).$value).toEqual({ value: 9999, unit: "px" });
    for (const key of ["sm", "md", "lg", "xl", "2xl"] as const) {
      expect((radius[key] as Json).$value).toEqual({ value: SPEC.shape.radii[key], unit: "px" });
    }
    for (const g of GOLDENS) {
      const duration = group(parsed(g.spec)["tokens/base.tokens.json"] as Json, "duration");
      expect(Object.values(duration).map((t) => (t as Json).$value)).toEqual(
        themeModel(g.spec).durations.map((d) => ({
          value: Number.parseFloat(d.value),
          unit: "ms",
        })),
      );
    }
    const calmSpec = GOLDENS.find((g) => g.spec.motion.feel === "calm")?.spec;
    const calm = group(parsed(calmSpec)["tokens/base.tokens.json"] as Json, "duration");
    expect(Object.values(calm).map((t) => ((t as Json).$value as Json).value)).toEqual([
      63, 125, 188, 250, 375, 500, 500,
    ]);
    const easing = group(base, "easing");
    expect(Object.keys(easing)).toEqual(["standard", "decelerate", "accelerate", "emphasized"]);
    for (const name of ["standard", "decelerate", "accelerate", "emphasized"] as const) {
      expect(easing[name]).toEqual({ $type: "cubicBezier", $value: SPEC.motion.easings[name] });
    }
    const spring = group(base, "spring");
    expect(Object.keys(spring)).toEqual(["snappy", "smooth", "bouncy"]);
    for (const name of ["snappy", "smooth", "bouncy"] as const) {
      const node = spring[name] as Json;
      expect(node["visual-duration"]).toEqual({
        $type: "number",
        $value: SPEC.motion.springs[name].visualDuration,
      });
      expect(node.bounce).toEqual({ $type: "number", $value: SPEC.motion.springs[name].bounce });
    }
  });
});

describe("C-DTCG-08 shadows", () => {
  const px = (value: number) => ({ value, unit: "px" });
  it.each(GOLDENS.map((g) => [g.id, g.spec] as const))("%s", (_id, spec) => {
    const shadow = group(parsed(spec)["tokens/base.tokens.json"] as Json, "shadow");
    expect(Object.keys(shadow)).toEqual(["1", "2", "3", "4", "5"]);
    for (const level of [1, 2, 3, 4, 5] as const) {
      const token = shadow[String(level)] as Json;
      expect(token.$type).toBe("shadow");
      const layers = token.$value as Json[];
      if (spec.depth.style === "flat") {
        expect(layers).toEqual([
          {
            color: { colorSpace: "oklch", components: [0, 0, 0], alpha: 0 },
            offsetX: px(0),
            offsetY: px(0),
            blur: px(0),
            spread: px(0),
          },
        ]);
        continue;
      }
      expect(layers).toHaveLength(2);
      const layered = spec.depth.style === "layered";
      const factor = layered ? 1.5 : 1;
      spec.depth.shadows[level].forEach((layer, index) => {
        const alpha = round6(layer.alpha * factor);
        expect(layers[index]).toEqual({
          color: {
            colorSpace: "oklch",
            components: [
              round6(layer.color.l),
              round6(layer.color.c),
              layer.color.h === null ? "none" : roundHue(layer.color.h),
            ],
            alpha: layered ? Math.min(1, alpha) : alpha,
          },
          offsetX: px(0),
          offsetY: px(round6(layer.offsetY * factor)),
          blur: px(round6(layer.blur * factor)),
          spread: px(0),
        });
      });
    }
  });
  it("covers a flat, a soft and a layered golden", () => {
    const styles = new Set(GOLDENS.map((g) => g.spec.depth.style));
    expect([...styles].sort()).toEqual(["flat", "layered", "soft"]);
  });
});

describe("C-DTCG-09 mutated copies fail the schemas", () => {
  const files = parsed(goldenSpec("default"));
  const copy = (path: string): Json => structuredClone(files[path]) as Json;
  const format = formatValidator();
  const resolver = resolverValidator();

  it("accepts the unmutated files first", () => {
    for (const path of PATHS.slice(0, 3)) expect(format(files[path])).toBe(true);
    expect(resolver(files["tokens/design.resolver.json"])).toBe(true);
  });
  it("rejects an em radius", () => {
    const base = copy("tokens/base.tokens.json");
    (group(base, "radius").sm as Json).$value = { value: 4, unit: "em" };
    expect(format(base)).toBe(false);
  });
  it("rejects a typography value without fontWeight", () => {
    const base = copy("tokens/base.tokens.json");
    delete ((group(base, "type").body as Json).$value as Json).fontWeight;
    expect(format(base)).toBe(false);
  });
  it("rejects a role value of a hex string", () => {
    const light = copy("tokens/light.tokens.json");
    (group(light, "color", "role").primary as Json).$value = "#ff0000";
    expect(format(light)).toBe(false);
  });
  it("rejects a duration in m", () => {
    const base = copy("tokens/base.tokens.json");
    (group(base, "duration").base as Json).$value = { value: 200, unit: "m" };
    expect(format(base)).toBe(false);
  });
  it("rejects a resolver whose mode modifier has one context", () => {
    const doc = copy("tokens/design.resolver.json");
    delete group(doc, "modifiers", "mode", "contexts").dark;
    expect(resolver(doc)).toBe(false);
  });
});

describe("C-DTCG-10 the schemas validate every golden", () => {
  it("names the vendored files in sources.json and matches their hashes", () => {
    const sources = JSON.parse(readSchemaFile("sources.json")) as Record<
      string,
      { url: string; fetched: string; sha256: string }
    >;
    for (const name of ["format", "resolver"]) {
      const entry = sources[`${name}.json`];
      expect(entry?.url).toBe(`https://www.designtokens.org/schemas/2025.10/${name}.json`);
      expect(entry?.fetched).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(
        createHash("sha256")
          .update(readSchemaFile(`${name}.json`))
          .digest("hex"),
      ).toBe(entry?.sha256);
    }
  });
  it.each(GOLDENS.map((g) => [g.id, g.spec] as const))("%s", (_id, spec) => {
    const format = formatValidator();
    const resolver = resolverValidator();
    const files = parsed(spec);
    for (const path of PATHS.slice(0, 3)) expect(format(files[path]), path).toBe(true);
    expect(resolver(files["tokens/design.resolver.json"])).toBe(true);
  });
});

describe("C-DTCG-11 the resolver", () => {
  it("equals section 6.4's object", () => {
    const doc = parsed()["tokens/design.resolver.json"] as Json;
    expect(doc).toEqual({
      version: "2025.10",
      name: NAME,
      description: `Made with dyelot: ${editLink(SPEC, ORIGIN)}`,
      sets: { base: { sources: [{ $ref: "base.tokens.json" }] } },
      modifiers: {
        mode: {
          default: "light",
          contexts: {
            light: [{ $ref: "light.tokens.json" }],
            dark: [{ $ref: "dark.tokens.json" }],
          },
        },
      },
      resolutionOrder: [{ $ref: "#/sets/base" }, { $ref: "#/modifiers/mode" }],
    });
    const names = PATHS.map((p) => p.replace("tokens/", ""));
    const refs = [...JSON.stringify(doc).matchAll(/"\$ref":"([^"#][^"]*)"/g)].map((m) => m[1]);
    expect(refs).toHaveLength(3);
    for (const ref of refs) expect(names).toContain(ref);
    expect(Object.keys(doc)).toEqual([
      "version",
      "name",
      "description",
      "sets",
      "modifiers",
      "resolutionOrder",
    ]);
  });
});

describe("C-DTCG-12 key order", () => {
  it("lists integer-like keys first and ascending, and is deterministic", () => {
    const files = parsed();
    const base = files["tokens/base.tokens.json"] as Json;
    expect(Object.keys(group(base, "space"))).toEqual(INTEGERS);
    expect(Object.keys(group(base, "shadow"))).toEqual(["1", "2", "3", "4", "5"]);
    const light = files["tokens/light.tokens.json"] as Json;
    for (const palette of PALETTE_NAMES) {
      expect(Object.keys(group(light, "color", "scale", palette))).toEqual(STEPS.map(String));
    }
    expect(filesOf()).toEqual(filesOf());
  });
});

describe("C-DTCG-13 inputs", () => {
  it("throws a TypeError for a null spec or a non-string name", () => {
    expect(() => dtcgFiles(null as never, "x", ORIGIN)).toThrow(TypeError);
    expect(() => dtcgFiles(null as never, "x", ORIGIN)).toThrow(/dtcgFiles/);
    expect(() => dtcgFiles(SPEC, 3 as never, ORIGIN)).toThrow(TypeError);
    expect(() => dtcgFiles(SPEC, 3 as never, ORIGIN)).toThrow(/dtcgFiles/);
  });
  it("throws a RangeError for a name that is not plain text", () => {
    expect(() => dtcgFiles(SPEC, "a\u0000b", ORIGIN)).toThrow(RangeError);
    expect(() => dtcgFiles(SPEC, "a\u0000b", ORIGIN)).toThrow(/dtcgFiles/);
  });
});

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
