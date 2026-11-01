"use client";

import type { ReactNode } from "react";
import { type StudioStore, useStudio } from "./store";
import { bannerFor, type Notice } from "./url";

// The studio's notices (spec R2-14 item 3, I-M2-03): a failure never shows a raw error. A link
// that did not open and a change the generator refused are alerts with a way forward; the custom
// fonts and the restored draft are polite notices the visitor can dismiss.

const ACTION =
  "inline-flex min-h-8 items-center rounded-md border border-border-bright px-3 text-sm text-foreground hover:border-fg-muted";
const PRIMARY =
  "inline-flex min-h-8 items-center rounded-md bg-accent-madder px-3 font-medium text-page text-sm hover:opacity-90";

export function Notices({ store }: { store: StudioStore }) {
  const notice = useStudio(store, (studio) => studio.status.notice);
  if (notice === null) return null;
  const { startFresh, dismissNotice, revert } = store.getState();
  const dismiss = (
    <button type="button" onClick={dismissNotice} className={ACTION}>
      Dismiss
    </button>
  );
  switch (notice.kind) {
    case "link":
      return (
        <Banner role="alert" notice={notice}>
          <button type="button" data-primary="" onClick={startFresh} className={PRIMARY}>
            Start fresh
          </button>
          {dismiss}
        </Banner>
      );
    case "generation":
      return (
        <Banner role="alert" notice={notice}>
          <button type="button" data-primary="" onClick={revert} className={PRIMARY}>
            Revert
          </button>
        </Banner>
      );
    case "custom-fonts":
    case "draft-restored":
    case "copy-blocked":
      return (
        <Banner role="status" notice={notice}>
          {dismiss}
        </Banner>
      );
    default: {
      const unknown: never = notice;
      throw new Error(`unknown notice ${JSON.stringify(unknown)}`);
    }
  }
}

function Banner({
  role,
  notice,
  children,
}: {
  role: "alert" | "status";
  notice: Notice;
  children: ReactNode;
}) {
  const { message, detail } = bannerFor(notice);
  return (
    <div
      role={role}
      className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-border-bright bg-panel px-3 py-2"
    >
      <p className="min-w-0 flex-1 basis-64 text-sm">
        <span className="text-foreground">{message}</span>
        {detail !== "" && <span className="text-fg-muted"> {detail}</span>}
      </p>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}
