"use client";

import "./studio.css";
import Link from "next/link";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { CanvasFrame } from "./CanvasFrame";
import { createStudioClient } from "./client";
import { safeStorage } from "./drafts";
import { InputsPanel } from "./InputsPanel";
import { LotTag } from "./LotTag";
import { Notices } from "./Notices";
import { type Shortcut, shortcutFor } from "./shortcuts";
import {
  bindStudioWindow,
  createStudioStore,
  randomSeed,
  type StudioStore,
  useStudio,
} from "./store";
import { Toast, type ToastState } from "./Toast";
import { type DrawerName, Toolbar } from "./Toolbar";
import { linkUrl } from "./url";

// The studio page (spec section 7.1): the store, the shell, the drawers and the keyboard. The store
// is made in an effect, because its first load reads the hash and localStorage, which the server
// does not have; until then the page shows its loading state.

/** Below these widths a panel is a drawer (R2-16): inputs below 1024 px, the inspector below 1280. */
const INPUTS_DRAWER = "(max-width: 1023.98px)";
const INSPECTOR_DRAWER = "(max-width: 1279.98px)";

/** Elements a Tab can reach inside a drawer. */
const FOCUSABLE =
  "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

export function Studio() {
  const [store, setStore] = useState<StudioStore | null>(null);
  useEffect(() => {
    const created = createStudioStore({
      client: createStudioClient(),
      storage: safeStorage(window),
      clock: () => performance.now(),
      // Two getRandomValues draws (R2-13 item 5), so an e2e init script can count every seed.
      newSeed: () => randomSeed(),
      location: window.location,
      history: window.history,
    });
    const unbind = bindStudioWindow(created, window);
    setStore(created);
    return () => {
      unbind();
      created.getState().dispose();
    };
  }, []);
  if (store === null) return <StudioLoading />;
  return <StudioShell store={store} />;
}

function StudioLoading() {
  return (
    <div className="grid min-h-dvh place-items-center p-4">
      <h1 className="sr-only">dyelot studio</h1>
      <p role="status" className="font-mono text-fg-muted text-sm">
        Loading the studio…
      </p>
    </div>
  );
}

