import { type APIResponse, expect, type Page } from "@playwright/test";
import { SITE } from "@/lib/site/config";
import { GALLERY_DATA, KERMES } from "../unit/support/gallery";
import { test } from "./flavor-support";

// The gallery's share cards (docs/specs/06-gallery.md, section 14.3, R6-18 and R6-19). The image
// routes answer on their own: Task 6.2's pages under /gallery land later, so each flow fetches the
// image route directly. Each strip is the entry's specimen at step 500, read from the committed data.

test.use({ viewport: { width: 1280, height: 800 } });

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const MAX_BYTES = 512 * 1024;
/** The specimen's step-500 hex, third of steps 100, 300, 500, 700 and 900. */
const STEP_500 = 2;

type Run = readonly [hex: string, length: number];

const stripOf = (entry: (typeof GALLERY_DATA.entries)[number]): string[] =>
  entry.specimen.map((row) => row.hexes[STEP_500] as string);

/** Whether two `#rrggbb` colors differ by at most one per channel. */
const near = (a: string, b: string): boolean =>
  [1, 3, 5].every(
    (at) =>
      Math.abs(
        Number.parseInt(a.slice(at, at + 2), 16) - Number.parseInt(b.slice(at, at + 2), 16),
      ) <= 1,
  );

/** The PNG's body, after checking its status, its type, its signature and its `IHDR` size. */
async function png(response: APIResponse): Promise<Buffer> {
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/png");
  const body = await response.body();
  expect([...body.subarray(0, 8)]).toEqual(PNG_SIGNATURE);
  expect(body.toString("latin1", 12, 16)).toBe("IHDR");
  expect([body.readUInt32BE(16), body.readUInt32BE(20)]).toEqual([1200, 630]);
  return body;
}

/**
 * The image at `path`, fetched and drawn on a canvas by a page of the same origin (robots.txt, so
 * the canvas is not tainted): its size, its top-right pixel and, for each row, its runs of one color
 * at least `minRun` pixels long, left to right.
 */
async function drawn(page: Page, path: string, minRun: number) {
  await page.goto("/robots.txt");
  return page.evaluate(
    async ({ path, minRun }) => {
      const bitmap = await createImageBitmap(await (await fetch(path)).blob());
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      if (context === null) throw new Error("drawn: no 2d context");
      context.drawImage(bitmap, 0, 0);
      const { data, width, height } = context.getImageData(0, 0, bitmap.width, bitmap.height);
      const hex = (pixel: number) =>
        `#${[0, 1, 2].map((c) => (data[pixel * 4 + c] ?? 0).toString(16).padStart(2, "0")).join("")}`;
      const same = (a: number, b: number) =>
        [0, 1, 2].every((c) => data[a * 4 + c] === data[b * 4 + c]);
      const rows: [string, number][][] = [];
      for (let y = 0; y < height; y++) {
        const runs: [string, number][] = [];
        let start = y * width;
        for (let x = 1; x <= width; x++) {
          const pixel = y * width + x;
          if (x < width && same(pixel, start)) continue;
          if (pixel - start >= minRun) runs.push([hex(start), pixel - start]);
          start = pixel;
        }
        rows.push(runs);
      }
      return { width, height, topRight: hex(width - 1), rows };
    },
    { path, minRun },
  );
}

/** Whether `runs` holds `colors` as consecutive runs, each within one per channel. */
const holdsInOrder = (runs: readonly Run[], colors: readonly string[]): boolean =>
  runs.some((_, i) =>
    colors.every((color, j) => {
      const run = runs[i + j];
      return run !== undefined && near(run[0], color);
    }),
  );

test("F-SHARE6-01 an entry's card is a 1200 × 630 PNG of at most 512 KB", async ({ request }) => {
  const body = await png(await request.get("/gallery/madder/opengraph-image"));
  expect(body.byteLength).toBeLessThanOrEqual(MAX_BYTES);
});

test("F-SHARE6-02 kermes's card holds its strip as five runs on the dark ground", async ({
  page,
}) => {
  const strip = stripOf(KERMES);
  expect(strip).toHaveLength(5);
  const image = await drawn(page, "/gallery/kermes/opengraph-image", 150);
  expect([image.width, image.height]).toEqual([1200, 630]);
  expect(near(image.topRight, "#0a0a0a"), image.topRight).toBe(true);
  const rows = image.rows.filter(
    (runs) => runs.length === strip.length && holdsInOrder(runs, strip),
  );
  expect(rows.length).toBeGreaterThan(0);
});

test("F-SHARE6-03 the gallery's card holds the first entry's strip in its mosaic", async ({
  page,
  request,
}) => {
  await png(await request.get("/gallery/opengraph-image"));
  const [first] = GALLERY_DATA.entries;
  if (first === undefined) throw new Error("F-SHARE6-03: the gallery holds no entry");
  const strip = stripOf(first);
  const image = await drawn(page, "/gallery/opengraph-image", 24);
  expect([image.width, image.height]).toEqual([1200, 630]);
  expect(image.rows.some((runs) => holdsInOrder(runs, strip))).toBe(true);
});

test("F-SHARE6-04 an unknown or capitalized slug answers 404 and no image", async ({ request }) => {
  for (const path of ["/gallery/nope/opengraph-image", "/gallery/Madder/opengraph-image"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(404);
    expect(response.headers()["content-type"] ?? "", path).not.toMatch(/^image\/png/);
  }
});

// F-SHARE6-05 (Task 6.11a, R6-20, decision D2): a studio link keeps the site's card, since its hash
// never reaches a server, and robots leave the gallery's pages and image routes open to scrapers.

/** The site's paths whose `og:image` stays the site's card (R6-20). */
const SITE_CARD_PAGES = ["/studio", "/about", "/"] as const;
/** The start of the site card's address: `<origin>/opengraph-image`, then Next's query. */
const SITE_CARD = `${SITE.url}/opengraph-image`;
/** The gallery's paths a scraper fetches: an entry page, its card and the gallery's card. */
const GALLERY_PATHS = [
  "/gallery/",
  "/gallery/madder",
  "/gallery/madder/opengraph-image",
  "/gallery/opengraph-image",
];

test("F-SHARE6-05 /studio, /about and / keep the site's card, and robots leave /gallery/ allowed", async ({
  page,
  request,
}) => {
  for (const path of SITE_CARD_PAGES) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    const image = page.locator('head meta[property="og:image"]');
    await expect(image, path).toHaveCount(1);
    const content = (await image.getAttribute("content")) ?? "";
    expect(content.slice(0, SITE_CARD.length), path).toBe(SITE_CARD);
  }
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  const disallowed = (await robots.text())
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("Disallow:"))
    .map((line) => line.slice("Disallow:".length).trim());
  expect(disallowed).toEqual(["/api/", "/connect/callback"]);
  for (const path of GALLERY_PATHS) {
    expect(
      disallowed.filter((rule) => path.startsWith(rule)),
      path,
    ).toEqual([]);
  }
});
