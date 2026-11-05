import { describe, expect, it } from "vitest";
import { words } from "@/ai/lexicon/match";
import {
  type Density,
  type DirectionParams,
  type Oklch,
  TYPE_CONTEXTS,
  type TypeContext,
  typeScale,
} from "@/engine";
import {
  CHIPS,
  type Chip,
  type ChipContext,
  chipChange,
  chipsChange,
  chipWords,
  NARROW_RATIO,
  RATIO_LADDER,
} from "@/features/ai/steer";
import { copyProblems } from "../../ai/copy-rules";
import { DEFAULT_PARAMS } from "../../spec/support";

// Cases C-CHIP-01 to C-CHIP-10 of docs/specs/04-ai.md, section 14.5 (R4-44, R4-45, section 8). The
// equivalence of C-CHIP-08's last clause (the matcher's `words`) came with Task 4.6b (ruling P1).

const CTX = (over: {
  params?: Partial<DirectionParams>;
  density?: Density;
  primary?: Oklch;
}): ChipContext => ({
  params: { ...DEFAULT_PARAMS, ...over.params },
  density: over.density ?? "comfortable",
  primary: over.primary ?? { l: 0.6, c: 0.15, h: 250 },
});

function enabled(chip: Chip, context: ChipContext) {
  const outcome = chipChange(chip, context);
  if (!outcome.enabled) throw new Error(`${chip} is disabled: ${outcome.reason}`);
  return outcome;
}

function disabled(chip: Chip, context: ChipContext): string {
  const outcome = chipChange(chip, context);
  if (outcome.enabled) throw new Error(`${chip} is enabled`);
  return outcome.reason;
}

describe("C-CHIP-01 warmer", () => {
  it("C-CHIP-01 steps a primary at 250 with tint cool to 270 and sets the tint warm", () => {
    const out = enabled("warmer", CTX({ params: { neutralTint: "cool" } }));
    expect(out.patch.primary).toEqual({ l: 0.6, c: 0.15, h: 270 });
    expect(out.patch.neutralTint).toBe("warm");
    expect(out.density).toBeUndefined();
  });

  it("C-CHIP-01 steps a primary at 40 to 50", () => {
    const out = enabled("warmer", CTX({ primary: { l: 0.6, c: 0.15, h: 40 } }));
    expect(out.patch.primary?.h).toBe(50);
  });

  it("C-CHIP-01 at 50 with tint cool changes the tint only", () => {
    const out = enabled(
      "warmer",
      CTX({ params: { neutralTint: "cool" }, primary: { l: 0.6, c: 0.15, h: 50 } }),
    );
    expect(out.patch).toEqual({ neutralTint: "warm" });
  });

  it("C-CHIP-01 at 50 with tint warm is disabled with its reason", () => {
    expect(
      disabled(
        "warmer",
        CTX({ params: { neutralTint: "warm" }, primary: { l: 0.6, c: 0.15, h: 50 } }),
      ),
    ).toBe("Already as warm as this chip goes.");
  });

  it("C-CHIP-01 an achromatic primary with tint warm is disabled", () => {
    expect(
      disabled(
        "warmer",
        CTX({ params: { neutralTint: "warm" }, primary: { l: 0.6, c: 0, h: null } }),
      ),
    ).toBe("Already as warm as this chip goes.");
  });

  it("C-CHIP-01 an achromatic primary with another tint sets the tint only", () => {
    const out = enabled("warmer", CTX({ primary: { l: 0.6, c: 0, h: null } }));
    expect(out.patch).toEqual({ neutralTint: "warm" });
  });

  it("C-CHIP-01 an unlocked primary comes back as a locked seed", () => {
    const out = enabled("warmer", CTX({ params: { neutralTint: "warm" } }));
    expect(out.patch).toEqual({ primary: { l: 0.6, c: 0.15, h: 270 } });
  });

  it("C-CHIP-01 at 230 the step is d = -180 and the hue moves to 210", () => {
    const out = enabled(
      "warmer",
      CTX({ params: { neutralTint: "warm" }, primary: { l: 0.6, c: 0.15, h: 230 } }),
    );
    expect(out.patch.primary?.h).toBe(210);
  });
});

