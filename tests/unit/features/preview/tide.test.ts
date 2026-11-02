import { describe, expect, it } from "vitest";
import { clock, TIDE_EVENTS, TIDE_RANGE, tideAt } from "@/features/preview/tide";

// The sample tide of the landing's tide card (docs/specs/02-studio.md, section 6.12): one source for
// the drawn curve, the events list and the figure's name (F-TPL-42).

const MINUTE = 1 / 60;

describe("the sample tide (section 6.12)", () => {
  it("C-TIDE-01 stays inside (0, TIDE_RANGE) at every minute of the day", () => {
    expect(TIDE_RANGE).toBe(5);
    for (let minute = 0; minute <= 24 * 60; minute++) {
      const meters = tideAt(minute * MINUTE);
      expect(meters, `${minute}`).toBeGreaterThan(0);
      expect(meters, `${minute}`).toBeLessThan(TIDE_RANGE);
    }
  });

  it("C-TIDE-02 lists the day's extremes in time order, alternating, with two different highs", () => {
    expect(Object.isFrozen(TIDE_EVENTS)).toBe(true);
    expect(TIDE_EVENTS.length).toBeGreaterThanOrEqual(3);
    for (const [index, event] of TIDE_EVENTS.entries()) {
      expect(Object.isFrozen(event)).toBe(true);
      expect(event.meters).toBe(tideAt(event.hour));
      const [before, after] = [tideAt(event.hour - MINUTE), tideAt(event.hour + MINUTE)];
      if (event.kind === "high") {
        expect(event.meters, `${event.hour}`).toBeGreaterThan(Math.max(before, after));
      } else {
        expect(event.meters, `${event.hour}`).toBeLessThan(Math.min(before, after));
      }
      const previous = TIDE_EVENTS[index - 1];
      if (previous !== undefined) {
        expect(event.hour).toBeGreaterThan(previous.hour);
        expect(event.kind).not.toBe(previous.kind);
      }
    }
    // Every extreme of the day is listed: a brute-force count over the minutes agrees.
    let extremes = 0;
    for (let minute = 1; minute < 24 * 60; minute++) {
      const [a, b, c] = [minute - 1, minute, minute + 1].map((m) => tideAt(m * MINUTE)) as [
        number,
        number,
        number,
      ];
      if ((b > a && b > c) || (b < a && b < c)) extremes++;
    }
    expect(TIDE_EVENTS).toHaveLength(extremes);
    const highs = TIDE_EVENTS.filter((event) => event.kind === "high");
    expect(highs).toHaveLength(2);
    const [first, second] = highs.map((event) => event.meters) as [number, number];
    expect(Math.abs(first - second)).toBeGreaterThanOrEqual(0.1);
  });

  it("C-TIDE-03 writes a time as hh:mm, rounded to the minute", () => {
    expect(clock(6.7)).toBe("06:42");
    expect(clock(0)).toBe("00:00");
    expect(clock(24)).toBe("24:00");
    expect(clock(9.5)).toBe("09:30");
    expect(clock(12 + 59.6 / 60)).toBe("13:00");
  });

  it("C-TIDE-04 R-05: a value that is not a number is a TypeError, an hour outside [0, 24] a RangeError", () => {
    for (const fn of [tideAt, clock] as const) {
      expect(() => fn("6" as never)).toThrow(TypeError);
      expect(() => fn("6" as never)).toThrow(new RegExp(`^${fn.name}`));
      for (const hour of [Number.NaN, Number.POSITIVE_INFINITY, -0.01, 24.01]) {
        expect(() => fn(hour)).toThrow(RangeError);
        expect(() => fn(hour)).toThrow(new RegExp(`^${fn.name}`));
      }
    }
  });
});
