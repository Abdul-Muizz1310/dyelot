import { expect, type Locator, type Page } from "@playwright/test";
import { flavorBackground } from "@/flavor/flavor.mjs";
import { loseContext, NO_COMPILE, NO_WEBGL, test } from "./flavor-support";
import { inputsPanel, lotId, lotOf, ready } from "./studio-support";

// Playwright does not read the `?raw` query some engine files import: the hook makes it the text.
await import("./raw-hooks.mjs");
const { heroCards, heroSpec } = await import("@/features/landing/heroes");
const { storySteps } = await import("@/features/landing/story");

/** What the page must show, computed in Node from the first hero design (7.2). */
const [SEED, SCALE, ROLE_STEP, TYPE, RECEIPT] = storySteps(heroSpec(0));

/** The six hero cards, computed in Node from the six designs (R5-31). */
const CARDS = heroCards().cards;

// F-STORY-01 to 05, F-HOME5-02 and F-HOME5-03 of docs/specs/05-motion-3d.md, section 14.11 (R5-33,
// R5-34, 7.2). The story's text is the first hero design's (Madder, R5-31). F-HERO-01 to 11 and
// F-HERO-RF1 (Task 5.5b; R5-18, R5-19, R5-32, 6.4, 7.1) follow them. Every flow fails, through the
// watch of flavor-support's `test`, on a `securitypolicyviolation` event, a console error, a page
// error or an unhandled rejection in any document it visits (14.11).

test.use({ viewport: { width: 1280, height: 800 } });

const REPOSITORY = "https://github.com/Abdul-Muizz1310/dyelot";
const STEPS = ["seed", "scale", "roles", "type", "receipt"] as const;
const ROLES = ["background", "foreground", "primary", "primary-foreground", "border", "ring"];

/** The computed style of one story step, read in the page. */
async function stepStyle(page: Page, name: string) {
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
  if (
    SEED?.kind !== "seed" ||
    SCALE?.kind !== "scale" ||
    ROLE_STEP?.kind !== "roles" ||
    TYPE?.kind !== "type" ||
    RECEIPT?.kind !== "receipt"
  ) {
    throw new Error("storySteps did not give the five steps in order");
  }
  await page.goto("/");
  const story = page.locator("[data-story]");
  await expect(story.getByRole("heading", { level: 2 })).toHaveText("One color, five steps");
  const step = (name: string) => story.locator(`[data-story-step="${name}"]`);
  await expect(step("seed")).toContainText(`It starts with one color: ${SEED.hex}, ${SEED.oklch}.`);
  const swatches = step("scale").locator("[data-scale-step]");
  await expect(swatches).toHaveCount(11);
  expect(
    await swatches.evaluateAll((els) =>
      els.map((el) => [
        el.getAttribute("data-scale-step"),
        el.querySelectorAll("div")[2]?.textContent,
      ]),
    ),
  ).toEqual(SCALE.steps.map((item) => [String(item.step), item.contrast]));
  expect(
    await step("roles")
      .locator("[data-role]")
      .evaluateAll((els) => els.map((el) => el.textContent)),
  ).toEqual(ROLE_STEP.roles.map((role) => role.name));
  expect(ROLE_STEP.roles.map((role) => role.name)).toEqual(ROLES);
  const type = step("type");
  expect(await type.locator("dd").allTextContents()).toEqual([TYPE.display, TYPE.body]);
  expect(
    await type
      .locator("[data-space]")
      .evaluateAll((els) => els.map((el) => el.textContent?.trim())),
  ).toEqual(TYPE.space.map((px) => `${px} px`));
  await expect(step("receipt").locator("p")).toHaveText(
    `Every export carries a receipt. This design passes ${RECEIPT.passed} of ${RECEIPT.required} required contrast checks.`,
  );
  await expect(step("receipt").locator("figure")).toHaveText(
    `${RECEIPT.passed} / ${RECEIPT.required}required checks pass`,
  );
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

/** The text of each link of the nav, in DOM order: the brand tile's, then 7.3's five. */
const navLinks = (page: Page): Promise<string[]> =>
  page
    .getByRole("navigation")
    .getByRole("link")
    .evaluateAll((links) => links.map((link) => link.textContent?.trim() ?? ""));

/** The text of each nav link that carries `aria-current="page"`. */
const currentLinks = (page: Page): Promise<string[]> =>
  page
    .getByRole("navigation")
    .locator('a[aria-current="page"]')
    .evaluateAll((links) => links.map((link) => link.textContent?.trim() ?? ""));

const NAV = ["dyelot", "home", "studio", "explore", "motion", "gallery", "about", "github"];

// Breaks when the nav drops, renames or reorders a link, marks another page as current, or marks
// one on the 404 page (R5-34, 7.3).
test("F-HOME5-01 the nav lists its seven links in order and marks the current page, and none on the 404 page", async ({
  page,
  watch,
}) => {
  for (const [path, current] of [
    ["/", "home"],
    ["/explore", "explore"],
    ["/motion", "motion"],
  ] as const) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    expect(await navLinks(page), path).toEqual(NAV);
    expect(await currentLinks(page), path).toEqual([current]);
    // Each document's late loads report to the watch before the next navigation.
    await page.waitForLoadState("networkidle");
  }

  // The 404 page: Chromium reports the document's own 404 status as a console error (as F-SEC4-02
  // allows), and that line, once and from the page's own URL, is the only report it may make.
  const response = await page.goto("/no-such-page");
  expect(response?.status()).toBe(404);
  expect(await navLinks(page)).toEqual(NAV);
  expect(await currentLinks(page)).toEqual([]);
  watch.allow(
    /^Failed to load resource: the server responded with a status of 404 \(Not Found\)$/,
    1,
    response?.url() ?? "",
  );
});

