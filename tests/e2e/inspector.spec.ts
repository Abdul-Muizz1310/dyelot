import { expect, type Locator, type Page, test } from "@playwright/test";
import { colornames } from "color-name-list/bestof";
import {
  type ContrastLevel,
  type DirectionParams,
  type Finding,
  fontStack,
  indexNames,
  lintSpec,
  nearestName,
  PALETTE_NAMES,
  PRESETS,
  parseColor,
} from "@/engine";
import {
  findingKey,
  findingMeasure,
  findingTitle,
  formatLc,
  groupFindings,
  nameTargets,
  roleRows,
} from "@/features/studio/inspect";
import type { TemplateId } from "@/features/studio/view";
import { type DesignSpec, encodeSpec, normalizeSpec } from "@/spec";
import {
  canvasFrame,
  canvasRegion,
  designFor,
  FRESH,
  inspectorAside,
  lotId,
  openStudio,
  seedCalls,
  seedOf,
  settled,
  stubSeeds,
} from "./studio-support";
import {
  canvasAtRest,
  eachTab,
  installColorResolver,
  openSheet,
  overflow,
  SCREENS,
  screenOf,
  showTemplate,
  templateRoot,
} from "./template-support";

// The inspector flows of docs/specs/02-studio.md, section 7.8 (Task 2.10b): F-INSP-01 to F-INSP-16,
// with "show me" on the canvas (F-CANVAS-11) and the mobile fit with the inspector drawer and from the
// first frame of a switch (F-TPL-32, the Task 2.10a review's M-1). A flow that names no viewport runs at
// 1280 × 800, where the inspector is a 360 px column.

test.use({ viewport: { width: 1280, height: 800 } });

const PHONE = { width: 360, height: 740 };
const MODES = ["light", "dark"] as const;
const TEMPLATES: readonly TemplateId[] = [
  "landing",
  "dashboard",
  "settings",
  "mobile",
  "editorial",
  "kitchen-sink",
];
/** A name the bestof list holds: it marks the list's chunk by its content. */
const LIST_MARK = "20000 Leagues Under the Sea";

/** The design of the first load when `stubSeeds` draws the seeds. */
const first = () => designFor(FRESH, seedOf(1));

const inspector = (page: Page) => page.locator("aside#studio-inspector");
const region = (page: Page, name: string) =>
  inspector(page).getByRole("region", { name, exact: true });
const scrollArea = (page: Page) => inspector(page).locator("[data-scroll-area]");
const findingItem = (page: Page, key: string) => inspector(page).locator(`[data-finding="${key}"]`);
const showMeButton = (page: Page, key: string) =>
  findingItem(page, key).getByRole("button", { name: "Show me", exact: true });
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const modeSwitch = (page: Page) => page.getByRole("switch", { name: "Dark mode", exact: true });

/** A deep copy of `value` with `next` at `path`. */
function withValue<T>(value: T, path: readonly (string | number)[], next: unknown): T {
  const copy = structuredClone(value) as unknown as Record<string | number, unknown>;
  let node: Record<string | number, unknown> = copy;
  for (const key of path.slice(0, -1)) node = node[key] as Record<string | number, unknown>;
  node[path[path.length - 1] as string | number] = next;
  return copy as unknown as T;
}

/** The share-link hash of a spec the test built, through `encodeSpec` (never a hand-written string). */
const linkOf = (spec: DesignSpec): string => `#s=${encodeSpec(normalizeSpec(spec))}`;

/** A fresh design at `level` with the light ring set to #f4f4f4 on its #ffffff page (C-INSPECT-04). */
function ringFixture(level: ContrastLevel = "AA"): DesignSpec {
  const params: DirectionParams = { ...FRESH, contrastLevel: level };
  const spec = designFor(params, "e2e-fix");
  expect(spec.color.roles.light.background).toBe("#ffffff");
  return normalizeSpec(withValue(spec, ["color", "roles", "light", "ring"], "#f4f4f4"));
}

/** The first design with the light primary's step 100 equal to its step 50: K1 and K2 there. */
function stepFixture(): DesignSpec {
  const spec = first();
  const [fifty] = spec.color.palettes.primary.light;
  return normalizeSpec(
    withValue(spec, ["color", "palettes", "primary", "light", 1], { ...fifty, step: 100 }),
  );
}

/** The first design with the display family `geist` (T1) and a 14 px body step (T4). */
function tasteFixture(): DesignSpec {
  let spec: DesignSpec = withValue(first(), ["type", "families", "display"], "geist");
  const body = spec.type.steps.findIndex((step) => step.name === "body");
  spec = withValue(spec, ["type", "steps", body, "sizePx"], 14);
  return normalizeSpec(spec);
}

const keyOf = (spec: DesignSpec, id: Finding["id"], mode: "light" | "dark", subject: string) => {
  const found = lintSpec(spec).find(
    (item) => item.id === id && item.mode === mode && item.subject === subject,
  );
  expect(found, `${id} ${mode} ${subject} in the fixture`).toBeDefined();
  return found === undefined ? "" : findingKey(found);
};

/**
 * The outline of "show me" on the canvas for `roles` (F-CANVAS-11), read through the shared sRGB
 * resolver, inside `scope` (the canvas region by default, or one mobile screen or the open sheet):
 * `shown`, the outlined elements on screen (`checkVisibility()`); `missing`, elements that name a role
 * without the dashed madder outline 2 px wide with a 2 px offset on screen (the computed value times
 * the frame's fit, within half a layout pixel times the fit, since Chromium draws an outline in whole
 * layout pixels: the canvas region scales it, fix round 1, M-7); `stray`, elements that name none with
 * a madder outline.
 */
async function outlineReport(page: Page, roles: readonly string[], scope?: Locator) {
  await installColorResolver(page);
  return (scope ?? canvasRegion(page)).evaluate((host, wanted) => {
    const resolve = (window as unknown as { __dyelotRgba: (v: string) => number[] | null })
      .__dyelotRgba;
    const madder = (value: string) => {
      const rgba = resolve(value);
      return (
        rgba !== null && rgba[0] === 246 && rgba[1] === 108 && rgba[2] === 109 && rgba[3] > 0.99
      );
    };
    const onScreen = (element: Element, value: string) => {
      const frame = element.closest<HTMLElement>("[data-canvas][data-frame]");
      const fit = frame === null ? 1 : frame.getBoundingClientRect().width / frame.offsetWidth;
      return Math.abs(Number.parseFloat(value) * fit - 2) <= fit / 2 + 0.01;
    };
    const label = (element: Element) =>
      `${element.tagName.toLowerCase()}.${[...element.classList].join(".")} [${element.getAttribute("data-roles") ?? ""}]`;
    let shown = 0;
    const missing: string[] = [];
    const stray: string[] = [];
    for (const element of [host, ...host.querySelectorAll("*")]) {
      if (element.closest("[data-canvas]") === null) continue;
      const named = (element.getAttribute("data-roles") ?? "")
        .split(/\s+/)
        .some((role) => wanted.includes(role));
      const style = getComputedStyle(element);
      const outlined =
        style.outlineStyle === "dashed" &&
        onScreen(element, style.outlineWidth) &&
        onScreen(element, style.outlineOffset) &&
        madder(style.outlineColor);
      if (named && !outlined) {
        missing.push(
          `${label(element)} ${style.outlineStyle} ${style.outlineWidth} ${style.outlineOffset}`,
        );
      } else if (named && element.checkVisibility()) shown++;
      else if (!named && style.outlineStyle !== "none" && madder(style.outlineColor)) {
        stray.push(label(element));
      }
    }
    return { shown, missing: missing.slice(0, 8), stray: stray.slice(0, 8) };
  }, roles);
}

