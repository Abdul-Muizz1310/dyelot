import { afterEach, describe, expect, it, vi } from "vitest";
import * as ai from "@/ai";
import {
  askOnDevice,
  downloadModel,
  ON_DEVICE_STORAGE,
  onDeviceState,
  promptOnDevice,
  readToggle,
  writeToggle,
} from "@/features/ai/on-device";
import {
  BRIEF_IN,
  BRIEF_OUT,
  CRITIQUE_IN,
  CRITIQUE_OUT,
  REFINE_IN,
  VIBE_IN,
} from "../../ai/fixtures";
import { MemoryStorage, THROWING_STORAGE } from "./support";

// C-DEV-01 to C-DEV-04 of docs/specs/04-ai.md, section 14.9 (R4-31, DR-0039, section 10.2): Chrome's
// Prompt API on the main thread, through a fake LanguageModel. The state is read in try/catch, a
// session is made with R4-31's options and destroyed on every path, and the reply is read as
// readReply reads one (JSON, then parseOutput).

const OPTIONS = {
  expectedInputs: [{ type: "text", languages: ["en"] }],
  expectedOutputs: [{ type: "text", languages: ["en"] }],
};

type Fake = {
  availability?: unknown;
  reply?: string | ((input: unknown, options: { signal: AbortSignal }) => Promise<string>);
  create?: (options: Record<string, unknown>) => Promise<unknown>;
  destroy?: () => void;
};

/** A fake `LanguageModel` that records its calls. */
function fakeLm(fake: Fake = {}) {
  const destroy = vi.fn(fake.destroy ?? (() => {}));
  const prompt = vi.fn(async (input: unknown, options: { signal: AbortSignal }) => {
    const reply = fake.reply ?? JSON.stringify(BRIEF_OUT);
    return typeof reply === "function" ? reply(input, options) : reply;
  });
  const session = { prompt, destroy };
  const availability = vi.fn(async (_options: unknown) => {
    const state = fake.availability ?? "available";
    if (state instanceof Error) throw state;
    return state;
  });
  const create = vi.fn(fake.create ?? (async (_options: Record<string, unknown>) => session));
  return { lm: { availability, create }, availability, create, prompt, destroy };
}

const signal = () => new AbortController().signal;
const parsed = <F extends ai.AiFeature>(
  feature: F,
  input: ai.FeatureInput[F],
  output: unknown,
): ai.FeatureOutput[F] => {
  const result = ai.parseOutput(feature, input, output);
  if (!result.ok) throw new Error(`${feature} fixture must parse`);
  return result.output;
};
const FAILED = { ok: false, failure: { provider: "on-device", reason: "failed" } };

afterEach(() => {
  vi.useRealTimers();
});

describe("C-DEV-01 onDeviceState", () => {
  it("C-DEV-01 is absent when there is no LanguageModel", async () => {
    expect(await onDeviceState(undefined)).toBe("absent");
    expect(await onDeviceState(null)).toBe("absent");
  });

  it.each(["unavailable", "downloadable", "downloading", "available"])(
    "C-DEV-01 returns %s from availability, called with exactly R4-31's options",
    async (state) => {
      const fake = fakeLm({ availability: state });
      expect(await onDeviceState(fake.lm)).toBe(state);
      expect(fake.availability).toHaveBeenCalledTimes(1);
      expect(fake.availability.mock.calls[0]?.[0]).toEqual(OPTIONS);
    },
  );

  it("C-DEV-01 reads a LanguageModel that is a function with static members, as Chrome's class is", async () => {
    const languageModel = Object.assign(function languageModel() {}, {
      availability: async () => "downloadable",
    });
    expect(typeof languageModel).toBe("function");
    expect(await onDeviceState(languageModel)).toBe("downloadable");
  });

  it("C-DEV-01 reads a throw, a rejection, an unknown answer or no availability as unavailable", async () => {
    expect(await onDeviceState(fakeLm({ availability: new TypeError("bad options") }).lm)).toBe(
      "unavailable",
    );
    const syncThrow = {
      availability() {
        throw new DOMException("", "NotSupportedError");
      },
    };
    expect(await onDeviceState(syncThrow)).toBe("unavailable");
    expect(await onDeviceState(fakeLm({ availability: "readily" }).lm)).toBe("unavailable");
    expect(await onDeviceState(fakeLm({ availability: 1 }).lm)).toBe("unavailable");
    expect(await onDeviceState({})).toBe("unavailable");
    expect(await onDeviceState(42)).toBe("unavailable");
  });
});

