import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import {
  deltaEOK,
  fontStack,
  lintSpec,
  normalizeSeed,
  PAIRINGS,
  PALETTE_NAMES,
  PRESET_IDS,
  PRESETS,
  parseColor,
  ROLE_NAMES,
  wcagRatio,
} from "@/engine";
import { autoPairingLabel, seedRowHex } from "@/features/studio/inputs";
import { findingKey } from "@/features/studio/inspect";
import { lockSeed } from "@/features/studio/params";
import { linkUrl, writeHash } from "@/features/studio/url";
import { encodeSpec, normalizeSpec } from "@/spec";
import { SITE } from "../../src/lib/site/config";
import { chromaOffenders, chromaScript } from "./color-support";
import {
  button,
  canvasFrame,
  canvasPane,
  canvasRegion,
  canvasVars,
  designFor,
  expectedVars,
  FRESH,
  failingWorker,
  first,
  focusBody,
  inputsAside,
  inputsPanel,
  inspectorAside,
  linkOfValue,
  lotId,
  lotOf,
  modeSwitch,
  nearHex,
  openStudio,
  pickColor,
  ready,
  rgbToHex,
  roleVars,
  seedCalls,
  seedOf,
  settled,
  stubSeeds,
  tampered,
  toolbarRadio,
} from "./studio-support";
import { canvasAtRest, resolveColors } from "./template-support";

// The flows of docs/specs/02-studio.md assigned to Task 2.6: F-STUDIO-01 to 22 (section 7.1),
// F-INPUT-01 to 15 (7.2), F-KEY-01 to 13 (7.3) and the accessibility flows of 7.9 for /studio.
// A flow that names no viewport runs at 1280 × 800.

test.use({ viewport: { width: 1280, height: 800 } });

const PHONE = { width: 360, height: 740 };
const MADDER = "rgb(246, 108, 109)";

const group = (page: Page, name: string) => page.getByRole("group", { name, exact: true });
const radio = (page: Page, groupName: string, name: string) =>
  group(page, groupName).getByRole("radio", { name, exact: true });
/** A radio of the inputs panel, for a group the canvas toolbar repeats (Density, section 7.4). */
const panelRadio = (page: Page, groupName: string, name: string) =>
  inputsPanel(page)
    .getByRole("group", { name: groupName, exact: true })
    .getByRole("radio", { name, exact: true });
const select = (page: Page, name: string) => page.getByRole("combobox", { name, exact: true });
const field = (page: Page, name: string) => page.getByRole("textbox", { name, exact: true });
/** The studio's alert banner, in the header (Next.js keeps its own route announcer as an alert). */
const banner = (page: Page) => page.locator("header").getByRole("alert");

/** What a stray shortcut would change, read at once: the lot, Redo, the mode, a lock, the seeds. */
function shortcutState(page: Page) {
  return page.evaluate(() => ({
    lot: document.querySelector("[data-lot-id]")?.textContent,
    redo: document
      .querySelector('button[aria-keyshortcuts="ArrowRight"]')
      ?.getAttribute("aria-disabled"),
    mode: document.querySelector('[role="switch"]')?.getAttribute("aria-checked"),
    lock: document.querySelector('button[aria-label="Lock primary"]')?.getAttribute("aria-pressed"),
    seeds: (window as unknown as { __seedCalls: number }).__seedCalls,
  }));
}

/** Presses each key and asserts after every single press that the studio's state did not move. */
async function pressEachUnmoved(page: Page, keys: readonly string[]): Promise<void> {
  const before = await shortcutState(page);
  for (const key of keys) {
    await page.keyboard.press(key);
    expect(await shortcutState(page), key).toEqual(before);
  }
}

/** The hash of the page now. */
const hashOf = (page: Page) => page.evaluate(() => window.location.hash);