/**
 * F-INSP-15 (fix round 1, I-1): in the template `root`, every visible element whose own text is set in
 * `face`, inside the fit box, and whose carrier (the nearest element with `data-roles`) has no outline
 * that shows: the
 * carrier's outline box, its border box grown by 4 px on screen, lies wholly inside the band that
 * `.canvas-fit` clips (the ring between 2 and 4 px out never meets the clip box). Also the carriers
 * that do not name the face's token at all. Returns the misses and how many texts it read.
 */
function hiddenCarriers(root: Locator, face: "display" | "body") {
  return root.evaluate((element, face) => {
    const frame = element.closest<HTMLElement>("[data-canvas][data-frame]");
    const fit = element.closest(".canvas-fit");
    if (frame === null || fit === null) throw new Error("hiddenCarriers: no frame or fit box");
    const probe = document.createElement("span");
    frame.append(probe);
    probe.style.fontFamily = "var(--font-display)";
    const display = getComputedStyle(probe).fontFamily;
    probe.style.fontFamily = "var(--font-body)";
    const body = getComputedStyle(probe).fontFamily;
    probe.remove();
    const family = face === "display" ? display : body;
    const token = face === "display" ? "font-display" : "font-body";
    const clip = fit.getBoundingClientRect();
    const misses: string[] = [];
    let read = 0;
    for (const text of [element, ...element.querySelectorAll("*")]) {
      const own = [...text.childNodes].some(
        (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim() !== "",
      );
      if (!own || !text.checkVisibility()) continue;
      const box = text.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      // Only a text that shows inside the fit box is judged: one scrolled out of view inside a
      // template's own scroll area has nothing to point at.
      const inside =
        box.right > clip.left &&
        box.left < clip.right &&
        box.bottom > clip.top &&
        box.top < clip.bottom;
      if (!inside) continue;
      if (getComputedStyle(text).fontFamily !== family) continue;
      read++;
      const carrier = text.closest("[data-roles]");
      const name = `${text.tagName.toLowerCase()}.${[...text.classList].join(".")} "${(text.textContent ?? "").trim().slice(0, 24)}"`;
      if (
        carrier === null ||
        !(carrier.getAttribute("data-roles") ?? "").split(/\s+/).includes(token)
      ) {
        misses.push(`${name}: no ${token} carrier`);
        continue;
      }
      const own2 = carrier.getBoundingClientRect();
      const outer = { l: own2.left - 4, t: own2.top - 4, r: own2.right + 4, b: own2.bottom + 4 };
      const inner = { l: own2.left - 2, t: own2.top - 2, r: own2.right + 2, b: own2.bottom + 2 };
      const cut = {
        l: Math.max(outer.l, clip.left),
        t: Math.max(outer.t, clip.top),
        r: Math.min(outer.r, clip.right),
        b: Math.min(outer.b, clip.bottom),
      };
      const shows =
        cut.l < cut.r &&
        cut.t < cut.b &&
        (cut.l < inner.l || cut.r > inner.r || cut.t < inner.t || cut.b > inner.b);
      if (!shows) {
        misses.push(
          `${name}: carrier ${carrier.tagName.toLowerCase()}.${[...carrier.classList].join(".")} is clipped away`,
        );
      }
    }
    return { read, misses: misses.slice(0, 10) };
  }, face);
}

/** The layout box of every element inside the canvas frame, rounded to 0.01 px. */
function canvasBoxes(page: Page): Promise<string[]> {
  return canvasFrame(page).evaluate((frame) =>
    [frame, ...frame.querySelectorAll("*")].map((element) => {
      const box = element.getBoundingClientRect();
      return [box.x, box.y, box.width, box.height].map((v) => v.toFixed(2)).join(" ");
    }),
  );
}

/**
 * Records, on each frame for `ms` after `action`, every animation inside `[data-canvas]` that was not
 * running before the action started (F-INSP-16): motion that began earlier, such as a page's entrance,
 * is not the action's. Call it with the canvas at rest (`canvasAtRest`).
 */
async function canvasMotion(page: Page, action: () => Promise<void>, ms = 300): Promise<string[]> {
  await page.evaluate(() => {
    const host = window as unknown as {
      __motion: Set<string>;
      __motionOn: boolean;
      __motionBefore: Set<Animation>;
    };
    const all = () =>
      [...document.querySelectorAll("[data-canvas]")].flatMap((canvas) =>
        canvas.getAnimations({ subtree: true }),
      );
    host.__motion = new Set();
    host.__motionOn = true;
    host.__motionBefore = new Set(all());
    const tick = () => {
      for (const animation of all()) {
        if (host.__motionBefore.has(animation)) continue;
        const effect = animation.effect;
        const target = effect instanceof KeyframeEffect ? effect.target : null;
        const what =
          animation instanceof CSSTransition
            ? `CSSTransition:${animation.transitionProperty}`
            : animation.constructor.name;
        host.__motion.add(
          `${target?.tagName.toLowerCase() ?? "?"}.${[...(target?.classList ?? [])].join(".")} ${what}`,
        );
      }
      if (host.__motionOn) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await action();
  await page.waitForTimeout(ms);
  return page.evaluate(() => {
    const host = window as unknown as { __motion: Set<string>; __motionOn: boolean };
    host.__motionOn = false;
    return [...host.__motion];
  });
}

/** The first design with chart-2 equal to chart-1 in light: S1 fires on the chart set under every view. */
function chartFixture(): DesignSpec {
  const spec = first();
  return normalizeSpec(
    withValue(spec, ["color", "roles", "light", "chart-2"], spec.color.roles.light["chart-1"]),
  );
}

/** The Findings section's heading and its one status region (fix round 1, I-2). */
const findingsHeading = (page: Page) =>
  region(page, "Findings").getByRole("heading", { name: "Findings", exact: true });
const findingsStatus = (page: Page) => region(page, "Findings").getByRole("status");

/** Opens the inspector drawer from the toolbar and waits for its heading to take focus. */
/**
 * The role table's crowding (F-INSP-02): a hex, ratio, level, score or header cell whose text its cell
 * cuts, a line's visible part outside the table, or two parts on one line less than 3 px apart. A
 * cell's visible part is its text (not the visually hidden kind), icon and swatch, measured as drawn.
 */
function crowdedRoles(page: Page): Promise<string[]> {
  return region(page, "Roles")
    .getByRole("table")
    .evaluate((table) => {
      const problems: string[] = [];
      for (const cell of table.querySelectorAll(
        "[data-hex], [data-ratio], [data-level], [data-lc], thead th",
      )) {
        if (cell.scrollWidth > cell.clientWidth + 0.5)
          problems.push(`cut: ${cell.textContent} ${cell.scrollWidth}>${cell.clientWidth}`);
      }
      const edge = table.getBoundingClientRect();
      for (const line of table.querySelectorAll("thead tr, tr[data-mode]")) {
        const name = `${line.closest("tbody")?.getAttribute("data-pair") ?? "header"} ${line.getAttribute("data-mode") ?? ""}`;
        const parts: { text: string; left: number; right: number }[] = [];
        for (const cell of line.children) {
          const rects = [...cell.querySelectorAll("svg, [data-swatch]")].map((part) =>
            part.getBoundingClientRect(),
          );
          const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
          for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
            const parent = node.parentElement;
            if (parent === null || parent.closest(".sr-only") !== null) continue;
            if ((node.textContent ?? "").trim() === "") continue;
            const range = document.createRange();
            range.selectNodeContents(node);
            rects.push(range.getBoundingClientRect());
          }
          if (rects.length === 0) continue;
          parts.push({
            text: (cell.textContent ?? "").trim(),
            left: Math.min(...rects.map((rect) => rect.left)),
            right: Math.max(...rects.map((rect) => rect.right)),
          });
        }
        for (const part of parts) {
          if (part.left < edge.left - 0.5 || part.right > edge.right + 0.5)
            problems.push(`${name}: "${part.text}" reaches outside the table`);
        }
        for (let at = 1; at < parts.length; at += 1) {
          const [before, after] = [parts[at - 1], parts[at]];
          if (before === undefined || after === undefined) continue;
          const gap = after.left - before.right;
          if (gap < 3)
            problems.push(
              `${name}: "${before.text}" and "${after.text}" ${gap.toFixed(1)} px apart`,
            );
        }
      }
      return problems;
    });
}

async function openInspector(page: Page): Promise<void> {
  await button(page, "Inspector").click();
  await expect(inspectorAside(page).getByRole("heading", { name: "Inspector" })).toBeFocused();
}

test.describe("7.8 The inspector's sections", () => {
  test("F-INSP-01 the scales show 8 palettes of 11 steps with each step's hex and contrast", async ({
    page,
  }) => {
    await stubSeeds(page);
    await openStudio(page);
    const scales = region(page, "Scales");
    for (const mode of MODES) {
      if (mode === "dark") await modeSwitch(page).click();
      await expect(canvasFrame(page)).toHaveAttribute("data-mode", mode);
      const shown = await scales.locator("[data-palette]").evaluateAll((palettes) =>
        palettes.map((palette) => ({
          name: palette.getAttribute("data-palette"),
          steps: [...palette.querySelectorAll("[data-step]")].map((step) => ({
            step: step.getAttribute("data-step"),
            text: step.querySelector("[data-step-number]")?.textContent,
            hex: step.querySelector("[data-hex]")?.textContent,
            ratio: step.querySelector("[data-ratio]")?.textContent,
            swatch: step.querySelector("[data-swatch]") !== null,
          })),
        })),
      );
      expect(shown.map((palette) => palette.name)).toEqual([...PALETTE_NAMES]);
      for (const palette of shown) {
        const scale = first().color.palettes[palette.name as (typeof PALETTE_NAMES)[number]][mode];
        expect(palette.steps, `${mode} ${palette.name}`).toEqual(
          scale.map((step) => ({
            step: String(step.step),
            text: String(step.step),
            hex: step.hex,
            ratio: step.contrast.toFixed(2),
            swatch: true,
          })),
        );
      }
    }
    // Numbers are set in Geist Mono with tabular numerals.
    const font = await scales
      .locator("[data-ratio]")
      .first()
      .evaluate((element) => {
        const style = getComputedStyle(element);
        return [style.fontFamily, style.fontVariantNumeric];
      });
    expect(font[0]).toMatch(/geist.?mono/i);
    expect(font[1]).toContain("tabular-nums");
  });

  test("F-INSP-01 a locked seed's step is marked and a moved seed says how far", async ({
    page,
  }) => {
    const params: DirectionParams = { ...FRESH, primary: parseColor("oklch(0.7 0.3 145)") };
    const spec = normalizeSpec(designFor(params, "e2e-seed"));
    const primary = spec.color.palettes.primary;
    expect(primary.seedDeviation, "the fixture's seed moved").toBeDefined();
    await openStudio(page, linkOf(spec));
    const palette = region(page, "Scales").locator('[data-palette="primary"]');
    const deviation = primary.seedDeviation;
    if (deviation !== undefined) {
      const delta = deviation.deltaEOK.toFixed(3);
      await expect(palette.locator("[data-seed-deviation]")).toHaveText(
        `Seed moved ΔE ${delta} at step ${deviation.step}`,
      );
    }
    const seedStep = primary.seedStep?.light;
    if (seedStep !== undefined) {
      await expect(palette.locator("[data-seed]")).toHaveAttribute("data-step", String(seedStep));
      await expect(palette.locator("[data-seed]")).toContainText("seed");
    }
    // Another palette has no seed note.
    await expect(
      region(page, "Scales").locator('[data-palette="neutral"] [data-seed-deviation]'),
    ).toHaveCount(0);
  });

  test("F-INSP-02 F-INSP-03 the role table shows 32 pairs with ratio, level and signed score in both modes", async ({
    page,
  }) => {
    await stubSeeds(page);
    await openStudio(page);
    const roles = region(page, "Roles");
    const table = roles.getByRole("table");
    await expect(table.getByRole("columnheader", { name: /advisory/i })).toBeVisible();
    const shown = await table.locator("tbody[data-pair]").evaluateAll((groups) =>
      groups.map((group) => ({
        pair: group.getAttribute("data-pair"),
        modes: [...group.querySelectorAll("tr[data-mode]")].map((row) => ({
          mode: row.getAttribute("data-mode"),
          foreground: row.querySelector('[data-hex="foreground"]')?.textContent,
          fill: row.querySelector('[data-hex="fill"]')?.textContent,
          ratio: row.querySelector("[data-ratio]")?.textContent,
          level: row.querySelector("[data-level]")?.textContent?.replace("✕", "").trim(),
          lc: row.querySelector("[data-lc]")?.textContent,
        })),
      })),
    );
    const rows = roleRows(first());
    expect(shown).toEqual(
      rows.map((row) => ({
        pair: row.pair,
        modes: MODES.map((mode) => ({
          mode,
          foreground: row[mode].foreground,
          fill: row[mode].fill,
          ratio: row[mode].ratio.toFixed(2),
          level: row[mode].level,
          lc: row[mode].lcText,
        })),
      })),
    );
    // F-INSP-03: both signs show, with U+2212 for a negative score.
    const scores = shown.flatMap((group) => group.modes.map((cell) => cell.lc ?? ""));
    expect(scores.some((score) => score.startsWith("+"))).toBe(true);
    expect(scores.some((score) => score.startsWith("−"))).toBe(true);
    expect(scores.every((score) => /^(\+\d+|−\d+|0)$/.test(score))).toBe(true);
    expect(formatLc(-12.4)).toBe("−12");
    // M-2: the table and its header are set in 11 px Geist Mono, the house's floor.
    const sizes = await table.evaluate((element) => [
      getComputedStyle(element).fontSize,
      getComputedStyle(element.querySelector("thead th") as Element).fontSize,
    ]);
    expect(sizes).toEqual(["11px", "11px"]);
    // Every value shows whole and apart at 11 px (the drawer's case is under F-INSP-14).
    expect(await crowdedRoles(page)).toEqual([]);
    // M-1: scrolled to the middle of the table, the header sits at the scroll area's top edge, so no row
    // shows above it.
    await scrollArea(page).evaluate((area) => {
      const middle = area.querySelector('tbody[data-pair="info-foreground/info"]') as HTMLElement;
      area.scrollTop += middle.getBoundingClientRect().top - area.getBoundingClientRect().top;
    });
    const edges = await scrollArea(page).evaluate((area) => ({
      area: area.getBoundingClientRect().top + area.clientTop,
      header: (area.querySelector("thead th") as Element).getBoundingClientRect().top,
    }));
    expect(Math.abs(edges.header - edges.area), JSON.stringify(edges)).toBeLessThanOrEqual(1);
  });

  test("F-INSP-02 a failing pair reads fail with a mark, not by color alone", async ({ page }) => {
    await openStudio(page, linkOf(ringFixture()));
    const ring = region(page, "Roles").locator(
      'tbody[data-pair="ring/background"] tr[data-mode="light"]',
    );
    await expect(ring.locator("[data-level]")).toHaveText(/✕\s*fail/);
    const ratio = roleRows(ringFixture()).find((row) => row.pair === "ring/background")?.light
      .ratio;
    expect(ratio).toBeLessThan(3);
    await expect(ring.locator("[data-ratio]")).toHaveText(ratio?.toFixed(2) ?? "");
  });

  test("F-INSP-04 names load lazily after first paint, when the section shows", async ({
    page,
  }) => {
    const listUrls: string[] = [];
    const chunkUrls: string[] = [];
    await page.route("**/_next/static/chunks/**", async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      chunkUrls.push(route.request().url());
      if (body.includes(LIST_MARK)) {
        listUrls.push(route.request().url());
        // Held, so the section's loading state shows.
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
      await route.fulfill({ response, body });
    });
    await stubSeeds(page);
    await openStudio(page);
    await page.waitForTimeout(800);
    const initial = [...chunkUrls];
    expect(initial.length).toBeGreaterThan(0);
    expect(listUrls, "the list's chunk is not among the initial requests").toEqual([]);
    const names = region(page, "Names");
    await names.scrollIntoViewIfNeeded();
    await expect(names).toContainText(/Loading names/);
    await expect.poll(() => listUrls.length).toBe(1);
    expect(initial).not.toContain(listUrls[0]);
    const index = indexNames(colornames);
    const expected = nameTargets(first()).map((target) => ({
      label: target.label,
      hex: target.hex,
      name: nearestName(target.color, index).name,
    }));
    await expect(names.locator("[data-name-target] [data-name]")).toHaveCount(13);
    const shown = await names.locator("[data-name-target]").evaluateAll((items) =>
      items.map((item) => ({
        label: item.getAttribute("data-name-target"),
        hex: item.querySelector("[data-hex]")?.textContent,
        name: item.querySelector("[data-name]")?.textContent,
      })),
    );
    expect(shown).toEqual(expected);
    await expect(names).not.toContainText(/Loading names/);
  });

  test("F-INSP-05 a list that fails to load says so, and the rest of the inspector works", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let aborted = 0;
    await page.route("**/_next/static/chunks/**", async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      if (body.includes(LIST_MARK)) {
        aborted++;
        await route.abort();
        return;
      }
      await route.fulfill({ response, body });
    });
    await stubSeeds(page);
    await openStudio(page);
    const names = region(page, "Names");
    await names.scrollIntoViewIfNeeded();
    await expect(names).toContainText("Names unavailable. The rest of the inspector works.");
    // The bundler's chunk loader may try the chunk once more before it gives up.
    expect(aborted).toBeGreaterThanOrEqual(1);
    await expect(names.locator("[data-name-target] [data-name]")).toHaveCount(0);
    await expect(region(page, "Roles").locator("tbody[data-pair]")).toHaveCount(32);
    await expect(region(page, "Findings").locator("[data-finding]")).toHaveCount(2);
    // The studio still works: a regenerate changes the lot.
    const lot = await lotId(page).textContent();
    await button(page, "Regenerate").click();
    await expect(lotId(page)).not.toHaveText(lot ?? "");
    expect(errors).toEqual([]);
  });

  test("F-INSP-06 findings group by severity with counts, in the linter's order", async ({
    page,
  }) => {
    const spec = stepFixture();
    const findings = lintSpec(spec);
    const groups = groupFindings(findings);
    expect(groups.error.length * groups.warn.length * groups.info.length).toBeGreaterThan(0);
    await openStudio(page, linkOf(spec));
    const section = region(page, "Findings");
    await expect(section.locator("[data-finding-counts]")).toHaveText(
      `${groups.error.length} error${groups.error.length === 1 ? "" : "s"} · ${groups.warn.length} warning${groups.warn.length === 1 ? "" : "s"} · ${groups.info.length} info`,
    );
    for (const [severity, heading] of [
      ["error", "Errors"],
      ["warn", "Warnings"],
      ["info", "Info"],
    ] as const) {
      const group = section.locator(`[data-group="${severity}"]`);
      await expect(group.getByRole("heading")).toHaveText(`${heading} ${groups[severity].length}`);
      expect(
        await group
          .locator("[data-finding]")
          .evaluateAll((items) => items.map((item) => item.getAttribute("data-finding"))),
      ).toEqual(groups[severity].map(findingKey));
    }
    // Each finding shows its id, title, subject, mode, measure and source.
    const sample = groups.error[0];
    if (sample !== undefined) {
      const item = findingItem(page, findingKey(sample));
      for (const text of [
        sample.id,
        findingTitle(sample.id),
        sample.subject,
        sample.mode,
        findingMeasure(sample),
        sample.source,
      ]) {
        await expect(item).toContainText(text);
      }
    }
  });

  test("F-INSP-06 with no findings the section says so", async ({ page }) => {
    let spec = withValue(first(), ["color", "roles", "light", "border"], "#808080");
    spec = withValue(spec, ["color", "roles", "dark", "border"], "#8a8a8a");
    expect(lintSpec(normalizeSpec(spec))).toEqual([]);
    await openStudio(page, linkOf(spec));
    const section = region(page, "Findings");
    await expect(section).toContainText("No findings.");
    await expect(section.locator("[data-finding]")).toHaveCount(0);
  });

  test("F-INSP-08 taste findings appear: an overused display font and purple on white", async ({
    page,
  }) => {
    await openStudio(page, linkOf(tasteFixture()));
    const t1 = findingItem(page, "T1 light display");
    await expect(t1).toContainText("Overused display font");
    await expect(
      region(page, "Findings").locator('[data-group="warn"] [data-finding="T1 light display"]'),
    ).toBeVisible();
    const purple = normalizeSpec(designFor(FRESH, "seed-1"));
    const t2 = lintSpec(purple).find((item) => item.id === "T2");
    expect(t2, "the seed-1 design is purple on white").toBeDefined();
    // A new hash on the same page is a same-document navigation: leave the page first.
    await page.goto("about:blank");
    await openStudio(page, linkOf(purple));
    await expect(findingItem(page, "T2 light primary")).toContainText("Purple on white default");
  });

  test("F-INSP-13 the preset notes list the preset's guards and unexpressed items, absent for default", async ({
    page,
  }) => {
    expect(PRESETS.default.guards.length + PRESETS.default.unexpressed.length).toBe(0);
    const preset = PRESETS.glass;
    expect(preset.guards.length * preset.unexpressed.length).toBeGreaterThan(0);
    await openStudio(page);
    await expect(region(page, "Preset notes")).toHaveCount(0);
    await page
      .getByRole("complementary", { name: "Inputs" })
      .getByRole("combobox", { name: "Preset", exact: true })
      .selectOption("glass");
    await settled(page);
    const notes = region(page, "Preset notes");
    await expect(notes).toBeVisible();
    const items = await notes.locator("li").allTextContents();
    expect(items).toEqual([...preset.guards, ...preset.unexpressed]);
  });
});

test.describe("7.8 Show me", () => {
  test("F-INSP-07 F-CANVAS-11 a pair finding outlines its roles on the canvas, and nothing moves", async ({
    page,
  }) => {
    await stubSeeds(page);
    await openStudio(page);
    const key = keyOf(first(), "N3", "light", "border/background");
    const before = await canvasBoxes(page);
    await showMeButton(page, key).click();
    await expect(showMeButton(page, key)).toHaveAttribute("aria-pressed", "true");
    await expect(canvasRegion(page)).toHaveAttribute("data-show-me", "border background");
    const report = await outlineReport(page, ["border", "background"]);
    expect(report.missing).toEqual([]);
    expect(report.stray).toEqual([]);
    expect(report.shown).toBeGreaterThan(0);
    expect(await canvasBoxes(page), "only outlines change").toEqual(before);
    await expect(inspector(page).locator("[data-show-me-cell]")).toHaveCount(0);
    // M-6: each "Show me" is described by its finding's title, subject and mode.
    await expect(showMeButton(page, key)).toHaveAccessibleDescription(
      /Border under 3:1.*border\/background.*light/,
    );
    // The canvas's focus ring does not win over the outline: a focused part that names a highlighted
    // role (a settings field names background) shows the dashed outline, 2 px on screen.
    const settings = await showTemplate(page, "settings");
    const field = settings.locator('input[data-roles~="background"]:not([data-state])').first();
    await page.keyboard.press("Shift");
    await field.focus();
    await expect(field).toBeFocused();
    const focused = await field.evaluate((element) => {
      const style = getComputedStyle(element);
      const frame = element.closest("[data-canvas][data-frame]") as HTMLElement;
      const fit = frame.getBoundingClientRect().width / frame.offsetWidth;
      return {
        style: style.outlineStyle,
        offScreen: Math.abs(Number.parseFloat(style.outlineWidth) * fit - 2) - fit / 2,
      };
    });
    expect(focused.style).toBe("dashed");
    expect(focused.offScreen, "2 px on screen, within half a layout pixel").toBeLessThanOrEqual(
      0.01,
    );
  });

  test("F-INSP-07 F1 outlines the forced focus-visible field, and S1 sets the vision view", async ({
    page,
  }) => {
    const ring = ringFixture();
    await openStudio(page, linkOf(ring));
    const f1 = keyOf(ring, "F1", "light", "ring/background");
    await expect(findingItem(page, f1)).toContainText(
      "The ring shows on focus. Show me outlines the surfaces it sits on.",
    );
    await showMeButton(page, f1).click();
    const settings = await showTemplate(page, "settings");
    const forced = settings.locator('[data-state="focus-visible"]');
    await expect(forced).toHaveCount(1);
    await expect(forced).toHaveAttribute("data-roles", /(^|\s)ring(\s|$)/);
    const report = await outlineReport(page, ["ring", "background"]);
    expect(report.missing).toEqual([]);
    expect(report.stray).toEqual([]);
    // S1: the chart set too close under every view; "show me" sets the view of its subject.
    await page.goto("about:blank");
    const chart = chartFixture();
    await openStudio(page, linkOf(chart));
    const s1 = keyOf(chart, "S1", "light", "chart/deutan");
    const vision = page
      .getByRole("region", { name: "Canvas toolbar" })
      .getByRole("group", { name: "Vision", exact: true });
    await expect(vision.getByRole("radio", { name: "none", exact: true })).toBeChecked();
    await showMeButton(page, s1).click();
    await expect(canvasFrame(page)).toHaveAttribute("data-vision", "deutan");
    await expect(vision.getByRole("radio", { name: "deutan", exact: true })).toBeChecked();
    // The view stays when the highlight clears, as the mode does.
    await showMeButton(page, s1).click();
    await expect(canvasRegion(page)).not.toHaveAttribute("data-show-me", /.+/);
    await expect(canvasFrame(page)).toHaveAttribute("data-vision", "deutan");
  });

  test("F-CANVAS-11 the outline holds through view changes and clears on another finding, a second press, or a fix", async ({
    page,
  }) => {
    const spec = stepFixture();
    await openStudio(page, linkOf(spec));
    const n3 = keyOf(spec, "N3", "light", "border/background");
    const k1 = keyOf(spec, "K1", "light", "primary-50/primary-100");
    await showMeButton(page, n3).click();
    const toolbar = page.getByRole("region", { name: "Canvas toolbar" });
    const holds = async (name: string) => {
      const report = await outlineReport(page, ["border", "background"]);
      expect(report.missing, name).toEqual([]);
      expect(report.stray, name).toEqual([]);
      expect(report.shown, name).toBeGreaterThan(0);
    };
    await holds("shown");
    await toolbar
      .getByRole("group", { name: "Density" })
      .getByRole("radio", { name: "dense" })
      .check();
    await holds("density");
    await toolbar
      .getByRole("group", { name: "Vision" })
      .getByRole("radio", { name: "deutan" })
      .check();
    await holds("vision");
    await toolbar
      .getByRole("group", { name: "Copy" })
      .getByRole("radio", { name: "Edge-case copy" })
      .check();
    await holds("copy");
    await toolbar.getByRole("group", { name: "Frame" }).getByRole("radio", { name: "768" }).check();
    await holds("frame");
    await showTemplate(page, "dashboard");
    await holds("template");
    await modeSwitch(page).click();
    await holds("mode");
    // Another finding: the step finding outlines cells, and the canvas outline clears.
    await showMeButton(page, k1).click();
    await expect(showMeButton(page, n3)).toHaveAttribute("aria-pressed", "false");
    await expect(showMeButton(page, k1)).toHaveAttribute("aria-pressed", "true");
    const cleared = await outlineReport(page, ["border", "background"]);
    expect(cleared.shown).toBe(0);
    expect(cleared.stray).toEqual([]);
    await expect(canvasRegion(page)).not.toHaveAttribute("data-show-me", /.+/);
    // A second press clears it.
    await showMeButton(page, k1).click();
    await expect(showMeButton(page, k1)).toHaveAttribute("aria-pressed", "false");
    await expect(inspector(page).locator("[data-show-me-cell]")).toHaveCount(0);
  });

  test("F-CANVAS-11 a finding that leaves the list takes its outline with it", async ({ page }) => {
    const spec = ringFixture();
    await openStudio(page, linkOf(spec));
    const key = keyOf(spec, "F1", "light", "ring/background");
    await showMeButton(page, key).click();
    await expect(canvasRegion(page)).toHaveAttribute("data-show-me", "ring background");
    await findingItem(page, key).getByRole("button", { name: "Raise contrast to AAA" }).click();
    await settled(page);
    await expect(findingItem(page, key)).toHaveCount(0);
    await expect(canvasRegion(page)).not.toHaveAttribute("data-show-me", /.+/);
    const report = await outlineReport(page, ["ring", "background"]);
    expect(report.shown).toBe(0);
  });

  test("F-INSP-07 a step finding outlines its scale cells and scrolls them into view", async ({
    page,
  }) => {
    const spec = stepFixture();
    await openStudio(page, linkOf(spec));
    const key = keyOf(spec, "K1", "light", "primary-50/primary-100");
    await showMeButton(page, key).click();
    const cells = inspector(page).locator("[data-show-me-cell]");
    await expect(cells).toHaveCount(2);
    expect(
      await cells.evaluateAll((items) =>
        items.map(
          (item) =>
            `${item.closest("[data-palette]")?.getAttribute("data-palette")} ${item.getAttribute("data-step")}`,
        ),
      ),
    ).toEqual(["primary 50", "primary 100"]);
    const style = await cells.first().evaluate((element) => {
      const computed = getComputedStyle(element);
      return [
        computed.outlineStyle,
        computed.outlineWidth,
        computed.outlineOffset,
        computed.outlineColor,
      ];
    });
    expect(style).toEqual(["dashed", "2px", "2px", "rgb(246, 108, 109)"]);
    // In view inside the scroll area.
    await expect
      .poll(() =>
        cells.first().evaluate((element) => {
          const area = element.closest("[data-scroll-area]");
          if (area === null) return false;
          const box = element.getBoundingClientRect();
          const view = area.getBoundingClientRect();
          return box.top >= view.top - 1 && box.bottom <= view.bottom + 1;
        }),
      )
      .toBe(true);
    await expect(canvasRegion(page)).not.toHaveAttribute("data-show-me", /.+/);
  });

  test("F-INSP-07 a finding in the other mode shows the canvas in its mode", async ({ page }) => {
    await stubSeeds(page);
    await openStudio(page);
    await expect(canvasFrame(page)).toHaveAttribute("data-mode", "light");
    await showMeButton(page, keyOf(first(), "N3", "dark", "border/background")).click();
    await expect(canvasFrame(page)).toHaveAttribute("data-mode", "dark");
    await expect(modeSwitch(page)).toHaveAttribute("aria-checked", "true");
  });

  test("F-INSP-07 at 360 px a pair finding closes the drawer to show the outline; a step finding keeps it", async ({
    page,
  }) => {
    await page.setViewportSize(PHONE);
    const spec = stepFixture();
    await openStudio(page, linkOf(spec));
    await openInspector(page);
    const n3 = keyOf(spec, "N3", "light", "border/background");
    await showMeButton(page, n3).click();
    await expect(inspectorAside(page)).toBeHidden();
    await expect(button(page, "Inspector")).toBeFocused();
    const report = await outlineReport(page, ["border", "background"]);
    expect(report.missing).toEqual([]);
    expect(report.shown).toBeGreaterThan(0);
    await openInspector(page);
    await expect(showMeButton(page, n3)).toHaveAttribute("aria-pressed", "true");
    await showMeButton(page, keyOf(spec, "K2", "light", "primary-50/primary-100")).click();
    await expect(inspectorAside(page)).toBeVisible();
    await expect(inspector(page).locator("[data-show-me-cell]")).toHaveCount(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      360,
    );
  });

  test("F-INSP-15 T1 and T4 each outline a part on screen in every template", async ({ page }) => {
    const spec = tasteFixture();
    await openStudio(page, linkOf(spec));
    for (const [id, subject, token] of [
      ["T1", "display", "font-display"],
      ["T4", "body", "font-body"],
    ] as const) {
      await showMeButton(page, keyOf(spec, id, "light", subject)).click();
      await expect(canvasRegion(page)).toHaveAttribute("data-show-me", token);
      for (const template of TEMPLATES) {
        const root = await showTemplate(page, template);
        const face = token === "font-display" ? "display" : "body";
        if (template === "mobile") {
          await eachTab(root, async (tab) => {
            const report = await outlineReport(page, [token]);
            expect(report.missing, `${id} mobile ${tab}`).toEqual([]);
            expect(report.stray, `${id} mobile ${tab}`).toEqual([]);
            expect(report.shown, `${id} mobile ${tab}`).toBeGreaterThan(0);
          });
          // Each screen, and the open sheet, read on their own (M-5).
          for (const screen of SCREENS) {
            const report = await outlineReport(page, [token], screenOf(root, screen));
            expect(report.missing, `${id} mobile ${screen}`).toEqual([]);
            expect(report.stray, `${id} mobile ${screen}`).toEqual([]);
            expect(report.shown, `${id} mobile ${screen}`).toBeGreaterThan(0);
          }
          const carriers = await hiddenCarriers(root, face);
          expect(carriers.read, `${id} mobile texts`).toBeGreaterThan(3);
          expect(carriers.misses, `${id} mobile`).toEqual([]);
          const sheet = await openSheet(root);
          const inSheet = await outlineReport(page, [token], sheet);
          expect(inSheet.missing, `${id} mobile sheet`).toEqual([]);
          expect(inSheet.stray, `${id} mobile sheet`).toEqual([]);
          expect(inSheet.shown, `${id} mobile sheet`).toBeGreaterThan(0);
          await page.keyboard.press("Escape");
          await expect(sheet).toHaveCount(0);
          continue;
        }
        const report = await outlineReport(page, [token]);
        expect(report.missing, `${id} ${template}`).toEqual([]);
        expect(report.stray, `${id} ${template}`).toEqual([]);
        expect(report.shown, `${id} ${template}`).toBeGreaterThan(0);
        if (template !== "kitchen-sink") {
          // Every text in the face has a carrier whose outline shows past .canvas-fit (I-1).
          const carriers = await hiddenCarriers(root, face);
          expect(carriers.read, `${id} ${template} texts`).toBeGreaterThan(3);
          expect(carriers.misses, `${id} ${template}`).toEqual([]);
        }
      }
      await showTemplate(page, "landing");
    }
  });
});

test.describe("7.8 Fixes", () => {
  test("F-INSP-09 a fix raises the contrast, clears the finding, names the outcome, keeps focus, and Undo brings it back", async ({
    page,
  }) => {
    const spec = ringFixture();
    await openStudio(page, linkOf(spec));
    const key = keyOf(spec, "F1", "light", "ring/background");
    const item = findingItem(page, key);
    await expect(item).toContainText("Focus ring under 3:1");
    const fix = item.getByRole("button", { name: "Raise contrast to AAA", exact: true });
    await expect(fix).toBeVisible();
    await expect(item).toContainText("Regenerates every color at AAA.");
    // The section's status region is there before any outcome, empty (I-2).
    await expect(findingsStatus(page)).toHaveCount(1);
    await expect(findingsStatus(page)).toBeEmpty();
    // From the keyboard: the button leaves with its finding, and focus moves to the Findings heading.
    await fix.focus();
    await page.keyboard.press("Enter");
    await settled(page);
    await expect(findingItem(page, key)).toHaveCount(0);
    await expect(findingsHeading(page)).toBeFocused();
    await expect(findingsStatus(page)).toHaveText(
      "Contrast raised to AAA. The finding is cleared.",
    );
    const contrast = page
      .getByRole("complementary", { name: "Inputs" })
      .getByRole("group", { name: "Contrast level", exact: true });
    await expect(contrast.getByRole("radio", { name: "AAA", exact: true })).toBeChecked();
    for (const mode of MODES) {
      const ratio = await region(page, "Roles")
        .locator(`tbody[data-pair="ring/background"] tr[data-mode="${mode}"] [data-ratio]`)
        .textContent();
      expect(Number(ratio), mode).toBeGreaterThanOrEqual(3);
    }
    await expect(inspector(page).getByText("did not clear")).toHaveCount(0);
    await button(page, "Undo").click();
    await settled(page);
    await expect(findingItem(page, key)).toBeVisible();
    await expect(contrast.getByRole("radio", { name: "AA", exact: true })).toBeChecked();
    // The outcome named the spec it came with; the next spec empties the region.
    await expect(findingsStatus(page)).toBeEmpty();
  });

  test("F-INSP-09 in the 360 px drawer a fix keeps focus inside the inspector", async ({
    page,
  }) => {
    await page.setViewportSize(PHONE);
    const spec = ringFixture();
    await openStudio(page, linkOf(spec));
    await openInspector(page);
    const key = keyOf(spec, "F1", "light", "ring/background");
    const fix = findingItem(page, key).getByRole("button", { name: "Raise contrast to AAA" });
    await fix.focus();
    await page.keyboard.press("Enter");
    await settled(page);
    await expect(findingItem(page, key)).toHaveCount(0);
    await expect(inspectorAside(page)).toBeVisible();
    await expect(findingsHeading(page)).toBeFocused();
    await expect(findingsStatus(page)).toHaveText(
      "Contrast raised to AAA. The finding is cleared.",
    );
    expect(
      await page.evaluate(() => document.activeElement?.closest("aside#studio-inspector") != null),
    ).toBe(true);
  });

  test("F-INSP-09 F-STUDIO-23 a focused Show me whose finding leaves the list gives focus to the Findings heading", async ({
    page,
  }) => {
    const spec = ringFixture();
    await openStudio(page, linkOf(spec));
    const key = keyOf(spec, "F1", "light", "ring/background");
    const show = showMeButton(page, key);
    await show.focus();
    await page.keyboard.press("Space");
    await expect(show).toHaveAttribute("aria-pressed", "true");
    await expect(show).toBeFocused();
    // A regeneration that clears F1, from a control that takes no focus (a scripted click on AAA).
    await page
      .getByRole("complementary", { name: "Inputs" })
      .getByRole("group", { name: "Contrast level", exact: true })
      .getByRole("radio", { name: "AAA", exact: true })
      .evaluate((radio) => (radio as HTMLInputElement).click());
    await settled(page);
    await expect(findingItem(page, key)).toHaveCount(0);
    await expect(findingsHeading(page)).toBeFocused();
    await expect(canvasRegion(page)).not.toHaveAttribute("data-show-me", /.+/);
  });

  test("F-INSP-10 at AAA a fixable finding says the contrast is already AAA and has no button", async ({
    page,
  }) => {
    const spec = ringFixture("AAA");
    await openStudio(page, linkOf(spec));
    const item = findingItem(page, keyOf(spec, "F1", "light", "ring/background"));
    await expect(item).toContainText("Contrast is already AAA.");
    await expect(item.getByRole("button", { name: /^Raise contrast/ })).toHaveCount(0);
    await expect(item.getByRole("button", { name: "Show me", exact: true })).toBeVisible();
  });
});

test.describe("7.8 Fonts", () => {
  test("F-INSP-11 F-INSP-12 a family that fails to load is named, the canvas keeps its fallback and does not shift", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const host = window as unknown as { __shifts: { value: number; canvas: boolean }[] };
      host.__shifts = [];
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as (PerformanceEntry & {
          value: number;
          hadRecentInput: boolean;
          sources?: { node?: Node | null }[];
        })[]) {
          if (entry.hadRecentInput) continue;
          const canvas = (entry.sources ?? []).some(
            (source) =>
              source.node instanceof Element && source.node.closest("[data-canvas]") !== null,
          );
          host.__shifts.push({ value: entry.value, canvas });
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
    let aborted = 0;
    await page.route("**/fonts/unbounded/**", async (route) => {
      aborted++;
      await route.abort();
    });
    await stubSeeds(page);
    await openStudio(page);
    expect(first().type.families.display).toBe("unbounded");
    const status = inspector(page).locator('[role="status"][data-font-status]');
    await expect(status).toHaveText(
      "Unbounded did not load. The canvas uses the system sans-serif instead.",
    );
    expect(aborted).toBeGreaterThan(0);
    // The canvas keeps the family's stack and renders with its fallback.
    const display = await canvasFrame(page).evaluate((frame) =>
      getComputedStyle(frame).getPropertyValue("--font-display").trim(),
    );
    expect(display).toBe(fontStack("unbounded"));
    expect(
      await page.evaluate(() =>
        [...document.fonts].some(
          (face) => face.family.replaceAll('"', "") === "Unbounded" && face.status === "loaded",
        ),
      ),
    ).toBe(false);
    const root = templateRoot(page, "landing");
    expect((await overflow(root)).past).toEqual([]);
    await page.waitForTimeout(1000);
    const shifts = await page.evaluate(
      () => (window as unknown as { __shifts: { value: number; canvas: boolean }[] }).__shifts,
    );
    const canvasShift = shifts.filter((shift) => shift.canvas).reduce((sum, s) => sum + s.value, 0);
    expect(canvasShift, JSON.stringify(shifts)).toBeLessThanOrEqual(0.1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      1280,
    );
    await page.setViewportSize(PHONE);
    await openInspector(page);
    await expect(status).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      360,
    );
    // The fallback phrase never breaks at its hyphen (fix round 1, M-3 and C12).
    const phrase = status.getByText("the system sans-serif", { exact: true });
    await expect(phrase).toHaveCount(1);
    expect(await phrase.evaluate((element) => element.getClientRects().length)).toBe(1);
  });

  test("F-INSP-11 the status is empty while every family loads", async ({ page }) => {
    await stubSeeds(page);
    await openStudio(page);
    await page.waitForTimeout(500);
    await expect(inspector(page).locator('[role="status"][data-font-status]')).toHaveText("");
  });
});

