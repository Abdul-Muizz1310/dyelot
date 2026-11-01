import type { Metadata } from "next";
import { Studio } from "@/features/studio/Studio";
import { SITE } from "@/lib/site/config";
import { pageMetadata } from "@/lib/site/metadata";

// The studio (spec section 7.1): a client application. The server renders its loading state; the
// store reads the link in the hash and the draft in localStorage, which only the browser has.
export const metadata: Metadata = pageMetadata(SITE, "/studio", {
  title: "Studio",
  description:
    "Turn a palette into a design system: set every parameter, watch it live on the canvas and share the result by link.",
});

export default function StudioPage() {
  return (
    <>
      <Studio />
      <noscript>
        <p className="p-4 text-center font-mono text-sm text-fg-muted">
          The studio needs JavaScript. Turn it on and reload the page.
        </p>
      </noscript>
    </>
  );
}
