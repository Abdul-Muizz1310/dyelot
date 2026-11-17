import type { Metadata } from "next";
import { PageFrame } from "@/components/terminal/PageFrame";
import { Prompt } from "@/components/terminal/Prompt";
import { entriesTagged, GALLERY } from "@/features/gallery/data";
import { GalleryCard } from "@/features/gallery/GalleryCard";
import { GALLERY_TAGS, readTag } from "@/features/gallery/tags";
import { SITE } from "@/lib/site/config";
import { pageMetadata } from "@/lib/site/metadata";

export const metadata: Metadata = pageMetadata(SITE, "/gallery", {
  title: "Gallery",
  description:
    "24 original design systems made by dyelot, each with a receipt of its contrast checks. Open any of them in the studio, the explorer or the motion lab.",
});

const FILTER_LINK = "inline-flex min-h-8 items-center px-1 font-mono text-sm";
const FILTER_IDLE = `${FILTER_LINK} text-fg-muted underline-offset-4 hover:text-foreground hover:underline`;
const FILTER_CURRENT = `${FILTER_LINK} text-foreground underline decoration-2 decoration-accent-madder underline-offset-4`;
const NUMBER = "font-mono tabular-nums";

// The gallery (docs/specs/06-gallery.md, section 7.1): the server reads `?tag=`, filters the
// committed entries and renders their cards; the browser holds no filter state and no gallery data.
// An unknown tag shows every entry and a sentence that never repeats the query (R6-13).
export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string | string[] }>;
}) {
  const choice = readTag((await searchParams).tag);
  const entries = entriesTagged(choice);
  const total = GALLERY.entries.length;
  const heroes = GALLERY.entries.filter((entry) => entry.source === "hero").length;
  const briefs = total - heroes;
  const current = choice === "unknown" ? "all" : choice;
  const filters = [
    { name: "all", href: "/gallery" },
    ...GALLERY_TAGS.map((tag) => ({ name: tag, href: `/gallery?tag=${tag}` })),
  ];

  return (
    <PageFrame active="gallery" statusLeft="dyelot ~/gallery" statusRight="muizz-lab · MIT">
      <section className="mx-auto w-full max-w-6xl space-y-6">
        <div className="space-y-3">
          <Prompt>dyelot gallery</Prompt>
          <h1 className="font-mono font-semibold text-2xl tracking-tight">The gallery</h1>
          <p className="max-w-3xl text-fg-muted text-sm">
            Original design systems made by dyelot: <span className={NUMBER}>{heroes}</span> from
            one seed color each, and <span className={NUMBER}>{briefs}</span> from a one-sentence
            brief that the studio's word list read, with no model. Each passes every required check
            of its receipt. Open one in the studio and make it yours.
          </p>
        </div>

        <nav aria-label="Filter by mood" className="flex flex-wrap gap-x-3">
          {filters.map((filter) => (
            <a
              key={filter.name}
              href={filter.href}
              aria-current={current === filter.name ? "page" : undefined}
              className={current === filter.name ? FILTER_CURRENT : FILTER_IDLE}
            >
              {filter.name}
            </a>
          ))}
        </nav>

        <div className="space-y-1 text-sm">
          {choice === "unknown" && <p>That mood is not one of the six, so every design shows.</p>}
          {choice === "all" || choice === "unknown" ? (
            <p>
              All <span className={NUMBER}>{total}</span> designs.
            </p>
          ) : (
            <p>
              <span className={NUMBER}>{entries.length}</span> of{" "}
              <span className={NUMBER}>{total}</span> designs are tagged {choice}.
            </p>
          )}
        </div>

        <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2 xl:grid-cols-3">
          {entries.map((entry) => (
            <li key={entry.slug} className="min-w-0">
              <GalleryCard entry={entry} />
            </li>
          ))}
        </ul>
      </section>
    </PageFrame>
  );
}
