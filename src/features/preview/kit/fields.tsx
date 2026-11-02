"use client";

import "./fields.css";
import { ChevronDown, CircleAlert, CircleCheck } from "lucide-react";
import { type ChangeEvent, type ReactNode, useId, useState } from "react";
import type { RoleName } from "@/engine";
import type { KitState } from "./states";

// The kit's text fields and select (section 7.5): a visible label, the control and, for the
// invalid and success states, a message tied to it with `aria-describedby`. Values are the
// control's own state (R2-20): typing changes the field and nothing else.

/** What a field says when it is invalid and when it is saved, in its own words (M-3). */
export type FieldMessages = { readonly invalid: string; readonly success: string };

/** The input types a text field takes (section 7.7): the text-like ones and the date. */
export type FieldType = "text" | "email" | "password" | "number" | "date";

type FieldProps = {
  label: string;
  state: KitState;
  value: string;
  placeholder: string;
  /** The field's messages; a state shows one only when the field has it. */
  messages?: Partial<FieldMessages>;
  /** A sentence under the field that `aria-describedby` names. */
  hint?: ReactNode;
};

/** The message a state shows: the invalid or success message, when the field has one. */
function messageOf(state: KitState, messages: Partial<FieldMessages>): string | undefined {
  return state === "invalid" || state === "success" ? messages[state] : undefined;
}

/** The ids `aria-describedby` names: the hint and the message, each when it shows. */
function describedBy(id: string, hint: boolean, message: boolean): string | undefined {
  const ids = [hint ? `${id}-hint` : null, message ? `${id}-message` : null].filter(
    (part): part is string => part !== null,
  );
  return ids.length === 0 ? undefined : ids.join(" ");
}

/**
 * The roles a field paints in each state: its edge, its fill and its text. An invalid or saved field
 * draws its edge in the status role; a disabled or read-only one sits on the muted fill (F-TPL-39).
 */
function fieldRoles(state: KitState): string {
  switch (state) {
    case "invalid":
      return "input destructive background foreground font-body";
    case "success":
      return "input success background foreground font-body";
    case "disabled":
      return "input muted muted-foreground font-body";
    case "read-only":
      return "input muted foreground font-body";
    default:
      return "input background foreground font-body";
  }
}

/** The attributes a field state sets on its control. */
function controlState(state: KitState, description: string | undefined) {
  return {
    "data-state": state,
    "data-roles": fieldRoles(state),
    disabled: state === "disabled",
    "aria-invalid": state === "invalid" || undefined,
    "aria-describedby": description,
  };
}

function Hint({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="kit-hint kit-t-caption" data-roles="muted-foreground font-body">
      {children}
    </p>
  );
}

function Message({ id, state, text }: { id: string; state: KitState; text: string | undefined }) {
  if (text === undefined) return null;
  return (
    <p
      id={id}
      className="kit-message kit-t-caption"
      data-tone={state}
      data-roles={
        state === "invalid"
          ? "destructive-subtle-foreground font-body"
          : "success-subtle-foreground font-body"
      }
    >
      {state === "invalid" ? (
        <CircleAlert aria-hidden="true" />
      ) : (
        <CircleCheck aria-hidden="true" />
      )}
      {text}
    </p>
  );
}

/**
 * A text field: a visible label, the control and, below it, its hint and its state's message. `type`
 * is a text-like input type or the date (section 7.7); the native attributes pass through.
 */
export function Input({
  label,
  state,
  value,
  placeholder,
  messages = {},
  hint,
  type = "text",
  name,
  autoComplete,
  inputMode,
  spellCheck,
  step,
  min,
}: FieldProps & {
  type?: FieldType;
  name?: string;
  autoComplete?: string;
  inputMode?: "text" | "email" | "decimal" | "numeric";
  spellCheck?: boolean;
  step?: number;
  min?: number;
}) {
  const id = useId();
  const message = messageOf(state, messages);
  return (
    <div className="kit-field">
      <label htmlFor={id} className="kit-field-label kit-t-label">
        {label}
      </label>
      <input
        id={id}
        className="kit-input kit-t-body-sm"
        data-kit="input"
        type={type}
        name={name}
        autoComplete={autoComplete}
        inputMode={inputMode}
        spellCheck={spellCheck}
        step={step}
        min={min}
        defaultValue={state === "placeholder" ? "" : value}
        placeholder={placeholder}
        readOnly={state === "read-only"}
        {...controlState(state, describedBy(id, hint !== undefined, message !== undefined))}
      />
      {hint !== undefined && <Hint id={`${id}-hint`}>{hint}</Hint>}
      <Message id={`${id}-message`} state={state} text={message} />
    </div>
  );
}

