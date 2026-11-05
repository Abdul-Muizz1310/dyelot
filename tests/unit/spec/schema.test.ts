import { describe, expect, it } from "vitest";
import type { Palette, PaletteName } from "@/engine/color/palette";
import type { RoleName } from "@/engine/color/roles";
import type { Hex } from "@/engine/color/types";
import { type DesignSpec, DesignSpecSchema } from "@/spec/schema";
import {
  defaultSpec,
  graySpec,
  numberPaths,
  type Path,
  richSpec,
  valueAt,
  without,
  withValue,
} from "./support";

// Cases are the C-SCHEMA-nn rows of docs/specs/01-color-engine.md, section 6.7.

const parse = (value: unknown) => DesignSpecSchema.safeParse(value);

function expectAccepted(value: unknown): void {
  const result = parse(value);
  expect(result.success, result.success ? "" : JSON.stringify(result.error.issues)).toBe(true);
}

function expectRejected(value: unknown, at?: Path): void {
  const result = parse(value);
  expect(result.success).toBe(false);
  if (at !== undefined && !result.success) {
    const paths = result.error.issues.map((issue) => issue.path.join("."));
    expect(paths).toContain(at.join("."));
  }
}

const PRIMARY: Path = ["color", "palettes", "primary"];
const LIGHT_SCALE: Path = [...PRIMARY, "light"];
const LIGHT_ROLES: Path = ["color", "roles", "light"];

