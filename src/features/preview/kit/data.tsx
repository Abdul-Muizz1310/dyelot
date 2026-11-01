"use client";

import "./data.css";
import { Check, User } from "lucide-react";
import { useState } from "react";
import { SAMPLE_PLACES } from "../copy";
import type { KitState } from "./states";

// The kit's data parts (section 7.5): table rows, badges, chips, avatars, skeletons and progress.
// Numbers sit in tabular numerals; a selected chip or row takes the accent pair.

const PLACES = SAMPLE_PLACES;

/** The readings' fields after the place, as the table heads them and a record labels them. */
const OBSERVER = "Observer";
const READING = "Reading (m)";
const STATE = "State";
const NONE_SAVED = "No readings saved yet.";

type Layout = "row" | "record";

/** What marks a reading as a kit specimen: its state, its label's container and its roles. */
function marks(state: KitState) {
  return {
    "data-kit": "table-row",
    "data-state": state,
    "data-specimen": "",
    "data-roles":
      state === "selected"
        ? "accent accent-foreground"
        : state === "empty"
          ? "muted-foreground"
          : "muted border",
  } as const;
}

function StateLabel({ state }: { state: KitState }) {
  return (
    <span data-state-label="" className="kit-mono kit-t-caption">
      {state}
    </span>
  );
}

/**
 * One reading, as a table row or as a stacked record: the same data, states and marks in either
 * layout. A place or an observer wraps only between words (`kit-word`); the reading keeps its line.
 */
function ReadingEntry({
  layout,
  state,
  place,
  person,
  amount,
}: {
  layout: Layout;
  state: KitState;
  place: string;
  person: string;
  amount: string;
}) {
  if (layout === "row") {
    return (
      <tr {...marks(state)}>
        <td>
          <StateLabel state={state} />
        </td>
        <td className="kit-word">{place}</td>
        <td className="kit-word">{person}</td>
        <td className="kit-num">{amount}</td>
      </tr>
    );
  }
  return (
    <li {...marks(state)} className="kit-record">
      <p className="kit-record-place kit-word">{place}</p>
      <dl className="kit-record-pairs">
        <dt>{OBSERVER}</dt>
        <dd className="kit-word">{person}</dd>
        <dt>{READING}</dt>
        <dd className="kit-num">{amount}</dd>
        <dt>{STATE}</dt>
        <dd>
          <StateLabel state={state} />
        </dd>
      </dl>
    </li>
  );
}

/** The `empty` state: no reading saved, in either layout. */
function EmptyEntry({ layout }: { layout: Layout }) {
  const content = (
    <>
      <StateLabel state="empty" /> · {NONE_SAVED}
    </>
  );
  if (layout === "row") {
    return (
      <tr {...marks("empty")}>
        <td colSpan={4}>{content}</td>
      </tr>
    );
  }
  return (
    <li {...marks("empty")} className="kit-record">
      {content}
    </li>
  );
}

function Head() {
  return (
    <thead>
      <tr>
        <th scope="col">{STATE}</th>
        <th scope="col">Place</th>
        <th scope="col">{OBSERVER}</th>
        <th scope="col" className="kit-num">
          {READING}
        </th>
      </tr>
    </thead>
  );
}

/**
 * The readings, one per state, and the `empty` state in a set of its own. From 480 px of frame they
 * are a table; below it they stack as records (spec F-TPL-03). The frame's container query shows one
 * layout and removes the other (`display: none`), so only one is in the accessibility tree.
 */
export function Readings({
  states,
  person,
  amount,
}: {
  states: readonly KitState[];
  person: string;
  amount: string;
}) {
  const rows = states
    .filter((state) => state !== "empty")
    .map((state, index) => ({ state, place: PLACES[index % PLACES.length] ?? "" }));
  const entries = (layout: Layout) =>
    rows.map((row) => (
      <ReadingEntry
        key={row.state}
        layout={layout}
        state={row.state}
        place={row.place}
        person={person}
        amount={amount}
      />
    ));
  return (
    <div className="kit-readings">
      <table className="kit-table" aria-label="Sample readings">
        <Head />
        <tbody>{entries("row")}</tbody>
      </table>
      <ul className="kit-records" aria-label="Sample readings">
        {entries("record")}
      </ul>
      {states.includes("empty") && (
        <>
          <table className="kit-table" aria-label="Sample readings, none saved">
            <Head />
            <tbody>
              <EmptyEntry layout="row" />
            </tbody>
          </table>
          <ul className="kit-records" aria-label="Sample readings, none saved">
            <EmptyEntry layout="record" />
          </ul>
        </>
      )}
    </div>
  );
}

