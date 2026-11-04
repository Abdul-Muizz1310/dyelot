"use client";

import "@/features/export/export.css";
import { useEffect, useEffectEvent, useId, useMemo, useRef, useState } from "react";
import { trapTab } from "@/features/a11y/trapTab";
import { BUTTON, PRIMARY_BUTTON } from "@/features/studio/chrome";
import { Choice, LABEL } from "@/features/studio/controls";
import type { StudioStore } from "@/features/studio/store";
import { chosenFormat, fileAccepted, type ImportFormat } from "./form";

// The import dialog (spec R3-33, R3-34, section 9.3): a modal dialog labelled by its heading, on the
// export dialog's rules: the rest of the page is inert (Studio.tsx), focus moves to the heading,
// Escape and "Cancel" shut it, and it fades over 150 ms of opacity, with no transition under reduced
// motion. `@/import` loads through `import()` when the dialog opens, never with the studio (I-M3-09);
// a failed load shows its own state with "Try again". An error keeps the dialog open with its
// message in the error region and focus on the textarea; a success closes it and hands the result to
// the studio, which calls `store.importDesign` and moves focus to the canvas.

/** How long the fade runs, with room for its last frame. */
const FADE_MS = 200;

const reducedMotion = (): boolean => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Lets the browser paint and run other tasks: a large import then never holds the page in one long task. */
const yieldToBrowser = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** Text that wraps anywhere: a long message never makes the dialog scroll sideways. */
const WRAP = "[overflow-wrap:anywhere]";

type ImportModule = typeof import("@/import");

let loading: Promise<ImportModule> | null = null;

/** The import entry, loaded once; a failed load is forgotten so that "Try again" asks the network again. */
function loadImport(): Promise<ImportModule> {
  loading ??= import("@/import").catch((error: unknown) => {
    loading = null;
    throw error;
  });
  return loading;
}

