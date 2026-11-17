// The landing's start-from links (docs/specs/06-gallery.md, R6-27, R6-28, 5.2, 9.1): pure, and it
// imports nothing, so the client component that uses it reaches no engine, spec or export code.

/** The longest brief the studio's Brief box takes. */
export const START_BRIEF_MAX = 500;
export const IMAGE_HREF = "/studio#start=image";
export const GALLERY_HREF = "/gallery";

/** Every string of 9.1's table. */
export const START_LINES: Readonly<Record<string, string>> = Object.freeze({
  heading: "Start a design from",
  color: "a color",
  colorLabel: "Seed color",
  colorSubmit: "Open the studio with this color",
  brief: "a brief",
  briefLabel: "Describe the product or mood",
  briefPlaceholder: "A tea house at dusk, calm and exact",
  briefNote:
    "The studio puts it in its Brief box. Nothing reads it until you press Read the brief there.",
  briefSubmit: "Take this brief to the studio",
  briefEmpty: "Write a few words first.",
  image: "an image",
  imageNote:
    "The studio finds an image's colors in this browser. Nothing leaves your device until you ask a model to read it.",
  imageLink: "Open the studio's image drop",
  gallery: "the gallery",
  galleryNote: "Original design systems made by dyelot, each with its receipt.",
  galleryLink: "Browse the gallery",
});

const HEX6 = /^#?([0-9a-fA-F]{6})$/;
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const LETTER = /\p{L}/u;

function typeOf(value: unknown): string {
  if (value === null) return "null";
  return Array.isArray(value) ? "array" : typeof value;
}

function assertString(value: unknown, name: string): asserts value is string {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a string, got ${typeOf(value)}`);
  }
}

function ready(text: string): boolean {
  if (LONE_SURROGATE.test(text)) return false;
  const trimmed = text.trim();
  // The studio measures the text in NFC (readEntry's toPlainText), where a character such as
  // U+0344 is longer, so the bound is measured there too.
  const length = trimmed.normalize("NFC").length;
  return length >= 1 && length <= START_BRIEF_MAX && LETTER.test(trimmed);
}

/** `/studio#color=<hex>` for six hex digits, with or without `#`. */
export function colorHref(hex: string): string {
  assertString(hex, "colorHref: hex");
  const match = HEX6.exec(hex);
  if (match === null) {
    throw new RangeError(`colorHref: hex must be six hex digits, got ${JSON.stringify(hex)}`);
  }
  return `/studio#color=${(match[1] as string).toLowerCase()}`;
}

/** Whether `briefHref` accepts `text`: well-formed, 1 to 500 characters trimmed, holding a letter. */
export function briefReady(text: string): boolean {
  assertString(text, "briefReady: text");
  return ready(text);
}

/** `/studio#brief=<text>`, the trimmed text escaped. */
export function briefHref(text: string): string {
  assertString(text, "briefHref: text");
  if (!ready(text)) {
    throw new RangeError(
      `briefHref: text must be well-formed, 1 to ${START_BRIEF_MAX} characters and hold a letter`,
    );
  }
  return `/studio#brief=${encodeURIComponent(text.trim())}`;
}
