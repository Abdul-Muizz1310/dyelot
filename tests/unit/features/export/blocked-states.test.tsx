import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lintSpec } from "@/engine";
import { ExportDialog } from "@/features/export/ExportDialog";
import { blockReason } from "@/features/export/files";
import type { StudioStore } from "@/features/studio/store";
import { writeHash } from "@/features/studio/url";
import type { DesignSpec } from "@/spec";
import { SPEC } from "../../export/golden-support";
import { ONE_FAIL } from "../../export/one-fail-support";
import { lastPosted, makeStore, stubClient } from "../studio/store-support";
import { fakeLocation } from "../studio/support";

// C-BLK-01 to 03 of docs/specs/03-export.md, section 10.11 (R3-42, D1, I-M3-04): the export dialog
// of a design that fails a required check, in each of the three states.

const FIXABLE =
  "This design fails 1 required check. It came from a link or a file, and rebuilding it from its parameters makes every check pass.";
const STUCK =
  "This design fails 1 required check, and rebuilding it from its parameters does not fix them. Change the parameters until every check passes.";
const FAULT =
  "This design fails 1 required check although the studio generated it. That is a fault in dyelot: change any parameter to generate it again.";

const SECOND: Record<string, string> = { foreground: "#cccccc" };
/** `ONE_FAIL` with a second failing pair: its light foreground on its page. */
const TWO_FAIL: DesignSpec = {
  ...ONE_FAIL,
  color: {
    ...ONE_FAIL.color,
    roles: {
      ...ONE_FAIL.color.roles,
      light: { ...ONE_FAIL.color.roles.light, ...SECOND },
    },
  },
};

const createObjectURL = vi.fn(() => "blob:x");
const writeText = vi.fn(async () => {});

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: /reduce/.test(query),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  createObjectURL.mockClear();
  writeText.mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

type Held = "loaded-passes" | "loaded-fails" | "loaded-throws" | "generated";

/** A store holding `spec` in the given provenance and outcome, and the dialog open on it. */
async function openBlocked(held: Held, spec: DesignSpec = ONE_FAIL) {
  const stub = stubClient();
  const { location, history } = fakeLocation(writeHash(spec));
  if (held === "loaded-fails") vi.spyOn(stub.client, "generateNow").mockImplementation(() => spec);
  if (held === "loaded-throws") {
    vi.spyOn(stub.client, "generateNow").mockImplementation(() => {
      throw new RangeError("forced");
    });
  }
  const made = makeStore({ stub, location, history });
  if (held === "generated") {
    made.store.getState().regenerate();
    stub.reply(lastPosted(stub).id, spec);
  }
  const onClose = vi.fn();
  const onShowFindings = vi.fn();
  render(
    <ExportDialog
      store={made.store}
      open
      onClose={onClose}
      onShowFindings={onShowFindings}
      flavor={false}
      onFlavorChange={() => {}}
    />,
  );
  const dialog = await screen.findByRole("dialog", { name: "Export" });
  await waitFor(() => expect(within(dialog).getByRole("list", { name: "Files" })).toBeTruthy());
  return { ...made, dialog, onClose, onShowFindings, store: made.store as StudioStore };
}

const disabled = (dialog: HTMLElement) => [
  ...within(dialog).getAllByRole("button", { name: /^Copy / }),
  within(dialog).getByRole("button", { name: /^Download / }),
];

