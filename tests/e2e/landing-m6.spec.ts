import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Locator, type Page } from "@playwright/test";
import { GALLERY_DATA } from "../unit/support/gallery";
import { briefField, imageInput, lockToggle, seedField } from "./ai-support";
import { test } from "./flavor-support";
import { ready } from "./studio-support";

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

/** The site's nav: the one `nav` that links to the repository (the gallery adds a labeled one). */
const siteNav = (page: Page): Locator =>
  page.getByRole("navigation").filter({ has: page.getByRole("link", { name: "github" }) });

const navLinks = (page: Page): Promise<string[]> =>
  siteNav(page)
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
  // Each pre wraps and may break anywhere (9.2): the computed style, not the class list.
  const styles = await section
    .locator("pre")
    .evaluateAll((pres) =>
      pres.map((pre) => [getComputedStyle(pre).overflowWrap, getComputedStyle(pre).whiteSpace]),
    );
  expect(styles).toHaveLength(4);
  for (const style of styles) expect(style).toEqual(["anywhere", "pre-wrap"]);
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
    const nav = siteNav(page);
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
    const nav = siteNav(page);
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
    // Every page of the nav marks its own link; /connect and the 404 page mark none.
    expect(marks.length, path).toBe(path === "/connect" || path === "/no-such-page" ? 0 : 1);
    for (const mark of marks) {
      const box = await mark.boundingBox();
      const bottom = (box?.y ?? 0) + (box?.height ?? 0) + 2;
      expect(box?.y ?? -1, path).toBeGreaterThanOrEqual(navBox?.y ?? 0);
      expect(bottom, path).toBeLessThanOrEqual((navBox?.y ?? 0) + (navBox?.height ?? 0));
    }
    // The next goto must not abort this page's in-flight chunk requests and report them to the watch.
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
    const nav = siteNav(page);
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

// F-LAND6-01 to 05 of docs/specs/06-gallery.md, section 14 (R6-27, R6-28, 9.1): the landing's
// start-from section.

const START_TITLE = "start-from.log";
const section = (page: Page) => page.locator("[data-start-from]");

/** The brief form's own status line: the color's `output` is a status region too. */
const briefStatus = (page: Page) =>
  section(page)
    .locator("form", { has: page.getByLabel("Describe the product or mood", { exact: true }) })
    .getByRole("status");

/** The URL of every navigation the main frame commits from now on. */
function recordNavigations(page: Page): string[] {
  const urls: string[] = [];
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) urls.push(frame.url());
  });
  return urls;
}

