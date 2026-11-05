"use client";

import { useId, useState } from "react";
import type { AiChange, AiPatch } from "@/ai";
import { type Density, LOCKABLE, type Lockable, type Oklch } from "@/engine";
import { ActionButton, ActionStatus } from "@/features/ai/ActionButton";
import type { AiActivity } from "@/features/ai/activity";
import type { AiModule } from "@/features/ai/load";
import { runProviders } from "@/features/ai/router";
import {
  CHIPS,
  type Chip,
  type ChipContext,
  chipChange,
  chipsChange,
  chipWords,
} from "@/features/ai/steer";
import { browserDeps, createdWithOf, failureLines, stepsFor } from "@/features/ai/steps";
import { CANCELED_LINE, useAiAction } from "@/features/ai/useAiAction";
import { BUTTON } from "@/features/studio/chrome";
import { LABEL } from "@/features/studio/controls";
import { lockSeed } from "@/features/studio/params";
import { type StudioState, type StudioStore, useStudio } from "@/features/studio/store";
import { toPlainText } from "@/spec";

// The Steer section of the inputs panel (docs/specs/04-ai.md, 13.4, R4-44, R4-45): the seven chips,
// each rendered from steer.ts at first paint with its state, so no AI chunk is needed to show them;
// a press is one `applyAi` with `createdWith: "controls"` and the coalesce key "steer", so presses
// within 1 s are one history entry. "Refine in words" asks a model for typed ops, applied as one
// commit on the store's state when the answer lands (R4-37); without a model the chip words in the
// text apply. Section 13's strings, word for word.

const GROUP_LABEL = "Steer the design";
const FIELD_LABEL = "Refine in words";
const PLACEHOLDER = "Make it calmer and a little warmer";
const REFINE_MAX = 200;
const EMPTY_REASON = "Write what to change first.";
const NO_WORDS =
  "No steer words found, so nothing changed. Try warmer, cooler, bolder, quieter, softer, sharper or airier.";
const STALE = "The design changed while the request was read, so nothing changed.";
const AT_LIMIT = "Those words are already at their limit, so nothing changed.";
/** Each chip's button label. */
const CHIP_LABELS: Readonly<Record<Chip, string>> = {
  warmer: "Warmer",
  cooler: "Cooler",
  bolder: "Bolder",
  quieter: "Quieter",
  softer: "Softer",
  sharper: "Sharper",
  airier: "Airier",
};

/** The chips' context from the studio's state: the held primary is the locked one, else the shown one (8.1). */
function chipContext(state: Pick<StudioState, "params" | "spec" | "view">): ChipContext {
  const { params, spec, view } = state;
  return { params, density: view.density, primary: params.primary ?? lockSeed(spec, "primary") };
}

/** Each slot's held seed: the locked one, else the one the design shows (5.2's `refineInput`). */
function heldSeeds(state: Pick<StudioState, "params" | "spec">): Record<Lockable, Oklch> {
  const { params, spec } = state;
  const seeds = {} as Record<Lockable, Oklch>;
  for (const slot of LOCKABLE) seeds[slot] = params[slot] ?? lockSeed(spec, slot);
  return seeds;
}

/** A change of the chips: their patch, their density when they set one, and `"controls"`. */
function controlsChange(patch: AiPatch, density: Density | undefined): AiChange {
  return density === undefined
    ? { patch, createdWith: "controls" }
    : { patch, density, createdWith: "controls" };
}

/**
 * Refines the design from a cleaned text and applies what it gives as one commit (13.4, R4-45):
 * the lines to show. A model's ops apply on the design as it is when the answer lands, and
 * `refineChange` gives null when one of them no longer can; without a model, the chip words that
 * can still move apply, and when none can, nothing is committed.
 */
