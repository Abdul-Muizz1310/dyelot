"use client";

import "./surfaces.css";
import {
  CircleAlert,
  CircleCheck,
  Info,
  LoaderCircle,
  MapPin,
  WavesHorizontal,
  X,
} from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { SAMPLE_PLACES } from "../copy";
import { Button } from "./Button";
import { type KitState, withRing } from "./states";

// The kit's surfaces (section 7.5): the interactive card, alert, tooltip, dialog, sheet and toast.
// An alert is a tinted surface with an icon and a title, never a colored left edge (research D4).
// The dialog and the sheet sit on a stage behind a scrim, so the kitchen sink shows them open.

/**
 * An interactive card: the media sits at the card's radius minus its padding (F-TPL-08). A
 * specimen carries `data-kit` and its forced state; a card without a state is a demo.
 */
export function Card({ title, meta, state }: { title: string; meta: string; state?: KitState }) {
  const [pressed, setPressed] = useState(state === "selected");
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className="kit-card"
      data-kit={state === undefined ? undefined : "card"}
      data-state={state}
      data-concentric="card"
      data-roles={withRing("card card-foreground border", state)}
      disabled={state === "disabled"}
      onClick={() => setPressed((value) => !value)}
    >
      <span
        className="kit-card-media"
        data-concentric="media"
        data-roles="secondary secondary-foreground"
      >
        <WavesHorizontal aria-hidden="true" />
      </span>
      <span className="kit-card-body">
        <span className="kit-card-title kit-t-body" data-roles="card-foreground font-display">
          {title}
        </span>
        <span className="kit-card-meta kit-t-caption" data-roles="card-foreground font-body">
          {meta}
        </span>
      </span>
    </button>
  );
}

const ALERTS = {
  default: {
    tone: "info",
    title: "Spring tides this week",
    body: "Sample: the highest water of the month arrives on Thursday.",
    roles: "info-subtle info-subtle-foreground font-body",
  },
  success: {
    tone: "success",
    title: "Readings synced",
    body: "Sample: all three gauges reported in the last hour.",
    roles: "success-subtle success-subtle-foreground font-body",
  },
  invalid: {
    tone: "destructive",
    title: "Gauge offline",
    body: `Sample: ${SAMPLE_PLACES[2]} has not reported since 04:10. Check its battery.`,
    roles: "destructive-subtle destructive-subtle-foreground font-body",
  },
} as const;

export function Alert({ state }: { state: keyof typeof ALERTS }) {
  const alert = ALERTS[state];
  const Icon = state === "default" ? Info : state === "success" ? CircleCheck : CircleAlert;
  return (
    <div
      className="kit-alert kit-t-body-sm"
      data-kit="alert"
      data-state={state}
      data-tone={alert.tone}
      data-roles={alert.roles}
    >
      <Icon aria-hidden="true" />
      <p className="kit-alert-title">{alert.title}</p>
      <p>{alert.body}</p>
    </div>
  );
}

export function Tooltip() {
  const id = useId();
  return (
    <span className="kit-tooltip-anchor">
      <Button variant="ghost" icon={<MapPin aria-hidden="true" />} describedBy={id}>
        {SAMPLE_PLACES[0]}
      </Button>
      <span
        role="tooltip"
        id={id}
        className="kit-tooltip kit-t-caption"
        data-kit="tooltip"
        data-state="default"
        data-roles="foreground background font-body"
      >
        Sample: gauge 3 of 4, read at 06:42
      </span>
    </span>
  );
}

export function DialogStage({ title }: { title: string }) {
  const id = useId();
  return (
    <div className="kit-stage" data-stage="dialog">
      <div
        role="dialog"
        aria-modal="false"
        aria-labelledby={`${id}-title`}
        className="kit-dialog"
        data-kit="dialog"
        data-state="default"
        data-roles="popover popover-foreground border"
      >
        <p
          id={`${id}-title`}
          className="kit-dialog-title kit-t-h4"
          data-roles="popover-foreground font-display"
        >
          {title}
        </p>
        <p className="kit-t-body-sm" data-roles="popover-foreground font-body">
          Sample: delete this reading? The tide log keeps the other readings of the day.
        </p>
        <div className="kit-actions">
          <Button variant="ghost">Cancel</Button>
          <Button variant="destructive">Delete reading</Button>
        </div>
      </div>
    </div>
  );
}

export function SheetStage({ items }: { items: readonly string[] }) {
  const id = useId();
  return (
    <div className="kit-stage" data-stage="sheet">
      <div
        role="dialog"
        aria-modal="false"
        aria-labelledby={`${id}-title`}
        className="kit-sheet"
        data-kit="sheet"
        data-state="default"
        data-roles="popover popover-foreground border"
      >
        <span className="kit-sheet-grabber" aria-hidden="true" />
        <p
          id={`${id}-title`}
          className="kit-dialog-title kit-t-h4"
          data-roles="popover-foreground font-display"
        >
          Saved places
        </p>
        {items.length === 0 ? (
          <div
            data-list=""
            data-empty=""
            className="kit-list-empty kit-t-body-sm"
            data-roles="popover-foreground font-body"
          >
            No saved places yet. Save a place from its tide table.
          </div>
        ) : (
          <ul
            data-list=""
            className="kit-list kit-t-body-sm"
            data-roles="popover-foreground font-body"
          >
            {items.map((item) => (
              <li key={item} data-list-item="">
                {item}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const TOASTS = {
  default: {
    text: "Sample: reading saved to the tide log.",
    roles: "popover popover-foreground border font-body",
  },
  success: {
    text: "Sample: three gauges synced.",
    roles: "success success-foreground font-body",
  },
  invalid: {
    text: "Sample: the gauge did not answer.",
    roles: "destructive destructive-foreground font-body",
  },
  loading: {
    text: "Sample: syncing the gauges.",
    roles: "popover popover-foreground border font-body",
  },
} as const;

/**
 * A toast (`role="status"`). The kitchen sink's specimens say their state's sample sentence; a template
 * passes its own sentence and, to let the reader dismiss it, `onDismiss` with the button's name. The
 * toast sits where the template puts it, never in a portal (section 7.7).
 */
export function Toast({
  state,
  children,
  onDismiss,
  dismissLabel = "Dismiss",
}: {
  state: keyof typeof TOASTS;
  children?: ReactNode;
  onDismiss?: () => void;
  dismissLabel?: string;
}) {
  const toast = TOASTS[state];
  return (
    <div
      role="status"
      className="kit-toast kit-t-body-sm"
      data-kit="toast"
      data-state={state}
      data-roles={toast.roles}
    >
      {state === "loading" ? (
        <LoaderCircle aria-hidden="true" className="kit-spin" />
      ) : state === "invalid" ? (
        <CircleAlert aria-hidden="true" />
      ) : (
        <CircleCheck aria-hidden="true" />
      )}
      <span className="kit-toast-text">{children ?? toast.text}</span>
      {onDismiss !== undefined && (
        <button
          type="button"
          className="kit-toast-dismiss"
          aria-label={dismissLabel}
          onClick={onDismiss}
        >
          <X aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
