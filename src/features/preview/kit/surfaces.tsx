"use client";

import {
  CircleAlert,
  CircleCheck,
  Info,
  LoaderCircle,
  MapPin,
  WavesHorizontal,
} from "lucide-react";
import { useId, useState } from "react";
import { Button } from "./Button";
import type { KitState } from "./states";

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
      data-roles="card card-foreground border"
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
        <span className="kit-card-title">{title}</span>
        <span className="kit-card-meta">{meta}</span>
      </span>
    </button>
  );
}

const ALERTS = {
  default: {
    tone: "info",
    title: "Spring tides this week",
    body: "Sample: the highest water of the month arrives on Thursday.",
    roles: "info-subtle info-subtle-foreground",
  },
  success: {
    tone: "success",
    title: "Readings synced",
    body: "Sample: all three gauges reported in the last hour.",
    roles: "success-subtle success-subtle-foreground",
  },
  invalid: {
    tone: "destructive",
    title: "Gauge offline",
    body: "Sample: Gull Point has not reported since 04:10. Check its battery.",
    roles: "destructive-subtle destructive-subtle-foreground",
  },
} as const;

export function Alert({ state }: { state: keyof typeof ALERTS }) {
  const alert = ALERTS[state];
  const Icon = state === "default" ? Info : state === "success" ? CircleCheck : CircleAlert;
  return (
    <div
      className="kit-alert"
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
        Samphire Bay
      </Button>
      <span
        role="tooltip"
        id={id}
        className="kit-tooltip"
        data-kit="tooltip"
        data-state="default"
        data-roles="foreground background"
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
        data-roles="popover popover-foreground"
      >
        <p id={`${id}-title`} className="kit-dialog-title">
          {title}
        </p>
        <p className="kit-t-body-sm">
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
        <p id={`${id}-title`} className="kit-dialog-title">
          Saved places
        </p>
        {items.length === 0 ? (
          <div data-list="" data-empty="" className="kit-list-empty">
            No saved places yet. Save a place from its tide table.
          </div>
        ) : (
          <ul data-list="" className="kit-list">
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
    roles: "popover popover-foreground border",
  },
  success: { text: "Sample: three gauges synced.", roles: "success success-foreground" },
  invalid: {
    text: "Sample: the gauge did not answer.",
    roles: "destructive destructive-foreground",
  },
  loading: { text: "Sample: syncing the gauges.", roles: "popover popover-foreground border" },
} as const;

export function Toast({ state }: { state: keyof typeof TOASTS }) {
  const toast = TOASTS[state];
  return (
    <div
      role="status"
      className="kit-toast"
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
      <span>{toast.text}</span>
    </div>
  );
}
