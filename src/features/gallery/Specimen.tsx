import type { GalleryEntry } from "./data";

// A gallery card's specimen (docs/specs/06-gallery.md, section 7.3): the five palettes of the brand
// video at five light steps. It is the only place on a card where the design's colors appear
// (I-M6-06); the caption tells assistive technology what the swatches show.

/** The light steps each specimen row shows, in order. */
const SPECIMEN_STEPS = [100, 300, 500, 700, 900] as const;

export function Specimen({ entry }: { entry: GalleryEntry }) {
  return (
    <figure
      data-specimen=""
      className="m-0 space-y-1.5 rounded-lg border border-border bg-page p-3"
    >
      <figcaption className="sr-only">
        Five palettes of {entry.name} in light mode: primary, secondary, accent, neutral and danger,
        at steps 100, 300, 500, 700 and 900.
      </figcaption>
      {entry.specimen.map((row) => (
        <div key={row.palette} className="flex items-center gap-3">
          <span className="w-20 shrink-0 font-mono text-fg-muted text-xs">{row.palette}</span>
          <span className="flex gap-1">
            {row.hexes.map((hex, index) => (
              <span
                key={SPECIMEN_STEPS[index]}
                data-swatch=""
                aria-hidden="true"
                className="block h-6 w-6 rounded-sm border border-border"
                style={{ backgroundColor: hex }}
              />
            ))}
          </span>
        </div>
      ))}
    </figure>
  );
}
