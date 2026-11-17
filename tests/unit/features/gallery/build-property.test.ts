import fc from "fast-check";
import { describe, expect, it } from "vitest";
import * as AI from "@/ai";
import { LEXICON } from "@/ai/lexicon/data";
import { briefSpec } from "@/features/gallery/build";
import type { BriefDef } from "@/features/gallery/defs";
import { DesignSpecSchema, specId } from "@/spec";
import { PROPERTY_TIMEOUT } from "../../spec/support";
import { wordProblems } from "../../support/gallery";

// C-GAL6-14 of docs/specs/06-gallery.md, section 14.1 (R6-06, decision J1).

const TERMS = LEXICON.map((entry) => entry.term);

/** "A " and terms joined by ", " while the text stays at most 99 characters, then a period. */
function briefOf(terms: readonly string[]): string {
  let text = "A";
  for (const [i, term] of terms.entries()) {
    const next = i === 0 ? `${text} ${term}` : `${text}, ${term}`;
    if (next.length > 99) break;
    text = next;
  }
  while (text.length + 1 < 30) text += " and more";
  return `${text}.`;
}

const rows = fc
  .record({
    name: fc.stringMatching(/^[A-Za-z]{1,18}$/),
    seed: fc.stringMatching(/^[a-z0-9-]{1,40}$/),
    terms: fc.shuffledSubarray(TERMS, { minLength: 1, maxLength: 14 }),
  })
  .map(({ name, seed, terms }): BriefDef => {
    const slug = name.toLowerCase();
    return { slug, source: "brief", name, seed, brief: briefOf(terms), tags: ["calm"] };
  });

describe("briefSpec on generated rows (R6-06)", () => {
  it(
    "C-GAL6-14 keeps R6-12's bounds, builds one spec id twice and a spec the schema accepts",
    () => {
      fc.assert(
        fc.property(rows, (row) => {
          expect(row.brief.length).toBeGreaterThanOrEqual(30);
          expect(row.brief.length).toBeLessThanOrEqual(100);
          expect(
            wordProblems({ name: row.name, slug: row.slug, brief: row.brief, line: row.brief }),
          ).toEqual([]);
          const first = briefSpec(row, AI);
          const second = briefSpec(row, AI);
          expect(specId(first.spec)).toBe(specId(second.spec));
          expect(first.spec.meta.createdWith).toBe("lexicon");
          expect(DesignSpecSchema.safeParse(first.spec).success).toBe(true);
        }),
        { numRuns: 50, seed: 6001 },
      );
    },
    PROPERTY_TIMEOUT,
  );
});