describe("DesignSpecSchema", () => {
  it("C-SCHEMA-01 parses a generated spec to a deep-equal value", () => {
    for (const spec of [defaultSpec(), richSpec(), graySpec()]) {
      expect(DesignSpecSchema.parse(spec)).toEqual(spec);
    }
  });

  it("C-SCHEMA-02 rejects a missing role, and the issue path names it", () => {
    expectRejected(without(defaultSpec(), [...LIGHT_ROLES, "ring"]), [...LIGHT_ROLES, "ring"]);
  });

  it("C-SCHEMA-03 rejects a palette hue of 400, 360 or -1", () => {
    for (const hue of [400, 360, -1]) {
      expectRejected(withValue(defaultSpec(), [...PRIMARY, "hue"], hue), [...PRIMARY, "hue"]);
    }
    for (const hue of [0, 359.999])
      expectAccepted(withValue(defaultSpec(), [...PRIMARY, "hue"], hue));
  });

  it("C-SCHEMA-04 rejects an unknown, empty, numeric or missing version", () => {
    for (const version of ["dyelot.spec/2", "", 1]) {
      expectRejected(withValue(defaultSpec(), ["version"], version), ["version"]);
    }
    expectRejected(without(defaultSpec(), ["version"]), ["version"]);
  });

  it("C-SCHEMA-05 rejects NaN or Infinity in any stored number", { timeout: 120_000 }, () => {
    const bad = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];
    for (const spec of [defaultSpec(), richSpec()]) {
      const paths = numberPaths(spec);
      expect(paths.length).toBeGreaterThan(1000);
      paths.forEach((path, i) => {
        const result = parse(withValue(spec, path, bad[i % bad.length]));
        expect(result.success, path.join(".")).toBe(false);
      });
    }
    // All three values on fields of each kind: a step, a palette, a token and a seed record.
    for (const path of [
      [...LIGHT_SCALE, 3, "oklch", "l"],
      [...LIGHT_SCALE, 3, "contrast"],
      [...PRIMARY, "peakChroma"],
      [...PRIMARY, "seedDeviation", "deltaEOK"],
      ["type", "steps", 9, "maxSizePx"],
      ["depth", "shadows", 2, 0, "blur"],
      ["components", "icons", "strokePx"],
    ]) {
      for (const value of bad) expectRejected(withValue(richSpec(), path, value), path);
    }
  });

  it("C-SCHEMA-06 rejects a role that is not a lowercase #rrggbb hex", () => {
    for (const value of ["#FFF", "#ffffff80", "red", "#ABCDEF", "#fff", "ffffff", 42, null]) {
      expectRejected(withValue(defaultSpec(), [...LIGHT_ROLES, "primary"], value));
    }
    expectAccepted(withValue(defaultSpec(), [...LIGHT_ROLES, "primary"], "#abcdef"));
  });

  it("C-SCHEMA-07 rejects a scale with 10 steps, a repeated or out-of-order step, or step 75", () => {
    const spec = defaultSpec();
    const scale = spec.color.palettes.primary.light;
    expectRejected(without(spec, [...LIGHT_SCALE, 4]));
    expectRejected(withValue(spec, LIGHT_SCALE, [...scale, scale[10]]));
    expectRejected(withValue(spec, [...LIGHT_SCALE, 1, "step"], 50));
    expectRejected(withValue(spec, LIGHT_SCALE, [scale[0], scale[2], scale[1], ...scale.slice(3)]));
    expectRejected(withValue(spec, [...LIGHT_SCALE, 0, "step"], 75), [...LIGHT_SCALE, 0, "step"]);
    expectRejected(withValue(spec, ["color", "palettes", "info", "dark"], []));
  });

  it("C-SCHEMA-08 rejects a role map with an extra name, 45 names or four chart roles", () => {
    const spec = defaultSpec();
    expectRejected(withValue(spec, [...LIGHT_ROLES, "tertiary"], "#123456"), LIGHT_ROLES);
    expectRejected(without(spec, [...LIGHT_ROLES, "border"]), [...LIGHT_ROLES, "border"]);
    expectRejected(without(spec, ["color", "roles", "dark", "chart-5"]));
    expect(Object.keys(spec.color.roles.light)).toHaveLength(46);
    expect(Object.keys(spec.color.roles.dark)).toHaveLength(46);
  });

  it("C-SCHEMA-09 rejects an unknown key at any level", () => {
    for (const path of [
      ["color", "extra"],
      ["meta", "extra"],
      ["extra"],
      [...PRIMARY, "extra"],
      [...LIGHT_SCALE, 0, "oklch", "extra"],
      ["type", "steps", 0, "extra"],
      ["components", "icons", "extra"],
    ]) {
      expectRejected(withValue(defaultSpec(), path, 1), path.slice(0, -1));
    }
  });

  it("C-SCHEMA-10 rejects a family id outside ^[a-z0-9-]{1,64}$", () => {
    for (const family of ["Host Grotesk", "host_grotesk", "", "a".repeat(65), "host-grotesk "]) {
      for (const slot of ["display", "body", "mono"]) {
        expectRejected(withValue(defaultSpec(), ["type", "families", slot], family));
      }
    }
    for (const family of ["a".repeat(64), "fragment-mono", "0"]) {
      expectAccepted(withValue(defaultSpec(), ["type", "families", "mono"], family));
    }
  });

  it("C-SCHEMA-11 carries the M1 defaults for families, components and rules", () => {
    const spec = defaultSpec();
    expect(spec.type.families).toEqual({
      display: "host-grotesk",
      body: "host-grotesk",
      mono: "fragment-mono",
    });
    expect(spec.components).toEqual({
      cards: "interactive-only",
      emphasis: "one-filled-per-region",
      inputs: "outlined",
      icons: { library: "lucide", strokePx: 2 },
    });
    expect(spec.rules).toEqual({ do: [], dont: [] });
  });

  it("C-SCHEMA-12 rejects an Oklch outside its domain, wherever it is stored", () => {
    const places: Path[] = [
      [...LIGHT_SCALE, 5, "oklch"],
      ["color", "params", "primary"],
      ["depth", "shadows", 1, 1, "color"],
    ];
    for (const place of places) {
      const base = valueAt(richSpec(), place) as object;
      for (const bad of [
        { l: 1.2 },
        { l: -0.01 },
        { c: -0.1 },
        { c: 0.6 },
        { h: 360 },
        { h: -1 },
      ]) {
        expectRejected(withValue(richSpec(), place, { ...base, ...bad }));
      }
      expectRejected(withValue(richSpec(), place, { ...base, h: Number.NaN }));
      expectRejected(withValue(richSpec(), [...place, "h"], undefined));
      for (const edge of [{ l: 0 }, { l: 1 }, { c: 0, h: null }, { c: 0.5 }, { h: 359.9 }]) {
        expectAccepted(withValue(richSpec(), place, { ...base, ...edge }));
      }
    }
  });

  it("C-SCHEMA-13 rejects a seed step that is not a step, and a negative or NaN ΔEOK", () => {
    const spec = richSpec();
    expect(spec.color.palettes.primary.seedStep).toBeDefined();
    expect(spec.color.palettes.primary.seedDeviation).toBeDefined();
    expectRejected(withValue(spec, [...PRIMARY, "seedStep", "light"], 75));
    expectRejected(withValue(spec, [...PRIMARY, "seedStep", "dark"], "400"));
    expectRejected(withValue(spec, [...PRIMARY, "seedStep"], { light: 400 }));
    expectRejected(withValue(spec, [...PRIMARY, "seedDeviation", "step"], 1000));
    for (const value of [-0.01, Number.NaN]) {
      expectRejected(withValue(spec, [...PRIMARY, "seedDeviation", "deltaEOK"], value));
    }
    expectAccepted(withValue(spec, [...PRIMARY, "seedDeviation", "deltaEOK"], 0));
  });

  it("C-SCHEMA-14 holds the bounds of R-20", () => {
    const spec = defaultSpec();
    const cases: ReadonlyArray<readonly [Path, unknown, unknown]> = [
      [["meta", "name"], "", "n".repeat(81)],
      [["meta", "seed"], "", "s".repeat(129)],
      [["rules", "do"], Array(21).fill("rule"), ["r".repeat(201)]],
      [["rules", "dont"], Array(21).fill("rule"), ["r".repeat(201)]],
      [["components", "cards"], "", "p".repeat(65)],
      [["components", "emphasis"], "", "p".repeat(65)],
      [["components", "inputs"], "", "p".repeat(65)],
      [["components", "icons", "library"], "", "p".repeat(65)],
    ];
    for (const [path, low, high] of cases) {
      expectRejected(withValue(spec, path, low), path);
      expectRejected(withValue(spec, path, high));
    }
    // R3-01: the new bounds, each with the path its issue names.
    const text = (count: number, length = 1) => Array(count).fill("a".repeat(length));
    const added: ReadonlyArray<readonly [Path, unknown, Path]> = [
      [["meta", "oneLiner"], "", ["meta", "oneLiner"]],
      [["meta", "oneLiner"], "o".repeat(141), ["meta", "oneLiner"]],
      [["direction"], {}, ["direction"]],
      [["direction"], { thesis: "t".repeat(281) }, ["direction", "thesis"]],
      [["direction"], { adjectives: [] }, ["direction", "adjectives"]],
      [["direction"], { adjectives: text(6) }, ["direction", "adjectives"]],
      [["direction"], { adjectives: text(1, 25) }, ["direction", "adjectives", 0]],
      [["direction"], { like: text(6) }, ["direction", "like"]],
      [["direction"], { like: text(1, 81) }, ["direction", "like", 0]],
      [["direction"], { unlike: text(6) }, ["direction", "unlike"]],
      [["direction"], { unlike: text(1, 81) }, ["direction", "unlike", 0]],
      [["rules", "do"], [""], ["rules", "do", 0]],
    ];
    for (const [path, value, at] of added) expectRejected(withValue(spec, path, value), at);
    // R3-02: a text field or a policy that is not plain text fails; the bounds above stay.
    const notPlain = [" lead", "a\u0007b", "a\u202eb", "e\u0301"];
    const fields: ReadonlyArray<Path> = [
      ["meta", "name"],
      ["meta", "oneLiner"],
      ["components", "cards"],
      ["components", "emphasis"],
      ["components", "inputs"],
      ["components", "icons", "library"],
    ];
    for (const text of notPlain) {
      for (const path of fields) expectRejected(withValue(spec, path, text), path);
      expectRejected(withValue(spec, ["rules", "do"], [text]), ["rules", "do", 0]);
      expectRejected(withValue(spec, ["direction"], { thesis: text }), ["direction", "thesis"]);
    }
    const edges: ReadonlyArray<readonly [Path, unknown]> = [
      [["meta", "name"], "n".repeat(80)],
      [["meta", "name"], "n"],
      [["meta", "oneLiner"], "o".repeat(140)],
      [["direction"], { thesis: "t".repeat(280) }],
      [["meta", "seed"], "s".repeat(128)],
      [["rules", "do"], Array(20).fill("r".repeat(200))],
      [["rules", "dont"], ["Keep one filled button per region."]],
      [["components", "cards"], "p".repeat(64)],
    ];
    for (const [path, value] of edges) expectAccepted(withValue(spec, path, value));
  });

  it("C-SCHEMA-15 rejects a value that is not a spec object", () => {
    for (const value of [null, [], "spec", {}, 42, undefined, true]) expectRejected(value);
  });

  it("C-SCHEMA-16 accepts the six kinds of meta.createdWith and nothing else", () => {
    for (const source of [
      "controls",
      "lexicon",
      "on-device",
      "visitor-key",
      "import",
      "model:openrouter/some-model:free",
    ]) {
      expectAccepted(withValue(defaultSpec(), ["meta", "createdWith"], source));
    }
    for (const source of ["model:", "robot", "Controls", "", "model", 1]) {
      expectRejected(withValue(defaultSpec(), ["meta", "createdWith"], source), [
        "meta",
        "createdWith",
      ]);
    }
  });

  it("I-09 rejects an optional field written as undefined: absent, never undefined", () => {
    const spec = richSpec();
    for (const path of [
      ["type", "ratio"],
      [...PRIMARY, "seedStep"],
      [...PRIMARY, "seedDeviation"],
      ["color", "params", "primary"],
      ["type", "steps", 9, "clamp"],
    ]) {
      expectAccepted(without(spec, path));
      expectRejected(withValue(spec, path, undefined), path);
    }
  });

  it("types a parsed spec so the engine can read it (palettes, roles, hexes)", () => {
    const spec: DesignSpec = DesignSpecSchema.parse(defaultSpec());
    const palettes: Record<PaletteName, Palette> = spec.color.palettes;
    const roles: Record<RoleName, Hex> = spec.color.roles.light;
    expect(palettes.primary.light).toHaveLength(11);
    expect(palettes.primary.name).toBe("primary");
    expect(roles.background).toBe("#ffffff");
  });

  it("rejects a palette stored under another palette's name", () => {
    expectRejected(withValue(defaultSpec(), [...PRIMARY, "name"], "accent"), [...PRIMARY, "name"]);
  });
});
