import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";
import {
  ColorParseError,
  type DirectionParams,
  LOCKABLE,
  type Lockable,
  lintSpec,
  normalizeSeed,
  type Oklch,
  PRESET_IDS,
  PRESETS,
  type PresetId,
  parseColor,
  presetOf,
  applyPreset as presetParams,
} from "@/engine";
import type { ImportResult } from "@/import";
import { type DesignSpec, normalizeSpec, specId } from "@/spec";
import type { StudioClient } from "./client";
import {
  clearDraft,
  type Draft,
  isStorage,
  loadDraft,
  readDraft,
  type Snapshot,
  type StorageLike,
  writeDraft,
} from "./drafts";
import { assertOneOf, assertRecord, assertString, describeType } from "./guards";
import {
  freshParams,
  lockSeed,
  mergeParams,
  type ParamsPatch,
  paramsOfSpec,
  resolveParams,
  sameParams,
  touchesPreset,
  withSeed,
} from "./params";
import type { GenerateReply } from "./protocol";
import { type RebuildOutcome, rebuildOutcome } from "./rebuild";
import { type HashResult, type Notice, readHash, writeHash } from "./url";
import { DEFAULT_VIEW, mergeView, type View } from "./view";

// The studio store (spec section 5.7, R2-13, R2-14, R2-17, R2-28, R2-29). Every change is a
// numbered request to the generator through `deps.client`; a reply applies only when its id is
// above the last applied one, so out-of-order replies never leave the canvas on a stale spec
// (Review Focus 4). A change commits when its reply applies: the previous snapshot goes onto
// `history`, and the link in the hash and the draft follow 300 ms later.

export type Status = {
  readonly phase: "idle" | "generating" | "failed";
  readonly notice: Notice | null;
  readonly draft: "on" | "off";
};
export type StudioState = Snapshot & {
  readonly history: readonly Snapshot[];
  readonly future: readonly Snapshot[];
  readonly status: Status;
  readonly view: View;
  /**
   * What rebuilding the held design from its parameters gives (R3-42), for a loaded design that fails
   * a required check; null for every other design.
   */
  readonly outcome: RebuildOutcome | null;
};
export type StudioActions = {
  setParams(patch: ParamsPatch, options?: { coalesce?: string }): void;
  applyPreset(id: PresetId): void;
  /** A new seed from `deps.newSeed`, with the coalesce key "regenerate". */
  regenerate(): void;
  toggleLock(slot: Lockable): void;
  /** Regenerates the held design from its own params and seed as a new commit (R3-33). */
  rebuild(): void;
  /**
   * Loads an import's spec as a link load does (R3-33): a loaded snapshot, the old one on `history`,
   * no request, and the `imported` notice, which belongs to that snapshot.
   */
  importDesign(result: Extract<ImportResult, { ok: true }>): void;
  setSeedColor(
    slot: Lockable,
    text: string,
    options?: { coalesce?: string },
  ): { ok: true } | { ok: false; message: string };
  undo(): void;
  redo(): void;
  /** Flips `view.mode`: no history, no request. */
  toggleMode(): void;
  setView(patch: Partial<View>): void;
  loadFromHash(hash: string): void;
  startFresh(): void;
  revert(): void;
  dismissNotice(): void;
  /** Writes a pending hash and draft now (`pagehide`, a hidden page). */
  flush(): void;
  dispose(): void;
};
export type Studio = StudioState & StudioActions;
export type StudioStore = StoreApi<Studio>;

/** What the store reaches the world through (R2-13 item 1); nothing is a module singleton. */
export type StudioDeps = {
  readonly client: StudioClient;
  readonly storage: StorageLike | null;
  /** Milliseconds, for the coalesce window. */
  readonly clock: () => number;
  readonly newSeed: () => string;
  readonly location: Pick<Location, "hash" | "pathname" | "search">;
  readonly history: Pick<History, "replaceState">;
};

/** `history` keeps this many snapshots; the oldest falls off (R2-13 item 6). */
const HISTORY_LIMIT = 100;
/** Changes with one coalesce key at most this far apart commit as one entry (R2-13 item 6). */
const COALESCE_MS = 1_000;
/** The hash and the draft are written this long after the last commit of a burst. */
const PERSIST_DELAY_MS = 300;

