import type { Metadata } from "next";
import { PageFrame } from "@/components/terminal/PageFrame";
import { Prompt } from "@/components/terminal/Prompt";
import { defaultDesign } from "@/features/landing/heroes";
import { LabClient } from "@/features/motion/LabClient";
import { SITE } from "@/lib/site/config";
import { pageMetadata } from "@/lib/site/metadata";

export const metadata: Metadata = pageMetadata(SITE, "/motion", {
  title: "Motion lab",
  description:
    "Edit a design's motion: durations, easing curves and springs, with live previews and files for CSS, Motion and GSAP.",
});

// The motion lab (spec 9.1): the server renders the default design, and the client reads the link
// in the hash, which only the browser has.
export default function MotionPage() {
  return (
    <PageFrame active="motion" statusLeft="dyelot ~/motion" statusRight="muizz-lab · MIT">
      <section className="mx-auto w-full max-w-5xl space-y-6">
        <div className="space-y-3">
          <Prompt>dyelot motion</Prompt>
          <h1 className="font-mono text-2xl font-semibold tracking-tight">The motion lab</h1>
          <p className="max-w-2xl text-fg-muted text-sm">
            Change a design's durations, curves and springs, watch them on five small previews, then
            take the files or open the design in the studio.
          </p>
        </div>
        <LabClient initial={defaultDesign()} />
      </section>
    </PageFrame>
  );
}
