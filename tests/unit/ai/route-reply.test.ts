import { describe, expect, it } from "vitest";
import { FAILURE_KINDS } from "@/ai/chat";
import type { AiFeature } from "@/ai/features";
import { ROUTE_CODES, readRouteReply } from "@/ai/route-reply";
import { BRIEF_OUT, TEXT_SLUGS, VIBE_OUT, VISION_SLUGS } from "./fixtures";

// C-AI-15 of docs/specs/04-ai.md, section 14.2: the shared-route client reads each reply of section
// 11.1 to its `RouteReply`, and anything else to "unreachable" (R4-35).

const UNREACHABLE = { ok: false, code: "unreachable", remaining: null };

const path = { provider: "shared", slug: TEXT_SLUGS[1], tier: "fast", attempts: 2 };
const success = (remaining: number) => ({
  ok: true,
  feature: "brief",
  result: BRIEF_OUT,
  path,
  remaining,
});
const failures = [
  { tier: "primary", slug: TEXT_SLUGS[0], kind: "http", status: 503 },
  { tier: "fast", slug: TEXT_SLUGS[1], kind: "timeout" },
];

describe("C-AI-15 readRouteReply reads each row of section 11.1", () => {
  it("C-AI-15 lists the ten route codes", () => {
    expect(ROUTE_CODES).toEqual([
      "unknown-feature",
      "forbidden-origin",
      "not-configured",
      "too-large",
      "bad-request",
      "visitor-cap",
      "busy",
      "guard-unavailable",
      "pool-low",
      "all-tiers-failed",
    ]);
    expect(Object.isFrozen(ROUTE_CODES)).toBe(true);
  });

  it.each([
    [404, "unknown-feature"],
    [403, "forbidden-origin"],
    [503, "not-configured"],
    [413, "too-large"],
    [400, "bad-request"],
  ] as const)("C-AI-15 %i %s has no remaining", (status, code) => {
    expect(readRouteReply("brief", status, { ok: false, code })).toEqual({
      ok: false,
      code,
      remaining: null,
    });
  });

  it("C-AI-15 429 visitor-cap with remaining 0", () => {
    expect(readRouteReply("brief", 429, { ok: false, code: "visitor-cap", remaining: 0 })).toEqual({
      ok: false,
      code: "visitor-cap",
      remaining: 0,
    });
  });

  it.each([0, 1, 2, 3])("C-AI-15 200, a cache hit or a tier's answer, with remaining %i", (n) => {
    expect(readRouteReply("brief", 200, success(n))).toEqual({
      ok: true,
      feature: "brief",
      result: BRIEF_OUT,
      path,
      remaining: n,
    });
  });

  it("C-AI-15 200 for vibe names a vision tier", () => {
    const vision = { provider: "shared", slug: VISION_SLUGS[0], tier: "vision-1", attempts: 1 };
    const json = { ok: true, feature: "vibe", result: VIBE_OUT, path: vision, remaining: 1 };
    expect(readRouteReply("vibe", 200, json)).toEqual({ ...json });
  });

  it.each(["busy", "guard-unavailable", "pool-low"] as const)(
    "C-AI-15 503 %s with remaining",
    (code) => {
      expect(readRouteReply("refine", 503, { ok: false, code, remaining: 2 })).toEqual({
        ok: false,
        code,
        remaining: 2,
      });
    },
  );

  it.each(["guard-unavailable", "pool-low"] as const)(
    "C-AI-15 503 %s after a re-read, with the tiers tried",
    (code) => {
      expect(readRouteReply("brief", 503, { ok: false, code, remaining: 1, failures })).toEqual({
        ok: false,
        code,
        remaining: 1,
      });
    },
  );

  it("C-AI-15 502 all-tiers-failed with each tier's failure", () => {
    const all = [...failures, { tier: "fallback", slug: TEXT_SLUGS[2], kind: "schema" }];
    expect(
      readRouteReply("critique", 502, {
        ok: false,
        code: "all-tiers-failed",
        remaining: 0,
        failures: all,
      }),
    ).toEqual({ ok: false, code: "all-tiers-failed", remaining: 0 });
  });

  it("C-AI-15 reads a failure of each of the six kinds FailureKind lists (R4-11)", () => {
    for (const kind of FAILURE_KINDS) {
      const failure = kind === "http" ? { kind, status: 0 } : { kind };
      expect(
        readRouteReply("brief", 502, {
          ok: false,
          code: "all-tiers-failed",
          remaining: 2,
          failures: [{ tier: "primary", slug: TEXT_SLUGS[0], ...failure }],
        }),
        kind,
      ).toEqual({ ok: false, code: "all-tiers-failed", remaining: 2 });
    }
  });
});

