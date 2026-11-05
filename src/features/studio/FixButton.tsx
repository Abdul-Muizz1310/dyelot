import type { ContrastLevel } from "@/engine";
import { TOOL_BUTTON } from "./chrome";

// A finding's fix (spec R2-10, section 7.8): the button "Raise contrast to <level>", described by its
// note "Regenerates every color at <level>.". The finding's card and the critique's explanation
// (docs/specs/04-ai.md, 13.5: "the finding's existing fix button") both show it, each placing the
// note where its layout wants it.

export function FixButton({
  level,
  noteId,
  onClick,
}: {
  /** The level `fixFor` raises the design to. */
  level: ContrastLevel;
  /** The id of the `FixNote` that describes the button. */
  noteId: string;
  onClick(): void;
}) {
  return (
    <button type="button" aria-describedby={noteId} onClick={onClick} className={TOOL_BUTTON}>
      Raise contrast to {level}
    </button>
  );
}

export function FixNote({ id, level }: { id: string; level: ContrastLevel }) {
  return (
    <p id={id} className="text-[11px] text-fg-muted">
      Regenerates every color at {level}.
    </p>
  );
}
