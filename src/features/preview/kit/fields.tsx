"use client";

import { ChevronDown, CircleAlert, CircleCheck } from "lucide-react";
import { useId } from "react";
import type { KitState } from "./states";

// The kit's text fields and select (section 7.5): a visible label, the control and, for the
// invalid and success states, a message tied to it with `aria-describedby`. Values are the
// control's own state (R2-20): typing changes the field and nothing else.

type FieldProps = {
  label: string;
  state: KitState;
  value: string;
  placeholder: string;
};

type Messages = { readonly invalid: string; readonly success: string };

const FIELD_MESSAGES: Messages = {
  invalid: "Enter a reading in meters.",
  success: "Reading saved.",
};
const SELECT_MESSAGES: Messages = {
  invalid: "Choose a place for the reading.",
  success: "Place saved.",
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
  messages = FIELD_MESSAGES,
}: {
  id: string;
  state: KitState;
  messages?: Messages;
}) {
  if (state !== "invalid" && state !== "success") return null;
  return (
    <p id={id} className="kit-message" data-tone={state}>
      {state === "invalid" ? (
        <CircleAlert aria-hidden="true" />
      ) : (
        <CircleCheck aria-hidden="true" />
      )}
      {messages[state]}
    </p>
  );
}

export function Input({ label, state, value, placeholder }: FieldProps) {
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
      <Message id={`${id}-message`} state={state} />
    </div>
  );
}

export function Textarea({ label, state, value, placeholder }: FieldProps) {
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
      <Message id={`${id}-message`} state={state} />
    </div>
  );
}

export function Select({
  label,
  state,
  options,
}: {
  label: string;
  state: KitState;
  options: readonly string[];
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
      <Message id={`${id}-message`} state={state} messages={SELECT_MESSAGES} />
    </div>
  );
}
