"use client";

import { type ReactNode, useId } from "react";

// The chrome's form controls, shared by the inputs panel (section 7.2) and the canvas toolbar
// (section 7.4): a native select with its visible label, a radio group drawn as a segmented control
// and a switch. Every edge is the achromatic `--control-edge` (F-A11Y-09); a selected option is
// neutral, so madder stays on focus and the primary action.

export type Option<T extends string> = { readonly value: T; readonly label: string };

/** The options of `values`, each labeled with its own value. */
export const same = <T extends string>(values: readonly T[]): readonly Option<T>[] =>
  values.map((value) => ({ value, label: value }));

/** A control's visible label. */
export const LABEL = "block text-fg-muted text-xs";
const SELECT_EDGE =
  "rounded-md border border-control-edge bg-panel text-foreground hover:border-fg-muted";
const SELECT = `${SELECT_EDGE} h-9 w-full px-2 text-sm`;
/** The toolbar's select: 28 px tall, 13 px text (F-CANVAS-18). */
const TOOL_SELECT = `${SELECT_EDGE} h-7 w-auto px-1.5 text-[13px]`;

/** A native select with its visible label; `inline` sets the label beside it, for the toolbar. */
export function Picker({
  label,
  value,
  options,
  onChange,
  describedBy,
  inline = false,
}: {
  label: string;
  value: string;
  options: readonly (Option<string> & { readonly disabled?: boolean })[];
  onChange(value: string): void;
  describedBy?: string;
  inline?: boolean;
}) {
  const id = useId();
  return (
    <div className={inline ? "flex items-center gap-1.5" : "space-y-1.5"}>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.currentTarget.value)}
        className={inline ? TOOL_SELECT : SELECT}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * A radio group drawn as a segmented control; the native radios keep the arrow keys. `inline` is the
 * toolbar's compact form, so the toolbar keeps to three rows at 1280 × 800 (F-CANVAS-17): the legend
 * beside the options (a floated legend joins the fieldset's grid), 11 px text, options 28 px tall
 * (F-CANVAS-18), and `note`, a live reading such as the frame's fit, set under the
 * legend and tied to the group as its description (review M-5).
 */
export function Choice<T extends string>({
  legend,
  value,
  options,
  onChange,
  inline = false,
  note,
}: {
  legend: string;
  value: T;
  options: readonly Option<T>[];
  onChange(value: T): void;
  inline?: boolean;
  note?: ReactNode;
}) {
  const name = useId();
  const noteId = useId();
  const noted = note !== undefined;
  const legendClass = inline
    ? `float-left col-start-1 row-start-1 text-[11px] text-fg-muted ${noted ? "self-end" : "self-center"}`
    : `${LABEL} mb-1.5`;
  return (
    <fieldset
      aria-describedby={noted ? noteId : undefined}
      className={inline ? "grid grid-cols-[auto_auto] items-center gap-x-1" : "min-w-0 space-y-1.5"}
    >
      <legend className={legendClass}>{legend}</legend>
      <div
        className={
          inline
            ? `col-start-2 row-start-1 flex gap-0.5 rounded-md border border-control-edge p-0.5 ${noted ? "row-span-2" : ""}`
            : "flex gap-1 rounded-md border border-control-edge p-0.5"
        }
      >
        {options.map((option) => (
          <label
            key={option.value}
            className={`relative flex items-center justify-center rounded-[5px] text-center text-fg-muted hover:text-foreground has-checked:bg-border has-checked:font-medium has-checked:text-foreground has-checked:shadow-[inset_0_0_0_1px_var(--border-bright)] ${inline ? "min-h-7 min-w-6 flex-none px-1 text-[11px]" : "min-h-8 min-w-0 flex-1 px-1.5 text-xs"}`}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="absolute inset-0 m-0 cursor-pointer appearance-none rounded-[5px]"
            />
            <span className={inline ? "pointer-events-none" : "pointer-events-none truncate"}>
              {option.label}
            </span>
          </label>
        ))}
      </div>
      {noted && (
        <span
          id={noteId}
          className={
            inline
              ? "col-start-1 row-start-2 self-start font-mono text-[11px] text-fg-muted tabular-nums leading-tight"
              : "font-mono text-fg-muted text-xs tabular-nums"
          }
        >
          {note}
        </span>
      )}
    </fieldset>
  );
}

/** A chrome switch (`role="switch"`): a neutral track, the label beside it. */
export function ChromeSwitch({
  label,
  checked,
  onToggle,
  keyShortcuts,
  className,
}: {
  label: string;
  checked: boolean;
  onToggle(): void;
  keyShortcuts?: string;
  className: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-keyshortcuts={keyShortcuts}
      onClick={onToggle}
      className={`${className} group`}
    >
      <span
        aria-hidden="true"
        className="relative h-3.5 w-6 shrink-0 rounded-full border border-control-edge transition-colors group-aria-checked:bg-border"
      >
        <span className="absolute top-[2px] left-[2px] size-2 rounded-full bg-fg-muted transition-transform group-aria-checked:translate-x-2.5 group-aria-checked:bg-foreground" />
      </span>
      {label}
    </button>
  );
}
