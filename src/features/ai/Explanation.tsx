"use client";

import { useEffect, useId, useMemo, useState } from "react";
import type { DirectionParams, Finding } from "@/engine";
import type { AiActivity } from "@/features/ai/activity";
import type { AiModule } from "@/features/ai/load";
import { runProviders } from "@/features/ai/router";
import { browserDeps, failureLines, stepsFor } from "@/features/ai/steps";
import {
  type ActionLines,
  type AiAction,
  CANCELED_LINE,
  LOAD_FAILED_LINE,
  useAiAction,
} from "@/features/ai/useAiAction";
import { FixButton, FixNote } from "@/features/studio/FixButton";
import { fixFor } from "@/features/studio/fixes";
import { findingKey, findingTitle } from "@/features/studio/inspect";
import { type StudioStore, useStudio } from "@/features/studio/store";
import { specId } from "@/spec";

// The critique of the inspector's Findings section (docs/specs/04-ai.md, 13.5, R4-50, R4-55):
// "Explain the top findings" asks the router to rank up to three of the held design's findings and
// say why, and the explanation shows the verdict, then one item per ranked finding with its title,
// its subject, the model's reason and the finding's fix button. It explains one spec and is never
// stored: a reply that lands after the held spec changed is dropped, and a new held spec clears the
// explanation and its result line for good, so an Undo back brings neither back. The failure
// sentences, the cancel line, the load-failure line and the dropped-reply line describe the action,
// not the design, so they stay until it runs again (controller rulings on Task 4.11's review). What a
// model wrote is shown as React text only (R4-28): `parseOutput` has cleaned it and capped its
// length.

/** 13.5's lines: without a model, and for a reply whose design is no longer held. */
const LIST_STAYS = "The list below stays sorted by severity (no model).";
const DESIGN_CHANGED =
  "The design changed while the findings were explained. Explain them again for this design.";
/** The result lines that describe the action, which no design change clears. */
const ACTION_RESULTS: ReadonlySet<string> = new Set([
  CANCELED_LINE,
  LOAD_FAILED_LINE,
  DESIGN_CHANGED,
]);

/** What a model's critique says about the findings it was given. */
export type Critique = {
  readonly verdict: string;
  /** The ranked findings, in the model's order, each with its reason. */
  readonly items: readonly { readonly finding: Finding; readonly why: string }[];
};
/**
 * What a run settled on about the design: the critique to show (none without a model) and the id of
 * the spec it and the result line speak of.
 */
export type Settled = { readonly critique: Critique | null; readonly on: string };

/**
 * Explains `findings`, the `lintSpec` list of the spec `explaining` (13.5). The router asks each
 * provider in turn. A model's critique settles on that spec, unless `heldNow()` names another when
 * the reply lands: then it is dropped, and the line says so. The rules settle on no critique, so the
 * list stands alone. A cancel settles nothing. The design never changes.
 */
export async function explainFindings(
  ai: AiModule,
  deps: {
    findings: readonly Finding[];
    /** The id of the spec the findings came from. */
    explaining: string;
    /** The id of the spec held now, read when the reply lands. */
    heldNow(): string;
    activity: AiActivity;
    signal: AbortSignal;
    settle(settled: Settled): void;
  },
): Promise<{ failures: readonly string[]; result: string }> {
  const { findings, explaining, heldNow, activity, signal, settle } = deps;
  const input = ai.critiqueInput(findings);
  const routed = await runProviders(stepsFor(ai, "critique", input, browserDeps(activity)), signal);
  if (routed.kind === "canceled" || signal.aborted) return { failures: [], result: CANCELED_LINE };
  if (routed.kind === "rules") {
    const failures = failureLines(ai, routed.failures, "critique", "rules");
    settle({ critique: null, on: heldNow() });
    return { failures, result: LIST_STAYS };
  }
  const { path, output } = routed;
  // The router answers a model's path only from a model's step (runProviders checks it).
  if (path.provider === "rules") {
    throw new RangeError("explainFindings: the rules answered as a model");
  }
  // Every line and item is built before anything shows, so a failure while building shows nothing.
  const failures = failureLines(ai, routed.failures, "critique", path.provider);
  if (heldNow() !== explaining) return { failures, result: DESIGN_CHANGED };
  const result = ai.madeWith(path, "critique");
  // `critiqueInput` keeps lintSpec's order, so an index of the input is an index of `findings`.
  const items = output.top.map(({ findingIndex, why }) => {
    const finding = findings[findingIndex];
    if (finding === undefined) {
      throw new RangeError(`explainFindings: findingIndex ${findingIndex} names no finding`);
    }
    return { finding, why };
  });
  settle({ critique: { verdict: output.verdict, items }, on: explaining });
  return { failures, result };
}

