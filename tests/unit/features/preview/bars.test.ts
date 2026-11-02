import { describe, expect, it } from "vitest";
import { type BarSeries, stackBars } from "@/features/preview/bars";

// The stacked bars of the dashboard's chart (docs/specs/02-studio.md, section 6.13): one source for
// the drawn bars, the figure's name and its data table (F-TPL-22).

const TWO: readonly BarSeries[] = [
  { name: "a", values: [1, 3] },
  { name: "b", values: [2, 0] },
];

/** Whether a value and every object inside it is frozen. */
function deepFrozen(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return true;
  return Object.isFrozen(value) && Object.values(value).every(deepFrozen);
}

describe("the stacked bars (section 6.13)", () => {
  it("C-BARS-01 stacks each column's values from zero, series by series, and sums them", () => {
    const stack = stackBars(TWO, 5);
    expect(stack.columnTotals).toEqual([3, 3]);
    expect(stack.seriesTotals).toEqual([4, 2]);
    expect(stack.total).toBe(6);
    expect(stack.peak).toBe(0);
    expect(stack.max).toBe(5);
    expect(stack.ticks).toEqual([0, 5]);
    expect(stack.segments).toEqual([
      { series: 0, column: 0, from: 0, to: 1 },
      { series: 1, column: 0, from: 1, to: 3 },
      { series: 0, column: 1, from: 0, to: 3 },
    ]);
    // In every column the segments run without a gap from 0 to the column's total.
    const week: readonly BarSeries[] = [
      { name: "high", values: [4, 0, 6, 2, 9, 3, 1] },
      { name: "low", values: [3, 5, 0, 4, 7, 2, 2] },
      { name: "draft", values: [6, 4, 5, 0, 8, 1, 3] },
      { name: "late", values: [2, 3, 1, 2, 0, 4, 2] },
      { name: "battery", values: [0, 1, 2, 1, 2, 0, 3] },
    ];
    const full = stackBars(week, 5);
    for (let column = 0; column < 7; column++) {
      const parts = full.segments.filter((segment) => segment.column === column);
      expect(
        parts.every((part) => part.to > part.from),
        `${column}`,
      ).toBe(true);
      expect(parts[0]?.from ?? 0, `${column}`).toBe(0);
      for (const [index, part] of parts.entries()) {
        if (index > 0) expect(part.from, `${column} ${index}`).toBe(parts[index - 1]?.to);
      }
      expect(parts.at(-1)?.to ?? 0, `${column}`).toBe(full.columnTotals[column]);
    }
    expect(full.total).toBe(full.seriesTotals.reduce((sum, value) => sum + value, 0));
    expect(full.total).toBe(full.columnTotals.reduce((sum, value) => sum + value, 0));
  });

  it("C-BARS-02 rounds the axis up to the step, keeps a whole step, and picks the first busiest column", () => {
    expect(stackBars([{ name: "a", values: [17, 2] }], 5).max).toBe(20);
    expect(stackBars([{ name: "a", values: [17, 2] }], 5).ticks).toEqual([0, 5, 10, 15, 20]);
    expect(stackBars([{ name: "a", values: [20, 2] }], 5).max).toBe(20);
    expect(stackBars([{ name: "a", values: [0, 0] }], 5).max).toBe(5);
    expect(stackBars([{ name: "a", values: [0, 0] }], 5).segments).toEqual([]);
    expect(
      stackBars(
        [
          // Totals 4, 5, 5: the first of the two busiest columns.
          { name: "a", values: [1, 5, 4] },
          { name: "b", values: [3, 0, 1] },
        ],
        2,
      ).peak,
    ).toBe(1);
  });

  it("C-BARS-03 freezes the result and every list in it, and leaves the input alone", () => {
    const input = [
      { name: "a", values: [1, 3] },
      { name: "b", values: [2, 0] },
    ];
    const copy = JSON.parse(JSON.stringify(input));
    const stack = stackBars(input, 5);
    expect(deepFrozen(stack)).toBe(true);
    expect(input).toEqual(copy);
    expect(Object.isFrozen(input)).toBe(false);
  });

  it("C-BARS-04 R-05: a wrong type is a TypeError and a value outside its domain a RangeError, each naming stackBars", () => {
    const type: unknown[][] = [
      ["bars", 5],
      [[null], 5],
      [[{ name: 3, values: [1] }], 5],
      [[{ name: "a", values: "1" }], 5],
      [[{ name: "a", values: ["1"] }], 5],
      [TWO, "5"],
    ];
    for (const [series, step] of type) {
      expect(() => stackBars(series as never, step as never), JSON.stringify(series)).toThrow(
        TypeError,
      );
      expect(() => stackBars(series as never, step as never)).toThrow(/^stackBars/);
    }
    const six = Array.from({ length: 6 }, (_, n) => ({ name: `s${n}`, values: [1] }));
    const range: unknown[][] = [
      [[], 5],
      [six, 5],
      [
        [
          { name: "a", values: [1, 2] },
          { name: "b", values: [1] },
        ],
        5,
      ],
      [[{ name: "a", values: [] }], 5],
      [[{ name: "a", values: [-1] }], 5],
      [[{ name: "a", values: [1.5] }], 5],
      [[{ name: "a", values: [Number.NaN] }], 5],
      [[{ name: "a", values: [Number.POSITIVE_INFINITY] }], 5],
      [TWO, 0],
      [TWO, -5],
      [TWO, 2.5],
      [TWO, Number.NaN],
    ];
    for (const [series, step] of range) {
      expect(
        () => stackBars(series as never, step as never),
        JSON.stringify([series, step]),
      ).toThrow(RangeError);
      expect(() => stackBars(series as never, step as never)).toThrow(/^stackBars/);
    }
  });
});
