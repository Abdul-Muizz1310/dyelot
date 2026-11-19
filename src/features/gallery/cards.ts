import cardsJson from "./cards.json";
import type { GalleryData } from "./data";
import { typeName } from "./links";

/** One entry's share-card data (R6-09). This file imports no engine code (C-GUARD6-05). */
export type GalleryCard = {
  readonly slug: string;
  readonly name: string;
  readonly line: string;
  /** The five specimen palettes at step 500. */
  readonly strip: readonly string[];
  readonly passed: number;
  readonly required: number;
};

export type GalleryCards = { readonly cards: readonly GalleryCard[] };

const PALETTES = ["primary", "secondary", "accent", "neutral", "danger"] as const;
/** The step-500 hex in a specimen row of steps 100, 300, 500, 700 and 900. */
const MIDDLE = 2;

/** `cards.json` as committed; C-CARD6-02 rebuilds and compares it. */
export const GALLERY_CARDS: GalleryCards = cardsJson;

/** The share-card data of every entry (R6-09), in the entries' order. */
export function galleryCards(data: GalleryData): GalleryCards {
  if (typeof data !== "object" || data === null || !Array.isArray(data.entries)) {
    throw new TypeError(`galleryCards: data must hold an entries array, got ${typeName(data)}`);
  }
  return {
    cards: data.entries.map((entry) => {
      const rows = entry.specimen;
      if (!Array.isArray(rows)) {
        throw new TypeError(
          `galleryCards: the specimen of "${entry.slug}" must be an array, got ${typeName(rows)}`,
        );
      }
      const ordered = PALETTES.every((palette, i) => rows[i]?.palette === palette);
      if (!ordered || rows.length !== PALETTES.length) {
        throw new RangeError(
          `galleryCards: the specimen of "${entry.slug}" must hold ${PALETTES.join(", ")} in order`,
        );
      }
      return {
        slug: entry.slug,
        name: entry.name,
        line: entry.line,
        strip: rows.map((row) => row.hexes[MIDDLE] as string),
        passed: entry.summary.contrast.requiredPass,
        required: entry.summary.contrast.required,
      };
    }),
  };
}

/** The card with `slug`, or null for an unknown slug. */
export function cardOf(slug: string): GalleryCard | null {
  if (typeof slug !== "string") {
    throw new TypeError(`cardOf: slug must be a string, got ${typeName(slug)}`);
  }
  return GALLERY_CARDS.cards.find((card) => card.slug === slug) ?? null;
}
