/**
 * The gallery's link-preview cards (docs/specs/06-gallery.md, 8.1 and 8.2) as trees `next/og`
 * (Satori) can render: the M0 card's ground, flexbox only, inline styles, and every element with
 * more than one child a flex container. Each takes checked data from `cards.json`; each throws for
 * an argument that is not (docs/specs/07-finish.md, R7-13).
 */
import type { ReactElement } from "react";
import type { GalleryCard } from "@/features/gallery/cards";
import { SITE } from "./config";
import {
  CONTENT_WIDTH,
  DOT_GRID,
  GLYPH_ADVANCE,
  INK,
  LETTER_SPACING_EM,
  rgba,
  SHARE_CARD_SIZE,
  wrapLines,
} from "./share-card";

export { SHARE_CARD_SIZE };

export const GALLERY_CARD_ALT =
  "A design system from dyelot's gallery, with its name, its one-line description, five of its colors and its receipt count.";
export const MOSAIC_ALT = "dyelot's gallery: 24 design systems, each shown as five of its colors.";

const PADDING_X = (SHARE_CARD_SIZE.width - CONTENT_WIDTH) / 2;
const HOST = new URL(SITE.url).host;
/** The M0 headline's tracking, which `GLYPH_ADVANCE` counts: the fit model and the render agree. */
const TRACKING = `${LETTER_SPACING_EM}em`;

/**
 * The space between the parts. 8.1 asks for 16 px and, when the column does not fit 630 px, for
 * narrower gaps, never smaller type: with the line on two lines the parts and the footer stand
 * about 459 px tall in the 510 px between the paddings, so six gaps of 8 px fit and six of 16 do not.
 */
const PART_GAP = 8;

const LINE_PX = 30;
/** How many characters of the line fit across the card at 30 px (C-CARD6-RF4). */
const LINE_COLUMNS = Math.floor(CONTENT_WIDTH / (LINE_PX * GLYPH_ADVANCE));

const BLOCK = { width: 200, height: 96 } as const;

/** The headline's two lines (R7-12): the break leaves no word alone on the second. */
const MOSAIC_LINES = ["24 design systems,", "each with its receipt"] as const;
const MOSAIC_HIGHLIGHT = "receipt";
const HEADLINE_PX = 56;
const TILES_PER_ROW = 6;
const HEX = /^#[0-9a-f]{6}$/;
const TILE = { width: 160, height: 40 } as const;
const MOSAIC_GAP = 12;

/** The M0 card's frame: its padding, ink and font; the parts at the top, the footer at the foot. */
const FRAME = {
  position: "relative",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  gap: PART_GAP,
  width: "100%",
  height: "100%",
  padding: `64px ${PADDING_X}px 56px`,
  backgroundColor: INK.background,
  color: INK.foreground,
  fontFamily: "Geist Mono",
} as const;

const COLUMN = { display: "flex", flexDirection: "column", gap: PART_GAP } as const;

/** The M0 card's ground behind the parts: the dot grid and the madder glow. */
function ground(): ReactElement[] {
  const fill = { position: "absolute", top: 0, left: 0, display: "flex" } as const;
  return [
    // biome-ignore lint/performance/noImgElement: Satori draws a plain <img>; next/image cannot render here
    <img key="dots" src={DOT_GRID} alt="" style={{ ...fill, ...SHARE_CARD_SIZE }} />,
    <div
      key="glow"
      style={{
        ...fill,
        ...SHARE_CARD_SIZE,
        backgroundImage: `radial-gradient(circle at 22% 0%, ${rgba(SITE.accent, 0.22)} 0%, ${rgba(SITE.accent, 0)} 60%)`,
      }}
    />,
  ];
}

/** The icon and the name, as `ShareCard` draws them, at 48 and 40 px. */
function brandRow(icon: string): ReactElement {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      {/* biome-ignore lint/performance/noImgElement: Satori draws a plain <img>; next/image cannot render here */}
      <img src={icon} width={48} height={48} alt="" />
      <span style={{ fontSize: 40, fontWeight: 700, letterSpacing: TRACKING }}>{SITE.name}</span>
    </div>
  );
}

/** A `//` comment line. */
function comment(text: string): ReactElement {
  return <span style={{ fontSize: 28, fontWeight: 400, color: INK.muted }}>{`// ${text}`}</span>;
}

/** The M0 card's footer, opening `path` on the live host. */
function footer(path: string): ReactElement {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        paddingTop: 24,
        borderTop: `1px solid ${INK.border}`,
        fontSize: 24,
        color: INK.muted,
      }}
    >
      <div style={{ display: "flex", gap: 14 }}>
        <span style={{ color: SITE.accent }}>$</span>
        <span>open</span>
        <span style={{ color: INK.foreground }}>{`${HOST}${path}`}</span>
      </div>
      <span>muizz-lab</span>
    </div>
  );
}

function typeName(value: unknown): string {
  if (value === null) return "null";
  return Array.isArray(value) ? "array" : typeof value;
}

function expectType(ok: boolean, caller: string, path: string, what: string, value: unknown): void {
  if (!ok) throw new TypeError(`${caller}: ${path} must be ${what}, got ${typeName(value)}`);
}

