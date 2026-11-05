"use client";

import { useId, useState } from "react";
import type { AiChange, BriefDraft, BriefInput, HueOrNull } from "@/ai";
import { type DirectionParams, LOCKABLE, type Lockable, type Oklch } from "@/engine";
import { ActionButton, ActionStatus } from "@/features/ai/ActionButton";
import type { AiActivity } from "@/features/ai/activity";
import type { AiModule } from "@/features/ai/load";
import { runProviders } from "@/features/ai/router";
import { browserDeps, createdWithOf, failureLines, stepsFor } from "@/features/ai/steps";
import { CANCELED_LINE, useAiAction } from "@/features/ai/useAiAction";
import { LABEL } from "@/features/studio/controls";
import type { StudioStore } from "@/features/studio/store";
import { toPlainText } from "@/spec";

// The Brief section of the inputs panel (docs/specs/04-ai.md, 13.1, R4-39 to R4-41, R4-36): the
// visitor describes the product or mood, and "Read the brief" turns it into a design. The brief is
// cleaned first; the colors it names become locked seeds; with no letter left no provider runs;
// else the router asks on-device, the visitor key and the shared route in turn, and the word list
// answers when none does. Each change is one commit, built on the store's state when the answer
// lands (R4-37); only the literal seeds come from the text read at the start.

const BRIEF_MAX = 500;
const FIELD_LABEL = "Describe the product or mood";
const PLACEHOLDER = "A tea house at dusk, calm and exact";
const EMPTY_REASON = "Write a few words or a color first.";
const NOTHING = "No known words, so nothing changed.";
const ONLY_COLORS = "No known words, so only the brief's colors were set.";
const MATCHED_ALREADY = "The design already matched it.";
/** A letter of any script (R4-40): without one, the brief is colors and digits only. */
const LETTER = /\p{L}/u;

/** 13.1's line for seeds a brief of colors alone set. */
const seedsLine = (count: number) =>
  count === 1
    ? "Set 1 seed color from the brief (no model)."
    : `Set ${count} seed colors from the brief (no model).`;

/** A seed's hue as the brief's input takes it: an integer 0 to 359, or null for a gray. */
const hueOf = (seed: Oklch): HueOrNull => (seed.h === null ? null : Math.round(seed.h) % 360);

/**
 * The hues of the slots that will be locked when the brief applies (R4-39): the brief's literal
 * seeds, which take their slots even over the visitor's lock (R4-40), then the visitor's locks.
 */
function lockedHues(params: DirectionParams, literals: readonly Oklch[]): BriefInput["locked"] {
  const locked: Partial<Record<Lockable, HueOrNull>> = {};
  LOCKABLE.forEach((slot, i) => {
    const seed = literals[i] ?? params[slot];
    if (seed !== undefined) locked[slot] = hueOf(seed);
  });
  return locked;
}

/**
 * Reads one cleaned brief and applies what it gives as one commit (13.1): the lines to show. A
 * cancel leaves the design as it was.
 */
async function readBrief(
  ai: AiModule,
  deps: { store: StudioStore; activity: AiActivity; text: string; signal: AbortSignal },
): Promise<{ failures: readonly string[]; result: string }> {
  const { store, activity, text, signal } = deps;
  const { seeds, rest } = ai.briefColors(text);
  /** Applies a draft on the store's state now, with the brief's literal seeds. */
  const apply = (draft: BriefDraft, createdWith: AiChange["createdWith"]): boolean => {
    const { preset, patch } = ai.briefChange(draft, {
      params: store.getState().params,
      literals: seeds,
    });
    const change: AiChange =
      preset === undefined ? { patch, createdWith } : { preset, patch, createdWith };
    return store.getState().applyAi(change);
  };

  if (!LETTER.test(rest)) {
    if (seeds.length === 0) return { failures: [], result: NOTHING };
    apply({}, "controls");
    return { failures: [], result: seedsLine(seeds.length) };
  }
  const input = ai.briefInput(text, lockedHues(store.getState().params, seeds));
  const routed = await runProviders(stepsFor(ai, "brief", input, browserDeps(activity)), signal);
  if (routed.kind === "canceled" || signal.aborted) return { failures: [], result: CANCELED_LINE };
  if (routed.kind === "model") {
    const { path } = routed;
    // The router answers a model's path only from a model's step (runProviders checks it).
    if (path.provider === "rules") throw new RangeError("readBrief: the rules answered as a model");
    const changed = apply(routed.output, createdWithOf(path));
    const made = ai.madeWith(path, "brief");
    return {
      failures: failureLines(ai, routed.failures, "brief", path.provider),
      result: changed ? made : `${made} ${MATCHED_ALREADY}`,
    };
  }
  const failures = failureLines(ai, routed.failures, "brief", "rules");
  const match = ai.matchLexicon(rest);
  if (match.draft !== null) {
    apply(match.draft, "lexicon");
    const made = ai.madeWith({ provider: "rules" }, "brief");
    return { failures, result: `${made} Matched: ${match.terms.join(", ")}.` };
  }
  if (seeds.length > 0) {
    apply({}, "controls");
    return { failures, result: ONLY_COLORS };
  }
  return { failures, result: NOTHING };
}

export function BriefSection({ store, activity }: { store: StudioStore; activity: AiActivity }) {
  const [value, setValue] = useState("");
  const action = useAiAction(activity, "brief");
  const id = useId();
  const counterId = `${id}-counter`;
  const cleaned = toPlainText(value, BRIEF_MAX);

  return (
    <>
      <div className="space-y-1.5">
        <label htmlFor={id} className={LABEL}>
          {FIELD_LABEL}
        </label>
        <textarea
          id={id}
          rows={3}
          maxLength={BRIEF_MAX}
          value={value}
          placeholder={PLACEHOLDER}
          spellCheck
          aria-describedby={counterId}
          onChange={(event) => setValue(event.currentTarget.value)}
          className="block w-full min-w-0 resize-y rounded-md border border-control-edge bg-page px-2 py-1.5 text-foreground text-sm leading-snug placeholder:text-fg-muted hover:border-fg-muted"
        />
        <p id={counterId} className="font-mono text-fg-muted text-xs tabular-nums">
          {value.length} of {BRIEF_MAX} characters
        </p>
      </div>
      <ActionButton
        action={action}
        label="Read the brief"
        busyLabel="Reading the brief…"
        reason={cleaned === null ? EMPTY_REASON : null}
        onRun={() => {
          if (cleaned === null) return;
          const text = cleaned.text;
          action.run((ai, signal) => readBrief(ai, { store, activity, text, signal }));
        }}
      />
      <ActionStatus lines={action.lines} />
    </>
  );
}