/** Waits for the debounced hash and draft write after a change (the 300 ms persist). */
async function persisted(page: Page): Promise<string> {
  await expect.poll(() => hashOf(page)).toMatch(/^#s=/);
  return hashOf(page);
}

test.describe("7.1 Layout and the shell", () => {
  test("F-STUDIO-01 /studio has one h1 outside the canvas, its own title, description and canonical, and a sitemap entry", async ({
    page,
    request,
  }) => {
    await openStudio(page);
    // The page's own h1; the template on the canvas carries one of its own (F-TPL-18).
    const own = page.locator("h1:not([data-canvas] h1)");
    await expect(own).toHaveCount(1);
    await expect(own).toHaveText("dyelot studio");
    await expect(page.locator("[data-canvas] h1")).toHaveCount(1);
    // Visually hidden: the h1 takes no room on screen.
    const box = await own.boundingBox();
    expect(box?.width ?? 0).toBeLessThanOrEqual(1);
    await expect(page).toHaveTitle("Studio — dyelot");
    const description = await page.locator('head meta[name="description"]').getAttribute("content");
    expect(description).not.toBe(SITE.description);
    expect(description?.length ?? 0).toBeGreaterThanOrEqual(50);
    expect(description?.length ?? 0).toBeLessThanOrEqual(160);
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
      "href",
      `${SITE.url}/studio`,
    );
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain(`<loc>${SITE.url}/studio</loc>`);
    expect(sitemap).toContain(`<loc>${SITE.url}/</loc>`);
    await page.goto("/");
    await expect(page).toHaveTitle(SITE.title);
  });

  test("F-STUDIO-02 at 1280 px the inputs, canvas and inspector stand side by side", async ({
    page,
  }) => {
    await openStudio(page);
    const inputs = await inputsPanel(page).boundingBox();
    const canvas = await canvasRegion(page).boundingBox();
    const inspector = await page.getByRole("complementary", { name: "Inspector" }).boundingBox();
    if (inputs === null || canvas === null || inspector === null) throw new Error("no box");
    expect(Math.abs(inputs.width - 320)).toBeLessThanOrEqual(1);
    expect(Math.abs(inspector.width - 360)).toBeLessThanOrEqual(1);
    expect(Math.abs(inputs.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(canvas.x - 320)).toBeLessThanOrEqual(1);
    expect(Math.abs(canvas.width - (1280 - 320 - 360))).toBeLessThanOrEqual(1);
    expect(Math.abs(inspector.x - 920)).toBeLessThanOrEqual(1);
    for (const box of [inputs, inspector]) {
      expect(box.y).toBeLessThan(canvas.y + canvas.height);
      expect(box.y + box.height).toBeGreaterThan(canvas.y);
    }
    await expect(button(page, "Inputs")).toBeHidden();
    await expect(button(page, "Inspector")).toBeHidden();
  });

  test("F-STUDIO-03 at 1100 px the inputs stay a column and the inspector is a drawer", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1100, height: 800 });
    await openStudio(page);
    const inputs = await inputsPanel(page).boundingBox();
    expect(Math.abs((inputs?.width ?? 0) - 320)).toBeLessThanOrEqual(1);
    await expect(inspectorAside(page)).toBeHidden();
    await expect(inspectorAside(page)).toHaveAttribute("inert", "");
    await expect(button(page, "Inspector")).toBeVisible();
    await expect(button(page, "Inputs")).toBeHidden();
    // The open Inspector drawer is modal over the inputs column, and gives focus back on close.
    await button(page, "Inspector").click();
    await expect(inspectorAside(page).getByRole("heading", { name: "Inspector" })).toBeFocused();
    await expect(inputsAside(page)).toHaveAttribute("inert", "");
    await page.keyboard.press("Escape");
    await expect(inspectorAside(page)).toBeHidden();
    await expect(button(page, "Inspector")).toBeFocused();
    await expect(inputsAside(page)).not.toHaveAttribute("inert");
  });

  test("F-STUDIO-04 at 360 px both panels are drawers and the page does not scroll sideways", async ({
    page,
  }) => {
    await page.setViewportSize(PHONE);
    await openStudio(page);
    await expect(inputsAside(page)).toBeHidden();
    await expect(inspectorAside(page)).toBeHidden();
    await expect(button(page, "Inputs")).toBeVisible();
    await expect(button(page, "Inspector")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      360,
    );
  });

  test("F-STUDIO-05 a drawer takes focus, traps it, makes the page inert and gives focus back on Escape", async ({
    page,
  }) => {
    await page.setViewportSize(PHONE);
    await openStudio(page);
    for (const [name, aside] of [
      ["Inputs", inputsAside(page)],
      ["Inspector", inspectorAside(page)],
    ] as const) {
      const opener = button(page, name);
      await opener.click();
      await expect(aside).toBeVisible();
      await expect(aside).not.toHaveAttribute("inert");
      await expect(aside.getByRole("heading", { name, exact: true })).toBeFocused();
      for (const other of [
        page.locator("header"),
        canvasRegion(page),
        page.locator("[data-toolbar]"),
        name === "Inputs" ? inspectorAside(page) : inputsAside(page),
      ]) {
        await expect(other).toHaveAttribute("inert", "");
      }
      // Tab and Shift+Tab never leave the drawer.
      const count = await aside
        .locator("a[href], button, input, select, textarea, [tabindex='0']")
        .count();
      for (let i = 0; i < count + 2; i++) {
        await page.keyboard.press("Tab");
        expect(await aside.evaluate((el) => el.contains(document.activeElement))).toBe(true);
      }
      for (let i = 0; i < count + 2; i++) {
        await page.keyboard.press("Shift+Tab");
        expect(await aside.evaluate((el) => el.contains(document.activeElement))).toBe(true);
      }
      await page.keyboard.press("Escape");
      await expect(aside).toBeHidden();
      await expect(aside).toHaveAttribute("inert", "");
      await expect(opener).toBeFocused();
      await expect(canvasRegion(page)).not.toHaveAttribute("inert");
    }
  });

  test("F-STUDIO-05 a drawer that becomes a column closes, and stays closed when the window narrows", async ({
    page,
  }) => {
    await page.setViewportSize(PHONE);
    await openStudio(page);
    await button(page, "Inputs").click();
    await expect(inputsAside(page)).toBeVisible();
    await page.setViewportSize({ width: 1100, height: 800 });
    await expect(inputsAside(page)).not.toHaveAttribute("inert");
    await expect(canvasRegion(page)).not.toHaveAttribute("inert");
    await page.setViewportSize(PHONE);
    await expect(inputsAside(page)).toBeHidden();
    await expect(inputsAside(page)).toHaveAttribute("inert", "");
    await expect(canvasRegion(page)).not.toHaveAttribute("inert");
  });

  test("F-STUDIO-06 a backdrop click closes a drawer, and a closed drawer takes no focus", async ({
    page,
  }) => {
    await page.setViewportSize(PHONE);
    await openStudio(page);
    const opener = button(page, "Inputs");
    await opener.click();
    await expect(inputsAside(page)).toBeVisible();
    // The drawer is at most 320 px wide: the strip at the right edge is backdrop.
    await page.mouse.click(350, 400);
    await expect(inputsAside(page)).toBeHidden();
    await expect(opener).toBeFocused();
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press("Tab");
      for (const aside of [inputsAside(page), inspectorAside(page)]) {
        expect(await aside.evaluate((el) => el.contains(document.activeElement))).toBe(false);
      }
    }
  });

  test("F-STUDIO-07 the lot tag shows LOT and the spec id as xxxx·xxxx, and follows a change", async ({
    page,
  }) => {
    await stubSeeds(page);
    await openStudio(page);
    await expect(page.locator("[data-lot]")).toHaveText(`LOT ${lotOf(first())}`);
    await expect(lotId(page)).toHaveText(lotOf(first()));
    await button(page, "Regenerate").click();
    await expect(lotId(page)).toHaveText(lotOf(designFor(FRESH, seedOf(2))));
  });

  test("F-STUDIO-08 the strip shows the 11 primary steps of the current mode and follows the mode", async ({
    page,
  }) => {
    await stubSeeds(page);
    await openStudio(page);
    const strip = page.getByRole("group", { name: "Primary scale, 11 steps" });
    const swatches = strip.locator("[data-swatch]");
    await expect(swatches).toHaveCount(11);
    for (const mode of ["light", "dark"] as const) {
      if (mode === "dark") await modeSwitch(page).click();
      const scale = first().color.palettes.primary[mode];
      const shown = await swatches.evaluateAll((elements) =>
        elements.map((el) => getComputedStyle(el).backgroundColor),
      );
      expect(shown.map(rgbToHex)).toEqual(scale.map((step) => step.hex));
      for (const [i, step] of scale.entries()) {
        await expect(swatches.nth(i)).toHaveAttribute("title", `${step.step} ${step.hex}`);
        await expect(swatches.nth(i)).toHaveAttribute("role", "img");
        await expect(swatches.nth(i)).toHaveAccessibleName(`${step.step} ${step.hex}`);
      }
    }
  });

  test("F-STUDIO-09 a tampered link opens a fresh design with the corrupt banner", async ({
    page,
  }) => {
    const link = encodeSpec(designFor(FRESH, "e2e-link"));
    await openStudio(page, `#s=${tampered(link)}`);
    const alert = banner(page);
    await expect(alert).toContainText(
      "This link is damaged or cut short, so the studio cannot open it.",
    );
    await expect(alert).toContainText("The studio opened a fresh design instead.");
    await expect(alert.getByRole("button", { name: "Start fresh", exact: true })).toBeVisible();
    await expect(alert.getByRole("button", { name: "Dismiss", exact: true })).toBeVisible();
    // Never blank: the canvas holds a whole design.
    expect(Object.keys(await canvasVars(page))).toHaveLength(209);
    const frame = await canvasFrame(page).boundingBox();
    expect(frame?.height ?? 0).toBeGreaterThan(100);
  });

  test("F-STUDIO-10 a truncated link shows the corrupt banner", async ({ page }) => {
    const link = encodeSpec(designFor(FRESH, "e2e-link"));
    await openStudio(page, `#s=${link.slice(0, -40)}`);
    await expect(banner(page)).toContainText(
      "This link is damaged or cut short, so the studio cannot open it.",
    );
  });

  test("F-STUDIO-10 a link from a future version shows the version banner", async ({ page }) => {
    const future = { ...designFor(FRESH, "e2e-link"), version: "dyelot.spec/2" };
    await openStudio(page, `#s=${linkOfValue(future)}`);
    await expect(banner(page)).toContainText(
      "This link comes from another version of the design format, so the studio cannot open it.",
    );
  });

  test("F-STUDIO-10 a link that fails the schema shows the schema banner with the count", async ({
    page,
  }) => {
    const broken = structuredClone(designFor(FRESH, "e2e-link")) as unknown as {
      color: { roles: { light: Record<string, string> } };
      shape: { radiusSet: string };
    };
    delete broken.color.roles.light.ring;
    broken.shape.radiusSet = "blobby";
    await openStudio(page, `#s=${linkOfValue(broken)}`);
    await expect(banner(page)).toContainText(
      "This link holds a design the studio cannot read: 2 fields fail the format check.",
    );
  });

  test("F-STUDIO-11 Start fresh opens a new design and clears the banner and the link", async ({
    page,
  }) => {
    await stubSeeds(page);
    const bad = `#s=${tampered(encodeSpec(designFor(FRESH, "e2e-link")))}`;
    await openStudio(page, bad);
    await expect(lotId(page)).toHaveText(lotOf(first()));
    await button(page, "Start fresh").click();
    await expect(banner(page)).toHaveCount(0);
    await expect(lotId(page)).toHaveText(lotOf(designFor(FRESH, seedOf(2))));
    expect(await hashOf(page)).not.toBe(bad);
    expect(await persisted(page)).toBe(writeHash(designFor(FRESH, seedOf(2))));
  });

  test("F-STUDIO-11 Dismiss hides the banner and keeps the design", async ({ page }) => {
    await stubSeeds(page);
    await openStudio(page, `#s=${tampered(encodeSpec(designFor(FRESH, "e2e-link")))}`);
    await button(page, "Dismiss").click();
    await expect(banner(page)).toHaveCount(0);
    await expect(lotId(page)).toHaveText(lotOf(first()));
  });

  test("F-STUDIO-12 with a saved draft, a bad link opens the draft and says so", async ({
    page,
  }) => {
    await stubSeeds(page);
    await openStudio(page);
    await button(page, "Regenerate").click();
    await expect(lotId(page)).toHaveText(lotOf(designFor(FRESH, seedOf(2))));
    await persisted(page);
    await page.goto("about:blank");
    await openStudio(page, `#s=${tampered(encodeSpec(designFor(FRESH, "e2e-link")))}`);
    const alert = banner(page);
    await expect(alert).toContainText("This link is damaged or cut short");
    await expect(alert).toContainText("The studio opened your last draft instead.");
    await expect(lotId(page)).toHaveText(lotOf(designFor(FRESH, seedOf(2))));
  });

  test("F-STUDIO-13 a valid link opens that design", async ({ page }) => {
    const spec = designFor({ ...FRESH, chroma: "vivid", radius: "round" }, "e2e-link");
    await openStudio(page, writeHash(spec));
    expect(await canvasVars(page)).toEqual(expectedVars(spec));
    await expect(lotId(page)).toHaveText(lotOf(spec));
    await expect(banner(page)).toHaveCount(0);
  });

  test("F-STUDIO-14 the hash follows a change within 400 ms, and a reload restores the design", async ({
    page,
  }) => {
    await stubSeeds(page);
    await openStudio(page);
    expect(await hashOf(page)).toBe("");
    const timing = page.evaluate(
      () =>
        new Promise<{ varsAt: number; hashAt: number }>((resolve) => {
          const frame = document.querySelector("[data-canvas][data-frame]");
          const style = frame?.getAttribute("style");
          let varsAt: number | null = null;
          const tick = () => {
            const now = performance.now();
            if (varsAt === null && frame?.getAttribute("style") !== style) varsAt = now;
            if (varsAt !== null && window.location.hash.startsWith("#s=")) {
              resolve({ varsAt, hashAt: now });
              return;
            }
            requestAnimationFrame(tick);
          };
          tick();
        }),
    );
    await radio(page, "Chroma", "vivid").check();
    const { varsAt, hashAt } = await timing;
    expect(hashAt - varsAt).toBeLessThanOrEqual(400);
    const spec = designFor({ ...FRESH, chroma: "vivid" }, seedOf(1));
    expect(await hashOf(page)).toBe(writeHash(spec));
    await page.reload();
    await ready(page);
    await expect(lotId(page)).toHaveText(lotOf(spec));
    expect(await canvasVars(page)).toEqual(expectedVars(spec));
    await expect(radio(page, "Chroma", "vivid")).toBeChecked();
  });

  test("F-STUDIO-15 Copy link and Mod+S copy the share link and say so", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await stubSeeds(page);
    await openStudio(page);
    const origin = new URL(page.url()).origin;
    const expected = linkUrl(origin, first());
    await button(page, "Copy link").click();
    await expect(page.getByRole("status").filter({ hasText: "Link copied" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(expected);
    await page.evaluate(() => navigator.clipboard.writeText(""));
    await focusBody(page);
    await page.keyboard.press("ControlOrMeta+s");
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(expected);
  });

  for (const [title, script] of [
    [
      "a clipboard that refuses",
      () =>
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: { writeText: () => Promise.reject(new DOMException("denied", "NotAllowedError")) },
        }),
    ],
    [
      "no clipboard at all",
      () => Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined }),
    ],
  ] as const) {
    test(`F-STUDIO-16 with ${title}, the studio shows the link selected in a field`, async ({
      page,
    }) => {
      await page.addInitScript(script);
      await stubSeeds(page);
      await openStudio(page);
      const expected = linkUrl(new URL(page.url()).origin, first());
      for (const copy of [
        () => button(page, "Copy link").click(),
        async () => {
          await focusBody(page);
          await page.keyboard.press("ControlOrMeta+s");
        },
      ]) {
        await copy();
        await expect(page.getByText("Copy blocked. Select the link below.")).toBeVisible();
        const share = field(page, "Share link");
        await expect(share).toHaveValue(expected);
        await expect(share).toHaveAttribute("readonly", "");
        await expect(share).toBeFocused();
        const selection = await share.evaluate((el) => {
          const input = el as HTMLInputElement;
          return [input.selectionStart, input.selectionEnd];
        });
        expect(selection).toEqual([0, expected.length]);
      }
    });
  }

  test("F-STUDIO-16 a held Mod+S never opens the save dialog, also from the share field", async ({
    page,
  }) => {
    await page.addInitScript(() =>
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined }),
    );
    await openStudio(page);
    await page.evaluate(() => {
      const record = window as unknown as { __saves: boolean[] };
      record.__saves = [];
      window.addEventListener("keydown", (event) => {
        if (event.code === "KeyS") record.__saves.push(event.defaultPrevented);
      });
    });
    await focusBody(page);
    await page.keyboard.down("ControlOrMeta");
    await page.keyboard.down("s");
    // The first press moved focus into the share field; the held key repeats there.
    await expect(field(page, "Share link")).toBeFocused();
    for (let i = 0; i < 3; i++) await page.keyboard.down("s");
    await page.keyboard.up("s");
    await page.keyboard.up("ControlOrMeta");
    const saves = await page.evaluate(() => (window as unknown as { __saves: boolean[] }).__saves);
    expect(saves).toEqual([true, true, true, true]);
  });

  test("F-STUDIO-17 with a throwing localStorage the studio works and says drafts are off", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const blocked = new Proxy(
        {},
        {
          get() {
            throw new DOMException("The operation is insecure.", "SecurityError");
          },
        },
      );
      Object.defineProperty(window, "localStorage", { configurable: true, get: () => blocked });
    });
    await stubSeeds(page);
    await openStudio(page);
    await expect(page.locator("[data-toolbar]")).toContainText("Drafts off");
    await radio(page, "Chroma", "vivid").check();
    await expect(lotId(page)).toHaveText(
      lotOf(designFor({ ...FRESH, chroma: "vivid" }, seedOf(1))),
    );
    expect(await persisted(page)).toBe(
      writeHash(designFor({ ...FRESH, chroma: "vivid" }, seedOf(1))),
    );
    await button(page, "Undo").click();
    await expect(lotId(page)).toHaveText(lotOf(first()));
  });

  test("F-STUDIO-18 a saved draft comes back on a reload with no hash, with a notice", async ({
    page,
  }) => {
    await stubSeeds(page);
    await openStudio(page);
    await button(page, "Regenerate").click();
    await expect(lotId(page)).toHaveText(lotOf(designFor(FRESH, seedOf(2))));
    await persisted(page);
    await page.goto("about:blank");
    await openStudio(page);
    await expect(lotId(page)).toHaveText(lotOf(designFor(FRESH, seedOf(2))));
    const notice = page.getByRole("status").filter({ hasText: "Restored your last draft." });
    await expect(notice).toBeVisible();
    await notice.getByRole("button", { name: "Dismiss", exact: true }).click();
    await expect(page.getByText("Restored your last draft.")).toHaveCount(0);
  });

  test("F-STUDIO-19 a failing generator shows a message with Revert and keeps the canvas", async ({
    page,
  }) => {
    await failingWorker(page);
    await openStudio(page);
    const before = await canvasVars(page);
    await page.evaluate(() => {
      (window as unknown as { __dyelotFault: boolean }).__dyelotFault = true;
    });
    await radio(page, "Chroma", "vivid").check();
    const alert = banner(page);
    await expect(alert).toContainText("The studio could not generate this change.");
    await expect(alert).not.toContainText("forced");
    expect(await canvasVars(page)).toEqual(before);
    await expect(radio(page, "Chroma", "vivid")).toBeChecked();
    await alert.getByRole("button", { name: "Revert", exact: true }).click();
    await expect(banner(page)).toHaveCount(0);
    await expect(radio(page, "Chroma", "balanced")).toBeChecked();
    expect(await canvasVars(page)).toEqual(before);
  });

  test("F-STUDIO-20 every request stays on the page's origin", async ({ page }) => {
    const urls: string[] = [];
    page.on("request", (request) => urls.push(request.url()));
    await openStudio(page);
    await radio(page, "Chroma", "vivid").check();
    await settled(page);
    const origin = new URL(page.url()).origin;
    const foreign = urls.filter(
      (url) =>
        !url.startsWith("data:") && !url.startsWith("blob:") && new URL(url).origin !== origin,
    );
    expect(foreign).toEqual([]);
    expect(urls.some((url) => /fonts\.(googleapis|gstatic)\.com/.test(url))).toBe(false);
  });

  test("F-STUDIO-21 generation runs in a worker the policy allows", async ({ page }) => {
    const problems: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") problems.push(message.text());
    });
    page.on("pageerror", (error) => problems.push(error.message));
    await page.addInitScript(() => {
      const Real = window.Worker;
      const counter = window as unknown as { __workers: number };
      counter.__workers = 0;
      window.Worker = class extends Real {
        constructor(...args: ConstructorParameters<typeof Worker>) {
          super(...args);
          counter.__workers += 1;
        }
      };
    });
    const response = await openStudio(page);
    expect(response.headers()["content-security-policy"]).toMatch(/worker-src 'self' blob:/);
    await changeDesign(page, () => radio(page, "Chroma", "vivid").check());
    expect(await page.evaluate(() => (window as unknown as { __workers: number }).__workers)).toBe(
      1,
    );
    expect(problems).toEqual([]);
  });

  test("F-STUDIO-22 a link with fonts outside the pairings shows the polite notice", async ({
    page,
  }) => {
    const spec = structuredClone(designFor(FRESH, "e2e-link"));
    const custom = normalizeSpec({
      ...spec,
      type: { ...spec.type, families: { display: "geist", body: "geist", mono: "geist-mono" } },
    });
    await openStudio(page, writeHash(custom));
    const notice = page.getByRole("status").filter({ hasText: "outside the studio's pairings" });
    await expect(notice).toContainText("This design uses fonts outside the studio's pairings.");
    await expect(notice).toContainText("Editing it resets the fonts to the automatic pairing.");
    await expect(lotId(page)).toHaveText(lotOf(custom));
  });
});

