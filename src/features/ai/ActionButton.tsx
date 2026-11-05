"use client";

import { type ReactNode, useId } from "react";
import { type ActionLines, type AiAction, WAIT_LINE } from "@/features/ai/useAiAction";
import { BUTTON } from "@/features/studio/chrome";

// The controls every AI action shares (docs/specs/04-ai.md, section 13 and R4-56): its button, which
// keeps its place, shows its busy label with `aria-busy="true"` and is followed by "Cancel" while
// the action runs; a button that cannot run is `aria-disabled`, stays focusable and is described by
// its reason, or by "Wait for the current action to finish." while another action runs; a button
// with a standing description ("Read the vibe" says where the image goes, 13.3) is described by it
// whenever it can run; and the section's one status region, the failure sentences first, then the
// result line.

export function ActionButton({
  action,
  label,
  busyLabel,
  reason,
  description,
  onRun,
}: {
  action: AiAction;
  label: string;
  busyLabel: string;
  /** Why the action cannot run now, or null when it can. */
  reason: string | null;
  /** A sentence shown beside the button that describes it whenever no reason does. */
  description?: string;
  onRun(): void;
}) {
  const reasonId = useId();
  const descriptionId = useId();
  const shown = action.busy ? null : action.blocked ? WAIT_LINE : reason;
  const describedBy =
    shown !== null ? reasonId : description === undefined ? undefined : descriptionId;
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          ref={action.buttonRef}
          aria-disabled={shown === null ? undefined : "true"}
          aria-busy={action.busy ? "true" : undefined}
          aria-describedby={describedBy}
          onClick={() => {
            if (shown === null && !action.busy) onRun();
          }}
          className={`${BUTTON} w-fit`}
        >
          {action.busy ? busyLabel : label}
        </button>
        {action.busy && (
          <button
            type="button"
            ref={action.cancelRef}
            onClick={action.cancel}
            className={`${BUTTON} w-fit`}
          >
            Cancel
          </button>
        )}
      </div>
      {shown !== null && (
        <p id={reasonId} className="text-fg-muted text-xs">
          {shown}
        </p>
      )}
      {description !== undefined && (
        <p id={descriptionId} className="text-fg-muted text-xs leading-snug">
          {description}
        </p>
      )}
    </div>
  );
}

/**
 * A section's status region (13): the failure sentences in router order, then the result line, then
 * `children`, the section's own lines (the Findings section's fix outcome, 13.5).
 */
export function ActionStatus({ lines, children }: { lines: ActionLines; children?: ReactNode }) {
  return (
    <div role="status" data-ai-lines="" className="space-y-1 text-foreground text-xs leading-snug">
      {lines.failures.map((line) => (
        <p key={line}>{line}</p>
      ))}
      {lines.result !== null && <p>{lines.result}</p>}
      {children}
    </div>
  );
}
