import type { Metadata } from "next";
import type { PaletteName, PresetId, RoleName, TypeStepName } from "@/engine";
import galleryJson from "./gallery.json";
import type { GalleryTag, TagChoice } from "./tags";

// The gallery's committed entries (R6-08) and the reads over them. This file imports no engine, spec or
// export code at run time (C-GUARD6-05): the pages get these committed values and not the generator.

export type SpecimenPalette = "primary" | "secondary" | "accent" | "neutral" | "danger";

/** The receipt's summary of one design (`summarize`), as the entry holds it. */
export type GallerySummary = {
  readonly pass: boolean;
  readonly contrast: {
    readonly checks: number;
    readonly required: number;
    readonly requiredPass: number;
    readonly advisoryBelow: number;
  };
  readonly separation: { readonly checks: number; readonly below: number };
  readonly gamut: {
    readonly gamut: "srgb" | "p3";
    readonly values: number;
    readonly outside: number;
  };
  readonly lint: { readonly error: number; readonly warn: number; readonly info: number };
};

export type GalleryEntry = {
  readonly slug: string;
  readonly name: string;
  readonly source: "hero" | "brief";
  readonly line: string;
  readonly brief: string | null;
  readonly terms: readonly string[];
  readonly tags: readonly GalleryTag[];
  readonly preset: PresetId | null;
  readonly presetLabel: string;
  readonly specId: string;
  readonly lot: string;
  readonly createdWith: "controls" | "lexicon";
  /** `encodeSpec(spec)`, with no `#s=` prefix. */
  readonly link: string;
  readonly summary: GallerySummary;
  readonly families: {
    readonly display: string;
    readonly body: string;
    readonly mono: string;
  };
  /** Five rows of five hexes: steps 100, 300, 500, 700 and 900 in light mode. */
  readonly specimen: readonly {
    readonly palette: SpecimenPalette;
    readonly hexes: readonly string[];
  }[];
  /** The eight palettes' eleven hexes in each mode. */
  readonly scales: Readonly<
    Record<"light" | "dark", Readonly<Record<PaletteName, readonly string[]>>>
  >;
  /** The six roles of the landing's story in each mode. */
  readonly roles: Readonly<
    Record<"light" | "dark", readonly { readonly name: RoleName; readonly hex: string }[]>
  >;
  /** The ten steps, caption to display. */
  readonly type: readonly {
    readonly name: TypeStepName;
    readonly sizePx: number;
    readonly lineHeightPx: number;
    readonly family: "display" | "body";
  }[];
};

export type GalleryData = { readonly entries: readonly GalleryEntry[] };

/** `gallery.json` as committed; C-GAL6-02 rebuilds and compares it. */
export const GALLERY = galleryJson as GalleryData;

const TAG_CHOICES: readonly string[] = [
  "all",
  "unknown",
  "calm",
  "bold",
  "editorial",
  "technical",
  "playful",
  "natural",
];
const DESCRIPTION_MIN = 50;
const DESCRIPTION_MAX = 160;

function typeName(value: unknown): string {
  if (value === null) return "null";
  return Array.isArray(value) ? "array" : typeof value;
}

/** The entry with `slug`, or null for an unknown slug. */
export function entryOf(slug: string): GalleryEntry | null {
  if (typeof slug !== "string") {
    throw new TypeError(`entryOf: slug must be a string, got ${typeName(slug)}`);
  }
  return GALLERY.entries.find((entry) => entry.slug === slug) ?? null;
}

/** The entries a `?tag=` choice shows, in the gallery's order; `"all"` and `"unknown"` give all. */
export function entriesTagged(choice: TagChoice): readonly GalleryEntry[] {
  if (typeof choice !== "string") {
    throw new TypeError(`entriesTagged: choice must be a string, got ${typeName(choice)}`);
  }
  if (!TAG_CHOICES.includes(choice)) {
    throw new RangeError(
      `entriesTagged: choice must be a tag, "all" or "unknown", got "${choice}"`,
    );
  }
  if (choice === "all" || choice === "unknown") return GALLERY.entries;
  return GALLERY.entries.filter((entry) => entry.tags.includes(choice));
}

/** The 24 entry routes, in the gallery's order. */
export function galleryRoutes(): readonly `/gallery/${string}`[] {
  return GALLERY.entries.map((entry) => `/gallery/${entry.slug}` as const);
}

function describeEntry(entry: GalleryEntry, caller: string): string {
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    throw new TypeError(`${caller}: entry must be an object, got ${typeName(entry)}`);
  }
  const { requiredPass, required } = entry.summary.contrast;
  const text = `${entry.line} ${requiredPass} of ${required} required contrast checks pass.`;
  if (text.length < DESCRIPTION_MIN || text.length > DESCRIPTION_MAX) {
    throw new RangeError(
      `${caller}: the description must have ${DESCRIPTION_MIN} to ${DESCRIPTION_MAX} characters, got ${text.length}`,
    );
  }
  return text;
}

/** The entry's description (R6-17): its line and how many required checks pass, 50 to 160 characters. */
export function entryDescription(entry: GalleryEntry): string {
  return describeEntry(entry, "entryDescription");
}

/** The page metadata of an entry (R6-17): its name, its description and its canonical path. */
export function entryMetadata(entry: GalleryEntry): Metadata {
  const description = describeEntry(entry, "entryMetadata");
  return { title: entry.name, description, alternates: { canonical: `/gallery/${entry.slug}` } };
}
