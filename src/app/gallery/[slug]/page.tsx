import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageFrame } from "@/components/terminal/PageFrame";
import { Prompt } from "@/components/terminal/Prompt";
import { summaryLines } from "@/features/export/files";
import { CopyLink } from "@/features/gallery/CopyLink";
import { entryMetadata, entryOf, type GalleryEntry } from "@/features/gallery/data";
import { absoluteStudioLink, type LinkPage, openHref } from "@/features/gallery/links";
import { SITE } from "@/lib/site/config";

type EntryProps = { params: Promise<{ slug: string }> };

/** The entry for the route's slug, or the 404 page for an unknown one. */
async function entryFor(params: EntryProps["params"]): Promise<GalleryEntry> {
  const entry = entryOf((await params).slug);
  if (entry === null) notFound();
  return entry;
}

export async function generateMetadata({ params }: EntryProps): Promise<Metadata> {
  return entryMetadata(await entryFor(params));
}

const HEADING = "font-mono font-semibold text-lg";
const LABEL = "font-mono text-fg-muted text-xs";
const LINK =
  "inline-flex min-h-8 w-fit items-center text-foreground text-sm underline underline-offset-4 hover:text-fg-muted";
const MODES = [
  { mode: "light", label: "Light mode" },
  { mode: "dark", label: "Dark mode" },
] as const;
const OPEN_LINKS: readonly { page: LinkPage; label: string }[] = [
  { page: "studio", label: "Open in the studio" },
  { page: "explore", label: "Open in the explorer" },
  { page: "motion", label: "Open in the motion lab" },
];