/** R7-13's types for one card; every type before any domain. */
function typeCheckCard(card: unknown, caller: string, path: string): void {
  expectType(
    typeof card === "object" && card !== null && !Array.isArray(card),
    caller,
    path,
    "an object",
    card,
  );
  const fields = card as Record<string, unknown>;
  for (const key of ["slug", "name", "line"]) {
    expectType(typeof fields[key] === "string", caller, `${path}.${key}`, "a string", fields[key]);
  }
  const strip = fields.strip;
  expectType(
    Array.isArray(strip) && strip.every((hex) => typeof hex === "string"),
    caller,
    `${path}.strip`,
    "an array of strings",
    strip,
  );
  for (const key of ["passed", "required"]) {
    expectType(typeof fields[key] === "number", caller, `${path}.${key}`, "a number", fields[key]);
  }
}

/** R7-13's domains for one card whose types hold. */
function domainCheckCard(card: GalleryCard, caller: string, path: string): void {
  if (card.strip.length !== 5 || !card.strip.every((hex) => HEX.test(hex))) {
    throw new RangeError(
      `${caller}: ${path}.strip must be five lowercase #rrggbb colors, got ${JSON.stringify(card.strip)}`,
    );
  }
  for (const key of ["passed", "required"] as const) {
    if (!Number.isInteger(card[key]) || card[key] < 0) {
      throw new RangeError(
        `${caller}: ${path}.${key} must be a whole number of at least 0, got ${card[key]}`,
      );
    }
  }
}

/** One entry's card (8.1, R6-18). */
export function GalleryShareCard({ card, icon }: { card: GalleryCard; icon: string }) {
  typeCheckCard(card, "GalleryShareCard", "card");
  expectType(typeof icon === "string", "GalleryShareCard", "icon", "a string", icon);
  domainCheckCard(card, "GalleryShareCard", "card");
  const lines = wrapLines(card.line.split(" "), LINE_COLUMNS).map((words) => words.join(" "));
  return (
    <div style={FRAME}>
      {ground()}
      <div style={COLUMN}>
        {brandRow(icon)}
        {comment(`gallery/${card.slug}`)}
        <span
          style={{
            fontSize: 96,
            fontWeight: 700,
            lineHeight: 1.08,
            letterSpacing: TRACKING,
            color: INK.foreground,
          }}
        >
          {card.name}
        </span>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: LINE_PX,
            fontWeight: 400,
            letterSpacing: TRACKING,
            color: INK.muted,
          }}
        >
          {lines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {card.strip.map((hex) => (
            <div
              key={hex}
              style={{
                ...BLOCK,
                borderRadius: 12,
                border: `1px solid ${INK.border}`,
                backgroundColor: hex,
              }}
            />
          ))}
        </div>
        <span style={{ fontSize: 28, fontWeight: 400, color: INK.foreground }}>
          {`${card.passed} of ${card.required} required checks pass`}
        </span>
      </div>
      {footer(`/gallery/${card.slug}`)}
    </div>
  );
}

/** One mosaic tile: the card's strip as equal bands. */
function tile(card: GalleryCard): ReactElement {
  const band = { width: TILE.width / card.strip.length, height: TILE.height };
  return (
    <div key={card.slug} style={{ display: "flex", ...TILE }}>
      {card.strip.map((hex) => (
        <div key={hex} style={{ ...band, backgroundColor: hex }} />
      ))}
    </div>
  );
}

/** The gallery's card (8.2, R6-19): the headline and every entry's strip, six to a row. */
export function MosaicShareCard({ cards, icon }: { cards: readonly GalleryCard[]; icon: string }) {
  expectType(Array.isArray(cards), "MosaicShareCard", "cards", "an array", cards);
  cards.forEach((card, i) => {
    typeCheckCard(card, "MosaicShareCard", `cards[${i}]`);
  });
  expectType(typeof icon === "string", "MosaicShareCard", "icon", "a string", icon);
  if (cards.length === 0) throw new RangeError("MosaicShareCard: cards must not be empty");
  cards.forEach((card, i) => {
    domainCheckCard(card, "MosaicShareCard", `cards[${i}]`);
  });
  const rows = Array.from({ length: Math.ceil(cards.length / TILES_PER_ROW) }, (_, row) =>
    cards.slice(row * TILES_PER_ROW, (row + 1) * TILES_PER_ROW),
  );
  return (
    <div style={FRAME}>
      {ground()}
      <div style={COLUMN}>
        {brandRow(icon)}
        {comment("gallery")}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            rowGap: Math.round(HEADLINE_PX * 0.14),
            fontSize: HEADLINE_PX,
            fontWeight: 700,
            lineHeight: 1.08,
            letterSpacing: TRACKING,
          }}
        >
          {MOSAIC_LINES.map((line) => (
            <div key={line} style={{ display: "flex", columnGap: HEADLINE_PX * GLYPH_ADVANCE }}>
              {line.split(" ").map((word) => (
                <span key={word} style={word === MOSAIC_HIGHLIGHT ? { color: SITE.accent } : {}}>
                  {word}
                </span>
              ))}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: MOSAIC_GAP }}>
          {rows.map((row) => (
            <div key={row[0]?.slug} style={{ display: "flex", gap: MOSAIC_GAP }}>
              {row.map(tile)}
            </div>
          ))}
        </div>
      </div>
      {footer("/gallery")}
    </div>
  );
}
