"use client";

import "./surfaces.css";
import "./sheet.css";
import { useReducedMotionConfig } from "motion/react";
import { type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { containKeys, tabStops } from "./contain";

// The kit's bottom sheet (spec section 7.7, F-TPL-34): a contained `dialog` at the bottom of the
// screen that holds it, over a scrim, never `showModal()` or the top layer. The caller makes the rest
// of its screen `inert` while the sheet is open and gives focus back to the opener. The sheet takes
// focus to its first stop, keeps Tab and Shift+Tab inside, and closes on Escape, which it stops. Under
// the pointer focus stays inside: the sheet itself takes focus when its text is clicked, and a press
// on the scrim leaves focus where it was. It rises once, on the spec's base duration and decelerate
// easing; once risen, or once reduced motion has held at any moment while it is open (a toggle during
// the rise cancels the rise), it is settled, so a later motion toggle never raises it again.

export function BottomSheet({
  title,
  body,
  onClose,
  children,
}: {
  /**
   * The sheet's name, its `h2`: while the sheet is open the rest of its template is inert, so its
   * heading follows the page's `h1`, as the confirm dialog's does.
   */
  title: string;
  /** The sentence that describes it. */
  body: string;
  /** Escape calls it, as the caller's own buttons do (R2-20). */
  onClose: () => void;
  /** The sheet's controls, after its sentence. */
  children: ReactNode;
}) {
  const id = useId();
  const sheet = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotionConfig() === true;
  const [settled, setSettled] = useState(reduced);
  useLayoutEffect(() => {
    const element = sheet.current;
    if (element !== null) (tabStops(element)[0] ?? element).focus();
  }, []);
  // Reduced motion at any moment while the sheet is open settles it. A toggle during the rise cancels
  // the rise, and no `animationend` follows; nor does an `animationcancel` when the rise is still
  // pending, so the setting itself, not an event, decides.
  useEffect(() => {
    if (reduced) setSettled(true);
  }, [reduced]);
  return (
    // The scrim is not a control: a press on it only keeps focus inside the sheet.
    // biome-ignore lint/a11y/noStaticElementInteractions: the handler keeps focus put; it is no action.
    <div
      className="kit-sheet-layer"
      data-roles="foreground background"
      data-settled={settled ? "" : undefined}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) event.preventDefault();
      }}
      onAnimationEnd={(event) => {
        if (event.target === sheet.current) setSettled(true);
      }}
    >
      <div
        ref={sheet}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-body`}
        className="kit-bottom-sheet"
        data-roles="popover popover-foreground border"
        onKeyDown={(event) => containKeys(event, sheet.current, onClose)}
      >
        <span className="kit-sheet-grabber" aria-hidden="true" />
        <h2
          id={`${id}-title`}
          className="kit-bottom-sheet-title kit-t-h4 kit-display"
          data-roles="popover-foreground font-display"
        >
          {title}
        </h2>
        <p id={`${id}-body`} className="kit-t-body-sm">
          {body}
        </p>
        {children}
      </div>
    </div>
  );
}