// Breaks when the seven nav links need more than two rows at a phone's width, shrink under 32 px, or
// the page scrolls sideways (R6-30).
test("the nav's seven links fit two rows at 360 x 740 with no sideways scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/");
  const nav = page.getByRole("navigation");
  const tops: number[] = [];
  for (const name of ["home", "studio", "explore", "motion", "gallery", "about", "github"]) {
    const link = nav.getByRole("link", { name, exact: true });
    await expect(link).toBeVisible();
    const box = await link.boundingBox();
    expect(box?.height ?? 0, name).toBeGreaterThanOrEqual(32);
    tops.push(Math.round(box?.y ?? -1));
  }
  expect(new Set(tops).size).toBeLessThanOrEqual(2);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

// The hero (7.1): the window, its 16:9 box and canvas, the controls and the 6.4 region.
const hero = (page: Page): Locator => page.locator("[data-hero]");
const heroCanvas = (page: Page): Locator => hero(page).locator("canvas");
const heroTitle = (page: Page): Locator => hero(page).locator("header");
const controls = (page: Page): Locator => hero(page).locator("[data-hero-controls]");
const paletteLine = (page: Page): Locator => controls(page).getByText(/^Palette \d of 6: /);
const nextPalette = (page: Page): Locator =>
  controls(page).getByRole("button", { name: "Next palette", exact: true });
const pause = (page: Page): Locator =>
  hero(page).getByRole("button", { name: "Pause", exact: true });
const studioLink = (page: Page): Locator =>
  controls(page).getByRole("link", { name: "Open this palette in the studio", exact: true });
const heroStatus = (page: Page): Locator => hero(page).getByRole("status");
const restart = (page: Page): Locator =>
  hero(page).getByRole("button", { name: "Restart the animation", exact: true });

/** A card of R5-31's six, or an error naming the index. */
function card(index: number) {
  const found = CARDS[index];
  if (found === undefined) throw new Error(`no hero card ${index}`);
  return found;
}

/** `data-flavor-stops` of a card: its five hexes, lowercase, joined by commas. */
const stopsOf = (index: number): string => card(index).stops.join(",").toLowerCase();

/** 6.4's sentences, word for word. */
const NO_WEBGL2_LINE =
  "This browser cannot draw the animated background, so a still gradient shows instead.";
const CONTEXT_LOST_LINE = "The animated background stopped, so a still gradient shows instead.";
const STILL_LINE = "The background is still because this device asks for reduced motion.";

/** The canvas's computed `background-image`. */
const backgroundImage = (page: Page): Promise<string> =>
  heroCanvas(page).evaluate((canvas) => getComputedStyle(canvas).backgroundImage);

