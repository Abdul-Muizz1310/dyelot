import { describe, expect, it } from "vitest";
import { FONT_CATALOG } from "@/engine/fonts/catalog";
import { PAIRING_IDS, PAIRINGS } from "@/engine/fonts/pairings";

// Cases are the C-PAIR-nn rows of docs/specs/02-studio.md, section 6.2, that Task 2.3 owns:
// C-PAIR-01 to C-PAIR-03 and C-PAIR-15. C-PAIR-04 to C-PAIR-14 (the generator's pairing
// parameter and choosePairing) belong to Task 2.4.

const TABLE = [
  ["host-grotesk", "host-grotesk", "host-grotesk", "fragment-mono"],
  ["schibsted-serif", "schibsted-grotesk", "source-serif-4", "fragment-mono"],
  ["gloock-albert", "gloock", "albert-sans", "fragment-mono"],
  ["young-onest", "young-serif", "onest", "fragment-mono"],
  ["bodoni-familjen", "bodoni-moda", "familjen-grotesk", "fragment-mono"],
  ["literata-spline", "literata", "spline-sans", "spline-sans-mono"],
  ["hubot-mona", "hubot-sans", "mona-sans", "martian-mono"],
  ["funnel", "funnel-display", "funnel-sans", "fragment-mono"],
  ["zalando", "zalando-sans-expanded", "zalando-sans", "fragment-mono"],
  ["unbounded-golos", "unbounded", "golos-text", "fragment-mono"],
  ["archivo-courier", "archivo", "archivo", "courier-prime"],
  ["shoulders-redhat", "big-shoulders", "red-hat-text", "fragment-mono"],
  ["tiny5-spline", "tiny5", "spline-sans", "spline-sans-mono"],
  ["doto-redhat", "doto", "red-hat-text", "red-hat-mono"],
  ["redaction-redhat", "redaction", "red-hat-text", "red-hat-mono"],
  ["commissioner", "commissioner", "commissioner", "fragment-mono"],
  [
    "atkinson",
    "atkinson-hyperlegible-next",
    "atkinson-hyperlegible-next",
    "atkinson-hyperlegible-mono",
  ],
  ["google-flex", "google-sans-flex", "google-sans-flex", "google-sans-code"],
  ["anybody-albert", "anybody", "albert-sans", "spline-sans-mono"],
  ["science-hanken", "science-gothic", "hanken-grotesk", "fragment-mono"],
] as const;

describe("PAIRINGS", () => {
  it("C-PAIR-01 holds 20 pairings with unique ids, in the table's order", () => {
    expect(PAIRINGS).toHaveLength(20);
    expect(PAIRINGS.map((p) => [p.id, p.display, p.body, p.mono])).toEqual(TABLE);
    expect(new Set(PAIRINGS.map((p) => p.id)).size).toBe(20);
  });

  it("C-PAIR-01 references only catalog ids", () => {
    const ids = new Set(FONT_CATALOG.map((font) => font.id));
    for (const p of PAIRINGS) {
      for (const id of [p.display, p.body, p.mono])
        expect(ids.has(id), `${p.id}: ${id}`).toBe(true);
    }
  });

  it("C-PAIR-01 gives every pairing a label, a fit list and a risk", () => {
    for (const p of PAIRINGS) {
      expect(p.label.length, p.id).toBeGreaterThan(0);
      expect(p.fit.length, p.id).toBeGreaterThan(0);
      expect(["low", "low-med", "med"]).toContain(p.risk);
    }
    expect(PAIRINGS.filter((p) => p.risk === "med").map((p) => p.id)).toEqual([
      "bodoni-familjen",
      "archivo-courier",
      "google-flex",
    ]);
    expect(PAIRINGS.find((p) => p.id === "schibsted-serif")?.risk).toBe("low-med");
  });

  it("C-PAIR-01 exports PAIRING_IDS as the ids, in order, and freezes every table", () => {
    expect([...PAIRING_IDS]).toEqual(PAIRINGS.map((p) => p.id));
    expect(Object.isFrozen(PAIRINGS)).toBe(true);
    expect(Object.isFrozen(PAIRING_IDS)).toBe(true);
    for (const p of PAIRINGS) {
      expect(Object.isFrozen(p), p.id).toBe(true);
      expect(Object.isFrozen(p.fit), p.id).toBe(true);
    }
  });

  it("C-PAIR-02 gives the ten rows without a D2 mono fragment-mono", () => {
    const rows = [2, 3, 4, 5, 8, 9, 10, 12, 16, 20];
    for (const row of rows) expect(PAIRINGS[row - 1]?.mono, `row ${row}`).toBe("fragment-mono");
    // Row 1 is M1's default and also takes fragment-mono; the other rows keep their D2 mono.
    const others = PAIRINGS.filter((_, index) => index > 0 && !rows.includes(index + 1));
    for (const p of others) expect(p.mono, p.id).not.toBe("fragment-mono");
  });

  it("C-PAIR-03 keeps M1's default pairing as host-grotesk / host-grotesk / fragment-mono", () => {
    const first = PAIRINGS.find((p) => p.id === "host-grotesk");
    expect(first).toMatchObject({
      display: "host-grotesk",
      body: "host-grotesk",
      mono: "fragment-mono",
    });
  });

  it("C-PAIR-15 gives pairing 19 spline-sans-mono and keeps recursive out of the catalog", () => {
    expect(PAIRINGS[18]?.id).toBe("anybody-albert");
    expect(PAIRINGS[18]?.mono).toBe("spline-sans-mono");
    expect(FONT_CATALOG.some((font) => font.id === "recursive")).toBe(false);
  });
});