/** Notices that a successful commit answers: the failure is over, the fonts are reset. */
const CLEARED_BY_COMMIT: ReadonlySet<Notice["kind"]> = new Set([
  "generation",
  "custom-fonts",
  "imported",
]);

/** The parameters and the preset a request asks for, and the seed it uses. */
type Intent = {
  readonly params: DirectionParams;
  readonly seed: string;
  readonly preset: PresetId | null;
};
type Issued = Intent & { readonly coalesce: string | undefined; readonly at: number };

function coalesceOf(
  options: { coalesce?: string } | undefined,
  caller: string,
): string | undefined {
  if (options === undefined) return undefined;
  assertRecord(options, `${caller}: options`);
  if (options.coalesce === undefined) return undefined;
  assertString(options.coalesce, `${caller}: options.coalesce`);
  return options.coalesce;
}

function checkDeps(deps: StudioDeps): void {
  assertRecord(deps, "createStudioStore: deps");
  const { client, storage, clock, newSeed, location, history } = deps;
  assertRecord(client, "createStudioStore: deps.client");
  for (const method of ["generateNow", "request", "subscribe", "drop", "dispose"] as const) {
    if (typeof client[method] !== "function") {
      throw new TypeError(
        `createStudioStore: deps.client.${method} must be a function, got ${describeType(client[method])}`,
      );
    }
  }
  if (storage !== null && !isStorage(storage)) {
    throw new TypeError("createStudioStore: deps.storage must be a storage or null");
  }
  for (const [key, value] of [
    ["clock", clock],
    ["newSeed", newSeed],
  ] as const) {
    if (typeof value !== "function") {
      throw new TypeError(
        `createStudioStore: deps.${key} must be a function, got ${describeType(value)}`,
      );
    }
  }
  assertRecord(location, "createStudioStore: deps.location");
  for (const key of ["hash", "pathname", "search"] as const) {
    assertString(location[key], `createStudioStore: deps.location.${key}`);
  }
  assertRecord(history, "createStudioStore: deps.history");
  if (typeof history.replaceState !== "function") {
    throw new TypeError("createStudioStore: deps.history.replaceState must be a function");
  }
}

/** The link notice for a hash that did not open, naming what the studio opened instead. */
function linkNotice(
  result: Extract<HashResult, { kind: "error" }>,
  fallback: "draft" | "fresh" | "current",
): Notice {
  return result.issues === undefined
    ? { kind: "link", reason: result.reason, fallback }
    : { kind: "link", reason: result.reason, issues: result.issues, fallback };
}

/**
 * The snapshot of a spec opened from a link or a draft (R2-14 item 2). A draft for the same spec
 * whose params passed `readDraft`'s check supplies params, seed and preset, so an explicit pairing
 * stays explicit; otherwise `paramsOfSpec` supplies the params and the preset is null.
 */
function snapshotOf(
  spec: DesignSpec,
  draft: Draft | null,
): { snapshot: Snapshot; customFonts: boolean } {
  if (draft !== null && draft.params !== null && specId(draft.spec) === specId(spec)) {
    return {
      snapshot: {
        params: draft.params,
        seed: draft.seed,
        spec,
        preset: draft.preset,
        provenance: "loaded",
      },
      customFonts: false,
    };
  }
  const { params, customFonts } = paramsOfSpec(spec);
  return {
    snapshot: { params, seed: spec.meta.seed, spec, preset: null, provenance: "loaded" },
    customFonts,
  };
}

/**
 * The studio store. The first load takes the hash if it opens, else the draft, else a fresh design
 * (R2-14 item 2); a hash that fails opens the draft or a fresh design with a `link` notice, so the
 * page is never blank (Review Focus 1).
 */
