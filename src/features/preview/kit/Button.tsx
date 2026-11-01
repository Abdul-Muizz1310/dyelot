"use client";

import "./button.css";
import { LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import type { ButtonVariant, KitState } from "./states";

// The kit's button (section 7.5, R2-20): five variants, each painting with its roles and naming
// them in `data-roles`. A forced state is `data-state`; disabled and loading are real states.

/** The roles each variant paints with (F-TPL-04). */
export const BUTTON_ROLES: Readonly<Record<ButtonVariant, string>> = Object.freeze({
  primary: "primary primary-foreground",
  secondary: "secondary secondary-foreground",
  ghost: "foreground muted",
  destructive: "destructive destructive-foreground",
  link: "primary",
});

export function Button({
  variant,
  state,
  icon,
  onPress,
  describedBy,
  children,
}: {
  variant: ButtonVariant;
  state?: KitState;
  icon?: ReactNode;
  onPress?: () => void;
  /** The id of a tooltip or hint that describes the button. */
  describedBy?: string;
  children: ReactNode;
}) {
  const loading = state === "loading";
  return (
    <button
      type="button"
      className="kit-button kit-t-label"
      data-kit={state === undefined ? undefined : "button"}
      data-variant={variant}
      data-state={state}
      data-roles={BUTTON_ROLES[variant]}
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
