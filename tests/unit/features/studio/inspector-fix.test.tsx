import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lintSpec } from "@/engine";
import { Inspector } from "@/features/studio/Inspector";
import { writeHash } from "@/features/studio/url";
import { type DesignSpec, normalizeSpec } from "@/spec";
import { withValue } from "../../spec/support";
import { lastPosted, makeStore } from "./store-support";
import { fakeLocation, freshSpec } from "./support";

// C-INSPECT-17 of docs/specs/02-studio.md, section 6.8 (R2-10): when the regenerated design still holds
// the finding a fix was meant to clear, the inspector says so in a status message and keeps the
// finding. A stub client answers the fix's request with a spec that keeps it.

/** FRESH's spec with the light ring set to #f4f4f4 on its #ffffff page, at `level`. */
function ringSpec(level: "AA" | "AAA"): DesignSpec {
  let spec: unknown = withValue(freshSpec(), ["color", "roles", "light", "ring"], "#f4f4f4");
  spec = withValue(spec, ["color", "params", "contrastLevel"], level);
  return normalizeSpec(spec as DesignSpec);
}

const KEY = "F1 light ring/background";

class StubIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", StubIntersectionObserver);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("a fix that does not clear its finding", () => {
  it("C-INSPECT-17 says so in a status message and keeps the finding", () => {
    const kept = ringSpec("AAA");
    expect(lintSpec(kept).some((item) => `${item.id} ${item.mode} ${item.subject}` === KEY)).toBe(
      true,
    );
    const { location } = fakeLocation(writeHash(ringSpec("AA")));
    const { store, stub } = makeStore({ location });
    render(<Inspector store={store} onCanvasShown={() => {}} />);
    const finding = document.querySelector(`[data-finding="${KEY}"]`);
    expect(finding).not.toBeNull();
    if (!(finding instanceof HTMLElement)) return;
    const fix = within(finding).getByRole("button", { name: "Raise contrast to AAA" });
    expect(screen.queryByText("Raising the contrast did not clear this finding.")).toBeNull();

    act(() => {
      fireEvent.click(fix);
    });
    const request = lastPosted(stub);
    expect(request.params.contrastLevel).toBe("AAA");
    act(() => {
      stub.reply(request.id, kept);
    });

    expect(store.getState().spec.color.params.contrastLevel).toBe("AAA");
    const still = document.querySelector(`[data-finding="${KEY}"]`);
    expect(still).not.toBeNull();
    if (!(still instanceof HTMLElement)) return;
    const status = within(still).getByRole("status");
    expect(status).toHaveTextContent("Raising the contrast did not clear this finding.");
    // At AAA the fix is spent: the note replaces the button.
    expect(within(still).queryByRole("button", { name: /^Raise contrast/ })).toBeNull();
    expect(still).toHaveTextContent("Contrast is already AAA.");
  });

  it("C-INSPECT-17 says nothing when the regeneration clears it", () => {
    const { location } = fakeLocation(writeHash(ringSpec("AA")));
    const { store, stub } = makeStore({ location });
    render(<Inspector store={store} onCanvasShown={() => {}} />);
    const finding = document.querySelector(`[data-finding="${KEY}"]`);
    if (!(finding instanceof HTMLElement)) throw new Error("no F1 finding");
    act(() => {
      fireEvent.click(within(finding).getByRole("button", { name: "Raise contrast to AAA" }));
    });
    act(() => {
      stub.replyReal(lastPosted(stub).id);
    });
    expect(document.querySelector(`[data-finding="${KEY}"]`)).toBeNull();
    expect(screen.queryByText("Raising the contrast did not clear this finding.")).toBeNull();
  });
});
