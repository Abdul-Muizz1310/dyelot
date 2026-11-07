import { describe, expect, it } from "vitest";
import { PRESET_IDS } from "@/engine";
import { GALLERY_DEFS } from "@/features/gallery/defs";
import { GALLERY_TAGS } from "@/features/gallery/tags";
import { DENY_LIST } from "../../ai/lexicon-deny";
import { m6CopyProblems } from "../../support/copy-m6";
import { BRIEFS, DEFS, GALLERY_DATA, HEROES, wordProblems } from "../../support/gallery";

// C-GAL6-01, C-GAL6-08 and C-GAL6-09 of docs/specs/06-gallery.md, section 14.1 (R6-05, R6-07, R6-12).

/** Section 6.1's table: slug, name, brief (null for a hero) and tags. */
const TABLE = [
  ["madder", "Madder", null, ["bold"]],
  ["weld", "Weld", null, ["playful", "natural"]],
  ["verdigris", "Verdigris", null, ["calm", "natural"]],
  ["woad", "Woad", null, ["calm", "technical"]],
  ["logwood", "Logwood", null, ["editorial"]],
  ["cochineal", "Cochineal", null, ["bold", "playful"]],
  [
    "realgar",
    "Realgar",
    "A balanced, versatile planner for small teams, professional and fast, in orange.",
    ["technical"],
  ],
  [
    "cinnabar",
    "Cinnabar",
    "A Swiss grid for an architecture studio, stark and precise, with one red.",
    ["bold", "technical"],
  ],
  [
    "ochre",
    "Ochre",
    "A minimal concrete grid, neutral and crisp, with one ochre mark.",
    ["editorial"],
  ],
  [
    "kermes",
    "Kermes",
    "A slow longform magazine set in serif on warm paper, with burgundy headings.",
    ["calm", "editorial"],
  ],
  [
    "lapis",
    "Lapis",
    "A formal law journal, classic serif on quiet paper, with navy rules.",
    ["editorial"],
  ],
  [
    "gamboge",
    "Gamboge",
    "A loud, confident neo brutalism store page in saturated yellow with sharp edges.",
    ["bold", "playful"],
  ],
  [
    "smalt",
    "Smalt",
    "A frosted glass landing page for a weather startup, cool azure and high contrast.",
    ["calm", "technical"],
  ],
  [
    "turquoise",
    "Turquoise",
    "A dense, fast terminal for API work, flat panels and one teal accent.",
    ["technical"],
  ],
  [
    "safflower",
    "Safflower",
    "A friendly bento of modular tiles for a mobile app in rose.",
    ["playful"],
  ],
  [
    "verditer",
    "Verditer",
    "A slow northern lights gradient for a storefront, vivid and cool.",
    ["calm", "natural"],
  ],
  [
    "tyrian",
    "Tyrian",
    "Neon synthwave, holographic and magenta, playful as the eighties.",
    ["bold", "playful"],
  ],
  ["sepia", "Sepia", "A handcrafted leather workshop, warm and layered.", ["natural"]],
  [
    "fustic",
    "Fustic",
    "An embossed brewery label in warm amber, lit from one side.",
    ["bold", "natural"],
  ],
  [
    "rhodonite",
    "Rhodonite",
    "A maximalist poster collage, wild and festive, with fuchsia everywhere.",
    ["bold", "playful"],
  ],
  [
    "turmeric",
    "Turmeric",
    "A cozy organic bakery in honey and cream, slow and handmade.",
    ["calm", "natural"],
  ],
  [
    "terre-verte",
    "Terre verte",
    "A quiet matcha tea house, slow and handmade.",
    ["calm", "natural"],
  ],
  [
    "malachite",
    "Malachite",
    "A stark pixel bitmap in black and lime, sharp and flat.",
    ["technical", "playful"],
  ],
  [
    "azurite",
    "Azurite",
    "A bouncy, expressive habit tracker, friendly and animated, in blue.",
    ["playful"],
  ],
] as const;

describe("GALLERY_DEFS (R6-05)", () => {
  it("C-GAL6-01 equals section 6's table: 24 rows in order", () => {
    expect(GALLERY_DEFS).toHaveLength(24);
    TABLE.forEach(([slug, name, brief, tags], i) => {
      const def = GALLERY_DEFS[i];
      if (def === undefined) throw new Error("no row");
      if (brief === null) {
        expect(def).toEqual({ slug, source: "hero", hero: i, tags });
      } else {
        expect(def).toEqual({
          slug,
          source: "brief",
          name,
          seed: `gallery-${slug}`,
          brief,
          tags,
        });
      }
    });
    expect(HEROES).toHaveLength(6);
    expect(BRIEFS).toHaveLength(18);
  });

  it("C-GAL6-01 freezes the array, each row and each tag list", () => {
    expect(Object.isFrozen(GALLERY_DEFS)).toBe(true);
    for (const def of GALLERY_DEFS) {
      expect(Object.isFrozen(def)).toBe(true);
      expect(Object.isFrozen(def.tags)).toBe(true);
    }
  });
});

