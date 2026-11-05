import { describe, expect, it } from "vitest";
import * as ai from "@/ai";
import { createAiActivity } from "@/features/ai/activity";
import { runProviders } from "@/features/ai/router";
import { createdWithOf, failureLines, type StepDeps, stepsFor } from "@/features/ai/steps";
import { KEY_STORAGE } from "@/features/ai/visitor-key";
import {
  BRIEF_IN,
  BRIEF_OUT,
  TEST_KEY,
  TEXT_SLUGS,
  VIBE_IN,
  VISION_SLUGS,
} from "../../ai/fixtures";
import { chatBody, fakeFetch, jsonResponse, MemoryStorage } from "./support";

// The step planner of Task 4.10a (docs/specs/04-ai.md, section 10.1, R4-30, R4-36 and 5.6's
// closing note): the router's steps in R4-30's order with 10.1's skips, the `createdWith` of the
// provider that answered, and the failure sentences, each naming what dyelot used next. No case of
// section 14 names these helpers (their flows are F-BRIEF-04, F-DEV-01 to 05 and F-KEY4-03 and 06),
// so their tests carry the section they come from.

const ORIGIN = "http://localhost:3103";
const SHARED_PATH = { provider: "shared", slug: TEXT_SLUGS[0], tier: "primary", attempts: 1 };
const MODELS = { text: [...TEXT_SLUGS], vision: [...VISION_SLUGS] };

/** A fake `LanguageModel` in `state` whose sessions reply `reply`. */
function fakeModel(state: string, reply = JSON.stringify(BRIEF_OUT)) {
  const calls = { create: 0, prompt: 0 };
  const lm = {
    availability: async () => state,
    create: async () => {
      calls.create += 1;
      return {
        prompt: async () => {
          calls.prompt += 1;
          return reply;
        },
        destroy: () => {},
      };
    },
  };
  return { lm, calls };
}

/** Deps with no key, the switch off, no model and a fetch that answers `answers`. */
function deps(
  answers: Parameters<typeof fakeFetch>[0] = [],
  overrides: Partial<Omit<StepDeps, "fetch">> = {},
) {
  const { fetch, calls } = fakeFetch(answers);
  const activity = overrides.activity ?? createAiActivity();
  const value: StepDeps = {
    lm: undefined,
    onDevice: false,
    stores: { session: new MemoryStorage(), local: new MemoryStorage() },
    referer: ORIGIN,
    ...overrides,
    activity,
    fetch,
  };
  return { deps: value, calls, activity };
}

/** Stores holding the visitor's key in session storage. */
function keyStores() {
  const session = new MemoryStorage();
  session.setItem(KEY_STORAGE, TEST_KEY);
  return { session, local: new MemoryStorage() };
}

const providers = (steps: readonly { provider: string }[]) => steps.map((step) => step.provider);
const signal = () => new AbortController().signal;

