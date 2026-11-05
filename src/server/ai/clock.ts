// The day and the cap cookie's lifetime from a time the shell read once from its injected clock
// (docs/specs/04-ai.md, R4-16, R4-18 and section 11.2). Neither reads the clock itself.

const DAY_SECONDS = 86_400;
/** 9999-12-31T23:59:59.999Z: the last time whose UTC day has a four-digit year. */
const LAST_MS = 253_402_300_799_999;

/** A time in ms since the epoch from 1970-01-01 to the end of 9999: a TypeError or a RangeError. */
function checkTime(ms: unknown, caller: string): asserts ms is number {
  if (typeof ms !== "number") {
    throw new TypeError(`${caller}: ms must be a number, got ${ms === null ? "null" : typeof ms}`);
  }
  if (!Number.isFinite(ms) || ms < 0 || ms > LAST_MS) {
    throw new RangeError(`${caller}: ms must be a time from 0 to ${LAST_MS}, got ${ms}`);
  }
}

/** The UTC day of `ms`, "YYYY-MM-DD". */
export function utcDay(ms: number): string {
  checkTime(ms, "utcDay");
  return new Date(ms).toISOString().slice(0, 10);
}

/** The whole seconds from the current second of `ms` to the next UTC midnight: 1 to 86400. */
export function secondsToUtcMidnight(ms: number): number {
  checkTime(ms, "secondsToUtcMidnight");
  return DAY_SECONDS - (Math.floor(ms / 1000) % DAY_SECONDS);
}