describe("C-CHIP-02 cooler", () => {
  it("C-CHIP-02 steps the short way toward 250 (from 40 down to 20) and sets the tint cool", () => {
    const out = enabled("cooler", CTX({ primary: { l: 0.6, c: 0.15, h: 40 } }));
    expect(out.patch.primary?.h).toBe(20);
    expect(out.patch.neutralTint).toBe("cool");
  });

  it("C-CHIP-02 wraps through 0: from 350 steps down, from 10 steps down past 0, from 130 steps up", () => {
    expect(enabled("cooler", CTX({ primary: { l: 0.6, c: 0.15, h: 350 } })).patch.primary?.h).toBe(
      330,
    );
    expect(enabled("cooler", CTX({ primary: { l: 0.6, c: 0.15, h: 10 } })).patch.primary?.h).toBe(
      350,
    );
    expect(enabled("cooler", CTX({ primary: { l: 0.6, c: 0.15, h: 130 } })).patch.primary?.h).toBe(
      150,
    );
  });

  it("C-CHIP-02 at 250 with tint cool is disabled with its own reason", () => {
    expect(disabled("cooler", CTX({ params: { neutralTint: "cool" } }))).toBe(
      "Already as cool as this chip goes.",
    );
  });

  it("C-CHIP-02 at 250 with another tint sets the tint only", () => {
    expect(enabled("cooler", CTX({})).patch).toEqual({ neutralTint: "cool" });
  });
});

describe("C-CHIP-03 bolder and quieter", () => {
  it("C-CHIP-03 bolder goes muted, balanced, vivid and is disabled at vivid", () => {
    expect(enabled("bolder", CTX({ params: { chroma: "muted" } })).patch).toEqual({
      chroma: "balanced",
    });
    expect(enabled("bolder", CTX({ params: { chroma: "balanced" } })).patch).toEqual({
      chroma: "vivid",
    });
    expect(disabled("bolder", CTX({ params: { chroma: "vivid" } }))).toBe(
      "Chroma is already vivid.",
    );
  });

  it("C-CHIP-03 quieter goes the other way and is disabled at muted", () => {
    expect(enabled("quieter", CTX({ params: { chroma: "vivid" } })).patch).toEqual({
      chroma: "balanced",
    });
    expect(enabled("quieter", CTX({ params: { chroma: "balanced" } })).patch).toEqual({
      chroma: "muted",
    });
    expect(disabled("quieter", CTX({ params: { chroma: "muted" } }))).toBe(
      "Chroma is already muted.",
    );
  });

  it("C-CHIP-03 no chip's reason holds a banned word, an exclamation mark, a British spelling or an emoji", () => {
    const reasons: string[] = [];
    for (const chip of CHIPS) {
      for (const context of [
        CTX({
          params: { chroma: "vivid", radius: "round", depth: "layered", neutralTint: "warm" },
        }),
        CTX({ params: { chroma: "muted", radius: "sharp", depth: "flat", neutralTint: "cool" } }),
        CTX({
          params: { neutralTint: "warm", type: { context: "poster", ratio: 1.618 } },
          primary: { l: 0.6, c: 0, h: null },
        }),
        CTX({
          params: { neutralTint: "cool", type: { context: "poster", ratio: 1.618 } },
          primary: { l: 0.6, c: 0, h: null },
        }),
      ]) {
        const outcome = chipChange(chip, context);
        if (!outcome.enabled) reasons.push(outcome.reason);
      }
    }
    expect(new Set(reasons).size).toBe(7);
    for (const reason of reasons) expect(copyProblems(reason), reason).toEqual([]);
  });
});

