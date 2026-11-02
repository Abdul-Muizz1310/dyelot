"use client";

import "./prose.css";
import { Fragment, type MouseEvent, type ReactNode } from "react";
import type { CanvasCopy, Run } from "../copy";

// The kit's prose parts (spec section 7.6, R2-20): a link to a target inside the template, a note
// reference, and the renderer of the copy's rich text. A preview's links navigate nowhere: following
// one moves focus to its target inside the template and leaves the address bar's hash alone, so the
// studio's share link stays in it (the skip link of the shell does the same).

/** Moves focus to the element `id` names; a missing target is a bug in the template (RangeError). */
function focusTarget(event: MouseEvent<HTMLAnchorElement>, id: string, part: string): void {
  event.preventDefault();
  const target = document.getElementById(id);
  if (target === null) throw new RangeError(`${part}: no element #${id} in the template`);
  target.focus();
}

type LinkTone = "prose" | "quiet" | "sidebar" | "touch";

/** The roles a link paints with, by tone; a sidebar link takes the accent pair on hover and when current. */
function linkRoles(tone: LinkTone, current: boolean): string {
  switch (tone) {
    case "prose":
      return "primary font-body";
    case "quiet":
      return "foreground font-body";
    case "touch":
      return "primary font-body";
    case "sidebar":
      return current
        ? "sidebar-accent sidebar-accent-foreground font-body"
        : "sidebar-foreground sidebar-accent sidebar-accent-foreground font-body";
    default: {
      const unknown: never = tone;
      throw new RangeError(`TextLink: no tone ${JSON.stringify(unknown)}`);
    }
  }
}

/**
 * A link to the element `to` names inside the template. `prose` is the article's link, `primary`
 * text with an underline (F-TPL-20); `quiet` is a navigation link in the text color; `sidebar` is a
 * link of the dashboard's sidebar, on the sidebar roles, and `current` marks the page it is on; `touch`
 * is a link on a phone screen, `primary` text at least `--control-height` on each side (F-TPL-33).
 */
export function TextLink({
  to,
  tone = "prose",
  current = false,
  label,
  icon,
  children,
}: {
  to: string;
  tone?: LinkTone;
  current?: boolean;
  /** An accessible name that holds the visible text and says more. */
  label?: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <a
      href={`#${to}`}
      className="kit-link"
      data-tone={tone}
      data-roles={linkRoles(tone, current)}
      aria-label={label}
      aria-current={current ? "true" : undefined}
      onClick={(event) => focusTarget(event, to, "TextLink")}
    >
      {icon}
      {children}
    </a>
  );
}

/** The ids of a note's reference in the text and of the note itself. */
export type NoteIds = { readonly ref: string; readonly note: string };

/** A raised note number that links to its note; the note links back to `ids.ref`. */
export function NoteRef({ n, ids }: { n: number; ids: NoteIds }) {
  return (
    <sup className="kit-note-ref">
      <a
        id={ids.ref}
        href={`#${ids.note}`}
        className="kit-link kit-t-caption"
        data-tone="prose"
        data-roles="primary font-body"
        aria-label={`Note ${n}`}
        onClick={(event) => focusTarget(event, ids.note, "NoteRef")}
      >
        {n}
      </a>
    </sup>
  );
}

/**
 * The copy's rich text. A slot takes the copy's string (an amount keeps one line, `.kit-num`); a link
 * needs `link` to name its target's id and a note reference needs `note`: rich text that holds one
 * without its resolver is a bug in the template (RangeError).
 */
export function RichText({
  runs,
  copy,
  link,
  note,
}: {
  runs: readonly Run[];
  copy: CanvasCopy;
  link?: (to: string) => string;
  note?: (n: number) => NoteIds;
}) {
  const render = (run: Run): ReactNode => {
    if (typeof run === "string") return run;
    if ("code" in run) {
      return (
        <code className="kit-code" data-roles="muted foreground">
          {run.code}
        </code>
      );
    }
    if ("em" in run) return <em>{run.em}</em>;
    if ("link" in run) {
      if (link === undefined) throw new RangeError("RichText: a link needs the link resolver");
      return <TextLink to={link(run.to)}>{run.link}</TextLink>;
    }
    if ("note" in run) {
      if (note === undefined) throw new RangeError("RichText: a note needs the note resolver");
      return <NoteRef n={run.note} ids={note(run.note)} />;
    }
    if (run.slot === "amount") return <span className="kit-num">{copy.amount}</span>;
    return copy[run.slot];
  };
  return (
    <>
      {runs.map((run, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: rich text is fixed copy; its runs never move.
        <Fragment key={index}>{render(run)}</Fragment>
      ))}
    </>
  );
}
