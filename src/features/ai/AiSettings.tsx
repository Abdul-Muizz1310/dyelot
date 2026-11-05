"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useStore } from "zustand";
import type { AiActivity, SharedQuota } from "@/features/ai/activity";
import { saveReturn } from "@/features/ai/connect";
import {
  downloadModel,
  type OnDeviceState,
  onDeviceState,
  writeToggle,
} from "@/features/ai/on-device";
import { browserStores } from "@/features/ai/steps";
import { clearKey, readKey } from "@/features/ai/visitor-key";
import { BUTTON } from "@/features/studio/chrome";
import { ChromeSwitch } from "@/features/studio/controls";
import type { StudioStore } from "@/features/studio/store";

// The disclosure "AI settings" of the Brief section (docs/specs/04-ai.md, R4-54, 13.2, 10.2): the
// on-device switch and its status (only where the Prompt API is present), the visitor key's line
// with "Connect your OpenRouter key" or "Disconnect", and the shared quota's line. The model's state
// and the key are read each time the settings open; the switch is remembered per browser
// (R4-31) and held in the activity, where the router reads it.

const SWITCH_LABEL = "Use Chrome's built-in model (experimental)";
/** 10.2's status text per state; `downloading` writes its percentage. */
const STATUS: Readonly<Record<Exclude<OnDeviceState, "absent" | "downloading">, string>> = {
  unavailable: "Not available on this device.",
  downloadable: "Needs a one-time download from Chrome.",
  available: "Ready on this device.",
};
const DOWNLOAD_FAILED = "The download did not finish. Try again later.";
const downloadingLine = (fraction: number) =>
  `Downloading the model: ${Math.round(fraction * 100)}%.`;

const NO_KEY = "No OpenRouter key connected.";
const KEY_FOR_TAB = "Your OpenRouter key is connected for this tab.";
const KEY_REMEMBERED = "Your OpenRouter key is remembered on this device.";
const DISCONNECTED = "Disconnected. The key is gone from this browser.";

/** 13.2's shared line, from the last reply that told it. */
function sharedLine(shared: SharedQuota): string {
  if (shared.off) return "Shared AI: off here.";
  if (shared.remaining === null) return "Shared AI: 3 actions a day.";
  return `Shared AI: ${shared.remaining} of 3 left today.`;
}

/** `globalThis.LanguageModel`, or undefined where the Prompt API is absent (R4-31). */
const languageModel = (): unknown => (globalThis as { LanguageModel?: unknown }).LanguageModel;

/** The key as AI settings show it: none, after a disconnect, or stored for the tab or remembered. */
type KeyState = "none" | "disconnected" | "tab" | "remembered";

function readKeyState(): KeyState {
  const stored = readKey(browserStores());
  if (stored === null) return "none";
  return stored.remembered ? "remembered" : "tab";
}

export function AiSettings({ store, activity }: { store: StudioStore; activity: AiActivity }) {
  const [open, setOpen] = useState(false);
  const buttonId = useId();
  const regionId = useId();
  return (
    <div className="space-y-3">
      <button
        type="button"
        id={buttonId}
        aria-expanded={open}
        aria-controls={regionId}
        onClick={() => setOpen((was) => !was)}
        className={`${BUTTON} w-fit`}
      >
        AI settings
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <section
        id={regionId}
        aria-labelledby={buttonId}
        hidden={!open}
        className="space-y-4 rounded-md border border-border px-3 py-3 text-xs"
      >
        {open && <Settings store={store} activity={activity} />}
      </section>
    </div>
  );
}

/** The settings' three parts, mounted while the disclosure is open so each opening reads afresh. */
function Settings({ store, activity }: { store: StudioStore; activity: AiActivity }) {
  const shared = useStore(activity, (state) => state.shared);
  return (
    <>
      <OnDevicePart activity={activity} />
      <KeyPart store={store} />
      <p className="text-foreground">{sharedLine(shared)}</p>
    </>
  );
}

