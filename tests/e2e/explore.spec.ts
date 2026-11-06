import { test as base, expect, type Locator, type Page } from "@playwright/test";
import { gamutSlice, generateSystem, type Mode, type SolidGamut } from "@/engine";
import { SITE } from "@/lib/site/config";
import { type DesignSpec, encodeSpec } from "@/spec";
import { DEFAULT_PARAMS } from "../unit/spec/support";
import { LINK, SPEC } from "./export-support";
import { NO_RENDERER } from "./flavor-support";
import { lotId, lotOf, openStudio, ready } from "./studio-support";

// Playwright does not read the `?raw` query some engine files import: the hook makes it the text.
await import("./raw-hooks.mjs");
const { defaultDesign } = await import("@/features/landing/heroes");
const { EXPLORE_LINES, scenePoints, sceneSummary, sliceSteps } = await import(
  "@/features/explore/scene"
);

// The explorer's flows of docs/specs/05-motion-3d.md, section 14.11 (R5-35 to R5-40, 8.1 to 8.4):
// F-EXP5-01 to 10 and F-EXP5-RF2 (Task 5.6b). What the page must show is computed here in Node.
// Every flow fails on a `securitypolicyviolation` event, a console error or a page error, except
// the reports F-EXP5-10 allows (14.11).

// Stand-ins for three helpers of tests/e2e/flavor-support.ts whose owners have not landed on this
// lane's base: `NO_WEBGL` (Task 5.5b), `ABORT_CHUNK` (Task 5.7b) and `loseContext` (Task 5.9b).
// Each has its owner's name and contract (section 4); the rebase onto those tasks replaces this
// block with imports from ./flavor-support.

/** `NO_WEBGL`: `getContext` gives null for any `webgl` type (section 4). */
async function NO_WEBGL(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function getContext(
      this: HTMLCanvasElement,
      type: string,
      ...rest: unknown[]
    ) {
      if (/webgl/.test(type)) return null;
      return (original as (...args: unknown[]) => RenderingContext | null).call(
        this,
        type,
        ...rest,
      );
    } as typeof original;
  });
}

/** `ABORT_CHUNK`: aborts the chunk whose text holds `marker` until `release()` (section 4). */
async function ABORT_CHUNK(page: Page, marker: string): Promise<{ release(): void }> {
  let released = false;
  await page.route("**/_next/static/chunks/*.js", async (route) => {
    if (released) {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const text = await response.text();
    if (text.includes(marker)) {
      await route.abort("failed");
      return;
    }
    await route.fulfill({ response, body: text });
  });
  return {
    release() {
      released = true;
    },
  };
}

/** `loseContext`: `WEBGL_lose_context.loseContext()` on the canvas at `selector` (section 4). */
async function loseContext(page: Page, selector: string): Promise<void> {
  await page.evaluate((target) => {
    const canvas = document.querySelector(target);
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error(`loseContext: no canvas matches ${target}`);
    }
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    const extension = gl?.getExtension("WEBGL_lose_context") ?? null;
    if (extension === null) throw new Error(`loseContext: no WebGL context on ${target}`);
    extension.loseContext();
  }, selector);
}

/**
 * Each flow records, before the page's scripts run, every policy violation, console error and page
 * error, and fails at its end on any that `allow` did not name. `allow(pattern, count)` admits
 * exactly `count` console errors whose text matches `pattern`: fewer or more fail the flow too.
 */
type Watch = { allow(pattern: RegExp, count: number): void };