describe("the entries' words (R6-12)", () => {
  const rows = DEFS.map((def) => {
    const entry = GALLERY_DATA.entries.find((e) => e.slug === def.slug);
    return {
      slug: def.slug,
      name: def.source === "brief" ? def.name : (TABLE[def.hero]?.[1] ?? ""),
      brief: def.source === "brief" ? def.brief : null,
      line: entry?.line ?? (def.source === "brief" ? def.brief : ""),
    };
  });

  it("C-GAL6-08 keeps every name, slug, brief and line inside R6-12's bounds and copy rules", () => {
    expect(rows).toHaveLength(24);
    for (const row of rows) expect(wordProblems(row), row.slug).toEqual([]);
    expect(new Set(rows.map((row) => row.slug)).size).toBe(24);
  });

  it("C-GAL6-08 holds no word of the deny list in a name, slug, brief or tag", () => {
    for (const def of DEFS) {
      const texts = [
        def.slug,
        ...def.tags,
        ...(def.source === "brief" ? [def.name, def.brief] : []),
      ];
      for (const text of texts) {
        for (const word of DENY_LIST) {
          expect(new RegExp(`\\b${word}\\b`, "i").test(text), `${def.slug}: ${text}`).toBe(false);
        }
      }
    }
  });

  it("C-GAL6-08 holds the perceptual score's four letters in no entry's link, in any case", () => {
    expect(GALLERY_DATA.entries).toHaveLength(24);
    for (const entry of GALLERY_DATA.entries) {
      expect(/apca/i.test(entry.link), entry.slug).toBe(false);
      expect(m6CopyProblems(entry.link), entry.slug).toEqual([]);
    }
  });

  it("C-GAL6-08 catches each way a row can break", () => {
    const base = { name: "Madder", slug: "madder", brief: null, line: "One locked seed." };
    expect(wordProblems(base)).toEqual([]);
    expect(wordProblems({ ...base, name: "Madder 2", slug: "madder-2" })).not.toEqual([]);
    expect(wordProblems({ ...base, name: "A".repeat(19), slug: "a".repeat(19) })).not.toEqual([]);
    expect(wordProblems({ ...base, slug: "Madder" })).not.toEqual([]);
    expect(wordProblems({ ...base, slug: "madder-x" })).not.toEqual([]);
    const brief = "A balanced planner for small teams, professional and fast.";
    expect(wordProblems({ ...base, brief })).toEqual([]);
    expect(wordProblems({ ...base, brief: `${brief} Two.` })).not.toEqual([]);
    expect(wordProblems({ ...base, brief: "A short brief." })).not.toEqual([]);
    expect(wordProblems({ ...base, brief: brief.slice(0, -1) })).not.toEqual([]);
    expect(wordProblems({ ...base, brief: `${brief.slice(0, -1)} in #ff0000.` })).not.toEqual([]);
    expect(
      wordProblems({ ...base, brief: "A balanced planner for the Google team, fast and calm." }),
    ).not.toEqual([]);
    expect(wordProblems({ ...base, line: "A line, simply put." })).not.toEqual([]);
    expect(wordProblems({ ...base, line: "A line about apca." })).not.toEqual([]);
  });
});

describe("the coverage of the entries (R6-05, R6-07)", () => {
  it("C-GAL6-09 covers all 14 presets with the 18 brief entries", () => {
    const briefSlugs = new Set(BRIEFS.map((def) => def.slug));
    const presets = GALLERY_DATA.entries
      .filter((entry) => briefSlugs.has(entry.slug))
      .map((entry) => entry.preset);
    expect(presets).toHaveLength(18);
    expect(new Set(presets)).toEqual(new Set(PRESET_IDS));
    expect(PRESET_IDS).toHaveLength(14);
  });

  it("C-GAL6-09 gives each entry one or two tags in GALLERY_TAGS order, none twice", () => {
    for (const def of DEFS) {
      expect(def.tags.length, def.slug).toBeGreaterThanOrEqual(1);
      expect(def.tags.length, def.slug).toBeLessThanOrEqual(2);
      expect(new Set(def.tags).size).toBe(def.tags.length);
      const order = def.tags.map((tag) => GALLERY_TAGS.indexOf(tag));
      expect(order, def.slug).toEqual([...order].sort((a, b) => a - b));
      expect(order.every((i) => i >= 0)).toBe(true);
    }
  });

  it("C-GAL6-09 counts the tags as 6.2 does", () => {
    const counts = GALLERY_TAGS.map((tag) => DEFS.filter((def) => def.tags.includes(tag)).length);
    expect(counts).toEqual([7, 7, 4, 6, 8, 7]);
  });
});
