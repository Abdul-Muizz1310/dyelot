"use client";

import { useEffect, useRef, useState } from "react";
import { type StudioStore, useStudio } from "./store";

// A polite live region that says "Drafts off" when drafts turn off during the session, a storage
// that starts refusing writes (F-STUDIO-24). It sits beside the toast, outside every region a drawer
// makes inert, so it speaks while a drawer is open. A studio that starts with drafts off says so in
// the toolbar's disclosure instead.

export function DraftsAnnouncer({ store }: { store: StudioStore }) {
  const off = useStudio(store, (studio) => studio.status.draft === "off");
  const [message, setMessage] = useState("");
  const was = useRef(off);
  useEffect(() => {
    if (off && !was.current) setMessage("Drafts off");
    if (!off) setMessage("");
    was.current = off;
  }, [off]);
  return (
    <span data-drafts-announcer="" role="status" className="sr-only">
      {message}
    </span>
  );
}
