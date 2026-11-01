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
const SELECT =
  "h-9 w-full rounded-md border border-control-edge bg-panel px-2 text-foreground text-sm hover:border-fg-muted";

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
    <div className={inline ? "flex items-center gap-2" : "space-y-1.5"}>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.currentTarget.value)}
        className={inline ? `${SELECT} h-8 w-auto` : SELECT}
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
 * A radio group drawn as a segmented control; the native radios keep the arrow keys. `inline` sets
 * the legend beside the options (a floated legend joins the fieldset's flex row), for the toolbar;
 * `note` follows the options, for a live reading such as the frame's fit.
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
  return (
    <fieldset className={inline ? "flex items-center gap-2" : "min-w-0 space-y-1.5"}>
      <legend className={inline ? `${LABEL} float-left` : `${LABEL} mb-1.5`}>{legend}</legend>
      <div className="flex gap-1 rounded-md border border-control-edge p-0.5">
        {options.map((option) => (
          <label
            key={option.value}
            className={`relative flex min-h-8 items-center justify-center rounded-[5px] text-center text-fg-muted text-xs hover:text-foreground has-checked:bg-border has-checked:font-medium has-checked:text-foreground has-checked:shadow-[inset_0_0_0_1px_var(--border-bright)] ${inline ? "flex-none px-2" : "min-w-0 flex-1 px-1.5"}`}
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
      {note !== undefined && (
        <span className="font-mono text-fg-muted text-xs tabular-nums">{note}</span>
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
        className="relative h-4 w-7 rounded-full border border-control-edge transition-colors group-aria-checked:bg-border"
      >
        <span className="absolute top-0.5 left-0.5 size-2.5 rounded-full bg-fg-muted transition-transform group-aria-checked:translate-x-3 group-aria-checked:bg-foreground" />
      </span>
      {label}
    </button>
  );
}
