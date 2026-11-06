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

// Breaks when the page drops the prompt or the one-liner, or brings back the stale status line
// (section 16: "in progress" is gone). Task 5.5b adds the hero's "Palette 1 of 6: Madder." here.
test("the home page shows the prompt and the one-liner, and no work in progress", async ({
  page,
}) => {
  await page.goto("/");
  const main = page.getByRole("main");
  await expect(main).toContainText("$ dyelot");
  await expect(main).toContainText("a palette becomes a design system your coding agent can build");
  await expect(main).not.toContainText("in progress");
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

// F-HOME-01 (docs/specs/02-studio.md, section 7.9, amended by docs/specs/05-motion-3d.md section 16).
// Breaks when the studio link is dropped, renamed or pointed elsewhere, when it leaves the start.log
// list beside the repository link and the explorer and motion lab links, or when the page gains a
// second top-level heading.
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
  // One list holds the four links, as siblings.
  await expect(
    main.locator(
      `div:has(> a[href="/studio"]):has(> a[href="/explore"]):has(> a[href="/motion"]):has(> a[href="${REPOSITORY}"])`,
    ),
  ).toHaveCount(1);
});

// F-HOME-02. Breaks when the link goes anywhere but a working studio.
test("F-HOME-02 following the studio link opens the studio", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("main").getByRole("link", { name: "open the studio", exact: true }).click();
  await expect(page).toHaveURL("/studio");
  await ready(page);
});

// F-HOME-03 (section 10, amended by docs/specs/05-motion-3d.md section 16). Breaks when the sitemap drops
// a route, reorders them, or lists one under another origin.
test("F-HOME-03 the sitemap lists the four routes in order", async ({ request }) => {
  const response = await request.get("/sitemap.xml");
  expect(response.status()).toBe(200);
  const locations = [...(await response.text()).matchAll(/<loc>([^<]*)<\/loc>/g)].map(
    (match) => match[1],
  );
  expect(locations).toEqual([
    "https://dyelot.vercel.app/",
    "https://dyelot.vercel.app/studio",
    "https://dyelot.vercel.app/explore",
    "https://dyelot.vercel.app/motion",
  ]);
  expect(SITE.url).toBe("https://dyelot.vercel.app");
});

// Breaks on any WCAG A or AA violation axe can detect in the rendered page, contrast included. It
// runs under reduced motion, so no story step is caught mid-fade (section 16, R5-33).
test("the home page has no accessibility violations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
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

// Breaks when the proxy stops sending the policy (docs/specs/04-ai.md, R4-25), when its matcher
// stops covering a response (section 12.2: a 404 under any path is HTML and needs a policy), when
// a path under /api/ stops getting R4-24's policy, which runs nothing, when the proxy stops passing
// a file through, when next.config.ts drops one of the other headers or the callback's
// no-referrer (R4-27, R4-33), or when the page policy loosens: another origin in `connect-src`, an
// inline script without the nonce, a framable page, a plugin object, a form posting elsewhere or
// `unsafe-eval` in a production build. Section 16 amends M0's test to F-SEC4-01's values.
test("every page is served with the security headers and a same-origin policy", async ({
  request,
}) => {
  const STRICT = "strict-origin-when-cross-origin";
  const API_POLICY = "default-src 'none'; frame-ancestors 'none';";
  const responses: ReadonlyArray<
    [path: string, status: number, type: RegExp, referrer: string, body?: string]
  > = [
    ["/", 200, /^text\/html/, STRICT],
    ["/studio", 200, /^text\/html/, STRICT],
    ["/connect/callback", 200, /^text\/html/, "no-referrer"],
    ["/no-such-page", 404, /^text\/html/, STRICT],
    ["/api/nope", 404, /^text\/html/, STRICT],
    ["/robots.txtx", 404, /^text\/html/, STRICT],
    ["/robots.txt", 200, /^text\/plain/, STRICT, "Disallow: /connect/callback"],
    ["/sitemap.xml", 200, /^application\/xml/, STRICT, "https://dyelot.vercel.app/studio"],
    ["/fonts/geist/geist-latin-wght-normal.woff2", 200, /^font\/woff2/, STRICT],
  ];
  for (const [path, status, type, referrer, body] of responses) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(status);
    const headers = response.headers();
    expect(headers["content-type"], path).toMatch(type);
    if (body !== undefined) expect(await response.text(), path).toContain(body);
    expect(headers["x-frame-options"], path).toBe("DENY");
    expect(headers["x-content-type-options"], path).toBe("nosniff");
    expect(headers["referrer-policy"], path).toBe(referrer);
    expect(headers["permissions-policy"], path).toBe(
      "language-model=(self), camera=(), microphone=(), geolocation=()",
    );
    if (path.startsWith("/api/")) {
      expect(headers["content-security-policy"], path).toBe(API_POLICY);
      continue;
    }
    const policy = directives(headers["content-security-policy"] ?? "");
    expect(policy["default-src"], path).toEqual(["'self'"]);
    expect(policy["base-uri"], path).toEqual(["'self'"]);
    expect(policy["connect-src"], path).toEqual([
      "'self'",
      "https://openrouter.ai",
      "https://www.remotion.pro",
    ]);
    expect(policy["img-src"], path).toEqual(["'self'", "data:", "blob:"]);
    expect(policy["worker-src"], path).toEqual(["'self'", "blob:"]);
    expect(policy["script-src"], path).toEqual([
      "'self'",
      expect.stringMatching(/^'nonce-[A-Za-z0-9+/]{48}'$/),
      "'strict-dynamic'",
    ]);
    expect(policy["frame-ancestors"], path).toEqual(["'none'"]);
    expect(policy["object-src"], path).toEqual(["'none'"]);
    expect(policy["form-action"], path).toEqual(["'self'"]);
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
