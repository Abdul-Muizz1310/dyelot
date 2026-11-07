import { notFound } from "next/navigation";
import { ImageResponse } from "next/og";
import { cardOf } from "@/features/gallery/cards";
import { shareCardAssets } from "@/lib/site/assets";
import { GALLERY_CARD_ALT, GalleryShareCard, SHARE_CARD_SIZE } from "@/lib/site/gallery-card";

// One entry's share card (docs/specs/06-gallery.md, R6-18, 8.1), rendered per request, since no
// slug is listed for the build (R6-49). It reads cards.json and nothing else, and imports only
// C-GUARD6-07's modules; an unknown slug answers Next's 404.

export const alt = GALLERY_CARD_ALT;
export const size = SHARE_CARD_SIZE;
export const contentType = "image/png";

export default async function OpengraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const card = cardOf(slug);
  if (card === null) notFound();
  const { fonts, icon } = await shareCardAssets();
  return new ImageResponse(<GalleryShareCard card={card} icon={icon} />, { ...size, fonts });
}
