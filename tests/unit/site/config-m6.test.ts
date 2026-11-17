import { describe, expect, it } from "vitest";
import { metadata as aboutMetadata } from "@/app/about/page";
import { metadata as galleryMetadata } from "@/app/gallery/page";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { galleryRoutes } from "@/features/gallery/data";
import { SITE } from "@/lib/site/config";
import { sitemapEntries } from "@/lib/site/metadata";

// C-SITE6-01 to C-SITE6-03 of docs/specs/06-gallery.md, section 14.8 (R6-31, R6-13, R6-21).

const ORIGIN = "https://dyelot.vercel.app";
const SIX = ["/", "/studio", "/explore", "/motion", "/gallery", "/about"];

describe("C-SITE6-01 the sitemap", () => {
  it("C-SITE6-01 lists the six routes and then the 24 entry pages, and robots is unchanged", () => {
    expect(SITE.routes.sitemap).toEqual(SIX);
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toEqual([...SIX, ...galleryRoutes()].map((route) => `${ORIGIN}${route}`));
    expect(urls).toHaveLength(30);
    expect(robots()).toEqual({
      rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/connect/callback"] }],
      sitemap: `${ORIGIN}/sitemap.xml`,
    });
  });
});

describe("C-SITE6-02 sitemapEntries rejects", () => {
  it.each([
    ["a repeat", ["/studio"]],
    ["a disallowed route", ["/api/x"]],
    ["a route with no leading slash", ["gallery"]],
  ])("C-SITE6-02 %s with a RangeError naming sitemapEntries", (_why, more) => {
    expect(() => sitemapEntries(SITE, more as never)).toThrow(RangeError);
    expect(() => sitemapEntries(SITE, more as never)).toThrow(/^sitemapEntries:/);
  });

  it("C-SITE6-02 a `more` that is not an array is a TypeError naming sitemapEntries", () => {
    expect(() => sitemapEntries(SITE, "/gallery" as never)).toThrow(TypeError);
    expect(() => sitemapEntries(SITE, "/gallery" as never)).toThrow(/^sitemapEntries:/);
  });

  it("C-SITE6-02 checks every type before any value", () => {
    expect(() => sitemapEntries(SITE, ["/studio", 5] as never)).toThrow(TypeError);
  });
});

describe("C-SITE6-03 the metadata of /gallery and /about", () => {
  it.each([
    ["Gallery", "/gallery", galleryMetadata, 150],
    ["About", "/about", aboutMetadata, 146],
  ])("C-SITE6-03 %s", (title, canonical, metadata, length) => {
    expect(metadata.title).toBe(title);
    expect(metadata.alternates?.canonical).toBe(canonical);
    expect(String(metadata.description)).toHaveLength(length);
  });
});
