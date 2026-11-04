"use client";

import { useId, useState } from "react";
import { toPlainText } from "@/spec";
import { LABEL } from "./controls";
import { type StudioStore, useStudio } from "./store";

// The About section's two fields (R3-33, spec section 9.1). Each keeps its own raw text while the
// visitor types and sends the cleaned text (`toPlainText`) to the store, `undefined` when it is
// empty, under one coalesce key so a burst of typing is one history entry. The field takes the
// store's value only when that differs from the cleaned raw text: typing a trailing space never
// moves the caret, and clearing the field shows its placeholder, not "untitled".

/** The bounds of `meta.name` and `meta.oneLiner` (R3-01); the spec entry keeps its constants private. */
const NAME_MAX = 80;
const ONE_LINER_MAX = 140;

const INPUT =
  "h-9 w-full min-w-0 rounded-md border border-control-edge bg-page px-2 text-foreground text-sm placeholder:text-fg-muted hover:border-fg-muted";

export function AboutFields({ store }: { store: StudioStore }) {
  return (
    <>
      <TextField
        store={store}
        label="Name"
        field="name"
        max={NAME_MAX}
        coalesce="about-name"
        placeholder="untitled"
      />
      <TextField
        store={store}
        label="One line"
        field="oneLiner"
        max={ONE_LINER_MAX}
        coalesce="about-one-liner"
      />
    </>
  );
}

function TextField({
  store,
  label,
  field,
  max,
  coalesce,
  placeholder,
}: {
  store: StudioStore;
  label: string;
  field: "name" | "oneLiner";
  max: number;
  coalesce: string;
  placeholder?: string;
}) {
  const held = useStudio(store, (studio) => studio.params[field]);
  const [raw, setRaw] = useState(held ?? "");
  const id = useId();
  const hintId = `${id}-hint`;
  const cleaned = toPlainText(raw, max);
  // The store changed under the field (undo, a link, an import): show its value. Setting state
  // while rendering is React's pattern for state that follows a prop.
  if (held !== cleaned?.text) setRaw(held ?? "");
  const cut = cleaned?.truncated === true;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <input
        id={id}
        type="text"
        autoComplete="off"
        spellCheck={false}
        value={raw}
        placeholder={placeholder}
        aria-describedby={hintId}
        onChange={(event) => {
          const next = event.currentTarget.value;
          setRaw(next);
          store.getState().setParams({ [field]: toPlainText(next, max)?.text }, { coalesce });
        }}
        className={INPUT}
      />
      <p id={hintId} className="text-fg-muted text-xs">
        Up to {max} characters
      </p>
      {cut && (
        <p role="status" className="text-foreground text-xs">
          Cut to {max} characters.
        </p>
      )}
    </div>
  );
}
