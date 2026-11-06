import { describe, expect, it } from "vitest";
import { applyPreset, generateSystem, withMotion } from "@/engine";
import {
  DIRECTION_PARAM_KEYS,
  mergeParams,
  paramsMatchSpec,
  paramsOfSpec,
  parseParams,
  touchesPreset,
} from "@/features/studio/params";
import { defaultSpec } from "../../spec/support";
import { CUSTOM_TOKENS } from "../../support/motion";
import { FRESH_PARAMS } from "./support";

// Cases C-STUD5-01, 02, 03 and 05 of docs/specs/05-motion-3d.md, section 14.2 (R5-14).

const CUSTOM = withMotion(defaultSpec(), CUSTOM_TOKENS);

function withBounce(bounce: number) {
  const tokens = structuredClone(CUSTOM_TOKENS);
  tokens.springs.snappy.bounce = bounce;
  return tokens;
}

describe("the studio's parameters hold motion tokens", () => {
  it("C-STUD5-01 lists motionTokens last", () => {
    expect(DIRECTION_PARAM_KEYS).toHaveLength(19);
    expect(DIRECTION_PARAM_KEYS.slice(-2)).toEqual(["rules", "motionTokens"]);
  });

  it("C-STUD5-01 keeps tokens parseParams accepts and gives null for the rest", () => {
    expect(parseParams({ ...FRESH_PARAMS, motionTokens: CUSTOM_TOKENS })?.motionTokens).toEqual(
      CUSTOM_TOKENS,
    );
    expect(parseParams({ ...FRESH_PARAMS, motionTokens: {} })).toBeNull();
    expect(parseParams({ ...FRESH_PARAMS, motionTokens: withBounce(2) })).toBeNull();
  });

  it("C-STUD5-02 replaces the whole set, removes it on undefined, and throws on a bad type", () => {
    const set = mergeParams(FRESH_PARAMS, { motionTokens: CUSTOM_TOKENS });
    expect(set.motionTokens).toEqual(CUSTOM_TOKENS);
    const removed = mergeParams(set, { motionTokens: undefined });
    expect("motionTokens" in removed).toBe(false);
    expect(removed).toEqual(FRESH_PARAMS);
    expect(() => mergeParams(FRESH_PARAMS, { motionTokens: 5 as never })).toThrow(TypeError);
    expect(() => mergeParams(FRESH_PARAMS, { motionTokens: 5 as never })).toThrow(/^mergeParams/);
  });

  it("C-STUD5-03 leaves the preset alone when only the tokens change, and keeps them on a preset", () => {
    const withTokens = { ...FRESH_PARAMS, motionTokens: CUSTOM_TOKENS };
    expect(touchesPreset(FRESH_PARAMS, withTokens)).toBe(false);
    expect(applyPreset(withTokens, "editorial").motionTokens).toBe(CUSTOM_TOKENS);
  });

  it("C-STUD5-05 matches the params a spec records", () => {
    expect(paramsMatchSpec(paramsOfSpec(CUSTOM).params, CUSTOM)).toBe(true);
    expect(paramsMatchSpec(paramsOfSpec(defaultSpec()).params, CUSTOM)).toBe(false);
    expect(generateSystem(paramsOfSpec(CUSTOM).params, CUSTOM.meta.seed)).toEqual(CUSTOM);
  });
});
