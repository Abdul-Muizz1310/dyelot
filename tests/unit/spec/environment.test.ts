import { describe, expect, it } from "vitest";

// C-REPO-03 (spec half). Spec tests run in the node environment (R-24), so the DOM globals
// do not exist and any DOM access in src/spec/ fails its test. The engine half is
// tests/unit/engine/environment.test.ts.
describe("C-REPO-03 the spec test environment", () => {
  it("is node: there is no window and no document", () => {
    expect(typeof window).toBe("undefined");
    expect(typeof document).toBe("undefined");
  });

  it("makes a DOM access throw", () => {
    expect(() => window.innerWidth).toThrow(ReferenceError);
    expect(() => document.body).toThrow(ReferenceError);
  });
});
