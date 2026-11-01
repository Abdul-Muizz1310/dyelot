export type MotionTokens = {
  /** Milliseconds. */
  durations: Record<"instant" | "fast" | "quick" | "base" | "slow" | "slower" | "slowest", number>;
  /** Cubic-bezier control points `[x1, y1, x2, y2]`. */
  easings: Record<
    "standard" | "decelerate" | "accelerate" | "emphasized",
    readonly [number, number, number, number]
  >;
  /** Seconds of visual duration, and bounce. */
  springs: Record<"snappy" | "smooth" | "bouncy", { visualDuration: number; bounce: number }>;
};

/** The motion tokens of the spec. Each call returns a fresh object. */
export function motionTokens(): MotionTokens {
  return {
    durations: {
      instant: 50,
      fast: 100,
      quick: 150,
      base: 200,
      slow: 300,
      slower: 400,
      slowest: 500,
    },
    easings: {
      standard: [0.2, 0, 0, 1],
      decelerate: [0, 0, 0, 1],
      accelerate: [0.3, 0, 1, 1],
      emphasized: [0.05, 0.7, 0.1, 1],
    },
    springs: {
      snappy: { visualDuration: 0.25, bounce: 0.1 },
      smooth: { visualDuration: 0.4, bounce: 0 },
      bouncy: { visualDuration: 0.5, bounce: 0.35 },
    },
  };
}
