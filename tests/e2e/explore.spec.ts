import { inflateSync } from "node:zlib";
import { test as base, expect, type Locator, type Page } from "@playwright/test";
import { gamutSlice, generateSystem, type Mode, PALETTE_NAMES, type SolidGamut } from "@/engine";
import { SITE } from "@/lib/site/config";
import { type DesignSpec, encodeSpec } from "@/spec";
import { DEFAULT_PARAMS } from "../unit/spec/support";
import { LINK, SPEC } from "./export-support";
import { ABORT_CHUNK, loseContext, NO_RENDERER, NO_WEBGL } from "./flavor-support";
import { lotId, lotOf, openStudio, ready } from "./studio-support";

// Playwright does not read the `?raw` query some engine files import: the hook makes it the text.
await import("./raw-hooks.mjs");
const { defaultDesign } = await import("@/features/landing/heroes");
const { cameraPosition, DEFAULT_CAMERA, EXPLORE_LINES, scenePoints, sceneSummary, sliceSteps } =
  await import("@/features/explore/scene");

// The explorer's flows of docs/specs/05-motion-3d.md, section 14.11 (R5-35 to R5-40, 8.1 to 8.4):
// F-EXP5-01 to 10 and F-EXP5-RF2 (Task 5.6b). What the page must show is computed here in Node.
// Every flow fails on a `securitypolicyviolation` event, a console error or a page error, except
// the reports F-EXP5-10 allows (14.11).

/**
 * Each flow records, before the page's scripts run, every policy violation, console error and page
 * error, and fails at its end on any that `allow` did not name. `allow(pattern, count, source)`
 * admits exactly `count` console errors whose text matches `pattern` and, when `source` is given,
 * whose source URL is `source`: fewer or more fail the flow too.
 */
type Watch = { allow(pattern: RegExp, count: number, source?: string): void };
type Allowance = { readonly pattern: RegExp; readonly count: number; readonly source?: string };
type Logged = { readonly text: string; readonly source: string };

const admits = (allowance: Allowance, logged: Logged): boolean =>
  allowance.pattern.test(logged.text) &&
  (allowance.source === undefined || allowance.source === logged.source);

