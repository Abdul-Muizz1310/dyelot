import type { Metadata } from "next";
import Link from "next/link";
import { PageFrame } from "@/components/terminal/PageFrame";
import { Prompt } from "@/components/terminal/Prompt";
import { TerminalWindow } from "@/components/terminal/TerminalWindow";
import { heroSpec } from "@/features/landing/heroes";
import { Story } from "@/features/landing/Story";
import { REPOSITORY_LABEL, REPOSITORY_URL } from "@/lib/links";
import { SITE } from "@/lib/site/config";
import { StructuredData } from "@/lib/site/structured-data";

// No title here: it would skip the root layout's `%s — dyelot` template, and the home page shows
// the site title. The canonical names the page itself.
export const metadata: Metadata = { alternates: { canonical: "/" } };

/** One `$ open <target>` link of start.log, as M2's studio link was. */
function StartLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      // Task 5.11a removes this once /explore and /motion exist (see AppNav).
      prefetch={href === "/explore" || href === "/motion" ? false : undefined}
      className="group block w-fit max-w-full"
    >
      <Prompt>
        open{" "}
        <span className="text-accent-madder underline-offset-4 group-hover:underline">{label}</span>
      </Prompt>
    </Link>
  );
}

// The page says what exists today, and nothing else: the product's one-liner, a way into each page
// that shipped and the story of one design. Add a line here only when the feature behind it ships.
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
        <TerminalWindow title="start.log">
          <div className="space-y-2">
            <StartLink href="/studio" label="the studio" />
            <StartLink href="/explore" label="the explorer" />
            <StartLink href="/motion" label="the motion lab" />
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
        <Story spec={heroSpec(0)} />
      </section>
    </PageFrame>
  );
}
