"use client";

import "./studio.css";
import Link from "next/link";
import { type RefObject, useEffect, useRef, useState } from "react";
import { createFitStore, FitContext } from "@/features/preview/useFrameFit";
import { CanvasArea } from "./CanvasArea";
import { createStudioClient } from "./client";
import { DraftsAnnouncer } from "./DraftsAnnouncer";
import { safeStorage } from "./drafts";
import { InputsPanel } from "./InputsPanel";
import { LotTag } from "./LotTag";
import { Notices } from "./Notices";
import { bindStudioWindow, createStudioStore, randomSeed, type StudioStore } from "./store";
import { Toast, type ToastState } from "./Toast";
import { Toolbar } from "./Toolbar";
import { linkUrl } from "./url";
import { useDrawers } from "./useDrawers";
import { useStudioKeys } from "./useStudioKeys";

// The studio page (spec section 7.1): the store, the shell, the drawers and the keyboard. The store
// is made in an effect, because its first load reads the hash and localStorage, which the server
// does not have; until then the page shows its loading state. `studio-surround` marks the page so
// studio.css drops the home page's madder crown behind it (F-A11Y-08).

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
    <div className="studio-surround grid min-h-dvh place-items-center p-4">
      <h1 className="sr-only">dyelot studio</h1>
      <p role="status" className="font-mono text-fg-muted text-sm">
        Loading the studio…
      </p>
    </div>
  );
}

function StudioShell({ store }: { store: StudioStore }) {
  const { open, isDrawer, headings, openDrawer, closeDrawer, panelState } = useDrawers();
  const canvas = useRef<HTMLElement>(null);
  const copyButton = useRef<HTMLButtonElement>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  // The canvas area measures the frame's fit and the toolbar's frame switcher shows it (M-8).
  const [fitStore] = useState(createFitStore);

  async function copyLink(): Promise<void> {
    // Where focus goes back to when the visitor closes a toast that took it (F-STUDIO-23).
    const returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const link = linkUrl(window.location.origin, store.getState().spec);
    try {
      await navigator.clipboard.writeText(link);
      setToast({ kind: "copied", at: Date.now() });
    } catch {
      // A denied or missing clipboard (I-M2-05): the link goes in a field the visitor copies. With
      // a drawer open the field waits outside it, and the live region announces it.
      setToast({ kind: "blocked", link, at: Date.now(), returnTo, takeFocus: open === null });
    }
  }

  useStudioKeys(store, {
    drawerOpen: open !== null,
    closeDrawer,
    copyLink: () => void copyLink(),
  });

  /** After a notice action removes the focused button, focus goes to the canvas (F-STUDIO-23). */
  const focusCanvas = () => canvas.current?.focus();

  /** The rest of the page while a drawer is open: inert (R2-16 item 2). */
  const blocked = open !== null;

  return (
    <FitContext value={fitStore}>
      <div className="studio studio-surround">
        {/* biome-ignore lint/a11y/useValidAnchor: a skip link stays a link; the click focuses the canvas without writing "#canvas" over the share link in the hash. */}
        <a
          href="#canvas"
          inert={blocked}
          onClick={(event) => {
            event.preventDefault();
            focusCanvas();
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
          <Notices store={store} onAction={focusCanvas} />
        </header>
        <aside
          id="studio-inputs"
          aria-label="Inputs"
          className="studio-panel studio-inputs"
          {...panelState("inputs")}
        >
          <PanelHead
            title="Inputs"
            headingRef={headings.inputs}
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
          copyButton={copyButton}
        />
        <CanvasArea store={store} regionRef={canvas} inert={blocked} />
        <aside
          id="studio-inspector"
          aria-label="Inspector"
          className="studio-panel studio-inspector"
          {...panelState("inspector")}
        >
          <PanelHead
            title="Inspector"
            headingRef={headings.inspector}
            closeLabel="Close inspector"
            canClose={isDrawer.inspector}
            onClose={closeDrawer}
          />
        </aside>
        {open !== null && (
          <div aria-hidden="true" className="studio-backdrop" onClick={closeDrawer} />
        )}
        <Toast state={toast} onClose={() => setToast(null)} fallbackFocus={copyButton} />
        <DraftsAnnouncer store={store} />
      </div>
    </FitContext>
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
    <div className="flex min-h-12 shrink-0 items-center justify-between gap-3 border-border border-b px-4">
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
