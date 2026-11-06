import type { TemplateId } from "@/features/studio/view";

// The template switch's transition props (R5-46, section 10.1): `<ViewTransition>` cross-fades the
// canvas's template, and the canvas's own "Reduce motion" turns the three animated props off.

export type TemplateTransition = {
  readonly share: "auto" | "none";
  readonly enter: "auto" | "none";
  readonly exit: "auto" | "none";
  readonly default: "none";
};

const ANIMATED: TemplateTransition = Object.freeze({
  share: "auto",
  enter: "auto",
  exit: "auto",
  default: "none",
});
const STILL: TemplateTransition = Object.freeze({
  share: "none",
  enter: "none",
  exit: "none",
  default: "none",
});

export function templateTransition(reduced: boolean): TemplateTransition {
  if (typeof reduced !== "boolean") {
    throw new TypeError(`templateTransition: reduced must be a boolean, got ${typeof reduced}`);
  }
  return reduced ? STILL : ANIMATED;
}

/**
 * The template the canvas renders (R5-46, as amended at Task 5.8a's review): the deferred one while
 * motion is allowed, so React runs the switch as a transition; the current one at once under the
 * canvas's "Reduce motion" or the OS setting, where no fade shows and a deferred render of the heavy
 * template only costs time.
 */
export function shownTemplate(
  deferred: TemplateId,
  current: TemplateId,
  instant: boolean,
): TemplateId {
  if (typeof instant !== "boolean") {
    throw new TypeError(`shownTemplate: instant must be a boolean, got ${typeof instant}`);
  }
  return instant ? current : deferred;
}
