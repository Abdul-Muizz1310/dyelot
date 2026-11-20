import { expect, type Locator, type Page, type Response } from "@playwright/test";
import { summaryLines } from "@/features/export/files";
import type { GalleryEntry } from "@/features/gallery/data";
import { GALLERY_TAGS } from "@/features/gallery/tags";
import { SITE } from "@/lib/site/config";
import { DEFS, GALLERY_DATA, KERMES, MADDER, TURQUOISE } from "../unit/support/gallery";
import { chromaOffenders } from "./color-support";
import { download, downloadButton, entriesOf, openReady } from "./export-support";
import { CLIPBOARD_DENY, test } from "./flavor-support";
import { inputsPanel, lotId, ready, rgbToHex } from "./studio-support";

// The gallery pages and the open route: F-GAL6-01 to F-GAL6-15 of docs/specs/06-gallery.md, section
// 14.2 (R6-13 to R6-17, sections 7.1 to 7.4). What a page must show is read from the committed
// `gallery.json` on disk (tests/unit/support/gallery.ts), never from the app's `data.ts`. Every flow
// fails, through the watch of flavor-support's `test`, on a console error, a page error, an unhandled
// rejection or a policy violation it does not allow by name.

test.use({ viewport: { width: 1280, height: 800 } });

const ENTRIES = GALLERY_DATA.entries;
const HERO_COUNT = ENTRIES.filter((entry) => entry.source === "hero").length;
const BRIEF_COUNT = ENTRIES.filter((entry) => entry.source === "brief").length;

/** 7.1's intro, with the counts of hero and brief entries. */
const INTRO = `Original design systems made by dyelot: ${HERO_COUNT} from one seed color each, and ${BRIEF_COUNT} from a one-sentence brief that the studio's word list read, with no model. Each passes every required check of its receipt. Open one in the studio and make it yours.`;
const GALLERY_DESCRIPTION =
  "24 original design systems made by dyelot, each with a receipt of its contrast checks. Open any of them in the studio, the explorer or the motion lab.";
const UNKNOWN = "That mood is not one of the six, so every design shows.";
const ALL = "All 24 designs.";
const NOT_FOUND_LINE =
  /^Failed to load resource: the server responded with a status of 404 \(Not Found\)$/;
const PAGES = ["studio", "explore", "motion"] as const;

/** The site's nav: the one `nav` that links to the repository. */
const siteNav = (page: Page): Locator =>
  page.getByRole("navigation").filter({ has: page.getByRole("link", { name: "github" }) });
const filterNav = (page: Page): Locator =>
  page.getByRole("navigation", { name: "Filter by mood", exact: true });
/** The text of each link under `scope` that carries `aria-current="page"`. */
const currentLinks = (scope: Locator): Promise<string[]> =>
  scope
    .locator('a[aria-current="page"]')
    .evaluateAll((links) => links.map((link) => link.textContent?.trim() ?? ""));
const cards = (page: Page): Locator => page.locator("[data-gallery-card]");
const cardOf = (page: Page, slug: string): Locator =>
  page.locator(`[data-gallery-card][data-slug="${slug}"]`);
const cardSlugs = (page: Page): Promise<(string | null)[]> =>
  cards(page).evaluateAll((all) => all.map((card) => card.getAttribute("data-slug")));
/** The computed background colors of the swatches under `scope`, as hexes, in document order. */
const swatchHexes = async (scope: Locator): Promise<string[]> =>
  (
    await scope
      .locator("[data-swatch]")
      .evaluateAll((all) => all.map((swatch) => getComputedStyle(swatch).backgroundColor))
  ).map(rgbToHex);
/** Each `dt` of a `dl` with its `dd`, in order. */
const factsOf = (list: Locator): Promise<[string, string][]> =>
  list.evaluate((dl) =>
    [...dl.querySelectorAll("dt")].map(
      (dt) =>
        [dt.textContent?.trim() ?? "", dt.nextElementSibling?.textContent?.trim() ?? ""] as [
          string,
          string,
        ],
    ),
  );
