"use client";

import { useEffect } from "react";
import { PageFrame } from "@/components/terminal/PageFrame";
import { Prompt } from "@/components/terminal/Prompt";
import { TerminalWindow } from "@/components/terminal/TerminalWindow";

// Next 16.4 passes `error` as `unknown`: a value thrown in a Client Component arrives as-is, so
// nothing here reads a property from it. `retry` re-fetches the segment; `reset` would not.
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageFrame statusLeft="dyelot ~/error">
      <TerminalWindow title="error.log" className="mx-auto my-auto w-full max-w-xl">
        <div className="space-y-3">
          <h1 className="font-mono text-xl font-semibold tracking-tight">something broke</h1>
          <Prompt kind="comment">this page failed to render. try again.</Prompt>
          <button
            type="button"
            onClick={() => retry()}
            className="inline-flex h-8 items-center font-mono text-sm text-accent-madder"
          >
            $ retry
          </button>
        </div>
      </TerminalWindow>
    </PageFrame>
  );
}
