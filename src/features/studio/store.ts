import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";
import {
  ColorParseError,
  DEFICIENCIES,
  type Deficiency,
  type Density,
  type DirectionParams,
  LOCKABLE,
  type Lockable,
  type Mode,
  normalizeSeed,
  type Oklch,
  type PaletteName,
  PRESET_IDS,
  PRESETS,
  type PresetId,
  parseColor,
  applyPreset as presetParams,
  type Step,
} from "@/engine";
import { type DesignSpec, normalizeSpec, specId } from "@/spec";
import type { StudioClient } from "./client";
import {
  clearDraft,
  type Draft,
  isStorage,
  readDraft,
  type Snapshot,
  type StorageLike,
  writeDraft,
} from "./drafts";
import { assertOneOf, assertRecord, assertString, describeType, isRecord } from "./guards";
import {
  type DeepPartial,
  freshParams,
  lockSeed,
  type ParamsPatch,
  paramsOfSpec,
  resolveParams,
  sameParams,
  touchesPreset,
} from "./params";
import type { GenerateReply } from "./protocol";
import { type HashResult, type Notice, readHash, writeHash } from "./url";

// The studio store (spec section 5.7, R2-13, R2-14, R2-17, R2-28, R2-29). Every change is a
// numbered request to the generator through `deps.client`; a reply applies only when its id is
// above the last applied one, so out-of-order replies never leave the canvas on a stale spec
// (Review Focus 4). A change commits when its reply applies: the previous snapshot goes onto
// `history`, and the link in the hash and the draft follow 300 ms later.

export type { Snapshot, StorageLike } from "./drafts";
export type { DeepPartial, ParamsPatch } from "./params";
export type { Notice } from "./url";

export type TemplateId =
  | "landing"
  | "dashboard"
  | "settings"
  | "mobile"
  | "editorial"
  | "kitchen-sink";
