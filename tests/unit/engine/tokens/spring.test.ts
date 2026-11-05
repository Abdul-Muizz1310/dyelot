import { readFileSync } from "node:fs";
import path from "node:path";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { motionTokens } from "@/engine/tokens/motion";
import { springCurve } from "@/engine/tokens/spring";

// Cases are the C-SPR-nn rows of docs/specs/03-export.md, section 10.2 (R3-20).

const SPRINGS = motionTokens().springs;
const EXPECTED = { snappy: [411, 26], smooth: [706, 44], bouncy: [1056, 65] } as const;
const NAMES = ["snappy", "smooth", "bouncy"] as const;

type Spring = { visualDuration: number; bounce: number };

/** The envelope of R3-20 at `ms`, written out here from the spec. */
function envelope({ visualDuration, bounce }: Spring, ms: number): number {
  const zeta = Math.max(1 - bounce, 0.05);
  const omega = (2 * Math.PI) / (1.2 * visualDuration);
  const t = ms / 1000;
  if (zeta === 1) return (1 + omega * t) * Math.exp(-omega * t);
  const wd = omega * Math.sqrt(1 - zeta * zeta);
  return Math.exp(-zeta * omega * t) * Math.sqrt(1 + ((zeta * omega) / wd) ** 2);
}

/** The position of R3-20 at `ms`. */
function position({ visualDuration, bounce }: Spring, ms: number): number {
  const zeta = Math.max(1 - bounce, 0.05);
  const omega = (2 * Math.PI) / (1.2 * visualDuration);
  const t = ms / 1000;
  if (zeta === 1) return 1 - (1 + omega * t) * Math.exp(-omega * t);
  const wd = omega * Math.sqrt(1 - zeta * zeta);
  return (
    1 - Math.exp(-zeta * omega * t) * (Math.cos(wd * t) + ((zeta * omega) / wd) * Math.sin(wd * t))
  );
}

describe("springCurve", () => {
  it.each(NAMES)("C-SPR-01 gives the settle time and sample count of %s", (name) => {
    const { settleMs, samples } = springCurve(SPRINGS[name]);
    expect([settleMs, samples.length]).toEqual(EXPECTED[name]);
    expect(samples[0]).toBe(0);
    expect(samples[samples.length - 1]).toBe(1);
    for (const sample of samples) expect(Math.round(sample * 1e4) / 1e4).toBe(sample);
  });

  it.each(NAMES)("C-SPR-02 settles on the envelope at %s", (name) => {
    const spring = SPRINGS[name];
    const { settleMs } = springCurve(spring);
    for (let ms = settleMs; ms <= 3 * settleMs; ms += 1) {
      expect(envelope(spring, ms)).toBeLessThanOrEqual(0.001);
      expect(Math.abs(1 - position(spring, ms))).toBeLessThanOrEqual(0.001);
    }
    expect(envelope(spring, settleMs - 1)).toBeGreaterThan(0.001);
  });

  describe("C-SPR-03 agrees with Motion 14.3.0", () => {
    const file = path.resolve(
      import.meta.dirname,
      "../../../../node_modules/.pnpm/motion-dom@14.3.0/node_modules/motion-dom/dist/es/animation/generators/spring.mjs",
    );
    const load = async () => {
      // The generator imports motion-utils and its siblings; import it from its own folder.
      expect(readFileSync(file, "utf8")).toContain("bounceToDampingRatio");
      const mod = (await import(/* @vite-ignore */ file)) as {
        spring: (options: unknown) => { next: (t: number) => { value: number } };
      };
      return mod.spring;
    };

    const agree = async (spring: Spring) => {
      const motion = await load();
      const generator = motion({ ...spring, keyframes: [0, 1] });
      const { settleMs, samples } = springCurve(spring);
      const n = samples.length - 1;
      samples.forEach((value, i) => {
        const expected = generator.next((i * settleMs) / n).value;
        expect(
          Math.abs(value - expected),
          `${JSON.stringify(spring)} sample ${i}`,
        ).toBeLessThanOrEqual(0.005);
      });
    };

    it.each(NAMES)("matches each sample of %s", async (name) => {
      await agree(SPRINGS[name]);
    });

    it("matches 20 random springs", async () => {
      const motion = await load();
      void motion;
      const springs = fc.sample(
        fc.record({
          visualDuration: fc.double({ min: 0.1, max: 2, noNaN: true }),
          bounce: fc.double({ min: 0, max: 0.9, noNaN: true }),
        }),
        { numRuns: 20, seed: 3004 },
      );
      for (const spring of springs) await agree(spring);
    });
  });

  it("C-SPR-04 clamps the sample count", () => {
    expect(springCurve({ visualDuration: 0.05, bounce: 0 }).samples).toHaveLength(11);
    expect(springCurve({ visualDuration: 4, bounce: 0.9 }).samples).toHaveLength(121);
    const floor = springCurve({ visualDuration: 0.4, bounce: 1 });
    expect(floor.samples.every(Number.isFinite)).toBe(true);
    expect(floor.settleMs).toBeGreaterThan(
      springCurve({ visualDuration: 0.4, bounce: 0.9 }).settleMs,
    );
  });

  it("C-SPR-05 throws RangeError or TypeError naming springCurve", () => {
    const range = [
      { visualDuration: 0, bounce: 0 },
      { visualDuration: -1, bounce: 0 },
      { visualDuration: Number.NaN, bounce: 0 },
      { visualDuration: Number.POSITIVE_INFINITY, bounce: 0 },
      { visualDuration: 0.4, bounce: -0.1 },
      { visualDuration: 0.4, bounce: 1.1 },
    ];
    for (const spring of range) {
      expect(() => springCurve(spring)).toThrow(RangeError);
      expect(() => springCurve(spring)).toThrow(/springCurve/);
    }
    for (const spring of [
      null,
      { visualDuration: "0.4", bounce: 0 },
      { visualDuration: 0.4, bounce: null },
    ]) {
      expect(() => springCurve(spring as never)).toThrow(TypeError);
      expect(() => springCurve(spring as never)).toThrow(/springCurve/);
    }
  });
});
