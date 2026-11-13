import { expect } from "@playwright/test";
import { ABOUT_INTRO, ABOUT_LINKS, ABOUT_SECTIONS } from "@/features/about/copy";
import { REPOSITORY_URL } from "@/lib/links";
import { SITE } from "@/lib/site/config";
import { chromaOffenders } from "./color-support";
import { test } from "./flavor-support";

// F-ABOUT6-01 to F-ABOUT6-03 of docs/specs/06-gallery.md, section 14.4 (R6-21, I-M6-06). Every flow
// fails, through the watch of flavor-support's `test`, on a CSP violation, a console error or a
// page error.

test.use({ viewport: { width: 1280, height: 800 } });

const DESCRIPTION =
  "How dyelot works: the color math, the receipt and its checker, what AI sees and what stays in your browser, and the licenses of what it builds on.";

// Breaks when the page's head, its headings, its paragraphs or their order drift from the copy.
test("F-ABOUT6-01 /about shows its title, headings and every paragraph in order, and the nav marks it", async ({
  page,
}) => {
  await page.goto("/about");
  await expect(page).toHaveTitle("About — dyelot");
  await expect(page.locator('head meta[name="description"]')).toHaveAttribute(
    "content",
    DESCRIPTION,
  );
  await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
    "href",
    `${SITE.url}/about`,
  );
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("h1")).toHaveText("How dyelot works");
  expect(await page.locator("h2").allTextContents()).toEqual(
    ABOUT_SECTIONS.map((section) => section.heading),
  );
  const shown = await page.locator("main p").allTextContents();
  const expected = [ABOUT_INTRO, ...ABOUT_SECTIONS.flatMap((section) => section.paragraphs)].map(
    (paragraph) => paragraph.text,
  );
  // The prompt line is not a paragraph; the copy's paragraphs follow it in order.
  expect(shown.filter((text) => expected.includes(text))).toEqual(expected);
  const current = await page
    .getByRole("navigation")
    .locator('a[aria-current="page"]')
    .evaluateAll((links) => links.map((link) => link.textContent?.trim() ?? ""));
  expect(current).toEqual(["about"]);
});

// Breaks when main gains or loses a link, or a link loses its rel or moves off its paragraph.
test("F-ABOUT6-02 main holds exactly the two links, with rel noopener noreferrer, after their paragraphs", async ({
  page,
}) => {
  await page.goto("/about");
  const links = page.locator("main a");
  await expect(links).toHaveCount(2);
  expect(ABOUT_LINKS.map((link) => link.href)).toEqual([
    REPOSITORY_URL,
    "https://remotion.pro/license",
  ]);
  for (const [index, link] of ABOUT_LINKS.entries()) {
    const anchor = links.nth(index);
    await expect(anchor).toHaveText(link.label);
    await expect(anchor).toHaveAttribute("href", link.href);
    await expect(anchor).toHaveAttribute("rel", "noopener noreferrer");
    await expect(anchor).not.toHaveAttribute("target", "_blank");
  }
  // Each link follows the paragraph it belongs to, among main's text blocks.
  const order = await page
    .locator("main p, main a")
    .evaluateAll((nodes) => nodes.map((node) => node.textContent?.trim() ?? ""));
  const licenses = ABOUT_SECTIONS.find((section) => section.id === "licenses")?.paragraphs ?? [];
  const open = licenses.find((p) => p.text.startsWith("dyelot is open source"))?.text ?? "";
  const remotion = licenses.find((p) => p.text.startsWith("Remotion, which makes"))?.text ?? "";
  expect(order.indexOf("The source on GitHub")).toBe(order.indexOf(open) + 1);
  expect(order.indexOf("Remotion's license")).toBe(order.indexOf(remotion) + 1);
});

// Breaks when the page paints a color outside the house neutrals and the madder allowance.
test("F-ABOUT6-03 /about holds no color but the allowance of F-GAL6-12", async ({ page }) => {
  await page.goto("/about");
  const report = await chromaOffenders(page, { root: "body", skip: [], madder: "*" });
  expect(report.problems).toEqual([]);
});
