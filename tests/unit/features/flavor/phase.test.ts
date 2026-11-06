import { describe, expect, it } from "vitest";
import { phaseLine, progressed, type VideoPhase } from "@/features/flavor/phase";
import { VIDEO_LINES } from "@/features/flavor/video";

// The phase both video sections of the Flavor dialog share (docs/specs/05-motion-3d.md, sections
// 11.2, 11.3 and 13.3; R5-53, R5-56): the line its status region holds, and its progress step.
// Task 5.9c's review moved them out of the two sections' copies. No case id names these tests: the
// sections' flows (F-RENDER, F-LOOP) check the same lines in the browser, and C-DLG-02 the steps.

/** A value of the wrong type or domain, passed where the types forbid it. */
const bad = (value: unknown) => value as never;

/** Fails unless `run` throws `kind` with a message that starts with `name` and a colon. */
function expectThrow(run: () => unknown, kind: ErrorConstructor, name: string) {
  let caught: unknown;
  try {
    run();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(kind);
  expect((caught as Error).message).toMatch(new RegExp(`^${name}: `));
}

const running = (percent: number, announced: number): VideoPhase => ({
  kind: "running",
  percent,
  announced,
});

describe("phaseLine", () => {
  it("gives the render's lines of 13.3 for each phase", () => {
    expect(phaseLine("render", { kind: "idle" })).toBe("");
    expect(phaseLine("render", { kind: "confirm" })).toBe("");
    expect(phaseLine("render", { kind: "checking" })).toBe(VIDEO_LINES.checking);
    expect(phaseLine("render", running(4, 0))).toBe("");
    expect(phaseLine("render", running(34, 30))).toBe("Rendering: 30%.");
    expect(phaseLine("render", { kind: "unsupported" })).toBe(VIDEO_LINES["render-unsupported"]);
    expect(phaseLine("render", { kind: "done", name: "a.mp4" })).toBe("Downloaded a.mp4.");
    expect(phaseLine("render", { kind: "canceled" })).toBe(VIDEO_LINES.canceled);
    expect(phaseLine("render", { kind: "failed" })).toBe(VIDEO_LINES["render-failed"]);
    expect(phaseLine("render", { kind: "load-failed" })).toBe(VIDEO_LINES["load-failed"]);
  });

  it("gives the recording's own lines where the jobs differ", () => {
    expect(phaseLine("record", { kind: "idle" })).toBe("");
    expect(phaseLine("record", running(41, 40))).toBe("Recording: 40%.");
    expect(phaseLine("record", { kind: "unsupported" })).toBe(VIDEO_LINES["record-unsupported"]);
    expect(phaseLine("record", { kind: "failed" })).toBe(VIDEO_LINES["record-failed"]);
    expect(phaseLine("record", { kind: "done", name: "a.webm" })).toBe("Downloaded a.webm.");
  });

  it("R-05 phaseLine checks the types, then the job and the phase", () => {
    expectThrow(() => phaseLine(bad(5), bad({ kind: "nope" })), TypeError, "phaseLine");
    expectThrow(() => phaseLine("render", bad(null)), TypeError, "phaseLine");
    expectThrow(() => phaseLine("render", bad({ kind: 3 })), TypeError, "phaseLine");
    expectThrow(() => phaseLine(bad("encode"), { kind: "idle" }), RangeError, "phaseLine");
    expectThrow(() => phaseLine("render", bad({ kind: "paused" })), RangeError, "phaseLine");
    expectThrow(
      () => phaseLine("render", bad({ kind: "running", announced: "10" })),
      TypeError,
      "phaseLine",
    );
    expectThrow(() => phaseLine("render", running(15, 15)), RangeError, "phaseLine");
    expectThrow(() => phaseLine("render", bad({ kind: "done", name: 5 })), TypeError, "phaseLine");
    expectThrow(() => phaseLine("render", { kind: "done", name: "" }), RangeError, "phaseLine");
  });
});

describe("progressed", () => {
  it("starts the running phase at the first progress, from any other phase", () => {
    expect(progressed({ kind: "checking" }, 0.05)).toEqual(running(5, 0));
    expect(progressed({ kind: "idle" }, 0.1)).toEqual(running(10, 10));
    expect(progressed({ kind: "confirm" }, 0)).toEqual(running(0, 0));
  });

  it("moves the bar each percent and the announced step at most once per 10%", () => {
    const first = progressed({ kind: "checking" }, 0.27);
    expect(first).toEqual(running(27, 20));
    // Nothing it shows changes: the same object comes back, so React renders nothing.
    expect(progressed(first, 0.275)).toBe(first);
    expect(progressed(first, 0.28)).toEqual(running(28, 20));
    expect(progressed(running(28, 20), 0.31)).toEqual(running(31, 30));
    expect(progressed(running(99, 90), 1)).toEqual(running(100, 100));
  });

  it("R-05 progressed checks the types before the progress's range", () => {
    expectThrow(() => progressed(bad(null), bad("0.5")), TypeError, "progressed");
    expectThrow(() => progressed({ kind: "idle" }, bad("0.5")), TypeError, "progressed");
    expectThrow(() => progressed({ kind: "idle" }, 1.1), RangeError, "progressed");
    expectThrow(() => progressed({ kind: "idle" }, -0.1), RangeError, "progressed");
    expectThrow(() => progressed({ kind: "idle" }, Number.NaN), RangeError, "progressed");
  });
});