/** `@/import` once it has loaded; `failed` says the load did not work. */
function useImportModule(): { module: ImportModule | null; failed: boolean; retry(): void } {
  const [module, setModule] = useState<ImportModule | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // `attempt` only restarts the effect after a retry.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above.
  useEffect(() => {
    let live = true;
    loadImport().then(
      (loaded) => {
        if (!live) return;
        setModule(loaded);
        setFailed(false);
      },
      () => {
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [attempt]);
  return {
    module,
    failed,
    retry: () => {
      setFailed(false);
      setAttempt((count) => count + 1);
    },
  };
}

type ImportDialogProps = {
  store: StudioStore;
  open: boolean;
  onClose(): void;
  /** The import succeeded: the studio closes the dialog and moves focus to the canvas. */
  onImported(): void;
};

export function ImportDialog({ store, open, onClose, onImported }: ImportDialogProps) {
  // The dialog stays mounted while it fades out; under reduced motion it leaves at once. A dialog
  // that never opened mounts nothing, so the import code stays unloaded (I-M3-09).
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
  return <Shell store={store} open={open} onClose={onClose} onImported={onImported} />;
}

function Shell({ store, open, onClose, onImported }: ImportDialogProps) {
  const headingId = useId();
  const errorId = useId();
  const fileId = useId();
  const textId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const { module, failed, retry } = useImportModule();
  // An import runs across a few tasks: a second click waits for it, and a dialog closed meanwhile
  // (Escape, "Cancel") drops it.
  const busy = useRef(false);
  const openNow = useRef(open);
  openNow.current = open;

  const [entered, setEntered] = useState(reducedMotion);
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | undefined>(undefined);
  const [picked, setPicked] = useState<ImportFormat | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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

  // What `detectImport` finds follows the text and the file name, until the visitor picks a format.
  const detected = useMemo(
    () => (module === null ? null : module.detectImport(text, fileName)),
    [module, text, fileName],
  );
  const format = chosenFormat(picked, detected);

  function fail(reason: string): void {
    setError(reason);
    textarea.current?.focus();
  }

  async function chooseFile(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    if (file === undefined) return;
    setMessage("");
    const verdict = fileAccepted(file.name, file.size);
    if (!verdict.ok) {
      // Refused before it is read: the textarea keeps its text.
      setError(verdict.message);
      input.value = "";
      return;
    }
    let content: string;
    try {
      content = await file.text();
    } catch {
      setError("That file could not be read. Choose it again.");
      input.value = "";
      return;
    }
    input.value = "";
    setText(content);
    setFileName(file.name);
    setError("");
    setMessage(`Read ${file.name}.`);
  }

  async function run(): Promise<void> {
    if (busy.current) return;
    busy.current = true;
    try {
      await attempt();
    } finally {
      busy.current = false;
    }
  }

  async function attempt(): Promise<void> {
    setMessage("");
    let loaded = module;
    if (loaded === null) {
      try {
        loaded = await loadImport();
      } catch {
        retry();
        return;
      }
    }
    setMessage("Importing…");
    await yieldToBrowser();
    if (!openNow.current) return;
    const current = chosenFormat(picked, loaded.detectImport(text, fileName));
    if (current === null) {
      setMessage("");
      // An empty text gets the importer's own sentence; any other text needs a format first.
      const probe = text.trim() === "" ? loaded.importDesignMd(text) : null;
      fail(
        probe !== null && !probe.ok && probe.error.code === "empty"
          ? probe.error.message
          : "Choose DESIGN.md or shadcn theme CSS.",
      );
      return;
    }
    const result =
      current === "design-md" ? loaded.importDesignMd(text) : loaded.importShadcnCss(text);
    if (!result.ok) {
      setMessage("");
      fail(result.error.message);
      return;
    }
    // The importer and the studio's load run as two tasks, so neither alone is a long one.
    await yieldToBrowser();
    if (!openNow.current) return;
    try {
      store.getState().importDesign(result);
    } catch {
      setMessage("");
      fail("The studio could not open that design. Check the file, then import again.");
      return;
    }
    onImported();
  }

  const shown = open && entered;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the scrim only keeps a click from moving focus out of the dialog.
    <div
      data-import-overlay=""
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
        className="flex max-h-full w-full max-w-xl flex-col gap-4 overflow-y-auto [&>*]:shrink-0 rounded-md border border-border-bright bg-panel p-4 shadow-[var(--window-shadow)] sm:p-6"
      >
        <h2
          id={headingId}
          ref={heading}
          tabIndex={-1}
          className="font-mono text-fg-muted text-xs uppercase tracking-[0.14em]"
        >
          Import
        </h2>
        {failed ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm">The import code did not load.</p>
            <button type="button" onClick={retry} className={BUTTON}>
              Try again
            </button>
          </div>
        ) : (
          <>
            <Choice<ImportFormat | "none">
              legend="Format"
              value={format ?? "none"}
              options={[
                { value: "design-md", label: "DESIGN.md" },
                { value: "shadcn-css", label: "shadcn theme CSS" },
              ]}
              onChange={(value) => {
                if (value !== "none") setPicked(value);
              }}
            />
            <div className="space-y-1.5">
              <label htmlFor={fileId} className={LABEL}>
                Choose a file
              </label>
              <input
                id={fileId}
                type="file"
                accept=".md,.markdown,.css,.txt"
                onChange={(event) => void chooseFile(event.currentTarget)}
                className="block min-h-8 w-full min-w-0 text-foreground text-sm file:mr-3 file:min-h-8 file:cursor-pointer file:rounded-md file:border file:border-border-bright file:bg-transparent file:px-3 file:text-foreground file:text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={textId} className={LABEL}>
                Paste the text
              </label>
              <textarea
                id={textId}
                ref={textarea}
                value={text}
                rows={10}
                spellCheck={false}
                autoComplete="off"
                aria-describedby={errorId}
                aria-invalid={error !== "" ? true : undefined}
                onChange={(event) => {
                  setText(event.currentTarget.value);
                  setFileName(undefined);
                  setError("");
                  setMessage("");
                }}
                className="block max-h-72 min-h-32 w-full min-w-0 resize-y rounded-md border border-control-edge bg-page p-2 font-mono text-foreground text-xs hover:border-fg-muted"
              />
              <div id={errorId} role="alert" className={`min-h-0 text-sm ${WRAP}`}>
                {error}
              </div>
            </div>
          </>
        )}
        <div role="status" className={`min-h-5 text-sm ${WRAP}`}>
          {module === null && !failed && "Loading the import code…"}
          {message}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {!failed && (
            <button
              type="button"
              data-primary=""
              onClick={() => void run()}
              className={PRIMARY_BUTTON}
            >
              Import
            </button>
          )}
          <button type="button" onClick={onClose} className={BUTTON}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
