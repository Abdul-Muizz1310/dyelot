import { flavorSeed, flavorStops, freshParams, generateSystem, type Oklch } from "@/engine";
import { type DesignSpec, encodeSpec, specId } from "@/spec";
import type { HeroCards } from "./cards";

/** One hero design (R5-31): a name, the generator's seed and the primary seed color it locks. */
export type HeroParams = {
  readonly name: string;
  readonly seed: string;
  readonly primary: Oklch;
};

const hero = (name: string, seed: string, l: number, c: number, h: number): HeroParams =>
  Object.freeze({ name, seed, primary: Object.freeze({ l, c, h }) });

/** R5-31's six designs, each a historical dye with a primary seed inside sRGB. */
export const HERO_PARAMS: readonly HeroParams[] = Object.freeze([
  hero("Madder", "hero-madder", 0.7, 0.17, 22),
  hero("Weld", "hero-weld", 0.82, 0.15, 95),
  hero("Verdigris", "hero-verdigris", 0.68, 0.11, 165),
  hero("Woad", "hero-woad", 0.58, 0.12, 235),
  hero("Logwood", "hero-logwood", 0.52, 0.14, 300),
  hero("Cochineal", "hero-cochineal", 0.6, 0.2, 345),
]);

/** Generated designs, kept per server instance: only the first is ever needed by the landing. */
const MEMO = new Map<number, DesignSpec>();

/** The design at `index` (0 to 5), generated once per instance (R5-31). */
export function heroSpec(index: number): DesignSpec {
  if (typeof index !== "number") {
    throw new TypeError(`heroSpec: index must be a number, got ${typeof index}`);
  }
  if (!Number.isInteger(index) || index < 0 || index >= HERO_PARAMS.length) {
    throw new RangeError(`heroSpec: index must be a whole number from 0 to 5, got ${index}`);
  }
  const known = MEMO.get(index);
  if (known !== undefined) return known;
  const { name, seed, primary } = HERO_PARAMS[index] as HeroParams;
  const spec = generateSystem({ ...freshParams(), primary, name }, seed);
  MEMO.set(index, spec);
  return spec;
}

/** The server's default design for the explorer and the lab: the first hero design. */
export function defaultDesign(): DesignSpec {
  return heroSpec(0);
}

/** All six designs as cards; hero-cards.json must equal this (C-LAND5-02). */
export function heroCards(): HeroCards {
  const specs = HERO_PARAMS.map((_, i) => heroSpec(i));
  const first = specs[0] as DesignSpec;
  return {
    seed: flavorSeed(specId(first)),
    fade: {
      durationMs: first.motion.durations.base,
      easing: first.motion.easings.standard,
    },
    cards: specs.map((spec) => ({
      name: spec.meta.name,
      href: `/studio#s=${encodeSpec(spec)}`,
      stops: flavorStops(spec, "dark"),
    })),
  };
}