/**
 * The critique action of the Findings section: the action; the lines its status region shows; the
 * explanation, or null; and `run`, which explains the held findings. What a run settled on is
 * cleared, not hidden, once the held spec id differs from the one it speaks of, and with it the
 * result line that came with it (`Made with <label>.` or the no-model line); the failure sentences
 * and the action's own result lines stay (13.5).
 */
export function useCritique(
  activity: AiActivity,
  store: StudioStore,
  findings: readonly Finding[],
): { action: AiAction; lines: ActionLines; explained: Critique | null; run(): void } {
  const action = useAiAction(activity, "critique");
  const spec = useStudio(store, (studio) => studio.spec);
  const held = useMemo(() => specId(spec), [spec]);
  const [settled, setSettled] = useState<Settled | null>(null);
  const cleared = settled !== null && settled.on !== held;
  useEffect(() => {
    if (cleared) setSettled(null);
  }, [cleared]);
  const run = () => {
    // The findings and the id of the spec they came from, as they are at the click.
    const explaining = held;
    action.run((ai, signal) =>
      explainFindings(ai, {
        findings,
        explaining,
        heldNow: () => specId(store.getState().spec),
        activity,
        signal,
        settle: setSettled,
      }),
    );
  };
  const standing = cleared ? null : settled;
  const { lines } = action;
  const kept =
    lines.result === null || ACTION_RESULTS.has(lines.result) || standing !== null
      ? lines
      : { failures: lines.failures, result: null };
  return { action, lines: kept, explained: standing?.critique ?? null, run };
}

/**
 * The explanation (13.5): a region labeled "Explanation" with the verdict, then an ordered list, one
 * item per ranked finding: its title and subject, the model's reason, and the finding's fix button
 * when `fixFor` gives one, which applies the fix as the finding's own card does (R2-10).
 */
export function Explanation({
  explained,
  params,
  onFix,
}: {
  explained: Critique;
  params: DirectionParams;
  onFix(finding: Finding): void;
}) {
  return (
    <section aria-label="Explanation" className="space-y-2">
      <p className="text-foreground text-xs leading-snug text-pretty">{explained.verdict}</p>
      <ol className="space-y-2">
        {explained.items.map(({ finding, why }) => (
          <ExplainedItem
            key={findingKey(finding)}
            finding={finding}
            why={why}
            params={params}
            onFix={onFix}
          />
        ))}
      </ol>
    </section>
  );
}

function ExplainedItem({
  finding,
  why,
  params,
  onFix,
}: {
  finding: Finding;
  why: string;
  params: DirectionParams;
  onFix(finding: Finding): void;
}) {
  const noteId = useId();
  const level = fixFor(finding, params)?.contrastLevel;
  return (
    <li className="space-y-1.5 rounded-md border border-border bg-page px-3 py-2.5">
      <p className="text-[13px] text-foreground leading-snug">{findingTitle(finding.id)}</p>
      <p translate="no" className="break-words font-mono text-[11px] text-foreground">
        {finding.subject}
      </p>
      <p className="text-foreground text-xs leading-snug text-pretty">{why}</p>
      {level !== undefined && (
        <div className="space-y-1.5 pt-1">
          <FixButton level={level} noteId={noteId} onClick={() => onFix(finding)} />
          <FixNote id={noteId} level={level} />
        </div>
      )}
    </li>
  );
}
