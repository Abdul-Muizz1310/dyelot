/** The pages a gallery design opens in (R6-14). */
export type LinkPage = "studio" | "explore" | "motion";

const PAGES: readonly string[] = ["studio", "explore", "motion"];
/** The longest link the studio reads (65,536 characters). */
const LINK_MAX = 65_536;
const LINK = /^[A-Za-z0-9_-]+$/;
/** R6-12's slug pattern. */
const SLUG = /^[a-z]+(-[a-z]+)*$/;

function typeName(value: unknown): string {
  if (value === null) return "null";
  return Array.isArray(value) ? "array" : typeof value;
}

function checkPage(page: unknown, caller: string): void {
  if (typeof page !== "string") {
    throw new TypeError(`${caller}: page must be a string, got ${typeName(page)}`);
  }
  if (!PAGES.includes(page)) {
    throw new RangeError(`${caller}: page must be studio, explore or motion, got "${page}"`);
  }
}

function checkLink(link: unknown, caller: string): void {
  if (typeof link !== "string") {
    throw new TypeError(`${caller}: link must be a string, got ${typeName(link)}`);
  }
  if (link.length === 0 || link.length > LINK_MAX || !LINK.test(link)) {
    throw new RangeError(
      `${caller}: link must be 1 to ${LINK_MAX} characters of A to Z, a to z, 0 to 9, - and _, got ${link.length} characters`,
    );
  }
}

/** The redirect's `Location`: the page with the design in its fragment. */
export function entryHref(page: LinkPage, link: string): string {
  checkPage(page, "entryHref");
  checkLink(link, "entryHref");
  return `/${page}#s=${link}`;
}

/** The route that redirects to `page` with the design `slug` names. */
export function openHref(slug: string, page: LinkPage): string {
  if (typeof slug !== "string") {
    throw new TypeError(`openHref: slug must be a string, got ${typeName(slug)}`);
  }
  if (!SLUG.test(slug)) {
    throw new RangeError(`openHref: slug must be lowercase words joined by hyphens, got "${slug}"`);
  }
  checkPage(page, "openHref");
  return `/gallery/${slug}/open/${page}`;
}

/** The studio link a visitor copies: the origin, `/studio` and the design in the fragment. */
export function absoluteStudioLink(origin: string, link: string): string {
  if (typeof origin !== "string") {
    throw new TypeError(`absoluteStudioLink: origin must be a string, got ${typeName(origin)}`);
  }
  let valid = false;
  try {
    const url = new URL(origin);
    valid = url.protocol === "https:" && url.origin === origin;
  } catch {
    valid = false;
  }
  if (!valid) {
    throw new RangeError(
      `absoluteStudioLink: origin must be an https origin with no path, got ${JSON.stringify(origin)}`,
    );
  }
  checkLink(link, "absoluteStudioLink");
  return `${origin}/studio#s=${link}`;
}
