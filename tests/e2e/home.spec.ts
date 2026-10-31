import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { SITE } from "../../src/lib/site/config";

const REPOSITORY = "https://github.com/Abdul-Muizz1310/dyelot";

// Breaks when the built app fails to start, the home route is missing or errors, or the page
// loses its single top-level heading or stops naming the product in it.
test("the home page is served with exactly one top-level heading that names dyelot", async ({
  page,
}) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("h1")).toContainText("dyelot");
});

// Breaks when the root layout stops taking its title from the site config, or when a page-level
// title lands in the home segment, where the layout's `%s — dyelot` template would not apply.
test("the home page's <title> is the site title from the config", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(SITE.title);
});

// Breaks when the page drops the prompt, the one-liner or the honest status line.
test("the home page shows the prompt, the one-liner and the work in progress", async ({ page }) => {
  await page.goto("/");
  const main = page.getByRole("main");
  await expect(main).toContainText("$ dyelot");
  await expect(main).toContainText("a palette becomes a design system your coding agent can build");
  await expect(main).toContainText("in progress: the color engine");
});

// Breaks when the repository link is dropped, mistyped or points at another repository, or when
// the address shown stops being the address the link goes to.
test("the home page links to the repository and shows the address it goes to", async ({ page }) => {
  await page.goto("/");
  const link = page.locator(`main a[href="${REPOSITORY}"]`);
  await expect(link).toHaveCount(1);
  await expect(link).toBeVisible();
  await expect(link).toContainText(REPOSITORY.replace("https://", ""));
});

// Breaks on any WCAG A or AA violation axe can detect in the rendered page, contrast included.
test("the home page has no accessibility violations", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

// Breaks when a long, unbreakable line (the repository address) pushes the page wider than a phone.
test("the home page fits a phone screen without sideways scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 700 });
  await page.goto("/");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

// Breaks when not-found.tsx is not wired (the default Next page is served), the status is not
// 404, the page loses its heading or its way home, or it fails the same accessibility bar.
test("an unknown address answers 404 with the terminal page and a way home", async ({ page }) => {
  const response = await page.goto("/no-such-page");
  expect(response?.status()).toBe(404);
  await expect(page.locator("h1")).toHaveCount(1);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
  await page.getByRole("link", { name: /cd ~/ }).click();
  await expect(page).toHaveURL("/");
});
