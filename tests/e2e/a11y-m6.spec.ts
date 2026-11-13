import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";
import { MADDER } from "../unit/support/gallery";
import { overflowOf, settleAnimations, violations } from "./a11y-support";
import { chromaOffenders } from "./color-support";
import { test } from "./flavor-support";

// M6's accessibility flows of docs/specs/06-gallery.md, section 14.13 (Task 6.11b): F-A11Y6-01 to 05
// (R6-13, R6-14, R6-15, R6-21, R6-27, R6-29, I-M6-05, I-M6-06).

const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 360, height: 740 };
const VIEWPORTS = [DESKTOP, PHONE] as const;

test.use({ viewport: DESKTOP });

/** The rules Lighthouse's accessibility gatherer turns on, read from its installed source. */
function lighthouseRules(): string[] {
  const source = readFileSync(
    join(process.cwd(), "node_modules/lighthouse/core/gather/gatherers/accessibility.js"),
    "utf8",
  );
  const ids = [...source.matchAll(/'([a-z0-9-]+)':\s*\{enabled:\s*true\}/g)].map((m) => m[1] ?? "");
  return [...new Set(ids)];
}

const NAMED_RULES = [
  "heading-order",
  "landmark-one-main",
  "link-in-text-block",
  "skip-link",
  "target-size",
  "empty-heading",
  "label-content-name-mismatch",
  "identical-links-same-purpose",
];

/** Scrolls the page through, top to bottom, so every section has been painted once. */
async function scrollThrough(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const step = Math.max(window.innerHeight - 100, 200);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    window.scrollTo(0, 0);
  });
}

const PAGES = [
  "/gallery",
  "/gallery?tag=calm",
  "/gallery/kermes",
  "/gallery/turquoise",
  "/about",
  "/",
] as const;

