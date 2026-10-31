import type { Metadata } from "next";
import { PageFrame } from "@/components/terminal/PageFrame";
import { Prompt } from "@/components/terminal/Prompt";
import { TerminalWindow } from "@/components/terminal/TerminalWindow";
import { REPOSITORY_LABEL, REPOSITORY_URL } from "@/lib/links";
import { SITE } from "@/lib/site/config";
import { StructuredData } from "@/lib/site/structured-data";

// No title here: it would skip the root layout's `%s — dyelot` template, and the home page shows
// the site title. The canonical names the page itself.
export const metadata: Metadata = { alternates: { canonical: "/" } };

// The page says what exists today, and nothing else: the product's one-liner and the work in
// progress. Add a line here only when the feature behind it ships.
export default function Home() {
  return (
    <PageFrame active="home" statusLeft="dyelot ~/" statusRight="muizz-lab · MIT">
      <StructuredData site={SITE} />
      <section className="mx-auto my-auto w-full max-w-3xl space-y-8">
        <div className="space-y-5">
          <Prompt>dyelot</Prompt>
          <h1 className="font-mono text-3xl font-semibold leading-[1.15] tracking-tight sm:text-4xl md:text-5xl">
            <span className="text-accent-madder">dyelot</span>
            <span className="text-fg-muted"> — </span>a palette becomes a design system your coding
            agent can build
          </h1>
        </div>
        <TerminalWindow title="status.log">
          <div className="space-y-2">
            <Prompt kind="comment">in progress: the color engine</Prompt>
            <a
              href={REPOSITORY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group block w-fit max-w-full"
            >
              <Prompt>
                open{" "}
                <span className="text-accent-madder underline-offset-4 group-hover:underline">
                  {REPOSITORY_LABEL}
                </span>
              </Prompt>
            </a>
            <Prompt cursor />
          </div>
        </TerminalWindow>
      </section>
    </PageFrame>
  );
}
