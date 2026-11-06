import { expect, test } from "@playwright/test";

// F-STORY-01 to 05, F-HOME5-02 and F-HOME5-03 of docs/specs/05-motion-3d.md, section 14.11 (R5-33,
// R5-34, 7.2). The story's text is the first hero design's (Madder, R5-31).

const REPOSITORY = "https://github.com/Abdul-Muizz1310/dyelot";
const STEPS = ["seed", "scale", "roles", "type", "receipt"] as const;
const ROLES = ["background", "foreground", "primary", "primary-foreground", "border", "ring"];

/** The computed style of one story step, read in the page. */
async function stepStyle(page: import("@playwright/test").Page, name: string) {
  return page.locator(`[data-story-step="${name}"]`).evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      animationName: style.animationName,
      animationTimeline: style.getPropertyValue("animation-timeline"),
      opacity: style.opacity,
      translate: style.translate,
    };
  });
}

// Breaks when a story step stops animating on view(), or stops reaching its final state wholly in view.
test("F-STORY-01 each step runs story-rise on view() and is opaque once scrolled to the center", async ({
  page,
}) => {
  await page.goto("/");
  expect(await page.evaluate(() => CSS.supports("animation-timeline: view()"))).toBe(true);
  for (const name of STEPS) {
    const style = await stepStyle(page, name);
    expect(style.animationName, name).toBe("story-rise");
    expect(style.animationTimeline, name).toBe("view()");
  }
  for (const name of STEPS) {
    await page.locator(`[data-story-step="${name}"]`).evaluate((el) => {
      el.scrollIntoView({ block: "center" });
    });
    await expect
      .poll(async () => (await stepStyle(page, name)).opacity, { message: name })
      .toBe("1");
  }
});

// Breaks when reduced motion still moves a step, or hides one before any scroll.
test("F-STORY-02 under reduced motion every step shows its final state with no animation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  for (const name of STEPS) {
    const style = await stepStyle(page, name);
    expect(style, name).toMatchObject({ animationName: "none", opacity: "1", translate: "none" });
  }
});

// Breaks when the story's text stops matching the first hero design.
test("F-STORY-03 the story's text is 7.2's table for the first hero design", async ({ page }) => {
  await page.goto("/");
  const story = page.locator("[data-story]");
  await expect(story.getByRole("heading", { level: 2 })).toHaveText("One color, five steps");
  const step = (name: string) => story.locator(`[data-story-step="${name}"]`);
  await expect(step("seed")).toContainText(
    "It starts with one color: #f66c6d, oklch(0.7000 0.1700 22.00).",
  );
  const swatches = step("scale").locator("[data-scale-step]");
  await expect(swatches).toHaveCount(11);
  for (const li of await swatches.all()) {
    // The step number, then the contrast to 2 decimals.
    await expect(li.locator("div").nth(2)).toHaveText(/^\d+\.\d\d$/);
  }
  expect(
    await swatches.evaluateAll((els) => els.map((el) => el.getAttribute("data-scale-step"))),
  ).toEqual(["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"]);
  expect(
    await step("roles")
      .locator("[data-role]")
      .evaluateAll((els) => els.map((el) => el.textContent)),
  ).toEqual(ROLES);
  const type = step("type");
  await expect(type.locator("dd")).toHaveCount(2);
  const spaces = await type
    .locator("[data-space]")
    .evaluateAll((els) => els.map((el) => el.textContent?.trim()));
  expect(spaces).toEqual(["0 px", "4 px", "8 px", "12 px", "16 px", "24 px", "32 px", "48 px"]);
  await expect(step("receipt")).toContainText(
    /^A receipt\s*Every export carries a receipt\. This design passes (\d+) of (\d+) required contrast checks\./,
  );
  const figure = step("receipt").locator("figure");
  await expect(figure).toContainText(/^\d+ \/ \d+required checks pass$/);
});

// Breaks when a color reaches the story outside a framed specimen (I-M5-01).
test("F-STORY-04 every inline color sits inside a specimen figure", async ({ page }) => {
  await page.goto("/");
  const stray = await page.locator("[data-story]").evaluate((root) =>
    [...root.querySelectorAll<HTMLElement>("[style]")]
      .filter((el) => /color|background|border/i.test(el.getAttribute("style") ?? ""))
      .filter((el) => el.closest("figure[data-specimen]") === null)
      .map((el) => el.outerHTML.slice(0, 80)),
  );
  expect(stray).toEqual([]);
});

// Breaks when the story needs a script to show its steps.
test("F-STORY-05 with JavaScript off the five steps show their text and reach opacity 1", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/");
  const steps = page.locator("[data-story-step]");
  await expect(steps).toHaveCount(5);
  for (const name of STEPS) {
    const step = page.locator(`[data-story-step="${name}"]`);
    await expect(step.locator("h3")).toBeVisible();
    await expect(step.locator("p")).not.toBeEmpty();
    // Playwright's own scroll and style reads run without page script.
    await step.scrollIntoViewIfNeeded();
    await expect(step).toHaveCSS("opacity", "1");
  }
  await context.close();
});

// Breaks when the page gains a second h1, loses a start.log link, or keeps the stale status line.
test("F-HOME5-02 / has one h1 and start.log holds its four links as children of one div", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("h1")).toHaveCount(1);
  const main = page.getByRole("main");
  for (const name of ["open the studio", "open the explorer", "open the motion lab"]) {
    await expect(main.getByRole("link", { name, exact: true })).toHaveCount(1);
  }
  await expect(
    main.locator(
      `div:has(> a[href="/studio"]):has(> a[href="/explore"]):has(> a[href="/motion"]):has(> a[href="${REPOSITORY}"])`,
    ),
  ).toHaveCount(1);
  await expect(main).not.toContainText("in progress: the export bundle");
});

// Breaks when the sitemap drops, reorders or re-homes a route.
test("F-HOME5-03 /sitemap.xml lists the four routes in order", async ({ request }) => {
  const response = await request.get("/sitemap.xml");
  expect(response.status()).toBe(200);
  const locations = [...(await response.text()).matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
  expect(locations).toEqual([
    "https://dyelot.vercel.app/",
    "https://dyelot.vercel.app/studio",
    "https://dyelot.vercel.app/explore",
    "https://dyelot.vercel.app/motion",
  ]);
});

// Breaks when the five nav links stop fitting one row at a phone's width, or the page scrolls sideways.
test("the nav's five links fit one row at 360 x 740 with no sideways scroll", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/");
  const nav = page.getByRole("navigation");
  const tops: number[] = [];
  for (const name of ["home", "studio", "explore", "motion", "github"]) {
    const link = nav.getByRole("link", { name, exact: true });
    await expect(link).toBeVisible();
    tops.push(Math.round((await link.boundingBox())?.y ?? -1));
  }
  expect(new Set(tops).size).toBe(1);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
