"use client";

import type { ReactNode, RefObject } from "react";
import { FrameSwitcher } from "@/features/preview/FrameSwitcher";
import { TEMPLATE_LABELS } from "@/features/preview/templates";
import { BUTTON } from "./chrome";
import { Choice, ChromeSwitch, Picker, same } from "./controls";
import { isOneOf } from "./guards";
import { type StudioStore, useStudio } from "./store";
import type { DrawerName } from "./useDrawers";
import { DENSITIES, TEMPLATE_IDS, VISIONS, type View } from "./view";

// The canvas toolbar (spec sections 7.1 and 7.4): one order in the DOM and for Tab. Below 1024 px
// the "Inputs" and "Inspector" drawer buttons come first (below 1280 px "Inspector" alone), then
// the frame switcher, the template switcher, the mode switch, the density group, "Reduce motion",
// the copy group, the vision group, Undo, Redo and Copy link. The view settings change the canvas
// only: no new design and no history entry (C-STORE-29).

const COPIES: readonly { value: View["copy"]; label: string }[] = [
  { value: "real", label: "Real copy" },
  { value: "edge", label: "Edge-case copy" },
];

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
  /** The frame's fit in the canvas area, as the switcher shows it (F-CANVAS-03). */
  fit: string;
};

export function Toolbar({
  store,
  inert,
  drawers,
  open,
  onOpen,
  onCopyLink,
  copyButton,
  fit,
}: ToolbarProps) {
  const view = useStudio(store, (studio) => studio.view);
  const { setView } = store.getState();
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
      className="studio-toolbar flex flex-wrap items-center gap-x-3 gap-y-2 border-border border-b px-4 py-2 md:px-6"
    >
      {drawerButton("inputs", "Inputs")}
      {drawerButton("inspector", "Inspector")}
      <FrameSwitcher frame={view.frame} fit={fit} onChange={(frame) => setView({ frame })} />
      <Picker
        label="Template"
        inline
        value={view.template}
        options={TEMPLATE_IDS.map((id) => ({ value: id, label: TEMPLATE_LABELS[id] }))}
        onChange={(value) => {
          if (isOneOf(value, TEMPLATE_IDS)) setView({ template: value });
        }}
      />
      <ChromeSwitch
        label="Dark mode"
        checked={view.mode === "dark"}
        keyShortcuts="Alt+T"
        onToggle={() => store.getState().toggleMode()}
        className={BUTTON}
      />
      <Choice
        legend="Density"
        inline
        value={view.density}
        options={same(DENSITIES)}
        onChange={(density) => setView({ density })}
      />
      <ChromeSwitch
        label="Reduce motion"
        checked={view.reducedMotion}
        onToggle={() => setView({ reducedMotion: !view.reducedMotion })}
        className={BUTTON}
      />
      <Choice
        legend="Copy"
        inline
        value={view.copy}
        options={COPIES}
        onChange={(copy) => setView({ copy })}
      />
      <Choice
        legend="Vision"
        inline
        value={view.vision}
        options={same(VISIONS)}
        onChange={(vision) => setView({ vision })}
      />
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
