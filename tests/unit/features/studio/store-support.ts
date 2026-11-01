import type { StudioClient } from "@/features/studio/client";
import type { GenerateReply, GenerateRequest } from "@/features/studio/protocol";
import { createStudioStore, type StudioDeps } from "@/features/studio/store";
import type { DesignSpec } from "@/spec";
import { withValue } from "../../spec/support";
import {
  fakeClock,
  fakeLocation,
  generate,
  memoryStorage,
  resolvedFresh,
  seedSequence,
} from "./support";

// The store's fakes for the cases of docs/specs/02-studio.md, sections 6.7 and 6.8: the
// `StubClient` of section 4 and a store builder at `FRESH`.

/**
 * A cheap stand-in for a reply's spec: the real spec of `fresh` with the request's seed in
 * `meta.seed`, its id in `meta.name`, and one number that is not normalized (C-NORM-01's value),
 * so a test sees whether the store normalized it.
 */
export function fakeSpec(request: GenerateRequest, fresh: () => DesignSpec): DesignSpec {
  let spec = withValue(fresh(), ["meta", "seed"], request.seed);
  spec = withValue(spec, ["meta", "name"], `r${request.id}`);
  return withValue(
    spec,
    ["color", "palettes", "primary", "light", 0, "oklch", "l"],
    0.97123456789,
  ) as DesignSpec;
}

export type Stub = ReturnType<typeof stubClient>;

/**
 * The `StubClient` of spec section 4: it records every request and replies only when the test
 * says, in any order. `generateNow` (the first load's fresh design) runs the real generator,
 * memoized; `reply` sends a fake spec unless the test passes one.
 */
export function stubClient() {
  const posted: GenerateRequest[] = [];
  const listeners = new Set<(reply: GenerateReply) => void>();
  let disposed = 0;
  const fresh = () => generate(resolvedFresh(), "seed-1");
  const client: StudioClient = {
    generateNow: (params, seed) => generate(params, seed),
    request: (request) => {
      posted.push(request);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose: () => {
      disposed++;
    },
  };
  const requestOf = (id: number): GenerateRequest => {
    const request = posted.find((item) => item.id === id);
    if (request === undefined) throw new Error(`stub: request ${id} was never posted`);
    return request;
  };
  const deliver = (reply: GenerateReply) => {
    for (const listener of [...listeners]) listener(reply);
  };
  return {
    client,
    posted,
    listeners: () => listeners.size,
    disposals: () => disposed,
    deliver,
    /** Replies to request `id` with `spec`, or with a spec made from the request. */
    reply(id: number, spec?: DesignSpec) {
      deliver({ id, ok: true, spec: spec ?? fakeSpec(requestOf(id), fresh) });
    },
    /** Replies to request `id` with the real generator's spec. */
    replyReal(id: number) {
      const request = requestOf(id);
      deliver({ id, ok: true, spec: generate(request.params, request.seed) });
    },
    fail(
      id: number,
      error = { name: "UnsatisfiableTargetError", message: "Step 500 cannot reach 4.5:1." },
    ) {
      deliver({ id, ok: false, error });
    },
  };
}

/** A store at `FRESH` (or with the given deps), with every fake it was built from. */
export function makeStore(overrides: Partial<StudioDeps> & { stub?: Stub } = {}) {
  const { stub: given, ...deps } = overrides;
  const stub = given ?? stubClient();
  const storage = memoryStorage();
  const clock = fakeClock();
  const newSeed = seedSequence();
  const { location, history } = fakeLocation();
  const all: StudioDeps = {
    client: stub.client,
    storage,
    clock: clock.now,
    newSeed,
    location,
    history,
    ...deps,
  };
  const store = createStudioStore(all);
  return { store, stub, storage, clock, newSeed, location, history, deps: all };
}

/** The newest request the stub has seen. */
export function lastPosted(stub: Stub): GenerateRequest {
  const request = stub.posted[stub.posted.length - 1];
  if (request === undefined) throw new Error("stub: nothing was posted");
  return request;
}
