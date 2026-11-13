import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FlatView } from "@/features/explore/FlatView";
import { defaultDesign } from "@/features/landing/heroes";

// C-FLAV6-04 of docs/specs/06-gallery.md, section 14 (R6-38, 13.2).

describe("C-FLAV6-04 two flat views on one page keep their own ids", () => {
  it("gives each caption and list a distinct id, and each figure names its own caption", () => {
    const spec = defaultDesign();
    const { container } = render(
      <>
        <FlatView spec={spec} mode="light" l={0.6} />
        <FlatView spec={spec} mode="dark" l={0.4} />
      </>,
    );
    const figures = [...container.querySelectorAll("figure[data-flat-view]")];
    expect(figures).toHaveLength(2);
    const ids = figures.map((figure) => {
      const caption = figure.querySelector("figcaption") as HTMLElement;
      const heading = figure.querySelector("p[id]") as HTMLElement;
      const list = figure.querySelector("ul[aria-labelledby]") as HTMLElement;
      expect(figure.querySelector("svg")?.getAttribute("aria-labelledby")).toBe(caption.id);
      expect(list.getAttribute("aria-labelledby")).toBe(heading.id);
      return [caption.id, heading.id];
    });
    const all = ids.flat();
    expect(all.every((id) => id !== "")).toBe(true);
    expect(new Set(all).size).toBe(4);
  });
});
