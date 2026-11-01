"use client";

import { Check, Minus } from "lucide-react";
import { m } from "motion/react";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { useKitTransition } from "./motion";
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
    <label className="kit-check">
      <span className="kit-check-box">
        <input
          ref={box}
          type="checkbox"
          className="kit-checkbox"
          data-kit="checkbox"
          data-state={state}
          data-roles="input background primary primary-foreground"
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

export function Radio({ label, state }: { label: string; state: KitState }) {
  const name = useId();
  return (
    <label className="kit-check">
      <span className="kit-check-box">
        <input
          type="radio"
          name={name}
          className="kit-radio"
          data-kit="radio"
          data-state={state}
          data-roles="input background primary"
          defaultChecked={state === "selected"}
          disabled={state === "disabled"}
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
  const transition = useKitTransition();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className="kit-switch"
      data-kit={state === undefined ? undefined : "switch"}
      data-kit-demo={state === undefined ? "switch" : undefined}
      data-state={state}
      data-roles="input background primary primary-foreground"
      disabled={state === "disabled"}
      onClick={() => setOn((value) => !value)}
    >
      <span className="kit-switch-track">
        <m.span
          data-thumb=""
          className="kit-switch-thumb"
          initial={false}
          animate={{ x: on ? "100%" : "0%" }}
          transition={transition}
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
        <label key={option} className="kit-segment" data-concentric="segment">
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
