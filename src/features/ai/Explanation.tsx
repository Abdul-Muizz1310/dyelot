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
  useAiAction,
} from "@/features/ai/useAiAction";
import { TOOL_BUTTON } from "@/features/studio/chrome";
import { fixFor } from "@/features/studio/fixes";
import { findingKey, findingTitle } from "@/features/studio/inspect";
import { type DesignSpec, specId } from "@/spec";

// The critique of the inspector's Findings section (docs/specs/04-ai.md, 13.5, R4-50, R4-55):
// "Explain the top findings" asks the router to rank up to three of the held design's findings and
// say why, and the explanation shows the verdict, then one item per ranked finding with its title,
// its subject, the model's reason and the finding's fix button. It is shown only while the spec it
// explained is held, and never stored. Without a model the list stays sorted by severity. What a
// model wrote is shown as React text only (R4-28): `parseOutput` has cleaned it and capped its
// length.

/** 13.5's line without a model. */
const LIST_STAYS = "The list below stays sorted by severity (no model).";
/** No lines: the status region shows none while the spec they spoke of is not held. */
const NO_LINES: ActionLines = Object.freeze({ failures: Object.freeze([]), result: null });

/** What a model's critique says about the findings it was given. */
export type Critique = {
  readonly verdict: string;
  /** The ranked findings, in the model's order, each with its reason. */
  readonly items: readonly { readonly finding: Finding; readonly why: string }[];
};
/** A critique and the id of the spec whose findings it explained. */
export type Explained = Critique & { readonly specId: string };

/**
 * Explains `findings`, the held design's `lintSpec` list (13.5): the router asks each provider in
 * turn; a model's critique goes to `show`, and the rules' answer clears it, so the list below stands
 * alone. A cancel shows nothing new. The design never changes.
 */
export async function explainFindings(
  ai: AiModule,
  deps: {
    findings: readonly Finding[];
    activity: AiActivity;
    signal: AbortSignal;
    show(critique: Critique | null): void;
  },
): Promise<{ failures: readonly string[]; result: string }> {
  const { findings, activity, signal, show } = deps;
  const input = ai.critiqueInput(findings);
  const routed = await runProviders(stepsFor(ai, "critique", input, browserDeps(activity)), signal);
  if (routed.kind === "canceled" || signal.aborted) return { failures: [], result: CANCELED_LINE };
  if (routed.kind === "rules") {
    const failures = failureLines(ai, routed.failures, "critique", "rules");
    show(null);
    return { failures, result: LIST_STAYS };
  }
  const { path, output } = routed;
  // The router answers a model's path only from a model's step (runProviders checks it).
  if (path.provider === "rules") {
    throw new RangeError("explainFindings: the rules answered as a model");
  }
  // Every line and item is built before anything shows, so a failure while building shows nothing.
  const failures = failureLines(ai, routed.failures, "critique", path.provider);
  const result = ai.madeWith(path, "critique");
  // `critiqueInput` keeps lintSpec's order, so an index of the input is an index of `findings`.
  const items = output.top.map(({ findingIndex, why }) => {
    const finding = findings[findingIndex];
    if (finding === undefined) {
      throw new RangeError(`explainFindings: findingIndex ${findingIndex} names no finding`);
    }
    return { finding, why };
  });
  show({ verdict: output.verdict, items });
  return { failures, result };
}

/**
 * The critique action of the Findings section: the action; its lines and its explanation, each
 * while the spec they speak of is held (else none); and `run`, which explains the held findings.
 * An explanation whose spec is no longer held is dropped (13.5: it hides when the held spec id
 * changes), and the lines go with it, as the section's status region speaks only of the held spec
 * (a fix's outcome there names the spec it came with, R2-10).
 */
export function useCritique(
  activity: AiActivity,
  spec: DesignSpec,
  findings: readonly Finding[],
): { action: AiAction; lines: ActionLines; explained: Explained | null; run(): void } {
  const action = useAiAction(activity, "critique");
  const held = useMemo(() => specId(spec), [spec]);
  /** The id of the spec the last run started on. */
  const [ranOn, setRanOn] = useState<string | null>(null);
  const [explained, setExplained] = useState<Explained | null>(null);
  const stale = explained !== null && explained.specId !== held;
  useEffect(() => {
    if (stale) setExplained(null);
  }, [stale]);
  const run = () => {
    // The findings and the id of the spec they came from, as they are at the click.
    const id = held;
    setRanOn(id);
    action.run((ai, signal) =>
      explainFindings(ai, {
        findings,
        activity,
        signal,
        show: (critique) => setExplained(critique === null ? null : { ...critique, specId: id }),
      }),
    );
  };
  return {
    action,
    lines: ranOn === held ? action.lines : NO_LINES,
    explained: stale ? null : explained,
    run,
  };
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
          <button
            type="button"
            aria-describedby={noteId}
            onClick={() => onFix(finding)}
            className={TOOL_BUTTON}
          >
            Raise contrast to {level}
          </button>
          <p id={noteId} className="text-[11px] text-fg-muted">
            Regenerates every color at {level}.
          </p>
        </div>
      )}
    </li>
  );
}
