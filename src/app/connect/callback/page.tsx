import type { Metadata } from "next";
import { PageFrame } from "@/components/terminal/PageFrame";
import { CallbackPanel } from "@/features/ai/CallbackPanel";
import { SITE } from "@/lib/site/config";
import { pageMetadata } from "@/lib/site/metadata";

const TITLE = "Connecting your OpenRouter key";

// Section 12.4: out of search results and out of robots.txt (R4-22). The address holds the
// sign-in's code and state, so this meta tag and the response's own Referrer-Policy
// (next.config.ts) keep it out of every Referer header (R4-33).
export const metadata: Metadata = {
  ...pageMetadata(SITE, "/connect/callback", {
    title: TITLE,
    description:
      "Finishes the OpenRouter sign-in in this browser and returns you to the studio. The key stays in this browser.",
  }),
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// Section 13.6: the heading, then the callback panel, which finishes the sign-in in the browser.
export default function ConnectCallbackPage() {
  return (
    <PageFrame statusLeft="dyelot ~/connect/callback">
      <section className="mx-auto my-auto w-full max-w-xl space-y-6">
        <h1 className="font-mono text-xl font-semibold tracking-tight">{TITLE}</h1>
        <CallbackPanel />
      </section>
    </PageFrame>
  );
}