describe("10.1 stepsFor plans the router's steps", () => {
  it("10.1 gives only the shared step with the switch off and no key", () => {
    const { lm } = fakeModel("available");
    expect(providers(stepsFor(ai, "brief", BRIEF_IN, deps([], { lm }).deps))).toEqual(["shared"]);
  });

  it("10.1 skips the on-device step when the API is absent, even with the switch on", () => {
    expect(providers(stepsFor(ai, "brief", BRIEF_IN, deps([], { onDevice: true }).deps))).toEqual([
      "shared",
    ]);
  });

  it("10.1 skips the on-device step for vibe, which the on-device model never runs", () => {
    const { lm } = fakeModel("available");
    const planned = deps([], { lm, onDevice: true, stores: keyStores() }).deps;
    expect(providers(stepsFor(ai, "vibe", VIBE_IN, planned))).toEqual(["visitor-key", "shared"]);
  });

  it("10.1 orders on-device, the visitor key and the shared route", () => {
    const { lm } = fakeModel("available");
    const planned = deps([], { lm, onDevice: true, stores: keyStores() }).deps;
    expect(providers(stepsFor(ai, "brief", BRIEF_IN, planned))).toEqual([
      "on-device",
      "visitor-key",
      "shared",
    ]);
  });

  it("10.1 keeps the on-device step for a switch that is on while the model is not there, so its sentence shows", async () => {
    const { lm, calls } = fakeModel("downloadable");
    const planned = deps([], { lm, onDevice: true }).deps;
    const [step] = stepsFor(ai, "brief", BRIEF_IN, planned);
    expect(step?.provider).toBe("on-device");
    expect(await step?.run(signal())).toEqual({
      ok: false,
      failure: { provider: "on-device", reason: "not-downloaded" },
    });
    expect(calls.create).toBe(0);
  });

  it("10.1 answers on-device with the model's output and the on-device path", async () => {
    const { lm, calls } = fakeModel("available");
    const planned = deps([], { lm, onDevice: true }).deps;
    const result = await runProviders(stepsFor(ai, "brief", BRIEF_IN, planned), signal());
    expect(result).toEqual({
      kind: "model",
      output: BRIEF_OUT,
      path: { provider: "on-device" },
      failures: [],
    });
    expect(calls.prompt).toBe(1);
  });

  it("10.1 reads the models, then sends the key to OpenRouter only", async () => {
    const { deps: planned, calls } = deps(
      [jsonResponse(200, MODELS), jsonResponse(200, chatBody(JSON.stringify(BRIEF_OUT)))],
      { stores: keyStores() },
    );
    const [step] = stepsFor(ai, "brief", BRIEF_IN, planned);
    expect(await step?.run(signal())).toEqual({
      ok: true,
      output: BRIEF_OUT,
      path: { provider: "visitor-key", slug: TEXT_SLUGS[0], attempts: 1 },
    });
    expect(calls.map((call) => call.url)).toEqual([
      "/api/ai/models",
      "https://openrouter.ai/api/v1/chat/completions",
    ]);
    expect(JSON.stringify(calls[0]?.init)).not.toContain(TEST_KEY);
    expect(new Headers(calls[1]?.init.headers).get("Authorization")).toBe(`Bearer ${TEST_KEY}`);
  });

  it("10.1 reports no-models with no chat call when the models cannot be read (C-KEY4-06's caller)", async () => {
    const { deps: planned, calls } = deps([jsonResponse(503, { ok: false })], {
      stores: keyStores(),
    });
    const [step] = stepsFor(ai, "brief", BRIEF_IN, planned);
    expect(await step?.run(signal())).toEqual({
      ok: false,
      failure: { provider: "visitor-key", reason: "no-models" },
    });
    expect(calls).toHaveLength(1);
  });

  it("10.1 asks the shared route and records the visitor's remaining actions", async () => {
    const { deps: planned, activity } = deps([
      jsonResponse(200, {
        ok: true,
        feature: "brief",
        result: BRIEF_OUT,
        path: SHARED_PATH,
        remaining: 2,
      }),
    ]);
    const [step] = stepsFor(ai, "brief", BRIEF_IN, planned);
    expect(await step?.run(signal())).toEqual({ ok: true, output: BRIEF_OUT, path: SHARED_PATH });
    expect(activity.getState().shared).toEqual({ remaining: 2, off: false });
  });

  it("10.1 marks the shared quota off after not-configured, and keeps the count after no reply", async () => {
    const { deps: planned, activity } = deps([
      jsonResponse(503, { ok: false, code: "not-configured" }),
      new TypeError("Failed to fetch"),
    ]);
    activity.getState().setShared(1, false);
    const [step] = stepsFor(ai, "brief", BRIEF_IN, planned);
    expect(await step?.run(signal())).toEqual({
      ok: false,
      failure: { provider: "shared", reason: "not-configured" },
    });
    expect(activity.getState().shared).toEqual({ remaining: 1, off: true });
    expect(await step?.run(signal())).toEqual({
      ok: false,
      failure: { provider: "shared", reason: "unreachable" },
    });
    expect(activity.getState().shared).toEqual({ remaining: 1, off: true });
  });

  it("10.1 records nothing from a reply that lands after a cancel", async () => {
    const action = new AbortController();
    const { deps: planned, activity } = deps([
      async () => {
        action.abort();
        return jsonResponse(429, { ok: false, code: "visitor-cap", remaining: 0 });
      },
    ]);
    const [step] = stepsFor(ai, "brief", BRIEF_IN, planned);
    await step?.run(action.signal);
    expect(activity.getState().shared).toEqual({ remaining: null, off: false });
  });

  it("10.1 checks its arguments, each error naming stepsFor", () => {
    const planned = deps().deps;
    expect(() => stepsFor(ai, "brief", BRIEF_IN, null as never)).toThrow(TypeError);
    expect(() => stepsFor(ai, "brief", BRIEF_IN, { ...planned, onDevice: "on" as never })).toThrow(
      /^stepsFor: deps.onDevice/,
    );
    expect(() => stepsFor(ai, "brief", BRIEF_IN, { ...planned, fetch: 1 as never })).toThrow(
      TypeError,
    );
    expect(() => stepsFor(ai, "brief", BRIEF_IN, { ...planned, activity: {} as never })).toThrow(
      /^stepsFor: deps.activity/,
    );
    expect(() => stepsFor(ai, "steer" as never, BRIEF_IN as never, planned)).toThrow(RangeError);
    expect(() => stepsFor(ai, "brief", { brief: "" } as never, planned)).toThrow(RangeError);
  });
});

