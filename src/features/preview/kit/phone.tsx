"use client";

import "./phone.css";
import { BatteryMedium, Signal, Wifi } from "lucide-react";
import { type ReactNode, useId } from "react";

// The kit's phone screen (spec section 7.7, F-TPL-32, F-TPL-33): a 360 px screen of the mobile
// template, a size container named `frame`, so the kit's `@container frame` rules and `cqi` answer
// its 360 px whatever the canvas frame holds. It is a touch surface (`data-touch`), where the kit's
// controls reach 44 px. A region named by its caption on the board, it opens with a status bar that
// the accessibility tree skips. `overlay` (a bottom sheet) sits over the screen; while it shows, the
// caller sets `inert`, and the rest of the screen takes no focus or click. `dimmed` draws a scrim over the
// whole screen, for a screen that a sheet on another screen makes inert.

export function PhoneScreen({
  name,
  number,
  caption,
  time,
  inert = false,
  dimmed = false,
  overlay,
  children,
}: {
  /** The screen's `data-phone`. */
  name: string;
  /** Its place on the board, "01" to "03". */
  number: string;
  caption: string;
  /** The status bar's clock, "09:30". */
  time: string;
  inert?: boolean;
  /** Draws the scrim over the screen: a sheet on another screen holds the template. */
  dimmed?: boolean;
  overlay?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="kit-phone-slot">
      <section
        aria-labelledby={id}
        className="kit-phone"
        data-phone={name}
        data-touch=""
        data-roles="background foreground border"
      >
        <div className="kit-phone-body" inert={inert}>
          <div aria-hidden="true" className="kit-status" data-roles="foreground">
            <span className="kit-num kit-mono kit-t-label">{time}</span>
            <span className="kit-status-icons">
              <Signal />
              <Wifi />
              <BatteryMedium />
            </span>
          </div>
          {children}
          {/* Inside the body, so it is inert with it; it covers the screen, positioned against the
              section. */}
          <span
            aria-hidden="true"
            className="kit-phone-dim"
            data-dimmed={dimmed ? "" : undefined}
            data-roles="foreground background"
          />
        </div>
        {overlay}
      </section>
      <p
        id={id}
        className="kit-phone-caption kit-t-caption"
        data-roles="muted-foreground font-body"
      >
        <span className="kit-mono">{number}</span> {caption}
      </p>
    </div>
  );
}
