"use client";

import "./fields.css";
import { ChevronDown, CircleAlert, CircleCheck } from "lucide-react";
import { useId } from "react";
import type { KitState } from "./states";

// The kit's text fields and select (section 7.5): a visible label, the control and, for the
// invalid and success states, a message tied to it with `aria-describedby`. Values are the
// control's own state (R2-20): typing changes the field and nothing else.

/** What a field says when it is invalid and when it is saved, in its own words (M-3). */
export type FieldMessages = { readonly invalid: string; readonly success: string };

type FieldProps = {
  label: string;
  state: KitState;
  value: string;
  placeholder: string;
  messages: FieldMessages;
};

/** The attributes a field state sets on its control. */
function controlState(state: KitState, describedBy: string) {
  const message = state === "invalid" || state === "success";
  return {
    "data-state": state,
    "data-roles":
      state === "invalid"
        ? "input destructive"
        : state === "success"
          ? "input success"
          : "input background foreground",
    disabled: state === "disabled",
    "aria-invalid": state === "invalid" || undefined,
    "aria-describedby": message ? describedBy : undefined,
  };
}

function Message({
  id,
  state,
  messages,
}: {
  id: string;
  state: KitState;
  messages: Partial<FieldMessages>;
}) {
  const text = state === "invalid" || state === "success" ? messages[state] : undefined;
  if (text === undefined) return null;
  return (
    <p id={id} className="kit-message" data-tone={state}>
      {state === "invalid" ? (
        <CircleAlert aria-hidden="true" />
      ) : (
        <CircleCheck aria-hidden="true" />
      )}
      {text}
    </p>
  );
}

export function Input({ label, state, value, placeholder, messages }: FieldProps) {
  const id = useId();
  return (
    <div className="kit-field">
      <label htmlFor={id} className="kit-field-label">
        {label}
      </label>
      <input
        id={id}
        className="kit-input"
        data-kit="input"
        type="text"
        defaultValue={state === "placeholder" ? "" : value}
        placeholder={placeholder}
        readOnly={state === "read-only"}
        {...controlState(state, `${id}-message`)}
      />
      <Message id={`${id}-message`} state={state} messages={messages} />
    </div>
  );
}

export function Textarea({ label, state, value, placeholder, messages }: FieldProps) {
  const id = useId();
  return (
    <div className="kit-field">
      <label htmlFor={id} className="kit-field-label">
        {label}
      </label>
      <textarea
        id={id}
        className="kit-textarea"
        data-kit="textarea"
        rows={2}
        defaultValue={state === "placeholder" ? "" : value}
        placeholder={placeholder}
        readOnly={state === "read-only"}
        {...controlState(state, `${id}-message`)}
      />
      <Message id={`${id}-message`} state={state} messages={messages} />
    </div>
  );
}

/** A native select. Section 7.5 gives it no success state, so it has one message: `invalid`. */
export function Select({
  label,
  state,
  options,
  invalid,
}: {
  label: string;
  state: KitState;
  options: readonly string[];
  invalid: string;
}) {
  const id = useId();
  const placeholder = state === "placeholder";
  return (
    <div className="kit-field">
      <label htmlFor={id} className="kit-field-label">
        {label}
      </label>
      <span className="kit-select-wrap">
        <select
          id={id}
          className="kit-select"
          data-kit="select"
          defaultValue={placeholder ? "" : options[0]}
          {...controlState(state, `${id}-message`)}
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
      <Message id={`${id}-message`} state={state} messages={{ invalid }} />
    </div>
  );
}
