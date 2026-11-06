// The T-FE-nn ids in this file are borrowed from inkthread-frontend/docs/specs/01-site-metadata.md.
// The convention is knowledge/conventions/convention-site-metadata.md in the meta-repo.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import ConnectCallbackPage, { metadata as callbackMetadata } from "@/app/connect/callback/page";
import ConnectPage, { metadata as connectMetadata } from "@/app/connect/page";
import manifest from "@/app/manifest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { SITE } from "@/lib/site/config";
import { defineSite } from "@/lib/site/define";
import { pageMetadata, robotsFile } from "@/lib/site/metadata";
import { pngSize } from "./image-headers";

describe("manifest (T-FE-24)", () => {
  const m = manifest();

  it("names the site and opens at the home page in the dark colors", () => {
    expect(m).toMatchObject({
      name: "dyelot",
      short_name: "dyelot",
      description: SITE.description,
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: "#0a0a0a",
      theme_color: "#0a0a0a",
    });
  });

  it("lists any-purpose 192 and 512 icons and a maskable 512", () => {
    expect(m.icons?.map((i) => `${i.sizes} ${i.purpose}`)).toEqual([
      "192x192 any",
      "512x512 any",
      "512x512 maskable",
    ]);
  });

  it.each(m.icons ?? [])("$src exists in public/ at $sizes", (icon) => {
    expect(pngSize(readFileSync(join("public", icon.src)))).toBe(icon.sizes);
  });
});

describe("robots and sitemap (T-FE-25)", () => {
  // T-FE-25 as docs/specs/04-ai.md section 16 amends it (R4-22): the API and the OAuth callback
  // leave robots.txt, and the sitemap lists the four routes of R5-34.
  it("C-SITE4-01 and C-SITE5-02 allow the site but /api/ and /connect/callback, and names the sitemap", () => {
    expect(robots()).toEqual({
      rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/connect/callback"] }],
      sitemap: "https://dyelot.vercel.app/sitemap.xml",
    });
    expect(sitemap().map((entry) => entry.url)).toEqual([
      "https://dyelot.vercel.app/",
      "https://dyelot.vercel.app/studio",
      "https://dyelot.vercel.app/explore",
      "https://dyelot.vercel.app/motion",
    ]);
  });

  it("disallows the machine endpoints a site declares", () => {
    const site = defineSite({ ...SITE, routes: { sitemap: ["/"], disallow: ["/api/", "/auth/"] } });
    expect(robotsFile(site).rules).toEqual([
      { userAgent: "*", allow: "/", disallow: ["/api/", "/auth/"] },
    ]);
  });

  it("lists the sitemap routes, as absolute URLs, once each", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toEqual([
      "https://dyelot.vercel.app/",
      "https://dyelot.vercel.app/studio",
      "https://dyelot.vercel.app/explore",
      "https://dyelot.vercel.app/motion",
    ]);
    expect(new Set(urls).size).toBe(urls.length);
  });
});

// C-SITE4-03 of docs/specs/04-ai.md, section 14.8 (R4-22, R4-33, section 12.4).
describe("C-SITE4-03 the connect pages' metadata", () => {
  afterEach(cleanup);

  const CONNECT = {
    title: "Connect your OpenRouter key",
    description:
      "Use your own OpenRouter account for dyelot's model actions. Your browser talks to OpenRouter directly, and the key never reaches dyelot.",
  };
  const CALLBACK = {
    title: "Connecting your OpenRouter key",
    description:
      "Finishes the OpenRouter sign-in in this browser and returns you to the studio. The key stays in this browser.",
  };

  it("C-SITE4-03 /connect has 12.4's title and description, a canonical and noindex, nofollow", () => {
    expect(connectMetadata).toEqual({
      title: CONNECT.title,
      description: CONNECT.description,
      alternates: { canonical: "/connect" },
      robots: { index: false, follow: false },
    });
  });

  it("C-SITE4-03 /connect/callback adds no-referrer to the same keys", () => {
    expect(callbackMetadata).toEqual({
      title: CALLBACK.title,
      description: CALLBACK.description,
      alternates: { canonical: "/connect/callback" },
      robots: { index: false, follow: false },
      referrer: "no-referrer",
    });
  });

  it.each([
    ["/connect", CONNECT],
    ["/connect/callback", CALLBACK],
  ] as const)("C-SITE4-03 %s's copy is within pageMetadata's bounds", (route, copy) => {
    expect(() => pageMetadata(SITE, route, copy)).not.toThrow();
    expect(copy.description.length).toBeGreaterThanOrEqual(50);
    expect(copy.description.length).toBeLessThanOrEqual(160);
    expect(`${copy.title} — ${SITE.name}`.length).toBeLessThanOrEqual(70);
  });

  // Section 13.6: until Task 4.10a mounts the panels, each page shows only its heading, which is
  // the title above.
  it.each([
    ["/connect", ConnectPage, CONNECT.title],
    ["/connect/callback", ConnectCallbackPage, CALLBACK.title],
  ] as const)("C-SITE4-03 %s's one heading is its title", (_, Page, title) => {
    render(createElement(Page));
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(title);
  });
});
