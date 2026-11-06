import { describe, expect, it } from "vitest";
import {
  MOTION_DURATION_NAMES,
  MOTION_EASING_NAMES,
  MOTION_SPRING_NAMES,
  motionTokens,
  normalizeMotionTokens,
  sameMotionTokens,
} from "@/engine/tokens/motion";
import { defaultSpec } from "../../spec/support";
import { CUSTOM_TOKENS } from "../../support/motion";

// Cases C-MOT5-01, 02, 03, 07 and 13 of docs/specs/05-motion-3d.md, section 14.2 (R5-09, R5-10).

/** A mutable copy of the default tokens, loosened so a case can break one field. */
// biome-ignore lint/suspicious/noExplicitAny: a case breaks one field of the tokens at a time.
function broken(change: (tokens: any) => void): unknown {
  const tokens = structuredClone(motionTokens()) as unknown;
  change(tokens);
  return tokens;
}

function thrown(run: () => unknown): Error {
  try {
    run();
  } catch (error) {
    if (error instanceof Error) return error;
  }
  throw new Error("expected a throw");
}

const isDeepFrozen = (value: unknown): boolean =>
  typeof value !== "object" ||
  value === null ||
  (Object.isFrozen(value) && Object.values(value).every(isDeepFrozen));

describe("the name lists", () => {
  it("C-MOT5-01 hold the names in MotionTokens' key order, frozen", () => {
    const tokens = motionTokens();
    expect([...MOTION_DURATION_NAMES]).toEqual(Object.keys(tokens.durations));
    expect([...MOTION_EASING_NAMES]).toEqual(Object.keys(tokens.easings));
    expect([...MOTION_SPRING_NAMES]).toEqual(Object.keys(tokens.springs));
    for (const list of [MOTION_DURATION_NAMES, MOTION_EASING_NAMES, MOTION_SPRING_NAMES]) {
      expect(Object.isFrozen(list)).toBe(true);
    }
  });
});