test.describe("14 the start-from section", () => {
  test("F-LAND6-01 sits between the hero and start.log with every string of 9.1", async ({
    page,
  }) => {
    await page.goto("/");
    const titles = await page.evaluate(() =>
      [...document.querySelectorAll("section > header > div.text-center")].map(
        (el) => el.textContent,
      ),
    );
    const at = titles.indexOf(START_TITLE);
    expect(at).toBeGreaterThan(0);
    // The hero's window is the one before it: its title is the card's file name.
    expect(titles[at - 1]).toMatch(/\.flavor$/);
    expect(titles[at + 1]).toBe("start.log");
    const box = section(page);
    await expect(box.getByRole("heading", { level: 2 })).toHaveText("Start a design from");
    await expect(box.getByRole("heading", { level: 3 })).toHaveText([
      "a color",
      "a brief",
      "an image",
      "the gallery",
    ]);
    // 9.1: the section is a region named by its h2, and each group is named by its h3.
    const region = page.getByRole("region", { name: "Start a design from", exact: true });
    await expect(region).toHaveAttribute("data-start-from");
    await expect(region.getByRole("form", { name: "a color", exact: true })).toBeVisible();
    await expect(region.getByRole("form", { name: "a brief", exact: true })).toBeVisible();
    await expect(region.getByRole("group", { name: "an image", exact: true })).toBeVisible();
    await expect(region.getByRole("group", { name: "the gallery", exact: true })).toBeVisible();
    await expect(box.getByLabel("Seed color", { exact: true })).toHaveValue("#f66c6d");
    await expect(
      box.getByRole("button", { name: "Open the studio with this color" }),
    ).toBeVisible();
    await expect(box.getByLabel("Describe the product or mood", { exact: true })).toHaveAttribute(
      "placeholder",
      "A tea house at dusk, calm and exact",
    );
    await expect(box.getByRole("button", { name: "Take this brief to the studio" })).toBeVisible();
    await expect(box).toContainText(
      "The studio puts it in its Brief box. Nothing reads it until you press Read the brief there.",
    );
    await expect(box).toContainText(
      "The studio finds an image's colors in this browser. Nothing leaves your device until you ask a model to read it.",
    );
    await expect(box).toContainText(
      "Original design systems made by dyelot, each with its receipt.",
    );
    await expect(box.getByRole("link", { name: "Open the studio's image drop" })).toHaveAttribute(
      "href",
      "/studio#start=image",
    );
    await expect(box.getByRole("link", { name: "Browse the gallery" })).toHaveAttribute(
      "href",
      "/gallery",
    );
    await expect(box).toContainText("0 of 500 characters");
  });

  test("F-LAND6-02 the color form opens the studio on that color, locked", async ({ page }) => {
    await page.goto("/");
    await section(page).getByLabel("Seed color", { exact: true }).fill("#0e84b7");
    await expect(section(page).locator("output")).toHaveText("#0e84b7");
    const urls = recordNavigations(page);
    await section(page).getByRole("button", { name: "Open the studio with this color" }).click();
    await page.waitForURL(/\/studio/);
    await ready(page);
    expect(urls.find((url) => new URL(url).pathname !== "/")).toMatch(/\/studio#color=0e84b7$/);
    await expect(seedField(page, "Primary")).toHaveValue("#0e84b7");
    await expect(lockToggle(page, "primary")).toHaveAttribute("aria-pressed", "true");
  });

  test("F-LAND6-03 the brief form opens the studio with the text in a focused Brief box", async ({
    page,
  }) => {
    await page.goto("/");
    const box = section(page).getByLabel("Describe the product or mood", { exact: true });
    await box.fill("A tea house at dusk");
    await expect(section(page)).toContainText("19 of 500 characters");
    await section(page).getByRole("button", { name: "Take this brief to the studio" }).click();
    await page.waitForURL(/\/studio/);
    await ready(page);
    await expect(briefField(page)).toHaveValue("A tea house at dusk");
    await expect(briefField(page)).toBeFocused();
  });

  for (const text of ["   ", "1234"]) {
    test(`F-LAND6-04 a brief of ${JSON.stringify(text)} keeps the page, says why and keeps focus`, async ({
      page,
    }) => {
      await page.goto("/");
      const urls = recordNavigations(page);
      const box = section(page).getByLabel("Describe the product or mood", { exact: true });
      await box.fill(text);
      await section(page).getByRole("button", { name: "Take this brief to the studio" }).click();
      await expect(briefStatus(page)).toHaveText("Write a few words first.");
      await expect(box).toBeFocused();
      // A bounded wait: a navigation the submit started would have committed by now.
      await page.waitForTimeout(500);
      expect(new URL(page.url()).pathname).toBe("/");
      expect(urls.filter((url) => new URL(url).pathname !== "/")).toEqual([]);
    });
  }

  test("F-LAND6-05 the image link and the gallery link open their pages", async ({ page }) => {
    await page.goto("/");
    await section(page).getByRole("link", { name: "Open the studio's image drop" }).click();
    await page.waitForURL(/\/studio#start=image$/);
    await ready(page);
    await expect(imageInput(page)).toBeFocused();
    await page.goto("/");
    await section(page).getByRole("link", { name: "Browse the gallery" }).click();
    await page.waitForURL(/\/gallery$/);
  });
});