test.describe("7.8 Keyboard and motion", () => {
  test("F-INSP-14 the inspector scrolls inside its column and every control is reachable by keyboard", async ({
    page,
  }) => {
    await stubSeeds(page);
    await openStudio(page);
    const area = scrollArea(page);
    const sizes = await area.evaluate((element) => ({
      scroll: element.scrollHeight,
      client: element.clientHeight,
      page: document.documentElement.scrollHeight,
      window: window.innerHeight,
    }));
    expect(sizes.scroll).toBeGreaterThan(sizes.client);
    expect(sizes.page).toBeLessThanOrEqual(sizes.window);
    // The scroll area keeps Space and the arrows: they scroll it and fire no shortcut.
    await button(page, "Regenerate").click();
    await settled(page);
    const lot = await lotId(page).textContent();
    const seeds = await seedCalls(page);
    await area.focus();
    const top = () => area.evaluate((element) => element.scrollTop);
    await page.keyboard.press("Space");
    await expect.poll(top).toBeGreaterThan(0);
    for (const key of ["ArrowLeft", "ArrowRight", "ArrowDown", "Space"]) {
      await page.keyboard.press(key);
    }
    await page.waitForTimeout(400);
    expect(await seedCalls(page)).toBe(seeds);
    await expect(lotId(page)).toHaveText(lot ?? "");
    await expect(button(page, "Redo")).toHaveAttribute("aria-disabled", "true");
    // On the ring fixture, Tab from the area reaches each finding's "Show me" and fix button in order.
    await page.goto("about:blank");
    const ring = ringFixture();
    await openStudio(page, linkOf(ring));
    const stops = lintSpec(ring).flatMap((finding) => {
      const key = findingKey(finding);
      const show = showMeButton(page, key);
      return finding.id === "F1"
        ? [show, findingItem(page, key).getByRole("button", { name: "Raise contrast to AAA" })]
        : [show];
    });
    expect(stops.length).toBeGreaterThan(5);
    await scrollArea(page).focus();
    for (const stop of stops) {
      await page.keyboard.press("Tab");
      await expect(stop).toBeFocused();
    }
  });

  test("F-INSP-16 under reduced motion show me, a fix and the drawer start no motion in the canvas", async ({
    page,
  }) => {
    const spec = ringFixture();
    const key = keyOf(spec, "F1", "light", "ring/background");
    for (const setting of ["system", "switch"] as const) {
      await page.goto("about:blank");
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.emulateMedia({ reducedMotion: setting === "system" ? "reduce" : "no-preference" });
      await openStudio(page, linkOf(spec));
      await canvasAtRest(page);
      if (setting === "switch") {
        await page.getByRole("switch", { name: "Reduce motion", exact: true }).click();
        await canvasAtRest(page);
      }
      const show = showMeButton(page, key);
      expect(await canvasMotion(page, () => show.click()), `${setting} show`).toEqual([]);
      expect(await canvasMotion(page, () => show.click()), `${setting} clear`).toEqual([]);
      const fix = findingItem(page, key).getByRole("button", { name: "Raise contrast to AAA" });
      expect(
        await canvasMotion(page, async () => {
          await fix.click();
          await settled(page);
        }),
        `${setting} fix`,
      ).toEqual([]);
      await page.setViewportSize({ width: 1100, height: 800 });
      expect(await canvasMotion(page, () => openInspector(page)), `${setting} open`).toEqual([]);
      expect(
        await canvasMotion(page, () => page.keyboard.press("Escape")),
        `${setting} close`,
      ).toEqual([]);
    }
  });
});

