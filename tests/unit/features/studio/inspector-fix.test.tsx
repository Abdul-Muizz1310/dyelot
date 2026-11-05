import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lintSpec } from "@/engine";
import { createAiActivity } from "@/features/ai/activity";
import { Inspector } from "@/features/studio/Inspector";
import { writeHash } from "@/features/studio/url";
import { type DesignSpec, normalizeSpec } from "@/spec";
import { withValue } from "../../spec/support";
import { lastPosted, makeStore } from "./store-support";
import { fakeLocation, freshSpec } from "./support";

// C-INSPECT-17 and C-INSPECT-27 of docs/specs/02-studio.md, section 6.8 (R2-10, Task 2.10b fix round 1).
// A fix's outcome is named once, in the Findings section's status region, which is always mounted; a
// kept finding's card shows the same sentence as plain text; focus that sat on the fix button moves to
// the Findings heading when the button leaves; a fix whose regeneration fails answers for nothing later.

/** FRESH's spec with the light ring set to #f4f4f4 on its #ffffff page, at `level`. */
function ringSpec(level: "AA" | "AAA"): DesignSpec {
  let spec: unknown = withValue(freshSpec(), ["color", "roles", "light", "ring"], "#f4f4f4");
  spec = withValue(spec, ["color", "params", "contrastLevel"], level);
  return normalizeSpec(spec as DesignSpec);
}

const KEY = "F1 light ring/background";
const KEPT = "Raising the contrast did not clear this finding.";
const CLEARED = "Contrast raised to AAA. The finding is cleared.";

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

/** The Inspector on a store opened from the ring link at AA, with the F1 card's fix button focused. */
function openRing() {
  const { location } = fakeLocation(writeHash(ringSpec("AA")));
  const { store, stub } = makeStore({ location });
  render(<Inspector store={store} activity={createAiActivity()} onCanvasShown={() => {}} />);
  const findings = screen.getByRole("region", { name: "Findings" });
  const card = findings.querySelector(`[data-finding="${KEY}"]`);
  if (!(card instanceof HTMLElement)) throw new Error("no F1 card");
  const fix = within(card).getByRole("button", { name: "Raise contrast to AAA" });
  fix.focus();
  expect(document.activeElement).toBe(fix);
  return { store, stub, findings, fix };
}

/** The Findings section's one status region: mounted from the first render, empty until used. */
const region = (findings: HTMLElement) => within(findings).getByRole("status");
const heading = (findings: HTMLElement) =>
  within(findings).getByRole("heading", { name: "Findings" });

describe("a fix's outcome", () => {
  it("C-INSPECT-17 a fix that keeps its finding says so once, keeps the card, and gives focus to the heading", () => {
    const kept = ringSpec("AAA");
    expect(lintSpec(kept).some((item) => `${item.id} ${item.mode} ${item.subject}` === KEY)).toBe(
      true,
    );
    const { stub, findings, fix } = openRing();
    expect(region(findings)).toBeEmptyDOMElement();
    act(() => {
      fireEvent.click(fix);
    });
    const request = lastPosted(stub);
    expect(request.params.contrastLevel).toBe("AAA");
    act(() => {
      stub.reply(request.id, kept);
    });
    expect(region(findings)).toHaveTextContent(KEPT);
    const card = findings.querySelector(`[data-finding="${KEY}"]`);
    expect(card).not.toBeNull();
    if (!(card instanceof HTMLElement)) return;
    // The card's sentence is plain text: the section's region is the only live one.
    expect(card).toHaveTextContent(KEPT);
    expect(within(card).queryByRole("status")).toBeNull();
    expect(within(findings).getAllByRole("status")).toHaveLength(1);
    // At AAA the fix is spent: the note replaces the button, and focus moved to the heading.
    expect(within(card).queryByRole("button", { name: /^Raise contrast/ })).toBeNull();
    expect(card).toHaveTextContent("Contrast is already AAA.");
    expect(document.activeElement).toBe(heading(findings));
  });

  it("C-INSPECT-17 a fix that clears its finding names the outcome and gives focus to the heading", () => {
    const { stub, findings, fix } = openRing();
    act(() => {
      fireEvent.click(fix);
    });
    act(() => {
      stub.replyReal(lastPosted(stub).id);
    });
    expect(findings.querySelector(`[data-finding="${KEY}"]`)).toBeNull();
    expect(region(findings)).toHaveTextContent(CLEARED);
    expect(screen.queryByText(KEPT)).toBeNull();
    expect(document.activeElement).toBe(heading(findings));
  });

  it("C-INSPECT-27 a fix whose regeneration fails answers for nothing later", () => {
    const { store, stub, findings, fix } = openRing();
    act(() => {
      fireEvent.click(fix);
    });
    act(() => {
      stub.fail(lastPosted(stub).id);
    });
    expect(store.getState().status.phase).toBe("failed");
    // Another change at the same level (the failed request left the params at AAA), whose spec still
    // holds the finding.
    expect(store.getState().params.contrastLevel).toBe("AAA");
    act(() => {
      store.getState().setParams({ chroma: "vivid" });
    });
    act(() => {
      stub.reply(lastPosted(stub).id, ringSpec("AAA"));
    });
    expect(store.getState().spec.color.params.contrastLevel).toBe("AAA");
    expect(findings.querySelector(`[data-finding="${KEY}"]`)).not.toBeNull();
    expect(region(findings)).toBeEmptyDOMElement();
    expect(screen.queryByText(KEPT)).toBeNull();
  });
});
