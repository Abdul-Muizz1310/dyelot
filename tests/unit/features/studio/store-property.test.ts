import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { PRESET_IDS } from "@/engine";
import type { Studio } from "@/features/studio/store";
import { writeHash } from "@/features/studio/url";
import { type DesignSpec, decodeSpec, encodeSpec, normalizeSpec } from "@/spec";
import { fakeSpec, makeStore, type Stub } from "./store-support";
import { freshSpec } from "./support";

// C-STORE-02 of docs/specs/02-studio.md, section 6.7: I-M2-01 after any sequence of actions, 25
// runs. Every reply carries a spec that is not normalized, so the property fails if the store keeps
// one as it arrived. The same runs check I-M2-02: once every reply has arrived, `spec` is the spec
// of the newest request that undo, redo, revert or a load did not supersede.

type Command =
  | { readonly kind: "setParams"; readonly radius: "sharp" | "soft" | "round" }
  | { readonly kind: "coalesced"; readonly chroma: "muted" | "balanced" | "vivid" }
  | { readonly kind: "regenerate" }
  | { readonly kind: "applyPreset"; readonly id: (typeof PRESET_IDS)[number] }
  | { readonly kind: "toggleLock"; readonly slot: "primary" | "secondary" | "accent" }
  | { readonly kind: "setSeedColor"; readonly hex: string }
  | { readonly kind: "undo" }
  | { readonly kind: "redo" }
  | { readonly kind: "revert" }
  | { readonly kind: "load"; readonly n: number }
  | { readonly kind: "startFresh" }
  | { readonly kind: "reply"; readonly pick: number }
  | { readonly kind: "fail"; readonly pick: number }
  | { readonly kind: "wait"; readonly ms: number };

const command: fc.Arbitrary<Command> = fc.oneof(
  fc.record({ kind: fc.constant("setParams"), radius: fc.constantFrom("sharp", "soft", "round") }),
  fc.record({
    kind: fc.constant("coalesced"),
    chroma: fc.constantFrom("muted", "balanced", "vivid"),
  }),
  fc.constant({ kind: "regenerate" } as const),
  fc.record({ kind: fc.constant("applyPreset"), id: fc.constantFrom(...PRESET_IDS) }),
  fc.record({
    kind: fc.constant("toggleLock"),
    slot: fc.constantFrom("primary", "secondary", "accent"),
  }),
  fc.record({
    kind: fc.constant("setSeedColor"),
    hex: fc.constantFrom("#1f6f5b", "#a33b20", "#3355cc"),
  }),
  fc.constant({ kind: "undo" } as const),
  fc.constant({ kind: "redo" } as const),
  fc.constant({ kind: "revert" } as const),
  fc.record({ kind: fc.constant("load"), n: fc.integer({ min: 0, max: 3 }) }),
  fc.constant({ kind: "startFresh" } as const),
  fc.record({ kind: fc.constant("reply"), pick: fc.nat() }),
  fc.record({ kind: fc.constant("reply"), pick: fc.nat() }),
  fc.record({ kind: fc.constant("fail"), pick: fc.nat() }),
  fc.record({ kind: fc.constant("wait"), ms: fc.integer({ min: 0, max: 1_500 }) }),
);

/** The links a run can load: fake designs that are not FRESH's. */
const LINKS = [0, 1, 2, 3].map((n) =>
  writeHash(
    normalizeSpec(fakeSpec({ id: 900 + n, params: {} as never, seed: `link-${n}` }, freshSpec)),
  ),
);

const snapshotOf = (studio: Studio) => [
  studio.spec,
  studio.seed,
  studio.history.length,
  studio.future.length,
];

/** Every spec the store holds: the state's, and each snapshot's in history and future. */
const heldSpecs = (studio: Studio): DesignSpec[] => [
  studio.spec,
  ...studio.history.map((snapshot) => snapshot.spec),
  ...studio.future.map((snapshot) => snapshot.spec),
];

/** Runs a command; returns whether it superseded every request issued so far. */
function run(
  studio: () => Studio,
  stub: Stub,
  open: number[],
  cmd: Command,
  tick: (ms: number) => void,
): boolean {
  const before = snapshotOf(studio());
  const changed = () => JSON.stringify(snapshotOf(studio())) !== JSON.stringify(before);
  switch (cmd.kind) {
    case "setParams":
      studio().setParams({ radius: cmd.radius });
      return false;
    case "coalesced":
      studio().setParams({ chroma: cmd.chroma }, { coalesce: "chroma" });
      return false;
    case "regenerate":
      studio().regenerate();
      return false;
    case "applyPreset":
      studio().applyPreset(cmd.id);
      return false;
    case "toggleLock":
      studio().toggleLock(cmd.slot);
      return false;
    case "setSeedColor":
      studio().setSeedColor("primary", cmd.hex, { coalesce: "seed:primary" });
      return false;
    case "undo":
    case "redo":
      studio()[cmd.kind]();
      return changed();
    case "revert":
      studio().revert();
      return true;
    case "load":
      studio().loadFromHash(LINKS[cmd.n] ?? "");
      return changed();
    case "startFresh":
      studio().startFresh();
      return true;
    case "reply":
    case "fail": {
      if (open.length === 0) return false;
      const [id] = open.splice(cmd.pick % open.length, 1);
      if (id === undefined) return false;
      if (cmd.kind === "reply") stub.reply(id);
      else stub.fail(id);
      return false;
    }
    case "wait":
      tick(cmd.ms);
      return false;
  }
}

describe("the store's invariants under any sequence of actions", () => {
  it("C-STORE-02 every held spec round-trips through the link (I-M2-01), and I-M2-02 holds", () => {
    fc.assert(
      fc.property(
        fc.array(command, { maxLength: 30 }),
        fc.array(fc.nat(), { maxLength: 40 }),
        (commands, order) => {
          const { store, stub, clock } = makeStore();
          const studio = () => store.getState();
          const open: number[] = [];
          let newest: number | null = null;
          let failed = false;
          for (const cmd of commands) {
            const posted = stub.posted.length;
            const superseded = run(studio, stub, open, cmd, (ms) => clock.advance(ms));
            for (const request of stub.posted.slice(posted)) open.push(request.id);
            if (stub.posted.length > posted) {
              newest = stub.posted[stub.posted.length - 1]?.id ?? null;
              failed = false;
            } else if (superseded) {
              newest = null;
            }
            if (cmd.kind === "fail" && studio().status.phase === "failed") failed = true;
          }
          let turn = 0;
          while (open.length > 0) {
            const [id] = open.splice((order[turn++] ?? 0) % open.length, 1);
            if (id !== undefined) stub.reply(id);
          }
          for (const spec of heldSpecs(studio())) {
            expect(decodeSpec(encodeSpec(spec))).toEqual(spec);
          }
          if (newest !== null && !failed) {
            expect(studio().spec.meta.name).toBe(`r${newest}`);
            expect(studio().status.phase).toBe("idle");
          }
          expect(studio().status.phase).not.toBe("generating");
          studio().dispose();
        },
      ),
      { numRuns: 25 },
    );
  });
});