/**
 * Waits for the panels to settle into drawer (or column) state, on the first animation frame that
 * shows it, and reads their motion then: the animations and transitions they hold, and their
 * visibility (F-STUDIO-25).
 */
function panelMotion(page: Page, drawer: boolean) {
  return page.evaluate(
    (wanted) =>
      new Promise<{ running: number; visibility: string[] }>((resolve) => {
        const asides = [...document.querySelectorAll("aside")];
        const check = () => {
          const inputs = document.querySelector('aside[aria-label="Inputs"]');
          if (inputs === null || inputs.hasAttribute("data-drawer") !== wanted) {
            requestAnimationFrame(check);
            return;
          }
          resolve({
            running: asides.reduce((sum, aside) => sum + aside.getAnimations().length, 0),
            visibility: asides.map((aside) => getComputedStyle(aside).visibility),
          });
        };
        check();
      }),
    drawer,
  );
}

test.describe("7.1 Focus and drafts after the review", () => {
  test("F-STUDIO-23 after Start fresh or Dismiss focus moves to the canvas region", async ({
    page,
  }) => {
    const bad = `#s=${tampered(encodeSpec(designFor(FRESH, "e2e-link")))}`;
    await openStudio(page, bad);
    await banner(page).getByRole("button", { name: "Dismiss", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(banner(page)).toHaveCount(0);
    await expect(canvasRegion(page)).toBeFocused();
    await page.goto("about:blank");
    await openStudio(page, bad);
    await banner(page).getByRole("button", { name: "Start fresh", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(banner(page)).toHaveCount(0);
    await expect(canvasRegion(page)).toBeFocused();
  });

  test("F-STUDIO-23 after Revert focus moves to the canvas region", async ({ page }) => {
    await failingWorker(page);
    await openStudio(page);
    await page.evaluate(() => {
      (window as unknown as { __dyelotFault: boolean }).__dyelotFault = true;
    });
    await radio(page, "Chroma", "vivid").check();
    const revert = banner(page).getByRole("button", { name: "Revert", exact: true });
    await revert.focus();
    await page.keyboard.press("Enter");
    await expect(banner(page)).toHaveCount(0);
    await expect(canvasRegion(page)).toBeFocused();
  });

  test("F-STUDIO-23 closing the copy-blocked toast gives focus back", async ({ page }) => {
    await page.addInitScript(() =>
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined }),
    );
    await openStudio(page);
    const close = button(page, "Close");
    // From Copy link: focus returns to it.
    await button(page, "Copy link").focus();
    await page.keyboard.press("Enter");
    await expect(field(page, "Share link")).toBeFocused();
    await close.click();
    await expect(button(page, "Copy link")).toBeFocused();
    // From another control, by Mod+S: focus returns to that control.
    await button(page, "Lock secondary").focus();
    await page.keyboard.press("ControlOrMeta+s");
    await expect(field(page, "Share link")).toBeFocused();
    await close.focus();
    await page.keyboard.press("Enter");
    await expect(button(page, "Lock secondary")).toBeFocused();
    // From the page body: focus falls back to Copy link.
    await focusBody(page);
    await page.keyboard.press("ControlOrMeta+s");
    await expect(field(page, "Share link")).toBeFocused();
    await close.click();
    await expect(button(page, "Copy link")).toBeFocused();
  });

  test("F-STUDIO-23 a toast reopened from its own Close button gives focus to Copy link", async ({
    page,
  }) => {
    await page.addInitScript(() =>
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined }),
    );
    await openStudio(page);
    await button(page, "Copy link").click();
    await expect(field(page, "Share link")).toBeFocused();
    await button(page, "Close").focus();
    await page.keyboard.press("ControlOrMeta+s");
    await expect(field(page, "Share link")).toBeFocused();
    await button(page, "Close").click();
    await expect(button(page, "Copy link")).toBeFocused();
  });

  test("F-STUDIO-23 with a drawer open, a copy-blocked toast announces itself and keeps focus", async ({
    page,
  }) => {
    await page.addInitScript(() =>
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined }),
    );
    await page.setViewportSize(PHONE);
    await openStudio(page);
    await button(page, "Inputs").click();
    const lock = button(page, "Lock primary");
    await lock.focus();
    await page.keyboard.press("ControlOrMeta+s");
    await expect(
      page.getByRole("status").filter({ hasText: "Copy blocked. Select the link below." }),
    ).toBeVisible();
    await expect(lock).toBeFocused();
    await expect(inputsAside(page)).toBeVisible();
  });

  test("F-STUDIO-24 Drafts off opens by keyboard and says why", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get() {
          throw new DOMException("The operation is insecure.", "SecurityError");
        },
      });
    });
    await openStudio(page);
    const why =
      "This browser does not let the studio save a draft. The link in the address bar still holds the design.";
    const toggle = page.locator("[data-toolbar]").getByText("Drafts off", { exact: true });
    await expect(page.getByText(why)).toBeHidden();
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText(why)).toBeVisible();
  });

  test("F-STUDIO-24 drafts that turn off mid-session are announced", async ({ page }) => {
    await page.addInitScript(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      };
    });
    await openStudio(page);
    const live = page.locator("[data-drafts-announcer]");
    await expect(live).toHaveText("");
    await expect(live).toHaveAttribute("role", "status");
    await changeDesign(page, () => radio(page, "Chroma", "vivid").check());
    await expect(live).toHaveText("Drafts off");
  });

  test("F-STUDIO-24 drafts that turn off while a drawer is open are announced", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      };
    });
    await page.setViewportSize(PHONE);
    await openStudio(page);
    await button(page, "Inputs").click();
    await expect(inputsAside(page)).toBeVisible();
    await radio(page, "Chroma", "vivid").check();
    // In the accessibility tree (nothing inert around it), with the message.
    await expect(page.getByRole("status").filter({ hasText: "Drafts off" })).toHaveCount(1);
    const live = page.locator("[data-drafts-announcer]");
    expect(await live.evaluate((el) => el.closest("[inert]") === null)).toBe(true);
    await expect(inputsAside(page)).toBeVisible();
  });

  test("F-STUDIO-25 crossing a breakpoint moves no panel, and a drawer still slides open", async ({
    page,
  }) => {
    const motion = (drawer: boolean) => panelMotion(page, drawer);
    await openStudio(page);
    await page.setViewportSize(PHONE);
    expect(await motion(true)).toEqual({ running: 0, visibility: ["hidden", "hidden"] });
    await page.setViewportSize({ width: 1280, height: 800 });
    expect(await motion(false)).toEqual({ running: 0, visibility: ["visible", "visible"] });
    await page.setViewportSize(PHONE);
    await motion(true);
    await button(page, "Inputs").click();
    expect(
      await inputsAside(page).evaluate((el) => getComputedStyle(el).transitionDuration),
    ).toMatch(/0\.22s/);
    await expect(inputsAside(page)).toBeVisible();
  });

  test("F-STUDIO-25 under the system's reduced motion, crossing a breakpoint starts no transition on a panel", async ({
    page,
  }) => {
    // The global 0.01 ms rule must not give a panel a transition when it turns into a drawer or back
    // into a column (final review, M-1).
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openStudio(page);
    // 360 px to 1280 px and back, twice: both panels cross 1024 and 1280 px each way.
    for (const [viewport, drawer] of [
      [PHONE, true],
      [{ width: 1280, height: 800 }, false],
      [PHONE, true],
      [{ width: 1280, height: 800 }, false],
    ] as const) {
      await page.setViewportSize(viewport);
      expect((await panelMotion(page, drawer)).running, `${viewport.width} px`).toBe(0);
    }
  });
});