/** The canvas frame's fit and layout width now. */
function fitNow(page: Page): Promise<{ fit: number; width: number }> {
  return canvasFrame(page).evaluate((frame) => ({
    fit: frame.getBoundingClientRect().width / (frame as HTMLElement).offsetWidth,
    width: (frame as HTMLElement).offsetWidth,
  }));
}

/**
 * Switches the template from inside the page and reads the frame's fit and width on the first
 * animation frame after the switch, then again at rest (M-1 of the Task 2.10a review, round 3).
 */
function switchFit(page: Page, to: TemplateId) {
  return page.evaluate(
    (to) =>
      new Promise<{ first: { fit: number; width: number }; rest: { fit: number; width: number } }>(
        (resolve, reject) => {
          const select = [
            ...document.querySelectorAll<HTMLSelectElement>("[data-toolbar] select"),
          ].find((element) => element.labels?.[0]?.textContent === "Template");
          const frame = document.querySelector<HTMLElement>("[data-canvas][data-frame]");
          if (select === undefined || frame === null) {
            reject(new Error("switchFit: no Template select or frame"));
            return;
          }
          const read = () => ({
            fit: frame.getBoundingClientRect().width / frame.offsetWidth,
            width: frame.offsetWidth,
          });
          select.value = to;
          select.dispatchEvent(new Event("change", { bubbles: true }));
          requestAnimationFrame(() => {
            const firstFrame = read();
            setTimeout(() => resolve({ first: firstFrame, rest: read() }), 600);
          });
        },
      ),
    to,
  );
}

