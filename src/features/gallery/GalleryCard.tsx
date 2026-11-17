import { summaryLines } from "@/features/export/files";
import type { GalleryEntry } from "./data";
import { openHref } from "./links";
import { Specimen } from "./Specimen";

// One card of /gallery (docs/specs/06-gallery.md, section 7.2). A server component: the page sends
// no gallery data to the browser, and the card holds no design link, only the open route's address
// (R6-14). Each link's accessible name starts with its visible words and ends with the design's name,
// so no two links on the page share a name. The names are `aria-label`s: a visually hidden span is
// out of the text flow, and the name computation puts a space before its comma (R6-14's amendment).

const LINK =
  "inline-flex min-h-8 items-center text-foreground text-sm underline underline-offset-4 hover:text-fg-muted";

/** The type pairing: the display and body families, one name when they are the same family. */
function pairing({ display, body }: GalleryEntry["families"]): string {
  return display === body ? display : `${display} and ${body}`;
}

export function GalleryCard({ entry }: { entry: GalleryEntry }) {
  const heading = `gallery-card-${entry.slug}`;
  const facts: readonly [string, string, string][] = [
    ["Type", pairing(entry.families), ""],
    ["Preset", entry.presetLabel, ""],
    ["Receipt", summaryLines(entry.summary)[0] ?? "", "font-mono tabular-nums"],
    ["Lot", entry.lot, "font-mono tabular-nums"],
  ];
  return (
    <article
      aria-labelledby={heading}
      data-gallery-card=""
      data-slug={entry.slug}
      className="flex h-full flex-col gap-4 rounded-xl border border-border bg-panel p-5"
    >
      <div className="space-y-1.5">
        <h2 id={heading} className="font-mono font-semibold text-lg">
          {entry.name}
        </h2>
        <p className="text-fg-muted text-sm">{entry.line}</p>
        <p data-tags="" className="font-mono text-fg-muted text-xs">
          mood: {entry.tags.join(", ")}
        </p>
      </div>
      <Specimen entry={entry} />
      <dl className="m-0 space-y-1 text-sm">
        {facts.map(([term, value, style]) => (
          <div key={term} className="flex gap-3">
            <dt className="w-16 shrink-0 text-fg-muted">{term}</dt>
            <dd className={`m-0 min-w-0 ${style}`}>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-auto flex flex-wrap gap-x-5">
        <a
          href={openHref(entry.slug, "studio")}
          aria-label={`Open in the studio, ${entry.name}`}
          className={LINK}
        >
          Open in the studio
        </a>
        <a href={`/gallery/${entry.slug}`} aria-label={`Details of ${entry.name}`} className={LINK}>
          Details
        </a>
      </div>
    </article>
  );
}
