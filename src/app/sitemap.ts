import type { MetadataRoute } from "next";
import { galleryRoutes } from "@/features/gallery/data";
import { SITE } from "@/lib/site/config";
import { sitemapEntries } from "@/lib/site/metadata";

export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapEntries(SITE, galleryRoutes());
}
