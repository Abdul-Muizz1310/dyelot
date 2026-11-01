// The studio chrome's shared control styles (spec section 7.2): achromatic controls with a
// `--border-bright` edge, a neutral selected state, and madder only for the focus ring (globals.css)
// and the one primary action of a panel.

/** A secondary chrome button: toolbar actions, notice and toast actions. */
export const BUTTON =
  "inline-flex min-h-8 items-center gap-2 rounded-md border border-border-bright px-3 text-foreground text-sm hover:border-fg-muted hover:bg-panel aria-disabled:cursor-not-allowed aria-disabled:border-border aria-disabled:text-fg-muted aria-disabled:hover:bg-transparent";

/** The one primary action of a panel: madder fill, page-dark text. Mark it `data-primary`. */
export const PRIMARY_BUTTON =
  "inline-flex min-h-8 items-center justify-center rounded-md bg-accent-madder px-3 font-medium text-page text-sm hover:opacity-90";

/** A neutral selected state for a pressed toggle: foreground, a lighter fill, a bright edge. */
export const PRESSED =
  "aria-pressed:border-border-bright aria-pressed:bg-border aria-pressed:text-foreground";
