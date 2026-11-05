import { describe, expect, it } from "vitest";
import { refineChange } from "@/ai/apply";
import type { RefineOp, RefineOutput } from "@/ai/features";
import type { DirectionParams, Lockable, Oklch } from "@/engine";
import { DEFAULT_PARAMS } from "../spec/support";

// Cases C-REFINE-01 to C-REFINE-03 of docs/specs/04-ai.md, section 14.5 (R4-45, section 8.2).

const SEEDS: Readonly<Record<Lockable, Oklch>> = {
  primary: { l: 0.6, c: 0.15, h: 250 },
  secondary: { l: 0.7, c: 0.1, h: 30 },
  accent: { l: 0.65, c: 0.2, h: 340 },
};
const out = (...ops: RefineOp[]): RefineOutput => ({ ops, summary: "A change." });
const ctx = (seeds = SEEDS, params: DirectionParams = DEFAULT_PARAMS) => ({ params, seeds });

describe("C-REFINE-01 refineChange applies the ops in order", () => {
  it("C-REFINE-01 shiftHue +30 on a primary at 250 gives a locked primary at 280", () => {
    const change = refineChange(out({ op: "shiftHue", slot: "primary", degrees: 30 }), ctx());
    expect(change).toEqual({ patch: { primary: { l: 0.6, c: 0.15, h: 280 } } });
  });

  it("C-REFINE-01 wraps through 0 in both directions", () => {
    expect(
      refineChange(out({ op: "shiftHue", slot: "accent", degrees: 40 }), ctx())?.patch.accent?.h,
    ).toBe(20);
    expect(
      refineChange(out({ op: "shiftHue", slot: "secondary", degrees: -60 }), ctx())?.patch.secondary
        ?.h,
    ).toBe(330);
  });

  it("C-REFINE-01 two shiftHue on one slot add up", () => {
    const change = refineChange(
      out(
        { op: "shiftHue", slot: "primary", degrees: 30 },
        { op: "shiftHue", slot: "primary", degrees: -10 },
      ),
      ctx(),
    );
    expect(change?.patch.primary?.h).toBe(270);
  });

  it('C-REFINE-01 setPairing "auto" removes pairing', () => {
    const change = refineChange(out({ op: "setPairing", pairing: "auto" }), ctx());
    expect(change?.patch).toEqual({ pairing: undefined });
    expect(change?.patch && "pairing" in change.patch).toBe(true);
  });

  it("C-REFINE-01 setPairing with an id sets it", () => {
    expect(refineChange(out({ op: "setPairing", pairing: "funnel" }), ctx())?.patch).toEqual({
      pairing: "funnel",
    });
  });

  it("C-REFINE-01 setTypeContext sets type.context", () => {
    expect(refineChange(out({ op: "setTypeContext", typeContext: "poster" }), ctx())).toEqual({
      patch: { type: { context: "poster" } },
    });
  });

  it("C-REFINE-01 setContrast may lower the level", () => {
    const params = { ...DEFAULT_PARAMS, contrastLevel: "AAA" } as const;
    expect(
      refineChange(out({ op: "setContrast", contrastLevel: "AA" }), ctx(SEEDS, params)),
    ).toEqual({ patch: { contrastLevel: "AA" } });
  });

  it("C-REFINE-01 the other ops set their field, and a later op on a field wins", () => {
    const change = refineChange(
      out(
        { op: "setChroma", chroma: "vivid" },
        { op: "setNeutralTint", neutralTint: "warm" },
        { op: "setHarmony", harmony: "triadic" },
        { op: "setRadius", radius: "sharp" },
        { op: "setDepth", depth: "flat" },
        { op: "setMotion", motion: "calm" },
        { op: "setChroma", chroma: "muted" },
      ),
      ctx(),
    );
    expect(change).toEqual({
      patch: {
        chroma: "muted",
        neutralTint: "warm",
        harmony: "triadic",
        radius: "sharp",
        depth: "flat",
        motion: "calm",
      },
    });
  });

  it("C-REFINE-01 returns no field AiChange lacks", () => {
    const change = refineChange(out({ op: "setDepth", depth: "flat" }), ctx());
    expect(Object.keys(change ?? {})).toEqual(["patch"]);
  });
});

describe("C-REFINE-02 a hue that is null at apply time", () => {
  it("C-REFINE-02 a shiftHue whose slot's held hue is null returns null", () => {
    const seeds = { ...SEEDS, primary: { l: 0.6, c: 0, h: null } };
    expect(
      refineChange(
        out({ op: "setDepth", depth: "flat" }, { op: "shiftHue", slot: "primary", degrees: 10 }),
        ctx(seeds),
      ),
    ).toBeNull();
  });
});

describe("C-REFINE-03 the checks of R-05", () => {
  it("C-REFINE-03 an output that is not an object is a TypeError naming refineChange", () => {
    for (const bad of [null, "x", [], undefined]) {
      expect(() => refineChange(bad as unknown as RefineOutput, ctx())).toThrow(TypeError);
      expect(() => refineChange(bad as unknown as RefineOutput, ctx())).toThrow(/^refineChange/);
    }
    expect(() => refineChange({ ops: "x" } as unknown as RefineOutput, ctx())).toThrow(TypeError);
  });

  it("C-REFINE-03 a context without seeds, or without params, is a TypeError", () => {
    const o = out({ op: "setDepth", depth: "flat" });
    for (const bad of [null, {}, { params: DEFAULT_PARAMS }, { seeds: SEEDS }]) {
      expect(() => refineChange(o, bad as never)).toThrow(TypeError);
      expect(() => refineChange(o, bad as never)).toThrow(/^refineChange/);
    }
  });

  it("C-REFINE-03 an unknown op, a missing field or a degree out of range is a RangeError", () => {
    for (const op of [
      { op: "setDensity" },
      { op: "setChroma" },
      { op: "setChroma", chroma: "loud" },
      { op: "shiftHue", degrees: 10 },
      { op: "shiftHue", slot: "primary" },
      { op: "shiftHue", slot: "primary", degrees: 0 },
      { op: "shiftHue", slot: "primary", degrees: 61 },
      { op: "shiftHue", slot: "primary", degrees: 1.5 },
      { op: "shiftHue", slot: "ink", degrees: 5 },
      { op: "setPairing", pairing: "nope" },
    ]) {
      expect(() => refineChange(out(op as RefineOp), ctx())).toThrow(RangeError);
      expect(() => refineChange(out(op as RefineOp), ctx())).toThrow(/^refineChange/);
    }
    expect(() => refineChange(out(null as unknown as RefineOp), ctx())).toThrow(TypeError);
  });

  it("C-REFINE-03 a seed that is not a color is a RangeError, a missing one a TypeError", () => {
    const o = out({ op: "shiftHue", slot: "primary", degrees: 10 });
    expect(() => refineChange(o, ctx({ ...SEEDS, primary: { l: 2, c: 0, h: 10 } }))).toThrow(
      RangeError,
    );
    expect(() =>
      refineChange(o, ctx({ ...SEEDS, primary: undefined as unknown as Oklch })),
    ).toThrow(TypeError);
  });
});
