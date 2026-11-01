"use client";

import { type ReactNode, type RefObject, useId, useState } from "react";
import { FrameSwitcher } from "@/features/preview/FrameSwitcher";
import { TEMPLATE_LABELS } from "@/features/preview/templates";
import { TOOL_BUTTON } from "./chrome";
import { Choice, ChromeSwitch, Picker, same } from "./controls";
import { isOneOf } from "./guards";
import { type StudioStore, useStudio } from "./store";
import type { DrawerName } from "./useDrawers";
import { DENSITIES, TEMPLATE_IDS, VISIONS, type View } from "./view";

// The canvas toolbar (spec sections 7.1 and 7.4): one order in the DOM and for Tab. Below 1024 px
// the "Inputs" and "Inspector" drawer buttons come first (below 1280 px "Inspector" alone), then
// the frame switcher, the template switcher, the mode switch, the density group, "Reduce motion",
// the copy group, the vision group, Undo, Redo and Copy link. Below 640 px the five view controls
// sit in a "View" disclosure in the mode switch's place (F-CANVAS-19). The view settings change the
// canvas only: no new design and no history entry (C-STORE-29).

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
  // Below 640 px the five view controls sit in the "View" disclosure (F-CANVAS-19); studio.css
  // shows the button and hides the group there, and lays the group out inline above it.
  const [viewOpen, setViewOpen] = useState(false);
  const viewId = useId();
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
        className={TOOL_BUTTON}
      >
        {label}
      </button>
    );
  return (
    <section
      data-toolbar=""
      aria-label="Canvas toolbar"
      inert={inert}
      className="studio-toolbar flex flex-wrap items-center gap-x-1.5 gap-y-1.5 border-border border-b px-3 py-2"
    >
      {drawerButton("inputs", "Inputs")}
      {drawerButton("inspector", "Inspector")}
      <FrameSwitcher frame={view.frame} onChange={(frame) => setView({ frame })} />
      <Picker
        label="Template"
        inline
        value={view.template}
        options={TEMPLATE_IDS.map((id) => ({ value: id, label: TEMPLATE_LABELS[id] }))}
        onChange={(value) => {
          if (isOneOf(value, TEMPLATE_IDS)) setView({ template: value });
        }}
      />
      <button
        type="button"
        aria-expanded={viewOpen}
        aria-controls={viewId}
        onClick={() => setViewOpen((value) => !value)}
        className={`${TOOL_BUTTON} studio-view-toggle group`}
      >
        View
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-3.5 transition-transform group-aria-expanded:rotate-180"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div id={viewId} className="studio-view" data-open={viewOpen ? "" : undefined}>
        <ChromeSwitch
          label="Dark mode"
          checked={view.mode === "dark"}
          keyShortcuts="Alt+T"
          onToggle={() => store.getState().toggleMode()}
          className={TOOL_BUTTON}
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
          className={TOOL_BUTTON}
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
      </div>
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
        className={TOOL_BUTTON}
      >
        Copy link
      </button>
      {draftsOff && (
        <details className="relative">
          <summary className="inline-flex min-h-7 cursor-pointer list-none items-center rounded-md px-2 font-mono text-fg-muted text-xs hover:text-foreground [&::-webkit-details-marker]:hidden">
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
      className={TOOL_BUTTON}
    >
      {children}
    </button>
  );
}
