"use client";

import { type ReactNode, useId, useState } from "react";
import {
  CHROMA_LEVELS,
  CONTRAST_LEVELS,
  DEPTH_STYLES,
  GAMUTS,
  HARMONIES,
  type Lockable,
  MOTION_FEELS,
  NEUTRAL_TINTS,
  PAIRING_IDS,
  PAIRINGS,
  PRESET_IDS,
  PRESETS,
  type Preset,
  RADIUS_SET_NAMES,
  SCALE_MODES,
  TYPE_CONTEXTS,
} from "@/engine";
import { AboutFields } from "./AboutFields";
import { PRESSED, PRIMARY_BUTTON } from "./chrome";
import { Choice, LABEL, Picker, same } from "./controls";
import { isOneOf } from "./guards";
import { autoPairingLabel, GAMUT_LABELS, SEED_FIELD_MESSAGE, seedRowHex } from "./inputs";
import { SEED_SLOT } from "./shortcuts";
import { type StudioStore, useStudio } from "./store";
import { DENSITIES } from "./view";

// The inputs panel (spec section 7.2): the controls of the table, in its order. A set of at most
// four options is a radio group, a larger one a native select; "Regenerate" is the panel's one
// madder fill. Brief, image and import wait for later milestones.

/** The pairing select's value for "Auto": a pairing absent from the params (R2-05). */
const AUTO = "auto";
/** The preset select's value while no preset is selected (R2-28). */
const CUSTOM = "custom";

export function InputsPanel({ store }: { store: StudioStore }) {
  const params = useStudio(store, (studio) => studio.params);
  const seed = useStudio(store, (studio) => studio.seed);
  const preset = useStudio(store, (studio) => studio.preset);
  const density = useStudio(store, (studio) => studio.view.density);
  const { setParams, applyPreset, setView, regenerate } = store.getState();
  // The notes of the selected preset, when it has any (R2-28: none while the design is custom).
  const notes =
    preset !== null && PRESETS[preset].guards.length + PRESETS[preset].unexpressed.length > 0
      ? PRESETS[preset]
      : null;

  return (
    <>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pt-4 pb-6">
        <Section title="About">
          <AboutFields store={store} />
        </Section>

        <Section title="Seeds">
          {(["primary", "secondary", "accent"] as const).map((slot) => (
            <SeedRow key={slot} slot={slot} store={store} />
          ))}
        </Section>

        <Section title="Color">
          <Picker
            label="Harmony"
            value={params.harmony}
            options={same(HARMONIES)}
            onChange={(value) => {
              if (isOneOf(value, HARMONIES)) setParams({ harmony: value });
            }}
          />
          <Choice
            legend="Chroma"
            value={params.chroma}
            options={same(CHROMA_LEVELS)}
            onChange={(chroma) => setParams({ chroma })}
          />
          <Choice
            legend="Neutral tint"
            value={params.neutralTint}
            options={same(NEUTRAL_TINTS)}
            onChange={(neutralTint) => setParams({ neutralTint })}
          />
          <Choice
            legend="Contrast level"
            value={params.contrastLevel}
            options={same(CONTRAST_LEVELS)}
            onChange={(contrastLevel) => setParams({ contrastLevel })}
          />
          <Choice
            legend="Gamut"
            value={params.gamut}
            options={GAMUTS.map((value) => ({ value, label: GAMUT_LABELS[value] }))}
            onChange={(gamut) => setParams({ gamut })}
          />
          <Choice
            legend="Scale mode"
            value={params.scaleMode}
            options={same(SCALE_MODES)}
            onChange={(scaleMode) => setParams({ scaleMode })}
          />
        </Section>

        <Section title="Style">
          <div className="space-y-2">
            <Picker
              label="Preset"
              value={preset ?? CUSTOM}
              describedBy={notes === null ? undefined : "preset-notes"}
              options={[
                ...(preset === null ? [{ value: CUSTOM, label: "Custom", disabled: true }] : []),
                ...PRESET_IDS.map((id) => ({ value: id, label: PRESETS[id].label })),
              ]}
              onChange={(value) => {
                if (isOneOf(value, PRESET_IDS)) applyPreset(value);
              }}
            />
            {notes !== null && <PresetNotes preset={notes} />}
          </div>
          <Picker
            label="Pairing"
            value={params.pairing ?? AUTO}
            options={[
              { value: AUTO, label: autoPairingLabel(seed) },
              ...PAIRINGS.map((pairing) => ({ value: pairing.id, label: pairing.label })),
            ]}
            onChange={(value) => {
              if (value === AUTO) setParams({ pairing: undefined });
              else if (isOneOf(value, PAIRING_IDS)) setParams({ pairing: value });
            }}
          />
          <Picker
            label="Type context"
            value={params.type.context}
            options={same(TYPE_CONTEXTS)}
            onChange={(value) => {
              if (isOneOf(value, TYPE_CONTEXTS)) setParams({ type: { context: value } });
            }}
          />
          <Choice
            legend="Radius"
            value={params.radius}
            options={same(RADIUS_SET_NAMES)}
            onChange={(radius) => setParams({ radius })}
          />
          <Choice
            legend="Depth"
            value={params.depth}
            options={same(DEPTH_STYLES)}
            onChange={(depth) => setParams({ depth })}
          />
          <Choice
            legend="Density"
            value={density}
            options={same(DENSITIES)}
            onChange={(value) => setView({ density: value })}
          />
          <Choice
            legend="Motion feel"
            value={params.motion}
            options={same(MOTION_FEELS)}
            onChange={(motion) => setParams({ motion })}
          />
        </Section>
      </div>
      {/* The panel's footer: Regenerate and the keys stay in view while the controls scroll. */}
      <div className="shrink-0 space-y-3 border-border border-t px-4 pt-3 pb-4">
        <button
          type="button"
          data-primary=""
          aria-keyshortcuts="Space"
          onClick={regenerate}
          className={`${PRIMARY_BUTTON} h-10 w-full`}
        >
          Regenerate
        </button>
        <p data-shortcut-hint="" className="text-fg-muted text-xs leading-relaxed">
          <Key>Space</Key> regenerates. <Key>←</Key> and <Key>→</Key> undo and redo. <Key>L</Key>{" "}
          locks the focused seed. <Key>Alt+T</Key> flips the mode. <Key>Ctrl+S</Key> (<Key>⌘S</Key>{" "}
          on a Mac) copies the link.
        </p>
      </div>
    </>
  );
}

