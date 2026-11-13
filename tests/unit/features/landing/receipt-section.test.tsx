import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ReceiptSection } from "@/features/landing/ReceiptSection";
import { excerptText, RECEIPT_EXCERPT, receiptLines } from "@/features/landing/receipt";

// C-REC6-05 of docs/specs/06-gallery.md, section 14.1 (R6-29, section 9.2).

afterEach(cleanup);

describe("C-REC6-05 ReceiptSection", () => {
  it("C-REC6-05 renders the heading, the sentences, the three excerpts and the command, with no inline color", () => {
    const { container } = render(<ReceiptSection />);
    const lines = receiptLines(RECEIPT_EXCERPT);
    const section = container.querySelector("section[data-receipt]");
    expect(section).not.toBeNull();
    expect(section?.getAttribute("aria-labelledby")).toBe("receipt-heading");
    const heading = screen.getByRole("heading", { level: 2, name: "The receipt" });
    expect(heading.id).toBe("receipt-heading");

    const [opening, summary, contrast, finding, checker, closing] = lines as [
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    expect(screen.getByText(opening)).toBeTruthy();
    expect(screen.getByText(checker)).toBeTruthy();
    expect(screen.getByText(closing)).toBeTruthy();

    const figure = (name: string) => container.querySelector(`figure[data-excerpt="${name}"]`);
    expect(figure("summary")?.querySelector("figcaption")?.textContent).toBe(summary);
    expect(figure("summary")?.querySelector("pre")?.textContent).toBe(
      excerptText(RECEIPT_EXCERPT.summary),
    );
    expect(figure("contrast")?.querySelector("figcaption")?.textContent).toBe(contrast);
    expect(figure("contrast")?.querySelector("pre")?.textContent).toBe(
      excerptText(RECEIPT_EXCERPT.contrast),
    );
    expect(figure("finding")?.querySelector("figcaption")?.textContent).toBe(finding);
    expect(figure("finding")?.querySelector("pre")?.textContent).toBe(
      excerptText(RECEIPT_EXCERPT.finding ?? {}),
    );

    const pres = [...(section?.querySelectorAll("pre") ?? [])].map((pre) => pre.textContent);
    expect(pres.at(-1)).toBe("$ node scripts/dyelot-check.mjs");
    expect(section?.querySelectorAll("[style]").length).toBe(0);
  });
});
