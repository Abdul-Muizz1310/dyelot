"use client";

import { useEffect, useId, useRef } from "react";
import { BUTTON } from "@/features/studio/chrome";
import { VIDEO_LINES } from "./video";

// The privacy note (docs/specs/05-motion-3d.md, R5-54, section 13.4): before the first render of a
// page load it stands in the render button's place and says what a render sends: a group (a
// `fieldset`, whose role is `group`) named by its heading. "Render" starts
// the render; "Cancel" closes the note with nothing sent. Its heading takes focus as it opens. The
// Brand video section holds the answer's effects; this file only shows the note.

export type PrivacyNoteProps = {
  /** "Render": the visitor agrees, and the render starts. */
  onRender(): void;
  /** "Cancel": the note closes, and nothing is sent. */
  onCancel(): void;
};

export function PrivacyNote({ onRender, onCancel }: PrivacyNoteProps) {
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);

  // The heading takes focus when the note opens (13.4).
  useEffect(() => heading.current?.focus(), []);

  return (
    <fieldset
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col gap-2 rounded-md border border-border p-3"
    >
      <h4
        id={headingId}
        ref={heading}
        tabIndex={-1}
        className="font-medium text-foreground text-sm"
      >
        Before the first render
      </h4>
      <p className="text-sm [overflow-wrap:anywhere]">
        The video is made in this browser. Remotion, the video library dyelot uses, sends one usage
        event to remotion.pro for each render, with your IP address and this site's address. It
        never sends the video or the design. dyelot cannot turn this off.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onRender} className={BUTTON}>
          Render
        </button>
        <button type="button" onClick={onCancel} className={BUTTON}>
          {VIDEO_LINES.cancel}
        </button>
      </div>
    </fieldset>
  );
}
