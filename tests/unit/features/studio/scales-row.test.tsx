import { act, cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PALETTE_NAMES, STEPS } from "@/engine";
import { Scales } from "@/features/studio/Scales";
import { tokenRow } from "@/features/studio/token-row";
import { freshSpec } from "./support";

// Case C-VT-07 of docs/specs/05-motion-3d.md, section 14 (ruling R5-47, section 10.2): a step
// button opens its token row in place, one at a time; Escape closes it; the arrows rove.

const SPEC = freshSpec();

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function setup(mode: "light" | "dark" = "light") {
  const view = render(<Scales spec={SPEC} mode={mode} cells={[]} />);
  const hexOf = (palette: string, step: number) => {
    const found = SPEC.color.palettes[palette as "primary"][mode].find((s) => s.step === step);
    return found?.hex ?? "";
  };
  const step = (palette: string, n: number) =>
    view.getByRole("button", { name: `${palette} ${n}, ${hexOf(palette, n)}` });
  return { ...view, step, hexOf };
}

describe("Scales token row", () => {
  it("C-VT-07 a step button opens its token row with 10.2's fields", () => {
    const { step, container } = setup();
    const button = step("primary", 500);
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    const open = step("primary", 500);
    expect(open).toHaveAttribute("aria-expanded", "true");
    const row = open.closest("li") as HTMLElement;
    expect(row).toHaveAttribute("data-token-row");
    expect(container.querySelectorAll("[data-token-row]")).toHaveLength(1);
    const expected = tokenRow(SPEC, "light", "primary", 500);
    const codes = [...row.querySelectorAll("code")].map((code) => code.textContent);
    expect(codes).toEqual([expected.token, expected.utility, expected.cssVar]);
    expect(row.textContent).toContain(expected.hex);
    expect(row.textContent).toContain(expected.oklch);
    expect(row.textContent).toContain(expected.contrast);
    const roles =
      expected.roles.length > 0
        ? `Roles: ${expected.roles.join(", ")}`
        : "Roles: none in light mode.";
    expect(row.textContent).toContain(roles);
    expect(within(row).getByRole("button", { name: "Copy var(--primary-500)" })).toBeVisible();
    expect(open).toHaveFocus();
  });

  it("C-VT-07 opening another step closes the first, in any palette", () => {
    const { step, container } = setup();
    fireEvent.click(step("primary", 500));
    fireEvent.click(step("primary", 600));
    expect(step("primary", 500)).toHaveAttribute("aria-expanded", "false");
    expect(step("primary", 600)).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(step("neutral", 50));
    expect(container.querySelectorAll("[data-token-row]")).toHaveLength(1);
    expect(step("primary", 600)).toHaveAttribute("aria-expanded", "false");
    expect(step("neutral", 50)).toHaveFocus();
  });

  it("C-VT-07 its own button and Escape close the row and focus returns to the compact button", () => {
    const { step, container } = setup();
    fireEvent.click(step("primary", 500));
    fireEvent.click(step("primary", 500));
    expect(container.querySelectorAll("[data-token-row]")).toHaveLength(0);
    expect(step("primary", 500)).toHaveFocus();
    fireEvent.click(step("primary", 500));
    const copy = within(container).getByRole("button", { name: "Copy var(--primary-500)" });
    act(() => copy.focus());
    fireEvent.keyDown(copy, { key: "Escape" });
    expect(container.querySelectorAll("[data-token-row]")).toHaveLength(0);
    expect(step("primary", 500)).toHaveAttribute("aria-expanded", "false");
    expect(step("primary", 500)).toHaveFocus();
  });

  it("C-VT-07 Escape on a closed row does nothing and is not stopped", () => {
    const { step } = setup();
    const seen = vi.fn();
    window.addEventListener("keydown", seen);
    act(() => step("primary", 500).focus());
    fireEvent.keyDown(step("primary", 500), { key: "Escape" });
    window.removeEventListener("keydown", seen);
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it("C-VT-07 Escape that closes a row does not reach the window", () => {
    const { step } = setup();
    fireEvent.click(step("primary", 500));
    const seen = vi.fn();
    window.addEventListener("keydown", seen);
    fireEvent.keyDown(step("primary", 500), { key: "Escape" });
    window.removeEventListener("keydown", seen);
    expect(seen).not.toHaveBeenCalled();
  });

  it("C-VT-07 the arrows, Home and End move focus within a palette, with one tabIndex 0 each", () => {
    const { step, container } = setup();
    for (const name of PALETTE_NAMES) {
      const palette = container.querySelector(`[data-palette="${name}"]`) as HTMLElement;
      const stops = palette.querySelectorAll('button[tabindex="0"]');
      expect(stops).toHaveLength(1);
      expect(palette.querySelectorAll("button[aria-expanded]")).toHaveLength(STEPS.length);
    }
    act(() => step("primary", 50).focus());
    fireEvent.keyDown(step("primary", 50), { key: "ArrowDown" });
    expect(step("primary", 100)).toHaveFocus();
    fireEvent.keyDown(step("primary", 100), { key: "ArrowUp" });
    expect(step("primary", 50)).toHaveFocus();
    fireEvent.keyDown(step("primary", 50), { key: "ArrowUp" });
    expect(step("primary", 50)).toHaveFocus();
    fireEvent.keyDown(step("primary", 50), { key: "End" });
    expect(step("primary", 950)).toHaveFocus();
    fireEvent.keyDown(step("primary", 950), { key: "ArrowDown" });
    expect(step("primary", 950)).toHaveFocus();
    fireEvent.keyDown(step("primary", 950), { key: "Home" });
    expect(step("primary", 50)).toHaveFocus();
    const primary = container.querySelector('[data-palette="primary"]') as HTMLElement;
    expect(primary.querySelector('button[tabindex="0"]')).toBe(step("primary", 50));
    fireEvent.keyDown(step("primary", 50), { key: "End" });
    expect(primary.querySelector('button[tabindex="0"]')).toBe(step("primary", 950));
  });

  it("C-VT-07 a design change keeps the open row with the new values, and a mode toggle keeps it", () => {
    const { step, rerender, container } = setup();
    fireEvent.click(step("primary", 500));
    rerender(<Scales spec={SPEC} mode="dark" cells={[]} />);
    const darkHex = SPEC.color.palettes.primary.dark.find((s) => s.step === 500)?.hex ?? "";
    const row = container.querySelector("[data-token-row]") as HTMLElement;
    expect(row).not.toBeNull();
    expect(row.textContent).toContain(darkHex);
    expect(row.textContent).toMatch(/Roles: .*(in dark mode\.|[a-z])/);
  });

  it("C-VT-07 Copy writes the variable and reads Copied; a blocked copy selects the text and says so", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const { step, container } = setup();
    fireEvent.click(step("primary", 500));
    const copy = within(container).getByRole("button", { name: "Copy var(--primary-500)" });
    await act(async () => {
      fireEvent.click(copy);
    });
    expect(writeText).toHaveBeenCalledWith("var(--primary-500)");
    expect(copy).toHaveTextContent("Copied");
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(copy).toHaveTextContent("Copy");
    expect(copy).not.toHaveTextContent("Copied");

    writeText.mockRejectedValue(new Error("blocked"));
    await act(async () => {
      fireEvent.click(copy);
    });
    expect(container.textContent).toContain(
      "Copy is blocked here. The text is selected: press Ctrl+C or ⌘C.",
    );
    expect(window.getSelection()?.toString()).toBe("var(--primary-500)");
  });
});