export function Textarea({ label, state, value, placeholder, messages = {}, hint }: FieldProps) {
  const id = useId();
  const message = messageOf(state, messages);
  return (
    <div className="kit-field">
      <label htmlFor={id} className="kit-field-label kit-t-label">
        {label}
      </label>
      <textarea
        id={id}
        className="kit-textarea kit-t-body-sm"
        data-kit="textarea"
        rows={2}
        defaultValue={state === "placeholder" ? "" : value}
        placeholder={placeholder}
        readOnly={state === "read-only"}
        {...controlState(state, describedBy(id, hint !== undefined, message !== undefined))}
      />
      {hint !== undefined && <Hint id={`${id}-hint`}>{hint}</Hint>}
      <Message id={`${id}-message`} state={state} text={message} />
    </div>
  );
}

/**
 * A native select. Section 7.5 gives it no success state, so it has one message, `invalid`, which a
 * select that is never shown invalid leaves out.
 */
export function Select({
  label,
  state,
  options,
  invalid,
}: {
  label: string;
  state: KitState;
  options: readonly string[];
  invalid?: string;
}) {
  const id = useId();
  const placeholder = state === "placeholder";
  return (
    <div className="kit-field">
      <label htmlFor={id} className="kit-field-label kit-t-label">
        {label}
      </label>
      <span className="kit-select-wrap">
        <select
          id={id}
          className="kit-select kit-t-body-sm"
          data-kit="select"
          defaultValue={placeholder ? "" : options[0]}
          {...controlState(
            state,
            describedBy(id, false, messageOf(state, { invalid }) !== undefined),
          )}
        >
          {placeholder && (
            <option value="" disabled>
              Choose a place
            </option>
          )}
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden="true" />
      </span>
      <Message id={`${id}-message`} state={state} text={messageOf(state, { invalid })} />
    </div>
  );
}

/**
 * A native color input (section 7.7) beside the hex it holds. The value is the caller's, so the swatch
 * can follow the design until the reader picks a color; the canvas's `accent-color` and
 * `color-scheme` tint the native picker.
 */
export function ColorField({
  label,
  value,
  hint,
  swatchRole,
  onChange,
}: {
  label: string;
  value: string;
  hint: ReactNode;
  /** The role the swatch shows while it shows one of the design's colors (F-TPL-39). */
  swatchRole?: RoleName;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="kit-field">
      <label htmlFor={id} className="kit-field-label kit-t-label">
        {label}
      </label>
      <span className="kit-color-row">
        <input
          id={id}
          type="color"
          className="kit-color"
          value={value}
          aria-describedby={`${id}-hint`}
          data-roles={
            swatchRole === undefined ? "input background" : `input background ${swatchRole}`
          }
          onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
        />
        <span className="kit-num kit-mono kit-t-body-sm" data-roles="foreground">
          {value}
        </span>
      </span>
      <Hint id={`${id}-hint`}>{hint}</Hint>
    </div>
  );
}

/**
 * A native range input (section 7.7) with its value written beside its label in an `output`. The value
 * is the slider's own state (R2-20); the canvas's `accent-color` tints the native track and thumb.
 */
export function Slider({
  label,
  min,
  max,
  step,
  value: start,
  unit,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  unit: string;
}) {
  const id = useId();
  const [value, setValue] = useState(start);
  const text = `${value} ${unit}`;
  return (
    <div className="kit-field">
      <span className="kit-slider-head">
        <label htmlFor={id} className="kit-field-label kit-t-label">
          {label}
        </label>
        <output htmlFor={id} className="kit-num kit-t-label" data-roles="foreground font-body">
          {text}
        </output>
      </span>
      <input
        id={id}
        type="range"
        className="kit-range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={text}
        data-roles="primary input"
        onChange={(event: ChangeEvent<HTMLInputElement>) => setValue(Number(event.target.value))}
      />
    </div>
  );
}
