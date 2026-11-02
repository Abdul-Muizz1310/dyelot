// The studio chrome's shared control styles (spec section 7.2): a form control's edge is the
// achromatic `--control-edge` (3:1, F-A11Y-09), a text button's is `--border-bright`, a selected state
// is neutral, and madder is only the focus ring (globals.css) and the one primary action of a panel.

/** A secondary chrome button: toolbar actions, notice and toast actions. */
export const BUTTON =
  "inline-flex min-h-8 items-center gap-2 rounded-md border border-border-bright px-3 text-foreground text-sm hover:border-fg-muted hover:bg-panel aria-disabled:cursor-not-allowed aria-disabled:border-border aria-disabled:text-fg-muted aria-disabled:hover:bg-transparent";

/**
 * A compact chrome button for the canvas toolbar: 28 px tall (F-CANVAS-18), 12 px text. A disclosure
 * shows its open state as the neutral selected state.
 */
export const TOOL_BUTTON =
  "inline-flex min-h-7 items-center gap-1 rounded-md border border-border-bright px-1.5 text-xs text-foreground hover:border-fg-muted hover:bg-panel aria-expanded:bg-border aria-disabled:cursor-not-allowed aria-disabled:border-border aria-disabled:text-fg-muted aria-disabled:hover:bg-transparent";

/**
 * A compact toggle button (`aria-pressed`) of the inspector: 28 px tall, 12 px text, and the form
 * control's 3:1 edge, since its edge tells its state (F-A11Y-09). Pressed is the neutral selected state.
 */
export const TOGGLE_BUTTON =
  "inline-flex min-h-7 items-center gap-1 rounded-md border border-control-edge px-2 text-xs text-foreground hover:border-fg-muted hover:bg-panel aria-pressed:border-foreground aria-pressed:bg-border aria-pressed:text-foreground";

/** The one primary action of a panel: madder fill, page-dark text. Mark it `data-primary`. */
export const PRIMARY_BUTTON =
  "inline-flex min-h-8 items-center justify-center rounded-md bg-accent-madder px-3 font-medium text-page text-sm hover:opacity-90";

/** A neutral selected state for a pressed toggle: foreground and a lighter fill; the edge stays. */
export const PRESSED = "aria-pressed:bg-border aria-pressed:text-foreground";