test.describe("7.7 The mobile fit with the inspector (F-TPL-32)", () => {
  test("F-TPL-32 the mobile fit holds with the inspector drawer, and shows from the first frame of a switch", async ({
    page,
  }) => {
    await stubSeeds(page);
    await openStudio(page);
    for (const viewport of [{ width: 1100, height: 800 }, PHONE]) {
      await page.setViewportSize(viewport);
      await showTemplate(page, "mobile");
      await expect.poll(async () => (await fitNow(page)).fit).toBeGreaterThanOrEqual(0.95);
      await openInspector(page);
      expect((await fitNow(page)).fit, `${viewport.width} open`).toBeGreaterThanOrEqual(0.95);
      await page.keyboard.press("Escape");
      await expect(inspectorAside(page)).toBeHidden();
      expect((await fitNow(page)).fit, `${viewport.width} closed`).toBeGreaterThanOrEqual(0.95);
      await showTemplate(page, "landing");
    }
    for (const viewport of [PHONE, { width: 764, height: 900 }]) {
      await page.setViewportSize(viewport);
      await showTemplate(page, "landing");
      await page.waitForTimeout(300);
      for (const to of ["mobile", "landing"] as const) {
        const { first: firstFrame, rest } = await switchFit(page, to);
        const name = `${viewport.width}×${viewport.height} to ${to}`;
        expect(firstFrame.width, `${name}: width`).toBe(rest.width);
        expect(
          Math.abs(firstFrame.fit - rest.fit),
          `${name}: fit ${firstFrame.fit} then ${rest.fit}`,
        ).toBeLessThan(0.001);
      }
    }
  });
});

