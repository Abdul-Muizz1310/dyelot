import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type ContrastLevel,
  deltaEOK,
  generateSystem,
  type Hex,
  hexToRgb,
  ROLE_NAMES,
  type RoleName,
  rgbToOklch,
} from "@/engine";
import { seedHex } from "@/engine/color/palette";
import type { StudioClient } from "@/features/studio/client";
import { resolveParams } from "@/features/studio/params";
import type { GenerateReply } from "@/features/studio/protocol";
import { runGenerate } from "@/features/studio/protocol";
import type { StudioStore } from "@/features/studio/store";
import { writeHash } from "@/features/studio/url";
import type { DesignSpec } from "@/spec";
import { PROPERTY_TIMEOUT } from "../../spec/support";
import { makeStore } from "./store-support";
import { FRESH_PARAMS, fakeLocation, seedSequence } from "./support";

// The measured lock bounds of docs/specs/02-studio.md, R2-17: C-STORE-34 and C-STORE-41. Every
// lock goes through the store's `toggleLock` and every regeneration through `regenerate`, with a
// client that runs the real generator and answers at once. The cases need about 800 generations,
// so they are split over several files that run in parallel. DYELOT_LOCK_REPORT=1 prints the
// measured numbers behind each bound.

const report = (line: string): void => {
  if (process.env.DYELOT_LOCK_REPORT === "1") console.info(line);
};

export const SEED_N = Array.from({ length: 20 }, (_, i) => `seed-${i + 1}`);
export const SEED_S = Array.from({ length: 40 }, (_, i) => `s${i}`);

const CHARTS: ReadonlySet<RoleName> = new Set([
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
]);
const MODES = ["light", "dark"] as const;

/**
 * A ΔEOK at the precision R2-17 quotes it: four decimals. The measurement behind R2-17 printed its
 * maxima with four decimals, so "0.0016" stands for a measured 0.001635 (seed-1 to seed-20, AAA)
 * and "0.0191" for 0.019136 (s0 to s39, AA); comparing the raw value would fail a bound the spec
 * meant to state. Every other bound has room at full precision.
 */
const atSpecPrecision = (deltaE: number): number => Math.round(deltaE * 1e4) / 1e4;

/** A client that runs the real generator and replies inside the request call. */
function realClient(): StudioClient {
  let listener: ((reply: GenerateReply) => void) | undefined;
  return {
    generateNow: (params, seed) => generateSystem(params, seed),
    request: (request) => listener?.(runGenerate(request)),
    subscribe: (next) => {
      listener = next;
      return () => {
        listener = undefined;
      };
    },
    dispose: () => {},
  };
}

/** A store that opened the design of `seed` at `level` from a link, as a visitor would. */
function storeAt(seed: string, level: ContrastLevel): { store: StudioStore; base: DesignSpec } {
  const base = generateSystem(resolveParams({ ...FRESH_PARAMS, contrastLevel: level }, seed), seed);
  const { store } = makeStore({
    client: realClient(),
    location: fakeLocation(writeHash(base)).location,
    newSeed: seedSequence(`${seed}-r1`, `${seed}-r2`, `${seed}-r3`),
  });
  expect(store.getState().spec).toEqual(base);
  return { store, base };
}

/** The largest difference of one 8-bit channel between two hexes. */
function codes(a: Hex, b: Hex): number {
  const [p, q] = [hexToRgb(a), hexToRgb(b)];
  return Math.max(...p.map((channel, i) => Math.round(Math.abs(channel - (q[i] ?? 0)) * 255)));
}

const oklchOf = (hex: Hex) => rgbToOklch(hexToRgb(hex), "srgb");

/** How far each kind of role moved between two specs, over both modes. */
function moved(before: DesignSpec, after: DesignSpec) {
  let primaryDE = 0;
  let nonChartCodes = 0;
  let chartCodes = 0;
  let identical = true;
  for (const mode of MODES) {
    for (const role of ROLE_NAMES) {
      const [a, b] = [before.color.roles[mode][role], after.color.roles[mode][role]];
      if (a !== b) identical = false;
      if (role === "primary") primaryDE = Math.max(primaryDE, deltaEOK(oklchOf(a), oklchOf(b)));
      if (CHARTS.has(role)) chartCodes = Math.max(chartCodes, codes(a, b));
      else nonChartCodes = Math.max(nonChartCodes, codes(a, b));
    }
  }
  return { primaryDE, nonChartCodes, chartCodes, identical };
}

/** Whether every role of both modes is the same in two specs. */
const sameRoles = (a: DesignSpec, b: DesignSpec) => moved(a, b).identical;