/** Whether a media query matches, following its changes. */
function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Keeps Tab and Shift+Tab inside an open drawer (R2-16 item 2). */
function trapFocus(event: ReactKeyboardEvent<HTMLElement>): void {
  if (event.key !== "Tab") return;
  const stops = [...event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (element) => element.getClientRects().length > 0,
  );
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (first === undefined || last === undefined) {
    event.preventDefault();
    return;
  }
  const active = document.activeElement;
  if (event.shiftKey && (active === first || !stops.some((stop) => stop === active))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

function StudioShell({ store }: { store: StudioStore }) {
  const isDrawer = {
    inputs: useMedia(INPUTS_DRAWER),
    inspector: useMedia(INSPECTOR_DRAWER),
  };
  const [requested, setRequested] = useState<DrawerName | null>(null);
  // A drawer whose width turned it back into a column is no longer open, and stays closed if the
  // window narrows again.
  const open = requested !== null && isDrawer[requested] ? requested : null;
  useEffect(() => {
    if (open === null) setRequested(null);
  }, [open]);
  const opener = useRef<HTMLElement | null>(null);
  const inputsHeading = useRef<HTMLHeadingElement>(null);
  const inspectorHeading = useRef<HTMLHeadingElement>(null);
  const canvas = useRef<HTMLElement>(null);
  const shown = useRef<DrawerName | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const busy = useStudio(store, (studio) => studio.status.phase === "generating");

  // Opening moves focus to the drawer's heading; closing gives it back to the button that opened it.
  useEffect(() => {
    if (open === "inputs") inputsHeading.current?.focus();
    else if (open === "inspector") inspectorHeading.current?.focus();
    else if (shown.current !== null) opener.current?.focus();
    shown.current = open;
  }, [open]);

  function openDrawer(name: DrawerName, button: HTMLElement): void {
    opener.current = button;
    setRequested(name);
  }

  function closeDrawer(): void {
    setRequested(null);
  }

  async function copyLink(): Promise<void> {
    const link = linkUrl(window.location.origin, store.getState().spec);
    try {
      await navigator.clipboard.writeText(link);
      setToast({ kind: "copied", at: Date.now() });
    } catch {
      // A denied or missing clipboard (I-M2-05): the link goes in a field the visitor copies.
      setToast({ kind: "blocked", link, at: Date.now() });
    }
  }

  function run(shortcut: Shortcut): void {
    const studio = store.getState();
    switch (shortcut.kind) {
      case "close-drawer":
        closeDrawer();
        return;
      case "copy-link":
        void copyLink();
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

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const target = event.target instanceof Element ? event.target : null;
    const shortcut = shortcutFor(event, target, { drawerOpen: open !== null });
    if (shortcut === null) return;
    event.preventDefault();
    run(shortcut);
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  /** The rest of the page while a drawer is open: inert (R2-16 item 2). */
  const blocked = open !== null;
  const panelState = (name: DrawerName) => ({
    "data-drawer": isDrawer[name] ? "" : undefined,
    "data-open": open === name ? "" : undefined,
    inert: isDrawer[name] ? open !== name : blocked,
    onKeyDown: open === name ? trapFocus : undefined,
  });

  return (
    <div className="studio">
      {/* biome-ignore lint/a11y/useValidAnchor: a skip link stays a link; the click focuses the canvas without writing "#canvas" over the share link in the hash. */}
      <a
        href="#canvas"
        inert={blocked}
        onClick={(event) => {
          event.preventDefault();
          canvas.current?.focus();
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-panel focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to canvas
      </a>
      <header
        inert={blocked}
        className="studio-header border-border border-b bg-page px-4 py-2.5 md:px-5"
      >
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <h1 className="sr-only">dyelot studio</h1>
          <p className="flex items-baseline gap-2 font-mono text-sm">
            <Link
              href="/"
              className="inline-flex min-h-6 items-center font-semibold text-foreground hover:underline hover:underline-offset-4"
            >
              dyelot
            </Link>
            <span aria-hidden="true" className="text-fg-muted">
              / studio
            </span>
          </p>
          <LotTag store={store} />
        </div>
        <Notices store={store} />
      </header>
      <aside
        id="studio-inputs"
        aria-label="Inputs"
        className="studio-panel studio-inputs"
        {...panelState("inputs")}
      >
        <PanelHead
          title="Inputs"
          headingRef={inputsHeading}
          closeLabel="Close inputs"
          canClose={isDrawer.inputs}
          onClose={closeDrawer}
        />
        <InputsPanel store={store} />
      </aside>
      <Toolbar
        store={store}
        inert={blocked}
        drawers={isDrawer}
        open={open}
        onOpen={openDrawer}
        onCopyLink={() => void copyLink()}
      />
      <main
        ref={canvas}
        id="canvas"
        aria-label="Canvas"
        aria-busy={busy}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the canvas region scrolls, so it takes focus for keyboard scrolling (F-KEY-11, F-CANVAS-13).
        tabIndex={0}
        data-canvas-region=""
        inert={blocked}
        className="studio-canvas p-4 md:p-6"
      >
        <CanvasFrame store={store} />
      </main>
      <aside
        id="studio-inspector"
        aria-label="Inspector"
        className="studio-panel studio-inspector"
        {...panelState("inspector")}
      >
        <PanelHead
          title="Inspector"
          headingRef={inspectorHeading}
          closeLabel="Close inspector"
          canClose={isDrawer.inspector}
          onClose={closeDrawer}
        />
      </aside>
      {open !== null && (
        <div aria-hidden="true" className="studio-backdrop" onClick={closeDrawer} />
      )}
      <Toast state={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function PanelHead({
  title,
  headingRef,
  closeLabel,
  canClose,
  onClose,
}: {
  title: string;
  headingRef: RefObject<HTMLHeadingElement | null>;
  closeLabel: string;
  canClose: boolean;
  onClose: () => void;
}) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 border-border border-b px-4">
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="font-mono text-fg-muted text-xs uppercase tracking-[0.14em]"
      >
        {title}
      </h2>
      {canClose && (
        <button
          type="button"
          aria-label={closeLabel}
          onClick={onClose}
          className="inline-flex size-8 items-center justify-center rounded-md text-fg-muted hover:bg-border hover:text-foreground"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
    </div>
  );
}
