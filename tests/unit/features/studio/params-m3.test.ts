import { describe, expect, it } from "vitest";
import * as engine from "@/engine";
import {
  DIRECTION_PARAM_KEYS,
  freshParams,
  mergeParams,
  paramsMatchSpec,
  paramsOfSpec,
  parseParams,
  resolveParams,
  touchesPreset,
} from "@/features/studio/params";
import type { DesignSpec } from "@/spec";
import { FRESH_PARAMS, freshSpec, generate } from "./support";

// Cases C-PAR3-01 to C-PAR3-08 of docs/specs/03-export.md, section 10.1 (R3-03).

const RICH = {
  oneLiner: "Tide charts for small boats",
  direction: { thesis: "Calm and exact", adjectives: ["calm", "exact"] },
  rules: { do: ["Use one accent"], dont: ["No gradients"] },
};
const as = (value: unknown) => value as DesignSpec;

describe("the moved helpers", () => {
  it("C-PAR3-01 are the objects the engine exports", () => {
    expect(freshParams).toBe(engine.freshParams);
    expect(resolveParams).toBe(engine.resolveParams);
    expect(paramsOfSpec).toBe(engine.paramsOfSpec);
  });

  it("C-PAR3-02 paramsOfSpec reads the text fields back", () => {
    const spec = generate({ ...FRESH_PARAMS, ...RICH }, "seed-1");
    expect(paramsOfSpec(spec).params).toMatchObject(RICH);
    expect("rules" in paramsOfSpec(freshSpec()).params).toBe(false);
    const one = generate({ ...FRESH_PARAMS, rules: { do: ["x"], dont: [] } }, "seed-1");
    expect(paramsOfSpec(one).params.rules).toEqual({ do: ["x"], dont: [] });
  });

  it("C-PAR3-03 DIRECTION_PARAM_KEYS lists the text parameters after name, then motionTokens (R5-14)", () => {
    expect(DIRECTION_PARAM_KEYS).toEqual([
      "primary",
      "secondary",
      "accent",
      "harmony",
      "chroma",
      "neutralTint",
      "gamut",
      "scaleMode",
      "contrastLevel",
      "type",
      "radius",
      "depth",
      "motion",
      "pairing",
      "name",
      "oneLiner",
      "direction",
      "rules",
      "motionTokens",
    ]);
  });

  it("C-PAR3-04 parseParams keeps the text parameters within R3-01's bounds", () => {
    expect(parseParams({ ...FRESH_PARAMS, ...RICH })).toEqual({ ...FRESH_PARAMS, ...RICH });
    for (const bad of [
      { oneLiner: "x".repeat(141) },
      { oneLiner: " x" },
      { direction: {} },
      { rules: { do: [""], dont: [] } },
      { rules: [] },
      { rules: { do: [] } },
    ]) {
      expect(parseParams({ ...FRESH_PARAMS, ...bad }), JSON.stringify(bad)).toBeNull();
    }
  });

  it("C-PAR3-05 mergeParams sets and removes the text parameters, and touchesPreset ignores them", () => {
    const set = mergeParams(FRESH_PARAMS, RICH);
    expect(set).toMatchObject(RICH);
    for (const key of ["oneLiner", "direction", "rules"] as const) {
      const cleared = mergeParams(set, { [key]: undefined });
      expect(key in cleared, key).toBe(false);
    }
    expect(touchesPreset(FRESH_PARAMS, set)).toBe(false);
    expect(touchesPreset(FRESH_PARAMS, { ...FRESH_PARAMS, name: "x" })).toBe(false);
  });

  it("C-PAR3-06 paramsMatchSpec compares oneLiner and direction", () => {
    const params = { ...FRESH_PARAMS, ...RICH };
    const spec = generate(resolveParams(params, "seed-1"), "seed-1");
    expect(paramsMatchSpec(params, spec)).toBe(true);
    const other = as({ ...spec, meta: { ...spec.meta, oneLiner: "Something else" } });
    expect(paramsMatchSpec(params, other)).toBe(false);
  });

  it("C-PAR3-08 empty rules are no rules, so a draft that holds them matches its spec", () => {
    const empty = { do: [], dont: [] };
    const parsed = parseParams({ ...FRESH_PARAMS, ...RICH, rules: empty });
    expect(parsed).toEqual({ ...FRESH_PARAMS, oneLiner: RICH.oneLiner, direction: RICH.direction });
    expect(parsed !== null && "rules" in parsed).toBe(false);
    const merged = mergeParams({ ...FRESH_PARAMS, ...RICH }, { rules: empty });
    expect("rules" in merged).toBe(false);
    const spec = generate(resolveParams({ ...FRESH_PARAMS, rules: empty }, "seed-1"), "seed-1");
    const draft = parseParams({ ...FRESH_PARAMS, rules: empty });
    expect(draft).not.toBeNull();
    expect(paramsMatchSpec(draft as NonNullable<typeof draft>, spec)).toBe(true);
    // A list with an entry is kept as it is.
    const one = { do: ["x"], dont: [] };
    expect(parseParams({ ...FRESH_PARAMS, rules: one })?.rules).toEqual(one);
    expect(mergeParams(FRESH_PARAMS, { rules: one }).rules).toEqual(one);
  });

  it("C-PAR3-07 throws TypeError and RangeError naming the function", () => {
    expect(() => paramsOfSpec(null as never)).toThrow(TypeError);
    expect(() => paramsOfSpec(null as never)).toThrow(/^paramsOfSpec: /);
    expect(() => resolveParams(null as never, "s")).toThrow(/^resolveParams: /);
    expect(() => resolveParams({ ...freshParams() }, 5 as never)).toThrow(TypeError);
    expect(() => resolveParams({ ...freshParams() }, 5 as never)).toThrow(/^resolveParams: /);
    const patch = { about: "x" } as never;
    expect(() => mergeParams(freshParams(), patch)).toThrow(RangeError);
    expect(() => mergeParams(freshParams(), patch)).toThrow("patch.about");
  });
});
