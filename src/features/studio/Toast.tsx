"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import { bannerFor } from "./url";

// The copy-link answer (spec F-STUDIO-15, F-STUDIO-16): "Link copied", or, when the clipboard
// refuses, the link in a read-only field that is already selected. The live region stays in the
// page, empty, so screen readers announce what appears in it.

export type ToastState =
  | { readonly kind: "copied"; readonly at: number }
  | { readonly kind: "blocked"; readonly link: string; readonly at: number };

/** How long "Link copied" stays. */
const COPIED_MS = 3000;

export function Toast({ state, onClose }: { state: ToastState | null; onClose(): void }) {
  const field = useRef<HTMLInputElement>(null);
  const close = useEffectEvent(onClose);

  // Runs once per copy: a new state object, never a re-render, moves focus or starts the timer.
  useEffect(() => {
    if (state?.kind === "blocked") {
      field.current?.focus();
      field.current?.select();
      return;
    }
    if (state?.kind !== "copied") return;
    const timer = setTimeout(() => close(), COPIED_MS);
    return () => clearTimeout(timer);
  }, [state]);

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
              className="min-h-8 min-w-0 flex-1 rounded-md border border-fg-muted bg-page px-2 font-mono text-xs tabular-nums"
            />
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-8 items-center rounded-md border border-border-bright px-3 text-foreground hover:border-fg-muted"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