describe("R4-36 createdWithOf", () => {
  it("R4-36 names the provider that answered, the shared route by its slug", () => {
    expect(createdWithOf({ provider: "on-device" })).toBe("on-device");
    expect(createdWithOf({ provider: "visitor-key", slug: TEXT_SLUGS[0], attempts: 1 })).toBe(
      "visitor-key",
    );
    expect(
      createdWithOf({ provider: "shared", slug: TEXT_SLUGS[1], tier: "fast", attempts: 2 }),
    ).toBe("model:test/text-2:free");
  });

  it("R4-36 refuses the rules, which a model never answers for, and a path that is not one", () => {
    expect(() => createdWithOf({ provider: "rules" } as never)).toThrow(RangeError);
    expect(() => createdWithOf({ provider: "rules" } as never)).toThrow(/^createdWithOf: /);
    expect(() => createdWithOf(null as never)).toThrow(TypeError);
    expect(() => createdWithOf({ provider: "shared", slug: 5 } as never)).toThrow(TypeError);
  });
});

describe("5.6 failureLines", () => {
  it("5.6 names, for each failure, the provider of the next one, else the one that answered", () => {
    expect(
      failureLines(
        ai,
        [
          { provider: "on-device", reason: "not-downloaded" },
          { provider: "visitor-key", reason: "refused" },
        ],
        "brief",
        "shared",
      ),
    ).toEqual([
      "Chrome's built-in model is not downloaded yet, so dyelot used your OpenRouter key.",
      "OpenRouter refused your key, so dyelot used its shared quota.",
    ]);
  });

  it("5.6 names the feature's rules after the last failure when no provider answered", () => {
    expect(
      failureLines(ai, [{ provider: "shared", reason: "visitor-cap" }], "brief", "rules"),
    ).toEqual(["You have used today's 3 shared actions, so dyelot used the word list."]);
    expect(failureLines(ai, [], "brief", "rules")).toEqual([]);
  });

  it("5.6 refuses a list that is not one and an answer before a failure", () => {
    expect(() => failureLines(ai, null as never, "brief", "rules")).toThrow(TypeError);
    expect(() => failureLines(ai, null as never, "brief", "rules")).toThrow(/^failureLines: /);
    expect(() =>
      failureLines(ai, [{ provider: "shared", reason: "busy" }], "brief", "on-device"),
    ).toThrow(RangeError);
  });
});