/** Each family once, joined as a sentence lists them: "a", "a and b", "a, b and c". */
function familyList({ display, body, mono }: GalleryEntry["families"]): string {
  const names = [...new Set([display, body, mono])];
  return names.length === 1
    ? names.join("")
    : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** How the entry was made (7.4, item 2). */
function madeLine(entry: GalleryEntry): string {
  return entry.source === "brief"
    ? `Made from this brief by the studio's word list, with no model. It matched: ${entry.terms.join(", ")}.`
    : "Made from one seed color with the studio's controls.";
}

function Swatch({ hex }: { hex: string }) {
  return (
    <span
      data-swatch=""
      aria-hidden="true"
      className="block h-5 w-5 shrink-0 rounded-sm border border-border"
      style={{ backgroundColor: hex }}
    />
  );
}

// An entry of the gallery (docs/specs/06-gallery.md, section 7.4): its facts, its receipt, its scales
// and roles in both modes and its type ladder, read from the committed entry; the design's colors show
// only inside the specimens (I-M6-06), and the page loads none of its fonts. The open links go through
// the open route, which redirects with the design in the fragment (R6-15).
export default async function GalleryEntryPage({ params }: EntryProps) {
  const entry = await entryFor(params);
  const facts: readonly [string, string, string][] = [
    ["Mood", entry.tags.join(", "), ""],
    ["Preset", entry.presetLabel, ""],
    ["Type", familyList(entry.families), ""],
    ["Lot", entry.lot, "font-mono tabular-nums"],
  ];

  return (
    <PageFrame
      active="gallery"
      statusLeft={`dyelot ~/gallery/${entry.slug}`}
      statusRight="muizz-lab · MIT"
    >
      <section className="mx-auto w-full max-w-6xl space-y-10">
        <div className="space-y-3">
          <Prompt>dyelot gallery {entry.slug}</Prompt>
          <h1 className="font-mono font-semibold text-2xl tracking-tight">{entry.name}</h1>
          <p className="max-w-3xl text-sm">{entry.line}</p>
          <p className="max-w-3xl text-fg-muted text-sm">{madeLine(entry)}</p>
          <dl className="m-0 space-y-1 pt-2 text-sm">
            {facts.map(([term, value, style]) => (
              <div key={term} className="flex gap-3">
                <dt className="w-16 shrink-0 text-fg-muted">{term}</dt>
                <dd className={`m-0 min-w-0 ${style}`}>{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <section aria-labelledby="entry-receipt" className="space-y-3">
          <h2 id="entry-receipt" className={HEADING}>
            Receipt
          </h2>
          <ul
            aria-labelledby="entry-receipt"
            className="m-0 list-none space-y-1 p-0 font-mono text-sm tabular-nums"
          >
            {summaryLines(entry.summary).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="entry-scales" className="space-y-3">
          <h2 id="entry-scales" className={HEADING}>
            Scales
          </h2>
          <div className="grid gap-6 lg:grid-cols-2">
            {MODES.map(({ mode, label }) => (
              <figure key={mode} data-specimen="" className="m-0 min-w-0 space-y-2">
                <figcaption className="text-fg-muted text-sm">
                  {label}: eight palettes of eleven steps.
                </figcaption>
                {Object.entries(entry.scales[mode]).map(([palette, hexes]) => (
                  <div key={palette} className="flex flex-col gap-1 sm:flex-row sm:items-center">
                    <span data-palette="" className={`${LABEL} sm:w-20 sm:shrink-0`}>
                      {palette}
                    </span>
                    <span className="flex gap-0.5">
                      {hexes.map((hex, index) => (
                        // A scale's eleven steps are a fixed list in step order.
                        // biome-ignore lint/suspicious/noArrayIndexKey: the position is the step
                        <Swatch key={index} hex={hex} />
                      ))}
                    </span>
                  </div>
                ))}
              </figure>
            ))}
          </div>
        </section>

        <section aria-labelledby="entry-roles" className="space-y-3">
          <h2 id="entry-roles" className={HEADING}>
            Roles
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {MODES.map(({ mode, label }) => (
              <figure key={mode} data-specimen="" className="m-0 min-w-0 space-y-2">
                <figcaption className="text-fg-muted text-sm">{label}</figcaption>
                <ul className="m-0 list-none space-y-1 p-0">
                  {entry.roles[mode].map((role) => (
                    <li
                      key={role.name}
                      data-role={role.name}
                      className="flex items-center gap-3 text-sm"
                    >
                      <Swatch hex={role.hex} />
                      <span className="min-w-0 flex-1 font-mono">{role.name}</span>{" "}
                      <span className="font-mono text-fg-muted">{role.hex}</span>
                    </li>
                  ))}
                </ul>
              </figure>
            ))}
          </div>
        </section>

        <section aria-labelledby="entry-type" className="space-y-3">
          <h2 id="entry-type" className={HEADING}>
            Type
          </h2>
          <table className="w-full max-w-2xl border-collapse text-left text-sm">
            <caption className="pb-2 text-left text-fg-muted text-sm">The type ladder</caption>
            <thead>
              <tr className="border-border border-b">
                {["Step", "Size", "Line height", "Family"].map((column) => (
                  <th key={column} scope="col" className="py-1 pr-4 font-normal text-fg-muted">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entry.type.map((step) => (
                <tr key={step.name} className="border-border border-b">
                  <td className="py-1 pr-4 font-mono">{step.name}</td>
                  <td className="py-1 pr-4 font-mono tabular-nums">{step.sizePx} px</td>
                  <td className="py-1 pr-4 font-mono tabular-nums">{step.lineHeightPx} px</td>
                  <td className="py-1 [overflow-wrap:anywhere]">{entry.families[step.family]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section aria-labelledby="entry-open" className="space-y-3">
          <h2 id="entry-open" className={HEADING}>
            Open it
          </h2>
          <div className="flex flex-col">
            {OPEN_LINKS.map(({ page, label }) => (
              <a key={page} href={openHref(entry.slug, page)} className={LINK}>
                {label}
              </a>
            ))}
          </div>
          <CopyLink link={absoluteStudioLink(SITE.url, entry.link)} />
          <a href="/gallery" className={LINK}>
            Back to the gallery
          </a>
        </section>
      </section>
    </PageFrame>
  );
}
