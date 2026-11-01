import { describe, expect, it } from "vitest";

// C-REPO-03 (engine half). Engine tests run in the node environment (R-24), so the DOM
// globals do not exist and any DOM access in src/engine/ fails its test. The spec half is
// tests/unit/spec/environment.test.ts.
describe("C-REPO-03 the engine test environment", () => {
  it("is node: there is no window and no document", () => {
    expect(typeof window).toBe("undefined");
    expect(typeof document).toBe("undefined");
  });

  it("makes a DOM access throw", () => {
    expect(() => window.innerWidth).toThrow(ReferenceError);
    expect(() => document.body).toThrow(ReferenceError);
  });
});