const copyBox = (page: Page): Locator => page.locator("[data-copy-link]");
const studioLinkOf = (entry: GalleryEntry): string => `${SITE.url}/studio#s=${entry.link}`;
/** The text the page shows: its rendered text, which leaves out the RSC payload's scripts. */
const shownText = (page: Page): Promise<string> =>
  // biome-ignore lint/performance/useDomNodeTextContent: the case asks what shows on screen, which only innerText reads.
  page.locator("body").innerText();
/** A text's non-empty lines, trimmed: the paragraph breaks of `innerText` vary with the markup. */
const lines = (text: string): string[] =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
const metaContent = (page: Page, selector: string): Promise<string | null> =>
  page.locator(selector).first().getAttribute("content");

/** Waits until the page sits at `/<path>` with the entry's link in its hash. */
async function expectAt(page: Page, path: string, entry: GalleryEntry): Promise<void> {
  await expect
    .poll(() => {
      const url = new URL(page.url());
      return `${url.pathname}${url.hash}`;
    })
    .toBe(`/${path}#s=${entry.link}`);
}

test.describe("7.1 /gallery", () => {
  test("F-GAL6-01 the heading, the intro, the filter with all current, the count and the 24 cards in order", async ({
    page,
  }) => {
    const response = await page.goto("/gallery");
    expect(response?.status()).toBe(200);
    expect([HERO_COUNT, BRIEF_COUNT]).toEqual([6, 18]);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(["The gallery"]);
    await expect(page.getByText(INTRO, { exact: true })).toBeVisible();
    await expect(filterNav(page).getByRole("link")).toHaveText(["all", ...GALLERY_TAGS]);
    expect(await currentLinks(filterNav(page))).toEqual(["all"]);
    await expect(page.getByText(ALL, { exact: true })).toBeVisible();
    await expect(page.getByText(UNKNOWN, { exact: true })).toHaveCount(0);
    expect(await cardSlugs(page)).toEqual(DEFS.map((def) => def.slug));
    expect(await currentLinks(siteNav(page))).toEqual(["gallery"]);
  });

  test("F-GAL6-02 the cards of madder and kermes: name, line, tags, specimen, facts and named links", async ({
    page,
  }) => {
    await page.goto("/gallery");
    for (const [entry, mood, type] of [
      [MADDER, "mood: bold", "Host Grotesk"],
      [KERMES, "mood: calm, editorial", "Schibsted Grotesk and Source Serif 4"],
    ] as const) {
      const card = cardOf(page, entry.slug);
      await expect(card).toHaveRole("article");
      await expect(card).toHaveAccessibleName(entry.name);
      await expect(card.getByRole("heading", { level: 2 })).toHaveText(entry.name);
      await expect(card.getByText(entry.line, { exact: true })).toBeVisible();
      await expect(card.locator("[data-tags]")).toHaveText(mood);
      const specimen = card.locator("figure[data-specimen]");
      await expect(specimen.locator("[data-swatch]")).toHaveCount(25);
      expect(await swatchHexes(specimen)).toEqual(entry.specimen.flatMap((row) => row.hexes));
      expect(await factsOf(card.locator("dl"))).toEqual([
        ["Type", type],
        ["Preset", entry.slug === "madder" ? "Custom" : "Editorial"],
        ["Receipt", "78 of 78 required contrast checks pass"],
        ["Lot", entry.lot],
      ]);
      await expect(
        card.getByRole("link", { name: `Open in the studio, ${entry.name}`, exact: true }),
      ).toHaveAttribute("href", `/gallery/${entry.slug}/open/studio`);
      await expect(
        card.getByRole("link", { name: `Details of ${entry.name}`, exact: true }),
      ).toHaveAttribute("href", `/gallery/${entry.slug}`);
    }
  });

  test("F-GAL6-03 ?tag=calm shows its count and the seven calm cards in order, calm current", async ({
    page,
  }) => {
    const calm = ENTRIES.filter((entry) => entry.tags.includes("calm")).map((entry) => entry.slug);
    expect(calm).toHaveLength(7);
    await page.goto("/gallery?tag=calm");
    await expect(page.getByText("7 of 24 designs are tagged calm.", { exact: true })).toBeVisible();
    expect(await cardSlugs(page)).toEqual(calm);
    expect(await currentLinks(filterNav(page))).toEqual(["calm"]);
    await expect(page.getByText(UNKNOWN, { exact: true })).toHaveCount(0);
  });

  test("F-GAL6-04 an unknown, empty, repeated or markup tag shows every design and never echoes the query", async ({
    page,
  }) => {
    const dialogs: string[] = [];
    page.on("dialog", async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.dismiss();
    });
    // The gallery's own text holds "loud" (Gamboge's line) and "calm" and "bold" (the filter), so the
    // page must show exactly /gallery's text with the one sentence added: no query value beyond it
    // (R6-13's amendment).
    await page.goto("/gallery");
    const gallery = await shownText(page);
    for (const [query, echoes] of [
      ["?tag=loud", []],
      ["?tag=", []],
      ["?tag=calm&tag=bold", ["calm,bold", "calm, bold"]],
      ["?tag=%3Cscript%3Ealert(1)%3C%2Fscript%3E", ["<script>", "alert(1)"]],
    ] as const) {
      const response = await page.goto(`/gallery${query}`);
      expect(response?.status(), query).toBe(200);
      await expect(page.getByText(UNKNOWN, { exact: true }), query).toBeVisible();
      await expect(page.getByText(ALL, { exact: true }), query).toBeVisible();
      await expect(cards(page), query).toHaveCount(24);
      expect(await currentLinks(filterNav(page)), query).toEqual(["all"]);
      const text = await shownText(page);
      expect(lines(text.replace(UNKNOWN, "")), query).toEqual(lines(gallery));
      for (const echo of echoes) expect(text, `${query} echoes ${echo}`).not.toContain(echo);
    }
    expect(dialogs).toEqual([]);
  });
});