describe("normalizeMotionTokens", () => {
  it("C-MOT5-01 returns the defaults unchanged, deeply frozen", () => {
    const out = normalizeMotionTokens(motionTokens());
    expect(out).toEqual(motionTokens());
    expect(isDeepFrozen(out)).toBe(true);
  });

  it("C-MOT5-01 writes the keys in the name lists' order and rounds to six digits", () => {
    const input = {
      springs: {
        bouncy: { bounce: 0.35, visualDuration: 0.5 },
        smooth: { bounce: 0, visualDuration: 0.4 },
        snappy: { bounce: 0.1, visualDuration: 0.25 },
      },
      easings: {
        emphasized: [0.05, 0.7, 0.1, 1],
        accelerate: [0.3, 0, 1, 1],
        decelerate: [0, 0, 0, 1],
        standard: [0.2, 0, 0, 1],
      },
      durations: {
        slowest: 500,
        slower: 400,
        slow: 300,
        base: 0.1234567,
        quick: 150,
        fast: 100,
        instant: 50,
      },
    };
    const out = normalizeMotionTokens(input as never);
    expect(Object.keys(out)).toEqual(["durations", "easings", "springs"]);
    expect(Object.keys(out.durations)).toEqual([...MOTION_DURATION_NAMES]);
    expect(Object.keys(out.easings)).toEqual([...MOTION_EASING_NAMES]);
    expect(Object.keys(out.springs)).toEqual([...MOTION_SPRING_NAMES]);
    expect(Object.keys(out.springs.snappy)).toEqual(["visualDuration", "bounce"]);
    expect(out.durations.base).toBe(0.123457);
  });

  it("C-MOT5-02 throws TypeError, naming the path, for a value of the wrong type", () => {
    for (const bad of [null, [], "x"]) {
      const error = thrown(() => normalizeMotionTokens(bad as never));
      expect(error).toBeInstanceOf(TypeError);
      expect(error.message).toMatch(/^normalizeMotionTokens: tokens/);
    }
    const cases: [unknown, string][] = [
      [broken((t) => delete t.durations), "normalizeMotionTokens: tokens.durations"],
      [broken((t) => (t.durations.base = "200")), "normalizeMotionTokens: tokens.durations.base"],
      [broken((t) => (t.easings.standard = {})), "normalizeMotionTokens: tokens.easings.standard"],
      [
        broken((t) => delete t.springs.snappy.bounce),
        "normalizeMotionTokens: tokens.springs.snappy.bounce",
      ],
    ];
    for (const [bad, start] of cases) {
      const error = thrown(() => normalizeMotionTokens(bad as never));
      expect(error).toBeInstanceOf(TypeError);
      expect(error.message.startsWith(start), error.message).toBe(true);
    }
  });

  it("C-MOT5-02 starts each message with the name it is given", () => {
    const error = thrown(() => normalizeMotionTokens(null as never, "somewhere: t"));
    expect(error).toBeInstanceOf(TypeError);
    expect(error.message.startsWith("somewhere: t")).toBe(true);
  });

  it("C-MOT5-03 throws RangeError, naming the path, for a value out of its domain", () => {
    const cases: [unknown, string][] = [
      [broken((t) => (t.budget = 1)), "tokens.budget"],
      [broken((t) => (t.durations.long = 1)), "tokens.durations.long"],
      [broken((t) => (t.durations.base = -1)), "tokens.durations.base"],
      [broken((t) => (t.durations.base = Number.NaN)), "tokens.durations.base"],
      [broken((t) => (t.durations.base = Number.POSITIVE_INFINITY)), "tokens.durations.base"],
      [broken((t) => (t.easings.standard = [0, 0, 1])), "tokens.easings.standard"],
      [broken((t) => (t.easings.standard = [0, 0, 1, 1, 1])), "tokens.easings.standard"],
      [broken((t) => (t.easings.standard[0] = -0.01)), "tokens.easings.standard[0]"],
      [broken((t) => (t.easings.standard[0] = 1.01)), "tokens.easings.standard[0]"],
      [broken((t) => (t.easings.standard[2] = 1.01)), "tokens.easings.standard[2]"],
      [
        broken((t) => (t.springs.snappy.visualDuration = 0)),
        "tokens.springs.snappy.visualDuration",
      ],
      [broken((t) => (t.springs.snappy.bounce = -0.01)), "tokens.springs.snappy.bounce"],
      [broken((t) => (t.springs.snappy.bounce = 1.01)), "tokens.springs.snappy.bounce"],
    ];
    for (const [bad, path] of cases) {
      const error = thrown(() => normalizeMotionTokens(bad as never));
      expect(error, path).toBeInstanceOf(RangeError);
      expect(error.message, path).toContain(`normalizeMotionTokens: ${path}`);
    }
  });

  it("C-MOT5-03 accepts a y1 of 1000", () => {
    const tokens = broken((t) => (t.easings.standard[1] = 1000)) as never;
    expect(normalizeMotionTokens(tokens).easings.standard[1]).toBe(1000);
  });

  it("C-MOT5-03 checks every type before any domain", () => {
    const tokens = broken((t) => {
      t.budget = 1;
      t.durations.base = "200";
    });
    expect(() => normalizeMotionTokens(tokens as never)).toThrow(TypeError);
  });

  it("C-MOT5-03 accepts CUSTOM_TOKENS and does not touch its input", () => {
    expect(normalizeMotionTokens(CUSTOM_TOKENS)).toEqual(CUSTOM_TOKENS);
  });
});

describe("sameMotionTokens", () => {
  it("C-MOT5-07 ignores the feel key of a spec's motion", () => {
    expect(sameMotionTokens(motionTokens(), defaultSpec().motion)).toBe(true);
  });

  it("C-MOT5-07 sees a number 1e-6 away", () => {
    const other = motionTokens();
    other.springs.bouncy.bounce += 1e-6;
    expect(sameMotionTokens(motionTokens(), other)).toBe(false);
    expect(sameMotionTokens(motionTokens(), CUSTOM_TOKENS)).toBe(false);
  });

  it("C-MOT5-07 keeps keys in another order the same", () => {
    const { springs, easings, durations } = motionTokens();
    expect(sameMotionTokens({ springs, easings, durations }, motionTokens())).toBe(true);
  });

  it("C-MOT5-13 throws TypeError, naming itself, for a value of the wrong type", () => {
    for (const run of [
      () => sameMotionTokens(null as never, motionTokens()),
      () => sameMotionTokens(motionTokens(), { durations: {} } as never),
    ]) {
      const error = thrown(run);
      expect(error).toBeInstanceOf(TypeError);
      expect(error.message).toMatch(/^sameMotionTokens:/);
    }
  });
});
