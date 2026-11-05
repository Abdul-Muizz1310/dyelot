import { describe, expect, it } from "vitest";
import * as ai from "@/ai";
import { askShared } from "@/features/ai/shared";
import {
  BRIEF_IN,
  BRIEF_OUT,
  TEXT_SLUGS,
  VIBE_IN,
  VIBE_OUT,
  VISION_SLUGS,
} from "../../ai/fixtures";
import { fakeFetch, jsonResponse } from "./support";

// C-SHARED-01 of docs/specs/04-ai.md, section 14.9 (R4-35): the shared-route client posts JSON to
// /api/ai/<feature> on dyelot's own origin, reads the reply with readRouteReply, checks a 200's
// result again with parseOutput, and hands back the visitor's remaining actions as the reply gave
// them.

const signal = () => new AbortController().signal;
const PATH = { provider: "shared", slug: TEXT_SLUGS[1], tier: "fast", attempts: 2 } as const;
const okReply = (result: unknown, remaining = 2) => ({
  ok: true,
  feature: "brief",
  result,
  path: PATH,
  remaining,
});
const FAILURES = [
  { tier: "primary", slug: TEXT_SLUGS[0], kind: "http", status: 503 },
  { tier: "fast", slug: TEXT_SLUGS[1], kind: "timeout" },
  { tier: "fallback", slug: TEXT_SLUGS[2], kind: "json" },
];

