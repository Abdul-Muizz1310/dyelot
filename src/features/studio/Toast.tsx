"use client";

import { type RefObject, useEffect, useEffectEvent, useRef } from "react";
import { BUTTON } from "./chrome";
import { bannerFor } from "./url";

// The copy-link answer (spec F-STUDIO-15, F-STUDIO-16, F-STUDIO-23): "Link copied", or, when the
// clipboard refuses, the link in a read-only field that is already selected. The live region stays
// in the page, empty, so screen readers announce what appears in it. A toast that took focus gives
// it back when it closes, so focus never falls to the page body.

export type ToastState =
  | { readonly kind: "copied"; readonly at: number }
  | {
      readonly kind: "blocked";
      readonly link: string;
      readonly at: number;
      /** The element that had focus when the toast opened. */
      readonly returnTo: HTMLElement | null;
      /** False while a drawer is open: focus stays in the drawer and the region announces it. */
      readonly takeFocus: boolean;
    };

/** How long "Link copied" stays. */
const COPIED_MS = 3000;

/** Whether focus can go back to `element`: still in the page, not the body, not inert. */
function canHoldFocus(element: HTMLElement | null): element is HTMLElement {
  return (
    element?.isConnected === true &&
    element !== document.body &&
    element.closest("[inert]") === null
  );
}

type ToastProps = {
  state: ToastState | null;
  onClose(): void;
  /** Where focus goes when the element that had it is gone or was the body: "Copy link". */
  fallbackFocus: RefObject<HTMLElement | null>;
};

export function Toast({ state, onClose, fallbackFocus }: ToastProps) {
  const field = useRef<HTMLInputElement>(null);
  const close = useEffectEvent(onClose);

  // Runs once per copy: a new state object, never a re-render, moves focus or starts the timer.
  useEffect(() => {
    if (state?.kind === "blocked") {
      if (!state.takeFocus) return;
      field.current?.focus();
      field.current?.select();
      return;
    }
    if (state?.kind !== "copied") return;
    const timer = setTimeout(() => close(), COPIED_MS);
    return () => clearTimeout(timer);
  }, [state]);

  function closeBlocked(returnTo: HTMLElement | null): void {
    const target = canHoldFocus(returnTo) ? returnTo : fallbackFocus.current;
    target?.focus();
    onClose();
  }

  return (
    <div
      data-toast=""
      role="status"
      data-empty={state === null ? "" : undefined}
      className="studio-toast fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-md border border-border-bright bg-panel px-4 py-3 text-sm shadow-[var(--window-shadow)]"
    >
      {state?.kind === "copied" && <p>Link copied</p>}
      {state?.kind === "blocked" && (
        <div className="space-y-2">
          <p>{bannerFor({ kind: "copy-blocked" }).message}</p>
          <div className="flex gap-2">
            <input
              ref={field}
              readOnly
              aria-label="Share link"
              value={state.link}
              onFocus={(event) => event.currentTarget.select()}
              className="min-h-8 min-w-0 flex-1 rounded-md border border-border-bright bg-page px-2 font-mono text-xs tabular-nums"
            />
            <button type="button" onClick={() => closeBlocked(state.returnTo)} className={BUTTON}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