test("F-A11Y6-01 axe, with Lighthouse's rules, finds no violation on the new pages", async ({
  page,
}) => {
  const rules = lighthouseRules();
  expect(rules.length).toBeGreaterThanOrEqual(25);
  for (const name of NAMED_RULES) expect(rules, name).toContain(name);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    for (const path of PAGES) {
      await page.goto(path);
      await scrollThrough(page);
      await settleAnimations(page);
      const found = await violations(page, rules);
      expect(
        found.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`),
        `${path} at ${viewport.width}`,
      ).toEqual([]);
    }
  }
});

test("F-A11Y6-02 the new pages do not scroll sideways at 360 px", async ({ page }) => {
  await page.setViewportSize(PHONE);
  for (const path of ["/gallery", "/gallery/kermes", "/about", "/"]) {
    await page.goto(path);
    expect(await overflowOf(page), path).toBeLessThanOrEqual(0);
  }
});

type Stop = { name: string; ring: number; width: number; height: number };

/** What the focused element is: its name, the width of its focus ring and its hit area. */
const focused = (page: Page): Promise<Stop> =>
  page.evaluate(() => {
    const element = document.activeElement as HTMLElement;
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const ring = style.outlineStyle === "none" ? 0 : Number.parseFloat(style.outlineWidth);
    const name = element.getAttribute("aria-label") ?? element.textContent ?? "";
    return { name: name.trim(), ring, width: box.width, height: box.height };
  });

/** Tabs from the focused element until a stop's name is `last`, returning every stop met. */
async function tabTo(page: Page, last: string, limit = 40): Promise<Stop[]> {
  const stops: Stop[] = [];
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press("Tab");
    const stop = await focused(page);
    stops.push(stop);
    if (stop.name === last) return stops;
  }
  throw new Error(`tabTo: no stop named ${last} within ${limit} tabs`);
}

function expectReachable(stops: readonly Stop[]): void {
  for (const stop of stops) {
    expect(stop.ring, `${stop.name}: ring`).toBeGreaterThanOrEqual(2);
    expect(stop.width, `${stop.name}: width`).toBeGreaterThanOrEqual(24);
    expect(stop.height, `${stop.name}: height`).toBeGreaterThanOrEqual(24);
  }
}

function expectInOrder(names: readonly string[], wanted: readonly string[]): void {
  let from = 0;
  for (const name of wanted) {
    const at = names.indexOf(name, from);
    expect(at, `${name} after ${from} in ${names.join(" | ")}`).toBeGreaterThanOrEqual(0);
    from = at + 1;
  }
}

test("F-A11Y6-03 the gallery and an entry page are reachable by keyboard, each stop ringed", async ({
  page,
}) => {
  await page.goto("/gallery");
  await page.getByRole("link", { name: "all", exact: true }).focus();
  const first = await focused(page);
  const tags = ["calm", "bold", "editorial", "technical", "playful", "natural"];
  const open = `Open in the studio, ${MADDER.name}`;
  const details = `Details of ${MADDER.name}`;
  const stops = [first, ...(await tabTo(page, details))];
  expectInOrder(
    stops.map((stop) => stop.name),
    ["all", ...tags, open, details],
  );
  expectReachable(stops);

  await page.goto("/gallery/kermes");
  const links = page.getByRole("link", {
    name: /^(Open in the (studio|explorer|motion lab)|Back to the gallery)$/,
  });
  for (const [page_, name] of [
    ["studio", "Open in the studio"],
    ["explore", "Open in the explorer"],
    ["motion", "Open in the motion lab"],
  ] as const) {
    await expect(links.filter({ hasText: name })).toHaveAttribute(
      "href",
      `/gallery/kermes/open/${page_}`,
    );
  }
  await page.getByRole("link", { name: "Open in the studio", exact: true }).focus();
  const entryFirst = await focused(page);
  const entryStops = [entryFirst, ...(await tabTo(page, "Back to the gallery"))];
  expectInOrder(
    entryStops.map((stop) => stop.name),
    [
      "Open in the studio",
      "Open in the explorer",
      "Open in the motion lab",
      "Copy the studio link",
      "Back to the gallery",
    ],
  );
  expectReachable(entryStops);
});

/** The levels of the headings inside `main`, with their text, in document order. */
const headingsOf = (page: Page): Promise<{ level: number; text: string }[]> =>
  page.evaluate(() =>
    [...document.querySelectorAll("main h1, main h2, main h3, main h4, main h5, main h6")].map(
      (h) => ({ level: Number(h.tagName.slice(1)), text: h.textContent?.trim() ?? "" }),
    ),
  );

test("F-A11Y6-04 each new page has one h1 and never skips a heading level", async ({ page }) => {
  for (const path of ["/gallery", "/gallery/kermes", "/about", "/"]) {
    await page.goto(path);
    await expect(page.locator("h1"), path).toHaveCount(1);
    const headings = await headingsOf(page);
    expect(headings[0]?.level, `${path}: first`).toBe(1);
    headings.forEach((heading, i) => {
      if (i === 0) return;
      const before = headings[i - 1]?.level ?? 1;
      expect(heading.level, `${path}: ${heading.text} after level ${before}`).toBeLessThanOrEqual(
        before + 1,
      );
    });
    if (path === "/") {
      const texts = headings.map((heading) => heading.text);
      const start = texts.indexOf("Start a design from");
      expect(start, "start-from h2").toBeGreaterThan(0);
      expect(headings[start]?.level).toBe(2);
      expect(texts.slice(start + 1, start + 5)).toEqual([
        "a color",
        "a brief",
        "an image",
        "the gallery",
      ]);
      expect(headings.slice(start + 1, start + 5).map((h) => h.level)).toEqual([3, 3, 3, 3]);
      const receipt = texts.lastIndexOf("The receipt");
      expect(receipt, "receipt h2 is the last heading").toBe(texts.length - 1);
      expect(headings[receipt]?.level).toBe(2);
      expect(receipt).toBeGreaterThan(start + 4);
    }
  }
});

test("F-A11Y6-05 / keeps the color rule in the start-from and receipt sections", async ({
  page,
}) => {
  await page.goto("/");
  for (const root of ["[data-start-from]", "[data-receipt]"]) {
    await expect(page.locator(root), root).toHaveCount(1);
    const { problems } = await chromaOffenders(page, { root, skip: [], madder: "*" });
    expect(problems, root).toEqual([]);
  }
});
