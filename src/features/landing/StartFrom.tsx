"use client";

import { type FormEvent, useId, useRef, useState } from "react";
import { TerminalWindow } from "@/components/terminal/TerminalWindow";
import { PRIMARY_BUTTON } from "@/features/studio/chrome";
import {
  briefHref,
  briefReady,
  colorHref,
  GALLERY_HREF,
  IMAGE_HREF,
  START_BRIEF_MAX,
  START_LINES,
} from "./start";

// The landing's start-from section (docs/specs/06-gallery.md, R6-27, R6-28, 9.1): four ways into the
// studio. A submit is a full load of the studio's entry hash, so the studio reads it on its first
// load. This file imports no engine, spec or export code (C-GUARD6-05).

const LABEL = "block font-mono text-fg-muted text-xs";
const GROUP_HEADING = "font-mono text-fg-muted text-xs uppercase tracking-wide";
const NOTE = "text-fg-muted text-sm leading-snug";
const LINK =
  "inline-flex min-h-8 items-center font-mono text-foreground text-sm underline decoration-fg-muted underline-offset-4 hover:decoration-foreground";

function ColorGroup() {
  const id = useId();
  const [hex, setHex] = useState("#f66c6d");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    window.location.assign(colorHref(hex));
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <h3 className={GROUP_HEADING}>{START_LINES.color}</h3>
      <div className="flex items-center gap-3">
        <label htmlFor={id} className={LABEL}>
          {START_LINES.colorLabel}
        </label>
        <input
          id={id}
          type="color"
          value={hex}
          onChange={(event) => setHex(event.currentTarget.value)}
          className="h-8 w-12 cursor-pointer rounded-md border border-control-edge bg-page p-0.5"
        />
        <output htmlFor={id} className="font-mono text-foreground text-sm tabular-nums">
          {hex}
        </output>
      </div>
      <button type="submit" className={PRIMARY_BUTTON}>
        {START_LINES.colorSubmit}
      </button>
    </form>
  );
}

function BriefGroup() {
  const id = useId();
  const noteId = `${id}-note`;
  const counterId = `${id}-counter`;
  const [text, setText] = useState("");
  const [refused, setRefused] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!briefReady(text)) {
      setRefused(true);
      field.current?.focus();
      return;
    }
    setRefused(false);
    window.location.assign(briefHref(text));
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <h3 className={GROUP_HEADING}>{START_LINES.brief}</h3>
      <div className="space-y-1.5">
        <label htmlFor={id} className={LABEL}>
          {START_LINES.briefLabel}
        </label>
        <textarea
          ref={field}
          id={id}
          rows={3}
          maxLength={START_BRIEF_MAX}
          value={text}
          placeholder={START_LINES.briefPlaceholder}
          spellCheck
          aria-describedby={`${noteId} ${counterId}`}
          onChange={(event) => setText(event.currentTarget.value)}
          className="block w-full min-w-0 resize-y rounded-md border border-control-edge bg-page px-2 py-1.5 text-foreground text-sm leading-snug placeholder:text-fg-muted hover:border-fg-muted"
        />
        <p id={counterId} className="font-mono text-fg-muted text-xs tabular-nums">
          {text.length} of {START_BRIEF_MAX} characters
        </p>
        <p id={noteId} className={NOTE}>
          {START_LINES.briefNote}
        </p>
      </div>
      <button type="submit" className={PRIMARY_BUTTON}>
        {START_LINES.briefSubmit}
      </button>
      <p role="status" className="min-h-5 font-mono text-foreground text-sm">
        {refused ? START_LINES.briefEmpty : ""}
      </p>
    </form>
  );
}

export function StartFrom() {
  return (
    <TerminalWindow title="start-from.log">
      <section data-start-from className="space-y-5">
        <h2 className="font-mono text-foreground text-lg font-semibold">{START_LINES.heading}</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <ColorGroup />
          <BriefGroup />
          <div className="space-y-3">
            <h3 className={GROUP_HEADING}>{START_LINES.image}</h3>
            <p className={NOTE}>{START_LINES.imageNote}</p>
            <a href={IMAGE_HREF} className={LINK}>
              {START_LINES.imageLink}
            </a>
          </div>
          <div className="space-y-3">
            <h3 className={GROUP_HEADING}>{START_LINES.gallery}</h3>
            <p className={NOTE}>{START_LINES.galleryNote}</p>
            <a href={GALLERY_HREF} className={LINK}>
              {START_LINES.galleryLink}
            </a>
          </div>
        </div>
      </section>
    </TerminalWindow>
  );
}
