import { describe, expect, it } from "vitest";
import { motionTokens } from "@/engine/tokens/motion";

// Cases are the C-MOTION-nn rows of docs/specs/01-color-engine.md, section 6.6.

describe("motionTokens", () => {
  it("C-MOTION-01 lists the seven durations in order", () => {
    const { durations } = motionTokens();
    expect(durations).toEqual({
      instant: 50,
      fast: 100,
      quick: 150,
      base: 200,
      slow: 300,
      slower: 400,
      slowest: 500,
    });
    expect(Object.keys(durations)).toEqual([
      "instant",
      "fast",
      "quick",
      "base",
      "slow",
      "slower",
      "slowest",
    ]);
  });

  it("C-MOTION-02 gives the four easings as cubic-bezier points", () => {
    expect(motionTokens().easings).toEqual({
      standard: [0.2, 0, 0, 1],
      decelerate: [0, 0, 0, 1],
      accelerate: [0.3, 0, 1, 1],
      emphasized: [0.05, 0.7, 0.1, 1],
    });
  });

  it("C-MOTION-03 keeps every easing x value in [0, 1]", () => {
    for (const [name, points] of Object.entries(motionTokens().easings)) {
      for (const x of [points[0], points[2]]) {
        expect(x, name).toBeGreaterThanOrEqual(0);
        expect(x, name).toBeLessThanOrEqual(1);
      }
    }
  });

  it("C-MOTION-04 gives the three springs", () => {
    expect(motionTokens().springs).toEqual({
      snappy: { visualDuration: 0.25, bounce: 0.1 },
      smooth: { visualDuration: 0.4, bounce: 0 },
      bouncy: { visualDuration: 0.5, bounce: 0.35 },
    });
  });

  it("C-MOTION-05 returns a fresh object each call", () => {
    const first = motionTokens();
    (first.durations as Record<string, number>).base = 1;
    (first.easings.standard as unknown as number[])[0] = 0.9;
    first.springs.snappy.bounce = 0.9;
    const next = motionTokens();
    expect(next).not.toBe(first);
    expect(next.durations.base).toBe(200);
    expect(next.easings.standard).toEqual([0.2, 0, 0, 1]);
    expect(next.springs.snappy.bounce).toBe(0.1);
  });
});