test("F-INSP-02 F-INSP-14 the inspector drawer scrolls inside itself at 360 px and keeps the page from scrolling sideways", async ({
  page,
}) => {
  await page.setViewportSize(PHONE);
  await openStudio(page);
  await openInspector(page);
  const area = scrollArea(page);
  const sizes = await area.evaluate((element) => ({
    scroll: element.scrollHeight,
    client: element.clientHeight,
    width: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  expect(sizes.scroll).toBeGreaterThan(sizes.client);
  expect(sizes.width, "no sideways scroller inside").toBeLessThanOrEqual(sizes.clientWidth);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  // F-INSP-02: every value of the role table shows whole and apart in the 320 px drawer at 11 px.
  expect(await crowdedRoles(page)).toEqual([]);
});

test("F-INSP-14 F-A11Y-03 at 360 px the inspector drawer is walked by keyboard with the madder ring, and keeps focus on a click", async ({
  page,
}) => {
  await page.setViewportSize(PHONE);
  await stubSeeds(page);
  await openStudio(page);
  const keys = lintSpec(first()).map(findingKey);
  for (const mode of ["light", "dark"] as const) {
    if (mode === "dark") {
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await page.keyboard.press("Alt+KeyT");
    }
    await expect(canvasFrame(page)).toHaveAttribute("data-mode", mode);
    await openInspector(page);
    // Close, the scroll area, then each finding's "Show me", each with the 2 px madder ring.
    const stops = [
      button(page, "Close inspector"),
      scrollArea(page),
      ...keys.map((key) => showMeButton(page, key)),
    ];
    for (const stop of stops) {
      await page.keyboard.press("Tab");
      await expect(stop, mode).toBeFocused();
      const ring = await page.evaluate(() => {
        const style = getComputedStyle(document.activeElement as Element);
        return [style.outlineStyle, style.outlineWidth, style.outlineColor];
      });
      expect(ring, mode).toEqual(["solid", "2px", "rgb(246, 108, 109)"]);
    }
    // A click on the table's text keeps focus in the drawer, and Escape still closes it.
    await region(page, "Roles").locator("tbody[data-pair] th").first().click();
    expect(
      await page.evaluate(() => document.activeElement?.closest("aside#studio-inspector") != null),
      `${mode}: focus after a click inside`,
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(inspectorAside(page)).toBeHidden();
    await expect(button(page, "Inspector")).toBeFocused();
  }
});