test("F-INPUT-16 Regenerate stays in view at 1280 × 800 and every shortcut is named", async ({
  page,
}) => {
  await openStudio(page);
  const regenerate = button(page, "Regenerate");
  await expect(regenerate).toBeInViewport({ ratio: 1 });
  await expect(regenerate).toHaveAttribute("aria-keyshortcuts", "Space");
  await expect(modeSwitch(page)).toHaveAttribute("aria-keyshortcuts", "Alt+T");
  await expect(button(page, "Copy link")).toHaveAttribute("aria-keyshortcuts", "Control+S Meta+S");
  await expect(button(page, "Export")).toHaveAttribute("aria-keyshortcuts", "Control+E Meta+E");
  const hint = inputsPanel(page).locator("[data-shortcut-hint]");
  await expect(hint).toContainText("Alt+T");
  await expect(hint).toContainText("Ctrl+S");
  await expect(hint).toBeInViewport({ ratio: 1 });
});

/** Runs `change` and waits until the lot tag shows another design. */
async function changeDesign(page: Page, change: () => Promise<void>): Promise<void> {
  const before = await lotId(page).textContent();
  await change();
  await expect(lotId(page)).not.toHaveText(before ?? "");
  await settled(page);
}

/** The controls of the inputs panel in DOM order, as `kind:name` (F-INPUT-01). */
function panelControls(page: Page): Promise<string[]> {
  return inputsPanel(page).evaluate((panel) => {
    const visible = (el: Element) => {
      const box = el.getBoundingClientRect();
      return box.width > 0 && box.height > 0;
    };
    const nameOf = (el: Element): string => {
      const label = el.getAttribute("aria-label");
      if (label !== null) return label;
      if (el instanceof HTMLFieldSetElement) return el.querySelector("legend")?.textContent ?? "";
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLSelectElement ||
        el instanceof HTMLTextAreaElement
      ) {
        return el.labels?.[0]?.textContent?.trim() ?? "";
      }
      return el.textContent?.trim() ?? "";
    };
    const kindOf = (el: Element): string => {
      if (el instanceof HTMLFieldSetElement) return "group";
      if (el instanceof HTMLSelectElement) return "select";
      if (el instanceof HTMLInputElement) return el.type;
      return el.tagName.toLowerCase();
    };
    const controls = "fieldset, select, button, textarea, input:not([type='radio'])";
    return [...panel.querySelectorAll(controls)]
      .filter(visible)
      .map((el) => `${kindOf(el)}:${nameOf(el)}`);
  });
}

