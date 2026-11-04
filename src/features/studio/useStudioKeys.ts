"use client";

import { useEffect, useEffectEvent } from "react";
import { type Shortcut, shortcutFor } from "./shortcuts";
import type { StudioStore } from "./store";

// The studio's keyboard (spec section 7.3): one `keydown` listener on the window that asks
// `shortcutFor` what a press means and runs it. The rules live in shortcuts.ts.

type Handlers = {
  /** Whether a modal drawer holds focus. */
  readonly drawerOpen: boolean;
  /** Whether a modal dialog is open (R3-35): the page then keeps only the chords it must swallow. */
  readonly dialogOpen: boolean;
  closeDrawer(): void;
  copyLink(): void;
  openExport(): void;
};

export function useStudioKeys(store: StudioStore, handlers: Handlers): void {
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const target = event.target instanceof Element ? event.target : null;
    const shortcut = shortcutFor(event, target, {
      drawerOpen: handlers.drawerOpen,
      dialogOpen: handlers.dialogOpen,
    });
    if (shortcut === null) return;
    event.preventDefault();
    run(shortcut);
  });

  function run(shortcut: Shortcut): void {
    const studio = store.getState();
    switch (shortcut.kind) {
      case "close-drawer":
        handlers.closeDrawer();
        return;
      case "copy-link":
        handlers.copyLink();
        return;
      case "open-export":
        handlers.openExport();
        return;
      case "swallow":
        // Nothing to run: `preventDefault` keeps the browser's save dialog and address bar shut.
        return;
      case "toggle-mode":
        studio.toggleMode();
        return;
      case "regenerate":
        studio.regenerate();
        return;
      case "undo":
        studio.undo();
        return;
      case "redo":
        studio.redo();
        return;
      case "toggle-lock":
        studio.toggleLock(shortcut.slot);
        return;
      default: {
        const unknown: never = shortcut;
        throw new Error(`unknown shortcut ${JSON.stringify(unknown)}`);
      }
    }
  }

  useEffect(() => {
    const listener = (event: Event) => {
      // Autofill and some extensions dispatch a plain Event named keydown, with no key or code
      // (F-KEY-14); only a real KeyboardEvent can be a shortcut.
      if (event instanceof KeyboardEvent) onKeyDown(event);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
}
