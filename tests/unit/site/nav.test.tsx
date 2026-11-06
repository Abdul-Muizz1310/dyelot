import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, expectTypeOf, it } from "vitest";
import { AppNav, type AppNavProps } from "@/components/terminal/AppNav";

// C-SITE5-04 of docs/specs/05-motion-3d.md, section 14.5 (R5-34, 7.3).

const REPOSITORY = "https://github.com/Abdul-Muizz1310/dyelot";
const LINKS = [
  ["home", "/"],
  ["studio", "/studio"],
  ["explore", "/explore"],
  ["motion", "/motion"],
  ["github", REPOSITORY],
] as const;

afterEach(cleanup);

describe("AppNav (7.3)", () => {
  it("C-SITE5-04 lists home, studio, explore, motion and github in order, with their hrefs", () => {
    render(<AppNav />);
    const nav = screen.getByRole("navigation");
    const links = within(nav)
      .getAllByRole("link")
      .filter((link) => link.textContent !== "dyelot");
    expect(links.map((l) => [l.textContent, l.getAttribute("href")])).toEqual(
      LINKS.map(([name, href]) => [name, href]),
    );
    expect(screen.getByRole("link", { name: "github" })).toHaveAttribute("target", "_blank");
  });

  it("C-SITE5-04 active marks only the named link, and none marks none", () => {
    const { unmount } = render(<AppNav active="explore" />);
    const current = screen
      .getAllByRole("link")
      .filter((l) => l.getAttribute("aria-current") === "page");
    expect(current.map((l) => l.textContent)).toEqual(["explore"]);
    unmount();
    render(<AppNav />);
    expect(screen.getAllByRole("link").filter((l) => l.hasAttribute("aria-current"))).toHaveLength(
      0,
    );
  });

  it("C-SITE5-04 the brand keeps the word dyelot in its accessible name", () => {
    render(<AppNav />);
    expect(screen.getByRole("link", { name: "dyelot" })).toHaveAttribute("href", "/");
  });

  it("C-SITE5-04 active is home, explore, motion or absent", () => {
    expectTypeOf<AppNavProps["active"]>().toEqualTypeOf<
      "home" | "explore" | "motion" | undefined
    >();
  });
});