export async function refineDesign(
  ai: AiModule,
  deps: { store: StudioStore; activity: AiActivity; text: string; signal: AbortSignal },
): Promise<{ failures: readonly string[]; result: string }> {
  const { store, activity, text, signal } = deps;
  const asked = store.getState();
  const input = ai.refineInput(text, asked.params, heldSeeds(asked));
  const routed = await runProviders(stepsFor(ai, "refine", input, browserDeps(activity)), signal);
  if (routed.kind === "canceled" || signal.aborted) return { failures: [], result: CANCELED_LINE };
  const now = store.getState();
  if (routed.kind === "model") {
    const { path, output } = routed;
    // The router answers a model's path only from a model's step (runProviders checks it).
    if (path.provider === "rules") {
      throw new RangeError("refineDesign: the rules answered as a model");
    }
    const failures = failureLines(ai, routed.failures, "refine", path.provider);
    const change = ai.refineChange(output, { params: now.params, seeds: heldSeeds(now) });
    if (change === null) return { failures, result: STALE };
    const result = `${ai.madeWith(path, "refine")} ${output.summary}`;
    now.applyAi({ patch: change.patch, createdWith: createdWithOf(path) });
    return { failures, result };
  }
  const failures = failureLines(ai, routed.failures, "refine", "rules");
  const words = chipWords(text);
  if (words.length === 0) return { failures, result: NO_WORDS };
  const { patch, density, applied } = chipsChange(words, chipContext(now));
  // Every chip word is at the end of its range: no commit, so the history and the design's
  // `meta.createdWith` stay as they were (controller ruling on Task 4.10b's review).
  if (applied.length === 0) return { failures, result: AT_LIMIT };
  const result = `Made with ${ai.providerLabel({ provider: "rules" }, "refine")}: ${applied.join(", ")}.`;
  now.applyAi(controlsChange(patch, density));
  return { failures, result };
}

export function SteerSection({ store, activity }: { store: StudioStore; activity: AiActivity }) {
  const params = useStudio(store, (studio) => studio.params);
  const spec = useStudio(store, (studio) => studio.spec);
  const view = useStudio(store, (studio) => studio.view);
  const [value, setValue] = useState("");
  const action = useAiAction(activity, "refine");
  const id = useId();
  const cleaned = toPlainText(value, REFINE_MAX);
  const context = chipContext({ params, spec, view });
  const chips = CHIPS.map((chip) => ({ chip, outcome: chipChange(chip, context) }));

  /** A press: the chip's change on the store's state now, one undo step with presses 1 s apart. */
  const press = (chip: Chip): void => {
    const outcome = chipChange(chip, chipContext(store.getState()));
    if (!outcome.enabled) return;
    store.getState().applyAi(controlsChange(outcome.patch, outcome.density), { coalesce: "steer" });
  };

  return (
    <>
      {/* biome-ignore lint/a11y/useSemanticElements: a fieldset's row is a segmented control with one 3:1 edge (F-A11Y-09); this row is seven buttons, each with its own edge. */}
      <div role="group" aria-labelledby={`${id}-group`} className="min-w-0 space-y-1.5">
        <p id={`${id}-group`} className={LABEL}>
          {GROUP_LABEL}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {chips.map(({ chip, outcome }) => (
            <button
              key={chip}
              type="button"
              aria-disabled={outcome.enabled ? undefined : "true"}
              aria-describedby={outcome.enabled ? undefined : `${id}-${chip}`}
              onClick={() => press(chip)}
              className={`${BUTTON} w-fit`}
            >
              {CHIP_LABELS[chip]}
            </button>
          ))}
        </div>
        {chips.map(({ chip, outcome }) =>
          outcome.enabled ? null : (
            <p key={chip} id={`${id}-${chip}`} className="text-fg-muted text-xs">
              {outcome.reason}
            </p>
          ),
        )}
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`${id}-refine`} className={LABEL}>
          {FIELD_LABEL}
        </label>
        <input
          id={`${id}-refine`}
          type="text"
          maxLength={REFINE_MAX}
          value={value}
          placeholder={PLACEHOLDER}
          autoComplete="off"
          spellCheck
          onChange={(event) => setValue(event.currentTarget.value)}
          className="h-9 w-full min-w-0 rounded-md border border-control-edge bg-page px-2 text-foreground text-sm placeholder:text-fg-muted hover:border-fg-muted"
        />
      </div>
      <ActionButton
        action={action}
        label="Refine"
        busyLabel="Refining…"
        reason={cleaned === null ? EMPTY_REASON : null}
        onRun={() => {
          if (cleaned === null) return;
          const text = cleaned.text;
          action.run((ai, signal) => refineDesign(ai, { store, activity, text, signal }));
        }}
      />
      <ActionStatus lines={action.lines} />
    </>
  );
}
