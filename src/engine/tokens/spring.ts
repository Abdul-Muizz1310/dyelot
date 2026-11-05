import { describeType } from "../color/guards";

// The spring samples of spec R3-20: Motion 14.3.0's duration-and-bounce model (motion-dom
// `generators/spring.mjs`), sampled into a `linear()` easing. Pure.

/** Motion's damping floor (`minDamping`). */
const MIN_DAMPING = 0.05;
/** The envelope at and after the settle time stays at or below this distance from the target. */
const SETTLE = 0.001;
/** Samples per second of motion, and the clamp of the sample count. */
const SAMPLES_PER_SECOND = 60;
const MIN_STEPS = 10;
const MAX_STEPS = 120;

export type SpringCurve = { readonly settleMs: number; readonly samples: readonly number[] };

function field(spring: unknown, name: "visualDuration" | "bounce"): number {
  const value = (spring as Record<string, unknown>)[name];
  if (typeof value !== "number") {
    throw new TypeError(`springCurve: spring.${name} must be a number, got ${describeType(value)}`);
  }
  return value;
}

/**
 * The curve of a spring that starts at rest at 0 and moves to 1: the first whole millisecond after
 * which its envelope stays within 0.001, and `n + 1` samples of the position over that time,
 * `n = clamp(ceil(settleMs * 60 / 1000), 10, 120)`, each rounded to 4 decimals (first 0, last 1).
 */
export function springCurve(spring: { visualDuration: number; bounce: number }): SpringCurve {
  if (typeof spring !== "object" || spring === null) {
    throw new TypeError(`springCurve: spring must be an object, got ${describeType(spring)}`);
  }
  const visualDuration = field(spring, "visualDuration");
  const bounce = field(spring, "bounce");
  if (!Number.isFinite(visualDuration) || visualDuration <= 0) {
    throw new RangeError(
      `springCurve: spring.visualDuration must be finite and positive, got ${visualDuration}`,
    );
  }
  if (!(bounce >= 0 && bounce <= 1)) {
    throw new RangeError(`springCurve: spring.bounce must be in [0, 1], got ${bounce}`);
  }

  const zeta = Math.max(1 - bounce, MIN_DAMPING);
  const omega = (2 * Math.PI) / (1.2 * visualDuration);
  const decay = zeta * omega;
  const damped = omega * Math.sqrt(1 - zeta * zeta);
  const ratio = decay / damped;
  const critical = zeta === 1;

  const envelope = (t: number): number =>
    critical
      ? (1 + omega * t) * Math.exp(-omega * t)
      : Math.exp(-decay * t) * Math.sqrt(1 + ratio * ratio);
  const position = (t: number): number =>
    critical
      ? 1 - (1 + omega * t) * Math.exp(-omega * t)
      : 1 - Math.exp(-decay * t) * (Math.cos(damped * t) + ratio * Math.sin(damped * t));

  // The envelope only falls, so the first whole millisecond at or below the bound is the settle.
  let settleMs = 1;
  while (envelope(settleMs / 1000) > SETTLE) settleMs += 1;

  const steps = Math.min(
    MAX_STEPS,
    Math.max(MIN_STEPS, Math.ceil((settleMs * SAMPLES_PER_SECOND) / 1000)),
  );
  const samples: number[] = [];
  for (let i = 0; i <= steps; i += 1) {
    if (i === 0) samples.push(0);
    else if (i === steps) samples.push(1);
    else {
      const rounded = Math.round(position((i * settleMs) / steps / 1000) * 1e4) / 1e4;
      samples.push(rounded === 0 ? 0 : rounded);
    }
  }
  return Object.freeze({ settleMs, samples: Object.freeze(samples) });
}
