import { describe, expect, it } from "vitest";
import { runGenerate } from "@/features/studio/protocol";
import { DEFAULT_PARAMS } from "../../spec/support";
import { CUSTOM_TOKENS } from "../../support/motion";

// Case C-STUD5-04 of docs/specs/05-motion-3d.md, section 14.2 (R5-10, R5-14, I-M2-03): the worker
// protocol carries motion tokens to the generator, and a bad set is an error reply.

describe("runGenerate with motion tokens", () => {
  it("C-STUD5-04 replies with a spec that holds the tokens", () => {
    const reply = runGenerate({
      id: 4,
      params: { ...DEFAULT_PARAMS, motionTokens: CUSTOM_TOKENS },
      seed: "seed-1",
    });
    expect(reply).toMatchObject({ id: 4, ok: true });
    if (!reply.ok) throw new Error("the reply was an error");
    expect(reply.spec.motion).toMatchObject(CUSTOM_TOKENS);
  });

  it("C-STUD5-04 answers a bounce of 2 with an error reply and never throws", () => {
    const tokens = structuredClone(CUSTOM_TOKENS);
    tokens.springs.snappy.bounce = 2;
    const reply = runGenerate({
      id: 4,
      params: { ...DEFAULT_PARAMS, motionTokens: tokens },
      seed: "seed-1",
    });
    expect(reply).toMatchObject({ id: 4, ok: false, error: { name: "RangeError" } });
    if (reply.ok) throw new Error("the reply was a spec");
    expect(reply.error.message.startsWith("generateSystem: params.motionTokens")).toBe(true);
  });
});
