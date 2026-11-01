"use client";

import type { ReactNode } from "react";
import { type StudioStore, useStudio } from "./store";

// The canvas toolbar (spec section 7.1): one order in the DOM and for Tab. Below 1024 px the
// "Inputs" and "Inspector" drawer buttons come first (below 1280 px "Inspector" alone), then the
// mode toggle, Undo, Redo and Copy link. The canvas toggles of section 7.4 (frame, template,
// density, reduced motion, copy, vision) join between the mode toggle and Undo with Task 2.7.

export type DrawerName = "inputs" | "inspector";

const BUTTON =
  "inline-flex min-h-8 items-center gap-2 rounded-md border border-border-bright px-3 text-sm text-foreground hover:border-fg-muted hover:bg-panel aria-disabled:cursor-not-allowed aria-disabled:border-border aria-disabled:text-fg-muted aria-disabled:hover:bg-transparent";

type ToolbarProps = {
  store: StudioStore;
  inert: boolean;
  /** Which panels are drawers at this width. */
  drawers: Readonly<Record<DrawerName, boolean>>;
  open: DrawerName | null;
  onOpen(name: DrawerName, button: HTMLElement): void;
  onCopyLink(): void;
};

export function Toolbar({ store, inert, drawers, open, onOpen, onCopyLink }: ToolbarProps) {
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
        onClick={() => store.getState().toggleMode()}
        className={`${BUTTON} group`}
      >
        <span
          aria-hidden="true"
          className="relative h-4 w-7 rounded-full border border-fg-muted transition-colors group-aria-checked:border-accent-madder group-aria-checked:bg-accent-madder-soft"
        >
          <span className="absolute top-0.5 left-0.5 size-2.5 rounded-full bg-fg-muted transition-transform group-aria-checked:translate-x-3 group-aria-checked:bg-accent-madder" />
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
      <button type="button" onClick={onCopyLink} className={BUTTON}>
        Copy link
      </button>
      {draftsOff && (
        <span
          title="This browser does not let the studio save a draft. The link in the address bar still holds the design."
          className="font-mono text-fg-muted text-xs"
        >
          Drafts off
        </span>
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