test.describe("7.2 The inputs panel", () => {
  const SEEDS = ["Primary", "Secondary", "Accent"] as const;
  const CONTROLS = [
    "text:Name",
    "text:One line",
    "button:Import…",
    // The Brief section (docs/specs/04-ai.md, 13.1 and 13.7; section 16), AI settings closed.
    "textarea:Describe the product or mood",
    "button:Read the brief",
    "button:AI settings",
    // The Image section (13.3; section 16).
    "file:Choose an image",
    "button:Read the vibe",
    ...SEEDS.flatMap((slot) => [
      `text:${slot}`,
      `color:Pick ${slot.toLowerCase()}`,
      `button:Lock ${slot.toLowerCase()}`,
    ]),
    "select:Harmony",
    "group:Chroma",
    "group:Neutral tint",
    "group:Contrast level",
    "group:Gamut",
    "group:Scale mode",
    "select:Preset",
    "select:Pairing",
    "select:Type context",
    "group:Radius",
    "group:Depth",
    "group:Density",
    "group:Motion feel",
    // The Steer section (13.4; section 16), after Style and before the footer: the chips, a group
    // of buttons, then the field and its button.
    "button:Warmer",
    "button:Cooler",
    "button:Bolder",
    "button:Quieter",
    "button:Softer",
    "button:Sharper",
    "button:Airier",
    "text:Refine in words",
    "button:Refine",
    "button:Regenerate",
  ];

  test("F-INPUT-01 the panel holds exactly the controls of the table, in order", async ({
    page,
  }) => {
    await openStudio(page);
    expect(await panelControls(page)).toEqual(CONTROLS);
    const panel = inputsPanel(page);
    // The brief's textarea is the panel's one, and the Image section's file input its one file
    // control (docs/specs/04-ai.md, section 16). The About section's "Import…" is the panel's one
    // import control (R3-33).
    await expect(panel.locator("textarea")).toHaveCount(1);
    await expect(panel.locator("input[type='file']")).toHaveCount(1);
    await expect(panel.getByText(/import/i)).toHaveCount(1);
    await expect(panel.getByRole("button", { name: "Import…", exact: true })).toHaveCount(1);
  });

  test("F-INPUT-02 every control has an accessible name equal to its label", async ({ page }) => {
    await openStudio(page);
    const panel = inputsPanel(page);
    for (const name of ["Name", "One line"]) {
      await expect(panel.getByRole("textbox", { name, exact: true })).toHaveCount(1);
      await expect(panel.locator("label", { hasText: new RegExp(`^${name}$`) })).toBeVisible();
    }
    await expect(panel.getByRole("button", { name: "Import…", exact: true })).toHaveText("Import…");
    // The Brief section's controls carry section 13's strings (docs/specs/04-ai.md, F-INPUT4-02).
    const brief = panel.getByRole("textbox", { name: "Describe the product or mood", exact: true });
    await expect(brief).toHaveCount(1);
    await expect(brief).toHaveAccessibleDescription("0 of 500 characters");
    await expect(
      panel.locator("label", { hasText: /^Describe the product or mood$/ }),
    ).toBeVisible();
    const read = panel.getByRole("button", { name: "Read the brief", exact: true });
    await expect(read).toHaveText("Read the brief");
    await expect(read).toHaveAccessibleDescription("Write a few words or a color first.");
    await expect(panel.getByRole("button", { name: "AI settings", exact: true })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    // The Image section's controls (13.3).
    const image = panel.getByLabel("Choose an image", { exact: true });
    await expect(image).toHaveAttribute("type", "file");
    const vibe = panel.getByRole("button", { name: "Read the vibe", exact: true });
    await expect(vibe).toHaveText("Read the vibe");
    await expect(vibe).toHaveAccessibleDescription("Choose an image first.");
    // The Steer section's controls (13.4).
    const steer = panel.getByRole("group", { name: "Steer the design", exact: true });
    await expect(steer.getByText("Steer the design", { exact: true })).toBeVisible();
    for (const name of ["Warmer", "Cooler", "Bolder", "Quieter", "Softer", "Sharper", "Airier"]) {
      await expect(steer.getByRole("button", { name, exact: true })).toHaveText(name);
    }
    await expect(panel.getByRole("textbox", { name: "Refine in words", exact: true })).toHaveCount(
      1,
    );
    await expect(panel.locator("label", { hasText: /^Refine in words$/ })).toBeVisible();
    const refine = panel.getByRole("button", { name: "Refine", exact: true });
    await expect(refine).toHaveText("Refine");
    await expect(refine).toHaveAccessibleDescription("Write what to change first.");
    for (const slot of SEEDS) {
      await expect(panel.getByRole("textbox", { name: slot, exact: true })).toHaveCount(1);
      await expect(panel.getByLabel(`Pick ${slot.toLowerCase()}`, { exact: true })).toHaveCount(1);
      await expect(
        panel.getByRole("button", { name: `Lock ${slot.toLowerCase()}`, exact: true }),
      ).toHaveAttribute("aria-pressed", "false");
      await expect(panel.locator("label", { hasText: new RegExp(`^${slot}$`) })).toBeVisible();
    }
    for (const name of ["Harmony", "Preset", "Pairing", "Type context"]) {
      await expect(panel.getByRole("combobox", { name, exact: true })).toHaveCount(1);
      await expect(panel.locator("label", { hasText: new RegExp(`^${name}$`) })).toBeVisible();
    }
    for (const name of [
      "Chroma",
      "Neutral tint",
      "Contrast level",
      "Gamut",
      "Scale mode",
      "Radius",
      "Depth",
      "Density",
      "Motion feel",
    ]) {
      await expect(panel.getByRole("group", { name, exact: true })).toHaveCount(1);
      await expect(panel.locator("legend", { hasText: new RegExp(`^${name}$`) })).toBeVisible();
    }
    await expect(panel.getByRole("button", { name: "Regenerate", exact: true })).toHaveCount(1);
  });

  test("F-INPUT-03 each input changes its canvas variable", async ({ page }) => {
    // Seed 1 of the stub ("10") is one where the contrast level moves a role (scanned in Node).
    const roles = (spec: ReturnType<typeof first>) => JSON.stringify(spec.color.roles);
    let start = 0;
    while (
      roles(designFor(FRESH, seedOf(start + 1))) ===
      roles(designFor({ ...FRESH, contrastLevel: "AA+" }, seedOf(start + 1)))
    ) {
      start += 1;
    }
    await stubSeeds(page, start);
    await openStudio(page);
    const base = await canvasVars(page);
    const scaleSteps = (vars: Record<string, string>) =>
      Object.entries(vars).filter(
        ([name]) => /^--[a-z]+-\d+$/.test(name) && !name.startsWith("--chart"),
      );
    const roleNames = ROLE_NAMES.map((role) => `--${role}`);
    const changes: [string, () => Promise<unknown>, (after: Record<string, string>) => boolean][] =
      [
        [
          "harmony",
          () => select(page, "Harmony").selectOption("complementary"),
          (v) => v["--secondary-600"] !== base["--secondary-600"],
        ],
        [
          "chroma",
          () => radio(page, "Chroma", "vivid").check(),
          (v) => v["--primary-600"] !== base["--primary-600"],
        ],
        [
          "neutral tint",
          () => radio(page, "Neutral tint", "none").check(),
          (v) => v["--neutral-500"] !== base["--neutral-500"],
        ],
        [
          "contrast level",
          () => radio(page, "Contrast level", "AA+").check(),
          (v) => roleNames.some((name) => v[name] !== base[name]),
        ],
        [
          "gamut",
          () => radio(page, "Gamut", "Display P3").check(),
          (v) => scaleSteps(v).some(([name, value]) => base[name] !== value),
        ],
        [
          "scale mode",
          () => radio(page, "Scale mode", "even").check(),
          (v) => scaleSteps(v).some(([name, value]) => base[name] !== value),
        ],
        [
          "type context",
          () => select(page, "Type context").selectOption("dense"),
          (v) => v["--text-body"] !== base["--text-body"],
        ],
        [
          "radius",
          () => radio(page, "Radius", "sharp").check(),
          (v) => v["--radius-md"] !== base["--radius-md"],
        ],
        [
          "depth",
          () => radio(page, "Depth", "flat").check(),
          (v) => v["--shadow-2"] !== base["--shadow-2"],
        ],
        [
          "calm motion",
          () => radio(page, "Motion feel", "calm").check(),
          (v) => v["--duration-base"] !== base["--duration-base"],
        ],
        [
          "playful motion",
          () => radio(page, "Motion feel", "playful").check(),
          (v) => v["--spring-bounce"] !== base["--spring-bounce"],
        ],
      ];
    for (const [name, change, changed] of changes) {
      await changeDesign(page, async () => {
        await change();
      });
      expect(changed(await canvasVars(page)), name).toBe(true);
      await button(page, "Undo").click();
      await settled(page);
      expect(await canvasVars(page), `${name} undone`).toEqual(base);
    }
    // Density is a view setting: it changes the canvas without a new design.
    await panelRadio(page, "Density", "dense").check();
    await expect.poll(async () => (await canvasVars(page))["--control-height"]).toBe("32px");
  });

  test("F-INPUT-04 Pairing sets the display font, and Auto names the automatic pick", async ({
    page,
  }) => {
    await stubSeeds(page);
    await openStudio(page);
    const pairing = select(page, "Pairing");
    await expect(pairing.locator("option").first()).toHaveText(autoPairingLabel(seedOf(1)));
    const auto = (await canvasVars(page))["--font-display"];
    const other = PAIRINGS.find((item) => fontStack(item.display) !== auto);
    if (other === undefined) throw new Error("every pairing has the auto display face");
    await changeDesign(page, async () => {
      await pairing.selectOption({ label: other.label });
    });
    expect((await canvasVars(page))["--font-display"]).toBe(fontStack(other.display));
    await changeDesign(page, async () => {
      await pairing.selectOption({ label: autoPairingLabel(seedOf(1)) });
    });
    expect((await canvasVars(page))["--font-display"]).toBe(auto);
  });

  test("F-INPUT-05 a preset sets its controls, keeps locks and a higher level, sets the view and shows its notes", async ({
    page,
  }) => {
    const id = PRESET_IDS.find(
      (each) =>
        PRESETS[each].view.mode === "dark" &&
        PRESETS[each].params.contrastLevel !== "AAA" &&
        PRESETS[each].guards.length > 0 &&
        PRESETS[each].unexpressed.length > 0,
    );
    if (id === undefined) throw new Error("no dark preset with notes");
    const preset = PRESETS[id];
    await stubSeeds(page);
    await openStudio(page);
    await field(page, "Primary").fill("#1f6f5b");
    await field(page, "Primary").press("Tab");
    await settled(page);
    await changeDesign(page, () => radio(page, "Contrast level", "AAA").check());
    await changeDesign(page, async () => {
      await select(page, "Preset").selectOption({ label: preset.label });
    });
    await expect(select(page, "Preset").locator("option:checked")).toHaveText(preset.label);
    await expect(select(page, "Harmony")).toHaveValue(preset.params.harmony);
    await expect(radio(page, "Chroma", preset.params.chroma)).toBeChecked();
    await expect(radio(page, "Neutral tint", preset.params.neutralTint)).toBeChecked();
    await expect(radio(page, "Contrast level", "AAA")).toBeChecked();
    await expect(radio(page, "Scale mode", preset.params.scaleMode)).toBeChecked();
    await expect(select(page, "Type context")).toHaveValue(preset.params.type.context);
    await expect(radio(page, "Radius", preset.params.radius)).toBeChecked();
    await expect(radio(page, "Depth", preset.params.depth)).toBeChecked();
    await expect(radio(page, "Motion feel", preset.params.motion)).toBeChecked();
    await expect(panelRadio(page, "Density", preset.view.density)).toBeChecked();
    await expect(modeSwitch(page)).toHaveAttribute("aria-checked", "true");
    await expect(button(page, "Lock primary")).toHaveAttribute("aria-pressed", "true");
    await expect(field(page, "Primary")).toHaveValue("#1f6f5b");
    const notes = page.locator("#preset-notes");
    for (const note of [...preset.guards, ...preset.unexpressed]) {
      await expect(notes).toContainText(note);
    }
    await expect(select(page, "Preset")).toHaveAttribute("aria-describedby", "preset-notes");
  });

  test("F-INPUT-06 typing a hex and leaving the field locks the seed at that color", async ({
    page,
  }) => {
    await stubSeeds(page);
    await openStudio(page);
    await field(page, "Primary").fill("#1f6f5b");
    await field(page, "Primary").press("Tab");
    await expect(button(page, "Lock primary")).toHaveAttribute("aria-pressed", "true");
    const locked = { ...FRESH, primary: normalizeSeed(parseColor("#1f6f5b")) };
    await expect(lotId(page)).toHaveText(lotOf(designFor(locked, seedOf(1))));
    const vars = await canvasVars(page);
    expect(vars["--primary-600"]).toBe(
      designFor(locked, seedOf(1)).color.palettes.primary.light[6]?.hex,
    );
    expect(vars["--primary-600"]).toBe("#1f6f5b");
    const picked = await page.getByLabel("Pick primary", { exact: true }).inputValue();
    expect(nearHex(picked, "#1f6f5b")).toBe(true);
  });

  test("F-INPUT-07 the native color input sets the hex field and locks the seed", async ({
    page,
  }) => {
    await stubSeeds(page);
    await openStudio(page);
    await changeDesign(page, () =>
      pickColor(page.getByLabel("Pick secondary", { exact: true }), "#2a9d8f"),
    );
    await expect(field(page, "Secondary")).toHaveValue("#2a9d8f");
    await expect(button(page, "Lock secondary")).toHaveAttribute("aria-pressed", "true");
  });

  test("F-INPUT-07 a drag in the color input is one undo step (F-INPUT-15)", async ({ page }) => {
    await stubSeeds(page);
    await openStudio(page);
    // A drag: twelve picks 16 ms apart on the one input, as the picker sends them. Each pick through a
    // fresh label lookup scanned the whole page, so a busy machine spread the twelve past the 1 s window
    // (Task 2.10b: the filled inspector added about 3,000 elements to scan).
    const hexes = Array.from(
      { length: 12 },
      (_, i) => `#${(0x204060 + i * 0x0a0a02).toString(16)}`,
    );
    await page.getByLabel("Pick primary", { exact: true }).evaluate(async (input, values) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      for (const value of values) {
        setter?.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 16));
      }
    }, hexes);
    await settled(page);
    await expect(button(page, "Lock primary")).toHaveAttribute("aria-pressed", "true");
    await button(page, "Undo").click();
    await expect(lotId(page)).toHaveText(lotOf(first()));
    await expect(button(page, "Lock primary")).toHaveAttribute("aria-pressed", "false");
    await expect(button(page, "Undo")).toHaveAttribute("aria-disabled", "true");
  });

  test("F-INPUT-08 the lock toggle locks a seed at the color the palette holds, and unlocks", async ({
    page,
  }) => {
    await stubSeeds(page);
    await openStudio(page);
    const base = await canvasVars(page);
    for (const slot of ["secondary", "accent"] as const) {
      await changeDesign(page, () => button(page, `Lock ${slot}`).click());
      await expect(button(page, `Lock ${slot}`)).toHaveAttribute("aria-pressed", "true");
      // R2-17's promise: every role holds. A scale step may move onto the locked seed.
      expect(roleVars(await canvasVars(page))).toEqual(roleVars(base));
      await changeDesign(page, () => button(page, `Lock ${slot}`).click());
      await expect(button(page, `Lock ${slot}`)).toHaveAttribute("aria-pressed", "false");
      expect(await canvasVars(page)).toEqual(base);
    }
    await changeDesign(page, () => button(page, "Lock primary").click());
    // The primary role keeps its color within the bound of C-STORE-34.
    const primary = (vars: Record<string, string>) => parseColor(vars["--primary"] ?? "");
    expect(deltaEOK(primary(base), primary(await canvasVars(page)))).toBeLessThanOrEqual(0.0074);
    // After a lock, Space keeps the locked color (C-STORE-41).
    const held = lockSeed(first(), "primary");
    await focusBody(page);
    await page.keyboard.press("Space");
    await expect(lotId(page)).toHaveText(lotOf(designFor({ ...FRESH, primary: held }, seedOf(2))));
    await expect(button(page, "Lock primary")).toHaveAttribute("aria-pressed", "true");
    await expect(field(page, "Primary")).toHaveValue(
      seedRowHex(first(), { ...FRESH, primary: held }, "primary"),
    );
  });

  test("F-INPUT-09 an unreadable color shows a field message and leaves the canvas alone", async ({
    page,
  }) => {
    await openStudio(page);
    const before = await canvasVars(page);
    const lot = await lotId(page).textContent();
    const primary = field(page, "Primary");
    await primary.fill("banana");
    await primary.press("Tab");
    const message = page.getByText("Enter a color like #3a6ea5 or oklch(0.6 0.15 250).", {
      exact: true,
    });
    await expect(message).toBeVisible();
    await expect(primary).toHaveAttribute("aria-invalid", "true");
    const describedBy = (await primary.getAttribute("aria-describedby")) ?? "";
    expect(describedBy.split(" ")).toContain(await message.getAttribute("id"));
    await expect(button(page, "Lock primary")).toHaveAttribute("aria-pressed", "false");
    expect(await canvasVars(page)).toEqual(before);
    await expect(lotId(page)).toHaveText(lot ?? "");
  });

  test("F-INPUT-10 an unlocked seed shows the generated color as a placeholder and Auto", async ({
    page,
  }) => {
    await stubSeeds(page);
    await openStudio(page);
    for (const slot of ["primary", "secondary", "accent"] as const) {
      const name = `${slot[0]?.toUpperCase()}${slot.slice(1)}`;
      await expect(field(page, name)).toHaveValue("");
      await expect(field(page, name)).toHaveAttribute(
        "placeholder",
        seedRowHex(first(), FRESH, slot),
      );
      await expect(
        page.locator(`[data-seed-row="${slot}"]`).getByText("Auto", { exact: true }),
      ).toBeVisible();
    }
  });

  test("F-INPUT-11 Regenerate changes the unlocked colors and keeps the locked ones", async ({
    page,
  }) => {
    await stubSeeds(page);
    await openStudio(page);
    await changeDesign(page, () => button(page, "Lock accent").click());
    const held = lockSeed(first(), "accent");
    const accent = await field(page, "Accent").inputValue();
    await button(page, "Regenerate").click();
    const next = designFor({ ...FRESH, accent: held }, seedOf(2));
    await expect(lotId(page)).toHaveText(lotOf(next));
    await settled(page);
    expect(await canvasVars(page)).toEqual(expectedVars(next));
    await expect(field(page, "Accent")).toHaveValue(accent);
    await expect(field(page, "Primary")).not.toHaveAttribute(
      "placeholder",
      seedRowHex(first(), FRESH, "primary"),
    );
  });

  test("F-INPUT-12 the lot tag and the hex fields use Geist Mono with tabular numerals", async ({
    page,
  }) => {
    await openStudio(page);
    for (const locator of [lotId(page), field(page, "Primary"), field(page, "Accent")]) {
      const style = await locator.evaluate((el) => {
        const computed = getComputedStyle(el);
        return { family: computed.fontFamily, numeric: computed.fontVariantNumeric };
      });
      expect(style.family).toMatch(/Geist Mono/);
      expect(style.numeric).toContain("tabular-nums");
    }
  });

  test("F-INPUT-13 the studio has no slider", async ({ page }) => {
    await openStudio(page);
    await expect(page.locator("input[type='range'], [role='slider']")).toHaveCount(0);
  });

  test("F-INPUT-14 a preset turns to Custom when a control it owns changes, not for a seed or the mode", async ({
    page,
  }) => {
    await openStudio(page);
    const preset = select(page, "Preset");
    const editorial = PRESETS.editorial;
    await changeDesign(page, async () => {
      await preset.selectOption({ label: editorial.label });
    });
    await expect(page.locator("#preset-notes")).toBeVisible();
    await field(page, "Primary").fill("#3a6ea5");
    await changeDesign(page, () => field(page, "Primary").press("Tab"));
    await modeSwitch(page).click();
    await expect(preset.locator("option:checked")).toHaveText(editorial.label);
    const other = (["sharp", "soft", "round"] as const).find(
      (value) => value !== editorial.params.radius,
    );
    if (other === undefined) throw new Error("no other radius");
    await changeDesign(page, () => radio(page, "Radius", other).check());
    await expect(preset.locator("option:checked")).toHaveText("Custom");
    await expect(page.locator("#preset-notes")).toHaveCount(0);
  });

  test("F-INPUT-15 holding Space is one undo step", async ({ page }) => {
    await stubSeeds(page);
    await openStudio(page);
    await focusBody(page);
    const end = Date.now() + 1000;
    while (Date.now() < end) {
      await page.keyboard.down("Space");
      await page.waitForTimeout(40);
    }
    await page.keyboard.up("Space");
    await settled(page);
    await expect(lotId(page)).not.toHaveText(lotOf(first()));
    await focusBody(page);
    await page.keyboard.press("ArrowLeft");
    await expect(lotId(page)).toHaveText(lotOf(first()));
    await expect(button(page, "Undo")).toHaveAttribute("aria-disabled", "true");
  });
});