describe("C-DEV-02 askOnDevice", () => {
  it("C-DEV-02 creates a session with the options, the system message and the signal", async () => {
    const fake = fakeLm();
    await askOnDevice(ai, "brief", BRIEF_IN, { lm: fake.lm, signal: signal() });
    const { system } = ai.chatMessages("brief", BRIEF_IN);
    expect(fake.create).toHaveBeenCalledTimes(1);
    const options = fake.create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(Object.keys(options).sort()).toEqual(
      ["expectedInputs", "expectedOutputs", "initialPrompts", "signal"].sort(),
    );
    expect(options.expectedInputs).toEqual(OPTIONS.expectedInputs);
    expect(options.expectedOutputs).toEqual(OPTIONS.expectedOutputs);
    expect(options.initialPrompts).toEqual([{ role: "system", content: system }]);
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it("C-DEV-02 prompts with the user message and the response constraint, not put into the context twice", async () => {
    const fake = fakeLm();
    await askOnDevice(ai, "brief", BRIEF_IN, { lm: fake.lm, signal: signal() });
    expect(fake.prompt).toHaveBeenCalledTimes(1);
    const [input, options] = fake.prompt.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(input).toBe(ai.chatMessages("brief", BRIEF_IN).user);
    expect(Object.keys(options).sort()).toEqual(
      ["omitResponseConstraintInput", "responseConstraint", "signal"].sort(),
    );
    expect(options.responseConstraint).toEqual(ai.outputJsonSchema("brief", BRIEF_IN));
    expect(options.responseConstraint).not.toHaveProperty("$schema");
    expect(options.omitResponseConstraintInput).toBe(true);
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it("C-DEV-02 parses the reply, then destroys the session", async () => {
    const fake = fakeLm();
    const result = await askOnDevice(ai, "brief", BRIEF_IN, { lm: fake.lm, signal: signal() });
    expect(result).toEqual({ ok: true, output: parsed("brief", BRIEF_IN, BRIEF_OUT) });
    expect(fake.destroy).toHaveBeenCalledTimes(1);
  });

  it("C-DEV-02 runs the other text features and reads a reply in a code fence as readReply does", async () => {
    const fake = fakeLm({ reply: `\`\`\`json\n${JSON.stringify(CRITIQUE_OUT)}\n\`\`\`` });
    const result = await askOnDevice(ai, "critique", CRITIQUE_IN, {
      lm: fake.lm,
      signal: signal(),
    });
    expect(result).toEqual({ ok: true, output: parsed("critique", CRITIQUE_IN, CRITIQUE_OUT) });
  });

  it("C-DEV-02 joins the action's signal: canceling the action aborts the session's and the prompt's", async () => {
    const action = new AbortController();
    const seen: AbortSignal[] = [];
    const fake = fakeLm({
      reply: (_input, options) => {
        seen.push(options.signal);
        action.abort();
        return Promise.resolve(JSON.stringify(BRIEF_OUT));
      },
    });
    const result = await askOnDevice(ai, "brief", BRIEF_IN, { lm: fake.lm, signal: action.signal });
    const created = fake.create.mock.calls[0]?.[0] as { signal: AbortSignal } | undefined;
    expect(created?.signal.aborted).toBe(true);
    expect(seen[0]?.aborted).toBe(true);
    expect(result).toEqual(FAILED);
    expect(fake.destroy).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["downloadable", "not-downloaded"],
    ["downloading", "not-downloaded"],
    ["unavailable", "unavailable"],
  ])("C-DEV-02 gives %s as %s without create", async (state, reason) => {
    const fake = fakeLm({ availability: state });
    expect(await askOnDevice(ai, "brief", BRIEF_IN, { lm: fake.lm, signal: signal() })).toEqual({
      ok: false,
      failure: { provider: "on-device", reason },
    });
    expect(fake.create).not.toHaveBeenCalled();
  });

  it("C-DEV-02 gives absent as unavailable without create", async () => {
    expect(await askOnDevice(ai, "brief", BRIEF_IN, { lm: undefined, signal: signal() })).toEqual({
      ok: false,
      failure: { provider: "on-device", reason: "unavailable" },
    });
  });

  it("C-DEV-02 gives failed for a create that throws or rejects, with nothing to destroy", async () => {
    const rejecting = fakeLm({
      create: async () => {
        throw new DOMException("", "NotSupportedError");
      },
    });
    expect(
      await askOnDevice(ai, "brief", BRIEF_IN, { lm: rejecting.lm, signal: signal() }),
    ).toEqual(FAILED);
    const throwing = fakeLm();
    const lm = {
      availability: throwing.availability,
      create() {
        throw new TypeError("create");
      },
    };
    expect(await askOnDevice(ai, "brief", BRIEF_IN, { lm, signal: signal() })).toEqual(FAILED);
    const odd = fakeLm({ create: async () => ({ prompt: "not a function" }) });
    expect(await askOnDevice(ai, "brief", BRIEF_IN, { lm: odd.lm, signal: signal() })).toEqual(
      FAILED,
    );
  });

  it("C-DEV-02 gives failed for a prompt that throws or answers with something other than text, and destroys", async () => {
    for (const reply of [
      () => Promise.reject(new DOMException("", "SyntaxError")),
      () => {
        throw new DOMException("", "QuotaExceededError");
      },
      () => Promise.resolve(42 as unknown as string),
    ]) {
      const fake = fakeLm({ reply: reply as Fake["reply"] });
      expect(await askOnDevice(ai, "brief", BRIEF_IN, { lm: fake.lm, signal: signal() })).toEqual(
        FAILED,
      );
      expect(fake.destroy).toHaveBeenCalledTimes(1);
    }
  });

  it("C-DEV-02 gives failed for a prompt still running at 60,000 ms, aborts it and destroys the session", async () => {
    vi.useFakeTimers();
    let promptSignal: AbortSignal | undefined;
    const fake = fakeLm({
      reply: (_input, options) => {
        promptSignal = options.signal;
        return new Promise<string>(() => {});
      },
    });
    let settled = false;
    const pending = askOnDevice(ai, "brief", BRIEF_IN, { lm: fake.lm, signal: signal() }).then(
      (result) => {
        settled = true;
        return result;
      },
    );
    await vi.advanceTimersByTimeAsync(59_999);
    expect(settled).toBe(false);
    expect(promptSignal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toEqual(FAILED);
    expect(promptSignal?.aborted).toBe(true);
    expect(fake.destroy).toHaveBeenCalledTimes(1);
  });

  it("C-DEV-02 counts the 60,000 ms from the start, and ends a session that arrives after it", async () => {
    vi.useFakeTimers();
    let resolveCreate: (session: unknown) => void = () => {};
    const fake = fakeLm({
      create: () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
    });
    const pending = askOnDevice(ai, "brief", BRIEF_IN, { lm: fake.lm, signal: signal() });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(await pending).toEqual(FAILED);
    const late = { prompt: vi.fn(), destroy: vi.fn() };
    resolveCreate(late);
    await vi.advanceTimersByTimeAsync(0);
    expect(late.destroy).toHaveBeenCalledTimes(1);
    expect(late.prompt).not.toHaveBeenCalled();
  });

  it.each([
    ["is not JSON", "nope"],
    ["fails the schema", "{}"],
    ["fails a value check", JSON.stringify({ ...BRIEF_OUT, name: "Teal #00ffaa" })],
    ["is empty", ""],
  ])("C-DEV-02 gives failed for a reply that %s, and destroys the session", async (_, reply) => {
    const fake = fakeLm({ reply });
    expect(await askOnDevice(ai, "brief", BRIEF_IN, { lm: fake.lm, signal: signal() })).toEqual(
      FAILED,
    );
    expect(fake.destroy).toHaveBeenCalledTimes(1);
  });

  it("C-DEV-02 keeps a good reply when destroy throws", async () => {
    const fake = fakeLm({
      destroy: () => {
        throw new Error("destroyed twice");
      },
    });
    expect(
      await askOnDevice(ai, "brief", BRIEF_IN, { lm: fake.lm, signal: signal() }),
    ).toMatchObject({
      ok: true,
    });
  });

  it("C-DEV-02 makes no session for an action canceled before it starts", async () => {
    const action = new AbortController();
    action.abort();
    const fake = fakeLm();
    expect(
      await askOnDevice(ai, "brief", BRIEF_IN, { lm: fake.lm, signal: action.signal }),
    ).toEqual(FAILED);
    expect(fake.create).not.toHaveBeenCalled();
  });

  it("C-DEV-02 promptOnDevice gives the raw reply and throws on a failure", async () => {
    const fake = fakeLm({ reply: "raw text" });
    expect(await promptOnDevice(ai, "refine", REFINE_IN, { lm: fake.lm, signal: signal() })).toBe(
      "raw text",
    );
    expect(fake.destroy).toHaveBeenCalledTimes(1);
    const failing = fakeLm({ create: async () => Promise.reject(new Error("no model")) });
    await expect(
      promptOnDevice(ai, "brief", BRIEF_IN, { lm: failing.lm, signal: signal() }),
    ).rejects.toThrow();
    await expect(
      promptOnDevice(ai, "brief", BRIEF_IN, { lm: undefined, signal: signal() }),
    ).rejects.toThrow(/^promptOnDevice: lm must be a LanguageModel/);
  });

  it("C-DEV-02 never runs vibe on-device and checks what it is asked", async () => {
    const fake = fakeLm();
    const deps = { lm: fake.lm, signal: signal() };
    const wrong = (value: unknown) => value as never;
    await expect(askOnDevice(ai, "vibe", VIBE_IN, deps)).rejects.toThrow(
      /^askOnDevice: the on-device model never runs vibe/,
    );
    await expect(promptOnDevice(ai, "vibe", VIBE_IN, deps)).rejects.toThrow(RangeError);
    await expect(askOnDevice(ai, wrong("poem"), wrong(BRIEF_IN), deps)).rejects.toThrow(RangeError);
    await expect(askOnDevice(ai, "brief", wrong({ brief: "" }), deps)).rejects.toThrow(
      /^askOnDevice: input is not a brief input/,
    );
    await expect(
      askOnDevice(ai, "brief", BRIEF_IN, { lm: fake.lm, signal: wrong(null) }),
    ).rejects.toThrow(/^askOnDevice: deps\.signal must be an AbortSignal/);
    expect(fake.availability).not.toHaveBeenCalled();
  });
});

describe("C-DEV-03 downloadModel", () => {
  /** A create that reports these fractions through the monitor, then gives a session. */
  function downloading(fractions: readonly unknown[]) {
    const destroy = vi.fn();
    const create = vi.fn(async (options: Record<string, unknown>) => {
      const target = new EventTarget();
      (options.monitor as (monitor: EventTarget) => void)(target);
      for (const loaded of fractions) {
        target.dispatchEvent(Object.assign(new Event("downloadprogress"), { loaded }));
      }
      return { prompt: vi.fn(), destroy };
    });
    return { lm: { availability: vi.fn(), create }, create, destroy };
  }

  it("C-DEV-03 reports 0, 0.5 and 1 from downloadprogress, destroys the session and resolves true", async () => {
    const fake = downloading([0, 0.5, 1]);
    const onProgress = vi.fn();
    const action = signal();
    expect(await downloadModel(fake.lm, { onProgress, signal: action })).toBe(true);
    expect(onProgress.mock.calls.map(([fraction]) => fraction)).toEqual([0, 0.5, 1]);
    expect(fake.destroy).toHaveBeenCalledTimes(1);
    const options = fake.create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(options.expectedInputs).toEqual(OPTIONS.expectedInputs);
    expect(options.expectedOutputs).toEqual(OPTIONS.expectedOutputs);
    expect(options.signal).toBe(action);
    expect(typeof options.monitor).toBe("function");
  });

  it("C-DEV-03 passes on no fraction outside 0 to 1", async () => {
    const onProgress = vi.fn();
    await downloadModel(downloading([-0.1, Number.NaN, "0.5", 1.5, 0.25]).lm, {
      onProgress,
      signal: signal(),
    });
    expect(onProgress.mock.calls).toEqual([[0.25]]);
  });

  it("C-DEV-03 resolves false for a create that throws or rejects, or no LanguageModel", async () => {
    const rejecting = { create: async () => Promise.reject(new DOMException("", "NetworkError")) };
    const throwing = {
      create() {
        throw new TypeError("create");
      },
    };
    for (const lm of [rejecting, throwing, undefined, {}]) {
      expect(await downloadModel(lm, { onProgress: vi.fn(), signal: signal() })).toBe(false);
    }
  });

  it("C-DEV-03 throws TypeError naming downloadModel for a callback or signal of the wrong type", async () => {
    const fake = downloading([1]);
    await expect(
      downloadModel(fake.lm, { onProgress: null as never, signal: signal() }),
    ).rejects.toThrow(/^downloadModel: deps\.onProgress must be a function/);
    await expect(
      downloadModel(fake.lm, { onProgress: vi.fn(), signal: {} as never }),
    ).rejects.toThrow(TypeError);
    expect(fake.create).not.toHaveBeenCalled();
  });
});

describe("C-DEV-04 the on-device switch in local storage", () => {
  it("C-DEV-04 readToggle is false by default and for any value but on", () => {
    expect(readToggle(null)).toBe(false);
    const local = new MemoryStorage();
    expect(readToggle(local)).toBe(false);
    for (const value of ["true", "1", "ON", "on ", "off", ""]) {
      local.setItem(ON_DEVICE_STORAGE, value);
      expect(readToggle(local), value).toBe(false);
    }
    local.setItem(ON_DEVICE_STORAGE, "on");
    expect(readToggle(local)).toBe(true);
  });

  it("C-DEV-04 readToggle is false when storage throws", () => {
    expect(readToggle(THROWING_STORAGE)).toBe(false);
  });

  it("C-DEV-04 writeToggle writes on or removes the key, and swallows a storage that throws", () => {
    const local = new MemoryStorage();
    writeToggle(local, true);
    expect(local.getItem(ON_DEVICE_STORAGE)).toBe("on");
    writeToggle(local, false);
    expect(local.items.has(ON_DEVICE_STORAGE)).toBe(false);
    expect(() => writeToggle(THROWING_STORAGE, true)).not.toThrow();
    expect(() => writeToggle(null, true)).not.toThrow();
  });

  it("C-DEV-04 throws TypeError naming the function for an argument of the wrong type", () => {
    expect(() => writeToggle(new MemoryStorage(), "on" as never)).toThrow(
      /^writeToggle: on must be a boolean/,
    );
    expect(() => readToggle("local" as never)).toThrow(
      /^readToggle: local must be a storage or null/,
    );
    expect(() => writeToggle({} as never, true)).toThrow(TypeError);
  });
});