export type Tone =
  | "neutral"
  | "primary"
  | "accent"
  | "success"
  | "warning"
  | "destructive"
  | "info";

const TONE_ROLES: Readonly<Record<Tone, string>> = {
  neutral: "muted muted-foreground",
  primary: "primary primary-foreground",
  accent: "accent accent-foreground",
  success: "success-subtle success-subtle-foreground",
  warning: "warning-subtle warning-subtle-foreground",
  destructive: "destructive-subtle destructive-subtle-foreground",
  info: "info-subtle info-subtle-foreground",
};

export function Badge({
  tone,
  children,
  copyLabel = false,
}: {
  tone: Tone;
  children: string;
  copyLabel?: boolean;
}) {
  return (
    <span
      className="kit-badge"
      data-kit="badge"
      data-state="default"
      data-tone={tone}
      data-roles={TONE_ROLES[tone]}
      data-copy-label={copyLabel ? "" : undefined}
    >
      {children}
    </span>
  );
}

export function Chip({ label, state }: { label: string; state: KitState }) {
  const [on, setOn] = useState(state === "selected");
  return (
    <button
      type="button"
      aria-pressed={on}
      className="kit-chip"
      data-kit="chip"
      data-state={state}
      data-roles={on ? "accent accent-foreground" : "background foreground border"}
      disabled={state === "disabled"}
      onClick={() => setOn((value) => !value)}
    >
      {on && <Check aria-hidden="true" />}
      {label}
    </button>
  );
}

/** The initials of a name: the first letter of its first two words. */
function initials(name: string): string {
  return name
    .split(/[\s-]+/)
    .slice(0, 2)
    .map((word) => [...word][0] ?? "")
    .join("");
}

export function Avatar({ person, state }: { person: string; state: KitState }) {
  if (state === "loading") {
    return (
      <span
        role="img"
        aria-label="Loading a photo"
        className="kit-avatar kit-shimmer"
        data-kit="avatar"
        data-state="loading"
        data-roles="muted"
      />
    );
  }
  if (state === "empty") {
    return (
      <span
        role="img"
        aria-label="No photo"
        className="kit-avatar"
        data-kit="avatar"
        data-state="empty"
        data-roles="muted muted-foreground"
      >
        <User aria-hidden="true" />
      </span>
    );
  }
  return (
    <span
      role="img"
      aria-label={person}
      className="kit-avatar"
      data-kit="avatar"
      data-state={state}
      data-roles="secondary secondary-foreground"
    >
      {initials(person)}
    </span>
  );
}

export function Skeleton() {
  return (
    <div
      role="status"
      aria-label="Loading readings"
      className="kit-skeleton"
      data-kit="skeleton"
      data-state="loading"
      data-roles="muted background"
    >
      <span className="kit-skeleton-bar kit-shimmer" />
      <span className="kit-skeleton-bar kit-shimmer" />
      <span className="kit-skeleton-bar kit-shimmer" />
    </div>
  );
}

const PROGRESS: Readonly<Partial<Record<KitState, number>>> = {
  default: 60,
  success: 100,
  empty: 0,
};

export function Progress({ state }: { state: KitState }) {
  const value = PROGRESS[state];
  return (
    <div
      role="progressbar"
      aria-label="Uploading the readings"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      className="kit-progress"
      data-kit="progress"
      data-state={state}
      data-roles={state === "success" ? "muted success" : "muted primary"}
      style={{ "--kit-value": `${value ?? 40}%` }}
    >
      <span className="kit-progress-fill" />
    </div>
  );
}
