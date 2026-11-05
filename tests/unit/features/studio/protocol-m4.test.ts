import { describe, expect, it } from "vitest";
import { type GenerateReply, type GenerateRequest, runGenerate } from "@/features/studio/protocol";
import { freshSpec, resolvedFresh } from "./support";

// Cases C-WORK4-01 and C-WORK4-02 of docs/specs/04-ai.md, section 14.1 (R4-36, I-M2-03): the worker
// protocol carries `createdWith` to the generator, and a bad value is an error reply.

describe("runGenerate with createdWith", () => {
  it("C-WORK4-01 stamps the request's createdWith and is otherwise the generator's spec", () => {
    const reply = runGenerate({
      id: 3,
      params: resolvedFresh(),
      seed: "seed-1",
      createdWith: "on-device",
    });
    const spec = freshSpec();
    expect(reply).toEqual({
      id: 3,
      ok: true,
      spec: { ...spec, meta: { ...spec.meta, createdWith: "on-device" } },
    });
  });

  it("C-WORK4-01 writes controls for a request without createdWith", () => {
    const reply = runGenerate({ id: 3, params: resolvedFresh(), seed: "seed-1" });
    expect(reply).toEqual({ id: 3, ok: true, spec: freshSpec() });
    expect(reply.ok && reply.spec.meta.createdWith).toBe("controls");
  });

  it.each([
    ["robot", "robot", "RangeError"],
    ["a number", 5, "TypeError"],
  ])(
    "C-WORK4-02 answers createdWith %s with an error reply and never throws",
    (_, createdWith, name) => {
      const request = {
        id: 4,
        params: resolvedFresh(),
        seed: "seed-1",
        createdWith,
      } as unknown as GenerateRequest;
      let reply: GenerateReply | undefined;
      expect(() => {
        reply = runGenerate(request);
      }).not.toThrow();
      expect(reply).toEqual({
        id: 4,
        ok: false,
        error: { name, message: expect.stringMatching(/^generateSystem: options\.createdWith\b/) },
      });
    },
  );
});
