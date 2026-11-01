"use client";

import type { ReactNode, RefObject } from "react";
import { BUTTON } from "./chrome";
import { type StudioStore, useStudio } from "./store";
import type { DrawerName } from "./useDrawers";

// The canvas toolbar (spec section 7.1): one order in the DOM and for Tab. Below 1024 px the
// "Inputs" and "Inspector" drawer buttons come first (below 1280 px "Inspector" alone), then the
// mode switch, Undo, Redo and Copy link. The canvas toggles of section 7.4 (frame, template,
// density, reduced motion, copy, vision) join between the mode switch and Undo with Task 2.7.

/** Why drafts are off (F-STUDIO-24). */
const DRAFTS_OFF_WHY =
  "This browser does not let the studio save a draft. The link in the address bar still holds the design.";

type ToolbarProps = {
  store: StudioStore;
  inert: boolean;
  /** Which panels are drawers at this width. */
  drawers: Readonly<Record<DrawerName, boolean>>;
  open: DrawerName | null;
  onOpen(name: DrawerName, button: HTMLElement): void;
  onCopyLink(): void;
  /** "Copy link", where focus goes back to after a toast (F-STUDIO-23). */
  copyButton: RefObject<HTMLButtonElement | null>;
};

export function Toolbar({
  store,
  inert,
  drawers,
  open,
  onOpen,
  onCopyLink,
  copyButton,
}: ToolbarProps) {
  const dark = useStudio(store, (studio) => studio.view.mode === "dark");
  const canUndo = useStudio(store, (studio) => studio.history.length > 0);
  const canRedo = useStudio(store, (studio) => studio.future.length > 0);
  const draftsOff = useStudio(store, (studio) => studio.status.draft === "off");
  const drawerButton = (name: DrawerName, label: string) =>
    drawers[name] && (
      <button
        type="button"
        aria-expanded={open === name}
        aria-controls={`studio-${name}`}
        onClick={(event) => onOpen(name, event.currentTarget)}
        className={BUTTON}
      >
        {label}
      </button>
    );
  return (
    <section
      data-toolbar=""
      aria-label="Canvas toolbar"
      inert={inert}
      className="studio-toolbar flex flex-wrap items-center gap-2 border-border border-b px-4 py-2 md:px-6"
    >
      {drawerButton("inputs", "Inputs")}
      {drawerButton("inspector", "Inspector")}
      <button
        type="button"
        role="switch"
        aria-checked={dark}
        aria-keyshortcuts="Alt+T"
        onClick={() => store.getState().toggleMode()}
        className={`${BUTTON} group`}
      >
        <span
          aria-hidden="true"
          className="relative h-4 w-7 rounded-full border border-control-edge transition-colors group-aria-checked:bg-border"
        >
          <span className="absolute top-0.5 left-0.5 size-2.5 rounded-full bg-fg-muted transition-transform group-aria-checked:translate-x-3 group-aria-checked:bg-foreground" />
        </span>
        Dark mode
      </button>
      <span className="grow" />
      <HistoryButton enabled={canUndo} onPress={() => store.getState().undo()} keys="ArrowLeft">
        Undo
      </HistoryButton>
      <HistoryButton enabled={canRedo} onPress={() => store.getState().redo()} keys="ArrowRight">
        Redo
      </HistoryButton>
      <button
        ref={copyButton}
        type="button"
        aria-keyshortcuts="Control+S Meta+S"
        onClick={onCopyLink}
        className={BUTTON}
      >
        Copy link
      </button>
      {draftsOff && (
        <details className="relative">
          <summary className="inline-flex min-h-8 cursor-pointer list-none items-center rounded-md px-2 font-mono text-fg-muted text-xs hover:text-foreground [&::-webkit-details-marker]:hidden">
            Drafts off
          </summary>
          <p className="absolute top-full right-0 z-20 mt-1 w-64 rounded-md border border-border-bright bg-panel px-3 py-2 text-foreground text-xs leading-relaxed shadow-[var(--window-shadow)]">
            {DRAFTS_OFF_WHY}
          </p>
        </details>
      )}
    </section>
  );
}

/**
 * Undo or Redo. With nothing to undo it stays in the Tab order and says it is unavailable
 * (`aria-disabled`), so keyboard users meet the same toolbar every time.
 */
function HistoryButton({
  enabled,
  onPress,
  keys,
  children,
}: {
  enabled: boolean;
  onPress(): void;
  /** The page-wide shortcut, announced with `aria-keyshortcuts` (R2-15). */
  keys: "ArrowLeft" | "ArrowRight";
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-disabled={!enabled}
      aria-keyshortcuts={keys}
      onClick={() => {
        if (enabled) onPress();
      }}
      className={BUTTON}
    >
      {children}
    </button>
  );
}