describe("C-AI-15 anything else is unreachable", () => {
  it.each([
    ["a body that is not an object", 200, "ok"],
    ["null", 503, null],
    ["an array", 200, [success(2)]],
    ["a 200 for another feature", 200, { ...success(2), feature: "refine" }],
    ["a 200 with remaining 4", 200, success(4)],
    ["a 200 with remaining -1", 200, success(-1)],
    ["a 200 with remaining 1.5", 200, success(1.5)],
    ["a 200 with remaining missing", 200, { ok: true, feature: "brief", result: {}, path }],
    ["a 200 with no result", 200, { ok: true, feature: "brief", path, remaining: 1 }],
    ["a 200 with an extra key", 200, { ...success(2), cached: true }],
    ["a 200 with ok false", 200, { ...success(2), ok: false }],
    ["a 200 body under status 201", 201, success(2)],
    ["a 200 with a key path", 200, { ...success(2), path: { ...path, provider: "visitor-key" } }],
    ["a 200 with a slug that is not free", 200, { ...success(2), path: { ...path, slug: "a/b" } }],
    [
      "a 200 with a vision tier for brief",
      200,
      { ...success(2), path: { ...path, tier: "vision-1" } },
    ],
    ["a 200 with 4 attempts", 200, { ...success(2), path: { ...path, attempts: 4 } }],
    ["a 200 with 0 attempts", 200, { ...success(2), path: { ...path, attempts: 0 } }],
    ["a 200 with an extra path key", 200, { ...success(2), path: { ...path, region: "eu" } }],
    ["a 200 with no path", 200, { ...success(2), path: undefined }],
    ["a code outside ROUTE_CODES", 500, { ok: false, code: "internal", remaining: 1 }],
    ["a code that is not a string", 503, { ok: false, code: 503 }],
    ["a code under another status", 404, { ok: false, code: "busy", remaining: 1 }],
    ["a 429 with remaining 1", 429, { ok: false, code: "visitor-cap", remaining: 1 }],
    ["a 503 busy without remaining", 503, { ok: false, code: "busy" }],
    ["a 503 busy with remaining 5", 503, { ok: false, code: "busy", remaining: 5 }],
    ["a 404 with remaining", 404, { ok: false, code: "unknown-feature", remaining: 1 }],
    ["a 503 busy with failures", 503, { ok: false, code: "busy", remaining: 1, failures }],
    ["a 502 without failures", 502, { ok: false, code: "all-tiers-failed", remaining: 1 }],
    [
      "a 502 with no failure",
      502,
      { ok: false, code: "all-tiers-failed", remaining: 1, failures: [] },
    ],
    [
      "a 502 with four failures",
      502,
      { ok: false, code: "all-tiers-failed", remaining: 1, failures: [...failures, ...failures] },
    ],
    [
      "a failure of another kind",
      502,
      {
        ok: false,
        code: "all-tiers-failed",
        remaining: 1,
        failures: [{ tier: "primary", slug: TEXT_SLUGS[0], kind: "network" }],
      },
    ],
    [
      "an http failure without a status",
      502,
      {
        ok: false,
        code: "all-tiers-failed",
        remaining: 1,
        failures: [{ tier: "primary", slug: TEXT_SLUGS[0], kind: "http" }],
      },
    ],
    [
      "a status on a failure that is not http",
      502,
      {
        ok: false,
        code: "all-tiers-failed",
        remaining: 1,
        failures: [{ tier: "primary", slug: TEXT_SLUGS[0], kind: "json", status: 200 }],
      },
    ],
    [
      "a failure with upstream text",
      502,
      {
        ok: false,
        code: "all-tiers-failed",
        remaining: 1,
        failures: [{ tier: "primary", slug: TEXT_SLUGS[0], kind: "json", content: "x" }],
      },
    ],
    [
      "a failure that is not an object",
      502,
      { ok: false, code: "all-tiers-failed", remaining: 1, failures: ["http"] },
    ],
    ["an extra key on a failure reply", 403, { ok: false, code: "forbidden-origin", detail: "x" }],
  ] as const)("C-AI-15 %s", (_, status, json) => {
    expect(readRouteReply("brief", status, json)).toEqual(UNREACHABLE);
  });

  it("C-AI-15 throws TypeError and RangeError for its own arguments, naming readRouteReply", () => {
    expect(() => readRouteReply("poem" as AiFeature, 200, success(1))).toThrow(RangeError);
    expect(() => readRouteReply(null as unknown as AiFeature, 200, success(1))).toThrow(TypeError);
    expect(() => readRouteReply("brief", "200" as unknown as number, success(1))).toThrow(
      TypeError,
    );
    expect(() => readRouteReply("brief", 200.5, success(1))).toThrow(RangeError);
    expect(() => readRouteReply("brief", -1, success(1))).toThrow(/^readRouteReply: /);
  });
});
