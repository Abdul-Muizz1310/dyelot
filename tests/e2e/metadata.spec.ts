import { expect, type Page, test } from "@playwright/test";
import { SITE } from "../../src/lib/site/config";

const content = (page: Page, selector: string) =>
  page.locator(`head ${selector}`).first().getAttribute("content");

test("the home page carries the site's head tags (T-FE-28)", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(SITE.title);
  expect(await content(page, 'meta[name="description"]')).toBe(SITE.description);
  expect(await content(page, 'meta[property="og:title"]')).toBe(SITE.title);
  expect(await content(page, 'meta[property="og:image"]')).toMatch(
    new RegExp(`^${SITE.url}/opengraph-image`),
  );
  expect(await content(page, 'meta[name="twitter:card"]')).toBe("summary_large_image");
  expect(await content(page, 'meta[name="twitter:image"]')).toMatch(
    new RegExp(`^${SITE.url}/opengraph-image`),
  );
  expect(await content(page, 'meta[name="theme-color"]')).toBe("#0a0a0a");
  await expect(page.locator('head link[rel="icon"][type="image/svg+xml"]')).toHaveCount(1);
  await expect(page.locator('head link[rel="apple-touch-icon"]')).toHaveCount(1);
  await expect(page.locator('head link[rel="manifest"]')).toHaveCount(1);
});

test("the home page can be indexed and names itself as canonical (T-FE-28)", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('head meta[name="robots"]')).toHaveCount(0);
  // Next writes the home route's canonical as the bare origin, with no trailing slash.
  await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute("href", SITE.url);
});

test("the home page carries the site's structured data (T-FE-31)", async ({ page }) => {
  await page.goto("/");
  const scripts = page.locator('script[type="application/ld+json"]');
  await expect(scripts).toHaveCount(1);
  const graph = JSON.parse((await scripts.textContent()) ?? "")["@graph"];
  expect(graph.map((node: { "@type": string }) => node["@type"])).toEqual([
    "WebSite",
    "WebApplication",
    "Person",
  ]);
  expect(graph[0]).toMatchObject({ url: `${SITE.url}/`, name: SITE.name });
});

test("every metadata route answers with its content type (T-FE-28)", async ({ request }) => {
  const routes: [string, RegExp][] = [
    ["/opengraph-image", /^image\/png/],
    ["/icon.svg", /^image\/svg\+xml/],
    ["/apple-icon.png", /^image\/png/],
    ["/favicon.ico", /^image\/(x-icon|vnd\.microsoft\.icon)/],
    ["/icon-512.png", /^image\/png/],
    ["/manifest.webmanifest", /^application\/manifest\+json/],
    ["/robots.txt", /^text\/plain/],
    ["/sitemap.xml", /^application\/xml/],
  ];
  for (const [path, type] of routes) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()["content-type"], path).toMatch(type);
  }
});