test.describe("7.3 Keyboard", () => {
  test("F-KEY-01 Space on the page body regenerates", async ({ page }) => {
    await stubSeeds(page);
    await openStudio(page);
    await focusBody(page);
    await page.keyboard.press("Space");
    await expect(lotId(page)).toHaveText(lotOf(designFor(FRESH, seedOf(2))));
  });

  test("F-KEY-02 holding Space leaves the canvas on the newest request's design", async ({
    page,
  }) => {
    await stubSeeds(page);
    await openStudio(page);
    await focusBody(page);
    const end = Date.now() + 1000;
    while (Date.now() < end) {
      await page.keyboard.down("Space");
      await page.waitForTimeout(30);
    }
    await page.keyboard.up("Space");
    const calls = await seedCalls(page);
    expect(calls).toBeGreaterThan(5);
    const newest = designFor(FRESH, seedOf(calls));
    await expect(lotId(page)).toHaveText(lotOf(newest), { timeout: 2000 });
    await settled(page);
    expect(await canvasVars(page)).toEqual(expectedVars(newest));
  });

  test("F-KEY-03 ← undoes and → redoes", async ({ page }) => {
    await stubSeeds(page);
    await openStudio(page);
    // Two changes without a coalesce key: two history entries. (Space presses within 1 s would
    // merge into one, R2-13 item 6.)
    const vivid = { ...FRESH, chroma: "vivid" } as const;
    const lots = [
      first(),
      designFor(vivid, seedOf(1)),
      designFor({ ...vivid, radius: "sharp" }, seedOf(1)),
    ].map(lotOf);
    await changeDesign(page, () => radio(page, "Chroma", "vivid").check());
    await changeDesign(page, () => radio(page, "Radius", "sharp").check());
    await expect(lotId(page)).toHaveText(lots[2] ?? "");
    await focusBody(page);
    for (const [key, lot] of [
      ["ArrowLeft", lots[1]],
      ["ArrowLeft", lots[0]],
      ["ArrowRight", lots[1]],
      ["ArrowRight", lots[2]],
    ] as const) {
      await page.keyboard.press(key);
      await expect(lotId(page)).toHaveText(lot ?? "");
    }
  });

  test("F-KEY-04 Alt+T flips the mode and adds no history entry", async ({ page }) => {
    await stubSeeds(page);
    await openStudio(page);
    await focusBody(page);
    await page.keyboard.press("Alt+KeyT");
    await expect(modeSwitch(page)).toHaveAttribute("aria-checked", "true");
    expect(await canvasVars(page)).toEqual(expectedVars(first(), "dark"));
    await expect(button(page, "Undo")).toHaveAttribute("aria-disabled", "true");
    await page.keyboard.press("Alt+KeyT");
    expect(await canvasVars(page)).toEqual(expectedVars(first(), "light"));
  });

  test("F-KEY-05 Mod+S copies the share link and keeps the save dialog shut", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await stubSeeds(page);
    await openStudio(page);
    await page.evaluate(() => {
      const record = window as unknown as { __saveBlocked: boolean | null };
      record.__saveBlocked = null;
      window.addEventListener("keydown", (event) => {
        if (event.code === "KeyS") record.__saveBlocked = event.defaultPrevented;
      });
    });
    await focusBody(page);
    await page.keyboard.press("ControlOrMeta+s");
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(linkUrl(new URL(page.url()).origin, first()));
    expect(
      await page.evaluate(() => (window as unknown as { __saveBlocked: boolean }).__saveBlocked),
    ).toBe(true);
  });

  test("F-KEY-06 L toggles the lock of the focused seed, and Alt+T is matched on the code", async ({
    page,
  }) => {
    await openStudio(page);
    await page.getByLabel("Pick primary", { exact: true }).focus();
    await changeDesign(page, () => page.keyboard.press("l"));
    await expect(button(page, "Lock primary")).toHaveAttribute("aria-pressed", "true");
    await button(page, "Lock secondary").focus();
    await changeDesign(page, () => page.keyboard.press("l"));
    await expect(button(page, "Lock secondary")).toHaveAttribute("aria-pressed", "true");
    // A layout where Alt changes the character: Option+T types "†" on a Mac.
    await focusBody(page);
    await page.evaluate(() => {
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { key: "†", code: "KeyT", altKey: true, bubbles: true }),
      );
    });
    await expect(modeSwitch(page)).toHaveAttribute("aria-checked", "true");
  });

  test("F-KEY-07 in the hex field and the harmony select the studio keys do nothing", async ({
    page,
  }) => {
    await stubSeeds(page);
    await openStudio(page);
    // A change first, so an undo or a redo would show.
    await button(page, "Regenerate").click();
    const lot = lotOf(designFor(FRESH, seedOf(2)));
    await expect(lotId(page)).toHaveText(lot);
    await settled(page);
    await field(page, "Primary").focus();
    await pressEachUnmoved(page, ["Space", "l", "ArrowLeft", "ArrowRight", "Alt+KeyT"]);
    await expect(field(page, "Primary")).toBeFocused();
    await select(page, "Harmony").focus();
    await pressEachUnmoved(page, ["Space", "Escape", "l", "Alt+KeyT"]);
    await page.waitForTimeout(400);
    await expect(lotId(page)).toHaveText(lot);
    await expect(modeSwitch(page)).toHaveAttribute("aria-checked", "false");
    await expect(button(page, "Lock primary")).toHaveAttribute("aria-pressed", "false");
    await expect(button(page, "Undo")).toHaveAttribute("aria-disabled", "false");
    await expect(button(page, "Redo")).toHaveAttribute("aria-disabled", "true");
    expect(await seedCalls(page)).toBe(2);
    await expect(select(page, "Harmony")).toHaveValue(FRESH.harmony);
  });

  // Chromium moves a closed select on ← and → by itself (analogous becomes monochrome), which is a
  // change of the design the browser makes. The studio's part is that the keys are not undo or redo.
  test("F-KEY-07 the arrows in the harmony select are not undo or redo", async ({ page }) => {
    await stubSeeds(page);
    await openStudio(page);
    await focusBody(page);
    await page.keyboard.press("Space");
    await expect(lotId(page)).toHaveText(lotOf(designFor(FRESH, seedOf(2))));
    await settled(page);
    await select(page, "Harmony").focus();
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(400);
    await settled(page);
    // An undo would bring back the first design and enable Redo.
    await expect(lotId(page)).not.toHaveText(lotOf(first()));
    await expect(button(page, "Redo")).toHaveAttribute("aria-disabled", "true");
    expect(await seedCalls(page)).toBe(2);
  });

  test("F-KEY-08 L in the primary hex field types an l and does not lock", async ({ page }) => {
    await openStudio(page);
    await field(page, "Primary").focus();
    await page.keyboard.press("l");
    await expect(field(page, "Primary")).toHaveValue("l");
    await page.waitForTimeout(300);
    await expect(button(page, "Lock primary")).toHaveAttribute("aria-pressed", "false");
  });

  test("F-KEY-09 Space on a button presses it, and the arrows on a radio group move the radio", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await stubSeeds(page);
    await openStudio(page);
    await button(page, "Copy link").focus();
    await page.keyboard.press("Space");
    await expect(page.getByRole("status").filter({ hasText: "Link copied" })).toBeVisible();
    expect(await seedCalls(page)).toBe(1);
    await expect(lotId(page)).toHaveText(lotOf(first()));
    await radio(page, "Chroma", "balanced").focus();
    await page.keyboard.press("ArrowRight");
    await expect(radio(page, "Chroma", "vivid")).toBeChecked();
    await expect(lotId(page)).toHaveText(
      lotOf(designFor({ ...FRESH, chroma: "vivid" }, seedOf(1))),
    );
    await settled(page);
    await page.keyboard.press("ArrowLeft");
    await expect(radio(page, "Chroma", "balanced")).toBeChecked();
    await expect(lotId(page)).toHaveText(lotOf(first()));
    // A new change, not an undo: there is nothing to redo.
    await expect(button(page, "Redo")).toHaveAttribute("aria-disabled", "true");
  });

  test("F-KEY-10 Escape closes a drawer, also from a text field in it", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await openStudio(page);
    const opener = button(page, "Inputs");
    await opener.click();
    await field(page, "Primary").focus();
    await page.keyboard.press("Escape");
    await expect(inputsAside(page)).toBeHidden();
    await expect(opener).toBeFocused();
  });

  /** Asserts the focused element shows the 2 px madder ring (F-A11Y-03). */
  async function expectRing(page: Page): Promise<void> {
    const ring = await page.evaluate(() => {
      const style = getComputedStyle(document.activeElement as Element);
      return [style.outlineStyle, style.outlineWidth, style.outlineColor];
    });
    expect(ring).toEqual(["solid", "2px", MADDER]);
  }

  /**
   * The Tab stops of the inputs panel, in the order of section 7.2, with the Brief and Image
   * sections' stops after About and the Steer section's after "Motion feel" (docs/specs/04-ai.md,
   * 13.7; section 16), AI settings closed.
   */
  function panelStops(page: Page) {
    return [
      field(page, "Name"),
      field(page, "One line"),
      button(page, "Import…"),
      field(page, "Describe the product or mood"),
      button(page, "Read the brief"),
      button(page, "AI settings"),
      inputsPanel(page).getByLabel("Choose an image", { exact: true }),
      button(page, "Read the vibe"),
      ...(["Primary", "Secondary", "Accent"] as const).flatMap((slot) => [
        field(page, slot),
        page.getByLabel(`Pick ${slot.toLowerCase()}`, { exact: true }),
        button(page, `Lock ${slot.toLowerCase()}`),
      ]),
      select(page, "Harmony"),
      radio(page, "Chroma", "balanced"),
      radio(page, "Neutral tint", "brand"),
      radio(page, "Contrast level", "AA"),
      radio(page, "Gamut", "sRGB"),
      radio(page, "Scale mode", "standard"),
      select(page, "Preset"),
      select(page, "Pairing"),
      select(page, "Type context"),
      radio(page, "Radius", "soft"),
      radio(page, "Depth", "soft"),
      panelRadio(page, "Density", "comfortable"),
      radio(page, "Motion feel", "brisk"),
      page.getByRole("link", { name: "Edit in the motion lab", exact: true }),
      ...["Warmer", "Cooler", "Bolder", "Quieter", "Softer", "Sharper", "Airier"].map((name) =>
        button(page, name),
      ),
      field(page, "Refine in words"),
      button(page, "Refine"),
      button(page, "Regenerate"),
    ];
  }

  /** The Tab stops of the canvas toolbar after its drawer buttons, in the order of section 7.1. */
  function toolbarStops(page: Page) {
    return [
      toolbarRadio(page, "Frame", "1280"),
      select(page, "Template"),
      modeSwitch(page),
      toolbarRadio(page, "Density", "comfortable"),
      page.getByRole("switch", { name: "Reduce motion", exact: true }),
      toolbarRadio(page, "Copy", "Real copy"),
      toolbarRadio(page, "Vision", "none"),
      button(page, "Undo"),
      button(page, "Redo"),
      button(page, "Copy link"),
      button(page, "Export"),
      button(page, "Flavor"),
    ];
  }

  test("F-KEY-11 Tab follows the DOM order and every chrome control shows the madder ring", async ({
    page,
  }) => {
    await stubSeeds(page);
    await openStudio(page);
    // The inspector follows the canvas: its scroll area, then each finding's actions (Task 2.10b),
    // with "Explain the top findings" before the cards and "Write the rationale" after the Receipt
    // section (13.7 and section 16 of docs/specs/04-ai.md, Task 4.11).
    const findings = lintSpec(first()).map(findingKey);
    expect(findings.length).toBeGreaterThan(0);
    const stops = [
      page.getByRole("link", { name: "Skip to canvas", exact: true }),
      page.getByRole("link", { name: "dyelot", exact: true }),
      ...panelStops(page),
      ...toolbarStops(page),
      canvasRegion(page),
    ];
    const inspectorStops = [
      inspectorAside(page).locator("[data-scroll-area]"),
      // Each Scales palette is one stop, its focused step's button, then the link to the explorer
      // (13.7, 13.8 and section 16 of docs/specs/05-motion-3d.md).
      ...PALETTE_NAMES.map((name) =>
        inspectorAside(page).locator(
          `[data-palette="${name}"] button[data-step-button][tabindex="0"]`,
        ),
      ),
      inspectorAside(page).getByRole("link", {
        name: "See these scales in the explorer",
        exact: true,
      }),
      inspectorAside(page).getByRole("button", { name: "Explain the top findings", exact: true }),
      ...findings.map((key) =>
        inspectorAside(page)
          .locator(`[data-finding="${key}"]`)
          .getByRole("button", { name: "Show me", exact: true }),
      ),
      inspectorAside(page).getByRole("button", { name: "Write the rationale", exact: true }),
    ];
    await focusBody(page);
    for (const stop of stops) {
      await page.keyboard.press("Tab");
      await expect(stop).toBeFocused();
      await expectRing(page);
    }
    // The canvas's own controls come next (their ring is the spec's --ring, R2-30); the inspector after.
    const inCanvas = () =>
      page.evaluate(() => document.activeElement?.closest("[data-canvas-region]") != null);
    for (let presses = 0; presses < 200; presses++) {
      await page.keyboard.press("Tab");
      if (!(await inCanvas())) break;
    }
    for (const [i, stop] of inspectorStops.entries()) {
      if (i > 0) await page.keyboard.press("Tab");
      await expect(stop).toBeFocused();
      await expectRing(page);
    }
  });

  test("F-KEY-12 at 360 px the drawers open from the keyboard and every control is reachable", async ({
    page,
  }) => {
    await page.setViewportSize(PHONE);
    await openStudio(page);
    // Below 640 px the five view controls sit in the closed "View" disclosure (F-CANVAS-19).
    const toolbar = [
      button(page, "Inputs"),
      button(page, "Inspector"),
      toolbarRadio(page, "Frame", "1280"),
      select(page, "Template"),
      button(page, "View"),
      button(page, "Undo"),
      button(page, "Redo"),
      button(page, "Copy link"),
      button(page, "Export"),
      button(page, "Flavor"),
      canvasRegion(page),
    ];
    await focusBody(page);
    for (const stop of [
      page.getByRole("link", { name: "Skip to canvas", exact: true }),
      page.getByRole("link", { name: "dyelot", exact: true }),
      ...toolbar,
    ]) {
      await page.keyboard.press("Tab");
      await expect(stop).toBeFocused();
    }
    await button(page, "Inputs").focus();
    await page.keyboard.press("Enter");
    await expect(inputsAside(page).getByRole("heading", { name: "Inputs" })).toBeFocused();
    for (const stop of [button(page, "Close inputs"), ...panelStops(page)]) {
      await page.keyboard.press("Tab");
      await expect(stop).toBeFocused();
      await expectRing(page);
    }
    await page.keyboard.press("Escape");
    await expect(button(page, "Inputs")).toBeFocused();
    await button(page, "Inspector").focus();
    await page.keyboard.press("Space");
    await expect(inspectorAside(page).getByRole("heading", { name: "Inspector" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(button(page, "Close inspector")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(inspectorAside(page)).toBeHidden();
    await expect(button(page, "Inspector")).toBeFocused();
  });

  test("F-KEY-13 inside the canvas the keys stay with the preview", async ({ page }) => {
    await stubSeeds(page);
    await openStudio(page);
    // A change first, so an undo or a redo would show.
    await button(page, "Regenerate").click();
    const lot = lotOf(designFor(FRESH, seedOf(2)));
    await expect(lotId(page)).toHaveText(lot);
    await settled(page);
    // The kitchen sink's own controls: a checkbox, marked as a seed control so that L would lock
    // primary if the canvas did not keep its keys, and the kit's tab list.
    await select(page, "Template").selectOption("kitchen-sink");
    const light = canvasPane(page, "light");
    const box = light.locator('[data-kit="checkbox"][data-state="default"]');
    await box.evaluate((element) => element.setAttribute("data-seed-slot", "primary"));
    await box.focus();
    await page.keyboard.press("Space");
    await expect(box).toBeChecked();
    const tabs = light.locator('[data-kit-demo="tabs"]').getByRole("tab");
    await tabs.first().focus();
    await page.keyboard.press("ArrowRight");
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(tabs.nth(1)).toBeFocused();
    for (const target of [box, tabs.nth(1), canvasRegion(page)]) {
      await target.focus();
      await pressEachUnmoved(page, ["Space", "ArrowLeft", "ArrowRight", "l", "Alt+KeyT"]);
    }
    await page.waitForTimeout(400);
    expect(await seedCalls(page)).toBe(2);
    await expect(lotId(page)).toHaveText(lot);
    await expect(modeSwitch(page)).toHaveAttribute("aria-checked", "false");
    await expect(button(page, "Lock primary")).toHaveAttribute("aria-pressed", "false");
    await expect(button(page, "Undo")).toHaveAttribute("aria-disabled", "false");
    await expect(button(page, "Redo")).toHaveAttribute("aria-disabled", "true");
  });

  test("F-KEY-14 a keydown that is a plain Event raises nothing", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await stubSeeds(page);
    await openStudio(page);
    await page.evaluate(() => {
      document.body.dispatchEvent(new Event("keydown", { bubbles: true }));
    });
    await page.waitForTimeout(200);
    expect(errors).toEqual([]);
    expect(await seedCalls(page)).toBe(1);
  });
});

/** The first design with the light primary's step 100 equal to its step 50: K1 and K2 there. */
function stepLink(): string {
  const spec = structuredClone(first());
  const [fifty] = spec.color.palettes.primary.light;
  (spec.color.palettes.primary.light as unknown as unknown[])[1] = { ...fifty, step: 100 };
  return `#s=${encodeSpec(normalizeSpec(spec))}`;
}

/** The "Show me" of the step fixture's K1 finding, which outlines two scale cells. */
const stepShowMe = (page: Page) =>
  inspectorAside(page)
    .locator('[data-finding="K1 light primary-50/primary-100"]')
    .getByRole("button", { name: "Show me", exact: true });

/** F-A11Y-04's scan: the whole body but the canvas. */
const CHROME = { root: "body", skip: ["[data-canvas]"] } as const;

test.describe("7.9 Accessibility", () => {
  test("F-A11Y-01 axe finds no violation at 1280 px and with each drawer open at 360 px", async ({
    page,
  }) => {
    // Seven full-page axe runs over the filled inspector: about 5 s each under the full suite.
    test.setTimeout(120_000);
    await openStudio(page, stepLink());
    await expect(inspectorAside(page).locator("[data-finding]").first()).toBeVisible();
    // Each axe run reads the canvas at rest: the landing's entrance fades its hero in, and a mode
    // switch runs the kit's color transitions (final review, I-1).
    await canvasAtRest(page);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    // The inspector filled, with a highlight shown, in both canvas modes (Task 2.10b).
    await stepShowMe(page).click();
    for (const mode of ["light", "dark"] as const) {
      if (mode === "dark") await modeSwitch(page).click();
      await expect(canvasFrame(page)).toHaveAttribute("data-mode", mode);
      await canvasAtRest(page);
      expect((await new AxeBuilder({ page }).analyze()).violations, mode).toEqual([]);
    }
    await page.setViewportSize(PHONE);
    // Below 640 px the mode switch sits in the closed View disclosure: Alt+T flips the mode.
    for (const mode of ["dark", "light"] as const) {
      if (mode === "light") {
        await focusBody(page);
        await page.keyboard.press("Alt+KeyT");
      }
      await expect(canvasFrame(page)).toHaveAttribute("data-mode", mode);
      for (const name of ["Inputs", "Inspector"]) {
        await button(page, name).click();
        await expect(page.getByRole("heading", { name, exact: true })).toBeFocused();
        await canvasAtRest(page);
        expect((await new AxeBuilder({ page }).analyze()).violations, `${name} ${mode}`).toEqual(
          [],
        );
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          360,
        );
        await page.keyboard.press("Escape");
      }
    }
  });

  test("F-A11Y-01 axe finds no violation with the banner shown", async ({ page }) => {
    await openStudio(page, `#s=${tampered(encodeSpec(designFor(FRESH, "e2e-link")))}`);
    await expect(banner(page)).toBeVisible();
    // Read at rest, after the landing's entrance (final review, I-1).
    await canvasAtRest(page);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });

  test("F-A11Y-02 every chrome control has a hit area of at least 24 × 24 px", async ({ page }) => {
    for (const [viewport, drawer] of [
      [{ width: 1280, height: 800 }, false],
      [PHONE, false],
      [PHONE, true],
    ] as const) {
      await page.setViewportSize(viewport);
      // The same link again is a same-document navigation: leave the page first.
      await page.goto("about:blank");
      await openStudio(page, stepLink());
      if (drawer) {
        await button(page, "Inspector").click();
        await expect(inspectorAside(page)).toBeVisible();
      }
      const small = await page.evaluate(() =>
        [...document.querySelectorAll("a[href], button, input, select, textarea, [tabindex='0']")]
          .filter((el) => !el.closest("[data-canvas], [inert]"))
          .map((el) => ({ el, box: el.getBoundingClientRect() }))
          .filter(({ box }) => box.width > 1 && box.height > 1)
          .filter(({ box }) => box.width < 24 || box.height < 24)
          .map(({ el, box }) => `${el.outerHTML.slice(0, 80)} ${box.width}×${box.height}`),
      );
      expect(small, `${viewport.width} px${drawer ? ", inspector drawer" : ""}`).toEqual([]);
    }
  });

  test("F-A11Y-04 the chrome stays achromatic apart from madder where it belongs and the swatches", async ({
    page,
  }) => {
    await openStudio(page, stepLink());
    // A step finding's cells carry the "show me" outline in the inspector (Task 2.10b).
    await stepShowMe(page).click();
    await expect(inspectorAside(page).locator("[data-show-me-cell]")).toHaveCount(2);
    for (const mode of ["light", "dark"] as const) {
      if (mode === "dark") await modeSwitch(page).click();
      await expect(canvasFrame(page)).toHaveAttribute("data-mode", mode);
      await radio(page, "Chroma", "vivid").focus();
      const report = await chromaOffenders(page, CHROME);
      expect(report.exempted, mode).toBeGreaterThan(0);
      expect(report.problems, mode).toEqual([]);
    }
    // The outline's exemption is that narrow: madder text on a highlighted cell, and a madder outline
    // on a cell that is not highlighted, are each reported.
    await page.evaluate(() => {
      const lit = document.querySelector<HTMLElement>("[data-show-me-cell]");
      const plain = document.querySelector<HTMLElement>("[data-step]:not([data-show-me-cell])");
      if (lit === null || plain === null) throw new Error("no cells to probe");
      lit.dataset.probe = "";
      lit.style.color = "#f66c6d";
      plain.dataset.probe = "";
      plain.style.outline = "2px dashed #f66c6d";
    });
    const probed = (await chromaOffenders(page, CHROME)).problems;
    expect(probed.filter((problem) => problem.startsWith("li [probe] color"))).toHaveLength(1);
    expect(probed.filter((problem) => problem.startsWith("li [probe] outline"))).toHaveLength(1);
    expect(probed.every((problem) => problem.includes("[probe]"))).toBe(true);
    await page.reload();
    await ready(page);
    // At 360 px with the inspector drawer open, in both canvas modes.
    await page.setViewportSize(PHONE);
    for (const mode of ["light", "dark"] as const) {
      if (mode === "dark") {
        await focusBody(page);
        await page.keyboard.press("Alt+KeyT");
      }
      await expect(canvasFrame(page)).toHaveAttribute("data-mode", mode);
      await button(page, "Inspector").click();
      await expect(inspectorAside(page)).toBeVisible();
      const report = await chromaOffenders(page, CHROME);
      expect(report.problems, `360 ${mode}`).toEqual([]);
      await page.keyboard.press("Escape");
    }
  });

  test("F-A11Y-08 the studio surround keeps the dot grid without the madder crown", async ({
    page,
  }) => {
    const stops = () =>
      page.evaluate((script) => {
        const chroma = new Function(`return (${script})`)() as (rgb: number[]) => number;
        const image = getComputedStyle(document.body, "::before").backgroundImage;
        return [...image.matchAll(/rgba?\(([^)]+)\)/g)].map((match) => {
          const [r = 0, g = 0, b = 0] = (match[1] ?? "").split(/[ ,/]+/).map(Number);
          return { color: match[0], chroma: chroma([r, g, b]) };
        });
      }, chromaScript().toString());
    await openStudio(page);
    const studio = await stops();
    expect(studio.length).toBeGreaterThan(0);
    expect(studio.filter((stop) => stop.chroma > 0.005)).toEqual([]);
    // The home page keeps its crown.
    await page.goto("/");
    expect((await stops()).some((stop) => stop.chroma > 0.1)).toBe(true);
  });

  /**
   * The form controls of the chrome that are on screen, each with its border color and the opaque
   * background it sits on (F-A11Y-09).
   */
  function controlEdges(page: Page) {
    return page.evaluate(() => {
      const rgba = (color: string): [number, number, number, number] => {
        const [r = 0, g = 0, b = 0, a = 1] = (color.match(/[\d.]+/g) ?? []).map(Number);
        return [r, g, b, color.startsWith("rgba") ? a : 1];
      };
      // The color behind `el`: every partly transparent layer up to the first opaque one,
      // composited over it (source-over), so a tinted wash counts at its real strength.
      const backdrop = (el: Element): string => {
        const layers: [number, number, number, number][] = [];
        let base: [number, number, number] = [10, 10, 10];
        for (let node = el.parentElement; node !== null; node = node.parentElement) {
          const layer = rgba(getComputedStyle(node).backgroundColor);
          if (layer[3] >= 1) {
            base = [layer[0], layer[1], layer[2]];
            break;
          }
          if (layer[3] > 0) layers.push(layer);
        }
        for (const [r, g, b, a] of layers.reverse()) {
          base = [r * a + base[0] * (1 - a), g * a + base[1] * (1 - a), b * a + base[2] * (1 - a)];
        }
        return `rgb(${base.map((v) => Math.round(v)).join(", ")})`;
      };
      const selector = [
        "input:not([type='radio'])",
        "select",
        "fieldset > div",
        "button[aria-pressed]",
        "[role='switch'] > span:first-child",
      ].join(", ");
      return [...document.querySelectorAll(selector)]
        .filter((el) => !el.closest("[data-canvas], [inert]"))
        .filter((el) => {
          const box = el.getBoundingClientRect();
          return box.width > 1 && box.height > 1;
        })
        .map((el) => {
          const style = getComputedStyle(el);
          return {
            control: `${el.tagName.toLowerCase()} ${el.getAttribute("aria-label") ?? el.closest("fieldset")?.querySelector("legend")?.textContent ?? el.id}`,
            width: Number.parseFloat(style.borderTopWidth),
            edge: style.borderTopColor,
            backdrop: backdrop(el),
          };
        });
    });
  }

  /** The WCAG contrast of two computed colors, resolved in the page and measured by the engine. */
  async function contrast(page: Page, a: string, b: string): Promise<number> {
    const [x, y] = await resolveColors(page, [a, b]);
    if (x === null || y === null) throw new Error(`contrast: unreadable ${a} or ${b}`);
    const rgb = (color: readonly number[]) =>
      [(color[0] ?? 0) / 255, (color[1] ?? 0) / 255, (color[2] ?? 0) / 255] as const;
    return wcagRatio(rgb(x), rgb(y));
  }

  test("F-A11Y-09 every form control's edge meets 3:1 against what it sits on", async ({
    page,
  }) => {
    const weak = async () => {
      const rated = await Promise.all(
        (await controlEdges(page)).map(async (item) => ({
          ...item,
          ratio: await contrast(page, item.edge, item.backdrop),
        })),
      );
      return rated.filter((item) => item.width <= 0 || item.ratio < 3);
    };
    await openStudio(page);
    const wide = await controlEdges(page);
    // Three seed rows of three, four selects, nine groups and the switch's track.
    expect(wide.length).toBeGreaterThanOrEqual(23);
    expect(await weak(), "1280 px").toEqual([]);
    await page.setViewportSize(PHONE);
    expect(await weak(), "360 px").toEqual([]);
    await button(page, "Inputs").click();
    await expect(inputsAside(page)).toBeVisible();
    expect((await controlEdges(page)).length).toBeGreaterThanOrEqual(22);
    expect(await weak(), "360 px, inputs drawer").toEqual([]);
  });

  test("F-A11Y-05 at 360 px no route scrolls sideways", async ({ page }) => {
    await page.setViewportSize(PHONE);
    // Every route the app serves: the home page, the studio and the not-found page.
    for (const route of ["/", "/studio", "/no-such-page"]) {
      await page.goto(route);
      if (route === "/studio") await ready(page);
      const sideways = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(sideways, route).toBeLessThanOrEqual(0);
    }
  });

  test("F-A11Y-06 with reduced motion the drawers and toasts move in 0.01 ms or less", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize(PHONE);
    await openStudio(page);
    await button(page, "Inputs").click();
    // The drawer shows at once, so its heading takes focus (Task 2.10b).
    await expect(inputsAside(page).getByRole("heading", { name: "Inputs" })).toBeFocused();
    const durations = await page.evaluate(() =>
      [...document.querySelectorAll("aside, [data-toast]")].flatMap((el) =>
        getComputedStyle(el)
          .transitionDuration.split(",")
          .map((value) => Number.parseFloat(value) * (value.trim().endsWith("ms") ? 1 : 1000)),
      ),
    );
    expect(durations.length).toBeGreaterThan(0);
    // 0.01 ms, read back as "1e-05s", with room for the float product.
    for (const ms of durations) expect(ms).toBeLessThanOrEqual(0.01 + 1e-9);
  });
});