test.describe("7.4 /gallery/[slug]", () => {
  test("F-GAL6-05 kermes: the heading, how it was made, the facts, the receipt, scales, roles, type and links", async ({
    page,
  }) => {
    const response = await page.goto("/gallery/kermes");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(["Kermes"]);
    await expect(page.getByText(KERMES.line, { exact: true })).toBeVisible();
    await expect(
      page.getByText(
        "Made from this brief by the studio's word list, with no model. It matched: slow, longform, magazine, serif, warm, paper, burgundy.",
        { exact: true },
      ),
    ).toBeVisible();
    expect(await factsOf(page.locator("main dl").first())).toEqual([
      ["Mood", "calm, editorial"],
      ["Preset", "Editorial"],
      ["Type", "Schibsted Grotesk, Source Serif 4 and Fragment Mono"],
      ["Lot", KERMES.lot],
    ]);

    await expect(page.getByRole("heading", { level: 2 })).toHaveText([
      "Receipt",
      "Scales",
      "Roles",
      "Type",
      "Open it",
    ]);
    await expect(
      page.getByRole("list", { name: "Receipt", exact: true }).getByRole("listitem"),
    ).toHaveText(summaryLines(KERMES.summary));

    for (const mode of ["light", "dark"] as const) {
      const label = mode === "light" ? "Light mode" : "Dark mode";
      const scales = page.getByRole("figure", {
        name: `${label}: eight palettes of eleven steps.`,
        exact: true,
      });
      await expect(scales).toHaveAttribute("data-specimen", "");
      await expect(scales.locator("[data-swatch]")).toHaveCount(88);
      const palettes = Object.keys(KERMES.scales[mode]);
      await expect(scales.locator("[data-palette]")).toHaveText(palettes);
      expect(await swatchHexes(scales)).toEqual(Object.values(KERMES.scales[mode]).flat());

      const roles = page.getByRole("figure", { name: label, exact: true });
      await expect(roles).toHaveAttribute("data-specimen", "");
      await expect(roles.getByRole("listitem")).toHaveCount(6);
      for (const role of KERMES.roles[mode]) {
        const row = roles.locator(`[data-role="${role.name}"]`);
        await expect(row).toHaveText(new RegExp(`^${role.name}\\s*${role.hex}$`));
        expect(await swatchHexes(row)).toEqual([role.hex]);
      }
    }

    const table = page.getByRole("table", { name: "The type ladder", exact: true });
    await expect(table.getByRole("columnheader")).toHaveText([
      "Step",
      "Size",
      "Line height",
      "Family",
    ]);
    const rows = table.locator("tbody tr");
    await expect(rows).toHaveCount(10);
    for (const [index, step] of KERMES.type.entries()) {
      await expect(rows.nth(index).getByRole("cell")).toHaveText([
        step.name,
        `${step.sizePx} px`,
        `${step.lineHeightPx} px`,
        KERMES.families[step.family],
      ]);
    }

    for (const [name, target] of [
      ["Open in the studio", "studio"],
      ["Open in the explorer", "explore"],
      ["Open in the motion lab", "motion"],
    ] as const) {
      await expect(page.getByRole("link", { name, exact: true })).toHaveAttribute(
        "href",
        `/gallery/kermes/open/${target}`,
      );
    }
    await expect(
      page.getByRole("button", { name: "Copy the studio link", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Back to the gallery", exact: true }),
    ).toHaveAttribute("href", "/gallery");
    expect(await currentLinks(siteNav(page))).toEqual(["gallery"]);

    await page.goto("/gallery/madder");
    await expect(
      page.getByText("Made from one seed color with the studio's controls.", { exact: true }),
    ).toBeVisible();
    expect(await factsOf(page.locator("main dl").first())).toEqual([
      ["Mood", "bold"],
      ["Preset", "Custom"],
      ["Type", "Host Grotesk and Fragment Mono"],
      ["Lot", MADDER.lot],
    ]);
  });

  test("F-GAL6-06 Open in the studio, Kermes opens it loaded, passing, as Editorial, and its export downloads", async ({
    page,
  }) => {
    await page.goto("/gallery");
    await page.getByRole("link", { name: "Open in the studio, Kermes", exact: true }).click();
    await expectAt(page, "studio", KERMES);
    await ready(page);
    await expect(inputsPanel(page).getByRole("textbox", { name: "Name", exact: true })).toHaveValue(
      "Kermes",
    );
    await expect(lotId(page)).toHaveText(KERMES.lot);
    const preset = inputsPanel(page).getByRole("combobox", { name: "Preset", exact: true });
    await expect(preset).toHaveValue("editorial");
    await expect(preset.locator("option:checked")).toHaveText("Editorial");
    const receipt = page
      .locator("aside#studio-inspector")
      .getByRole("region", { name: "Receipt", exact: true });
    await expect(receipt.getByRole("listitem")).toHaveText(summaryLines(KERMES.summary));
    await expect(receipt.locator("[data-receipt-blocked]")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Rebuild from the parameters", exact: true }),
    ).toHaveCount(0);
    await openReady(page);
    await expect(downloadButton(page)).toBeEnabled();
    const { bytes } = await download(page);
    const file = entriesOf(bytes).find((entry) => entry.path === "receipt.json");
    expect(file, "receipt.json").toBeDefined();
    const parsed = JSON.parse(new TextDecoder().decode(file?.bytes)) as {
      design: { createdWith: string };
      summary: { pass: boolean };
    };
    expect(parsed.design.createdWith).toBe("lexicon");
    expect(parsed.summary.pass).toBe(true);
  });

  test("F-GAL6-07 an unknown, capitalized or padded slug answers 404 with the terminal page and no current link", async ({
    page,
    watch,
  }) => {
    for (const path of ["/gallery/nope", "/gallery/Madder", "/gallery/madder%20"]) {
      const response = (await page.goto(path)) as Response;
      expect(response.status(), path).toBe(404);
      await expect(page.getByRole("heading", { level: 1 }), path).toHaveText(["404: no such page"]);
      expect(await currentLinks(siteNav(page)), path).toEqual([]);
      await expect(cards(page), path).toHaveCount(0);
      // Chromium reports each document's own 404 status as a console error, once, from its URL.
      watch.allow(NOT_FOUND_LINE, 1, response.url());
      await page.waitForLoadState("networkidle");
    }
  });

  test("F-GAL6-08 Copy the studio link puts the absolute studio link on the clipboard and says so", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/gallery/kermes");
    await page.getByRole("button", { name: "Copy the studio link", exact: true }).click();
    await expect(copyBox(page).getByRole("status")).toHaveText("Copied the studio link.");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(studioLinkOf(KERMES));
    await expect(copyBox(page).getByRole("textbox")).toHaveCount(0);
  });

  test("F-GAL7-01 each press of Copy the studio link is announced again", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/gallery/kermes");
    await copyBox(page)
      .getByRole("status")
      .evaluate((status: HTMLElement) => {
        const log: string[] = [];
        (window as unknown as { __announced: string[] }).__announced = log;
        new MutationObserver(() => {
          const text = status.textContent ?? "";
          if (text !== log[log.length - 1]) log.push(text);
        }).observe(status, { childList: true, characterData: true, subtree: true });
      });
    const press = page.getByRole("button", { name: "Copy the studio link", exact: true });
    await press.click();
    await expect(copyBox(page).getByRole("status")).toHaveText("Copied the studio link.");
    await press.click();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __announced: string[] }).__announced))
      .toEqual(["Copied the studio link.", "", "Copied the studio link."]);
  });

  test("F-GAL6-09 a refused copy shows the link in a selected read-only field and the blocked sentence", async ({
    page,
  }) => {
    await CLIPBOARD_DENY(page);
    await page.goto("/gallery/kermes");
    await page.getByRole("button", { name: "Copy the studio link", exact: true }).click();
    await expect(copyBox(page).getByRole("status")).toHaveText(
      "Copy blocked. Select the link below.",
    );
    const field = page.getByRole("textbox", { name: "Share link", exact: true });
    await expect(field).toHaveValue(studioLinkOf(KERMES));
    await expect(field).toHaveAttribute("readonly", "");
    await expect(field).not.toBeEditable();
    await expect(field).toBeFocused();
    expect(
      await field.evaluate((input: HTMLInputElement) => [
        input.selectionStart,
        input.selectionEnd,
        input.value.length,
      ]),
    ).toEqual([0, studioLinkOf(KERMES).length, studioLinkOf(KERMES).length]);
    // Focus leaves and comes back: the field selects its whole link again.
    await page.getByRole("link", { name: "Back to the gallery", exact: true }).focus();
    await field.focus();
    expect(
      await field.evaluate((input: HTMLInputElement) => [input.selectionStart, input.selectionEnd]),
    ).toEqual([0, studioLinkOf(KERMES).length]);
    const text = await shownText(page);
    expect(text).not.toMatch(/NotAllowedError|Write permission denied|Error/);
  });

  test("F-GAL6-10 from turquoise, the explorer and the motion lab open the design through the redirect", async ({
    page,
  }) => {
    await page.goto("/gallery/turquoise");
    await page.getByRole("link", { name: "Open in the explorer", exact: true }).click();
    await expectAt(page, "explore", TURQUOISE);
    await expect(page.locator("[data-explorer-summary]")).toHaveText(/^Turquoise: /);

    await page.goto("/gallery/turquoise");
    await page.getByRole("link", { name: "Open in the motion lab", exact: true }).click();
    await expectAt(page, "motion", TURQUOISE);
    await expect(page.locator("[data-lab]")).toBeAttached();
    await expect(page.locator("[data-lab-notice]")).toHaveText("");
  });

  test("F-GAL6-11 the gallery's and an entry's title, description, canonical and share image", async ({
    page,
  }) => {
    await page.goto("/gallery");
    await expect(page).toHaveTitle("Gallery — dyelot");
    expect(await metaContent(page, 'meta[name="description"]')).toBe(GALLERY_DESCRIPTION);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `${SITE.url}/gallery`,
    );

    await page.goto("/gallery/kermes");
    await expect(page).toHaveTitle("Kermes — dyelot");
    const { required, requiredPass } = KERMES.summary.contrast;
    expect(await metaContent(page, 'meta[name="description"]')).toBe(
      `${KERMES.line} ${requiredPass} of ${required} required contrast checks pass.`,
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `${SITE.url}/gallery/kermes`,
    );
    for (const selector of ['meta[property="og:image"]', 'meta[name="twitter:image"]']) {
      expect(await metaContent(page, selector), selector).toMatch(
        new RegExp(`^${SITE.url}/gallery/kermes/opengraph-image`),
      );
    }
  });

  test("F-GAL6-12 color only in specimens on /gallery and /gallery/kermes", async ({ page }) => {
    for (const path of ["/gallery", "/gallery/kermes"]) {
      await page.goto(path);
      const { problems } = await chromaOffenders(page, {
        root: "body",
        skip: ["[data-specimen]"],
        madder: "*",
      });
      expect(problems, path).toEqual([]);
    }
  });

  test("F-GAL6-13 no chunk of /gallery or /gallery/kermes, and not /gallery's HTML, holds an entry's link", async ({
    page,
  }) => {
    const prefixes = ENTRIES.map((entry) => entry.link.slice(0, 40));
    const chunks = new Set<string>();
    page.on("response", (response) => {
      if (/\/_next\/static\/chunks\/[^?]*\.js(\?|$)/.test(response.url()))
        chunks.add(response.url());
    });
    const gallery = (await page.goto("/gallery")) as Response;
    const html = await gallery.text();
    for (const prefix of prefixes) expect(html.includes(prefix), prefix).toBe(false);
    await page.waitForLoadState("networkidle");
    await page.goto("/gallery/kermes");
    await page.waitForLoadState("networkidle");
    expect(chunks.size).toBeGreaterThan(0);
    // A body is gone once its page is navigated away from, so each chunk is fetched again by its URL.
    for (const chunk of chunks) {
      const text = await (await page.request.get(chunk)).text();
      for (const prefix of prefixes) {
        expect(text.includes(prefix), `${chunk} holds ${prefix}`).toBe(false);
      }
    }
  });
});

test.describe("R6-15 the open route", () => {
  test("F-GAL6-14 the open route answers 307 to the page with the link in its fragment, and the browser lands there", async ({
    page,
  }) => {
    for (const target of PAGES) {
      const response = await page.request.get(`/gallery/kermes/open/${target}`, {
        maxRedirects: 0,
      });
      expect(response.status(), target).toBe(307);
      expect(response.headers().location, target).toBe(`/${target}#s=${KERMES.link}`);
    }
    await page.goto("/gallery/kermes/open/studio");
    await expectAt(page, "studio", KERMES);
    await ready(page);
    await expect(lotId(page)).toHaveText(KERMES.lot);
  });

  test("F-GAL6-15 an unknown slug, an unknown page and a capitalized slug answer 404 with no Location", async ({
    page,
  }) => {
    for (const path of [
      "/gallery/nope/open/studio",
      "/gallery/kermes/open/lab",
      "/gallery/Kermes/open/studio",
      "/gallery/kermes/open/%2F%2Fevil.example",
    ]) {
      const response = await page.request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(404);
      expect(response.headers().location, path).toBeUndefined();
    }
  });
});