function OnDevicePart({ activity }: { activity: AiActivity }) {
  const on = useStore(activity, (state) => state.onDevice);
  const [state, setState] = useState<OnDeviceState | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const statusId = useId();
  /** The switch's row; ChromeSwitch takes no ref, so focus finds the switch inside it. */
  const switchRow = useRef<HTMLDivElement | null>(null);
  const downloadRef = useRef<HTMLButtonElement | null>(null);
  const toSwitch = useRef(false);

  useEffect(() => {
    let live = true;
    void onDeviceState(languageModel()).then((read) => {
      if (live) setState(read);
    });
    return () => {
      live = false;
    };
  }, []);

  // "Download the model" goes away once the model is there: focus moves to the switch before it.
  useEffect(() => {
    if (!toSwitch.current || state === null) return;
    toSwitch.current = false;
    switchRow.current?.querySelector<HTMLElement>('[role="switch"]')?.focus();
  }, [state]);

  if (state === null || state === "absent") return null;
  const downloading = progress !== null;
  const status = downloading
    ? downloadingLine(progress)
    : state === "downloading"
      ? downloadingLine(0)
      : failed
        ? DOWNLOAD_FAILED
        : STATUS[state];

  async function download(): Promise<void> {
    if (progress !== null) return;
    setFailed(false);
    setProgress(0);
    const done = await downloadModel(languageModel(), {
      onProgress: setProgress,
      signal: new AbortController().signal,
    });
    const read = await onDeviceState(languageModel());
    // The button stays only while the model still asks for a download.
    toSwitch.current = read !== "downloadable" && document.activeElement === downloadRef.current;
    setProgress(null);
    setFailed(!done);
    setState(read);
  }

  return (
    <div className="space-y-2">
      <div ref={switchRow}>
        <ChromeSwitch
          label={SWITCH_LABEL}
          checked={on}
          describedBy={statusId}
          unavailable={state === "unavailable"}
          onToggle={() => {
            const next = !on;
            writeToggle(browserStores().local, next);
            activity.getState().setOnDevice(next);
          }}
          className="inline-flex min-h-6 items-center gap-2 text-left text-foreground text-xs aria-disabled:cursor-not-allowed aria-disabled:text-fg-muted"
        />
      </div>
      <p id={statusId} className="text-fg-muted">
        {status}
      </p>
      {(state === "downloadable" || downloading) && (
        <button
          type="button"
          ref={downloadRef}
          aria-disabled={downloading ? "true" : undefined}
          aria-describedby={downloading ? statusId : undefined}
          onClick={() => void download()}
          className={`${BUTTON} w-fit`}
        >
          Download the model
        </button>
      )}
    </div>
  );
}

function KeyPart({ store }: { store: StudioStore }) {
  const [key, setKey] = useState<KeyState>(readKeyState);
  const linkRef = useRef<HTMLAnchorElement | null>(null);
  const toLink = useRef(false);

  // After "Disconnect" goes away, focus moves to the link that takes its place.
  useEffect(() => {
    if (key !== "disconnected" || !toLink.current) return;
    toLink.current = false;
    linkRef.current?.focus();
  }, [key]);

  const connected = key === "tab" || key === "remembered";
  const line =
    key === "tab"
      ? KEY_FOR_TAB
      : key === "remembered"
        ? KEY_REMEMBERED
        : key === "disconnected"
          ? DISCONNECTED
          : NO_KEY;
  return (
    <div className="space-y-2">
      <p role="status" className="text-foreground">
        {line}
      </p>
      {connected ? (
        <button
          type="button"
          onClick={(event) => {
            toLink.current = document.activeElement === event.currentTarget;
            clearKey(browserStores());
            setKey("disconnected");
          }}
          className={`${BUTTON} w-fit`}
        >
          Disconnect
        </button>
      ) : (
        <Link
          href="/connect"
          ref={linkRef}
          onClick={() => {
            // The sign-in returns to this design (R4-33): the hash is written now, then saved.
            store.getState().flush();
            saveReturn(browserStores().session, window.location.hash);
          }}
          className="inline-flex min-h-6 items-center text-foreground underline underline-offset-4 hover:text-fg-muted"
        >
          Connect your OpenRouter key
        </Link>
      )}
    </div>
  );
}
