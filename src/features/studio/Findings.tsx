import { type FocusEvent, useId, useLayoutEffect, useRef } from "react";
import type { DirectionParams, Finding } from "@/engine";
import { TOGGLE_BUTTON, TOOL_BUTTON } from "./chrome";
import { fixFor, fixTarget } from "./fixes";
import { findingKey, findingMeasure, findingTitle, groupFindings } from "./inspect";
import { PanelSection } from "./PanelSection";

// The Findings section of the inspector (spec section 7.8): the counts per severity, then the groups
// "Errors", "Warnings" and "Info" in the linter's order. Each finding shows its id, title, subject,
// mode, measure and source, a "Show me" toggle and, where `fixFor` gives a patch, a fix button that
// names the level. Severity reads from text, never from color alone.
//
// The section has one status region, always mounted and empty until used, that names a fix's outcome,
// and one focus rescue: when the control that held focus leaves because the list changed (a fix that
// clears its finding, a fix button gone at its level, a "Show me" whose finding left), focus moves to
// the section's heading, never to the page body (F-STUDIO-23, fix round 1).

/** The note on an F1 card: the ring paints only on focus, so "show me" outlines what it sits on. */
const F1_NOTE = "The ring shows on focus. Show me outlines the surfaces it sits on.";

const GROUPS = [
  ["error", "Errors"],
  ["warn", "Warnings"],
  ["info", "Info"],
] as const;

const count = (n: number, word: string, plural = `${word}s`) => `${n} ${n === 1 ? word : plural}`;

export type FindingsProps = {
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
};

export function Findings({
  findings,
  params,
  selected,
  kept,
  outcome,
  onShowMe,
  onFix,
}: FindingsProps) {
  const groups = groupFindings(findings);
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
      <div className="space-y-1">
        {findings.length === 0 ? (
          <p className="text-fg-muted text-xs">No findings.</p>
        ) : (
          <p data-finding-counts="" className="font-mono text-[11px] text-foreground tabular-nums">
            {count(groups.error.length, "error")} · {count(groups.warn.length, "warning")} ·{" "}
            {groups.info.length} info
          </p>
        )}
        <p role="status" data-findings-status="" className="text-foreground text-xs leading-snug">
          {outcome}
        </p>
      </div>
      {findings.length > 0 && (
        // biome-ignore lint/a11y/noStaticElementInteractions: the handlers only track focus for the rescue above; nothing here acts on input.
        <div className="space-y-3" onFocus={onFocus} onBlur={onBlur}>
          {GROUPS.map(([severity, label]) =>
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
        </div>
      )}
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
        {patch !== null && level !== undefined && (
          <button
            type="button"
            aria-describedby={noteId}
            onClick={() => onFix(finding)}
            className={TOOL_BUTTON}
          >
            Raise contrast to {level}
          </button>
        )}
      </div>
      {patch !== null && level !== undefined && (
        <p id={noteId} className="text-[11px] text-fg-muted">
          Regenerates every color at {level}.
        </p>
      )}
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
