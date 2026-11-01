import { type DirectionParams, PRESET_IDS, type PresetId } from "@/engine";
import { type DesignSpec, decodeSpec, encodeSpec, SpecDecodeError } from "@/spec";
import { assertRecord, describeType, isOneOf, isRecord } from "./guards";
import { paramsMatchSpec, parseParams } from "./params";

// The draft in `localStorage` (spec section 5.7, R2-14, Review Focus 2). Every storage call sits
// inside try/catch: private modes, quotas and sandboxes make `localStorage` throw, and the studio
// then works without drafts (I-M2-05).

/** The key that holds the draft. */
export const DRAFT_KEY = "dyelot:draft";

const DRAFT_VERSION = 1;

/** The part of `Storage` the studio uses. */
export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** A committed design as the store holds it: what undo restores and the draft saves. */
export type Snapshot = {
  readonly params: DirectionParams;
  readonly seed: string;
  readonly spec: DesignSpec;
  readonly preset: PresetId | null;
};

/** A draft read back: `params` is null when the stored ones fail the check of R2-14 item 2. */
export type Draft = {
  readonly spec: DesignSpec;
  readonly params: DirectionParams | null;
  readonly seed: string;
  readonly preset: PresetId | null;
};

/** Whether `value` has the three storage methods the studio calls. */
export function isStorage(value: unknown): value is StorageLike {
  return (
    isRecord(value) &&
    typeof value.getItem === "function" &&
    typeof value.setItem === "function" &&
    typeof value.removeItem === "function"
  );
}

function assertStorage(value: unknown, name: string): asserts value is StorageLike {
  if (!isStorage(value)) {
    throw new TypeError(
      `${name} must be a storage with getItem, setItem and removeItem, or null, got ${describeType(value)}`,
    );
  }
}

/**
 * `win.localStorage`, or null when there is no window, no storage, or the accessor throws, which
 * some browsers do before any method is called (C-DRAFT-03).
 */
export function safeStorage(win: { localStorage?: unknown } | undefined): StorageLike | null {
  if (win === undefined) return null;
  assertRecord(win, "safeStorage: win");
  let storage: unknown;
  try {
    storage = win.localStorage;
  } catch {
    return null;
  }
  return isStorage(storage) ? storage : null;
}

const DRAFT_KEYS: ReadonlySet<string> = new Set(["v", "link", "params", "preset"]);

/** The draft a stored text holds, or null when it is not one (C-DRAFT-05 to C-DRAFT-07). */
function parseDraft(text: string): Draft | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(value) || !Object.keys(value).every((key) => DRAFT_KEYS.has(key))) return null;
  const { v, link, preset } = value;
  if (v !== DRAFT_VERSION || typeof link !== "string") return null;
  if (preset !== null && !isOneOf(preset, PRESET_IDS)) return null;
  let spec: DesignSpec;
  try {
    spec = decodeSpec(link);
  } catch (error) {
    if (error instanceof SpecDecodeError) return null;
    throw error;
  }
  const parsed = parseParams(value.params);
  const params = parsed !== null && paramsMatchSpec(parsed, spec) ? parsed : null;
  return { spec, params, seed: spec.meta.seed, preset };
}

/**
 * The draft under `dyelot:draft`, or null. A value that is not a draft (not JSON, another
 * version, a link that does not open, the wrong shape) gives null and is removed; it never shows a
 * banner. Stored params that fail `parseParams` or do not regenerate the stored spec read back as
 * `params: null` (C-DRAFT-12, R2-14 item 2).
 */
export function readDraft(storage: StorageLike | null): Draft | null {
  if (storage === null) return null;
  assertStorage(storage, "readDraft: storage");
  let text: unknown;
  try {
    text = storage.getItem(DRAFT_KEY);
  } catch {
    return null;
  }
  if (typeof text !== "string") return null;
  const draft = parseDraft(text);
  if (draft === null) clearDraft(storage);
  return draft;
}

/**
 * Saves a snapshot as `{ v: 1, link, params, preset }` (C-DRAFT-01): the link of its spec, its
 * params as they are (an absent pairing stays absent) and its preset. `{ ok: false }` when there is
 * no storage or it throws (a full quota, a blocked API); never a throw for either.
 */
export function writeDraft(storage: StorageLike | null, snapshot: Snapshot): { ok: boolean } {
  assertRecord(snapshot, "writeDraft: snapshot");
  assertRecord(snapshot.spec, "writeDraft: snapshot.spec");
  if (storage === null) return { ok: false };
  assertStorage(storage, "writeDraft: storage");
  const text = JSON.stringify({
    v: DRAFT_VERSION,
    link: encodeSpec(snapshot.spec),
    params: snapshot.params,
    preset: snapshot.preset,
  });
  try {
    storage.setItem(DRAFT_KEY, text);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** Removes the draft; a storage that throws is ignored (C-DRAFT-09). */
export function clearDraft(storage: StorageLike | null): void {
  if (storage === null) return;
  assertStorage(storage, "clearDraft: storage");
  try {
    storage.removeItem(DRAFT_KEY);
  } catch {
    // Drafts are optional (I-M2-05): a storage that refuses leaves the old draft, which the next
    // read rejects or the next write replaces.
  }
}
