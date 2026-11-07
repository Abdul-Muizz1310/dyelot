import type { GalleryTag } from "./tags";

/** One of the six M5 hero designs, by index into `HERO_PARAMS` (R6-05). */
export type HeroDef = {
  readonly slug: string;
  readonly source: "hero";
  readonly hero: number;
  readonly tags: readonly GalleryTag[];
};

/** A design made from a one-sentence brief by the studio's rule-based path (R6-06). */
export type BriefDef = {
  readonly slug: string;
  readonly source: "brief";
  readonly name: string;
  readonly seed: string;
  readonly brief: string;
  readonly tags: readonly GalleryTag[];
};

export type GalleryDef = HeroDef | BriefDef;

const tags = (...list: GalleryTag[]): readonly GalleryTag[] => Object.freeze(list);
const hero = (slug: string, index: number, list: readonly GalleryTag[]): HeroDef =>
  Object.freeze({ slug, source: "hero", hero: index, tags: list });
const brief = (slug: string, name: string, text: string, list: readonly GalleryTag[]): BriefDef =>
  Object.freeze({ slug, source: "brief", name, seed: `gallery-${slug}`, brief: text, tags: list });

/** Section 6's 24 rows, in order (R6-05, R6-12): the six heroes, then 18 briefs in preset order. */
export const GALLERY_DEFS: readonly GalleryDef[] = Object.freeze([
  hero("madder", 0, tags("bold")),
  hero("weld", 1, tags("playful", "natural")),
  hero("verdigris", 2, tags("calm", "natural")),
  hero("woad", 3, tags("calm", "technical")),
  hero("logwood", 4, tags("editorial")),
  hero("cochineal", 5, tags("bold", "playful")),
  brief(
    "realgar",
    "Realgar",
    "A balanced, versatile planner for small teams, professional and fast, in orange.",
    tags("technical"),
  ),
  brief(
    "cinnabar",
    "Cinnabar",
    "A Swiss grid for an architecture studio, stark and precise, with one red.",
    tags("bold", "technical"),
  ),
  brief(
    "ochre",
    "Ochre",
    "A minimal concrete grid, neutral and crisp, with one ochre mark.",
    tags("editorial"),
  ),
  brief(
    "kermes",
    "Kermes",
    "A slow longform magazine set in serif on warm paper, with burgundy headings.",
    tags("calm", "editorial"),
  ),
  brief(
    "lapis",
    "Lapis",
    "A formal law journal, classic serif on quiet paper, with navy rules.",
    tags("editorial"),
  ),
  brief(
    "gamboge",
    "Gamboge",
    "A loud, confident neo brutalism store page in saturated yellow with sharp edges.",
    tags("bold", "playful"),
  ),
  brief(
    "smalt",
    "Smalt",
    "A frosted glass landing page for a weather startup, cool azure and high contrast.",
    tags("calm", "technical"),
  ),
  brief(
    "turquoise",
    "Turquoise",
    "A dense, fast terminal for API work, flat panels and one teal accent.",
    tags("technical"),
  ),
  brief(
    "safflower",
    "Safflower",
    "A friendly bento of modular tiles for a mobile app in rose.",
    tags("playful"),
  ),
  brief(
    "verditer",
    "Verditer",
    "A slow northern lights gradient for a storefront, vivid and cool.",
    tags("calm", "natural"),
  ),
  brief(
    "tyrian",
    "Tyrian",
    "Neon synthwave, holographic and magenta, playful as the eighties.",
    tags("bold", "playful"),
  ),
  brief("sepia", "Sepia", "A handcrafted leather workshop, warm and layered.", tags("natural")),
  brief(
    "fustic",
    "Fustic",
    "An embossed brewery label in warm amber, lit from one side.",
    tags("bold", "natural"),
  ),
  brief(
    "rhodonite",
    "Rhodonite",
    "A maximalist poster collage, wild and festive, with fuchsia everywhere.",
    tags("bold", "playful"),
  ),
  brief(
    "turmeric",
    "Turmeric",
    "A cozy organic bakery in honey and cream, slow and handmade.",
    tags("calm", "natural"),
  ),
  brief(
    "terre-verte",
    "Terre verte",
    "A quiet matcha tea house, slow and handmade.",
    tags("calm", "natural"),
  ),
  brief(
    "malachite",
    "Malachite",
    "A stark pixel bitmap in black and lime, sharp and flat.",
    tags("technical", "playful"),
  ),
  brief(
    "azurite",
    "Azurite",
    "A bouncy, expressive habit tracker, friendly and animated, in blue.",
    tags("playful"),
  ),
]);
