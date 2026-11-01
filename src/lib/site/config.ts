import { defineSite } from "./define";

/** Everything a tab, a search result, an install and a link preview say about dyelot. */
export const SITE = defineSite({
  name: "dyelot",
  title: "dyelot — a palette becomes a design system your coding agent can build",
  description:
    "Turn a color, a brief or an image into a complete, accessible design system. Preview it live and hand your coding agent DESIGN.md, tokens and a prompt.",
  url: "https://dyelot.vercel.app",
  accent: "#f66c6d",
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
  // No machine endpoints yet, so robots.txt disallows nothing.
  routes: { sitemap: ["/", "/studio"], disallow: [] },
});
