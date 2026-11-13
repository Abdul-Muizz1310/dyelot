import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";
import { GALLERY_DATA } from "../unit/support/gallery";
import { test } from "./flavor-support";

// The landing's receipt section, start.log and the nav: F-LAND6-06, F-LAND6-07 and F-NAV6-01 to
// F-NAV6-03 and RF5 of docs/specs/06-gallery.md, section 14.7 (R6-29 to R6-32, sections 9.2 to 9.4).

test.use({ viewport: { width: 1280, height: 800 } });

// What the page must show is read from the committed excerpt on disk and 9.2's sentences, never from
// the app's own `receipt.ts` (Playwright cannot import its JSON).
const EXCERPT = JSON.parse(
  readFileSync(path.join(process.cwd(), "src/features/landing/receipt-excerpt.json"), "utf8"),
);
const excerptText = (part: unknown): string => JSON.stringify(part, null, 2);
const errors = (n: number): string => (n === 0 ? "no error" : n === 1 ? "1 error" : `${n} errors`);
const SENTENCES = [
  `Every export carries receipt.json, in the format ${EXCERPT.format}: the measurements of the design, written by the engine that made it. Here are three parts of the receipt of ${EXCERPT.name}, the design of the story above.`,
  `The summary: ${EXCERPT.summary.contrast.requiredPass} of ${EXCERPT.summary.contrast.required} required contrast checks pass, and the linter found ${errors(EXCERPT.summary.lint.error)}.`,
  `One of the ${EXCERPT.checks} contrast checks: ${EXCERPT.contrast.foreground} on ${EXCERPT.contrast.background} in ${EXCERPT.contrast.mode} mode, measured, with the ratio cut to four decimals so it never rounds up.`,
  EXCERPT.finding === null
    ? "The linter found nothing to note in this design."
    : "One finding of the linter, with the rule it comes from.",
  "The export also holds a checker with no dependencies. A coding agent runs it from the app's root before it finishes:",
  `It checks the theme against receipt.json, measures the ${EXCERPT.summary.contrast.required} required contrast pairs again and scans the source for raw colors and Tailwind palette classes. It prints PASS when the code keeps to the design.`,
];

const ORIGIN = "https://dyelot.vercel.app";
const NAV = ["home", "studio", "explore", "motion", "gallery", "about", "github"];

const navLinks = (page: Page): Promise<string[]> =>
  page
    .getByRole("navigation")
    .first()
    .getByRole("link")
    .evaluateAll((links) => links.map((link) => link.textContent?.trim() ?? ""));

test("F-LAND6-06 the receipt section follows the story and shows the excerpt", async ({ page }) => {
  await page.goto("/");
  const section = page.locator("[data-receipt]");
  await expect(section).toHaveCount(1);
  expect(
    await page.evaluate(() => {
      const story = document.querySelector("[data-story]");
      const receipt = document.querySelector("[data-receipt]");
      return (
        story !== null &&
        receipt !== null &&
        Boolean(story.compareDocumentPosition(receipt) & Node.DOCUMENT_POSITION_FOLLOWING)
      );
    }),
  ).toBe(true);
  const [opening, summary, contrast, finding, checker, closing] = SENTENCES;
  await expect(section.getByRole("heading", { level: 2, name: "The receipt" })).toBeVisible();
  await expect(section.getByText(opening as string, { exact: true })).toBeVisible();
  await expect(section.locator('[data-excerpt="summary"] figcaption')).toHaveText(
    summary as string,
  );
  await expect(section.locator('[data-excerpt="contrast"] figcaption')).toHaveText(
    contrast as string,
  );
  await expect(section.locator('[data-excerpt="finding"] figcaption')).toHaveText(
    finding as string,
  );
  expect(summary).toContain("78 of 78");
  expect(summary).toContain("no error");
  expect(contrast).toContain("One of the 80 contrast checks");
  expect(contrast).toContain("foreground on background in light mode");
  await expect(section.getByText(checker as string, { exact: true })).toBeVisible();
  await expect(section.getByText(closing as string, { exact: true })).toBeVisible();
  for (const [name, part] of [
    ["summary", EXCERPT.summary],
    ["contrast", EXCERPT.contrast],
    ["finding", EXCERPT.finding],
  ]) {
    const text = await section.locator(`[data-excerpt="${name}"] pre`).textContent();
    expect(JSON.parse(text ?? ""), name).toEqual(part);
    expect(text).toBe(excerptText(part));
  }
  await expect(section.locator("pre").last()).toHaveText("$ node scripts/dyelot-check.mjs");
});