const test = base.extend<{ watch: Watch }>({
  watch: [
    async ({ page }, use) => {
      const errors: string[] = [];
      const pages: string[] = [];
      const allowed: { pattern: RegExp; count: number }[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      page.on("pageerror", (error) => pages.push(error.message));
      await page.addInitScript(() => {
        const host = window as unknown as { __violations: string[] };
        host.__violations = [];
        document.addEventListener(
          "securitypolicyviolation",
          (event) => host.__violations.push(`${event.violatedDirective} ${event.blockedURI}`),
          true,
        );
      });
      await use({ allow: (pattern, count) => void allowed.push({ pattern, count }) });
      const violations = await page.evaluate(
        () => (window as unknown as { __violations?: string[] }).__violations ?? [],
      );
      const counts = allowed.map(
        ({ pattern }) => errors.filter((text) => pattern.test(text)).length,
      );
      const unexpected = errors.filter(
        (text) => !allowed.some(({ pattern }) => pattern.test(text)),
      );
      expect({
        console: unexpected,
        allowed: counts,
        page: pages,
        violations,
      }).toEqual({
        console: [],
        allowed: allowed.map(({ count }) => count),
        page: [],
        violations: [],
      });
    },
    { auto: true },
  ],
});

test.use({ viewport: { width: 1280, height: 800 } });

const DEFAULT = defaultDesign();
const PANEL = "[data-explorer]";

const panel = (page: Page): Locator => page.locator(PANEL);
const flatView = (page: Page): Locator => page.locator("figure[data-flat-view]");
const summary = (page: Page): Locator => page.locator("[data-explorer-summary]");
const notice = (page: Page): Locator => page.locator("[data-explore-notice]");
const slider = (page: Page, name: string): Locator =>
  page.getByRole("slider", { name, exact: true });
const radio = (page: Page, name: string): Locator => page.getByRole("radio", { name, exact: true });
const stepList = (page: Page): Locator =>
  flatView(page).getByRole("list", { name: "Steps near this lightness", exact: true });

async function openExplorer(page: Page, hash = ""): Promise<void> {
  const response = await page.goto(`/explore${hash}`);
  expect(response?.status()).toBe(200);
  await expect(panel(page)).toBeAttached();
}

/** Waits for the 3D view: the panel reads `3d` and holds one canvas. */
async function in3d(page: Page): Promise<void> {
  await expect(panel(page)).toHaveAttribute("data-explorer-state", "3d");
  await expect(panel(page).locator("canvas")).toHaveCount(1);
}

/** Moves a slider by `steps` presses of an arrow key (negative: ArrowLeft). */
async function nudge(page: Page, name: string, steps: number): Promise<void> {
  await slider(page, name).focus();
  const key = steps < 0 ? "ArrowLeft" : "ArrowRight";
  for (let i = 0; i < Math.abs(steps); i++) await page.keyboard.press(key);
}

/** The lightness slider moved from its start, 0.60, to `l` (2 decimals) by the keyboard. */
const slideTo = (page: Page, l: number): Promise<void> =>
  nudge(page, "Lightness slice", Math.round(l * 100) - 60);

/** 8.3's list item of one step. */
function stepItem(point: ReturnType<typeof scenePoints>[number]): string {
  const { l, c, h } = point.oklch;
  const hue = h === null ? "none" : String(Math.round(h));
  return `${point.palette} ${point.step} · ${point.hex} · L ${l.toFixed(2)} · C ${c.toFixed(3)} · H ${hue}`;
}

/** 8.3's caption at `l`, with the count of steps near it. */
const caption = (count: number, l: number): string =>
  `At L ${l.toFixed(2)}: how far each gamut reaches at every hue, and the ${count} steps within 0.04 of that lightness.`;

/** The flat view's slice of `spec` in `mode` at `l`, as Node computes it. */
const near = (spec: DesignSpec, mode: Mode, l: number) => sliceSteps(scenePoints(spec, mode), l);

/** The fills of the flat view's dots, in DOM order. */
const dotFills = (page: Page): Promise<string[]> =>
  flatView(page)
    .locator("circle[data-dot]")
    .evaluateAll((dots) => dots.map((dot) => dot.getAttribute("fill") ?? ""));

test.describe("the explorer", () => {
  // Breaks when the page stops drawing the default design in 3D with its counts, or loses 8.1's
  // metadata, heading or flat view.
  test("F-EXP5-01 /explore draws the default design in 3D with its counts, summary and flat view", async ({
    page,
  }) => {
    await openExplorer(page);
    await expect(page).toHaveTitle("Explorer — dyelot");
    await expect(page.locator('head meta[name="description"]')).toHaveAttribute(
      "content",
      "See a palette in OKLab: the sRGB, Display P3 and Rec. 2020 gamut solids, every step as a point, each scale as a tube, and a lightness slice.",
    );
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
      "href",
      `${SITE.url}/explore`,
    );
    await expect(
      page.getByRole("heading", { level: 1, name: "The palette in OKLab", exact: true }),
    ).toBeVisible();
    await in3d(page);
    const shown = panel(page);
    await expect(shown).toHaveAttribute("data-points", "88");
    await expect(shown).toHaveAttribute("data-tubes", "8");
    await expect(shown).toHaveAttribute("data-solid-vertices", "6534");
    await expect(shown).toHaveAttribute("data-gamut", "srgb");
    await expect(shown).toHaveAttribute("data-slice", "0.60");
    await expect(shown).toHaveAttribute("data-mode", "light");
    await expect(shown).not.toHaveAttribute("data-explorer-reason");
    expect(DEFAULT.meta.name).toBe("Madder");
    await expect(summary(page)).toHaveText(sceneSummary("Madder", "light", "srgb", 0.6));
    const outlines = flatView(page).locator("svg path[data-outline]");
    await expect(outlines).toHaveCount(3);
    expect(
      await outlines.evaluateAll((paths) => paths.map((path) => path.getAttribute("data-outline"))),
    ).toEqual(["srgb", "p3", "rec2020"]);
    await expect(radio(page, "sRGB")).toBeChecked();
    await expect(radio(page, "Light")).toBeChecked();
  });

  // Breaks when a gamut, the slice or the mode stops reaching the 3D view's attributes, its
  // summary or the flat view.
  test("F-EXP5-02 the gamut, the slice and the mode set the view, the summary and the flat view", async ({
    page,
  }) => {
    await openExplorer(page);
    await in3d(page);
    for (const [label, gamut] of [
      ["Display P3", "p3"],
      ["Rec. 2020", "rec2020"],
    ] as const satisfies readonly (readonly [string, SolidGamut])[]) {
      await radio(page, label).check();
      await expect(panel(page)).toHaveAttribute("data-gamut", gamut);
      await expect(summary(page)).toHaveText(sceneSummary("Madder", "light", gamut, 0.6));
    }
    await slideTo(page, 0.45);
    await expect(panel(page)).toHaveAttribute("data-slice", "0.45");
    await expect(slider(page, "Lightness slice")).toHaveAttribute("aria-valuetext", "L 0.45");
    const light = near(DEFAULT, "light", 0.45);
    expect(light.length).toBeGreaterThan(0);
    await expect(flatView(page).locator("figcaption")).toHaveText(caption(light.length, 0.45));
    await expect(stepList(page).getByRole("listitem")).toHaveText(light.map(stepItem));
    await expect(summary(page)).toHaveText(sceneSummary("Madder", "light", "rec2020", 0.45));
    await radio(page, "Dark").check();
    await expect(panel(page)).toHaveAttribute("data-mode", "dark");
    const dark = near(DEFAULT, "dark", 0.45);
    expect(dark.length).toBeGreaterThan(0);
    await expect.poll(() => dotFills(page)).toEqual(dark.map((point) => point.hex));
    await expect(stepList(page).getByRole("listitem")).toHaveText(dark.map(stepItem));
    await expect(summary(page)).toHaveText(sceneSummary("Madder", "dark", "rec2020", 0.45));
  });

  // Breaks when the keyboard's sliders stop moving the camera's values, "Reset view" stops
  // restoring them, or a pointer drag stops writing the turn back to the slider.
  test("F-EXP5-03 Turn, Tilt, Zoom and Reset view by keyboard, and a drag writes the turn back", async ({
    page,
  }) => {
    await openExplorer(page);
    await in3d(page);
    await nudge(page, "Turn", 10);
    await expect(panel(page)).toHaveAttribute("data-turn", "45");
    await expect(slider(page, "Turn")).toHaveAttribute("aria-valuetext", "45°");
    await slider(page, "Tilt").focus();
    await page.keyboard.press("End");
    await expect(panel(page)).toHaveAttribute("data-tilt", "90");
    await slider(page, "Zoom").focus();
    await page.keyboard.press("Home");
    await expect(panel(page)).toHaveAttribute("data-zoom", "0.50");
    await expect(slider(page, "Zoom")).toHaveAttribute("aria-valuetext", "0.50×");
    await page.getByRole("button", { name: "Reset view", exact: true }).click();
    await expect(panel(page)).toHaveAttribute("data-turn", "35");
    await expect(panel(page)).toHaveAttribute("data-tilt", "25");
    await expect(panel(page)).toHaveAttribute("data-zoom", "1.00");
    await expect(slider(page, "Turn")).toHaveValue("35");
    await expect(slider(page, "Tilt")).toHaveValue("25");
    await expect(slider(page, "Zoom")).toHaveValue("1");

    const canvas = panel(page).locator("canvas");
    await canvas.scrollIntoViewIfNeeded();
    const box = await canvas.boundingBox();
    if (box === null) throw new Error("F-EXP5-03: the canvas has no box");
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 160, y, { steps: 8 });
    await page.mouse.up();
    await expect(panel(page)).not.toHaveAttribute("data-turn", "35");
    // The attribute and the slider come from one state, so one read of both always agrees, even
    // while damping still turns the camera.
    const { attribute, value } = await page.evaluate((selector) => {
      const turn = [...document.querySelectorAll<HTMLInputElement>('input[type="range"]')].find(
        (input) => input.labels?.[0]?.textContent === "Turn",
      );
      return {
        attribute: document.querySelector<HTMLElement>(selector)?.dataset.turn,
        value: turn?.value,
      };
    }, PANEL);
    expect(attribute).toMatch(/^-?\d+$/);
    expect(value).toBe(attribute);
  });

  // Breaks when a link in the hash stops opening its design, or "Open in the studio" stops
  // carrying it.
  test("F-EXP5-04 /explore#s=<LINK(SPEC)> shows SPEC and links back to the studio with it", async ({
    page,
  }) => {
    expect(SPEC.meta.name).toBe("untitled");
    await openExplorer(page, LINK(SPEC));
    await expect(summary(page)).toHaveText(sceneSummary("untitled", "light", "srgb", 0.6));
    await expect(summary(page)).toHaveText(/^untitled:/);
    await expect(
      page.getByRole("link", { name: "Open in the studio", exact: true }),
    ).toHaveAttribute("href", `/studio#s=${encodeSpec(SPEC)}`);
    await expect(notice(page)).toHaveText("");
    await expect(stepList(page).getByRole("listitem")).toHaveText(
      near(SPEC, "light", 0.6).map(stepItem),
    );
  });

  // Breaks when a bad link shows a raw error, stops falling back to the default or the current
  // design, or a good link that follows stops clearing the line.
  test("F-EXP5-05 a bad hash shows the default with the decode sentence; hashchange loads or keeps", async ({
    page,
  }) => {
    const damaged = "This link is damaged or cut short, so the studio cannot open it.";
    await openExplorer(page, "#s=garbage");
    await expect(notice(page)).toHaveAttribute("role", "status");
    await expect(notice(page)).toHaveText(`${damaged} ${EXPLORE_LINES["bad-link"]}`);
    await expect(summary(page)).toHaveText(sceneSummary("Madder", "light", "srgb", 0.6));
    await page.evaluate((hash) => {
      location.hash = hash;
    }, LINK(SPEC));
    await expect(summary(page)).toHaveText(sceneSummary("untitled", "light", "srgb", 0.6));
    await expect(notice(page)).toHaveText("");
    await page.evaluate(() => {
      location.hash = "#s=garbage";
    });
    await expect(notice(page)).toHaveText(`${damaged} ${EXPLORE_LINES["bad-link-kept"]}`);
    await expect(summary(page)).toHaveText(sceneSummary("untitled", "light", "srgb", 0.6));
    await expect(
      page.getByRole("link", { name: "Open in the studio", exact: true }),
    ).toHaveAttribute("href", `/studio#s=${encodeSpec(SPEC)}`);
  });

  // Breaks when a browser with no WebGL2 gets a canvas or a raw error instead of the sentence, or
  // the flat view stops following the slice there.
  test("F-EXP5-06 with no WebGL the panel is flat with its sentence and the slice still redraws", async ({
    page,
  }) => {
    await NO_WEBGL(page);
    await openExplorer(page);
    await expect(panel(page)).toHaveAttribute("data-explorer-state", "flat");
    await expect(panel(page)).toHaveAttribute("data-explorer-reason", "no-webgl2");
    await expect(panel(page).locator("canvas")).toHaveCount(0);
    await expect(panel(page).getByText(EXPLORE_LINES["no-webgl2"], { exact: true })).toBeVisible();
    await slideTo(page, 0.5);
    await expect(panel(page)).toHaveAttribute("data-slice", "0.50");
    const steps = near(DEFAULT, "light", 0.5);
    await expect(flatView(page).locator("figcaption")).toHaveText(caption(steps.length, 0.5));
    await expect(stepList(page).getByRole("listitem")).toHaveText(
      steps.length === 0 ? ["No step lies within 0.04 of L 0.50."] : steps.map(stepItem),
    );
  });

  // Breaks when a lost context leaves a dead canvas or a raw error, or "Restart the 3D view"
  // stops mounting a new canvas.
  test("F-EXP5-07 a lost context shows the flat view's sentence, and Restart mounts a new canvas", async ({
    page,
  }) => {
    await openExplorer(page);
    await in3d(page);
    await page.evaluate((selector) => {
      (window as unknown as { __firstCanvas: Element | null }).__firstCanvas =
        document.querySelector(`${selector} canvas`);
    }, PANEL);
    await loseContext(page, `${PANEL} canvas`);
    await expect(panel(page)).toHaveAttribute("data-explorer-state", "flat");
    await expect(panel(page)).toHaveAttribute("data-explorer-reason", "context-lost");
    await expect(
      panel(page).getByText(EXPLORE_LINES["context-lost"], { exact: true }),
    ).toBeVisible();
    await expect(panel(page).locator("canvas")).toHaveCount(0);
    await panel(page).getByRole("button", { name: EXPLORE_LINES.restart, exact: true }).click();
    await in3d(page);
    await expect(panel(page)).not.toHaveAttribute("data-explorer-reason");
    expect(
      await page.evaluate(
        (selector) =>
          document.querySelector(`${selector} canvas`) !==
          (window as unknown as { __firstCanvas: Element | null }).__firstCanvas,
        PANEL,
      ),
    ).toBe(true);
  });

  // Breaks when the controls keep damping under the OS's reduced motion (I-M5-02).
  test("F-EXP5-08 damping is on, and off under reduced motion", async ({ page }) => {
    await openExplorer(page);
    await in3d(page);
    await expect(panel(page)).toHaveAttribute("data-damping", "true");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(panel(page)).toHaveAttribute("data-damping", "false");
    await openExplorer(page);
    await in3d(page);
    await expect(panel(page)).toHaveAttribute("data-damping", "false");
  });

  // Breaks when the studio's link stops carrying its design to the explorer, or the explorer's
  // link stops carrying it back.
  test("F-EXP5-09 the studio's link opens SPEC in the explorer, which opens it back in the studio", async ({
    page,
  }) => {
    await openStudio(page, LINK(SPEC));
    await expect(lotId(page)).toHaveText(lotOf(SPEC));
    const link = page.getByRole("link", { name: "See these scales in the explorer", exact: true });
    await expect(link).toHaveAttribute("href", `/explore#s=${encodeSpec(SPEC)}`);
    await link.click();
    await expect(page).toHaveURL(/\/explore#s=/);
    await expect(summary(page)).toHaveText(sceneSummary("untitled", "light", "srgb", 0.6));
    await page.getByRole("link", { name: "Open in the studio", exact: true }).click();
    await expect(page).toHaveURL(/\/studio#s=/);
    await ready(page);
    await expect(lotId(page)).toHaveText(lotOf(SPEC));
  });

  // Breaks when a P3 design opens on the sRGB solid, or the flat view stops showing a step that
  // sRGB cannot hold outside the sRGB outline (RF2).
  test("F-EXP5-RF2 a P3 design starts on Display P3, and its vivid step sits outside the sRGB outline", async ({
    page,
  }) => {
    const rich = generateSystem({ ...DEFAULT_PARAMS, gamut: "p3", chroma: "vivid" }, "seed-1");
    // P3_L: the light L, to 2 decimals, of the first step whose chroma exceeds sRGB's at its hue.
    const beyond = scenePoints(rich, "light").find((point) => {
      const { l, c, h } = point.oklch;
      if (h === null) return false;
      const edge = gamutSlice("srgb", Math.round(l * 100) / 100)[Math.round(h) % 360];
      return edge !== undefined && c > edge.c;
    });
    expect(beyond, "RICH_P3 must hold a step outside sRGB").toBeDefined();
    if (beyond === undefined) return;
    const P3_L = Math.round(beyond.oklch.l * 100) / 100;
    await openExplorer(page, `#s=${encodeSpec(rich)}`);
    await expect(radio(page, "Display P3")).toBeChecked();
    await expect(panel(page)).toHaveAttribute("data-gamut", "p3");
    await slideTo(page, P3_L);
    await expect(panel(page)).toHaveAttribute("data-slice", P3_L.toFixed(2));
    const id = `${beyond.palette}-${beyond.step}`;
    const hue = Math.round(beyond.oklch.h ?? 0) % 360;
    const distances = await flatView(page).evaluate(
      (figure, [dot, vertex]) => {
        const circle = figure.querySelector(`circle[data-dot="${dot}"]`);
        const outline = figure.querySelector('path[data-outline="srgb"]')?.getAttribute("d") ?? "";
        const points = [...outline.matchAll(/[ML]([-\d.]+) ([-\d.]+)/g)].map((match) => [
          Number(match[1]),
          Number(match[2]),
        ]);
        const edge = points[vertex as number];
        if (circle === null || edge === undefined) return null;
        const cx = Number(circle.getAttribute("cx"));
        const cy = Number(circle.getAttribute("cy"));
        return {
          dot: Math.hypot(cx - 160, cy - 160),
          edge: Math.hypot((edge[0] as number) - 160, (edge[1] as number) - 160),
          vertices: points.length,
        };
      },
      [id, hue] as const,
    );
    expect(distances).not.toBeNull();
    expect(distances?.vertices).toBe(360);
    expect(distances?.dot ?? 0).toBeGreaterThan(distances?.edge ?? Number.POSITIVE_INFINITY);
    await expect(
      stepList(page)
        .getByRole("listitem")
        .filter({ hasText: stepItem(beyond) }),
    ).toHaveCount(1);
  });

  // Breaks when a renderer that fails as it starts shows a raw error or keeps a canvas, or a 3D
  // chunk that fails to load leaves the panel loading (I-M5-03).
  test("F-EXP5-10 with the renderer failing as it starts, the panel is flat with the no-WebGL2 sentence", async ({
    page,
    watch,
  }) => {
    // Three's own line, written before it rethrows, and React's report of the caught error (R5-39
    // amendment).
    watch.allow(/^THREE\.WebGLRenderer: NO_RENDERER: /, 1);
    watch.allow(/^Error: NO_RENDERER: /, 1);
    await NO_RENDERER(page);
    await openExplorer(page);
    await expect(panel(page)).toHaveAttribute("data-explorer-state", "flat");
    await expect(panel(page)).toHaveAttribute("data-explorer-reason", "no-webgl2");
    await expect(panel(page).getByText(EXPLORE_LINES["no-webgl2"], { exact: true })).toBeVisible();
    await expect(panel(page).locator("canvas")).toHaveCount(0);
  });

  test("F-EXP5-10 with the 3D chunk aborted, the panel is flat with the load-failed sentence", async ({
    page,
    watch,
  }) => {
    // The browser's line for the aborted request and for Turbopack's one retry, and React's report
    // of the caught error (R5-39 amendment).
    watch.allow(/^Failed to load resource: net::ERR_FAILED$/, 2);
    watch.allow(/Explorer3D: the chunk did not load/, 1);
    await ABORT_CHUNK(page, "THREE.WebGLRenderer");
    await openExplorer(page);
    await expect(panel(page)).toHaveAttribute("data-explorer-state", "flat");
    await expect(
      panel(page).getByText(EXPLORE_LINES["load-failed"], { exact: true }),
    ).toBeVisible();
    await expect(panel(page).locator("canvas")).toHaveCount(0);
  });
});
