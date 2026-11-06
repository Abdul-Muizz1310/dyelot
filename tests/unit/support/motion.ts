import fc from "fast-check";
import type { MotionTokens } from "@/engine/tokens/motion";

// Fixtures of docs/specs/05-motion-3d.md, section 4. No `vitest` import, so a property file and a
// flow can both read them.

function freeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const inner of Object.values(value)) freeze(inner);
    Object.freeze(value);
  }
  return value;
}

/** A token set that differs from the defaults in every number, deeply frozen. */
export const CUSTOM_TOKENS: MotionTokens = freeze({
  durations: { instant: 40, fast: 80, quick: 120, base: 160, slow: 240, slower: 320, slowest: 480 },
  easings: {
    standard: [0.3, 0, 0.2, 1],
    decelerate: [0, 0, 0.2, 1],
    accelerate: [0.4, 0, 1, 1],
    emphasized: [0.1, 0.8, 0.1, 1],
  },
  springs: {
    snappy: { visualDuration: 0.2, bounce: 0.05 },
    smooth: { visualDuration: 0.45, bounce: 0 },
    bouncy: { visualDuration: 0.55, bounce: 0.4 },
  },
} as const);

const duration = fc.integer({ min: 0, max: 2000 });
const unit = fc.double({ min: 0, max: 1, noNaN: true });
const y = fc.double({ min: -2, max: 3, noNaN: true });
const easing = fc.tuple(unit, y, unit, y);
const spring = fc.record({
  visualDuration: fc.double({ min: 0.01, max: 5, noNaN: true }),
  bounce: fc.double({ min: 0, max: 1, noNaN: true }),
});

/** Valid tokens: durations 0 to 2000, easing x in [0, 1] and y in [-2, 3], springs inside the schema's bounds. */
export const tokensArb: fc.Arbitrary<MotionTokens> = fc.record({
  durations: fc.record({
    instant: duration,
    fast: duration,
    quick: duration,
    base: duration,
    slow: duration,
    slower: duration,
    slowest: duration,
  }),
  easings: fc.record({
    standard: easing,
    decelerate: easing,
    accelerate: easing,
    emphasized: easing,
  }),
  springs: fc.record({ snappy: spring, smooth: spring, bouncy: spring }),
});
