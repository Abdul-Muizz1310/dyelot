"use client";

import "./export.css";
import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import type { Bundle } from "@/export";
import { trapTab } from "@/features/a11y/trapTab";
import { BUTTON, PRIMARY_BUTTON, TOGGLE_BUTTON, TOOL_BUTTON } from "@/features/studio/chrome";
import { type StudioStore, useStudio } from "@/features/studio/store";
import { downloadBlob } from "./download";
import {
  blockReason,
  type ExportState,
  exportState,
  failingChecks,
  formatBytes,
  summaryLines,
} from "./files";
import { useBundle } from "./useBundle";

// The export dialog (spec R3-34, R3-40, section 9.2): a modal dialog labelled by its heading. The
// rest of the page is inert (Studio.tsx), focus moves to the heading, Escape and "Close" shut it, and it
// fades over 150 ms of opacity, with no transition under reduced motion. A ready dialog lists the
// bundle's files with a preview and a Copy button each, and offers the zip. A design that fails a
// required check shows no file text and offers no action (I-M3-04): its blocked state (R3-42, section
// 9.2) says why, lists the failing checks and points to the inspector.

/** How long the fade runs, with room for its last frame. */
const FADE_MS = 200;
/** How long a copied file's button reads "Copied". */
const COPIED_MS = 2000;
const COPY_BLOCKED = "Copy is blocked here. The text is selected: press Ctrl+C or ⌘C.";

const reducedMotion = (): boolean => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Text that wraps anywhere: a long path or name never makes the dialog scroll sideways. */
const WRAP = "[overflow-wrap:anywhere]";

type ExportDialogProps = {
  store: StudioStore;
  open: boolean;
  onClose(): void;
  /** "Fix in the inspector" and "Show the findings": the studio closes the dialog and shows the Findings section. */
  onShowFindings(): void;
};

export function ExportDialog({ store, open, onClose, onShowFindings }: ExportDialogProps) {
  // The dialog stays mounted while it fades out; under reduced motion it leaves at once. A dialog
  // that never opened mounts nothing, so the export code stays unloaded (I-M3-09).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const timer = setTimeout(() => setMounted(false), FADE_MS);
    return () => clearTimeout(timer);
  }, [open]);
  if (!open && (!mounted || reducedMotion())) return null;
  return <Shell store={store} open={open} onClose={onClose} onShowFindings={onShowFindings} />;
}