function Key({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-sm border border-border-bright px-1 font-mono text-[11px] text-foreground">
      {children}
    </kbd>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="space-y-4">
      <h3 id={id} className="font-mono text-fg-muted text-xs lowercase tracking-[0.08em]">
        {title}
      </h3>
      {children}
    </section>
  );
}

function PresetNotes({ preset }: { preset: Preset }) {
  const { guards, unexpressed } = preset;
  return (
    <div id="preset-notes" className="space-y-2 rounded-md border border-border px-3 py-2 text-xs">
      {guards.length > 0 && (
        <div>
          <p className="text-fg-muted">Accessibility guards</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-foreground">
            {guards.map((guard) => (
              <li key={guard}>{guard}</li>
            ))}
          </ul>
        </div>
      )}
      {unexpressed.length > 0 && (
        <div>
          <p className="text-fg-muted">Not in the spec yet</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-foreground">
            {unexpressed.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const SLOT_LABEL: Readonly<Record<Lockable, string>> = {
  primary: "Primary",
  secondary: "Secondary",
  accent: "Accent",
};

/**
 * One seed: a hex field, the native color input and the lock toggle (section 7.2). An unlocked seed
 * shows the generated color as a placeholder and "Auto"; typing a color and leaving the field, or
 * picking one, locks it. A drag in the picker is one undo step (coalesce key `seed:<slot>`).
 */
function SeedRow({ slot, store }: { slot: Lockable; store: StudioStore }) {
  const spec = useStudio(store, (studio) => studio.spec);
  const params = useStudio(store, (studio) => studio.params);
  const locked = params[slot] !== undefined;
  const hex = seedRowHex(spec, params, slot);
  const { setSeedColor, toggleLock } = store.getState();
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const id = useId();
  const autoId = `${id}-auto`;
  const errorId = `${id}-error`;
  const label = SLOT_LABEL[slot];

  function commit(): void {
    if (draft === null) return;
    const text = draft.trim();
    if (text === "") {
      setDraft(null);
      setInvalid(false);
      return;
    }
    const result = setSeedColor(slot, text);
    if (result.ok) {
      setDraft(null);
      setInvalid(false);
    } else {
      setInvalid(true);
    }
  }

  const describedBy = [locked ? null : autoId, invalid ? errorId : null]
    .filter((part) => part !== null)
    .join(" ");

  return (
    <div data-seed-row={slot} className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className={LABEL}>
          {label}
        </label>
        {!locked && (
          <span id={autoId} className="font-mono text-[11px] text-fg-muted">
            Auto
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          value={draft ?? (locked ? hex : "")}
          placeholder={hex}
          aria-invalid={invalid}
          aria-describedby={describedBy === "" ? undefined : describedBy}
          onChange={(event) => {
            setDraft(event.currentTarget.value);
            setInvalid(false);
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
          }}
          className="h-9 min-w-0 flex-1 rounded-md border border-control-edge bg-page px-2 font-mono text-foreground text-sm tabular-nums placeholder:text-fg-muted hover:border-fg-muted aria-invalid:border-foreground"
        />
        <input
          type="color"
          aria-label={`Pick ${slot}`}
          data-swatch=""
          {...{ [SEED_SLOT]: slot }}
          value={hex}
          onChange={(event) => {
            setDraft(null);
            setInvalid(false);
            setSeedColor(slot, event.currentTarget.value, { coalesce: `seed:${slot}` });
          }}
          className="size-9 shrink-0 cursor-pointer rounded-md border border-control-edge bg-page p-0.5 [&::-webkit-color-swatch]:rounded-[4px] [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
        />
        <button
          type="button"
          aria-label={`Lock ${slot}`}
          aria-pressed={locked}
          {...{ [SEED_SLOT]: slot }}
          onClick={() => toggleLock(slot)}
          className={`inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-control-edge text-fg-muted hover:text-foreground ${PRESSED}`}
        >
          <LockIcon locked={locked} />
        </button>
      </div>
      {invalid && (
        <p id={errorId} className="text-foreground text-xs">
          {SEED_FIELD_MESSAGE}
        </p>
      )}
    </div>
  );
}

function LockIcon({ locked }: { locked: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d={locked ? "M8 11V7a4 4 0 0 1 8 0v4" : "M8 11V7a4 4 0 0 1 7.75-1.4"} />
    </svg>
  );
}
