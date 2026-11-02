"use client";

import "./dialog.css";
import { useId, useLayoutEffect, useRef } from "react";
import { Button } from "./Button";
import { containKeys } from "./contain";

// The kit's confirm dialog (spec section 7.7, F-TPL-30): a contained `alertdialog` drawn over its
// template, never `showModal()` or the top layer, which escape the frame's scale and paint over the
// studio chrome. The template that opens it makes the rest of itself `inert`; the dialog takes focus
// to "Cancel", keeps Tab and Shift+Tab inside, and closes on Escape or "Cancel". It stops the Escape
// press, so no studio shortcut or drawer sees it. The caller gives focus back to its opener. Under the
// pointer focus stays inside too: the dialog itself takes focus (`tabIndex={-1}`) when its text is
// clicked, and a press on the scrim leaves focus where it was. Its keys are the kit's contained
// overlay keys (contain.ts), which the mobile template's bottom sheet shares.

export function ConfirmDialog({
  title,
  body,
  cancel,
  confirm,
  onClose,
}: {
  title: string;
  body: string;
  cancel: string;
  confirm: string;
  /** Closes the dialog: "Cancel", Escape and the destructive action all call it (R2-20). */
  onClose: () => void;
}) {
  const id = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    first.current?.focus();
  }, []);

  return (
    // The scrim is not a control: a press on it only keeps focus inside the dialog.
    // biome-ignore lint/a11y/noStaticElementInteractions: the handler keeps focus put; it is no action.
    <div
      className="kit-confirm-layer"
      data-roles="foreground background"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) event.preventDefault();
      }}
    >
      <div
        ref={dialog}
        role="alertdialog"
        aria-modal="true"
        tabIndex={-1}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-body`}
        className="kit-confirm"
        data-roles="popover popover-foreground border font-body"
        onKeyDown={(event) => containKeys(event, dialog.current, onClose)}
      >
        <h2
          id={`${id}-title`}
          className="kit-confirm-title kit-t-h4 kit-display"
          data-roles="popover-foreground font-display"
        >
          {title}
        </h2>
        <p id={`${id}-body`} className="kit-t-body-sm">
          {body}
        </p>
        <div className="kit-actions">
          <Button variant="secondary" ref={first} onPress={onClose}>
            {cancel}
          </Button>
          <Button variant="destructive" onPress={onClose}>
            {confirm}
          </Button>
        </div>
      </div>
    </div>
  );
}