function Shell({ store, open, onClose, onShowFindings }: ExportDialogProps) {
  const spec = useStudio(store, (studio) => studio.spec);
  const generating = useStudio(store, (studio) => studio.status.phase === "generating");
  const provenance = useStudio(store, (studio) => studio.provenance);
  const outcome = useStudio(store, (studio) => studio.outcome);
  const reasonId = useId();
  const bundle = useBundle(spec, generating);
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const preview = useRef<HTMLPreElement>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [entered, setEntered] = useState(reducedMotion);
  const [selected, setSelected] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  // Counts the copies that found no clipboard: each one selects the preview's text again.
  const [selectAsked, setSelectAsked] = useState(0);

  // The fade needs a first frame at opacity 0: the scrim shows a frame after it mounts.
  useEffect(() => {
    if (entered) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [entered]);

  // Focus goes to the heading when the dialog opens (R3-34).
  useEffect(() => heading.current?.focus(), []);
  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  const close = useEffectEvent(onClose);
  // Escape and the Tab trap listen on the window, so they hold when a click on the dialog's text
  // has moved focus to the dialog itself. While the dialog is open, `shortcutFor` leaves both to it.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      } else if (panel.current !== null) {
        trapTab(event, panel.current);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // A rebuilt bundle starts over: the first file shows, and no copy or download of the old design is
  // announced for the new one.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `bundle.bundle` is the trigger.
  useEffect(() => {
    setSelected(0);
    setCopied(null);
    setMessage("");
  }, [bundle.bundle]);

  const files = bundle.bundle?.files ?? [];
  const passing = bundle.bundle !== undefined && bundle.bundle.summary.lint.error === 0;
  const file = files[selected] ?? files[0];

  // A copy that found no clipboard selects the file's text in the preview, once that file shows.
  useEffect(() => {
    const element = preview.current;
    if (selectAsked === 0 || element === null) return;
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    element.focus({ preventScroll: true });
  }, [selectAsked]);

  async function copy(index: number): Promise<void> {
    const chosen = files[index];
    if (chosen === undefined || !passing) return;
    clearTimeout(copiedTimer.current);
    try {
      await navigator.clipboard.writeText(chosen.text);
    } catch {
      // A missing or refusing clipboard (R3-40, I-M2-05): the text is selected for the visitor.
      setCopied(null);
      setSelected(index);
      setSelectAsked((count) => count + 1);
      setMessage(COPY_BLOCKED);
      return;
    }
    setCopied(chosen.path);
    setMessage(`Copied ${chosen.path}.`);
    copiedTimer.current = setTimeout(() => setCopied(null), COPIED_MS);
  }

  function download(): void {
    if (!passing || bundle.zip === undefined || bundle.zipName === undefined) return;
    downloadBlob(bundle.zipName, bundle.zip);
    setMessage(`Downloaded ${bundle.zipName}.`);
  }

  const shown = open && entered;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the scrim only keeps a click from moving focus out of the dialog.
    <div
      data-export-overlay=""
      data-shown={shown ? "" : undefined}
      data-closing={open ? undefined : ""}
      inert={!open}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) event.preventDefault();
      }}
      className="export-overlay fixed inset-0 z-40 grid place-items-center bg-black/60 p-3 sm:p-6"
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        className="flex max-h-full w-full max-w-3xl flex-col gap-4 overflow-y-auto [&>*]:shrink-0 rounded-md border border-border-bright bg-panel p-4 shadow-[var(--window-shadow)] sm:p-6"
      >
        <h2
          id={headingId}
          ref={heading}
          tabIndex={-1}
          className="font-mono text-fg-muted text-xs uppercase tracking-[0.14em]"
        >
          Export
        </h2>
        {bundle.state === "ready" && bundle.bundle !== undefined && (
          <>
            <p data-export-lot="" className={`font-mono text-sm ${WRAP}`}>
              LOT {bundle.bundle.lot} · {spec.meta.name}
            </p>
            <ul aria-label="Summary" className="space-y-1 text-sm">
              {summaryLines(bundle.bundle.summary).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </>
        )}
        {passing && file !== undefined && bundle.zip !== undefined && (
          <>
            <ul aria-label="Files" className="border-border border-t text-sm">
              {files.map((each, index) => (
                <li
                  key={each.path}
                  className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 border-border border-b py-1"
                >
                  <button
                    type="button"
                    aria-pressed={index === selected}
                    aria-label={`Preview ${each.path}`}
                    onClick={() => setSelected(index)}
                    className={`${TOGGLE_BUTTON} min-w-0 flex-1 justify-start whitespace-normal py-1 text-left font-mono ${WRAP}`}
                  >
                    {each.path}
                  </button>
                  <span className="font-mono text-fg-muted text-xs tabular-nums">
                    {formatBytes(new TextEncoder().encode(each.text).length)}
                  </span>
                  <button
                    type="button"
                    aria-label={`Copy ${each.path}`}
                    onClick={() => void copy(index)}
                    className={`${TOOL_BUTTON} min-w-16 justify-center`}
                  >
                    {copied === each.path ? "Copied" : "Copy"}
                  </button>
                </li>
              ))}
            </ul>
            {/* biome-ignore lint/a11y/useSemanticElements: the labelled preview is a `pre`, which keeps its text exact; the region role names it. */}
            <pre
              ref={preview}
              role="region"
              aria-label={`Preview of ${file.path}`}
              // biome-ignore lint/a11y/noNoninteractiveTabindex: the preview scrolls, so it takes focus for keyboard scrolling (F-A11Y3-04).
              tabIndex={0}
              className={`max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-control-edge bg-page p-3 font-mono text-xs ${WRAP}`}
            >
              {file.text}
              {/* Chromium leaves a block's last newline out of a selection's text; the break keeps
                  it, so selecting the preview and copying gives the file exactly (F-EXP-07). */}
              {file.text.endsWith("\n") && <br />}
            </pre>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <button
                type="button"
                data-primary=""
                onClick={download}
                className={`${PRIMARY_BUTTON} whitespace-normal py-1 text-left ${WRAP}`}
              >
                Download {bundle.zipName}
              </button>
              <span className="font-mono text-fg-muted text-xs tabular-nums">
                {formatBytes(bundle.zip.length)}
              </span>
            </div>
          </>
        )}
        {bundle.state === "ready" && bundle.bundle !== undefined && !passing && (
          <Blocked
            bundle={bundle.bundle}
            bundleZipName={bundle.zipName}
            state={exportState(bundle.bundle.summary, provenance, outcome ?? undefined)}
            reasonId={reasonId}
            onShowFindings={onShowFindings}
          />
        )}
        {bundle.state === "failed" && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm">The export code did not load.</p>
            <button type="button" onClick={bundle.retry} className={BUTTON}>
              Try again
            </button>
          </div>
        )}
        <div role="status" className={`min-h-5 text-sm ${WRAP}`}>
          {bundle.state === "loading" && "Building the bundle…"}
          {bundle.state === "waiting" && "Waiting for the design to finish generating…"}
          {bundle.state === "ready" && message}
        </div>
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className={BUTTON}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * What a blocked dialog shows below its summary (R3-42, section 9.2): the state's sentence, the failing
 * checks, the file paths without sizes or text, "Download" and every "Copy" off (`aria-disabled`, kept
 * focusable and described by the sentence), and the way to the Findings section. Nothing here starts a
 * download or writes the clipboard (I-M3-04).
 */
function Blocked({
  bundle,
  bundleZipName,
  state,
  reasonId,
  onShowFindings,
}: {
  bundle: Bundle;
  bundleZipName: string | undefined;
  state: ExportState;
  reasonId: string;
  onShowFindings(): void;
}) {
  if (state === "passing") return null;
  const checks = failingChecks(bundle.receipt.findings);
  return (
    <>
      <p id={reasonId} className={`text-sm ${WRAP}`}>
        {blockReason(state, bundle.summary.lint.error)}
      </p>
      <ul aria-label="Failing checks" className="space-y-1 font-mono text-xs">
        {checks.map((row, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: two findings can read alike; the rows never reorder.
          <li key={index} className={WRAP}>
            {row}
          </li>
        ))}
      </ul>
      <ul aria-label="Files" className="border-border border-t text-sm">
        {bundle.files.map((each) => (
          <li
            key={each.path}
            className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 border-border border-b py-1"
          >
            <span className={`min-w-0 flex-1 font-mono ${WRAP}`}>{each.path}</span>
            <button
              type="button"
              aria-disabled="true"
              aria-describedby={reasonId}
              aria-label={`Copy ${each.path}`}
              className={`${TOOL_BUTTON} min-w-16 justify-center`}
            >
              Copy
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          type="button"
          aria-disabled="true"
          aria-describedby={reasonId}
          className={`${PRIMARY_BUTTON} whitespace-normal py-1 text-left ${WRAP}`}
        >
          Download {bundleZipName}
        </button>
        <button type="button" onClick={onShowFindings} className={BUTTON}>
          {state === "fixable" ? "Fix in the inspector" : "Show the findings"}
        </button>
      </div>
    </>
  );
}
