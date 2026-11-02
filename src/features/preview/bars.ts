import { assertRecord, assertString, describeType } from "@/features/studio/guards";

// The stacked bars of the dashboard's chart (spec section 6.13, F-TPL-22): one source for the drawn
// bars, the figure's accessible name and its data table. Each series stacks on the ones before it,
// column by column, so a column's bar runs from 0 to its total without a gap. Pure; its checks
// (R-05) name `stackBars`: a wrong type is a TypeError, a value outside its domain a RangeError.

/** One kind of value: one count per column. */
export type BarSeries = { readonly name: string; readonly values: readonly number[] };

/** One series' part of one column's bar, in data units. */
export type BarSegment = {
  readonly series: number;
  readonly column: number;
  readonly from: number;
  readonly to: number;
};

export type BarStack = {
  readonly columnTotals: readonly number[];
  readonly seriesTotals: readonly number[];
  readonly total: number;
  /** The first column with the largest total. */
  readonly peak: number;
  /** The axis top: the largest column total rounded up to a multiple of the step, at least one step. */
  readonly max: number;
  /** 0, step, … max. */
  readonly ticks: readonly number[];
  /** Column by column, series by series; a zero value has no segment. */
  readonly segments: readonly BarSegment[];
};

/** The chart roles a series can paint with: `chart-1` to `chart-5`. */
const MAX_SERIES = 5;

const isCount = (value: number) => Number.isInteger(value) && value >= 0;

function checkSeries(series: unknown): asserts series is readonly BarSeries[] {
  if (!Array.isArray(series)) {
    throw new TypeError(`stackBars: series must be an array, got ${describeType(series)}`);
  }
  for (const [index, entry] of series.entries()) {
    assertRecord(entry, `stackBars: series[${index}]`);
    assertString(entry.name, `stackBars: series[${index}].name`);
    if (!Array.isArray(entry.values)) {
      throw new TypeError(
        `stackBars: series[${index}].values must be an array, got ${describeType(entry.values)}`,
      );
    }
    for (const value of entry.values) {
      if (typeof value !== "number") {
        throw new TypeError(
          `stackBars: series[${index}].values must hold numbers, got ${describeType(value)}`,
        );
      }
    }
  }
  if (series.length === 0 || series.length > MAX_SERIES) {
    throw new RangeError(`stackBars: series must hold 1 to ${MAX_SERIES}, got ${series.length}`);
  }
  const columns = (series[0] as BarSeries).values.length;
  if (columns === 0) throw new RangeError("stackBars: a series must hold at least one value");
  for (const [index, entry] of (series as readonly BarSeries[]).entries()) {
    if (entry.values.length !== columns) {
      throw new RangeError(
        `stackBars: series[${index}] holds ${entry.values.length} values, not ${columns}`,
      );
    }
    const bad = entry.values.find((value) => !isCount(value));
    if (bad !== undefined) {
      throw new RangeError(`stackBars: series[${index}] holds ${bad}, not a count`);
    }
  }
}

function checkStep(step: unknown): asserts step is number {
  if (typeof step !== "number") {
    throw new TypeError(`stackBars: step must be a number, got ${describeType(step)}`);
  }
  if (!Number.isInteger(step) || step <= 0) {
    throw new RangeError(`stackBars: step must be a positive integer, got ${step}`);
  }
}

/** The series stacked column by column, with their totals and an axis that rounds up to `step`. */
export function stackBars(series: readonly BarSeries[], step: number): BarStack {
  checkSeries(series);
  checkStep(step);
  const columns = (series[0] as BarSeries).values.length;
  const columnTotals: number[] = [];
  const segments: BarSegment[] = [];
  for (let column = 0; column < columns; column++) {
    let from = 0;
    for (const [index, entry] of series.entries()) {
      const value = entry.values[column] ?? 0;
      if (value === 0) continue;
      segments.push(Object.freeze({ series: index, column, from, to: from + value }));
      from += value;
    }
    columnTotals.push(from);
  }
  const seriesTotals = series.map((entry) => entry.values.reduce((sum, value) => sum + value, 0));
  const largest = Math.max(...columnTotals);
  const max = Math.max(step, Math.ceil(largest / step) * step);
  return Object.freeze({
    columnTotals: Object.freeze(columnTotals),
    seriesTotals: Object.freeze(seriesTotals),
    total: seriesTotals.reduce((sum, value) => sum + value, 0),
    peak: columnTotals.indexOf(largest),
    max,
    ticks: Object.freeze(Array.from({ length: max / step + 1 }, (_, index) => index * step)),
    segments: Object.freeze(segments),
  });
}
