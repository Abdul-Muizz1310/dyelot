import cards from "./hero-cards.json";

/**
 * The landing's six hero designs as data (R5-31, 5.5). This file imports no engine code: the
 * landing's client bundle gets these committed values and not the generator (C-GUARD5-05).
 */
export type HeroCard = {
  readonly name: string;
  readonly href: string;
  /** Five hexes, `flavorStops(spec, "dark")`. */
  readonly stops: readonly string[];
};

export type HeroCards = {
  readonly seed: readonly number[];
  readonly fade: { readonly durationMs: number; readonly easing: readonly number[] };
  /** Six cards. */
  readonly cards: readonly HeroCard[];
};

/** `heroCards()` as committed in hero-cards.json; C-LAND5-02 rebuilds and compares it. */
export const HERO_CARDS: HeroCards = cards;
