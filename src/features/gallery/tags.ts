/** The six moods of the gallery (R6-07), in the order an entry lists them. */
export const GALLERY_TAGS = Object.freeze([
  "calm",
  "bold",
  "editorial",
  "technical",
  "playful",
  "natural",
] as const);

export type GalleryTag = (typeof GALLERY_TAGS)[number];

/** What `?tag=` chose: a mood, every entry, or a value that is none of those. */
export type TagChoice = GalleryTag | "all" | "unknown";

const TAGS: readonly string[] = GALLERY_TAGS;

/**
 * Reads the `tag` search parameter (R6-07): `undefined` is `"all"`, a string equal to a mood is that
 * mood, and any other string, the empty string or an array (a repeated `tag`) is `"unknown"`. Any other
 * type is a `TypeError`.
 */
export function readTag(value: string | readonly string[] | undefined): TagChoice {
  if (value === undefined) return "all";
  if (Array.isArray(value)) return "unknown";
  if (typeof value !== "string") {
    throw new TypeError(
      `readTag: value must be a string, an array or undefined, got ${value === null ? "null" : typeof value}`,
    );
  }
  return TAGS.includes(value) ? (value as GalleryTag) : "unknown";
}
