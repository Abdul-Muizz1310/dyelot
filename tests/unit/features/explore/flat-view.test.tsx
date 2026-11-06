import { render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { gamutSlice } from "@/engine";
import { FlatView } from "@/features/explore/FlatView";
import { dotAt, scenePoints, slicePath, sliceSteps } from "@/features/explore/scene";
import { defaultDesign } from "@/features/landing/heroes";

// C-EXPL5-09 of docs/specs/05-motion-3d.md, section 14.5 (R5-37, 8.3).

const SPEC = defaultDesign();
const near = (l: number) => sliceSteps(scenePoints(SPEC, "light"), l);

describe("FlatView (R5-37, 8.3)", () => {
  it("C-EXPL5-09 draws the three outlines with 8.3's line styles", () => {
    const { container } = render(<FlatView spec={SPEC} mode="light" l={0.6} />);
    const figure = container.querySelector("figure[data-flat-view]");
    expect(figure).not.toBeNull();
    const svg = container.querySelector("svg") as SVGSVGElement;
    expect(svg).toHaveAttribute("role", "img");
    expect(svg).toHaveAttribute("width", "320");
    expect(svg).toHaveAttribute("height", "320");
    const caption = container.querySelector("figcaption") as HTMLElement;
    expect(svg.getAttribute("aria-labelledby")).toBe(caption.id);
    expect(caption.id).not.toBe("");

    const paths = [...svg.querySelectorAll("path")];
    expect(paths).toHaveLength(3);
    const byGamut = (name: string) =>
      paths.find((p) => p.dataset.outline === name) as SVGPathElement;
    for (const gamut of ["srgb", "p3", "rec2020"] as const) {
      expect(byGamut(gamut).getAttribute("d")).toBe(slicePath(gamutSlice(gamut, 0.6), 320));
      expect(byGamut(gamut)).toHaveAttribute("fill", "none");
    }
    expect(byGamut("srgb")).toHaveAttribute("stroke", "var(--foreground)");
    expect(byGamut("srgb")).not.toHaveAttribute("stroke-dasharray");
    expect(byGamut("p3")).toHaveAttribute("stroke", "var(--fg-muted)");
    expect(byGamut("p3").getAttribute("stroke-dasharray")).toMatch(/^\d+ \d+$/);
    expect(byGamut("rec2020")).toHaveAttribute("stroke", "var(--border-bright)");
    expect(byGamut("rec2020")).toHaveAttribute("stroke-linecap", "round");
    expect(byGamut("rec2020").getAttribute("stroke-dasharray")).toMatch(/^1 \d+$/);
  });

  it("C-EXPL5-09 draws one filled dot per slice step", () => {
    const { container } = render(<FlatView spec={SPEC} mode="light" l={0.6} />);
    const steps = near(0.6);
    expect(steps.length).toBeGreaterThan(0);
    const circles = [...container.querySelectorAll("svg circle")];
    expect(circles).toHaveLength(steps.length);
    circles.forEach((circle, i) => {
      const step = steps[i];
      if (step === undefined) throw new Error("missing step");
      const [x, y] = dotAt(step.oklch, 320);
      expect(circle).toHaveAttribute("r", "4");
      expect(circle).toHaveAttribute("fill", step.hex);
      expect(Number(circle.getAttribute("cx"))).toBe(x);
      expect(Number(circle.getAttribute("cy"))).toBe(y);
    });
  });

  it("C-EXPL5-09 writes the caption, the legend and the step items", () => {
    const { container } = render(<FlatView spec={SPEC} mode="light" l={0.6} />);
    const steps = near(0.6);
    expect(container.querySelector("figcaption")).toHaveTextContent(
      `At L 0.60: how far each gamut reaches at every hue, and the ${steps.length} steps within 0.04 of that lightness.`,
    );
    const lists = container.querySelectorAll("ul");
    expect(lists).toHaveLength(2);
    const legend = [...(lists[0] as HTMLElement).querySelectorAll("li")].map(
      (li) => li.textContent,
    );
    expect(legend).toEqual([
      "sRGB: solid line",
      "Display P3: dashed line",
      "Rec. 2020: dotted line",
    ]);
    const list = screen.getByRole("list", { name: "Steps near this lightness" });
    const items = within(list)
      .getAllByRole("listitem")
      .map((li) => li.textContent);
    expect(items).toEqual(
      steps.map((s) => {
        const hue = s.oklch.h === null ? "none" : String(Math.round(s.oklch.h));
        return `${s.palette} ${s.step} · ${s.hex} · L ${s.oklch.l.toFixed(2)} · C ${s.oklch.c.toFixed(3)} · H ${hue}`;
      }),
    );
  });

  it("C-EXPL5-09 writes H none for an achromatic step", () => {
    const grey = structuredClone(SPEC);
    const step = grey.color.palettes.neutral.light[5];
    if (step === undefined) throw new Error("missing step");
    step.oklch = { l: 0.6, c: 0, h: null };
    const { container } = render(<FlatView spec={grey} mode="light" l={0.6} />);
    expect(container.querySelector('circle[data-dot="neutral-500"]')).toHaveAttribute("cx", "160");
    expect(screen.getByRole("list", { name: "Steps near this lightness" })).toHaveTextContent(
      "neutral 500 · ",
    );
    expect(
      screen.getByText(/^neutral 500 · .* · L 0\.60 · C 0\.000 · H none$/),
    ).toBeInTheDocument();
  });

  it("C-EXPL5-09 says so when no step is near", () => {
    const { container } = render(<FlatView spec={SPEC} mode="light" l={0} />);
    expect(near(0)).toHaveLength(0);
    expect(container.querySelectorAll("circle")).toHaveLength(0);
    expect(container.querySelector("figcaption")).toHaveTextContent(
      /At L 0\.00: .* and the 0 steps/,
    );
    const list = screen.getByRole("list", { name: "Steps near this lightness" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(list).toHaveTextContent("No step lies within 0.04 of L 0.00.");
  });

  it("C-EXPL5-09 follows the mode and renders on the server", () => {
    const html = renderToStaticMarkup(<FlatView spec={SPEC} mode="dark" l={0.6} />);
    const dark = sliceSteps(scenePoints(SPEC, "dark"), 0.6);
    expect(html).toContain("data-flat-view");
    expect(html.match(/<circle/g)).toHaveLength(dark.length);
    for (const step of dark) expect(html).toContain(`fill="${step.hex}"`);
  });

  it("C-EXPL5-09 rejects a lightness out of range", () => {
    expect(() => renderToStaticMarkup(<FlatView spec={SPEC} mode="light" l={2} />)).toThrow(
      RangeError,
    );
  });
});