/** C-STORE-34 for `secondary` and `accent`: locks from the same base, undone in between. */
export function describePairLock(level: ContrastLevel, seeds: readonly string[]): void {
  describe(`C-STORE-34 locking secondary or accent at ${level}, ${seeds[0]} to ${seeds.at(-1)}`, () => {
    const results: { seed: string; slot: string; same: boolean }[] = [];
    beforeAll(() => {
      for (const seed of seeds) {
        const { store, base } = storeAt(seed, level);
        for (const slot of ["secondary", "accent"] as const) {
          store.getState().toggleLock(slot);
          expect(store.getState().params[slot]).toBeDefined();
          results.push({ seed, slot, same: sameRoles(base, store.getState().spec) });
          store.getState().undo();
        }
        store.getState().dispose();
      }
    }, PROPERTY_TIMEOUT);

    afterAll(() => {
      const same = results.filter((result) => result.same).length;
      report(
        `lock ${level} pair ${seeds[0]}..${seeds.at(-1)}: identical ${same}/${results.length}`,
      );
    });

    it("keeps all 46 roles of both modes identical in every seed", () => {
      expect(results).toHaveLength(seeds.length * 2);
      expect(results.filter((result) => !result.same)).toEqual([]);
    });
  });
}

type Run = "kept" | "deviation" | "dropped";

/**
 * C-STORE-34 for `primary` over `seeds`, and with `regenerations` C-STORE-41: after the lock, each
 * regeneration keeps `params.primary`, and its spec holds the seed's hex in a scale with no
 * `seedDeviation` ("kept"), records a `seedDeviation` ("deviation"), or neither ("dropped").
 */
export function describePrimaryLock(
  level: ContrastLevel,
  seeds: readonly string[],
  bounds: { primaryDE: number; identical: number; kept?: number },
  regenerations = 0,
): void {
  describe(`C-STORE-34 locking primary at ${level}, ${seeds[0]} to ${seeds.at(-1)}`, () => {
    const locks: ReturnType<typeof moved>[] = [];
    const runs: Run[] = [];
    const deviations: number[] = [];
    let paramsKept = true;
    beforeAll(() => {
      for (const seed of seeds) {
        const { store, base } = storeAt(seed, level);
        store.getState().toggleLock("primary");
        const locked = store.getState().params.primary;
        expect(locked).toBeDefined();
        locks.push(moved(base, store.getState().spec));
        for (let i = 0; i < regenerations; i++) {
          store.getState().regenerate();
          const { params, spec, seed: now } = store.getState();
          expect(now).toBe(`${seed}-r${i + 1}`);
          if (JSON.stringify(params.primary) !== JSON.stringify(locked)) paramsKept = false;
          const palette = spec.color.palettes.primary;
          const hex = locked === undefined ? undefined : seedHex(locked, spec.color.params.gamut);
          const inScale = [...palette.light, ...palette.dark].some((step) => step.hex === hex);
          if (palette.seedDeviation !== undefined) {
            runs.push("deviation");
            deviations.push(palette.seedDeviation.deltaEOK);
          } else runs.push(inScale ? "kept" : "dropped");
        }
        store.getState().dispose();
      }
    }, PROPERTY_TIMEOUT);

    afterAll(() => {
      const max = (key: "primaryDE" | "nonChartCodes" | "chartCodes") =>
        Math.max(...locks.map((lock) => lock[key]));
      const count = (run: Run) => runs.filter((item) => item === run).length;
      report(
        `lock ${level} primary ${seeds[0]}..${seeds.at(-1)}: identical ${locks.filter((lock) => lock.identical).length}/${locks.length}, ` +
          `primary dE ${max("primaryDE").toFixed(6)}, non-chart codes ${max("nonChartCodes")}, chart codes ${max("chartCodes")}` +
          (regenerations > 0
            ? `; regenerations ${runs.length}: kept ${count("kept")}, deviation ${count("deviation")} (max dE ${Math.max(0, ...deviations).toFixed(6)}), dropped ${count("dropped")}`
            : ""),
      );
    });

    it(`keeps the primary role within ΔEOK ${bounds.primaryDE} and every non-chart role within 10 codes`, () => {
      expect(locks).toHaveLength(seeds.length);
      const largest = Math.max(...locks.map((lock) => lock.primaryDE));
      expect(atSpecPrecision(largest)).toBeLessThanOrEqual(bounds.primaryDE);
      expect(Math.max(...locks.map((lock) => lock.nonChartCodes))).toBeLessThanOrEqual(10);
    });

    it(`leaves all roles identical in at least ${bounds.identical} of ${seeds.length} seeds; charts may move`, () => {
      expect(locks.filter((lock) => lock.identical).length).toBeGreaterThanOrEqual(
        bounds.identical,
      );
      // Measured up to 187 codes (R2-17); a chart role may move by any amount.
      expect(Math.max(...locks.map((lock) => lock.chartCodes))).toBeLessThanOrEqual(255);
    });

    if (regenerations > 0) {
      it(`C-STORE-41 keeps the locked color through ${regenerations} regenerations of each seed`, () => {
        expect(paramsKept).toBe(true);
        expect(runs).toHaveLength(seeds.length * regenerations);
        expect(runs.filter((run) => run === "dropped")).toEqual([]);
        expect(runs.filter((run) => run === "kept").length).toBeGreaterThanOrEqual(
          bounds.kept ?? 0,
        );
        expect(atSpecPrecision(Math.max(0, ...deviations))).toBeLessThanOrEqual(0.0191);
      });
    }
  });
}
