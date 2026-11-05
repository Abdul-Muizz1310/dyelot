// The one rule for what a Tab reaches inside a focus trap: the studio's drawers and the kit's
// contained overlays (the settings' confirm dialog and the mobile template's bottom sheet) share it.

const FOCUSABLE =
  "a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex]";

/**
 * The elements a Tab reaches in `container`, in order. A radio group is one stop: its checked radio,
 * or its first when none is checked, as the browser moves. An element with a negative tab index, or
 * one that is not rendered (`display: none`, or inside such an ancestor), is not a stop.
 */
export function tabStops(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => {
    if (element.tabIndex < 0 || element.getClientRects().length === 0) return false;
    if (!(element instanceof HTMLInputElement) || element.type !== "radio" || element.name === "") {
      return true;
    }
    const group = [
      ...container.querySelectorAll<HTMLInputElement>(
        `input[type="radio"][name="${CSS.escape(element.name)}"]`,
      ),
    ].filter((radio) => !radio.disabled && radio.getClientRects().length > 0);
    return element === (group.find((radio) => radio.checked) ?? group[0]);
  });
}
