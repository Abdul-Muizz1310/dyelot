import { describe, expect, it } from "vitest";
import { createAiActivity } from "@/features/ai/activity";

// The studio's one AI activity (docs/specs/04-ai.md, R4-35, R4-54, R4-56; Task 4.10a): which of the
// five actions runs, so the other four wait; the shared quota's last count for "Shared AI: <n> of 3
// left today"; and the on-device switch the router reads. No case of section 14 names this store;
// its flows are F-BRIEF-12 (one action at a time) and F-BRIEF-01 (the count), so its tests carry
// the section they come from.

describe("R4-56 one action at a time", () => {
  it("R4-56 starts with nothing running, the shared count unknown and the switch off", () => {
    const { running, shared, onDevice } = createAiActivity().getState();
    expect(running).toBeNull();
    expect(shared).toEqual({ remaining: null, off: false });
    expect(onDevice).toBe(false);
  });

  it("R4-56 begins one action and refuses a second until the first ends", () => {
    const activity = createAiActivity();
    const { begin, end } = activity.getState();
    expect(begin("brief", new AbortController())).toBe(true);
    expect(activity.getState().running).toBe("brief");
    expect(begin("refine", new AbortController())).toBe(false);
    expect(begin("brief", new AbortController())).toBe(false);
    expect(activity.getState().running).toBe("brief");
    // Another action's end frees nothing.
    end("refine");
    expect(activity.getState().running).toBe("brief");
    end("brief");
    expect(activity.getState().running).toBeNull();
    expect(begin("refine", new AbortController())).toBe(true);
    expect(activity.getState().running).toBe("refine");
  });

  it("R4-56 refuses a name outside the five actions and a controller that is not one", () => {
    const { begin, end } = createAiActivity().getState();
    expect(() => begin("steer" as never, new AbortController())).toThrow(RangeError);
    expect(() => begin("steer" as never, new AbortController())).toThrow(/^begin: name/);
    expect(() => begin("brief", {} as never)).toThrow(TypeError);
    expect(() => begin("brief", {} as never)).toThrow(/^begin: controller/);
    expect(() => end(5 as never)).toThrow(TypeError);
    expect(() => end("steer" as never)).toThrow(RangeError);
  });
});

describe("R4-35 the shared quota's last count", () => {
  it("R4-35 keeps the count from the last reply that carried one", () => {
    const activity = createAiActivity();
    const { setShared } = activity.getState();
    setShared(2, false);
    expect(activity.getState().shared).toEqual({ remaining: 2, off: false });
    setShared(null, false);
    expect(activity.getState().shared).toEqual({ remaining: 2, off: false });
    setShared(0, false);
    expect(activity.getState().shared).toEqual({ remaining: 0, off: false });
  });

  it("R4-35 marks the shared quota off after a not-configured reply, and on again after an answer", () => {
    const activity = createAiActivity();
    const { setShared } = activity.getState();
    setShared(null, true);
    expect(activity.getState().shared).toEqual({ remaining: null, off: true });
    setShared(1, false);
    expect(activity.getState().shared).toEqual({ remaining: 1, off: false });
  });

  it("R4-35 refuses a count outside 0 to 3, a count that is not an integer and an off that is not a boolean", () => {
    const { setShared } = createAiActivity().getState();
    expect(() => setShared(4, false)).toThrow(RangeError);
    expect(() => setShared(-1, false)).toThrow(RangeError);
    expect(() => setShared(1.5, false)).toThrow(RangeError);
    expect(() => setShared("2" as never, false)).toThrow(TypeError);
    expect(() => setShared(2, "no" as never)).toThrow(TypeError);
    expect(() => setShared(4, false)).toThrow(/^setShared: remaining/);
  });
});

describe("R4-31 the on-device switch", () => {
  it("R4-31 holds the switch the visitor set", () => {
    const activity = createAiActivity();
    activity.getState().setOnDevice(true);
    expect(activity.getState().onDevice).toBe(true);
    activity.getState().setOnDevice(false);
    expect(activity.getState().onDevice).toBe(false);
    expect(() => activity.getState().setOnDevice("on" as never)).toThrow(TypeError);
    expect(() => activity.getState().setOnDevice("on" as never)).toThrow(/^setOnDevice: on/);
  });
});