describe("C-SHARED-01 askShared", () => {
  it("C-SHARED-01 posts the input as JSON to /api/ai/brief with credentials same-origin", async () => {
    const { fetch, calls } = fakeFetch([jsonResponse(200, okReply(BRIEF_OUT))]);
    const action = signal();
    await askShared(ai, "brief", BRIEF_IN, { fetch, signal: action });
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call?.url).toBe("/api/ai/brief");
    expect(call?.init.method).toBe("POST");
    expect(call?.init.credentials).toBe("same-origin");
    expect(call?.init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(String(call?.init.body))).toEqual(BRIEF_IN);
    expect(call?.init.signal).toBe(action);
  });

  it("C-SHARED-01 posts vibe to /api/ai/vibe and reads its vision path", async () => {
    const path = { provider: "shared", slug: VISION_SLUGS[0], tier: "vision-1", attempts: 1 };
    const reply = { ok: true, feature: "vibe", result: VIBE_OUT, path, remaining: 1 };
    const { fetch, calls } = fakeFetch([jsonResponse(200, reply)]);
    const result = await askShared(ai, "vibe", VIBE_IN, { fetch, signal: signal() });
    expect(calls[0]?.url).toBe("/api/ai/vibe");
    expect(result).toEqual({ ok: true, output: VIBE_OUT, path, remaining: 1 });
  });

  it("C-SHARED-01 gives the output parseOutput cleaned, the path and the remaining actions for a 200", async () => {
    const { fetch } = fakeFetch([jsonResponse(200, okReply(BRIEF_OUT, 2))]);
    const result = await askShared(ai, "brief", BRIEF_IN, { fetch, signal: signal() });
    const parsed = ai.parseOutput("brief", BRIEF_IN, BRIEF_OUT);
    if (!parsed.ok) throw new Error("BRIEF_OUT must parse");
    expect(result).toEqual({ ok: true, output: parsed.output, path: PATH, remaining: 2 });
  });

  it.each([
    [404, { ok: false, code: "unknown-feature" }, null],
    [403, { ok: false, code: "forbidden-origin" }, null],
    [503, { ok: false, code: "not-configured" }, null],
    [413, { ok: false, code: "too-large" }, null],
    [400, { ok: false, code: "bad-request" }, null],
    [429, { ok: false, code: "visitor-cap", remaining: 0 }, 0],
    [503, { ok: false, code: "busy", remaining: 3 }, 3],
    [503, { ok: false, code: "guard-unavailable", remaining: 2 }, 2],
    [503, { ok: false, code: "pool-low", remaining: 1 }, 1],
    [503, { ok: false, code: "pool-low", remaining: 1, failures: FAILURES.slice(0, 1) }, 1],
    [502, { ok: false, code: "all-tiers-failed", remaining: 0, failures: FAILURES }, 0],
  ])(
    "C-SHARED-01 maps the %i reply %j to its code, with its remaining actions",
    async (status, body, remaining) => {
      const { fetch } = fakeFetch([jsonResponse(status, body)]);
      const result = await askShared(ai, "brief", BRIEF_IN, { fetch, signal: signal() });
      expect(result).toEqual({
        ok: false,
        failure: { provider: "shared", reason: body.code },
        remaining,
      });
    },
  );

  it.each([
    ["a result that fails the schema", {}],
    ["a result with a value out of range", { ...BRIEF_OUT, chroma: "neon" }],
    ["a result whose name holds a color", { ...BRIEF_OUT, name: "Teal #00ffaa" }],
  ])(
    "C-SHARED-01 reads a 200 with %s as invalid, keeping its remaining actions",
    async (_, result) => {
      const { fetch } = fakeFetch([jsonResponse(200, okReply(result, 1))]);
      expect(await askShared(ai, "brief", BRIEF_IN, { fetch, signal: signal() })).toEqual({
        ok: false,
        failure: { provider: "shared", reason: "invalid" },
        remaining: 1,
      });
    },
  );

  it.each([
    ["a rejecting fetch", new TypeError("Failed to fetch")],
    ["an aborted fetch", new DOMException("The operation was aborted.", "AbortError")],
    ["a body that is not JSON", new Response("<html>Bad gateway</html>", { status: 502 })],
    ["a 200 for another feature", jsonResponse(200, { ...okReply(BRIEF_OUT), feature: "refine" })],
    ["a reply of another shape", jsonResponse(200, { ok: true })],
    [
      "a status the table does not hold",
      jsonResponse(500, { ok: false, code: "busy", remaining: 1 }),
    ],
    [
      "a status that is no HTTP status",
      { status: -1, text: async () => "{}" } as unknown as Response,
    ],
  ])("C-SHARED-01 reads %s as unreachable with no remaining count", async (_, answer) => {
    const { fetch } = fakeFetch([answer]);
    expect(await askShared(ai, "brief", BRIEF_IN, { fetch, signal: signal() })).toEqual({
      ok: false,
      failure: { provider: "shared", reason: "unreachable" },
      remaining: null,
    });
  });

  it("C-SHARED-01 reads a body that fails mid-read as unreachable", async () => {
    const body = new ReadableStream({
      start(controller) {
        controller.error(new TypeError("network error"));
      },
    });
    const { fetch } = fakeFetch([new Response(body, { status: 200 })]);
    const result = await askShared(ai, "brief", BRIEF_IN, { fetch, signal: signal() });
    expect(result).toEqual({
      ok: false,
      failure: { provider: "shared", reason: "unreachable" },
      remaining: null,
    });
  });

  it("C-SHARED-01 throws TypeError or RangeError naming askShared for what it cannot ask", async () => {
    const { fetch, calls } = fakeFetch([]);
    const deps = { fetch, signal: signal() };
    const wrong = (value: unknown) => value as never;
    await expect(askShared(wrong(null), "brief", BRIEF_IN, deps)).rejects.toThrow(
      /^askShared: ai must be/,
    );
    await expect(askShared(ai, wrong("poem"), wrong(BRIEF_IN), deps)).rejects.toThrow(RangeError);
    await expect(askShared(ai, "brief", wrong({ brief: "" }), deps)).rejects.toThrow(
      /^askShared: input is not a brief input/,
    );
    await expect(askShared(ai, "brief", wrong("tea"), deps)).rejects.toThrow(TypeError);
    await expect(
      askShared(ai, "brief", BRIEF_IN, { fetch: wrong(1), signal: signal() }),
    ).rejects.toThrow(/^askShared: deps\.fetch must be a function/);
    await expect(askShared(ai, "brief", BRIEF_IN, { fetch, signal: wrong({}) })).rejects.toThrow(
      /^askShared: deps\.signal must be an AbortSignal/,
    );
    expect(calls).toEqual([]);
  });
});