const test = base.extend<{ watch: Watch }>({
  watch: [
    async ({ page }, use) => {
      const errors: Logged[] = [];
      const pages: string[] = [];
      const allowed: Allowance[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") {
          errors.push({ text: message.text(), source: message.location().url });
        }
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
      await use({
        allow: (pattern, count, source) =>
          void allowed.push(source === undefined ? { pattern, count } : { pattern, count, source }),
      });
      const violations = await page.evaluate(
        () => (window as unknown as { __violations?: string[] }).__violations ?? [],
      );
      const counts = allowed.map(
        (allowance) => errors.filter((logged) => admits(allowance, logged)).length,
      );
      const unexpected = errors
        .filter((logged) => !allowed.some((allowance) => admits(allowance, logged)))
        .map(({ text, source }) => `${text} (${source})`);
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

type Point = ReturnType<typeof scenePoints>[number];
type Vec = readonly [number, number, number];

const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec, b: Vec): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (a: Vec): Vec => {
  const length = Math.hypot(...a);
  return [a[0] / length, a[1] / length, a[2] / length];
};

/** A step as the default camera draws it on a `width` × `height` canvas (8.3: fov 40, at the origin). */
type Placed = {
  readonly point: Point;
  readonly x: number;
  readonly y: number;
  readonly depth: number;
  /** Canvas pixels per unit at the step's depth. */
  readonly scale: number;
  readonly radius: number;
};

function place(point: Point, width: number, height: number): Placed {
  const eye = cameraPosition(DEFAULT_CAMERA);
  const forward = unit([-eye[0], -eye[1], -eye[2]]);
  const right = unit(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  const offset = sub(point.position, eye);
  const depth = dot(offset, forward);
  const scale = height / (2 * depth * Math.tan((20 * Math.PI) / 180));
  return {
    point,
    x: width / 2 + dot(offset, right) * scale,
    y: height / 2 - dot(offset, up) * scale,
    depth,
    scale,
    radius: (point.seed ? 0.035 : 0.02) * scale,
  };
}

/** The distance from `p` to the segment from `a` to `b`, on the canvas. */
function segmentDistance(p: Placed, a: Placed, b: Placed): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)),
  );
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * The largest step sphere whose center pixel nothing else covers: no nearer sphere, no tube that can
 * pass in front of it (a tube is 0.006 thick; 4 px allow for its curve), well inside the canvas.
 */
function clearSphere(points: readonly Point[], width: number, height: number): Placed | undefined {
  const placed = points.map((point) => place(point, width, height));
  const segments = PALETTE_NAMES.flatMap((palette) => {
    const scale = placed.filter(({ point }) => point.palette === palette);
    return scale.slice(1).map((end, i) => [scale[i] as Placed, end] as const);
  });
  const clear = placed.filter((p) => {
    const margin = p.radius + 2;
    if (p.radius < 3 || p.x < margin || p.y < margin) return false;
    if (p.x > width - margin || p.y > height - margin) return false;
    const covered = placed.some(
      (q) => q !== p && q.depth < p.depth && Math.hypot(q.x - p.x, q.y - p.y) < q.radius + 2,
    );
    if (covered) return false;
    return segments.every(([a, b]) => {
      // Its own tube runs inside it, and stays behind it while both neighbors are farther away.
      if (a === p || b === p) return (a === p ? b : a).depth > p.depth;
      if (Math.min(a.depth, b.depth) > p.depth) return true;
      return segmentDistance(p, a, b) > 4 + 0.006 * p.scale;
    });
  });
  return clear.sort((a, b) => b.radius - a.radius)[0];
}

/** The color of pixel (x, y) of an 8-bit, non-interlaced RGB or RGBA PNG, as a screenshot gives it. */
function pngPixel(png: Buffer, x: number, y: number): Vec {
  let width = 0;
  let channels = 0;
  const parts: Buffer[] = [];
  for (let at = 8; at < png.length; ) {
    const length = png.readUInt32BE(at);
    const type = png.toString("latin1", at + 4, at + 8);
    const body = png.subarray(at + 8, at + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      const [depth, color, , , interlace] = body.subarray(8, 13);
      if (depth !== 8 || interlace !== 0 || (color !== 2 && color !== 6)) {
        throw new Error(`pngPixel: depth ${depth}, color type ${color}, interlace ${interlace}`);
      }
      channels = color === 6 ? 4 : 3;
    } else if (type === "IDAT") {
      parts.push(body);
    }
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(parts));
  const stride = width * channels;
  let previous = new Uint8Array(stride);
  for (let row = 0; row <= y; row++) {
    const start = row * (stride + 1);
    const filter = raw[start];
    const line = new Uint8Array(raw.subarray(start + 1, start + 1 + stride));
    for (let i = 0; i < stride; i++) {
      const left = i >= channels ? (line[i - channels] ?? 0) : 0;
      const above = previous[i] ?? 0;
      const corner = i >= channels ? (previous[i - channels] ?? 0) : 0;
      const guess = left + above - corner;
      const nearest =
        Math.abs(guess - left) <= Math.abs(guess - above) &&
        Math.abs(guess - left) <= Math.abs(guess - corner)
          ? left
          : Math.abs(guess - above) <= Math.abs(guess - corner)
            ? above
            : corner;
      const predicted = [0, left, above, (left + above) >> 1, nearest][filter ?? 0] ?? 0;
      line[i] = ((line[i] ?? 0) + predicted) & 0xff;
    }
    previous = line;
  }
  const at = x * channels;
  return [previous[at] ?? 0, previous[at + 1] ?? 0, previous[at + 2] ?? 0];
}

/** The largest channel difference between a pixel and a hex. */
const offBy = (pixel: Vec, hex: string): number =>
  Math.max(
    ...[0, 1, 2].map((i) =>
      Math.abs(pixel[i] - Number.parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16)),
    ),
  );

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

  // Breaks when the 3D view stops drawing a step in its own hex: tone mapping, a lit material or a
  // color space that shifts it (I-M5-01, R5-36, recorded at Task 5.6b's review).
  test("F-EXP5-01 I-M5-01 an unclipped step sphere shows its own hex, with no tone mapping", async ({
    page,
  }) => {
    await openExplorer(page);
    await in3d(page);
    // At L 0 the slice cuts the whole solid away, so nothing see-through lies over a sphere.
    await slider(page, "Lightness slice").focus();
    await page.keyboard.press("Home");
    await expect(panel(page)).toHaveAttribute("data-slice", "0.00");
    const canvas = panel(page).locator("canvas");
    await canvas.scrollIntoViewIfNeeded();
    const box = await canvas.boundingBox();
    if (box === null) throw new Error("I-M5-01: the canvas has no box");
    const target = clearSphere(scenePoints(DEFAULT, "light"), box.width, box.height);
    expect(target, "some step sphere must lie in the clear").toBeDefined();
    if (target === undefined) return;
    const { hex, palette, step } = target.point;
    const x = Math.floor(target.x);
    const y = Math.floor(target.y);
    // Section 4's tolerance for a pixel read back: ±1 per channel. A miss reads as the pixel shown.
    await expect
      .poll(async () => {
        const pixel = pngPixel(await canvas.screenshot(), x, y);
        const shown = `#${pixel.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
        const off = offBy(pixel, hex);
        return { step: `${palette} ${step}`, hex, shown: off <= 1 || `${shown}, off by ${off}` };
      })
      .toEqual({ step: `${palette} ${step}`, hex, shown: true });
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
    const marker = "THREE.WebGLRenderer";
    const aborted: string[] = [];
    page.on("requestfailed", (request) => {
      if (request.failure()?.errorText === "net::ERR_FAILED") aborted.push(request.url());
    });
    await ABORT_CHUNK(page, marker);
    await openExplorer(page);
    await expect(panel(page)).toHaveAttribute("data-explorer-state", "flat");
    await expect(panel(page)).not.toHaveAttribute("data-explorer-reason");
    await expect(
      panel(page).getByText(EXPLORE_LINES["load-failed"], { exact: true }),
    ).toBeVisible();
    await expect(panel(page).locator("canvas")).toHaveCount(0);
    // 14.11's ABORT_CHUNK rule: the chunk that holds the marker failed twice, its request and
    // Turbopack's one retry, each with the browser's line; React reports the caught error once.
    await expect.poll(() => aborted.length).toBe(2);
    const [chunk = ""] = aborted;
    expect(aborted).toEqual([chunk, chunk]);
    expect(await (await page.request.get(chunk)).text()).toContain(marker);
    watch.allow(/^Failed to load resource: net::ERR_FAILED$/, 2, chunk);
    watch.allow(/^\S+: Explorer3D: the chunk did not load/, 1);
  });
});
