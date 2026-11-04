import { describe, expect, it } from "vitest";
import {
  applyPreset,
  type DirectionParams,
  generateSystem,
  PRESET_IDS,
  paramsOfSpec,
  resolveParams,
} from "@/engine";
import { DEFAULT_PARAMS, defaultSpec } from "../spec/support";

// Cases C-GEN3-01 to C-GEN3-04 of docs/specs/03-export.md, section 10.1 (R3-01, R3-02, R3-03).

const TEXT = {
  oneLiner: "Tide charts for small boats",
  direction: { thesis: "Calm and exact", adjectives: ["calm", "exact"] },
  rules: { do: ["Use one accent"], dont: ["No gradients"] },
} as const;

describe("generateSystem with the text parameters", () => {
  it("C-GEN3-01 writes oneLiner, direction and rules as given", () => {
    const spec = generateSystem({ ...DEFAULT_PARAMS, ...TEXT }, "seed-1");
    expect(spec.meta.oneLiner).toBe(TEXT.oneLiner);
    expect(spec.direction).toEqual(TEXT.direction);
    expect(spec.rules).toEqual(TEXT.rules);
    const { meta, direction: _d, rules: _r, ...rest } = spec;
    const { meta: baseMeta, rules: _br, ...baseRest } = defaultSpec();
    const { oneLiner: _o, ...metaRest } = meta;
    expect(rest).toEqual(baseRest);
    expect(metaRest).toEqual(baseMeta);
  });

  it("C-GEN3-02 writes nothing for absent parameters", () => {
    const spec = generateSystem(DEFAULT_PARAMS, "seed-1");
    expect(spec).toEqual(defaultSpec());
    expect("oneLiner" in spec.meta).toBe(false);
    expect("direction" in spec).toBe(false);
    expect(spec.rules).toEqual({ do: [], dont: [] });
  });

  it("C-GEN3-03 throws RangeError naming the field, and TypeError for a wrong type", () => {
    const range: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
      ["generateSystem: params.oneLiner", { oneLiner: "" }],
      ["generateSystem: params.oneLiner", { oneLiner: "x".repeat(141) }],
      ["generateSystem: params.oneLiner", { oneLiner: " x" }],
      ["generateSystem: params.direction", { direction: {} }],
      ["generateSystem: params.direction.adjectives", { direction: { adjectives: texts(6) } }],
      ["generateSystem: params.rules.do", { rules: { do: [""], dont: [] } }],
      ["generateSystem: params.name", { name: " x" }],
    ];
    for (const [field, override] of range) {
      const params = { ...DEFAULT_PARAMS, ...override } as DirectionParams;
      expect(() => generateSystem(params, "seed-1"), field).toThrow(RangeError);
      expect(() => generateSystem(params, "seed-1"), field).toThrow(field);
    }
    const type: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
      ["generateSystem: params.oneLiner", { oneLiner: 5 }],
      ["generateSystem: params.direction", { direction: "x" }],
      ["generateSystem: params.rules", { rules: [] }],
    ];
    for (const [field, override] of type) {
      const params = { ...DEFAULT_PARAMS, ...override } as DirectionParams;
      expect(() => generateSystem(params, "seed-1"), field).toThrow(TypeError);
      expect(() => generateSystem(params, "seed-1"), field).toThrow(field);
    }
  });

  it("C-GEN3-04 is inverted by paramsOfSpec for 25 specs over every preset", {
    timeout: 120_000,
  }, () => {
    for (let i = 0; i < 25; i++) {
      const id = PRESET_IDS[i % PRESET_IDS.length];
      const seed = `s${i}`;
      const params = { ...applyPreset(DEFAULT_PARAMS, id), ...TEXT };
      const spec = generateSystem(resolveParams(params, seed), seed);
      expect(spec.meta.oneLiner, id).toBe(TEXT.oneLiner);
      const back = paramsOfSpec(spec).params;
      expect(generateSystem(resolveParams(back, seed), seed), id).toEqual(spec);
    }
  });
});

function texts(count: number): string[] {
  return Array.from({ length: count }, () => "x");
}
