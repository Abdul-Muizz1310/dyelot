import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { lastPosted, makeStore } from "./store-support";

// The support module disposes the stores it makes, so no test leaves a 300 ms persist timer
// behind to fire after the test has finished (a flaky unhandled error under machine load).

describe("makeStore cleanup", () => {
  beforeAll(() => {
    vi.useFakeTimers();
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it("leaves a persist timer pending inside the test that commits", () => {
    const { store, stub } = makeStore();
    store.getState().setParams({ radius: "sharp" });
    stub.reply(lastPosted(stub).id);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
  });

  it("holds no pending timer in the next test: the support disposed that store", () => {
    expect(vi.getTimerCount()).toBe(0);
  });
});
