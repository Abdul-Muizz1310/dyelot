import { expect, test } from "@playwright/test";

// Breaks when the built app fails to start, the home route is missing or errors, or the page
// loses its single top-level heading.
test("the home page is served with exactly one top-level heading", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.locator("h1")).toHaveCount(1);
});
