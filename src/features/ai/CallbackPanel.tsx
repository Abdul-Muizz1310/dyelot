"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CONNECT_STORAGE, type ConnectResult, finishConnect } from "@/features/ai/connect";
import { type AiModule, loadAi } from "@/features/ai/load";
import { browserStores } from "@/features/ai/steps";
import type { StorageLike } from "@/features/studio/drafts";

// The body of /connect/callback (docs/specs/04-ai.md, 13.6, R4-33, 10.4): it takes the code and the
// state out of the address bar first, so they are never shown, bookmarked or sent on, then finishes
// the sign-in in this browser and returns to the studio with the design the visitor left from. A
// failure says which, in an alert, with "Start again" and "Back to the studio". On success it says
// so, and leaves only once that line is on screen.

const CHECKING = "Checking the sign-in…";
const CONNECTED = "Connected. Returning to the studio…";
/**
 * 13.6's line when the AI layer cannot load here. The code has already left the address bar, so a
 * reload cannot finish this sign-in: the visitor starts again (controller ruling on Task 4.10a's
 * review).
 */
const LOAD_FAILED = "This page could not finish the sign-in. Start again from Connect.";
/** 13.6's sentence for each way the sign-in can fail. */
const FAILURES: Readonly<Record<Extract<ConnectResult, { ok: false }>["reason"], string>> = {
  "not-started":
    "This sign-in did not start here, so dyelot did not use it. Start again from Connect.",
  "state-mismatch":
    "This sign-in does not match the one dyelot started, so dyelot did not use it. Start again from Connect.",
  denied: "OpenRouter did not return a key. You can start again, or keep using dyelot without one.",
  "exchange-failed": "OpenRouter did not accept the sign-in. Start again from Connect.",
  "storage-refused":
    "This browser would not keep the key. Allow this site to store data, or connect without Remember on this device.",
};

/**
 * Session storage that holds nothing, for a browser that refuses the real one: no sign-in can
 * have started in it, so a code finds no record (10.4's `not-started`).
 */
const NO_SESSION: StorageLike = {
  getItem: () => null,
  setItem: () => {
    throw new DOMException("This browser gives no session storage.", "SecurityError");
  },
  removeItem: () => {},
};

const LINK =
  "inline-flex min-h-6 items-center font-mono text-sm text-foreground underline underline-offset-4 hover:text-fg-muted";

type Outcome =
  | { readonly kind: "checking" }
  | { readonly kind: "connected"; readonly returnTo: string }
  | { readonly kind: "failed"; readonly message: string };

export function CallbackPanel() {
  const [outcome, setOutcome] = useState<Outcome>({ kind: "checking" });
  // The sign-in finishes once per page, even where an effect runs twice in development.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const search = window.location.search;
    window.history.replaceState(null, "", window.location.pathname);
    void (async () => {
      let ai: AiModule;
      const { session, local } = browserStores();
      try {
        ai = await loadAi();
      } catch {
        // This sign-in cannot finish, so its record goes, as on every other outcome (10.4).
        try {
          session?.removeItem(CONNECT_STORAGE);
        } catch {
          // A storage that refuses holds nothing this tab can use again.
        }
        setOutcome({ kind: "failed", message: LOAD_FAILED });
        return;
      }
      const result = await finishConnect(ai, {
        search,
        stores: { session: session ?? NO_SESSION, local },
        fetch: (input, init) => globalThis.fetch(input, init),
      });
      if (result.ok) {
        setOutcome({ kind: "connected", returnTo: result.returnTo });
      } else {
        setOutcome({ kind: "failed", message: FAILURES[result.reason] });
      }
    })();
  }, []);

  // The studio opens once "Connected. Returning to the studio…" is on screen.
  useEffect(() => {
    if (outcome.kind === "connected") window.location.replace(outcome.returnTo);
  }, [outcome]);

  if (outcome.kind !== "failed") {
    return (
      <p role="status" className="text-foreground text-sm">
        {outcome.kind === "checking" ? CHECKING : CONNECTED}
      </p>
    );
  }
  return (
    <div role="alert" className="space-y-4">
      <p className="text-foreground text-sm leading-relaxed">{outcome.message}</p>
      <p className="flex flex-wrap gap-4">
        <Link href="/connect" className={LINK}>
          Start again
        </Link>
        <Link href="/studio" className={LINK}>
          Back to the studio
        </Link>
      </p>
    </div>
  );
}
