"use client";

import { useMemo } from "react";
import { lintSpec, measureSpec, summarize } from "@/engine";
import { blockReason, exportState, summaryLines } from "@/features/export/files";
import { PanelSection } from "./PanelSection";
import { type StudioStore, useStudio } from "./store";

// The inspector's Receipt section (spec R3-36, section 9.4): the four summary lines the export dialog
// shows, and, when export is off, one more line with the state's sentence (R3-42). It follows every
// committed change, because it reads the held spec.

export function ReceiptSection({ store }: { store: StudioStore }) {
  const spec = useStudio(store, (studio) => studio.spec);
  const provenance = useStudio(store, (studio) => studio.provenance);
  const outcome = useStudio(store, (studio) => studio.outcome);
  const summary = useMemo(
    () => summarize(measureSpec(spec), lintSpec(spec), spec.color.params.gamut),
    [spec],
  );
  const state = exportState(summary, provenance, outcome ?? undefined);
  return (
    <PanelSection title="Receipt">
      <ul aria-label="Receipt lines" className="space-y-1 text-xs leading-snug">
        {summaryLines(summary).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {state !== "passing" && (
        <p data-receipt-blocked="" className="text-foreground text-xs leading-snug">
          {blockReason(state, summary.lint.error)}
        </p>
      )}
    </PanelSection>
  );
}
