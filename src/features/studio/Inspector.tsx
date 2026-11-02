"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { type Finding, lintSpec, PRESETS, type Preset } from "@/engine";
import type { DesignSpec } from "@/spec";
import { Findings } from "./Findings";
import { fixFor } from "./fixes";
import {
  type FixRequest,
  findingKey,
  fixOutcome,
  fontNote,
  roleRows,
  showMe,
  showMeMode,
} from "./inspect";
import { NamesSection } from "./Names";
import { PanelSection } from "./PanelSection";
import { RoleTable } from "./RoleTable";
import { Scales } from "./Scales";
import { type StudioStore, useStudio } from "./store";
import { useFontFailures } from "./useFontFailures";

// The inspector (spec section 7.8): a font-status message, then Scales, Roles, Names, Findings and
// Preset notes, in a body that scrolls inside the column or the drawer and takes focus so the keyboard
// scrolls it (`data-scroll-area`, R2-15 item 2). It holds two bits of state of its own: which finding's
// "Show me" is pressed, and a fix on its way. The highlight itself is the view's (`view.highlight`),
// which the canvas region and the scales read; the rest comes from the store and `inspect.ts`. The body
// is positioned, so its visually hidden labels stay inside its scroll box and never lengthen the page.

type PendingFix = { readonly fix: FixRequest; readonly before: DesignSpec };

export function Inspector({
  store,
  onCanvasShown,
}: {
  store: StudioStore;
  /** Called when "Show me" outlines parts of the canvas: a drawer gets out of the way (section 7.8). */
  onCanvasShown(): void;
}) {
  const spec = useStudio(store, (studio) => studio.spec);
  const params = useStudio(store, (studio) => studio.params);
  const preset = useStudio(store, (studio) => studio.preset);
  const mode = useStudio(store, (studio) => studio.view.mode);
  const cells = useStudio(store, (studio) => studio.view.highlight?.cells);
  const findings = useMemo(() => lintSpec(spec), [spec]);
  const rows = useMemo(() => roleRows(spec), [spec]);
  const failures = useFontFailures(spec.type.families);
  const area = useRef<HTMLElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingFix | null>(null);
  const [kept, setKept] = useState<{ key: string; spec: DesignSpec } | null>(null);

  // A finding that leaves the list takes its highlight with it, before the canvas paints again.
  useLayoutEffect(() => {
    if (selected === null || findings.some((finding) => findingKey(finding) === selected)) return;
    setSelected(null);
    store.getState().setView({ highlight: null });
  }, [selected, findings, store]);

  // A fix's outcome, once a new spec has committed (R2-10, C-INSPECT-17).
  useEffect(() => {
    if (pending === null || spec === pending.before) return;
    setPending(null);
    if (fixOutcome(pending.fix, spec, findings) === "kept") setKept({ key: pending.fix.key, spec });
  }, [pending, spec, findings]);

  // A step finding's cells scroll into view inside the inspector (F-INSP-07).
  useEffect(() => {
    if (selected === null) return;
    const cell = area.current?.querySelector("[data-show-me-cell]");
    if (!(cell instanceof HTMLElement)) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    cell.scrollIntoView({ block: "center", behavior: still ? "auto" : "smooth" });
  }, [selected]);

  function toggleShowMe(finding: Finding): void {
    const key = findingKey(finding);
    const { setView } = store.getState();
    if (selected === key) {
      setSelected(null);
      setView({ highlight: null });
      return;
    }
    const highlight = showMe(finding);
    const shown = showMeMode(finding);
    setSelected(key);
    setView(shown === null ? { highlight } : { highlight, mode: shown });
    if (highlight.roles.length > 0) onCanvasShown();
  }

  function fix(finding: Finding): void {
    const patch = fixFor(finding, params);
    const level = patch?.contrastLevel;
    if (patch === null || level === undefined) return;
    setPending({ fix: { key: findingKey(finding), level }, before: spec });
    store.getState().setParams(patch);
  }

  const notes = preset === null ? null : presetNotes(PRESETS[preset]);
  return (
    <section
      ref={area}
      data-scroll-area=""
      // biome-ignore lint/a11y/noNoninteractiveTabindex: the inspector's body scrolls, so it takes focus for keyboard scrolling (F-INSP-14, R2-15 item 2).
      tabIndex={0}
      aria-label="Inspector contents"
      className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-8 focus-visible:outline-offset-[-2px]"
    >
      <div role="status" data-font-status="">
        {failures.length > 0 && (
          <div className="mb-4 space-y-1 rounded-md border border-border-bright bg-page px-3 py-2 text-foreground text-xs leading-snug">
            {failures.map((id) => (
              <p key={id}>{fontNote(id)}</p>
            ))}
          </div>
        )}
      </div>
      <Scales spec={spec} mode={mode} cells={cells ?? []} />
      <RoleTable rows={rows} />
      <NamesSection spec={spec} />
      <Findings
        findings={findings}
        params={params}
        selected={selected}
        kept={kept !== null && kept.spec === spec ? kept.key : null}
        onShowMe={toggleShowMe}
        onFix={fix}
      />
      {notes !== null && (
        <PanelSection
          title="Preset notes"
          note={`${notes.label}: what its values answer, and what the spec cannot hold yet.`}
        >
          {notes.guards.length > 0 && (
            <NoteList heading="Accessibility guards" items={notes.guards} />
          )}
          {notes.unexpressed.length > 0 && (
            <NoteList heading="Not in the spec yet" items={notes.unexpressed} />
          )}
        </PanelSection>
      )}
    </section>
  );
}

/** The preset when it has notes, or null (R2-28: none for `default`, nothing for a custom design). */
function presetNotes(preset: Preset): Preset | null {
  return preset.guards.length + preset.unexpressed.length > 0 ? preset : null;
}

function NoteList({ heading, items }: { heading: string; items: readonly string[] }) {
  return (
    <div className="text-xs">
      <h4 className="text-fg-muted">{heading}</h4>
      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-foreground leading-snug">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
