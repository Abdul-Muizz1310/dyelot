import Link from "next/link";
import { REPOSITORY_URL } from "@/lib/links";

export type AppNavProps = {
  active?: "home" | "explore" | "motion" | "gallery" | "about";
};

// Links are 32 px tall, above the 24 px WCAG 2.2 minimum. Below 640 px the links may wrap into two
// rows, so the active mark sits 2 px under its own link; from 640 px the links share one row and the
// mark sits on the nav's bottom border: (56 px nav - 32 px link) / 2 - 1 px border = 11 px below.
const LINK = "inline-flex h-8 items-center";
const LINK_ACTIVE = `${LINK} relative text-foreground after:absolute after:-bottom-[2px] sm:after:-bottom-[11px] after:left-0 after:h-[2px] after:w-full after:bg-accent-madder`;
const LINK_IDLE = `${LINK} transition-colors hover:text-foreground`;

/** The lucide "swatch-book" glyph (ISC license, https://lucide.dev/license), as in icon.svg. */
function SwatchBook() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 17a4 4 0 0 1-8 0V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2Z" />
      <path d="M16.7 13H19a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H7" />
      <path d="M 7 17h.01" />
      <path d="m11 8 2.3-2.3a2.4 2.4 0 0 1 3.404.004L18.6 7.6a2.4 2.4 0 0 1 .026 3.434L9.9 19.8" />
    </svg>
  );
}

/** The links before "github", in order (7.3); the studio draws no nav, so it is never `active`. */
const PAGES = [
  { name: "home", href: "/" },
  { name: "studio", href: "/studio" },
  { name: "explore", href: "/explore" },
  { name: "motion", href: "/motion" },
  // prefetch={false} until Task 6.6c: in M5, prefetching a route that 404s timed out F-SEC4-02.
  { name: "gallery", href: "/gallery", prefetch: false },
  { name: "about", href: "/about", prefetch: false },
] as const satisfies readonly { name: string; href: string; prefetch?: false }[];

/** The sticky, blurred nav: the brand tile (the same glyph as the icon) and seven links. */
export function AppNav({ active }: AppNavProps) {
  return (
    <nav className="sticky top-0 z-20 border-b border-border bg-page/80 backdrop-blur-md">
      <div className="mx-auto flex min-h-14 py-1 sm:h-14 sm:py-0 max-w-[1400px] items-center justify-between gap-3 px-4 sm:gap-6 md:px-6">
        <Link href="/" className="flex items-center gap-2 font-mono">
          <span className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-panel text-accent-madder">
            <SwatchBook />
          </span>
          <span className="max-sm:sr-only text-sm font-semibold tracking-tight text-foreground">
            dyelot
          </span>
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-0 font-mono text-xs text-fg-muted sm:flex-nowrap sm:gap-x-5">
          {PAGES.map((page) => (
            <Link
              key={page.name}
              href={page.href}
              prefetch={"prefetch" in page ? page.prefetch : undefined}
              aria-current={active === page.name ? "page" : undefined}
              className={active === page.name ? LINK_ACTIVE : LINK_IDLE}
            >
              {page.name}
            </Link>
          ))}
          <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer" className={LINK_IDLE}>
            github
          </a>
        </div>
      </div>
    </nav>
  );
}