describe("the blocked export dialog", () => {
  it("C-BLK-01 shows the fixable state: sentence, failing checks, files without sizes, disabled actions", async () => {
    const { dialog } = await openBlocked("loaded-passes");
    expect(within(dialog).getByText(FIXABLE)).toBeTruthy();
    expect(within(dialog).getByText(/^LOT /)).toBeTruthy();
    expect(within(dialog).getByRole("list", { name: "Summary" }).children).toHaveLength(4);
    const checks = within(dialog).getByRole("list", { name: "Failing checks" });
    expect(checks.children).toHaveLength(1);
    const finding = lintSpec(ONE_FAIL).find((f) => f.severity === "error");
    expect(finding?.id).toBe("C1");
    expect(checks.textContent).toMatch(
      /^secondary-foreground\/secondary, light: \d\.\d+ against 4\.5$/,
    );
    const files = within(dialog).getByRole("list", { name: "Files" });
    expect(files.children.length).toBeGreaterThan(17);
    expect(files.textContent).toContain("DESIGN.md");
    expect(files.textContent).not.toMatch(/\d (B|KB)\b/);
    expect(dialog.querySelector('[aria-label^="Preview of"]')).toBeNull();
    expect(within(dialog).getByRole("button", { name: "Fix in the inspector" })).toBeTruthy();
    const sentence = within(dialog).getByText(FIXABLE);
    for (const button of disabled(dialog)) {
      expect(button.getAttribute("aria-disabled")).toBe("true");
      expect(button.getAttribute("aria-describedby")).toBe(sentence.id);
    }
    expect(sentence.id).not.toBe("");
  });

  it.each(["loaded-fails", "loaded-throws"] as const)(
    "C-BLK-02 shows the stuck state for %s, with Show the findings and no rebuild",
    async (held) => {
      const { dialog } = await openBlocked(held);
      expect(within(dialog).getByText(STUCK)).toBeTruthy();
      expect(within(dialog).getByRole("button", { name: "Show the findings" })).toBeTruthy();
      expect(within(dialog).queryByRole("button", { name: "Fix in the inspector" })).toBeNull();
      expect(document.body.textContent).not.toContain("Rebuild from the parameters");
    },
  );

  it("C-BLK-02 shows the fault state for a design the studio generated", async () => {
    const { dialog } = await openBlocked("generated");
    expect(within(dialog).getByText(FAULT)).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Show the findings" })).toBeTruthy();
    expect(document.body.textContent).not.toContain("Rebuild from the parameters");
  });

  it("C-BLK-02 counts two errors as 2 required checks in each sentence", async () => {
    expect(lintSpec(TWO_FAIL).filter((f) => f.severity === "error")).toHaveLength(2);
    for (const [held, state] of [
      ["loaded-passes", "fixable"],
      ["loaded-fails", "stuck"],
      ["generated", "fault"],
    ] as const) {
      const { dialog } = await openBlocked(held, TWO_FAIL);
      expect(within(dialog).getByText(blockReason(state, 2))).toBeTruthy();
      expect(blockReason(state, 2)).toContain("2 required checks");
      expect(within(dialog).getByRole("list", { name: "Failing checks" }).children).toHaveLength(2);
      cleanup();
    }
  });

  it("calls onShowFindings from the fix button", async () => {
    const { dialog, onShowFindings } = await openBlocked("loaded-passes");
    fireEvent.click(within(dialog).getByRole("button", { name: "Fix in the inspector" }));
    expect(onShowFindings).toHaveBeenCalledTimes(1);
  });

  it("C-BLK-03 starts no download, writes no clipboard text and shows no file text, in each state", async () => {
    for (const held of ["loaded-passes", "loaded-fails", "generated"] as const) {
      const { dialog } = await openBlocked(held);
      for (const button of disabled(dialog)) {
        fireEvent.click(button);
        fireEvent.keyDown(button, { key: "Enter" });
        fireEvent.keyDown(button, { key: " " });
        fireEvent.keyUp(button, { key: " " });
        await act(async () => {});
      }
      expect(createObjectURL).not.toHaveBeenCalled();
      expect(writeText).not.toHaveBeenCalled();
      expect(document.querySelector("pre")).toBeNull();
      expect(document.body.textContent).not.toContain("--primary:");
      cleanup();
    }
  });

  it("opens the ready dialog for a passing design", async () => {
    const stub = stubClient();
    const { location, history } = fakeLocation(writeHash(SPEC));
    const { store } = makeStore({ stub, location, history });
    render(
      <ExportDialog
        store={store}
        open
        onClose={() => {}}
        onShowFindings={() => {}}
        flavor={false}
        onFlavorChange={() => {}}
      />,
    );
    const dialog = await screen.findByRole("dialog", { name: "Export" });
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: /^Download / })).toBeTruthy(),
    );
    expect(
      within(dialog)
        .getByRole("button", { name: /^Download / })
        .getAttribute("aria-disabled"),
    ).toBeNull();
    expect(within(dialog).queryByRole("list", { name: "Failing checks" })).toBeNull();
  });
});
