import type { KeyboardEvent } from "react";

// The keys of the kit's contained overlays (spec section 7.7): the settings' confirm dialog and the
// mobile template's bottom sheet. Neither uses `showModal()` or the top layer, which escape the
// frame's scale and paint over the studio chrome, so each keeps its own keys: Escape closes it and
// stops there, so no studio shortcut or drawer sees it, and Tab and Shift+Tab wrap inside it.

const FOCUSABLE =
  "a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]";

/**
 * The elements a Tab reaches in `container`, in order. A radio group is one stop: its checked radio,
 * or its first when none is checked, as the browser moves.
 */
export function tabStops(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => {
    if (element.tabIndex < 0) return false;
    if (!(element instanceof HTMLInputElement) || element.type !== "radio" || element.name === "") {
      return true;
    }
    const group = [
      ...container.querySelectorAll<HTMLInputElement>(
        `input[type="radio"][name="${CSS.escape(element.name)}"]`,
      ),
    ];
    return element === (group.find((radio) => radio.checked) ?? group[0]);
  });
}

/**
 * A contained overlay's key handler: Escape calls `onClose` and stops the press; Tab from the last
 * stop goes to the first, and Shift+Tab from the first stop, or from the overlay itself, to the last.
 */
export function containKeys(
  event: KeyboardEvent<HTMLElement>,
  container: HTMLElement | null,
  onClose: () => void,
): void {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    onClose();
    return;
  }
  if (event.key !== "Tab" || container === null) return;
  const stops = tabStops(container);
  const [start, end] = [stops[0], stops[stops.length - 1]];
  if (start === undefined || end === undefined) return;
  const active = document.activeElement;
  if (event.shiftKey && (active === start || !stops.some((stop) => stop === active))) {
    event.preventDefault();
    end.focus();
  } else if (!event.shiftKey && active === end) {
    event.preventDefault();
    start.focus();
  }
}