/** Redefines `document.visibilityState` as `state` and sends `visibilitychange`. */
const makeVisibility = (page: Page, state: "hidden" | "visible"): Promise<void> =>
  page.evaluate((next) => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => next });
    document.dispatchEvent(new Event("visibilitychange"));
  }, state);

/** Marks the hero's canvas element, so a later check tells a new canvas from the same one. */
const markCanvas = (page: Page): Promise<void> =>
  heroCanvas(page).evaluate((canvas) => {
    canvas.setAttribute("data-test-mark", "");
  });

test.describe("the hero", () => {
  // Breaks when the hero stops running the first card's shader, loses its title, line, Pause or
  // link, changes the controls' order, or puts text inside its 16:9 box.
  test("F-HERO-01 / runs the first card's shader in madder.flavor, with its line, Pause and link", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(hero(page)).toHaveAttribute("data-hero-index", "1");
    await expect(heroCanvas(page)).toHaveAttribute("data-flavor", "running");
    await expect(heroCanvas(page)).toHaveAttribute("data-flavor-stops", stopsOf(0));
    await expect(heroCanvas(page)).toHaveAttribute("aria-hidden", "true");
    await expect(heroTitle(page)).toHaveText("madder.flavor");
    await expect(paletteLine(page)).toHaveText("Palette 1 of 6: Madder.");
    await expect(pause(page)).toHaveAttribute("aria-pressed", "false");
    await expect(studioLink(page)).toHaveAttribute("href", card(0).href);
    await expect(controls(page).locator(":scope > *")).toHaveText([
      "Palette 1 of 6: Madder.",
      "Next palette",
      "Pause",
      "Open this palette in the studio",
    ]);
    await expect(heroStatus(page)).toHaveText("");
    // The 16:9 box holds the canvas alone: no text node sits on the shader (I-M5-10).
    const frame = heroCanvas(page).locator("..");
    expect(
      await frame.evaluate((box) => {
        const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
        return { nodes: box.childNodes.length, text: walker.nextNode() === null };
      }),
    ).toEqual({ nodes: 1, text: true });
    const box = await frame.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.abs((box?.width ?? 0) / (box?.height ?? 1) - 16 / 9)).toBeLessThan(0.02);
  });

  // Breaks when "Next palette" stops walking the six cards in order, stops wrapping, misses one of
  // the title, the line, the link or the stops, or remounts the canvas.
  test("F-HERO-02 Next palette walks the six cards and wraps, on the same running canvas", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(heroCanvas(page)).toHaveAttribute("data-flavor", "running");
    await markCanvas(page);
    const lines = [
      "Palette 2 of 6: Weld.",
      "Palette 3 of 6: Verdigris.",
      "Palette 4 of 6: Woad.",
      "Palette 5 of 6: Logwood.",
      "Palette 6 of 6: Cochineal.",
      "Palette 1 of 6: Madder.",
    ];
    for (const [press, line] of lines.entries()) {
      const index = (press + 1) % 6;
      await nextPalette(page).click();
      await expect(paletteLine(page)).toHaveText(line);
      await expect(hero(page)).toHaveAttribute("data-hero-index", String(index + 1));
      await expect(heroCanvas(page)).toHaveAttribute("data-flavor-stops", stopsOf(index));
      await expect(heroTitle(page)).toHaveText(`${card(index).name.toLowerCase()}.flavor`);
      await expect(studioLink(page)).toHaveAttribute("href", card(index).href);
      await expect(heroCanvas(page)).toHaveAttribute("data-flavor", "running");
    }
    await expect(heroCanvas(page)).toHaveAttribute("data-test-mark", "");
  });

  // Breaks when Pause stops holding the loop, "Next palette" drops the pause, or Pause stops
  // resuming it.
  test("F-HERO-03 Pause holds the loop across Next palette, and Pause again resumes it", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(heroCanvas(page)).toHaveAttribute("data-flavor", "running");
    await pause(page).click();
    await expect(pause(page)).toHaveAttribute("aria-pressed", "true");
    await expect(heroCanvas(page)).toHaveAttribute("data-flavor", "paused");
    await nextPalette(page).click();
    await expect(heroCanvas(page)).toHaveAttribute("data-flavor-stops", stopsOf(1));
    await expect(heroCanvas(page)).toHaveAttribute("data-flavor", "paused");
    await expect(pause(page)).toHaveAttribute("aria-pressed", "true");
    await pause(page).click();
    await expect(pause(page)).toHaveAttribute("aria-pressed", "false");
    await expect(heroCanvas(page)).toHaveAttribute("data-flavor", "running");
  });

  // Breaks when the studio link stops following the current card, or the studio does not open the
  // design it names.
  test("F-HERO-04 after Next palette the studio link opens Weld in the studio", async ({
    page,
  }) => {
    const weld = heroSpec(1);
    await page.goto("/");
    await nextPalette(page).click();
    await expect(studioLink(page)).toHaveAttribute("href", card(1).href);
    await studioLink(page).click();
    await page.waitForURL(/\/studio#s=/);
    await ready(page);
    await expect(inputsPanel(page).getByRole("textbox", { name: "Name", exact: true })).toHaveValue(
      "Weld",
    );
    await expect(lotId(page)).toHaveText(lotOf(weld));
  });

  // Breaks when a browser with no WebGL loses the still gradient, its sentence, or "Next palette".
  test("F-HERO-05 with no WebGL the hero shows the still gradient, its sentence and no Pause", async ({
    page,
  }) => {
    await NO_WEBGL(page);
    await page.goto("/");
    await expect(heroCanvas(page)).toHaveAttribute("data-flavor", "fallback");
    await expect(heroCanvas(page)).toHaveAttribute("data-flavor-reason", "no-webgl2");
    await expect(heroStatus(page)).toHaveText(NO_WEBGL2_LINE);
    await expect(pause(page)).toHaveCount(0);
    const before = await backgroundImage(page);
    expect(before).toContain("linear-gradient");
    expect(before).toContain("data:image/svg+xml");
    await nextPalette(page).click();
    await expect(heroCanvas(page)).toHaveAttribute("data-flavor-stops", stopsOf(1));
    await expect.poll(() => backgroundImage(page)).not.toBe(before);
    expect(await backgroundImage(page)).toContain("linear-gradient");
    await expect(heroStatus(page)).toHaveText(NO_WEBGL2_LINE);
  });

  // Breaks when a lost context leaves the hero without its sentence or "Restart the animation", when
  // a restored context alone restarts it, or when "Restart the animation" does not mount a new canvas.
  test("F-HERO-06 a lost context shows its sentence and Restart the animation, which mounts a new canvas", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(heroCanvas(page)).toHaveAttribute("data-flavor", "running");
    await markCanvas(page);
    const lost = await loseContext(page, "[data-hero] canvas");
    await expect(heroCanvas(page)).toHaveAttribute("data-flavor", "fallback");
    await expect(heroCanvas(page)).toHaveAttribute("data-flavor-reason", "context-lost");
    await expect(heroStatus(page)).toHaveText(CONTEXT_LOST_LINE);
    await expect(restart(page)).toBeVisible();
    await expect(pause(page)).toHaveCount(0);

    // A restored context alone restarts nothing: wait for its event, then read the state.
    await heroCanvas(page).evaluate((canvas) => {
      (window as unknown as { __restored: Promise<void> }).__restored = new Promise((resolve) =>
        canvas.addEventListener("webglcontextrestored", () => resolve(), { once: true }),
      );
    });
    await lost.restore();
    await page.evaluate(() => (window as unknown as { __restored: Promise<void> }).__restored);
    await expect(heroCanvas(page)).toHaveAttribute("data-flavor", "fallback");
    await expect(restart(page)).toBeVisible();

    await restart(page).click();
    await expect(heroCanvas(page)).toHaveAttribute("data-flavor", "running");
    await expect(heroCanvas(page)).not.toHaveAttribute("data-test-mark");
    await expect(heroStatus(page)).toHaveText("");
    await expect(restart(page)).toHaveCount(0);
    await expect(pause(page)).toBeFocused();
  });

  // Breaks when reduced motion stops holding the hero still, loses its sentence, keeps Pause, or
  // does not follow the setting back to running.
  test("F-HERO-07 under reduced motion the hero is still with its sentence, and runs once it is off", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(heroCanvas(page)).toHaveAttribute("data-flavor", "still");
    await expect(heroStatus(page)).toHaveText(STILL_LINE);
    await expect(pause(page)).toHaveCount(0);
    await nextPalette(page).click();
    await expect(heroCanvas(page)).toHaveAttribute("data-flavor-stops", stopsOf(1));
    await expect(heroCanvas(page)).toHaveAttribute("data-flavor", "still");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(heroCanvas(page)).toHaveAttribute("data-flavor", "running");
    await expect(pause(page)).toBeVisible();
    await expect(heroStatus(page)).toHaveText("");
  });

  // Breaks when the loop keeps running off-screen or on a hidden page, or does not come back.
  test("F-HERO-08 the hero pauses off-screen and on a hidden page, and runs again on return", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(heroCanvas(page)).toHaveAttribute("data-flavor", "running");
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(heroCanvas(page)).toHaveAttribute("data-flavor", "offscreen");
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(heroCanvas(page)).toHaveAttribute("data-flavor", "running");
    await makeVisibility(page, "hidden");
    await expect(heroCanvas(page)).toHaveAttribute("data-flavor", "hidden");
    await makeVisibility(page, "visible");
    await expect(heroCanvas(page)).toHaveAttribute("data-flavor", "running");
  });

  // Breaks when the still frame depends on the load (the seed, the stops or the phase), or when
  // "Next palette" does not redraw it.
  test("F-HERO-09 two loads under reduced motion draw the same still, and Next palette another", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(heroCanvas(page)).toHaveAttribute("data-flavor", "still");
    const first = await heroCanvas(page).screenshot();
    await page.reload();
    await expect(heroCanvas(page)).toHaveAttribute("data-flavor", "still");
    const second = await heroCanvas(page).screenshot();
    expect(second.equals(first)).toBe(true);
    await nextPalette(page).click();
    await expect(heroCanvas(page)).toHaveAttribute("data-flavor-stops", stopsOf(1));
    const third = await heroCanvas(page).screenshot();
    expect(third.equals(first)).toBe(false);
  });

  // Breaks when a shader that fails to compile shows anything but the no-WebGL2 fallback, or logs
  // an error (the auto fixture fails on any console error).
  test("F-HERO-10 a shader that fails to compile gives the no-webgl2 fallback with no console error", async ({
    page,
  }) => {
    await NO_COMPILE(page);
    await page.goto("/");
    await expect(heroCanvas(page)).toHaveAttribute("data-flavor", "fallback");
    await expect(heroCanvas(page)).toHaveAttribute("data-flavor-reason", "no-webgl2");
    await expect(heroStatus(page)).toHaveText(NO_WEBGL2_LINE);
    await expect(pause(page)).toHaveCount(0);
  });

  // Breaks when the server's HTML stops carrying the first card's still gradient or its line.
  test("F-HERO-11 with JavaScript off the canvas carries the first card's gradient and the line", async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/");
    const expected = flavorBackground(card(0).stops);
    const style = (await heroCanvas(page).getAttribute("style")) ?? "";
    expect(style).toContain(expected.backgroundImage);
    expect(style).toContain(expected.backgroundColor);
    expect(style).toContain("linear-gradient");
    expect(style).toContain("data:image/svg+xml");
    await expect(paletteLine(page)).toHaveText("Palette 1 of 6: Madder.");
    await context.close();
  });

  // Breaks when reduced motion switched on during a cross-fade leaves it unfinished or on the old
  // card, or switching it off loses the new card.
  test("F-HERO-RF1 reduced motion during a cross-fade ends still at the new card, then runs it", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(heroCanvas(page)).toHaveAttribute("data-flavor", "running");
    await nextPalette(page).click();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(heroCanvas(page)).toHaveAttribute("data-flavor", "still");
    await expect(heroCanvas(page)).toHaveAttribute("data-flavor-stops", stopsOf(1));
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(heroCanvas(page)).toHaveAttribute("data-flavor", "running");
    await expect(heroCanvas(page)).toHaveAttribute("data-flavor-stops", stopsOf(1));
  });
});
