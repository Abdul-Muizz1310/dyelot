import { notFound } from "next/navigation";
import { entryOf } from "@/features/gallery/data";
import { entryHref, type LinkPage } from "@/features/gallery/links";

const PAGES: readonly string[] = ["studio", "explore", "motion"] satisfies readonly LinkPage[];

const isLinkPage = (page: string): page is LinkPage => PAGES.includes(page);

/**
 * The open route (docs/specs/06-gallery.md, R6-15): a known entry and a known page answer 307 with
 * the relative `Location: /<page>#s=<link>`, which the browser follows with its fragment, so the
 * design never reaches a server. `NextResponse.redirect` wants an absolute URL, hence the bare
 * `Response`. Anything else is the 404 page: the `Location` is built only from committed data, so the
 * route can send a browser nowhere but the studio, the explorer and the motion lab (R6-49).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; page: string }> },
): Promise<Response> {
  const { slug, page } = await params;
  const entry = entryOf(slug);
  if (entry === null || !isLinkPage(page)) notFound();
  return new Response(null, { status: 307, headers: { Location: entryHref(page, entry.link) } });
}
