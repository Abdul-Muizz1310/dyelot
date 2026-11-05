import { describe, expect, it } from "vitest";
import { secondsToUtcMidnight, utcDay } from "@/server/ai/clock";
import { NOW, TODAY } from "../ai/fixtures";

// C-CLOCK-01 of docs/specs/04-ai.md, section 14.7: the UTC day and the seconds to the next UTC
// midnight, from the time the shell's injected clock read (R4-16, R4-18, section 11.2).

const at = (hours: number, minutes: number, seconds: number, ms = 0) =>
  Date.UTC(2026, 10, 5, hours, minutes, seconds, ms);
/** 9999-12-31T23:59:59.999Z, the last moment whose day has four year digits. */
const LAST_MS = 253_402_300_799_999;

describe("C-CLOCK-01 utcDay and secondsToUtcMidnight", () => {
  it('C-CLOCK-01 utcDay(NOW) is "2026-11-05"', () => {
    expect(NOW).toBe(at(12, 0, 0));
    expect(utcDay(NOW)).toBe(TODAY);
    expect(TODAY).toBe("2026-11-05");
  });

  it("C-CLOCK-01 utcDay changes at UTC midnight, not before", () => {
    expect(utcDay(at(0, 0, 0))).toBe("2026-11-05");
    expect(utcDay(at(23, 59, 59, 999))).toBe("2026-11-05");
    expect(utcDay(at(24, 0, 0))).toBe("2026-11-06");
    expect(utcDay(0)).toBe("1970-01-01");
    expect(utcDay(LAST_MS)).toBe("9999-12-31");
  });

  it("C-CLOCK-01 secondsToUtcMidnight is 43200 at NOW, 1 at 23:59:59 and 86400 at 00:00:00", () => {
    expect(secondsToUtcMidnight(NOW)).toBe(43_200);
    expect(secondsToUtcMidnight(at(23, 59, 59))).toBe(1);
    expect(secondsToUtcMidnight(at(23, 59, 59, 999))).toBe(1);
    expect(secondsToUtcMidnight(at(0, 0, 0))).toBe(86_400);
    expect(secondsToUtcMidnight(at(0, 0, 0, 999))).toBe(86_400);
    expect(secondsToUtcMidnight(at(0, 0, 1))).toBe(86_399);
    expect(secondsToUtcMidnight(0)).toBe(86_400);
  });

  it("C-CLOCK-01 secondsToUtcMidnight counts from the current second to the next midnight", () => {
    for (let ms = at(0, 0, 0); ms < at(24, 0, 0); ms += 997_003) {
      const seconds = secondsToUtcMidnight(ms);
      expect(Number.isInteger(seconds)).toBe(true);
      expect(seconds).toBeGreaterThanOrEqual(1);
      expect(seconds).toBeLessThanOrEqual(86_400);
      expect(Math.floor(ms / 1000) * 1000 + seconds * 1000).toBe(at(24, 0, 0));
    }
  });

  it.each([
    ["utcDay", utcDay],
    ["secondsToUtcMidnight", secondsToUtcMidnight],
  ] as const)(
    "C-CLOCK-01 %s refuses a time of the wrong type or outside its domain",
    (name, fn) => {
      for (const ms of ["1793880000000", null, undefined, BigInt(1)]) {
        expect(() => fn(ms as unknown as number), String(ms)).toThrow(TypeError);
        expect(() => fn(ms as unknown as number)).toThrow(new RegExp(`^${name}: `));
      }
      for (const ms of [Number.NaN, Number.POSITIVE_INFINITY, -1, LAST_MS + 1]) {
        expect(() => fn(ms), String(ms)).toThrow(RangeError);
        expect(() => fn(ms)).toThrow(new RegExp(`^${name}: `));
      }
    },
  );
});
