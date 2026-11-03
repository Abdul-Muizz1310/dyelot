import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { SITE } from "../../src/lib/site/config";
import { ready } from "./studio-support";

const REPOSITORY = "https://github.com/Abdul-Muizz1310/dyelot";

/** `a b; c d` becomes `{ a: ["b"], c: ["d"] }`, so a test reads one directive and ignores order. */
function directives(policy: string): Record<string, string[]> {
  return Object.fromEntries(
    policy
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name = "", ...values] = part.split(/\s+/);
        return [name, values];
      }),
  );
}

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

// F-HOME-01 (docs/specs/02-studio.md, section 7.9). Breaks when the studio link is dropped, renamed or
// pointed elsewhere, when it leaves the status list beside the repository link, or when the page gains
// a second top-level heading.
test("F-HOME-01 the home page links to the studio, beside the repository link", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("h1")).toHaveCount(1);
  const main = page.getByRole("main");
  const studio = main.getByRole("link", { name: "open the studio", exact: true });
  await expect(studio).toHaveCount(1);
  await expect(studio).toBeVisible();
  await expect(studio).toHaveAttribute("href", "/studio");
  await expect(studio).not.toHaveAttribute("target");
  // One list holds both links, as siblings.
  await expect(
    main.locator(`div:has(> a[href="/studio"]):has(> a[href="${REPOSITORY}"])`),
  ).toHaveCount(1);
});

// F-HOME-02. Breaks when the link goes anywhere but a working studio.
test("F-HOME-02 following the studio link opens the studio", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("main").getByRole("link", { name: "open the studio", exact: true }).click();
  await expect(page).toHaveURL("/studio");
  await ready(page);
});

// F-HOME-03 (section 10). Breaks when the sitemap drops the studio, or lists it under another origin.
test("F-HOME-03 the sitemap lists the studio beside the home page", async ({ request }) => {
  const response = await request.get("/sitemap.xml");
  expect(response.status()).toBe(200);
  const locations = [...(await response.text()).matchAll(/<loc>([^<]*)<\/loc>/g)].map(
    (match) => match[1],
  );
  expect(locations).toEqual(["https://dyelot.vercel.app/", "https://dyelot.vercel.app/studio"]);
  expect(SITE.url).toBe("https://dyelot.vercel.app");
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
  // The `$ ` is decoration: the link's accessible name is the command alone.
  await page.getByRole("link", { name: "cd ~", exact: true }).click();
  await expect(page).toHaveURL("/");
});

// Breaks when the nav stops marking the current page for assistive technology, or when its GitHub
// link goes anywhere but the repository.
test("the nav marks home as the current page and links to the repository", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation");
  await expect(nav.getByRole("link", { name: "home", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(nav.getByRole("link", { name: "github", exact: true })).toHaveAttribute(
    "href",
    REPOSITORY,
  );
});

// Breaks when the nav marks home as current on a page that is not home.
test("the nav marks no link as current on the 404 page", async ({ page }) => {
  await page.goto("/no-such-page");
  const home = page.getByRole("navigation").getByRole("link", { name: "home", exact: true });
  await expect(home).not.toHaveAttribute("aria-current");
});

// Breaks when the security headers leave next.config.ts, when their source stops matching a route,
// or when the policy loosens: another origin in `connect-src`, a framable page, a plugin object or
// `unsafe-eval` in a production build. A later milestone swaps `'unsafe-inline'` for a nonce.
test("every page is served with the security headers and a same-origin policy", async ({
  request,
}) => {
  for (const path of ["/", "/no-such-page"]) {
    const headers = (await request.get(path)).headers();
    expect(headers["x-frame-options"], path).toBe("DENY");
    expect(headers["x-content-type-options"], path).toBe("nosniff");
    expect(headers["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
    const policy = directives(headers["content-security-policy"] ?? "");
    expect(policy["default-src"], path).toEqual(["'self'"]);
    expect(policy["base-uri"], path).toEqual(["'self'"]);
    expect(policy["connect-src"], path).toEqual(["'self'"]);
    expect(policy["img-src"], path).toEqual(["'self'", "data:", "blob:"]);
    expect(policy["worker-src"], path).toEqual(["'self'", "blob:"]);
    expect(policy["script-src"], path).toEqual(["'self'", "'unsafe-inline'"]);
    expect(policy["frame-ancestors"], path).toEqual(["'none'"]);
    expect(policy["object-src"], path).toEqual(["'none'"]);
  }
});

// Breaks when the policy blocks something the page needs, such as an inline script, a font or a
// style. The browser reports each block as a console error, and a blocked script leaves the page
// unhydrated while the static markup still looks right.
test("the home page loads under its policy without a console error", async ({ page }) => {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(message.text());
  });
  page.on("pageerror", (error) => problems.push(error.message));
  await page.goto("/");
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  expect(problems).toEqual([]);
});
