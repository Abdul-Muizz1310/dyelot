import type { Metadata } from "next";
import { PageFrame } from "@/components/terminal/PageFrame";
import { SITE } from "@/lib/site/config";
import { pageMetadata } from "@/lib/site/metadata";

const TITLE = "Connecting your OpenRouter key";

// Section 12.4: out of search results and out of robots.txt (R4-22), and the address, which holds
// the sign-in's code and state, never leaves in a Referer header.
export const metadata: Metadata = {
  ...pageMetadata(SITE, "/connect/callback", {
    title: TITLE,
    description:
      "Finishes the OpenRouter sign-in in this browser and returns you to the studio. The key stays in this browser.",
  }),
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// The heading of section 13.6. Task 4.10a mounts the callback panel beneath it.
export default function ConnectCallbackPage() {
  return (
    <PageFrame statusLeft="dyelot ~/connect/callback">
      <section className="mx-auto my-auto w-full max-w-xl space-y-4">
        <h1 className="font-mono text-xl font-semibold tracking-tight">{TITLE}</h1>
      </section>
    </PageFrame>
  );
}
