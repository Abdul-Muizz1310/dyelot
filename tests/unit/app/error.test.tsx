import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ErrorPage from "@/app/error";

afterEach(() => {
  vi.restoreAllMocks();
});

// Next 16.4 hands an error boundary `{ error: unknown, retry }`: a value thrown in a Client
// Component arrives as-is, and `retry` re-fetches the segment where the old `reset` did not.
describe("the error page", () => {
  it("names the failure and calls the boundary's retry once when retry is pressed", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const retry = vi.fn();
    render(<ErrorPage error={new Error("boom")} retry={retry} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("something broke");
    fireEvent.click(screen.getByRole("button", { name: /retry/ }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("logs the thrown value for the developer, once per error", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("boom");
    const { rerender } = render(<ErrorPage error={error} retry={() => {}} />);
    rerender(<ErrorPage error={error} retry={() => {}} />);
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
    render(<ErrorPage error={thrown} retry={() => {}} />);
    expect(screen.getByRole("button", { name: /retry/ })).toBeInTheDocument();
  });
});