describe("C-CHIP-04 softer and sharper", () => {
  it("C-CHIP-04 softer from sharp and flat gives soft and soft", () => {
    expect(enabled("softer", CTX({ params: { radius: "sharp", depth: "flat" } })).patch).toEqual({
      radius: "soft",
      depth: "soft",
    });
  });

  it("C-CHIP-04 softer from soft and layered gives round only", () => {
    expect(enabled("softer", CTX({ params: { radius: "soft", depth: "layered" } })).patch).toEqual({
      radius: "round",
    });
  });

  it("C-CHIP-04 softer at round and layered is disabled with its reason", () => {
    expect(disabled("softer", CTX({ params: { radius: "round", depth: "layered" } }))).toBe(
      "Radius and depth are already at their softest.",
    );
  });

  it("C-CHIP-04 sharper mirrors it", () => {
    expect(
      enabled("sharper", CTX({ params: { radius: "round", depth: "layered" } })).patch,
    ).toEqual({
      radius: "soft",
      depth: "soft",
    });
    expect(enabled("sharper", CTX({ params: { radius: "sharp", depth: "soft" } })).patch).toEqual({
      depth: "flat",
    });
    expect(disabled("sharper", CTX({ params: { radius: "sharp", depth: "flat" } }))).toBe(
      "Radius and depth are already at their sharpest.",
    );
  });
});

describe("C-CHIP-05 airier", () => {
  it("C-CHIP-05 from dense in product gives compact and ratio 1.333", () => {
    const out = enabled("airier", CTX({ density: "dense" }));
    expect(out.density).toBe("compact");
    expect(out.patch).toEqual({ type: { ratio: 1.333 } });
  });

  it("C-CHIP-05 from poster with no ratio gives 1.618", () => {
    const out = enabled("airier", CTX({ params: { type: { context: "poster" } } }));
    expect(out.patch).toEqual({ type: { ratio: 1.618 } });
    expect(out.density).toBeUndefined();
  });

  it("C-CHIP-05 with ratio 1.7 the density only", () => {
    const out = enabled(
      "airier",
      CTX({ params: { type: { context: "product", ratio: 1.7 } }, density: "compact" }),
    );
    expect(out.density).toBe("comfortable");
    expect(out.patch).toEqual({});
  });

  it("C-CHIP-05 at comfortable with 1.618 is disabled with its reason", () => {
    expect(
      disabled("airier", CTX({ params: { type: { context: "product", ratio: 1.618 } } })),
    ).toBe("Spacing and type are already at their airiest.");
  });

  it("C-CHIP-05 the ladder is the seven ratios of section 8.1", () => {
    // biome-ignore lint/suspicious/noApproximativeNumericConstant: 1.414 is the published ratio
    expect([...RATIO_LADDER]).toEqual([1.125, 1.2, 1.25, 1.333, 1.414, 1.5, 1.618]);
  });
});

describe("C-CHIP-06 the narrow ratios", () => {
  it.each(TYPE_CONTEXTS)(
    "C-CHIP-06 %s: the held ratio and the context's own agree below display",
    (context: TypeContext) => {
      const own = typeScale({ context });
      const set = typeScale({ context, ratio: NARROW_RATIO[context] });
      expect(own).toHaveLength(set.length);
      own.forEach((step, i) => {
        if (step.name !== "display") expect(set[i]).toEqual(step);
      });
    },
  );

  it("C-CHIP-06 gives dense 1.2, product 1.25, marketing 1.2, editorial 1.2, poster 1.5", () => {
    expect(NARROW_RATIO).toEqual({
      dense: 1.2,
      product: 1.25,
      marketing: 1.2,
      editorial: 1.2,
      poster: 1.5,
    });
  });
});

