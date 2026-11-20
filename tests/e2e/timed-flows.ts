// The load family (docs/specs/07-finish.md, R7-04, R7-05 and section 7): flows that hold a time
// budget or a harness timeout and failed only beside other browsers. playwright.config.ts runs them in
// the `timed` project, one at a time after the Lighthouse runs, and leaves them out of `chromium`.
// A test joins by its case id, whole; where the id also names a serial-group test, the family's test
// carries TIMED_TAG instead. A flow joins only by an amendment of section 7 (R7-05).

export const TIMED_FLOWS = Object.freeze([
  "F-INSP-15",
  "F-STUDIO-05",
  "F-INPUT-07",
  "F-INPUT-15",
  "F-CANVAS-07",
  "F-IMP-RF4",
  "F-ABT-02",
  "F-STEER-01",
  "F-VT-04",
  "F-LOOP-01",
  "F-RENDER-01",
  "F-LAZY5-02",
] as const);
export const TIMED_TAG = "@timed";
export const TIMED_GREP = new RegExp(`\\b(?:${TIMED_FLOWS.join("|")})\\b|${TIMED_TAG}`);
