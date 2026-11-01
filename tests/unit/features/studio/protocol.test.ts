import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type DirectionParams, generateSystem } from "@/engine";
import { type GenerateReply, parseReply, runGenerate } from "@/features/studio/protocol";
import { withValue } from "../../spec/support";
import { FRESH_PARAMS, freshSpec, resolvedFresh } from "./support";

// Cases are C-WORK-01, C-WORK-02, C-WORK-11 and C-WORK-12 of docs/specs/02-studio.md, section 6.7
// (R2-13 item 2): the worker protocol and the thin worker shell around it.

const ROOT = path.resolve(import.meta.dirname, "../../../..");

describe("runGenerate", () => {
  it("C-WORK-01 returns the generator's spec with the request id, and the spec clones", () => {
    const reply = runGenerate({ id: 7, params: resolvedFresh(), seed: "seed-1" });
    expect(reply).toEqual({ id: 7, ok: true, spec: freshSpec() });
    if (!reply.ok) return;
    expect(reply.spec).toEqual(generateSystem(resolvedFresh(), "seed-1"));
    expect(structuredClone(reply.spec)).toEqual(reply.spec);
  });

  it.each([
    [
      "an enum outside its set",
      { ...FRESH_PARAMS, chroma: "loud" },
      "RangeError",
      /params\.chroma/,
    ],
    ["params that are not an object", null, "TypeError", /params must be an object/],
    ["an unknown pairing", { ...FRESH_PARAMS, pairing: "nope" }, "RangeError", /params\.pairing/],
  ])("C-WORK-02 answers %s with an error reply and never throws", (_, params, name, message) => {
    const request = { id: 3, params: params as DirectionParams, seed: "seed-1" };
    let reply: GenerateReply | undefined;
    expect(() => {
      reply = runGenerate(request);
    }).not.toThrow();
    expect(reply).toEqual({
      id: 3,
      ok: false,
      error: { name, message: expect.stringMatching(message) },
    });
  });

  it("C-WORK-02 answers an empty seed with an error reply", () => {
    expect(runGenerate({ id: 4, params: FRESH_PARAMS, seed: "" })).toMatchObject({
      id: 4,
      ok: false,
      error: { name: "RangeError" },
    });
  });

  it("C-WORK-02 answers a thrown value that is not an Error with name Error", () => {
    const params = {
      ...FRESH_PARAMS,
      get harmony(): never {
        throw "boom";
      },
    };
    expect(runGenerate({ id: 5, params, seed: "seed-1" })).toEqual({
      id: 5,
      ok: false,
      error: { name: "Error", message: "boom" },
    });
  });

  it("C-WORK-02 never throws, even for a thrown value that cannot be printed", () => {
    const unprintable = {
      toString(): never {
        throw new Error("no");
      },
    };
    const params = {
      ...FRESH_PARAMS,
      get harmony(): never {
        throw unprintable;
      },
    };
    expect(runGenerate({ id: 6, params, seed: "seed-1" })).toEqual({
      id: 6,
      ok: false,
      error: { name: "Error", message: "an unprintable value was thrown" },
    });
  });

  it.each([
    ["null", null],
    ["a string", "go"],
    ["no id", { params: FRESH_PARAMS, seed: "seed-1" }],
    ["id 0", { id: 0, params: FRESH_PARAMS, seed: "seed-1" }],
    ["a fractional id", { id: 1.5, params: FRESH_PARAMS, seed: "seed-1" }],
    ["a string id", { id: "1", params: FRESH_PARAMS, seed: "seed-1" }],
  ])("answers a request with %s as id 0 with an error naming runGenerate", (_, request) => {
    const reply = runGenerate(request as never);
    expect(reply.id).toBe(0);
    expect(reply.ok).toBe(false);
    if (reply.ok) return;
    expect(reply.error.message).toMatch(/^runGenerate: request/);
  });
});

describe("parseReply", () => {
  it("reads a reply with a spec, and an error reply", () => {
    const spec = freshSpec();
    expect(parseReply({ id: 2, ok: true, spec })).toEqual({ id: 2, ok: true, spec });
    const error = { name: "RangeError", message: "forced" };
    expect(parseReply({ id: 3, ok: false, error })).toEqual({ id: 3, ok: false, error });
  });

  it("turns a spec that fails the schema into an error reply with the same id", () => {
    const broken = withValue(freshSpec(), ["color", "roles", "light", "ring"], "#FFF");
    expect(parseReply({ id: 2, ok: true, spec: broken })).toEqual({
      id: 2,
      ok: false,
      error: { name: "TypeError", message: expect.stringMatching(/^parseReply: /) },
    });
  });

  it.each([
    ["an error without a name", { id: 2, ok: false, error: { message: "x" } }],
    ["an error that is a string", { id: 2, ok: false, error: "x" }],
    ["an ok that is not a boolean", { id: 2, ok: "yes" }],
  ])("turns %s into an error reply with the same id", (_, data) => {
    expect(parseReply(data)).toMatchObject({ id: 2, ok: false, error: { name: "TypeError" } });
  });

  it.each([[null], ["x"], [{ ok: true }], [{ id: -1, ok: true }], [{ id: 2.5, ok: false }]])(
    "gives null for a message whose id cannot be read: %j",
    (data) => {
      expect(parseReply(data)).toBeNull();
    },
  );
});

describe("generate.worker.ts", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("C-WORK-11 imports only @/engine and ./protocol, and no DOM, React or zustand", () => {
    const source = readFileSync(path.join(ROOT, "src/features/studio/generate.worker.ts"), "utf8");
    const imports = [
      ...source.matchAll(/\bfrom\s+["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']/g),
    ];
    const specifiers = imports.map((match) => match[1] ?? match[2]);
    expect(specifiers.length).toBeGreaterThan(0);
    for (const specifier of specifiers) expect(["@/engine", "./protocol"]).toContain(specifier);
    expect(source).not.toMatch(/\b(document|window|localStorage|react|zustand)\b/);
  });

  it("C-WORK-12 answers each message with runGenerate's reply, echoing the request id", async () => {
    const listeners: ((event: { data: unknown }) => void)[] = [];
    const replies: unknown[] = [];
    vi.stubGlobal(
      "addEventListener",
      (type: string, listener: (event: { data: unknown }) => void) => {
        if (type === "message") listeners.push(listener);
      },
    );
    vi.stubGlobal("postMessage", (message: unknown) => replies.push(message));
    await import("@/features/studio/generate.worker");
    expect(listeners).toHaveLength(1);
    const [onMessage] = listeners;
    onMessage({ data: { id: 41, params: { ...FRESH_PARAMS, chroma: "loud" }, seed: "seed-1" } });
    onMessage({ data: { id: 42, params: resolvedFresh(), seed: "seed-1" } });
    onMessage({ data: "garbage" });
    expect(replies).toEqual([
      { id: 41, ok: false, error: { name: "RangeError", message: expect.any(String) } },
      { id: 42, ok: true, spec: freshSpec() },
      { id: 0, ok: false, error: { name: "TypeError", message: expect.any(String) } },
    ]);
  });
});
