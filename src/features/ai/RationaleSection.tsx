"use client";

import { useId } from "react";
import { ActionButton, ActionStatus } from "@/features/ai/ActionButton";
import type { AiActivity } from "@/features/ai/activity";
import type { AiModule } from "@/features/ai/load";
import { runProviders } from "@/features/ai/router";
import { browserDeps, createdWithOf, failureLines, stepsFor } from "@/features/ai/steps";
import { CANCELED_LINE, useAiAction } from "@/features/ai/useAiAction";
import { PanelSection } from "@/features/studio/PanelSection";
import { type StudioStore, useStudio } from "@/features/studio/store";

// The inspector's Rationale section (docs/specs/04-ai.md, 13.5, R4-49, R4-55): the held spec's
// thesis and its do and don't rules, and "Write the rationale", which asks the router for the
// one-liner, the thesis and the rules and stores them in the spec as one commit, so the export of a
// spec stays deterministic. Without a model nothing is written, and the export keeps the preset's
// text. What a model wrote is shown as React text only (R4-28): `parseOutput` has cleaned it and
// capped its length, and the spec's schema holds it as plain text.

const NO_THESIS = "No thesis yet.";
const NO_RULES = "No rules yet.";
const NOTHING_WRITTEN = "Nothing written. The export keeps the preset's text (no model).";

/**
 * Writes the rationale of the held design (13.5): the router asks each provider in turn, and a
 * model's answer is stored through `rationaleChange` and `applyAi` as one commit, built on the
 * store's state when the answer lands (R4-37). A cancel leaves the design as it was.
 */
export async function writeRationale(
  ai: AiModule,
  deps: { store: StudioStore; activity: AiActivity; signal: AbortSignal },
): Promise<{ failures: readonly string[]; result: string }> {
  const { store, activity, signal } = deps;
  const { spec, preset } = store.getState();
  const input = ai.rationaleInput(spec, preset);
  const routed = await runProviders(
    stepsFor(ai, "rationale", input, browserDeps(activity)),
    signal,
  );
  if (routed.kind === "canceled" || signal.aborted) return { failures: [], result: CANCELED_LINE };
  if (routed.kind === "rules") {
    return {
      failures: failureLines(ai, routed.failures, "rationale", "rules"),
      result: NOTHING_WRITTEN,
    };
  }
  const { path } = routed;
  // The router answers a model's path only from a model's step (runProviders checks it).
  if (path.provider === "rules") {
    throw new RangeError("writeRationale: the rules answered as a model");
  }
  // Every line is built before the change commits, so a failure while building changes nothing.
  const failures = failureLines(ai, routed.failures, "rationale", path.provider);
  const result = ai.madeWith(path, "rationale");
  const { patch } = ai.rationaleChange(routed.output, store.getState().params);
  store.getState().applyAi({ patch, createdWith: createdWithOf(path) });
  return { failures, result };
}

export function RationaleSection({
  store,
  activity,
}: {
  store: StudioStore;
  activity: AiActivity;
}) {
  const thesis = useStudio(store, (studio) => studio.spec.direction?.thesis);
  const rules = useStudio(store, (studio) => studio.spec.rules);
  const action = useAiAction(activity, "rationale");
  return (
    <PanelSection title="Rationale">
      {thesis === undefined ? (
        <p className="text-fg-muted text-xs">{NO_THESIS}</p>
      ) : (
        <p className="text-foreground text-xs leading-snug text-pretty">{thesis}</p>
      )}
      {rules.do.length + rules.dont.length === 0 ? (
        <p className="text-fg-muted text-xs">{NO_RULES}</p>
      ) : (
        <>
          {rules.do.length > 0 && <RuleList heading="Do" items={rules.do} />}
          {rules.dont.length > 0 && <RuleList heading="Don't" items={rules.dont} />}
        </>
      )}
      <ActionButton
        action={action}
        label="Write the rationale"
        busyLabel="Writing the rationale…"
        reason={null}
        onRun={() => action.run((ai, signal) => writeRationale(ai, { store, activity, signal }))}
      />
      <ActionStatus lines={action.lines} />
    </PanelSection>
  );
}

/** One list of rules, named by its heading ("Do" or "Don't"). */
function RuleList({ heading, items }: { heading: string; items: readonly string[] }) {
  const id = useId();
  return (
    <div className="text-xs">
      <h4 id={id} className="text-fg-muted">
        {heading}
      </h4>
      <ul
        aria-labelledby={id}
        className="mt-1 list-disc space-y-0.5 pl-4 text-foreground leading-snug"
      >
        {items.map((item, i) => (
          // A rule may repeat another's text, so its place keys it.
          // biome-ignore lint/suspicious/noArrayIndexKey: the list is the spec's, replaced whole on each commit.
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
