"use client";

import { useEffect, useRef, useState } from "react";
import { BUTTON } from "@/features/studio/chrome";

// "Copy the studio link" (docs/specs/06-gallery.md, R6-16): writes the entry's absolute studio link
// to the clipboard and says so; when the browser refuses, it shows the link in a read-only field,
// selected, as the studio's own "Copy link" does. The two sentences are this file's own literals: it
// imports nothing that reaches the engine, the spec or the export (C-GUARD6-05). The status line stays
// in the page, empty, so screen readers announce what appears in it.

const COPIED = "Copied the studio link.";
const BLOCKED = "Copy blocked. Select the link below.";

type CopyState = { readonly kind: "idle" | "copied" | "blocked" };

export function CopyLink({ link }: { link: string }) {
  const [state, setState] = useState<CopyState>({ kind: "idle" });
  const field = useRef<HTMLInputElement>(null);

  // Each refusal is a new state object, so a second press selects the link again.
  useEffect(() => {
    if (state.kind !== "blocked") return;
    field.current?.focus();
    field.current?.select();
  }, [state]);

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(link);
      setState({ kind: "copied" });
    } catch {
      // A refused write, or no clipboard at all: the link goes in the field instead.
      setState({ kind: "blocked" });
    }
  }

  return (
    <div data-copy-link="" className="space-y-2">
      <button type="button" onClick={copy} className={BUTTON}>
        Copy the studio link
      </button>
      <p role="status" className="min-h-5 text-sm">
        {state.kind === "copied" ? COPIED : state.kind === "blocked" ? BLOCKED : ""}
      </p>
      {state.kind === "blocked" && (
        <input
          ref={field}
          readOnly
          aria-label="Share link"
          value={link}
          onFocus={(event) => event.currentTarget.select()}
          className="min-h-8 w-full max-w-xl rounded-md border border-control-edge bg-page px-2 font-mono text-xs"
        />
      )}
    </div>
  );
}
