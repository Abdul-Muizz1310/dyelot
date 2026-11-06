import { describe, expect, it } from "vitest";
import {
  canMakeVideo,
  doneLine,
  FLAVOR_LINES,
  nextAnnounced,
  progressLine,
  VIDEO_LINES,
} from "@/features/flavor/video";

// C-DLG-01 to C-DLG-04 of docs/specs/05-motion-3d.md, section 14.9 (R5-53, sections 6.4 and 13.3),
// and the canMakeVideo and doneLine half of C-DLG-09; Task 5.9a tests its render and record half.

/** A value of the wrong type or domain, passed where the types forbid it. */
const bad = (value: unknown) => value as never;

/** A stand-in for WebCodecs' VideoEncoder: a function. */
const encoder = () => {};

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

describe("canMakeVideo", () => {
  it("C-DLG-01 is true when VideoEncoder is a function, and false otherwise", () => {
    expect(canMakeVideo({ VideoEncoder: encoder })).toBe(true);
    expect(canMakeVideo({})).toBe(false);
    expect(canMakeVideo({ VideoEncoder: 5 })).toBe(false);
  });

  it("C-DLG-09 canMakeVideo(null) throws a TypeError naming canMakeVideo", () => {
    expectThrow(() => canMakeVideo(bad(null)), TypeError, "canMakeVideo");
  });
});

describe("nextAnnounced", () => {
  it("C-DLG-02 gives the next 10% step reached, or null", () => {
    expect(nextAnnounced(0, 0.05)).toBeNull();
    expect(nextAnnounced(0, 0.1)).toBe(10);
    expect(nextAnnounced(10, 0.27)).toBe(20);
    expect(nextAnnounced(20, 0.27)).toBeNull();
    expect(nextAnnounced(90, 1)).toBe(100);
    expect(nextAnnounced(100, 1)).toBeNull();
  });

  it("C-DLG-03 refuses a progress above 1 and a step that is not a number", () => {
    expectThrow(() => nextAnnounced(0, 1.1), RangeError, "nextAnnounced");
    expectThrow(() => nextAnnounced(bad("0"), 0.5), TypeError, "nextAnnounced");
  });

  it("R-05 nextAnnounced checks both types first, then a step of 0 to 100 by tens and a progress in [0, 1]", () => {
    expectThrow(() => nextAnnounced(0, bad("0.5")), TypeError, "nextAnnounced");
    expectThrow(() => nextAnnounced(5, bad(null)), TypeError, "nextAnnounced");
    for (const last of [-10, 5, 110, Number.NaN]) {
      expectThrow(() => nextAnnounced(last, 0.5), RangeError, "nextAnnounced");
    }
    for (const progress of [-0.1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expectThrow(() => nextAnnounced(0, progress), RangeError, "nextAnnounced");
    }
  });
});

describe("progressLine and doneLine", () => {
  it("C-DLG-02 writes the progress and done lines", () => {
    expect(progressLine("render", 30)).toBe("Rendering: 30%.");
    expect(progressLine("record", 30)).toBe("Recording: 30%.");
    expect(doneLine("a.mp4")).toBe("Downloaded a.mp4.");
  });

  it("C-DLG-03 progressLine refuses a job other than render or record", () => {
    expectThrow(() => progressLine(bad("encode"), 10), RangeError, "progressLine");
  });

  it("R-05 progressLine checks both types first, then a whole percent from 0 to 100", () => {
    expectThrow(() => progressLine(bad(5), 10), TypeError, "progressLine");
    expectThrow(() => progressLine(bad("encode"), bad("10")), TypeError, "progressLine");
    for (const percent of [-10, 30.5, 101, Number.NaN]) {
      expectThrow(() => progressLine("render", percent), RangeError, "progressLine");
    }
  });

  it("C-DLG-09 doneLine(5) throws a TypeError and doneLine('') a RangeError, each naming doneLine", () => {
    expectThrow(() => doneLine(bad(5)), TypeError, "doneLine");
    expectThrow(() => doneLine(""), RangeError, "doneLine");
  });
});

describe("the hosts' lines", () => {
  it("C-DLG-04 VIDEO_LINES holds section 13.3's table, frozen", () => {
    expect(VIDEO_LINES).toEqual({
      "no-webcodecs": "This browser cannot make videos. Try a recent Chrome, Edge or Firefox.",
      checking: "Checking this browser…",
      "render-unsupported": "This browser cannot render the brand video.",
      rendering: "Rendering…",
      "render-failed": "The brand video could not be rendered in this browser.",
      canceled: "Canceled. Nothing was downloaded.",
      "load-failed": "This tool could not load. Reload the page to try again.",
      wait: "Wait for the current video to finish.",
      record: "Record the shader loop",
      "record-description":
        "Records one 10-second loop at 1280 × 720 in this browser. Nothing is sent anywhere.",
      "record-unsupported": "This browser cannot record the shader loop.",
      recording: "Recording…",
      "record-failed": "The shader loop could not be recorded in this browser.",
      cancel: "Cancel",
    });
    expect(Object.isFrozen(VIDEO_LINES)).toBe(true);
  });

  it("C-DLG-04 FLAVOR_LINES holds section 6.4's table, frozen", () => {
    expect(FLAVOR_LINES).toEqual({
      "no-webgl2":
        "This browser cannot draw the animated background, so a still gradient shows instead.",
      "context-lost": "The animated background stopped, so a still gradient shows instead.",
      restart: "Restart the animation",
      still: "The background is still because this device asks for reduced motion.",
      pause: "Pause",
    });
    expect(Object.isFrozen(FLAVOR_LINES)).toBe(true);
  });
});
