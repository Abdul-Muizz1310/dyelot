"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { startConnect } from "@/features/ai/connect";
import { type AiModule, loadAi } from "@/features/ai/load";
import { LOAD_FAILED_LINE } from "@/features/ai/useAiAction";
import { PRIMARY_BUTTON } from "@/features/studio/chrome";

// The body of /connect (docs/specs/04-ai.md, 13.6, R4-33): what connecting the visitor's own
// OpenRouter key means, "Remember on this device" with its warning, and "Continue to OpenRouter",
// which makes the PKCE verifier, challenge and state in this browser and goes to OpenRouter's
// sign-in. The key itself never passes through dyelot (R4-29).

const PARAGRAPHS = [
  "dyelot can send its model actions through your own OpenRouter account instead of its shared quota.",
  "Your browser talks to OpenRouter directly. The key never reaches dyelot's server, its logs or its traces.",
  "dyelot asks only for free models, whose names end in :free.",
  "OpenRouter will ask you to sign in and to approve a key for dyelot.",
] as const;
const WARNING =
  "A remembered key stays in this browser until you disconnect, and anyone who uses this browser can use it. Without this, the key is gone when you close the tab.";
const NO_CRYPTO =
  "This browser cannot make a secure sign-in here. Open dyelot over HTTPS and try again.";
const NO_STORAGE =
  "This browser blocks the storage the sign-in needs. Allow site data for dyelot and try again.";

const LINK =
  "inline-flex min-h-6 items-center font-mono text-sm text-foreground underline underline-offset-4 hover:text-fg-muted";

/**
 * How long the page waits after sending the browser to OpenRouter. A page still here then did not
 * navigate (blocked, or answered 204), so the button works again (controller ruling on Task
 * 4.10a's review, round 2).
 */
const NAVIGATION_WAIT_MS = 5_000;

/** Web Crypto with the two calls the sign-in makes, or null (an insecure context has none). */
function webCrypto(): Crypto | null {
  const crypto: Crypto | undefined = globalThis.crypto;
  return crypto !== undefined &&
    typeof crypto.getRandomValues === "function" &&
    typeof crypto.subtle?.digest === "function"
    ? crypto
    : null;
}

/** Session storage, or null where the browser refuses it. */
function sessionStore(): Storage | null {
  try {
    return window.sessionStorage ?? null;
  } catch {
    return null;
  }
}

export function ConnectPanel() {
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // While a sign-in starts or its navigation is pending, a second press starts nothing: another
  // sign-in would replace the stored verifier and state, and the first callback would fail its
  // state check. The ref guards presses that come before the next render.
  const [starting, setStarting] = useState(false);
  const pending = useRef(false);
  const waiting = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxId = useId();
  const warningId = `${boxId}-warning`;

  useEffect(
    () => () => {
      if (waiting.current !== null) clearTimeout(waiting.current);
    },
    [],
  );

  function release(): void {
    pending.current = false;
    setStarting(false);
  }

  async function start(): Promise<void> {
    if (pending.current) return;
    setError(null);
    const crypto = webCrypto();
    if (crypto === null) {
      setError(NO_CRYPTO);
      return;
    }
    const session = sessionStore();
    if (session === null) {
      setError(NO_STORAGE);
      return;
    }
    pending.current = true;
    setStarting(true);
    let ai: AiModule;
    try {
      ai = await loadAi();
    } catch {
      setError(LOAD_FAILED_LINE);
      release();
      return;
    }
    let url: string;
    try {
      url = await startConnect(ai, { crypto, session, origin: window.location.origin, remember });
    } catch {
      // Web Crypto was checked above, so what refused is the storage the record needs.
      setError(NO_STORAGE);
      release();
      return;
    }
    try {
      window.location.assign(url);
    } catch {
      // The browser refused the address: nothing is on its way.
      release();
      return;
    }
    // A navigation that goes ahead unloads this page before the wait ends.
    waiting.current = setTimeout(release, NAVIGATION_WAIT_MS);
  }

  return (
    <div className="space-y-5">
      {PARAGRAPHS.map((text) => (
        <p key={text} className="text-foreground text-sm leading-relaxed">
          {text}
        </p>
      ))}
      <div className="space-y-1.5">
        <div className="flex min-h-6 items-center gap-2">
          <input
            id={boxId}
            type="checkbox"
            checked={remember}
            aria-describedby={warningId}
            onChange={(event) => setRemember(event.currentTarget.checked)}
            className="size-4 accent-current"
          />
          {/* 24 px tall: the box and its label are one target of at least 24 × 24 px (F-A11Y4-03). */}
          <label
            htmlFor={boxId}
            className="inline-flex min-h-6 items-center text-foreground text-sm"
          >
            Remember on this device
          </label>
        </div>
        <p id={warningId} className="text-fg-muted text-xs leading-relaxed">
          {WARNING}
        </p>
      </div>
      {error !== null && (
        <p role="alert" className="text-foreground text-sm">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          data-primary=""
          aria-disabled={starting ? "true" : undefined}
          onClick={() => void start()}
          className={`${PRIMARY_BUTTON} min-h-9 px-4 aria-disabled:cursor-wait aria-disabled:opacity-70`}
        >
          Continue to OpenRouter
        </button>
        <Link href="/studio" className={LINK}>
          Back to the studio
        </Link>
      </div>
    </div>
  );
}
