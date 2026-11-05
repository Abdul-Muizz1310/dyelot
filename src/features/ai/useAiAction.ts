import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import type { ActionName, AiActivity } from "@/features/ai/activity";
import { type AiModule, loadAi } from "@/features/ai/load";

// One AI action of the studio (docs/specs/04-ai.md, R4-56 and section 13): it loads the AI core
// through `loadAi` (R4-04), runs the action's work under an AbortController, and keeps the lines its
// section's status region shows, the failure sentences first and then the result. While it runs
// the activity holds it, so the other four actions wait; "Cancel" aborts it at once and the design
// is left as it was; a core that will not load says so, and the next click tries again. The work
// builds and applies its change itself, on the store's state when the reply lands (R4-37).

/** Section 13's lines, word for word. */
export const WAIT_LINE = "Wait for the current action to finish.";
export const CANCELED_LINE = "Canceled. Nothing changed.";
export const LOAD_FAILED_LINE = "This tool could not load. Reload the page to try again.";

/** What a section's status region shows: the failure sentences, then the result line. */
export type ActionLines = { readonly failures: readonly string[]; readonly result: string | null };
/** An action's work: it runs the providers, applies its change and says what happened. */
export type ActionWork = (
  ai: AiModule,
  signal: AbortSignal,
) => Promise<{ readonly failures: readonly string[]; readonly result: string }>;

export type AiAction = {
  /** This action runs. */
  readonly busy: boolean;
  /** Another action runs: this one waits, described by `WAIT_LINE`. */
  readonly blocked: boolean;
  readonly lines: ActionLines;
  /** Starts the action, unless one runs. */
  run(work: ActionWork): void;
  /** Aborts the running action; its section shows `CANCELED_LINE` and nothing changes. */
  cancel(): void;
  /** The action's button, which takes focus back when "Cancel" goes away under it. */
  readonly buttonRef: RefObject<HTMLButtonElement | null>;
  readonly cancelRef: RefObject<HTMLButtonElement | null>;
};

const NO_LINES: ActionLines = Object.freeze({ failures: Object.freeze([]), result: null });
const lineOf = (result: string): ActionLines => Object.freeze({ failures: [], result });

export function useAiAction(activity: AiActivity, name: ActionName): AiAction {
  const running = useStore(activity, (state) => state.running);
  const [lines, setLines] = useState<ActionLines>(NO_LINES);
  const controller = useRef<AbortController | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const refocus = useRef(false);
  const busy = running === name;
  const blocked = running !== null && !busy;

  /**
   * Ends the run `own` with `next`, unless a cancel already ended it. Focus on "Cancel", which goes
   * away now, moves back to the action's button (13).
   */
  const finish = useCallback(
    (own: AbortController, next: ActionLines) => {
      if (controller.current !== own) return;
      controller.current = null;
      refocus.current = cancelRef.current !== null && document.activeElement === cancelRef.current;
      activity.getState().end(name);
      setLines(next);
    },
    [activity, name],
  );

  useEffect(() => {
    if (busy || !refocus.current) return;
    refocus.current = false;
    buttonRef.current?.focus();
  }, [busy]);

  // Leaving the studio cancels a running action, so the server starts no further tier (R4-16).
  useEffect(
    () => () => {
      const own = controller.current;
      if (own === null) return;
      controller.current = null;
      own.abort();
      activity.getState().end(name);
    },
    [activity, name],
  );

  const run = useCallback(
    (work: ActionWork) => {
      const own = new AbortController();
      if (!activity.getState().begin(name, own)) return;
      controller.current = own;
      setLines(NO_LINES);
      void (async () => {
        let ai: AiModule;
        try {
          ai = await loadAi();
        } catch {
          finish(own, lineOf(LOAD_FAILED_LINE));
          return;
        }
        if (own.signal.aborted) return;
        try {
          const done = await work(ai, own.signal);
          finish(
            own,
            own.signal.aborted
              ? lineOf(CANCELED_LINE)
              : Object.freeze({ failures: [...done.failures], result: done.result }),
          );
        } catch (error) {
          if (own.signal.aborted) {
            finish(own, lineOf(CANCELED_LINE));
            return;
          }
          // A defect, not a provider's failure (those are sentences): the section never shows a raw
          // error (I-M2-03), and the error still reaches the page's error reporting.
          finish(own, lineOf(LOAD_FAILED_LINE));
          reportError(error);
        }
      })();
    },
    [activity, name, finish],
  );

  const cancel = useCallback(() => {
    const own = controller.current;
    if (own === null) return;
    own.abort();
    finish(own, lineOf(CANCELED_LINE));
  }, [finish]);

  return { busy, blocked, lines, run, cancel, buttonRef, cancelRef };
}
