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
