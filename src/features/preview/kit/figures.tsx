"use client";

import "./figures.css";
import type { CSSProperties } from "react";

// The kit's drawn figures (spec section 7.6): a day's tide curve, a level bar and a row of dyed
// skeins. A figure is not an icon: an SVG figure carries `data-figure`, `role="img"` and a name
// (F-TPL-15). Every color is a role: the water is `secondary`, the curve `primary`, the skeins the
// five chart colors (F-TPL-39).

const WIDTH = 320;
const HEIGHT = 120;
/** The meters the curve's height stands for. */
const RANGE = 5;

/** A sample semidiurnal tide in meters at `hour`: high near 06:42 and 19:07, low near 12:55. */
function tideAt(hour: number): number {
  return 2.45 + 1.8 * Math.cos((2 * Math.PI * (hour - 6.7)) / 12.42);
}

const x = (hour: number) => (hour / 24) * WIDTH;
const y = (meters: number) => HEIGHT - (meters / RANGE) * HEIGHT;

const POINTS = Array.from({ length: 97 }, (_, step) => {
  const hour = step / 4;
  return `${x(hour).toFixed(2)},${y(tideAt(hour)).toFixed(2)}`;
});
const LINE = `M${POINTS.join(" L")}`;
const WATER = `${LINE} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z`;

/** The day's tide curve with a marker at `now` (hours, 0 to 24). */
export function TideCurve({ label, now }: { label: string; now: number }) {
  if (!Number.isFinite(now) || now < 0 || now > 24) {
    throw new RangeError(`TideCurve: now must be an hour from 0 to 24, got ${now}`);
  }
  const marker = {
    "--kit-x": `${(now / 24) * 100}%`,
    "--kit-y": `${(y(tideAt(now)) / HEIGHT) * 100}%`,
  } as CSSProperties;
  return (
    <div className="kit-tide-frame" style={marker}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={label}
        data-figure=""
        className="kit-tide"
        data-roles="secondary primary foreground border"
      >
        <line className="kit-tide-datum" x1={0} x2={WIDTH} y1={y(2.45)} y2={y(2.45)} />
        <path className="kit-tide-water" d={WATER} />
        <path className="kit-tide-line" d={LINE} />
        <line className="kit-tide-now" x1={x(now)} x2={x(now)} y1={0} y2={HEIGHT} />
      </svg>
      <span aria-hidden="true" className="kit-tide-dot" data-roles="primary card" />
    </div>
  );
}

/** A level bar: `value` of `max` filled in `primary` on the `muted` track. Decorative. */
export function Level({ value, max }: { value: number; max: number }) {
  if (!(Number.isFinite(max) && max > 0 && Number.isFinite(value) && value >= 0 && value <= max)) {
    throw new RangeError(
      `Level: value must be in [0, max] and max positive, got ${value} of ${max}`,
    );
  }
  return (
    <span
      aria-hidden="true"
      className="kit-level"
      data-roles="muted primary"
      style={{ "--kit-level": `${(value / max) * 100}%` } as CSSProperties}
    >
      <span className="kit-level-fill" />
    </span>
  );
}

const SKEINS = [1, 2, 3, 4, 5] as const;

/** Five dyed skeins in the chart colors, one image with a name. */
export function Skeins({ label }: { label: string }) {
  return (
    <div role="img" aria-label={label} className="kit-skeins" data-roles="card border">
      {SKEINS.map((n) => (
        <span
          key={n}
          className="kit-skein"
          data-skein={n}
          data-roles={`chart-${n} card-foreground`}
        />
      ))}
    </div>
  );
}
