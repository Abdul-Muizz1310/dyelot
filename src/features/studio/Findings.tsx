import { type FocusEvent, useId, useLayoutEffect, useRef } from "react";
import type { DirectionParams, Finding } from "@/engine";
import { ActionButton, ActionStatus } from "@/features/ai/ActionButton";
import type { AiActivity } from "@/features/ai/activity";
import { Explanation, useCritique } from "@/features/ai/Explanation";
import { TOGGLE_BUTTON, TOOL_BUTTON } from "./chrome";
import { FixButton, FixNote } from "./FixButton";
import { fixFor, fixTarget } from "./fixes";
import { findingKey, findingMeasure, findingTitle, groupFindings } from "./inspect";
import { PanelSection } from "./PanelSection";
import type { StudioStore } from "./store";

// The Findings section of the inspector (spec section 7.8): the counts per severity, then the groups
// "Errors", "Warnings" and "Info" in the linter's order. Each finding shows its id, title, subject,
// mode, measure and source, a "Show me" toggle and, where `fixFor` gives a patch, a fix button that
// names the level. Severity reads from text, never from color alone.
//
// The section has one status region, always mounted and empty until used, that names a fix's outcome,
// and one focus rescue: when the control that held focus leaves because the list changed (a fix that
// clears its finding, a fix button gone at its level, a "Show me" whose finding left), focus moves to
// the section's heading, never to the page body (F-STUDIO-23, fix round 1).
//
// After the heading, "Explain the top findings" asks a model to rank the findings (docs/specs/04-ai.md,
// 13.5, R4-50): its failure sentences and result line come first in the status region, then a fix's
// outcome; its explanation sits before the counts, and its fix buttons are in the focus rescue's care
// like the cards' (13.7). A new held spec clears the explanation and its result line; the action's own
// lines (failures, cancel, load failure, a dropped reply) stay until it runs again.

/** The note on an F1 card: the ring paints only on focus, so "show me" outlines what it sits on. */
const F1_NOTE = "The ring shows on focus. Show me outlines the surfaces it sits on.";

const GROUPS = [
  ["error", "Errors"],
  ["warn", "Warnings"],
  ["info", "Info"],
] as const;

const count = (n: number, word: string, plural = `${word}s`) => `${n} ${n === 1 ? word : plural}`;

/** Why "Explain the top findings" cannot run (13.5). */
const NOTHING_TO_EXPLAIN = "There are no findings to explain.";

export type FindingsProps = {
  /** The studio's store: the critique reads the held spec's id from it. */
  store: StudioStore;
  /** The studio's one AI activity (R4-56), which the critique runs in. */
  activity: AiActivity;
  findings: readonly Finding[];
  params: DirectionParams;
  /** The key of the finding whose "Show me" is pressed. */
  selected: string | null;
  /** The key of the finding a fix did not clear, while the spec it gave holds. */
  kept: string | null;
  /** The last fix's outcome, while the spec it came with holds; empty otherwise. */
  outcome: string;
  onShowMe(finding: Finding): void;
  /** Applies `fixFor`'s patch through the store, which regenerates the design (R2-10). */
  onFix(finding: Finding): void;
  /**
   * Set only in the fixable state (R3-42): a loaded design that fails a required check and rebuilds
   * clean from its parameters. The section then offers "Rebuild from the parameters".
   */
  onRebuild?: () => void;
};