test("F-LAND6-07 start.log holds the six links as siblings in one div", async ({ page }) => {
  await page.goto("/");
  const main = page.getByRole("main");
  const repository = "https://github.com/Abdul-Muizz1310/dyelot";
  const names = [
    "open the studio",
    "open the explorer",
    "open the motion lab",
    "open the gallery",
    "open the about page",
  ];
  const hrefs = ["/studio", "/explore", "/motion", "/gallery", "/about"];
  for (const [index, name] of names.entries()) {
    const link = main.getByRole("link", { name, exact: true });
    await expect(link).toHaveCount(1);
    await expect(link).toHaveAttribute("href", hrefs[index] as string);
  }
  const has = [...hrefs, repository].map((href) => `:has(> a[href="${href}"])`).join("");
  await expect(main.locator(`div${has}`)).toHaveCount(1);
});

test("F-NAV6-01 the seven links share one row at 1280 x 800, and the current page is marked", async ({
  page,
}) => {
  for (const [path, current] of [
    ["/gallery", "gallery"],
    ["/gallery/kermes", "gallery"],
    ["/about", "about"],
  ] as const) {
    await page.goto(path);
    const nav = page.getByRole("navigation").first();
    expect((await navLinks(page)).slice(1), path).toEqual(NAV);
    const tops = new Set<number>();
    for (const name of NAV) {
      const box = await nav.getByRole("link", { name, exact: true }).boundingBox();
      tops.add(Math.round(box?.y ?? -1));
    }
    expect(tops.size, path).toBe(1);
    const marked = await nav
      .locator('a[aria-current="page"]')
      .evaluateAll((links) => links.map((link) => link.textContent?.trim()));
    expect(marked, path).toEqual([current]);
  }
});

const PHONE_PAGES = [
  "/",
  "/gallery",
  "/gallery/kermes",
  "/about",
  "/explore",
  "/motion",
  "/connect",
  "/no-such-page",
] as const;

test("F-NAV6-02 at 360 x 740 the seven links are visible in at most two rows on every page", async ({
  page,
  watch,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  for (const path of PHONE_PAGES) {
    const response = await page.goto(path);
    if (path === "/no-such-page") {
      watch.allow(
        /^Failed to load resource: the server responded with a status of 404 \(Not Found\)$/,
        1,
        response?.url() ?? "",
      );
    }
    const nav = page.getByRole("navigation").first();
    const navBox = await nav.boundingBox();
    const tops = new Set<number>();
    for (const name of NAV) {
      const link = nav.getByRole("link", { name, exact: true });
      await expect(link, `${path} ${name}`).toBeVisible();
      const box = await link.boundingBox();
      expect(box?.height ?? 0, `${path} ${name}`).toBeGreaterThanOrEqual(32);
      expect(box?.width ?? 0, `${path} ${name}`).toBeGreaterThanOrEqual(24);
      tops.add(Math.round(box?.y ?? -1));
    }
    expect(tops.size, path).toBeLessThanOrEqual(2);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(0);
    const marks = await nav.locator('a[aria-current="page"]').all();
    for (const mark of marks) {
      const box = await mark.boundingBox();
      const bottom = (box?.y ?? 0) + (box?.height ?? 0) + 2;
      expect(box?.y ?? -1, path).toBeGreaterThanOrEqual(navBox?.y ?? 0);
      expect(bottom, path).toBeLessThanOrEqual((navBox?.y ?? 0) + (navBox?.height ?? 0));
    }
    await page.waitForLoadState("networkidle");
  }
});

test("F-NAV6-03 /sitemap.xml lists the 30 URLs in order", async ({ request }) => {
  const response = await request.get("/sitemap.xml");
  expect(response.status()).toBe(200);
  const locations = [...(await response.text()).matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
  expect(locations).toEqual([
    `${ORIGIN}/`,
    `${ORIGIN}/studio`,
    `${ORIGIN}/explore`,
    `${ORIGIN}/motion`,
    `${ORIGIN}/gallery`,
    `${ORIGIN}/about`,
    ...GALLERY_DATA.entries.map((entry) => `${ORIGIN}/gallery/${entry.slug}`),
  ]);
  expect(locations).toHaveLength(30);
});

test("F-NAV6-RF5 at 320 x 640 the nav holds seven links in at most two rows with no sideways scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const path of ["/", "/gallery"]) {
    await page.goto(path);
    const nav = page.getByRole("navigation").first();
    const tops = new Set<number>();
    for (const name of NAV) {
      const link = nav.getByRole("link", { name, exact: true });
      await expect(link, `${path} ${name}`).toBeVisible();
      tops.add(Math.round((await link.boundingBox())?.y ?? -1));
    }
    expect(tops.size, path).toBeLessThanOrEqual(2);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
