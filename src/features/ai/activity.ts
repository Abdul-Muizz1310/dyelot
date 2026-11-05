import { createStore, type StoreApi } from "zustand/vanilla";
import { assertOneOf, describeType } from "@/features/studio/guards";

// The studio's one AI activity (docs/specs/04-ai.md, R4-35, R4-54, R4-56): which of the five
// actions runs, so that the other four wait ("Wait for the current action to finish."); the shared
// quota's last reading for AI settings ("Shared AI: <n> of 3 left today", "Shared AI: off here");
// and the on-device switch the router reads. One activity per studio, made beside its store.

/** The five actions of R4-56, one per feature. */
export const ACTION_NAMES = Object.freeze([
  "brief",
  "vibe",
  "refine",
  "rationale",
  "critique",
] as const);
export type ActionName = (typeof ACTION_NAMES)[number];

/** The shared quota as the last reply told it: the visitor's remaining actions, and whether it is off here. */
export type SharedQuota = { readonly remaining: number | null; readonly off: boolean };

export type AiActivityState = {
  /** The action that runs, or null. */
  readonly running: ActionName | null;
  readonly shared: SharedQuota;
  /** The on-device switch (R4-31), as the visitor set it. */
  readonly onDevice: boolean;
  /**
   * Starts `name`, which its own `controller` can abort; false, and nothing changes, while another
   * action runs. The action keeps its controller: "Cancel" and leaving the studio abort it.
   */
  begin(name: ActionName, controller: AbortController): boolean;
  /** Ends `name`; the end of an action that does not run changes nothing. */
  end(name: ActionName): void;
  /** Records a shared reply: its remaining count (null keeps the last one) and whether the quota is off. */
  setShared(remaining: number | null, off: boolean): void;
  setOnDevice(on: boolean): void;
};
export type AiActivity = StoreApi<AiActivityState>;

/** The visitor's daily shared actions (R4-18): a count runs from 0 to this. */
const VISITOR_CAP = 3;

function assertBoolean(value: unknown, name: string): asserts value is boolean {
  if (typeof value !== "boolean") {
    throw new TypeError(`${name} must be a boolean, got ${describeType(value)}`);
  }
}

/** A new activity: nothing running, the shared count unknown, the switch off. */
export function createAiActivity(): AiActivity {
  return createStore<AiActivityState>()((set, get) => ({
    running: null,
    shared: { remaining: null, off: false },
    onDevice: false,
    begin(name, controller) {
      assertOneOf(name, ACTION_NAMES, "begin: name");
      if (!(controller instanceof AbortController)) {
        throw new TypeError(
          `begin: controller must be an AbortController, got ${describeType(controller)}`,
        );
      }
      if (get().running !== null) return false;
      set({ running: name });
      return true;
    },
    end(name) {
      assertOneOf(name, ACTION_NAMES, "end: name");
      if (get().running !== name) return;
      set({ running: null });
    },
    setShared(remaining, off) {
      if (remaining !== null) {
        if (typeof remaining !== "number") {
          throw new TypeError(
            `setShared: remaining must be a number or null, got ${describeType(remaining)}`,
          );
        }
        if (!Number.isInteger(remaining) || remaining < 0 || remaining > VISITOR_CAP) {
          throw new RangeError(
            `setShared: remaining must be an integer from 0 to ${VISITOR_CAP}, got ${remaining}`,
          );
        }
      }
      assertBoolean(off, "setShared: off");
      set({ shared: { remaining: remaining ?? get().shared.remaining, off } });
    },
    setOnDevice(on) {
      assertBoolean(on, "setOnDevice: on");
      set({ onDevice: on });
    },
  }));
}
