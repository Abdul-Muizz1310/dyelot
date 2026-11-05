import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageFrame } from "@/components/terminal/PageFrame";
import { EvalRunner } from "@/features/ai/eval/EvalRunner";

const TITLE = "On-device evaluation";

/** The page's title on `pnpm dev`; any other build serves its 404 without naming the page. */
export function generateMetadata(): Metadata {
  if (process.env.NODE_ENV !== "development") return {};
  return { title: TITLE, robots: { index: false, follow: false } };
}

// The on-device eval (docs/specs/04-ai.md, R4-32): a dev-only page the owner opens in a capable
// Chrome on `pnpm dev`. Any other build answers 404 (F-SEC4-05).
export default function OnDeviceEvalPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <PageFrame statusLeft="dyelot ~/dev/on-device-eval">
      <section className="mx-auto w-full max-w-3xl space-y-6">
        <h1 className="font-mono text-xl font-semibold tracking-tight">{TITLE}</h1>
        <EvalRunner />
      </section>
    </PageFrame>
  );
}
