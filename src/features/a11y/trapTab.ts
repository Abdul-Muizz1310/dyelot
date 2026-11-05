import { tabStops } from "./tabStops";

// The Tab trap of a modal dialog: Tab from its last stop goes to its first, and Shift+Tab from its
// first stop, or from the heading and anything else that is not a stop, goes to its last. The stops
// are the shared `tabStops` rule, the same one the drawers and the kit's overlays use.

/** Keeps Tab and Shift+Tab inside `container`: call it from a `keydown` listener. */
export function trapTab(
  event: Pick<KeyboardEvent, "key" | "shiftKey" | "preventDefault">,
  container: HTMLElement,
): void {
  if (event.key !== "Tab") return;
  const stops = tabStops(container);
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (first === undefined || last === undefined) {
    event.preventDefault();
    return;
  }
  const active = document.activeElement;
  const inside = active instanceof Node && container.contains(active);
  if (event.shiftKey) {
    if (active === first || !stops.some((stop) => stop === active)) {
      event.preventDefault();
      last.focus();
    }
  } else if (active === last || !inside) {
    event.preventDefault();
    first.focus();
  }
}