describe("C-CHIP-07 chipsChange", () => {
  it("C-CHIP-07 composes warmer and airier", () => {
    const out = chipsChange(["warmer", "airier"], CTX({ density: "dense" }));
    expect(out.applied).toEqual(["warmer", "airier"]);
    expect(out.patch).toEqual({
      primary: { l: 0.6, c: 0.15, h: 270 },
      neutralTint: "warm",
      type: { ratio: 1.333 },
    });
    expect(out.density).toBe("compact");
  });

  it("C-CHIP-07 warmer twice moves the hue 40", () => {
    const out = chipsChange(["warmer", "warmer"], CTX({ params: { neutralTint: "warm" } }));
    expect(out.patch.primary?.h).toBe(290);
    expect(out.applied).toEqual(["warmer", "warmer"]);
  });

  it("C-CHIP-07 a disabled chip is skipped and left out of applied", () => {
    const out = chipsChange(
      ["bolder", "bolder", "bolder"],
      CTX({ params: { chroma: "balanced" } }),
    );
    expect(out.applied).toEqual(["bolder"]);
    expect(out.patch).toEqual({ chroma: "vivid" });
    expect(out.density).toBeUndefined();
  });

  it("C-CHIP-07 airier twice steps the density twice and the ratio twice, in order", () => {
    const out = chipsChange(["airier", "airier"], CTX({ density: "dense" }));
    expect(out.density).toBe("comfortable");
    // biome-ignore lint/suspicious/noApproximativeNumericConstant: 1.414 is the published ratio
    expect(out.patch).toEqual({ type: { ratio: 1.414 } });
  });

  it("C-CHIP-07 no chips gives an empty change", () => {
    expect(chipsChange([], CTX({}))).toEqual({ patch: {}, applied: [] });
  });
});

describe("C-CHIP-08 chipWords", () => {
  it("C-CHIP-08 finds each chip word once, in order of first appearance, in any case", () => {
    expect(chipWords("Make it Warmer and airier, warmer")).toEqual(["warmer", "airier"]);
  });

  it("C-CHIP-08 no suffix applies, and words that are not chips give nothing", () => {
    expect(chipWords("warm")).toEqual([]);
    expect(chipWords("warmest")).toEqual([]);
    expect(chipWords("more contrast")).toEqual([]);
    expect(chipWords("")).toEqual([]);
  });

  it("C-CHIP-08 splits on accents and punctuation as the matcher does", () => {
    expect(chipWords("WARMER—cooler;sharper!")).toEqual(["warmer", "cooler", "sharper"]);
    expect(chipWords("bóldér")).toEqual(["bolder"]);
  });

  it("C-CHIP-08 lists the seven chips", () => {
    expect([...CHIPS]).toEqual([
      "warmer",
      "cooler",
      "bolder",
      "quieter",
      "softer",
      "sharper",
      "airier",
    ]);
    expect(chipWords(CHIPS.join(" "))).toEqual([...CHIPS]);
  });

  it("C-CHIP-08 for ten sample strings, steer.ts's split gives the same tokens as the matcher's words", () => {
    const SAMPLES = [
      "Make it Warmer and airier, warmer",
      "WARMER\u2014cooler;sharper!",
      "bo\u0301lde\u0301r qu\u00edeter",
      "\uff57\uff41\uff52\uff4d\uff45\uff52 \uff43\uff4f\uff4f\uff4c\uff45\uff52",
      "A\u0130R\u0130ER softer",
      "\u02b7armer, \ufb00 sharper",
      "warmer_cooler2bolder's-sharper\tquieter\nsofter",
      "warmer\u{1f525}cooler\u6771\u4eacbolder",
      "b\u03bflder \u00dfofter airier",
      "warmers warmest cooler-ish airy",
    ];
    const isChip = (token: string): token is Chip => (CHIPS as readonly string[]).includes(token);
    const chipsIn = (tokens: readonly string[]): Chip[] => [...new Set(tokens.filter(isChip))];
    for (const sample of SAMPLES) expect(chipWords(sample), sample).toEqual(chipsIn(words(sample)));
    // The samples reach the compatibility forms, the marks and the separators, not only plain words.
    expect(SAMPLES.filter((sample) => chipWords(sample).length > 0)).toHaveLength(10);
    expect(words(SAMPLES[3] as string)).toEqual(["warmer", "cooler"]);
    expect(words(SAMPLES[5] as string)).toEqual(["warmer", "ff", "sharper"]);
  });
});

