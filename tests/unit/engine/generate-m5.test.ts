import { describe, expect, it } from "vitest";
import { generateSystem, withMotion } from "@/engine/generate";
import { paramsOfSpec } from "@/engine/params";
import { motionTokens, normalizeMotionTokens } from "@/engine/tokens/motion";
import { specId } from "@/spec/hash";
import { DesignSpecSchema } from "@/spec/schema";
import { DEFAULT_PARAMS, defaultSpec, withValue } from "../spec/support";
import { CUSTOM_TOKENS } from "../support/motion";

// Cases C-MOT5-04, 05, 06, 09 and 10 of docs/specs/05-motion-3d.md, section 14.2 (R5-10, R5-11).

const SPEC = defaultSpec();
const CUSTOM = withMotion(SPEC, CUSTOM_TOKENS);

function thrown(run: () => unknown): Error {
  try {
    run();
  } catch (error) {
    if (error instanceof Error) return error;
  }
  throw new Error("expected a throw");
}

describe("generateSystem with motionTokens", () => {
  it("C-MOT5-04 keeps the default design, and its spec id, with no tokens or the defaults", () => {
    expect(generateSystem(DEFAULT_PARAMS, "seed-1")).toEqual(SPEC);
    const same = generateSystem({ ...DEFAULT_PARAMS, motionTokens: motionTokens() }, "seed-1");
    expect(same).toEqual(SPEC);
    expect(specId(same)).toBe(specId(SPEC));
  });

  it("C-MOT5-04 writes custom tokens into motion and changes nothing else", () => {
    const spec = generateSystem({ ...DEFAULT_PARAMS, motionTokens: CUSTOM_TOKENS }, "seed-1");
    expect(spec.motion).toEqual({ feel: SPEC.motion.feel, ...CUSTOM_TOKENS });
    expect({ ...spec, motion: SPEC.motion }).toEqual(SPEC);
  });

  it("C-MOT5-05 throws TypeError for tokens of 5 and RangeError for a duration of -1", () => {
    const wrong = thrown(() =>
      generateSystem({ ...DEFAULT_PARAMS, motionTokens: 5 as never }, "s"),
    );
    expect(wrong).toBeInstanceOf(TypeError);
    expect(wrong.message).toContain("generateSystem: params.motionTokens");
    const bad = structuredClone(motionTokens());
    bad.durations.base = -1;
    const range = thrown(() => generateSystem({ ...DEFAULT_PARAMS, motionTokens: bad }, "s"));
    expect(range).toBeInstanceOf(RangeError);
    expect(range.message).toContain("generateSystem: params.motionTokens.durations.base");
  });
});

describe("paramsOfSpec with motion tokens", () => {
  it("C-MOT5-06 records no tokens for the defaults and the tokens otherwise", () => {
    expect("motionTokens" in paramsOfSpec(SPEC).params).toBe(false);
    const { params } = paramsOfSpec(CUSTOM);
    expect(params.motionTokens).toEqual(normalizeMotionTokens(CUSTOM_TOKENS));
    expect(generateSystem(params, CUSTOM.meta.seed)).toEqual(CUSTOM);
  });
});

describe("withMotion", () => {
  it("C-MOT5-09 returns the same spec for the default tokens", () => {
    expect(withMotion(SPEC, motionTokens())).toEqual(SPEC);
  });

  it("C-MOT5-09 changes only motion, and the result passes the schema", () => {
    expect(DesignSpecSchema.safeParse(CUSTOM).success).toBe(true);
    expect(CUSTOM.motion).toEqual({ feel: SPEC.motion.feel, ...CUSTOM_TOKENS });
    expect({ ...CUSTOM, motion: SPEC.motion }).toEqual(SPEC);
    expect(CUSTOM.meta.createdWith).toBe(SPEC.meta.createdWith);
  });

  it("C-MOT5-10 checks the spec first, then the tokens", () => {
    const noSpec = thrown(() => withMotion(null as never, CUSTOM_TOKENS));
    expect(noSpec).toBeInstanceOf(TypeError);
    expect(noSpec.message).toContain("withMotion: spec");
    const both = thrown(() => withMotion(null as never, null as never));
    expect(both.message).toContain("withMotion: spec");
    const version = thrown(() =>
      withMotion(withValue(SPEC, ["version"], "x") as never, CUSTOM_TOKENS),
    );
    expect(version).toBeInstanceOf(RangeError);
    expect(version.message).toMatch(/^withMotion/);
    const empty = thrown(() => withMotion(SPEC, {} as never));
    expect(empty).toBeInstanceOf(TypeError);
    expect(empty.message).toContain("withMotion: tokens.durations");
  });
});
