import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import GlobalError from "@/app/global-error";

// next/font is a compile-time transform: outside a Next build its loaders do not run.
vi.mock("next/font/google", () => ({ Geist_Mono: () => ({ variable: "font-geist-mono" }) }));

afterEach(() => {
  vi.restoreAllMocks();
});

// global-error replaces the root layout, so it brings its own <html> and <body>. React renders
// those two into the document itself, so each test mounts into `document`, not into a detached div.
function mount(error: unknown, retry: () => void = () => {}) {
  return render(<GlobalError error={error} retry={retry} />, { container: document });
}

// Next 16.4 hands a global error boundary `{ error: unknown, retry }`, as it does error.tsx.
describe("the global error page", () => {
  it("brings its own document: a language, a title and one top-level heading in main", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mount(new Error("boom"));
    expect(document.documentElement).toHaveAttribute("lang", "en");
    expect(document.title).toBe("something broke — dyelot");
    expect(screen.getByRole("main")).toContainElement(screen.getByRole("heading", { level: 1 }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("something broke");
  });

  it("calls the boundary's retry once when retry is pressed", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const retry = vi.fn();
    mount(new Error("boom"), retry);
    // The name is exact: the `$ ` before the command is decoration, and a screen reader skips it.
    const button = screen.getByRole("button", { name: "retry" });
    // The marker keeps its space: the button reads "$ retry", never "$retry".
    expect(button.textContent).toBe("$ retry");
    expect(button.querySelector('[aria-hidden="true"]')).toHaveClass("whitespace-pre");
    fireEvent.click(button);
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("logs the thrown value for the developer, once per error", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("boom");
    const { rerender } = mount(error);
    rerender(<GlobalError error={error} retry={() => {}} />);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(error);
  });

  it.each([
    ["a string", "boom"],
    ["a number", 42],
    ["null", null],
    ["undefined", undefined],
    ["a plain object", { reason: "nope" }],
  ])("still renders a retry when the thrown value is %s, not an Error", (_what, thrown) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mount(thrown);
    expect(screen.getByRole("button", { name: "retry" })).toBeInTheDocument();
  });
});
