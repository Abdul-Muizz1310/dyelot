import type { Metadata } from "next";
import { PageFrame } from "@/components/terminal/PageFrame";
import { Prompt } from "@/components/terminal/Prompt";
import { ExploreClient } from "@/features/explore/ExploreClient";
import { defaultDesign } from "@/features/landing/heroes";
import { SITE } from "@/lib/site/config";
import { pageMetadata } from "@/lib/site/metadata";

export const metadata: Metadata = pageMetadata(SITE, "/explore", {
  title: "Explorer",
  description:
    "See a palette in OKLab: the sRGB, Display P3 and Rec. 2020 gamut solids, every step as a point, each scale as a tube, and a lightness slice.",
});

// The explorer (spec 8.1): the server renders the default design and its flat view, and the client
// reads the link in the hash, which only the browser has, and mounts the 3D view.
export default function ExplorePage() {
  return (
    <PageFrame active="explore" statusLeft="dyelot ~/explore" statusRight="muizz-lab · MIT">
      <section className="mx-auto w-full max-w-6xl space-y-6">
        <div className="space-y-3">
          <Prompt>dyelot explore</Prompt>
          <h1 className="font-mono text-2xl font-semibold tracking-tight">The palette in OKLab</h1>
          <p className="max-w-2xl text-fg-muted text-sm">
            Every step of the design sits at its place in OKLab, lightness up and the two color axes
            across. A solid holds every color its gamut can show.
          </p>
        </div>
        <ExploreClient initial={defaultDesign()} />
      </section>
    </PageFrame>
  );
}
