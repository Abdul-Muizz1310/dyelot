import { describe, expect, expectTypeOf, it } from "vitest";
import { generateSystem } from "@/engine/generate";
import { freshParams, resolveParams } from "@/engine/params";
import { applyPreset, PRESET_IDS, PRESETS, type PresetId, presetOf } from "@/engine/presets";
import type { CreatedWith, DesignSpec } from "@/spec";
import { specId } from "@/spec/hash";
import type { DirectionParams } from "@/spec/schema";
import { DEFAULT_PARAMS, defaultSpec } from "../spec/support";

// Cases C-GEN4-01 to C-GEN4-04 of docs/specs/04-ai.md, section 14.1 (R4-36): `generateSystem`'s
// optional third argument stamps `meta.createdWith`, and absent it writes "controls" as before.

/** The error `run` throws; fails the test when it returns. */
function thrown(run: () => unknown): Error {
  try {
    run();
  } catch (error) {
    if (error instanceof Error) return error;
    throw new Error(`threw a non-Error: ${String(error)}`);
  }
  throw new Error("expected a throw, but the call returned");
}

/** A spec with `meta.createdWith` set back to "controls", to compare with SPEC. */
const asControls = (spec: DesignSpec): DesignSpec => ({
  ...spec,
  meta: { ...spec.meta, createdWith: "controls" },
});

describe("generateSystem's options", () => {
  it.each(["lexicon", "on-device", "visitor-key", "model:google/gemma-4-26b-a4b-it:free"] as const)(
    "C-GEN4-01 writes createdWith %s and is otherwise SPEC",
    (createdWith) => {
      const spec = generateSystem(DEFAULT_PARAMS, "seed-1", { createdWith });
      expect(spec.meta.createdWith).toBe(createdWith);
      expect(asControls(spec)).toEqual(defaultSpec());
    },
  );

  it("C-GEN4-01 equals SPEC, spec id included, with no options, {} and createdWith controls", () => {
    const SPEC = defaultSpec();
    const specs = [
      generateSystem(DEFAULT_PARAMS, "seed-1"),
      generateSystem(DEFAULT_PARAMS, "seed-1", {}),
      generateSystem(DEFAULT_PARAMS, "seed-1", { createdWith: "controls" }),
      // Added boundary: a key holding undefined is absent, as the options' type allows.
      generateSystem(DEFAULT_PARAMS, "seed-1", { createdWith: undefined }),
    ];
    for (const spec of specs) {
      expect(spec).toEqual(SPEC);
      expect(spec.meta.createdWith).toBe("controls");
      expect(specId(spec)).toBe(specId(SPEC));
    }
  });

  it.each([
    ["null", null],
    ["a number", 5],
    ["a string", "x"],
    ["an array", []],
  ])(
    "C-GEN4-02 options that are %s throw a TypeError naming generateSystem: options",
    (_, options) => {
      const error = thrown(() => generateSystem(DEFAULT_PARAMS, "seed-1", options as never));
      expect(error).toBeInstanceOf(TypeError);
      expect(error.message).toMatch(/^generateSystem: options(?![.\w])/);
    },
  );

  it("C-GEN4-02 an unknown option throws a RangeError naming it", () => {
    const error = thrown(() => generateSystem(DEFAULT_PARAMS, "seed-1", { by: "x" } as never));
    expect(error).toBeInstanceOf(RangeError);
    expect(error.message).toMatch(/^generateSystem: options\.by\b/);
  });

  it("C-GEN4-02 a createdWith that is not a string throws a TypeError naming it", () => {
    const error = thrown(() =>
      generateSystem(DEFAULT_PARAMS, "seed-1", { createdWith: 5 } as never),
    );
    expect(error).toBeInstanceOf(TypeError);
    expect(error.message).toMatch(/^generateSystem: options\.createdWith\b/);
  });

  it.each(["robot", "model:", "model:a b"])(
    "C-GEN4-02 createdWith %j, outside the schema, throws a RangeError naming it",
    (createdWith) => {
      const error = thrown(() =>
        generateSystem(DEFAULT_PARAMS, "seed-1", { createdWith } as never),
      );
      expect(error).toBeInstanceOf(RangeError);
      expect(error.message).toMatch(/^generateSystem: options\.createdWith\b/);
    },
  );

  it("C-GEN4-03 types the options and CreatedWith as the spec's own field", () => {
    expectTypeOf(generateSystem).parameters.toEqualTypeOf<
      [DirectionParams, string, { readonly createdWith?: CreatedWith }?]
    >();
    expectTypeOf<CreatedWith>().toEqualTypeOf<DesignSpec["meta"]["createdWith"]>();
    const stamped: CreatedWith = generateSystem(DEFAULT_PARAMS, "seed-1", {
      createdWith: "lexicon",
    }).meta.createdWith;
    expect(stamped).toBe("lexicon");
  });
});

/** The golden of a preset (C-PMATCH's), generated with `createdWith`. */
const golden = (id: PresetId, createdWith: CreatedWith): DesignSpec =>
  generateSystem(
    resolveParams({ ...applyPreset(freshParams(), id), name: PRESETS[id].label }, "seed-1"),
    "seed-1",
    { createdWith },
  );

describe("presetOf on a stamped design", () => {
  it.each(PRESET_IDS)(
    "C-GEN4-04 the %s design generated with createdWith lexicon is that preset",
    (id) => {
      const spec = golden(id, "lexicon");
      expect(spec.meta.createdWith).toBe("lexicon");
      expect(presetOf(spec)).toBe(id);
    },
  );

  it("C-GEN4-04 every createdWith but import matches; import never does", () => {
    for (const createdWith of ["controls", "on-device", "visitor-key", "model:x/y:free"] as const) {
      const spec = golden("glass", createdWith);
      expect(spec.meta.createdWith, createdWith).toBe(createdWith);
      expect(presetOf(spec), createdWith).toBe("glass");
    }
    const imported = golden("glass", "import");
    expect(imported.meta.createdWith).toBe("import");
    expect(presetOf(imported)).toBeNull();
  });
});
