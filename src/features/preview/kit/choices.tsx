"use client";

import "./choices.css";
import { Check, Minus } from "lucide-react";
import { m } from "motion/react";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { useKitMotion } from "./motion";
import type { KitState } from "./states";

// The kit's checkbox, radio, switch and segmented control (section 7.5). Each is a native control or
// a button with its ARIA role; a click changes its own state and nothing else (R2-20). The switch's
// thumb springs with the spec's spring through MotionConfig, and stops under reduced motion.

export function Checkbox({ label, state }: { label: string; state: KitState }) {
  const box = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    if (box.current !== null) box.current.indeterminate = state === "indeterminate";
  }, [state]);
  return (
    <label className="kit-check kit-t-body-sm" data-roles="foreground primary-foreground">
      <span className="kit-check-box">
        <input
          ref={box}
          type="checkbox"
          className="kit-checkbox"
          data-kit="checkbox"
          data-state={state}
          data-roles="input background primary primary-foreground foreground"
          defaultChecked={state === "selected"}
          disabled={state === "disabled"}
          aria-invalid={state === "invalid" || undefined}
        />
        <Check data-mark="check" aria-hidden="true" />
        <Minus data-mark="dash" aria-hidden="true" />
      </span>
      {label}
    </label>
  );
}

/** The surface a choice sits on: the page, or a popover (a sheet), whose text role it takes. */
export type ChoiceSurface = "page" | "popover";

/** The roles of a choice's label and of its radio, by the surface it sits on. */
const SURFACE_ROLES: Readonly<Record<ChoiceSurface, { label: string; radio: string }>> = {
  page: { label: "foreground", radio: "input background primary foreground" },
  popover: { label: "popover-foreground", radio: "input popover primary foreground" },
};

/**
 * A radio. On its own it is a group of one (a specimen); a `RadioGroup` gives its radios one `name`
 * and, when its caller listens, `onPick`. On a popover (`surface`) its label takes the popover's text
 * role and its well the popover's fill.
 */
export function Radio({
  label,
  state,
  name,
  onPick,
  surface = "page",
}: {
  label: string;
  state: KitState;
  name?: string;
  onPick?: () => void;
  surface?: ChoiceSurface;
}) {
  const own = useId();
  const roles = SURFACE_ROLES[surface];
  return (
    <label className="kit-check kit-t-body-sm" data-surface={surface} data-roles={roles.label}>
      <span className="kit-check-box">
        <input
          type="radio"
          name={name ?? own}
          className="kit-radio"
          data-kit="radio"
          data-state={state}
          data-roles={roles.radio}
          defaultChecked={state === "selected"}
          disabled={state === "disabled"}
          onChange={onPick}
        />
      </span>
      {label}
    </label>
  );
}

/**
 * A switch (`role="switch"`). A specimen carries `data-kit` and its forced state; the live demo of
 * the motion section carries `data-kit-demo` and starts off.
 */
export function Switch({ label, state }: { label: string; state?: KitState }) {
  const [on, setOn] = useState(state === "selected");
  const motion = useKitMotion();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className="kit-switch kit-t-label"
      data-kit={state === undefined ? undefined : "switch"}
      data-kit-demo={state === undefined ? "switch" : undefined}
      data-state={state}
      data-roles="foreground input background primary primary-foreground"
      disabled={state === "disabled"}
      onClick={() => setOn((value) => !value)}
    >
      <span className="kit-switch-track">
        <m.span
          key={motion.key}
          data-thumb=""
          className="kit-switch-thumb"
          initial={false}
          animate={{ x: on ? "100%" : "0%" }}
          transition={motion.transition}
        />
      </span>
      {label}
    </button>
  );
}

/** A segmented control: its outer radius is its inner radius plus its padding (F-TPL-08). */
export function Segmented({ legend, options }: { legend: string; options: readonly string[] }) {
  const name = useId();
  const [value, setValue] = useState(options[0]);
  return (
    <div
      role="radiogroup"
      aria-label={legend}
      className="kit-segmented"
      data-kit-demo="segmented"
      data-concentric="segmented"
      data-roles="muted muted-foreground background foreground"
    >
      {options.map((option) => (
        <label key={option} className="kit-segment kit-t-label" data-concentric="segment">
          <input
            type="radio"
            name={name}
            value={option}
            checked={value === option}
            onChange={() => setValue(option)}
          />
          {option}
        </label>
      ))}
    </div>
  );
}

/** A labeled group of radios that share one name; `value` starts checked, and `onChange` hears each pick. */
export function RadioGroup({
  legend,
  options,
  value,
  onChange,
  surface = "page",
}: {
  legend: string;
  options: readonly string[];
  value: string;
  onChange?: (value: string) => void;
  /** The surface the group sits on, the page or a popover (a sheet). */
  surface?: ChoiceSurface;
}) {
  const name = useId();
  return (
    <fieldset className="kit-fieldset">
      <legend
        className="kit-legend kit-t-label"
        data-surface={surface}
        data-roles={SURFACE_ROLES[surface].label}
      >
        {legend}
      </legend>
      <div className="kit-choice-list">
        {options.map((option) => (
          <Radio
            key={option}
            label={option}
            name={name}
            state={option === value ? "selected" : "default"}
            onPick={onChange === undefined ? undefined : () => onChange(option)}
            surface={surface}
          />
        ))}
      </div>
    </fieldset>
  );
}

/** A labeled group of checkboxes; the options in `checked` start checked. */
export function CheckboxGroup({
  legend,
  options,
  checked,
}: {
  legend: string;
  options: readonly string[];
  checked: readonly string[];
}) {
  return (
    <fieldset className="kit-fieldset">
      <legend className="kit-legend kit-t-label" data-roles="foreground">
        {legend}
      </legend>
      <div className="kit-choice-list">
        {options.map((option) => (
          <Checkbox
            key={option}
            label={option}
            state={checked.includes(option) ? "selected" : "default"}
          />
        ))}
      </div>
    </fieldset>
  );
}
