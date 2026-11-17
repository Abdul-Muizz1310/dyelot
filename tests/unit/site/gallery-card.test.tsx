import type { ReactElement, ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { GALLERY_CARDS, type GalleryCard } from "@/features/gallery/cards";
import { SITE } from "@/lib/site/config";
import {
  GALLERY_CARD_ALT,
  GalleryShareCard,
  MOSAIC_ALT,
  MosaicShareCard,
  SHARE_CARD_SIZE,
} from "@/lib/site/gallery-card";
import { CONTENT_WIDTH, GLYPH_ADVANCE, INK, wrapLines } from "@/lib/site/share-card";
import { wordProblems } from "../support/gallery";

// The gallery's share cards (docs/specs/06-gallery.md, 8.1 and 8.2, section 14.3). Each card is read
// as Satori reads it: a tree of host elements, their inline styles and their children.

type Style = Readonly<Record<string, unknown>>;
type Box = {
  readonly type: string;
  readonly props: Readonly<Record<string, unknown>>;
  readonly style: Style;
  readonly children: readonly Child[];
};
/** A text, with the typography it inherits from its boxes. */
type Text = { readonly text: string; readonly style: Style };
type Child = Box | Text;

const INHERITED = ["fontSize", "fontWeight", "color", "letterSpacing"] as const;
const ICON = "data:image/svg+xml;base64,";

/** The tree under `node`: function components called, arrays flattened, texts kept. */
function tree(node: ReactNode, inherited: Style = {}): Child[] {
  if (node === null || node === undefined || typeof node === "boolean") return [];
  if (typeof node === "string" || typeof node === "number") {
    return [{ text: String(node), style: inherited }];
  }
  if (Array.isArray(node)) return node.flatMap((child) => tree(child, inherited));
  const element = node as ReactElement<{ style?: Style; children?: ReactNode }>;
  if (typeof element.type === "function") {
    return tree((element.type as (props: unknown) => ReactNode)(element.props), inherited);
  }
  const { children, style = {}, ...props } = element.props;
  const passed = Object.fromEntries(
    INHERITED.filter((key) => key in style).map((k) => [k, style[k]]),
  );
  return [
    {
      type: String(element.type),
      props,
      style,
      children: tree(children, { ...inherited, ...passed }),
    },
  ];
}

const isBox = (child: Child): child is Box => "type" in child;

/** Every box of `children`, in document order. */
const boxes = (children: readonly Child[]): Box[] =>
  children.filter(isBox).flatMap((box) => [box, ...boxes(box.children)]);

/** Every text of `children`, in document order. */
const texts = (children: readonly Child[]): Text[] =>
  children.flatMap((child) => (isBox(child) ? texts(child.children) : [child]));

const textOf = (children: readonly Child[], text: string): Text => {
  const found = texts(children).find((run) => run.text === text);
  if (found === undefined) throw new Error(`no text "${text}" in the card`);
  return found;
};

const card = (slug: string): GalleryCard => {
  const found = GALLERY_CARDS.cards.find((entry) => entry.slug === slug);
  if (found === undefined) throw new Error(`no card "${slug}"`);
  return found;
};

/** Satori's rule: a box with more than one child is a flex box; and no style asks for a grid. */
function expectSatoriSafe(root: readonly Child[]): void {
  const all = boxes(root);
  expect(all.filter((box) => box.children.length > 1 && box.style.display !== "flex")).toEqual([]);
  expect(all.filter((box) => box.style.display === "grid")).toEqual([]);
}

function expectBrandRow(root: readonly Child[]): void {
  const icon = boxes(root).find((box) => box.type === "img" && box.props.src === ICON);
  expect(icon?.props).toMatchObject({ width: 48, height: 48 });
  expect(textOf(root, SITE.name).style).toMatchObject({ fontSize: 40, fontWeight: 700 });
}

describe("C-CARD6-04 one entry's share card (R6-18)", () => {
  it.each(["kermes", "terre-verte"])("C-CARD6-04 draws %s's card as 8.1 lays it out", (slug) => {
    const entry = card(slug);
    const root = tree(GalleryShareCard({ card: entry, icon: ICON }));
    const words = texts(root).map((run) => run.text);
    const joined = words.join(" ");

    expectBrandRow(root);
    expect(textOf(root, `// gallery/${slug}`).style).toMatchObject({
      fontSize: 28,
      fontWeight: 400,
      color: INK.muted,
    });
    expect(textOf(root, entry.name).style).toMatchObject({
      fontSize: 96,
      fontWeight: 700,
      color: INK.foreground,
    });
    expect(joined).toContain(entry.line);
    const line = texts(root).filter((run) => run.style.fontSize === 30);
    expect(line.map((run) => run.text).join(" ")).toBe(entry.line);
    expect(line.length).toBeLessThanOrEqual(2);
    for (const run of line) {
      expect(run.style).toMatchObject({ fontWeight: 400, color: INK.muted });
    }
    expect(
      textOf(root, `${entry.passed} of ${entry.required} required checks pass`).style,
    ).toMatchObject({ fontSize: 28, fontWeight: 400, color: INK.foreground });
    expect(joined).toContain(`$ open dyelot.vercel.app/gallery/${slug}`);
    expect(words.at(-1)).toBe("muizz-lab");

    const blocks = boxes(root).filter((box) => box.style.width === 200 && box.style.height === 96);
    expect(blocks.map((block) => block.style.backgroundColor)).toEqual(entry.strip);
    for (const block of blocks) {
      expect(block.style).toMatchObject({ borderRadius: 12, border: `1px solid ${INK.border}` });
    }
    const strip = boxes(root).find(
      (box) => box.children.length === 5 && box.children.every((c) => blocks.includes(c as Box)),
    );
    expect(strip?.style.gap).toBe(8);

    expectSatoriSafe(root);
  });

  it("C-CARD6-04 is 1200 × 630 and carries 8.1's alt text", () => {
    expect(SHARE_CARD_SIZE).toEqual({ width: 1200, height: 630 });
    expect(GALLERY_CARD_ALT).toBe(
      "A design system from dyelot's gallery, with its name, its one-line description, five of its colors and its receipt count.",
    );
  });
});

describe("C-CARD6-05 the gallery's share card (R6-19)", () => {
  const root = tree(MosaicShareCard({ cards: GALLERY_CARDS.cards, icon: ICON }));

  it("C-CARD6-05 draws the headline with receipt in madder", () => {
    expectBrandRow(root);
    expect(textOf(root, "// gallery").style).toMatchObject({ fontSize: 28, color: INK.muted });
    const words = texts(root).map((run) => run.text);
    expect(words.join(" ")).toContain("24 design systems, each with its receipt");
    const headline = texts(root).filter((run) => run.style.fontSize === 56);
    expect(headline.map((run) => run.text).join(" ")).toBe(
      "24 design systems, each with its receipt",
    );
    for (const run of headline) expect(run.style.fontWeight).toBe(700);
    expect(
      headline.filter((run) => run.style.color === SITE.accent).map((run) => run.text),
    ).toEqual(["receipt"]);
    expect(words.join(" ")).toContain("$ open dyelot.vercel.app/gallery muizz-lab");
    expectSatoriSafe(root);
  });

  it("C-CARD6-05 lays out four rows of six tiles, each five bands of its strip, in order", () => {
    const isTile = (child: Child): boolean =>
      isBox(child) && child.style.width === 160 && child.style.height === 40;
    const tiles = boxes(root).filter(isTile);
    expect(tiles).toHaveLength(24);
    const rows = boxes(root).filter((box) => box.children.length > 0 && box.children.every(isTile));
    expect(rows.map((row) => row.children.length)).toEqual([6, 6, 6, 6]);
    for (const row of rows) expect(row.style.gap).toBe(12);
    const mosaic = boxes(root).find(
      (box) => box.children.length === 4 && box.children.every((c) => rows.includes(c as Box)),
    );
    expect(mosaic?.style.gap).toBe(12);

    const inRows = rows.flatMap((row) => row.children as Box[]);
    expect(inRows).toEqual(tiles);
    inRows.forEach((tile, i) => {
      const bands = tile.children as Box[];
      expect(bands.map((band) => band.style.backgroundColor)).toEqual(
        GALLERY_CARDS.cards[i]?.strip,
      );
      for (const band of bands) expect(band.style).toMatchObject({ width: 32, height: 40 });
    });
  });

  it("C-CARD6-05 carries 8.2's alt text", () => {
    expect(MOSAIC_ALT).toBe(
      "dyelot's gallery: 24 design systems, each shown as five of its colors.",
    );
  });
});

describe("C-CARD6-RF4 every card fits its lines (RF4, R6-12, R6-18)", () => {
  const LINE_COLUMNS = Math.floor(CONTENT_WIDTH / (30 * GLYPH_ADVANCE));
  const NAME_COLUMNS = Math.floor(CONTENT_WIDTH / (96 * GLYPH_ADVANCE));

  it("C-CARD6-RF4 wraps every line into two lines at most and fits every name on one", () => {
    expect(CONTENT_WIDTH).toBe(1056);
    expect(NAME_COLUMNS).toBe(18);
    expect(GALLERY_CARDS.cards).toHaveLength(24);
    for (const { slug, line, name } of GALLERY_CARDS.cards) {
      expect(wrapLines(line.split(" "), LINE_COLUMNS).length, slug).toBeLessThanOrEqual(2);
      expect(name.length, slug).toBeLessThanOrEqual(NAME_COLUMNS);
    }
  });

  it("C-CARD6-RF4 refuses a line of 101 characters and a name of 19 before they reach a card", () => {
    const long =
      "A quiet harbor at dawn, with slate water, pale rope, wet stone and one lamp left burning by the door.";
    expect(long).toHaveLength(101);
    expect(wordProblems({ name: "Kermes", slug: "kermes", brief: long, line: long })).toEqual([
      "brief has 101 characters, not 30 to 100",
    ]);
    const name = "Abcdefghijklmnopqrs";
    expect(name.length).toBe(NAME_COLUMNS + 1);
    const brief = "A calm study in slate, rope and harbor light.";
    expect(wordProblems({ name, slug: name.toLowerCase(), brief, line: brief })).toEqual([
      `name "${name}" is not 1 to 18 letters and single spaces`,
    ]);
  });
});
