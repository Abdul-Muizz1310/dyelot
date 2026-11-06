"use client";

import "./studio.css";
import "./highlight.css";
import Link from "next/link";
import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { createAiActivity } from "@/features/ai/activity";
import { readToggle } from "@/features/ai/on-device";
import { ExportDialog } from "@/features/export/ExportDialog";
import {
  type FlavorDialogModule,
  LOAD_FAILED_LINE,
  loadFlavorDialog,
} from "@/features/flavor/load";
import { ImportDialog } from "@/features/import/ImportDialog";
import { createFitStore, FitContext } from "@/features/preview/useFrameFit";
import { CanvasArea } from "./CanvasArea";
import { createStudioClient } from "./client";
import { DraftsAnnouncer } from "./DraftsAnnouncer";
import { safeStorage } from "./drafts";
import { InputsPanel } from "./InputsPanel";
import { Inspector } from "./Inspector";
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
  const exportButton = useRef<HTMLButtonElement>(null);
  const exportOpener = useRef<HTMLElement | null>(null);
  const importButton = useRef<HTMLButtonElement>(null);
  const importOpener = useRef<HTMLElement | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  // The Flavor dialog (R5-51): its module once loaded, whether it is open, whether its code is
  // loading, and the toolbar's line when it did not load. The privacy answer (R5-54) lasts for the
  // page load, so the studio holds it, not the dialog.
  const flavorButton = useRef<HTMLButtonElement>(null);
  const [flavorDialog, setFlavorDialog] = useState<FlavorDialogModule | null>(null);
  const [flavorOpen, setFlavorOpen] = useState(false);
  const [flavorBusy, setFlavorBusy] = useState(false);
  const [toolbarLine, setToolbarLine] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const privacy = useMemo(
    () => ({ accepted: privacyAccepted, accept: () => setPrivacyAccepted(true) }),
    [privacyAccepted],
  );
  const [toast, setToast] = useState<ToastState | null>(null);
  // The canvas area measures the frame's fit and the toolbar's frame switcher shows it (M-8).
  const [fitStore] = useState(createFitStore);
  // The one AI activity of the studio (docs/specs/04-ai.md, R4-56), with the on-device switch as
  // this browser remembers it (R4-31).
  const [activity] = useState(createAiActivity);
  useEffect(() => {
    activity.getState().setOnDevice(readToggle(safeStorage(window)));
  }, [activity]);

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

  /**
   * Opens the export dialog; `opener` is where focus returns (R3-34). With a drawer open, the drawer
   * closes first and focus returns to its toggle button, since the focused control inside it is gone.
   */
  function openExport(opener: HTMLElement | null): void {
    if (exportOpen) return;
    let returnTo = opener;
    if (open !== null) {
      returnTo = document.querySelector<HTMLElement>(`[aria-controls="studio-${open}"]`);
      closeDrawer();
    }
    exportOpener.current = returnTo;
    setExportOpen(true);
  }

  /** Opens the import dialog on the same rules as the export one (R3-34, section 9.3). */
  function openImport(opener: HTMLElement | null): void {
    if (importOpen || exportOpen) return;
    let returnTo = opener;
    if (open !== null) {
      returnTo = document.querySelector<HTMLElement>(`[aria-controls="studio-${open}"]`);
      closeDrawer();
    }
    importOpener.current = returnTo;
    setImportOpen(true);
  }

  /**
   * Opens the Flavor dialog, loading its code on the first press (R5-51). A failed load says so in
   * the toolbar's status line and is forgotten, so the next press tries again.
   */
  function openFlavor(): void {
    if (flavorOpen || exportOpen || importOpen || flavorBusy) return;
    setToolbarLine("");
    if (flavorDialog !== null) {
      setFlavorOpen(true);
      return;
    }
    setFlavorBusy(true);
    loadFlavorDialog().then(
      (module) => {
        setFlavorBusy(false);
        setFlavorDialog(module);
        setFlavorOpen(true);
      },
      () => {
        setFlavorBusy(false);
        setToolbarLine(LOAD_FAILED_LINE);
      },
    );
  }

  // Closing the Flavor dialog gives focus back to "Flavor", once the page is no longer inert.
  const wasFlavorOpen = useRef(false);
  useEffect(() => {
    if (wasFlavorOpen.current && !flavorOpen) flavorButton.current?.focus();
    wasFlavorOpen.current = flavorOpen;
  }, [flavorOpen]);

  // A successful import sends focus to the canvas region, not back to "Import…" (section 9.3).
  const focusAfterImport = useRef(false);
  const wasImportOpen = useRef(false);
  useEffect(() => {
    if (wasImportOpen.current && !importOpen) {
      if (focusAfterImport.current) {
        canvas.current?.focus();
      } else {
        const opener = importOpener.current;
        const target = opener?.isConnected === true && opener !== document.body ? opener : null;
        (target ?? importButton.current)?.focus();
      }
      focusAfterImport.current = false;
    }
    wasImportOpen.current = importOpen;
  }, [importOpen]);

  // Closing gives focus back to the element that opened the dialog, once the page is no longer inert.
  const wasExportOpen = useRef(false);
  useEffect(() => {
    if (wasExportOpen.current && !exportOpen) {
      const opener = exportOpener.current;
      const target = opener?.isConnected === true && opener !== document.body ? opener : null;
      (target ?? exportButton.current)?.focus();
    }
    wasExportOpen.current = exportOpen;
  }, [exportOpen]);

  // "Fix in the inspector" and "Show the findings" (R3-42): the dialog closes and focus goes to the
  // Findings heading, in the open inspector drawer below 1280 px.
  const wantFindings = useRef(false);
  function showFindings(): void {
    wantFindings.current = true;
    setExportOpen(false);
    const button = exportButton.current;
    if (isDrawer.inspector && button !== null) openDrawer("inspector", button);
  }
  // After the dialog's own focus return above, so the heading is the last to take focus.
  useEffect(() => {
    if (!wantFindings.current || exportOpen) return;
    if (isDrawer.inspector && open !== "inspector") return;
    wantFindings.current = false;
    const heading = [...document.querySelectorAll<HTMLElement>("#studio-inspector h3")].find(
      (each) => each.textContent === "Findings",
    );
    heading?.focus();
  }, [exportOpen, open, isDrawer.inspector]);

  useStudioKeys(store, {
    drawerOpen: open !== null,
    dialogOpen: exportOpen || importOpen || flavorOpen,
    closeDrawer,
    copyLink: () => void copyLink(),
    openExport: () =>
      openExport(document.activeElement instanceof HTMLElement ? document.activeElement : null),
  });

  /** After a notice action removes the focused button, focus goes to the canvas (F-STUDIO-23). */
  const focusCanvas = () => canvas.current?.focus();

  /** Whether a modal dialog is open: export, import or Flavor. */
  const dialogOpen = exportOpen || importOpen || flavorOpen;
  /** The rest of the page while a drawer or a dialog is open: inert (R2-16 item 2, R3-34, R5-51). */
  const blocked = open !== null || dialogOpen;
  /** A panel's state, inert too while a dialog is open. */
  const panel = (name: "inputs" | "inspector") => {
    const state = panelState(name);
    return { ...state, inert: state.inert || dialogOpen };
  };

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
          {...panel("inputs")}
        >
          <PanelHead
            title="Inputs"
            headingRef={headings.inputs}
            closeLabel="Close inputs"
            canClose={isDrawer.inputs}
            onClose={closeDrawer}
          />
          <InputsPanel
            store={store}
            activity={activity}
            importButton={importButton}
            onImport={(opener) => openImport(opener)}
          />
        </aside>
        <Toolbar
          store={store}
          inert={blocked}
          drawers={isDrawer}
          open={open}
          onOpen={openDrawer}
          onCopyLink={() => void copyLink()}
          onExport={openExport}
          copyButton={copyButton}
          exportButton={exportButton}
          onFlavor={openFlavor}
          flavorButton={flavorButton}
          flavorBusy={flavorBusy}
          status={toolbarLine}
        />
        <CanvasArea store={store} regionRef={canvas} inert={blocked} />
        <aside
          id="studio-inspector"
          aria-label="Inspector"
          className="studio-panel studio-inspector"
          {...panel("inspector")}
        >
          <PanelHead
            title="Inspector"
            headingRef={headings.inspector}
            closeLabel="Close inspector"
            canClose={isDrawer.inspector}
            onClose={closeDrawer}
          />
          <Inspector
            store={store}
            activity={activity}
            onCanvasShown={() => {
              // A drawer covers the canvas: it closes so the outline shows (section 7.8).
              if (open === "inspector") closeDrawer();
            }}
          />
        </aside>
        {open !== null && (
          <div aria-hidden="true" className="studio-backdrop" onClick={closeDrawer} />
        )}
        <ExportDialog
          store={store}
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          onShowFindings={showFindings}
        />
        <ImportDialog
          store={store}
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onImported={() => {
            focusAfterImport.current = true;
            setImportOpen(false);
          }}
        />
        {flavorDialog !== null && flavorOpen && (
          <flavorDialog.FlavorDialog
            store={store}
            onClose={() => setFlavorOpen(false)}
            privacy={privacy}
          />
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
