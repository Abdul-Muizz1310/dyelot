// Motion tokens of this design. Durations are milliseconds; springs are for Motion's animate().
export const durations = {
  instant: 50,
  fast: 100,
  quick: 150,
  base: 200,
  slow: 300,
  slower: 400,
  slowest: 500,
} as const;

export const easings = {
  standard: [0.2, 0, 0, 1],
  decelerate: [0, 0, 0, 1],
  accelerate: [0.3, 0, 1, 1],
  emphasized: [0.05, 0.7, 0.1, 1],
} as const;

export const springs = {
  snappy: { type: "spring", visualDuration: 0.25, bounce: 0.1 },
  smooth: { type: "spring", visualDuration: 0.4, bounce: 0 },
  bouncy: { type: "spring", visualDuration: 0.5, bounce: 0.35 },
} as const;

export const springSettleMs = {
  snappy: 411,
  smooth: 706,
  bouncy: 1056,
} as const;