export function Findings({
  store,
  activity,
  findings,
  params,
  selected,
  kept,
  outcome,
  onShowMe,
  onFix,
  onRebuild,
}: FindingsProps) {
  const groups = groupFindings(findings);
  const critique = useCritique(activity, store, findings);
  const heading = useRef<HTMLHeadingElement>(null);
  // The control inside the list that last took focus, until focus moves out of the section.
  const focused = useRef<Element | null>(null);
  const onFocus = (event: FocusEvent<HTMLElement>) => {
    focused.current = event.target;
  };
  const onBlur = (event: FocusEvent<HTMLElement>) => {
    const next = event.relatedTarget;
    if (next instanceof Node) {
      if (!event.currentTarget.contains(next)) focused.current = null;
      return;
    }
    // Focus went to no element: a click on chrome that takes no focus, or the control's removal, which
    // Chromium reports the same way while the control is still connected. A removed control is gone by
    // the next microtask, and the layout effect below has rescued it in the same commit; a control still
    // in the document was left by the user, so it holds no claim (fix round 2, M-1).
    const left = event.target;
    queueMicrotask(() => {
      if (focused.current === left && left.isConnected) focused.current = null;
    });
  };
  // After every commit: a focused control that the list removed leaves focus on the body; the heading
  // takes it, before paint.
  useLayoutEffect(() => {
    const last = focused.current;
    if (last === null || last.isConnected) return;
    focused.current = null;
    const active = document.activeElement;
    if (active === null || active === document.body) heading.current?.focus();
  });
  return (
    <PanelSection title="Findings" headingRef={heading}>
      <div className="space-y-1.5">
        <ActionButton
          action={critique.action}
          label="Explain the top findings"
          busyLabel="Ranking the findings…"
          reason={findings.length === 0 ? NOTHING_TO_EXPLAIN : null}
          onRun={critique.run}
        />
        <ActionStatus lines={critique.lines}>{outcome !== "" && <p>{outcome}</p>}</ActionStatus>
      </div>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: the handlers only track focus for the rescue above; nothing here acts on input. */}
      <div className="space-y-3" onFocus={onFocus} onBlur={onBlur}>
        {critique.explained !== null && (
          <Explanation explained={critique.explained} params={params} onFix={onFix} />
        )}
        {findings.length === 0 ? (
          <p className="text-fg-muted text-xs">No findings.</p>
        ) : (
          <p data-finding-counts="" className="font-mono text-[11px] text-foreground tabular-nums">
            {count(groups.error.length, "error")} · {count(groups.warn.length, "warning")} ·{" "}
            {groups.info.length} info
          </p>
        )}
        {findings.length > 0 &&
          GROUPS.map(([severity, label]) =>
            groups[severity].length === 0 ? null : (
              <div key={severity} data-group={severity} className="space-y-2">
                <h4 className="flex items-baseline gap-1.5 font-mono text-[11px] text-fg-muted uppercase tracking-[0.1em]">
                  {label}{" "}
                  <span className="text-foreground tabular-nums">{groups[severity].length}</span>
                </h4>
                <ol className="space-y-2">
                  {groups[severity].map((finding) => {
                    const key = findingKey(finding);
                    return (
                      <FindingItem
                        key={key}
                        id={key}
                        finding={finding}
                        params={params}
                        pressed={selected === key}
                        kept={kept === key}
                        onShowMe={onShowMe}
                        onFix={onFix}
                      />
                    );
                  })}
                </ol>
              </div>
            ),
          )}
        {onRebuild !== undefined && (
          <div className="space-y-1.5">
            <button type="button" onClick={onRebuild} className={TOOL_BUTTON}>
              Rebuild from the parameters
            </button>
            <p className="text-[11px] text-fg-muted leading-snug">
              Generates the design again from its parameters and seed. Undo brings this one back.
            </p>
          </div>
        )}
      </div>
    </PanelSection>
  );
}

function FindingItem({
  id,
  finding,
  params,
  pressed,
  kept,
  onShowMe,
  onFix,
}: {
  id: string;
  finding: Finding;
  params: DirectionParams;
  pressed: boolean;
  kept: boolean;
  onShowMe(finding: Finding): void;
  onFix(finding: Finding): void;
}) {
  const titleId = useId();
  const subjectId = useId();
  const modeId = useId();
  const noteId = useId();
  const patch = fixFor(finding, params);
  const level = patch?.contrastLevel;
  // A rule with a fix whose target the design already meets (R2-10).
  const spent = patch === null && fixTarget(finding.id) !== null;
  return (
    <li
      data-finding={id}
      className="space-y-1.5 rounded-md border border-border bg-page px-3 py-2.5"
    >
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[11px] text-fg-muted">{finding.id}</span>
        <p id={titleId} className="min-w-0 flex-1 text-[13px] text-foreground leading-snug">
          {findingTitle(finding.id)}
        </p>
        <span id={modeId} className="font-mono text-[11px] text-fg-muted">
          {finding.mode}
        </span>
      </div>
      <p
        id={subjectId}
        translate="no"
        className="break-words font-mono text-[11px] text-foreground"
      >
        {finding.subject}
      </p>
      <p className="font-mono text-[11px] text-fg-muted tabular-nums">{findingMeasure(finding)}</p>
      <p className="text-[11px] text-fg-muted leading-snug">{finding.source}</p>
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <button
          type="button"
          aria-pressed={pressed}
          aria-describedby={`${titleId} ${subjectId} ${modeId}`}
          onClick={() => onShowMe(finding)}
          className={TOGGLE_BUTTON}
        >
          Show me
        </button>
        {level !== undefined && (
          <FixButton level={level} noteId={noteId} onClick={() => onFix(finding)} />
        )}
      </div>
      {level !== undefined && <FixNote id={noteId} level={level} />}
      {spent && (
        <p className="text-[11px] text-fg-muted">Contrast is already {params.contrastLevel}.</p>
      )}
      {finding.id === "F1" && <p className="text-[11px] text-fg-muted">{F1_NOTE}</p>}
      {kept && (
        <p className="text-[11px] text-foreground">
          Raising the contrast did not clear this finding.
        </p>
      )}
    </li>
  );
}
