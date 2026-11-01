"use client";

import { Check, User } from "lucide-react";
import { useState } from "react";
import type { KitState } from "./states";

// The kit's data parts (section 7.5): table rows, badges, chips, avatars, skeletons and progress.
// Numbers sit in tabular numerals; a selected chip or row takes the accent pair.

const PLACES = ["Samphire Bay", "Heron Staithe", "Gull Point", "Wrack Quay"] as const;

function Head() {
  return (
    <thead>
      <tr>
        <th scope="col" className="kit-table-state">
          State
        </th>
        <th scope="col">Place</th>
        <th scope="col">Observer</th>
        <th scope="col" className="kit-num">
          Reading (m)
        </th>
      </tr>
    </thead>
  );
}

/** A table whose rows each show one state, and a table with no rows (the `empty` state). */
export function ReadingsTables({
  states,
  person,
  amount,
}: {
  states: readonly KitState[];
  person: string;
  amount: string;
}) {
  const rows = states.filter((state) => state !== "empty");
  return (
    <>
      <table className="kit-table" aria-label="Sample readings">
        <Head />
        <tbody>
          {rows.map((state, index) => (
            <tr
              key={state}
              data-kit="table-row"
              data-state={state}
              data-specimen=""
              data-roles={state === "selected" ? "accent accent-foreground" : "muted border"}
            >
              <td className="kit-table-state">
                <span data-state-label="" className="kit-mono kit-t-caption">
                  {state}
                </span>
              </td>
              <td>{PLACES[index % PLACES.length]}</td>
              <td>{person}</td>
              <td className="kit-num">{amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {states.includes("empty") && (
        <table className="kit-table" aria-label="Sample readings, none saved">
          <Head />
          <tbody>
            <tr
              data-kit="table-row"
              data-state="empty"
              data-specimen=""
              data-roles="muted-foreground"
            >
              <td colSpan={4}>
                <span data-state-label="" className="kit-mono kit-t-caption">
                  empty
                </span>{" "}
                · No readings saved yet.
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </>
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
