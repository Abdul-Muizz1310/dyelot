import { describe, expect, it } from "vitest";
import { guardVerdict, readKeyRemaining } from "@/ai/guard";

// C-AI-20 of docs/specs/04-ai.md, section 14.2: the guard's arithmetic (R4-16, R4-17, section 11.3).

const keyBody = (remaining: unknown) => ({
  data: { free_model_daily_requests: { used: 12, limit: 50, remaining } },
});

describe("C-AI-20 guardVerdict", () => {
  it.each([
    [38, 35, "ok"],
    [37, 35, "pool-low"],
    [null, 35, "guard-unavailable"],
    [2, 0, "pool-low"],
    [3, 0, "ok"],
    [50, 35, "ok"],
    [0, 0, "pool-low"],
    [1003, 1000, "ok"],
    [1002, 1000, "pool-low"],
    [37.5, 35, "pool-low"],
    [38.5, 35, "ok"],
  ] as const)("C-AI-20 guardVerdict(%s, %i) is %s", (remaining, reserve, verdict) => {
    expect(guardVerdict(remaining, reserve)).toBe(verdict);
  });

  it("C-AI-20 throws RangeError for a reserve outside 0 to 1000 or not an integer", () => {
    for (const reserve of [1001, 1.5, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => guardVerdict(1, reserve), String(reserve)).toThrow(RangeError);
      expect(() => guardVerdict(1, reserve)).toThrow(/^guardVerdict: /);
    }
  });

  it("C-AI-20 throws RangeError for a remaining that readKeyRemaining never gives", () => {
    for (const remaining of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => guardVerdict(remaining, 35), String(remaining)).toThrow(RangeError);
    }
  });

  it("C-AI-20 throws TypeError for a wrong type, naming guardVerdict", () => {
    expect(() => guardVerdict(1, "35" as unknown as number)).toThrow(TypeError);
    expect(() => guardVerdict("38" as unknown as number, 35)).toThrow(TypeError);
    expect(() => guardVerdict(undefined as unknown as null, 35)).toThrow(/^guardVerdict: /);
  });
});

describe("C-AI-20 readKeyRemaining", () => {
  it("C-AI-20 reads 38 from the /key body", () => {
    expect(readKeyRemaining(keyBody(38))).toBe(38);
    expect(readKeyRemaining(keyBody(0))).toBe(0);
  });

  it.each([
    ["a missing field", { data: { free_model_daily_requests: { used: 12, limit: 50 } } }],
    ['"38"', keyBody("38")],
    ["-1", keyBody(-1)],
    ["NaN", keyBody(Number.NaN)],
    ["Infinity", keyBody(Number.POSITIVE_INFINITY)],
    ["null", keyBody(null)],
    ["no free_model_daily_requests", { data: {} }],
    ["a data array", { data: [] }],
    ["no data", {}],
    ["null", null],
    ["a string", "remaining: 38"],
    ["an array", [keyBody(38)]],
    ["undefined", undefined],
  ])("C-AI-20 gives null for %s", (_, json) => {
    expect(readKeyRemaining(json)).toBeNull();
  });
});