export type Highlight = {
  readonly roles: readonly string[];
  readonly cells: readonly { readonly palette: PaletteName; readonly step: Step }[];
};
export type View = {
  readonly mode: Mode;
  readonly density: Density;
  readonly frame: 360 | 768 | 1280;
  readonly template: TemplateId;
  readonly reducedMotion: boolean;
  readonly copy: "real" | "edge";
  readonly vision: "none" | Deficiency;
  readonly highlight: Highlight | null;
};
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
};
export type StudioActions = {
  setParams(patch: ParamsPatch, options?: { coalesce?: string }): void;
  applyPreset(id: PresetId): void;
  /** A new seed from `deps.newSeed`, with the coalesce key "regenerate". */
  regenerate(): void;
  toggleLock(slot: Lockable): void;
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

const TEMPLATE_IDS: readonly TemplateId[] = [
  "landing",
  "dashboard",
  "settings",
  "mobile",
  "editorial",
  "kitchen-sink",
];
const MODES: readonly Mode[] = ["light", "dark"];
const DENSITIES: readonly Density[] = ["comfortable", "compact", "dense"];
const FRAMES: readonly View["frame"][] = [360, 768, 1280];
const COPIES: readonly View["copy"][] = ["real", "edge"];
const VISIONS: readonly View["vision"][] = ["none", ...DEFICIENCIES];

const DEFAULT_VIEW: View = {
  mode: "light",
  density: "comfortable",
  frame: 1280,
  template: "landing",
  reducedMotion: false,
  copy: "real",
  vision: "none",
  highlight: null,
};

/** Notices that a successful commit answers: the failure is over, the fonts are reset. */
const CLEARED_BY_COMMIT: ReadonlySet<Notice["kind"]> = new Set(["generation", "custom-fonts"]);

/** The parameters and the preset a request asks for, and the seed it uses. */
type Intent = {
  readonly params: DirectionParams;
  readonly seed: string;
  readonly preset: PresetId | null;
};
type Issued = Intent & { readonly coalesce: string | undefined; readonly at: number };

const PATCH_KEYS: ReadonlySet<string> = new Set([
  ...LOCKABLE,
  "harmony",
  "chroma",
  "neutralTint",
  "gamut",
  "scaleMode",
  "contrastLevel",
  "type",
  "radius",
  "depth",
  "motion",
  "pairing",
  "name",
]);

/** Whether `value` has a whole color's shape; `normalizeSeed` checks its domain later. */
const isColor = (value: unknown): value is Oklch =>
  isRecord(value) &&
  typeof value.l === "number" &&
  typeof value.c === "number" &&
  (value.h === null || typeof value.h === "number");

/** A seed of a patch: undefined removes it (unlocks), a whole color sets it. */
function seedOfPatch(value: DeepPartial<Oklch> | undefined, slot: Lockable): Oklch | undefined {
  if (value === undefined) return undefined;
  if (!isColor(value)) {
    throw new TypeError(
      `setParams: patch.${slot} must be a whole color with l, c and h, got ${describeType(value)}`,
    );
  }
  return value;
}

/** The parameters with the seed of `slot` set, or removed when `seed` is undefined. */
function withSeed(
  params: DirectionParams,
  slot: Lockable,
  seed: Oklch | undefined,
): DirectionParams {
  const { primary, secondary, accent, ...rest } = params;
  const seeds: Partial<Record<Lockable, Oklch>> = { primary, secondary, accent, [slot]: seed };
  return {
    ...rest,
    ...(seeds.primary === undefined ? {} : { primary: seeds.primary }),
    ...(seeds.secondary === undefined ? {} : { secondary: seeds.secondary }),
    ...(seeds.accent === undefined ? {} : { accent: seeds.accent }),
  };
}

function mergeType(
  current: DirectionParams["type"],
  patch: DeepPartial<DirectionParams["type"]>,
): DirectionParams["type"] {
  assertRecord(patch, "setParams: patch.type");
  for (const key of Object.keys(patch)) {
    if (key !== "context" && key !== "ratio") {
      throw new RangeError(`setParams: patch.type.${key} is not a type parameter`);
    }
  }
  if (Object.hasOwn(patch, "context") && patch.context === undefined) {
    throw new TypeError("setParams: patch.type.context cannot be removed");
  }
  const context = patch.context ?? current.context;
  const ratio = Object.hasOwn(patch, "ratio") ? patch.ratio : current.ratio;
  return ratio === undefined ? { context } : { context, ratio };
}

/**
 * The parameters after a patch (spec section 5.7): `type` merges by key, a whole seed color
 * replaces a seed, and an optional key set to undefined is removed (`pairing: undefined` is auto).
 * Values are not checked here: the generator checks them, and a bad one ends in a `generation`
 * notice (C-STORE-20). Keys and shapes are checked, so the result always has the parameters' form.
 */
function mergeParams(params: DirectionParams, patch: ParamsPatch): DirectionParams {
  for (const key of Object.keys(patch)) {
    if (!PATCH_KEYS.has(key))
      throw new RangeError(`setParams: patch.${key} is not a direction parameter`);
  }
  const { primary, secondary, accent, pairing, name, type, ...choices } = patch;
  for (const [key, value] of Object.entries(choices)) {
    if (value === undefined) throw new TypeError(`setParams: patch.${key} cannot be removed`);
  }
  if (Object.hasOwn(patch, "type") && type === undefined) {
    throw new TypeError("setParams: patch.type cannot be removed");
  }
  let next: DirectionParams = {
    ...params,
    ...choices,
    type: type === undefined ? params.type : mergeType(params.type, type),
  };
  for (const [slot, value] of [
    ["primary", primary],
    ["secondary", secondary],
    ["accent", accent],
  ] as const) {
    if (Object.hasOwn(patch, slot)) next = withSeed(next, slot, seedOfPatch(value, slot));
  }
  if (Object.hasOwn(patch, "pairing")) {
    const { pairing: _old, ...rest } = next;
    next = pairing === undefined ? rest : { ...rest, pairing };
  }
  if (Object.hasOwn(patch, "name")) {
    const { name: _old, ...rest } = next;
    next = name === undefined ? rest : { ...rest, name };
  }
  return next;
}

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

function checkHighlight(value: unknown): void {
  if (value === null) return;
  assertRecord(value, "setView: patch.highlight");
  if (!Array.isArray(value.roles) || !Array.isArray(value.cells)) {
    throw new TypeError("setView: patch.highlight must hold roles and cells arrays");
  }
}

/** The view after a patch, every value checked (R-05). */
function mergeView(view: View, patch: Partial<View>): View {
  assertRecord(patch, "setView: patch");
  for (const [key, value] of Object.entries(patch)) {
    const name = `setView: patch.${key}`;
    switch (key) {
      case "mode":
        assertOneOf(value, MODES, name);
        break;
      case "density":
        assertOneOf(value, DENSITIES, name);
        break;
      case "template":
        assertOneOf(value, TEMPLATE_IDS, name);
        break;
      case "copy":
        assertOneOf(value, COPIES, name);
        break;
      case "vision":
        assertOneOf(value, VISIONS, name);
        break;
      case "frame":
        if (!FRAMES.includes(value as View["frame"])) {
          throw new RangeError(`${name} must be one of ${FRAMES.join(", ")}, got ${String(value)}`);
        }
        break;
      case "reducedMotion":
        if (typeof value !== "boolean") {
          throw new TypeError(`${name} must be a boolean, got ${describeType(value)}`);
        }
        break;
      case "highlight":
        checkHighlight(value);
        break;
      default:
        throw new RangeError(`${name} is not a view setting`);
    }
  }
  return { ...view, ...patch };
}

function checkDeps(deps: StudioDeps): void {
  assertRecord(deps, "createStudioStore: deps");
  const { client, storage, clock, newSeed, location, history } = deps;
  assertRecord(client, "createStudioStore: deps.client");
  for (const method of ["generateNow", "request", "subscribe", "dispose"] as const) {
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
      snapshot: { params: draft.params, seed: draft.seed, spec, preset: draft.preset },
      customFonts: false,
    };
  }
  const { params, customFonts } = paramsOfSpec(spec);
  return { snapshot: { params, seed: spec.meta.seed, spec, preset: null }, customFonts };
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
    return { params, seed, spec, preset: "default" };
  }

  function firstLoad(): { snapshot: Snapshot; notice: Notice | null } {
    const link = readHash(location.hash);
    const draft = readDraft(storage);
    if (link.kind === "spec") {
      const { snapshot, customFonts } = snapshotOf(link.spec, draft);
      return { snapshot, notice: customFonts ? { kind: "custom-fonts" } : null };
    }
    if (draft !== null) {
      const { snapshot } = snapshotOf(draft.spec, draft);
      return {
        snapshot,
        notice: link.kind === "error" ? linkNotice(link, "draft") : { kind: "draft-restored" },
      };
    }
    return { snapshot: fresh(), notice: link.kind === "error" ? linkNotice(link, "fresh") : null };
  }

  const first = firstLoad();
  /** The last committed snapshot: what `spec` shows, what undo pushes and the draft saves. */
  let committed: Snapshot = first.snapshot;

  const store = createStore<Studio>()(() => ({
    ...committed,
    history: [],
    future: [],
    status: { phase: "idle", notice: first.notice, draft: storage === null ? "off" : "on" },
    view: DEFAULT_VIEW,
    setParams,
    applyPreset,
    regenerate,
    toggleLock,
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
    const next = mergeParams(params, change);
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
    const notice = status.notice?.kind === "generation" ? null : status.notice;
    patch({ ...snapshot, history, future, status: { ...status, phase: "idle", notice } });
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
    const next = mergeView(view, change);
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