describe("C-CHIP-10 the checks of R-05", () => {
  it("C-CHIP-10 an unknown chip is a RangeError naming chipChange", () => {
    expect(() => chipChange("hotter" as Chip, CTX({}))).toThrow(RangeError);
    expect(() => chipChange("hotter" as Chip, CTX({}))).toThrow(/^chipChange/);
    expect(() => chipChange(3 as unknown as Chip, CTX({}))).toThrow(TypeError);
  });

  it("C-CHIP-10 a context that is not an object, or lacks params, is a TypeError", () => {
    for (const bad of [
      null,
      "x",
      3,
      [],
      {},
      { density: "dense", primary: { l: 0.5, c: 0, h: null } },
    ]) {
      expect(() => chipChange("warmer", bad as unknown as ChipContext)).toThrow(TypeError);
      expect(() => chipChange("warmer", bad as unknown as ChipContext)).toThrow(/^chipChange/);
    }
    expect(() =>
      chipChange("warmer", { ...CTX({}), params: null } as unknown as ChipContext),
    ).toThrow(TypeError);
    expect(() =>
      chipChange("warmer", { ...CTX({}), primary: null } as unknown as ChipContext),
    ).toThrow(TypeError);
  });

  it("C-CHIP-10 a density that is not one is a RangeError, a number a TypeError", () => {
    expect(() => chipChange("airier", { ...CTX({}), density: "tight" as Density })).toThrow(
      RangeError,
    );
    expect(() => chipChange("airier", { ...CTX({}), density: 3 as unknown as Density })).toThrow(
      TypeError,
    );
  });

  it("C-CHIP-10 a primary with l 2 is a RangeError", () => {
    const bad = { ...CTX({}), primary: { l: 2, c: 0.1, h: 10 } };
    expect(() => chipChange("warmer", bad)).toThrow(RangeError);
    expect(() => chipChange("warmer", bad)).toThrow(/^chipChange/);
  });

  it("C-CHIP-10 a chroma, radius, depth or tint outside its list is a RangeError, another type a TypeError", () => {
    for (const field of ["chroma", "radius", "depth", "neutralTint"] as const) {
      const bad = (value: unknown) => ({
        ...CTX({}),
        params: { ...DEFAULT_PARAMS, [field]: value } as DirectionParams,
      });
      expect(() => chipChange("warmer", bad("loud"))).toThrow(RangeError);
      expect(() => chipChange("warmer", bad("loud"))).toThrow(new RegExp(`^chipChange.*${field}`));
      expect(() => chipChange("warmer", bad(3))).toThrow(TypeError);
      expect(() => chipsChange(["warmer"], bad("loud"))).toThrow(/^chipsChange/);
    }
  });

  it("C-CHIP-10 a type.ratio outside (1, 2] is a RangeError, a non-number a TypeError", () => {
    const withRatio = (ratio: unknown) =>
      CTX({ params: { type: { context: "product", ratio: ratio as number } } });
    for (const ratio of [1, 0.5, 2.5, Number.NaN]) {
      expect(() => chipChange("airier", withRatio(ratio))).toThrow(RangeError);
      expect(() => chipChange("airier", withRatio(ratio))).toThrow(/^chipChange.*ratio/);
    }
    expect(() => chipChange("airier", withRatio("1.5"))).toThrow(TypeError);
  });

  it("C-CHIP-10 chipsChange and chipWords name themselves", () => {
    expect(() => chipsChange("warmer" as unknown as Chip[], CTX({}))).toThrow(/^chipsChange/);
    expect(() => chipsChange(["hotter" as Chip], CTX({}))).toThrow(RangeError);
    expect(() => chipsChange(["hotter" as Chip], CTX({}))).toThrow(/^chipsChange/);
    expect(() => chipsChange(["warmer"], null as unknown as ChipContext)).toThrow(/^chipsChange/);
    expect(() => chipWords(3 as unknown as string)).toThrow(TypeError);
    expect(() => chipWords(3 as unknown as string)).toThrow(/^chipWords/);
  });
});
