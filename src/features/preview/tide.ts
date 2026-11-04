import { describeType } from "@/features/studio/guards";

// The sample tide of the landing's tide card (spec section 6.12, F-TPL-42): one source for the drawn
// curve, the list of the day's events and the figure's name. A semidiurnal wave (period 12.42 h)
// with a smaller diurnal term (24.84 h), so the day's two high waters differ, as real tides do. Pure.

/** The hour the sample day shows as "now" (9:30). */
export const NOW = 9.5;

/** The meters a full height of the curve stands for. */
export const TIDE_RANGE = 5;

const MEAN = 2.35;
const SEMIDIURNAL = { amplitude: 1.75, period: 12.42, peak: 6.7 };
const DIURNAL = { amplitude: 0.15, period: 24.84, peak: 19.1 };

/** An hour of the day, 0 to 24, or the R-05 error naming `name`. */
function assertHour(hour: unknown, name: string): asserts hour is number {
  if (typeof hour !== "number") {
    throw new TypeError(`${name}: hour must be a number, got ${describeType(hour)}`);
  }
  if (!Number.isFinite(hour) || hour < 0 || hour > 24) {
    throw new RangeError(`${name}: hour must be from 0 to 24, got ${hour}`);
  }
}

const wave = (hour: number, { amplitude, period, peak }: typeof SEMIDIURNAL) =>
  amplitude * Math.cos((2 * Math.PI * (hour - peak)) / period);

/** The sample water height in meters at `hour` (0 to 24). */
export function tideAt(hour: number): number {
  assertHour(hour, "tideAt");
  return MEAN + wave(hour, SEMIDIURNAL) + wave(hour, DIURNAL);
}

export type TideEvent = {
  readonly kind: "high" | "low";
  readonly hour: number;
  readonly meters: number;
};

const MINUTES = 24 * 60;

/** The day's high and low waters: the local extremes of `tideAt` at every minute, in time order. */
export const TIDE_EVENTS: readonly TideEvent[] = Object.freeze(
  Array.from({ length: MINUTES - 1 }, (_, index) => index + 1).flatMap((minute) => {
    const [before, at, after] = [minute - 1, minute, minute + 1].map((m) => tideAt(m / 60)) as [
      number,
      number,
      number,
    ];
    const kind = at > before && at > after ? "high" : at < before && at < after ? "low" : null;
    return kind === null ? [] : [Object.freeze({ kind, hour: minute / 60, meters: at })];
  }),
);

/** `hour` as a clock time, `hh:mm`, rounded to the nearest minute: 6.7 is "06:42". */
export function clock(hour: number): string {
  assertHour(hour, "clock");
  const minutes = Math.round(hour * 60);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}
