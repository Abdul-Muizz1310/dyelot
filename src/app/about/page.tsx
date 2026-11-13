import type { Metadata } from "next";
import { PageFrame } from "@/components/terminal/PageFrame";
import { Prompt } from "@/components/terminal/Prompt";
import {
  ABOUT_INTRO,
  ABOUT_LINK_PLACES,
  ABOUT_LINKS,
  ABOUT_SECTIONS,
  type AboutLink,
} from "@/features/about/copy";
import { SITE } from "@/lib/site/config";
import { pageMetadata } from "@/lib/site/metadata";

export const metadata: Metadata = pageMetadata(SITE, "/about", {
  title: "About",
  description:
    "How dyelot works: the color math, the receipt and its checker, what AI sees and what stays in your browser, and the licenses of what it builds on.",
});

// Section 11.1: the page renders the copy and holds no other prose. `ABOUT_LINK_PLACES` says which
// paragraph each link of `ABOUT_LINKS` follows (section 11.3).
function linksAfter(section: string, index: number): AboutLink[] {
  return ABOUT_LINKS.filter((_, i) => {
    const place = ABOUT_LINK_PLACES[i];
    return place?.section === section && place.paragraph === index;
  });
}

const PARAGRAPH = "text-fg-muted leading-relaxed";
const LINK = "w-fit text-accent-madder underline underline-offset-4";

export default function AboutPage() {
  return (
    <PageFrame active="about" statusLeft="dyelot ~/about" statusRight="muizz-lab · MIT">
      <section className="mx-auto w-full max-w-3xl space-y-6">
        <Prompt>dyelot about</Prompt>
        <h1 className="font-mono text-3xl font-semibold tracking-tight sm:text-4xl">
          How dyelot works
        </h1>
        <p className={PARAGRAPH}>{ABOUT_INTRO.text}</p>
        {ABOUT_SECTIONS.map((section) => (
          <div key={section.id} className="space-y-4 pt-4">
            <h2 id={section.id} className="font-mono text-xl font-semibold tracking-tight">
              {section.heading}
            </h2>
            {section.paragraphs.map((paragraph, index) => (
              <div key={paragraph.text} className="space-y-2">
                <p className={PARAGRAPH}>{paragraph.text}</p>
                {linksAfter(section.id, index).map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    rel="noopener noreferrer"
                    className={`block ${LINK}`}
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            ))}
          </div>
        ))}
      </section>
    </PageFrame>
  );
}
