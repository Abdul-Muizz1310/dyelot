// The T-FE-nn ids in this file are borrowed from inkthread-frontend/docs/specs/01-site-metadata.md.
// The convention is knowledge/conventions/convention-site-metadata.md in the meta-repo.

import { describe, expect, it } from "vitest";
import { SITE } from "@/lib/site/config";
import { defineSite, NEVER_USE_HOSTS, SiteConfigError, type SiteInput } from "@/lib/site/define";

const valid: SiteInput = {
  name: "example",
  title: "example — a site that passes every check",
  description: "A description long enough for a search result and short enough not to be cut off.",
  url: "https://example-frontend.vercel.app",
  accent: "#f66c6d",
  keywords: ["example"],
  card: { comment: "a comment", headline: "catch slow queries.", highlight: "slow" },
  routes: { sitemap: ["/"], disallow: ["/api/"] },
};

describe("defineSite (T-FE-20)", () => {
  it("accepts the real config and derives its origin", () => {
    expect(SITE.url).toBe("https://dyelot.vercel.app");
    expect(SITE.origin.href).toBe("https://dyelot.vercel.app/");
  });

  it("carries dyelot's own copy, with nothing left over from a sibling", () => {
    expect(SITE).toMatchObject({
      name: "dyelot",
      accent: "#f66c6d",
      title: "dyelot — a palette becomes a design system your coding agent can build",
      description:
        "Turn a color, a brief or an image into a complete, accessible design system. Preview it live and hand your coding agent DESIGN.md, tokens and a prompt.",
      keywords: [
        "design system",
        "color palette",
        "OKLCH",
        "WCAG",
        "DESIGN.md",
        "design tokens",
        "Tailwind",
        "shadcn",
      ],
      card: {
        comment: "a palette becomes a design system",
        headline: "one palette, every screen, a receipt for each color",
        highlight: "receipt",
      },
      routes: { sitemap: ["/"], disallow: [] },
    });
  });

  it("accepts a valid config", () => {
    expect(defineSite(valid).origin.host).toBe("example-frontend.vercel.app");
  });
});

describe("defineSite rejects (T-FE-21)", () => {
  const cases: [string, Record<string, unknown>, RegExp][] = [
    ["a url that is not a URL", { url: "not a url" }, /not a URL/],
    ["an http origin", { url: "http://example-frontend.vercel.app" }, /https/],
    ["an origin with a path", { url: "https://example-frontend.vercel.app/app" }, /bare origin/],
    ["a trailing slash", { url: "https://example-frontend.vercel.app/" }, /bare origin/],
    ...[...NEVER_USE_HOSTS].map((host): [string, Record<string, unknown>, RegExp] => [
      `the never-use host ${host}`,
      { url: `https://${host}` },
      /never-use/,
    ]),
    ["an empty name", { name: "" }, /name/],
    ["a name over 12 characters", { name: "a-very-long-name" }, /name/],
    ["a title over 70 characters", { title: "t".repeat(71) }, /title/],
    ["a description under 50 characters", { description: "too short" }, /description/],
    ["a description over 160 characters", { description: "d".repeat(161) }, /description/],
    ["an accent that is not #rrggbb", { accent: "#fff" }, /accent/],
    ["an empty highlight", { card: { ...valid.card, highlight: "" } }, /highlight/],
    [
      "a highlight missing from the headline",
      { card: { ...valid.card, highlight: "fast" } },
      /highlight/,
    ],
    ["a route without a leading slash", { routes: { sitemap: ["d"], disallow: [] } }, /route/],
    [
      "a sitemap route that robots.txt disallows",
      { routes: { sitemap: ["/api/status"], disallow: ["/api/"] } },
      /disallow/,
    ],
  ];

  it.each(cases)("%s", (_why, patch, reason) => {
    const input = { ...valid, ...patch } as unknown as SiteInput;
    expect(() => defineSite(input)).toThrow(SiteConfigError);
    expect(() => defineSite(input)).toThrow(reason);
  });
});
