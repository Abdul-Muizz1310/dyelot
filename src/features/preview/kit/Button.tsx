"use client";

import "./button.css";
import { LoaderCircle } from "lucide-react";
import type { ReactNode, Ref } from "react";
import { type ButtonVariant, type KitState, withRing } from "./states";

// The kit's button (section 7.5, R2-20): five variants, each painting with its roles and naming
// them in `data-roles`. A forced state is `data-state`; disabled and loading are real states.

/** The roles each variant paints with (F-TPL-04). */
export const BUTTON_ROLES: Readonly<Record<ButtonVariant, string>> = Object.freeze({
  primary: "primary primary-foreground font-body",
  secondary: "secondary secondary-foreground font-body",
  ghost: "foreground muted font-body",
  destructive: "destructive destructive-foreground font-body",
  link: "primary font-body",
});

export function Button({
  variant,
  state,
  icon,
  onPress,
  describedBy,
  ref,
  id,
  children,
}: {
  variant: ButtonVariant;
  state?: KitState;
  icon?: ReactNode;
  onPress?: () => void;
  /** The id of a tooltip or hint that describes the button. */
  describedBy?: string;
  /** The button element, for a part that moves focus to it (the confirm dialog, its opener). */
  ref?: Ref<HTMLButtonElement>;
  /** The id a link inside the template moves focus to (R2-20). */
  id?: string;
  children: ReactNode;
}) {
  const loading = state === "loading";
  return (
    <button
      ref={ref}
      id={id}
      type="button"
      className="kit-button kit-t-label"
      data-kit={state === undefined ? undefined : "button"}
      data-variant={variant}
      data-state={state}
      data-roles={withRing(BUTTON_ROLES[variant], state)}
      disabled={state === "disabled"}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      aria-describedby={describedBy}
      onClick={loading ? undefined : onPress}
    >
      {loading ? <LoaderCircle aria-hidden="true" className="kit-spin" /> : icon}
      {children}
    </button>
  );
}

/**
 * A button that shows an icon only (section 7.7): its name is `label`, in `aria-label`. It is ghost, the
 * text color on the page with `muted` on hover, and a square of `--control-height`. Like every preview
 * control it does nothing beyond its own state (R2-20).
 */
export function IconButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: ReactNode;
  onPress?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="kit-icon-button"
      data-roles={BUTTON_ROLES.ghost}
      onClick={onPress}
    >
      {icon}
    </button>
  );
}
