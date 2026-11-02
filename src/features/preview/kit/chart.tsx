"use client";

import "./chart.css";
import type { CSSProperties } from "react";
import type { BarSeries, BarStack } from "../bars";

// The kit's chart parts (spec section 7.7, F-TPL-22): stacked bars drawn as a named SVG figure, its
// legend with each series' total, and a visually hidden table of every value it draws. Series n
// paints `chart-n`; the gridlines are `border` and the axis labels `muted-foreground`. The numbers
// come from `stackBars` (section 6.13), so the bars, the name and the table agree.

/** The view box: one 40-unit slot per column, 100 units tall. */
const SLOT = 40;
const BAR = 24;
const HEIGHT = 100;

const ROLES = "chart-1 chart-2 chart-3 chart-4 chart-5 border";

/** A short column label for the axis: the first three letters ("Mon" for "Monday"). */
const short = (column: string) => column.slice(0, 3);

export function StackedBars({
  stack,
  columns,
  label,
}: {
  stack: BarStack;
  columns: readonly string[];
  /** The figure's accessible name, which sums up what it draws. */
  label: string;
}) {
  if (columns.length !== stack.columnTotals.length) {
    throw new RangeError(
      `StackedBars: ${columns.length} labels for ${stack.columnTotals.length} columns`,
    );
  }
  const width = columns.length * SLOT;
  const y = (value: number) => HEIGHT - (value / stack.max) * HEIGHT;
  return (
    <div className="kit-bars" style={{ "--kit-columns": String(columns.length) } as CSSProperties}>
      <ol
        aria-hidden="true"
        className="kit-bars-y kit-mono kit-t-caption"
        data-roles="muted-foreground"
      >
        {stack.ticks.map((tick) => (
          <li key={tick} style={{ "--kit-at": `${(y(tick) / HEIGHT) * 100}%` } as CSSProperties}>
            {tick}
          </li>
        ))}
      </ol>
      <svg
        viewBox={`0 0 ${width} ${HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={label}
        data-figure=""
        className="kit-bars-plot"
        data-roles={ROLES}
      >
        {stack.ticks.map((tick) => (
          <line key={tick} className="kit-bars-grid" x1={0} x2={width} y1={y(tick)} y2={y(tick)} />
        ))}
        {stack.segments.map((segment) => (
          <rect
            key={`${segment.column}-${segment.series}`}
            className="kit-bar"
            data-series={segment.series + 1}
            data-column={segment.column}
            x={segment.column * SLOT + (SLOT - BAR) / 2}
            y={y(segment.to)}
            width={BAR}
            height={y(segment.from) - y(segment.to)}
          />
        ))}
      </svg>
      <ol aria-hidden="true" className="kit-bars-x kit-t-caption" data-roles="muted-foreground">
        {columns.map((column) => (
          <li key={column}>{short(column)}</li>
        ))}
      </ol>
    </div>
  );
}

/** The legend: each series' color, name and total. */
export function BarsLegend({
  series,
  totals,
}: {
  series: readonly BarSeries[];
  totals: readonly number[];
}) {
  return (
    <ul className="kit-bars-legend kit-t-body-sm">
      {series.map((entry, index) => (
        <li key={entry.name} data-roles={`chart-${index + 1} foreground`}>
          <span aria-hidden="true" className="kit-bars-key" data-series={index + 1} />
          <span className="kit-bars-name">{entry.name}</span>
          <span className="kit-num">{totals[index]}</span>
        </li>
      ))}
    </ul>
  );
}

/** Every value the bars draw, as a table that only assistive technology reads. */
export function BarsTable({
  caption,
  columns,
  series,
  head,
}: {
  caption: string;
  columns: readonly string[];
  series: readonly BarSeries[];
  /** The header of the series column. */
  head: string;
}) {
  // A table cannot shrink below its content, so the visually hidden box is a wrapper around it.
  return (
    <div className="kit-sr-only">
      <table className="kit-t-caption">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{head}</th>
            {columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {series.map((entry) => (
            <tr key={entry.name}>
              <th scope="row">{entry.name}</th>
              {entry.values.map((value, index) => (
                <td key={columns[index]}>{value}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