export function createStudioStore(deps: StudioDeps): StudioStore {
  checkDeps(deps);
  const { client, storage, clock, location } = deps;
  const browserHistory = deps.history;
  let lastIssued = 0;
  let lastApplied = 0;
  const issued = new Map<number, Issued>();
  let lastCommit: { readonly key: string | undefined; readonly at: number } | null = null;
  let persistTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const nextSeed = (): string => {
    const seed: unknown = deps.newSeed();
    assertString(seed, "createStudioStore: newSeed()");
    return seed;
  };

  function fresh(): Snapshot {
    const seed = nextSeed();
    const params = freshParams();
    const spec = normalizeSpec(client.generateNow(resolveParams(params, seed), seed));
    return { params, seed, spec, preset: "default", provenance: "generated" };
  }

  function firstLoad(draft: Draft | null): { snapshot: Snapshot; notice: Notice | null } {
    const link = readHash(location.hash);
    if (link.kind === "spec") {
      const { snapshot, customFonts } = snapshotOf(link.spec, draft);
      return { snapshot, notice: customFonts ? { kind: "custom-fonts" } : null };
    }
    if (draft !== null) {
      const { snapshot, customFonts } = snapshotOf(draft.spec, draft);
      // A failed link outranks everything (Review Focus 1); custom fonts outrank the restore
      // notice, because they warn about what editing does (R2-14 item 4).
      let notice: Notice = { kind: "draft-restored" };
      if (customFonts) notice = { kind: "custom-fonts" };
      if (link.kind === "error") notice = linkNotice(link, "draft");
      return { snapshot, notice };
    }
    return { snapshot: fresh(), notice: link.kind === "error" ? linkNotice(link, "fresh") : null };
  }

  // The outcome of rebuilding a held blocked design, by spec id (R3-42): computed when the design is
  // committed or loaded, before subscribers hear of it, and never again for the same design.
  const outcomes = new Map<string, RebuildOutcome>();
  // The `imported` notice of each imported snapshot, by its spec: undo drops the notice with the
  // snapshot, and undo or redo back to the import brings it back (R3-33).
  const importNotices = new WeakMap<DesignSpec, Notice>();
  function outcomeOf(snapshot: Snapshot): RebuildOutcome | null {
    // A generated design needs no outcome: a failing one is a fault whatever a rebuild would give.
    if (snapshot.provenance !== "loaded") return null;
    const id = specId(snapshot.spec);
    const known = outcomes.get(id);
    if (known !== undefined) return known;
    if (!lintSpec(snapshot.spec).some((finding) => finding.severity === "error")) return null;
    const outcome = rebuildOutcome(snapshot, (params, seed) =>
      client.generateNow(resolveParams(params, seed), seed),
    );
    outcomes.set(id, outcome);
    return outcome;
  }

  const stored = loadDraft(storage);
  const first = firstLoad(stored.draft);
  /** The last committed snapshot: what `spec` shows, what undo pushes and the draft saves. */
  let committed: Snapshot = first.snapshot;

  const store = createStore<Studio>()(() => ({
    ...committed,
    outcome: outcomeOf(committed),
    history: [],
    future: [],
    status: { phase: "idle", notice: first.notice, draft: stored.readable ? "on" : "off" },
    view: DEFAULT_VIEW,
    setParams,
    applyPreset,
    regenerate,
    toggleLock,
    rebuild,
    importDesign,
    setSeedColor,
    undo,
    redo,
    toggleMode,
    setView,
    loadFromHash,
    startFresh,
    revert,
    dismissNotice,
    flush,
    dispose,
  }));
  const state = () => store.getState();
  const patch = (partial: Partial<StudioState>) => store.setState(partial);
  const withStatus = (change: Partial<Status>): Partial<StudioState> => ({
    status: { ...state().status, ...change },
  });
  const unsubscribe = client.subscribe(onReply);

  /** Writes the committed design's link into the hash and saves the draft (C-HASH-11, C-DRAFT-11). */
  function persist(): void {
    persistTimer = null;
    const hash = writeHash(committed.spec);
    try {
      browserHistory.replaceState(null, "", hash);
    } catch {
      // A sandboxed frame refuses replaceState (C-HASH-15); the link still reaches the user
      // through "Copy link", so the studio goes on.
    }
    saveDraft();
  }

  function saveDraft(): void {
    const draft = writeDraft(storage, committed).ok ? "on" : "off";
    if (state().status.draft !== draft) patch(withStatus({ draft }));
  }

  function schedulePersist(): void {
    if (persistTimer !== null) clearTimeout(persistTimer);
    persistTimer = setTimeout(persist, PERSIST_DELAY_MS);
  }

  function cancelPersist(): void {
    if (persistTimer !== null) clearTimeout(persistTimer);
    persistTimer = null;
  }

  /** Every request issued so far is stale: its reply cannot apply (R2-13 items 3 and 8). */
  function supersedeAll(): void {
    lastApplied = lastIssued;
    issued.clear();
    lastCommit = null;
    // The pending request is stale too: posting it would only delay the next one (M2).
    client.drop();
  }

  function settle(id: number): void {
    lastApplied = id;
    for (const key of issued.keys()) if (key <= id) issued.delete(key);
  }

  function issue(intent: Intent, coalesce?: string): void {
    if (disposed) return;
    const id = ++lastIssued;
    issued.set(id, { ...intent, coalesce, at: clock() });
    patch({
      params: intent.params,
      seed: intent.seed,
      preset: intent.preset,
      ...withStatus({ phase: "generating" }),
    });
    client.request({ id, params: resolveParams(intent.params, intent.seed), seed: intent.seed });
  }

  function fail(id: number, message: string): void {
    // A newer request is on its way: its reply decides what the canvas shows.
    if (id < lastIssued) return;
    settle(id);
    patch(withStatus({ phase: "failed", notice: { kind: "generation", message } }));
  }

  function commit(id: number, request: Issued, spec: DesignSpec): void {
    settle(id);
    const snapshot: Snapshot = {
      params: request.params,
      seed: request.seed,
      spec,
      preset: request.preset,
      provenance: "generated",
    };
    const merge =
      request.coalesce !== undefined &&
      lastCommit !== null &&
      lastCommit.key === request.coalesce &&
      request.at - lastCommit.at <= COALESCE_MS;
    const { history, status } = state();
    const nextHistory = merge ? history : [...history, committed].slice(-HISTORY_LIMIT);
    committed = snapshot;
    lastCommit = { key: request.coalesce, at: request.at };
    const newest = id === lastIssued;
    const notice =
      status.notice !== null && CLEARED_BY_COMMIT.has(status.notice.kind) ? null : status.notice;
    patch({
      spec,
      provenance: "generated",
      outcome: null,
      ...(newest ? { params: snapshot.params, seed: snapshot.seed, preset: snapshot.preset } : {}),
      history: nextHistory,
      future: [],
      status: { ...status, phase: newest ? "idle" : "generating", notice },
    });
    schedulePersist();
  }

  /** The monotonic stale rule (R2-13 item 3): only a reply above the last applied id applies. */
  function onReply(reply: GenerateReply): void {
    if (disposed) return;
    const { id } = reply;
    if (id <= lastApplied || id > lastIssued) return;
    const request = issued.get(id);
    // Every id in (lastApplied, lastIssued] is in the map: settle and supersedeAll prune only
    // ids at or below lastApplied. A miss is a broken invariant, not a stale reply.
    if (request === undefined) {
      throw new Error(`createStudioStore: reply ${id} has no issued request`);
    }
    if (!reply.ok) {
      fail(id, reply.error.message);
      return;
    }
    let spec: DesignSpec;
    try {
      spec = normalizeSpec(reply.spec);
    } catch (error) {
      fail(id, error instanceof Error ? error.message : String(error));
      return;
    }
    commit(id, request, spec);
  }

  function setParams(change: ParamsPatch, options?: { coalesce?: string }): void {
    assertRecord(change, "setParams: patch");
    const key = coalesceOf(options, "setParams");
    const { params, seed, preset } = state();
    const next = mergeParams(params, change, "setParams");
    if (sameParams(next, params)) return;
    issue({ params: next, seed, preset: touchesPreset(params, next) ? null : preset }, key);
  }

  function applyPreset(id: PresetId): void {
    assertOneOf(id, PRESET_IDS, "applyPreset: id");
    const { params, seed, preset, view } = state();
    const next = presetParams(params, id);
    const { mode, density } = PRESETS[id].view;
    patch({ view: { ...view, mode, density } });
    if (preset === id && sameParams(next, params)) return;
    issue({ params: next, seed, preset: id });
  }

  function regenerate(): void {
    const seed = nextSeed();
    const { params, preset } = state();
    issue({ params, seed, preset }, "regenerate");
  }

  function toggleLock(slot: Lockable): void {
    assertOneOf(slot, LOCKABLE, "toggleLock: slot");
    const { params, seed, preset, spec } = state();
    const seedColor = params[slot] === undefined ? lockSeed(spec, slot) : undefined;
    issue({ params: withSeed(params, slot, seedColor), seed, preset });
  }

  function rebuild(): void {
    const { params, seed, preset } = committed;
    issue({ params, seed, preset });
  }

  function importDesign(result: Extract<ImportResult, { ok: true }>): void {
    assertRecord(result, "importDesign: result");
    if (result.ok !== true) {
      throw new TypeError("importDesign: result must be a successful import, got a failed one");
    }
    assertRecord(result.spec, "importDesign: result.spec");
    assertRecord(result.report, "importDesign: result.report");
    let spec: DesignSpec;
    try {
      spec = normalizeSpec(result.spec);
    } catch (error) {
      if (error instanceof RangeError) throw new RangeError(`importDesign: ${error.message}`);
      if (error instanceof TypeError) throw new TypeError(`importDesign: ${error.message}`);
      throw error;
    }
    const { report } = result;
    const count = (mode: "light" | "dark") =>
      report.mapped.filter((entry) => entry.mode === mode).length;
    const notice: Notice = {
      kind: "imported",
      format: report.format,
      exact: report.exact,
      light: count("light"),
      dark: count("dark"),
      adjusted: report.adjusted.length,
      ...(report.inferred.customFonts ? { customFonts: true as const } : {}),
    };
    importNotices.set(spec, notice);
    const snapshot: Snapshot = {
      params: paramsOfSpec(spec).params,
      seed: spec.meta.seed,
      spec,
      preset: presetOf(spec),
      provenance: "loaded",
    };
    const { history } = state();
    show(snapshot, [...history, committed].slice(-HISTORY_LIMIT), []);
    patch(withStatus({ notice }));
  }

  function setSeedColor(
    slot: Lockable,
    text: string,
    options?: { coalesce?: string },
  ): { ok: true } | { ok: false; message: string } {
    assertOneOf(slot, LOCKABLE, "setSeedColor: slot");
    assertString(text, "setSeedColor: text");
    const key = coalesceOf(options, "setSeedColor");
    let color: Oklch;
    try {
      color = normalizeSeed(parseColor(text));
    } catch (error) {
      if (error instanceof ColorParseError) return { ok: false, message: error.message };
      throw error;
    }
    const { params, seed, preset } = state();
    const next = withSeed(params, slot, color);
    if (!sameParams(next, params)) issue({ params: next, seed, preset }, key);
    return { ok: true };
  }

  /** Shows a snapshot that undo, redo or a load restored: no request, nothing in flight. */
  function show(
    snapshot: Snapshot,
    history: readonly Snapshot[],
    future: readonly Snapshot[],
  ): void {
    supersedeAll();
    committed = snapshot;
    const { status } = state();
    const kept =
      status.notice?.kind === "generation" || status.notice?.kind === "imported"
        ? null
        : status.notice;
    const notice = importNotices.get(snapshot.spec) ?? kept;
    patch({
      ...snapshot,
      outcome: outcomeOf(snapshot),
      history,
      future,
      status: { ...status, phase: "idle", notice },
    });
    schedulePersist();
  }

  function undo(): void {
    const { history, future } = state();
    const previous = history[history.length - 1];
    if (previous === undefined) return;
    show(previous, history.slice(0, -1), [committed, ...future]);
  }

  function redo(): void {
    const { history, future } = state();
    const next = future[0];
    if (next === undefined) return;
    show(next, [...history, committed].slice(-HISTORY_LIMIT), future.slice(1));
  }

  function toggleMode(): void {
    const { view } = state();
    patch({ view: { ...view, mode: view.mode === "light" ? "dark" : "light" } });
  }

  function setView(change: Partial<View>): void {
    const { view, preset } = state();
    const next = mergeView(view, change, "setView");
    if (next.density === view.density || preset === null) {
      patch({ view: next });
      return;
    }
    // R2-28: a density change makes the design "Custom", in the state, the committed snapshot and
    // the requests on their way, so no later commit brings the preset back.
    committed = { ...committed, preset: null };
    for (const [id, request] of issued) issued.set(id, { ...request, preset: null });
    patch({ view: next, preset: null });
    schedulePersist();
  }

  function loadFromHash(hash: string): void {
    assertString(hash, "loadFromHash: hash");
    const link = readHash(hash);
    if (link.kind === "none") return;
    if (link.kind === "error") {
      patch(withStatus({ notice: linkNotice(link, "current") }));
      return;
    }
    if (specId(link.spec) === specId(committed.spec)) return;
    const { snapshot, customFonts } = snapshotOf(link.spec, readDraft(storage));
    const { history } = state();
    show(snapshot, [...history, committed].slice(-HISTORY_LIMIT), []);
    patch(withStatus({ notice: customFonts ? { kind: "custom-fonts" } : null }));
  }

  function startFresh(): void {
    const seed = nextSeed();
    supersedeAll();
    cancelPersist();
    try {
      browserHistory.replaceState(null, "", `${location.pathname}${location.search}`);
    } catch {
      // C-HASH-15: a refused replaceState leaves the old link in the address bar until the
      // fresh design's commit replaces it; the studio goes on.
    }
    clearDraft(storage);
    patch(withStatus({ notice: null }));
    issue({ params: freshParams(), seed, preset: "default" });
  }

  function revert(): void {
    supersedeAll();
    patch({
      params: committed.params,
      seed: committed.seed,
      preset: committed.preset,
      ...withStatus({ phase: "idle", notice: null }),
    });
  }

  function dismissNotice(): void {
    patch(withStatus({ notice: null }));
  }

  function flush(): void {
    if (persistTimer === null) return;
    clearTimeout(persistTimer);
    persist();
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    unsubscribe();
    client.dispose();
    // After unmount the address bar may belong to another route: save the draft, not the hash.
    if (persistTimer !== null) {
      cancelPersist();
      saveDraft();
    }
  }

  return store;
}

