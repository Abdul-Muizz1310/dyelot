import { afterEach, describe, expect, it, vi } from "vitest";

// The Flavor dialog's loader (docs/specs/05-motion-3d.md, R5-51 and section 5.8): one import(),
// memoized per page and forgotten when it fails, as loadAi loads @/ai
// (tests/unit/features/ai/load.test.ts). No case id names this test, by design (plan departure D9):
// F-FLAVOR-07 checks the same failure in the browser, in Task 5.9c.

const DIALOG = "@/features/flavor/FlavorDialog";

afterEach(() => {
  vi.doUnmock(DIALOG);
  vi.resetModules();
});

describe("loadFlavorDialog", () => {
  it("gives one promise per page, and forgets a failed load so the next call imports again", async () => {
    vi.doMock(DIALOG, () => {
      throw new Error("chunk failed");
    });
    const { loadFlavorDialog } = await import("@/features/flavor/load");
    const failed = loadFlavorDialog();
    expect(loadFlavorDialog()).toBe(failed);
    await expect(failed).rejects.toThrow();

    vi.doUnmock(DIALOG);
    vi.resetModules();
    const again = loadFlavorDialog();
    expect(again).not.toBe(failed);
    const module = await again;
    expect(typeof module.FlavorDialog).toBe("function");
    expect(loadFlavorDialog()).toBe(again);
  });
});
