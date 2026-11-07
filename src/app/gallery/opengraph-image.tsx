import { ImageResponse } from "next/og";
import { GALLERY_CARDS } from "@/features/gallery/cards";
import { shareCardAssets } from "@/lib/site/assets";
import { MOSAIC_ALT, MosaicShareCard, SHARE_CARD_SIZE } from "@/lib/site/gallery-card";

// The gallery's share card (docs/specs/06-gallery.md, R6-19, 8.2). It reads cards.json and nothing
// else, and imports only C-GUARD6-07's modules.

export const alt = MOSAIC_ALT;
export const size = SHARE_CARD_SIZE;
export const contentType = "image/png";

export default async function OpengraphImage() {
  const { fonts, icon } = await shareCardAssets();
  return new ImageResponse(<MosaicShareCard cards={GALLERY_CARDS.cards} icon={icon} />, {
    ...size,
    fonts,
  });
}