/**
 * A fresh seed (R2-13 item 5): two 32-bit draws from `getRandomValues`, written
 * `a.toString(36) + b.toString(36)`, so an e2e init script can replace `getRandomValues` with a
 * counter and know every seed (F-KEY-02).
 */
export function randomSeed(source: Pick<Crypto, "getRandomValues"> = crypto): string {
  const [a, b] = source.getRandomValues(new Uint32Array(2));
  return a.toString(36) + b.toString(36);
}

/** The store for React: re-renders when the selected value changes. */
export function useStudio<T>(store: StudioStore, selector: (studio: Studio) => T): T {
  return useStore(store, selector);
}

type StudioWindow = Pick<Window, "addEventListener" | "removeEventListener" | "location"> & {
  readonly document: Pick<Document, "addEventListener" | "removeEventListener" | "visibilityState">;
};

/**
 * Connects the store to the browser window: `hashchange` opens the new link (R2-14 item 5), and
 * `pagehide` or a hidden page writes a pending hash and draft at once (C-HASH-13). Returns the
 * function that disconnects it.
 */
export function bindStudioWindow(store: StudioStore, win: StudioWindow): () => void {
  const onHashChange = () => store.getState().loadFromHash(win.location.hash);
  const onPageHide = () => store.getState().flush();
  const onVisibility = () => {
    if (win.document.visibilityState === "hidden") store.getState().flush();
  };
  win.addEventListener("hashchange", onHashChange);
  win.addEventListener("pagehide", onPageHide);
  win.document.addEventListener("visibilitychange", onVisibility);
  return () => {
    win.removeEventListener("hashchange", onHashChange);
    win.removeEventListener("pagehide", onPageHide);
    win.document.removeEventListener("visibilitychange", onVisibility);
  };
}
