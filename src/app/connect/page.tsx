import type { Metadata } from "next";
import { PageFrame } from "@/components/terminal/PageFrame";
import { SITE } from "@/lib/site/config";
import { pageMetadata } from "@/lib/site/metadata";

const TITLE = "Connect your OpenRouter key";

// Section 12.4: out of search results, but not out of robots.txt, so a link preview still reads it.
export const metadata: Metadata = {
  ...pageMetadata(SITE, "/connect", {
    title: TITLE,
    description:
      "Use your own OpenRouter account for dyelot's model actions. Your browser talks to OpenRouter directly, and the key never reaches dyelot.",
  }),
  robots: { index: false, follow: false },
};

// The heading of section 13.6. Task 4.10a mounts the connect panel beneath it.
export default function ConnectPage() {
  return (
    <PageFrame statusLeft="dyelot ~/connect">
      <section className="mx-auto my-auto w-full max-w-xl space-y-4">
        <h1 className="font-mono text-xl font-semibold tracking-tight">{TITLE}</h1>
      </section>
    </PageFrame>
  );
}
