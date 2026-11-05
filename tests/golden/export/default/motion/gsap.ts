// Motion tokens of this design for GSAP. Durations are seconds.
// Register an ease with CustomEase.create(name, value), where value is one of the strings below.
export const durations = {
  instant: 0.05,
  fast: 0.1,
  quick: 0.15,
  base: 0.2,
  slow: 0.3,
  slower: 0.4,
  slowest: 0.5,
} as const;

export const eases = {
  standard: "0.2,0,0,1",
  decelerate: "0,0,0,1",
  accelerate: "0.3,0,1,1",
  emphasized: "0.05,0.7,0.1,1",
} as const;
