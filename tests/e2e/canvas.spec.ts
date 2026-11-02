import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { fontStack, hexToRgb, PAIRINGS, simulate, toHex } from "@/engine";
import { COPY, SAMPLE_PLACES } from "@/features/preview/copy";
import { frameFit } from "@/features/preview/frame";
import { writeHash } from "@/features/studio/url";
import type { TemplateId } from "@/features/studio/view";
import { normalizeSpec } from "@/spec";
import { themeVars } from "@/theme/vars";
import {
  canvasFrame,
  canvasPane,
  canvasRegion,
  canvasVars,
  designFor,
  expectedVars,
  FRESH,
  focusBody,
  lotId,
  lotOf,
  openStudio,
  seedCalls,
  seedOf,
  settled,
  stubSeeds,
} from "./studio-support";
import {
  brokenWords,
  figureLines,
  mobileOverflow,
  mountMotion,
  overflow,
  screenOf,
  setFrame,
  showTemplate,
  templateRoot,
} from "./template-support";

// The canvas flows of docs/specs/02-studio.md, section 7.4 (Task 2.7): F-CANVAS-01 to 10 and 12 to
// 19, with F-CANVAS-07 to 09 extended to the landing and editorial templates (Task 2.8), to the
// dashboard and settings templates (Task 2.9) and to the mobile template (Task 2.10a). F-CANVAS-11
// ("Show me") is driven from the inspector and lands with it in Task 2.10. A flow that names no
// viewport runs at 1280 × 800.

test.use({ viewport: { width: 1280, height: 800 } });

const PHONE = { width: 360, height: 740 };
const MODES = ["light", "dark"] as const;
const ROOT = path.resolve(import.meta.dirname, "../..");

/** The design of the first load when `stubSeeds` draws the seeds. */
const first = () => designFor(FRESH, seedOf(1));

const toolbar = (page: Page) => page.getByRole("region", { name: "Canvas toolbar" });
const toolbarRadio = (page: Page, group: string, name: string) =>
  toolbar(page)
    .getByRole("group", { name: group, exact: true })
    .getByRole("radio", { name, exact: true });
const templateSelect = (page: Page) =>
  toolbar(page).getByRole("combobox", { name: "Template", exact: true });
const reduceMotion = (page: Page) =>
  page.getByRole("switch", { name: "Reduce motion", exact: true });
const modeSwitch = (page: Page) => page.getByRole("switch", { name: "Dark mode", exact: true });

/** The page templates of sections 7.6 and 7.7 (Tasks 2.8 and 2.9): they follow the frame switcher. */
const PAGES = ["landing", "editorial", "dashboard", "settings"] as const;
/** A template other than `id`, shown first so that `id` mounts afresh. */
const elsewhere = (id: TemplateId): TemplateId => (id === "landing" ? "editorial" : "landing");

/** Opens the studio on the first stubbed design and shows the kitchen sink. */
async function openSink(page: Page): Promise<void> {
  await stubSeeds(page);
  await openStudio(page);
  await templateSelect(page).selectOption("kitchen-sink");
  await expect(canvasPane(page, "dark")).toBeAttached();
  const { display, body, mono } = first().type.families;
  await expect.poll(() => fontsLoaded(page, [display, body, mono])).toBe(true);
}

/** The family name a catalog id loads under: the first entry of its stack. */
const familyOf = (id: string) => (fontStack(id).match(/^"([^"]+)"/) ?? [])[1] ?? id;

/** Whether the document holds a loaded face for each of the catalog ids. */
function fontsLoaded(page: Page, ids: readonly string[]): Promise<boolean> {
  return page.evaluate(
    (names) =>
      names.every((name) =>
        [...document.fonts].some(
          (face) => face.family.replaceAll('"', "") === name && face.status === "loaded",
        ),
      ),
    ids.map(familyOf),
  );
}

/** The `#rrggbb` of a color custom property computed on `target`. */
function computedVar(target: Locator, name: string): Promise<string> {
  return target.evaluate((element, property) => {
    const probe = document.createElement("span");
    probe.style.color = `var(${property})`;
    element.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, name);
}

/** The chrome's own colors: every value declared in the `:root` block of src/app/globals.css. */
function chromeColors(): string[] {
  const css = readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8");
  const root = css.match(/:root\s*\{([^}]*)\}/)?.[1] ?? "";
  const hexes = [...root.matchAll(/#[0-9a-f]{6}\b/gi)].map((match) => match[0].toLowerCase());
  const rgbs = [...root.matchAll(/rgb\((\d+) (\d+) (\d+)(?: \/ ([\d.]+))?\)/g)].map(
    ([, r, g, b, a]) =>
      a === undefined ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`,
  );
  const channels = (hex: string) =>
    [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16)).join(", ");
  return [...hexes.map((hex) => `rgb(${channels(hex)})`), ...rgbs];
}

test.describe("7.4 The canvas on the kitchen sink", () => {
  test.describe.configure({ mode: "serial" });
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    // A page of its own context: axe's builder needs one.
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    page = await context.newPage();
    await openSink(page);
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  test("F-CANVAS-01 the frame and each pane carry exactly their variables", async () => {
    const spec = first();
    expect(await canvasVars(page)).toEqual(expectedVars(spec, "light"));
    expect(Object.keys(await canvasVars(page))).toHaveLength(206);
    for (const mode of MODES) {
      expect(await canvasVars(page, canvasPane(page, mode)), mode).toEqual(
        expectedVars(spec, mode),
      );
      await expect(canvasPane(page, mode)).toHaveAttribute("data-mode", mode);
    }
  });

  test("F-CANVAS-01 no computed color inside the canvas is a chrome color", async () => {
    const spec = first();
    const specColors: string[] = MODES.flatMap((mode) => [
      ...Object.values(spec.color.roles[mode]),
      ...Object.values(spec.color.palettes).flatMap((palette) =>
        palette[mode].map((step) => step.hex),
      ),
    ]);
    const report = await canvasFrame(page).evaluate(
      (frame, { chrome, skip }) => {
        const hexOf = (color: string) => {
          const [r = 0, g = 0, b = 0] = (color.match(/[\d.]+/g) ?? []).map(Number);
          return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
        };
        const ringOf = (element: Element) => {
          const canvas = element.closest("[data-pane]") ?? frame;
          const probe = document.createElement("span");
          probe.style.color = "var(--ring)";
          canvas.append(probe);
          const ring = getComputedStyle(probe).color;
          probe.remove();
          return ring;
        };
        const hits: string[] = [];
        let checked = 0;
        for (const element of [frame, ...frame.querySelectorAll("*")]) {
          const style = getComputedStyle(element);
          const colors: [string, string][] = [
            ["color", style.color],
            ["background-color", style.backgroundColor],
            ["outline-color", style.outlineColor],
            ["fill", style.fill],
            ["stroke", style.stroke],
            ["caret-color", style.caretColor],
            ["text-decoration-color", style.textDecorationColor],
          ];
          for (const side of ["Top", "Right", "Bottom", "Left"] as const) {
            colors.push([`border-${side.toLowerCase()}-color`, style[`border${side}Color`]]);
          }
          for (const match of style.boxShadow.matchAll(/rgba?\([^)]*\)/g)) {
            colors.push(["box-shadow", match[0]]);
          }
          for (const [property, value] of colors) {
            checked++;
            if (!value.startsWith("rgb")) continue;
            if (skip.includes(hexOf(value))) continue;
            if (chrome.includes(value)) hits.push(`${element.tagName} ${property} ${value}`);
          }
          if (style.outlineColor !== ringOf(element)) {
            hits.push(`${element.tagName} outline-color ${style.outlineColor} is not --ring`);
          }
        }
        return { hits, checked };
      },
      { chrome: chromeColors(), skip: specColors },
    );
    expect(report.checked).toBeGreaterThan(5000);
    expect(report.hits).toEqual([]);
  });

  test("F-CANVAS-12 inside the canvas the browser surfaces follow the spec", async () => {
    for (const mode of MODES) {
      const pane = canvasPane(page, mode);
      const surfaces = await pane.evaluate((element) => {
        const style = getComputedStyle(element);
        const input = element.querySelector('[data-kit="input"][data-state="default"]');
        const text = element.querySelector("p");
        const link = element.querySelector('[data-kit="button"][data-variant="link"]');
        if (input === null || text === null || link === null) return null;
        const selection = getComputedStyle(text, "::selection");
        return {
          scheme: style.colorScheme,
          scrollbar: style.scrollbarColor,
          numerals: style.fontVariantNumeric,
          caret: getComputedStyle(input).caretColor,
          selection: [selection.backgroundColor, selection.color],
          underline: getComputedStyle(link).textUnderlineOffset,
        };
      });
      expect(surfaces, mode).not.toBeNull();
      const [primary, onPrimary, border, muted] = await Promise.all(
        ["--primary", "--primary-foreground", "--border", "--muted"].map((name) =>
          computedVar(pane, name),
        ),
      );
      expect(surfaces?.scheme, mode).toBe(mode);
      expect(surfaces?.scrollbar, mode).toBe(`${border} ${muted}`);
      expect(surfaces?.numerals, mode).toContain("tabular-nums");
      expect(surfaces?.caret, mode).toBe(primary);
      expect(surfaces?.selection, mode).toEqual([primary, onPrimary]);
      expect(surfaces?.underline, mode).not.toBe("auto");
    }
    const frameScheme = await canvasFrame(page).evaluate(
      (element) => getComputedStyle(element).colorScheme,
    );
    expect(frameScheme).toBe("light");
  });

  test("F-CANVAS-15 a focused canvas control shows --ring, never madder", async () => {
    for (const mode of MODES) {
      const pane = canvasPane(page, mode);
      const ring = await computedVar(pane, "--ring");
      const box = pane.locator('[data-kit="checkbox"][data-state="default"]');
      const tab = pane.locator('[data-kit-demo="tabs"]').getByRole("tab", { selected: true });
      for (const target of [box, tab]) {
        // A key press first, so the focus that follows is :focus-visible, as from the keyboard.
        await page.keyboard.press("Shift");
        await target.focus();
        await expect(target).toBeFocused();
        const outline = await target.evaluate((element) => {
          const style = getComputedStyle(element);
          return [style.outlineStyle, style.outlineWidth, style.outlineColor];
        });
        expect(outline, mode).toEqual(["solid", "2px", ring]);
        expect(outline[2]).not.toBe("rgb(246, 108, 109)");
      }
    }
  });

  test("F-CANVAS-13 the canvas region scrolls by keyboard and keeps its keys", async () => {
    await expect(canvasRegion(page)).toHaveAttribute("tabindex", "0");
    const axe = await new AxeBuilder({ page })
      .include("main")
      .withRules(["scrollable-region-focusable"])
      .analyze();
    expect(axe.violations).toEqual([]);
    const lot = await lotId(page).textContent();
    const seeds = await seedCalls(page);
    await canvasRegion(page).evaluate((region) => region.scrollTo(0, 0));
    await canvasRegion(page).focus();
    const top = () => canvasRegion(page).evaluate((region) => region.scrollTop);
    await page.keyboard.press("Space");
    await expect.poll(top).toBeGreaterThan(100);
    const afterSpace = await top();
    await page.keyboard.press("ArrowDown");
    await expect.poll(top).toBeGreaterThan(afterSpace);
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(300);
    await expect(lotId(page)).toHaveText(lot ?? "");
    expect(await seedCalls(page)).toBe(seeds);
    await expect(page.getByRole("button", { name: "Redo", exact: true })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await canvasRegion(page).evaluate((region) => region.scrollTo(0, 0));
  });

  test("F-CANVAS-02 the frame switcher sets the frame width and the layout follows by container query", async () => {
    const layout = () =>
      page.evaluate(() => {
        const [light, dark] = ["light", "dark"].map((mode) =>
          document.querySelector<HTMLElement>(`[data-pane="${mode}"]`),
        );
        return {
          frame: document.querySelector<HTMLElement>("[data-canvas][data-frame]")?.offsetWidth,
          light: [light?.offsetLeft, light?.offsetTop, light?.offsetWidth],
          dark: [dark?.offsetLeft, dark?.offsetTop, dark?.offsetWidth],
          kit: [...document.querySelectorAll<HTMLElement>("[data-pane='light'] [data-kit]")]
            .slice(0, 80)
            .map((element) => [element.offsetLeft, element.offsetTop, element.offsetWidth]),
        };
      });
    const wide = await layout();
    expect(wide.frame).toBe(1280);
    // Side by side at 1280 px: the panes share a top edge.
    expect(wide.dark[1]).toBe(wide.light[1]);
    expect(wide.dark[0] ?? 0).toBeGreaterThan(wide.light[0] ?? 0);
    for (const frame of [768, 360] as const) {
      await toolbarRadio(page, "Frame", String(frame)).check();
      await expect(canvasFrame(page)).toHaveAttribute("data-frame", String(frame));
      const narrow = await layout();
      expect(narrow.frame).toBe(frame);
      // Stacked below 1000 px: the dark pane sits under the light one.
      expect(narrow.dark[1] ?? 0, `${frame}`).toBeGreaterThan(narrow.light[1] ?? 0);
      expect(narrow.dark[0], `${frame}`).toBe(narrow.light[0]);
    }
    // At a fixed frame, the window's width does not move the layout: no media query reaches it.
    await toolbarRadio(page, "Frame", "768").check();
    const before = await layout();
    for (const viewport of [{ width: 1600, height: 800 }, { width: 1100, height: 800 }, PHONE]) {
      await page.setViewportSize(viewport);
      expect(await layout(), `${viewport.width} px`).toEqual(before);
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await toolbarRadio(page, "Frame", "1280").check();
  });

  test("F-CANVAS-02 the preview's style sheets hold no media query but reduced motion", () => {
    const dir = path.join(ROOT, "src/features/preview");
    const sheets = readdirSync(dir, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".css"))
      .map((entry) => readFileSync(path.join(entry.parentPath, entry.name), "utf8"));
    expect(sheets.length).toBeGreaterThan(0);
    const queries = sheets.flatMap((css) => [...css.matchAll(/@media([^{]*)\{/g)].map((m) => m[1]));
    expect(
      queries.every((query) => /^\s*\(prefers-reduced-motion: reduce\)\s*$/.test(query ?? "")),
    ).toBe(true);
    expect(sheets.some((css) => css.includes("@container"))).toBe(true);
  });

  test("F-CANVAS-03 a frame wider than the canvas area scales down and shows its fit", async () => {
    for (const viewport of [{ width: 1280, height: 800 }, PHONE]) {
      await page.setViewportSize(viewport);
      for (const frame of [1280, 768, 360] as const) {
        await toolbarRadio(page, "Frame", String(frame)).check();
        const available = await page
          .locator("[data-canvas-stage]")
          .evaluate((stage) => stage.clientWidth);
        const fit = frameFit(available, frame);
        await expect(toolbar(page).locator("[data-frame-fit]")).toHaveText(fit.label);
        const scaled = await page
          .locator("[data-canvas-scale]")
          .evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).a);
        expect(scaled, `${viewport.width} px, ${frame}`).toBeCloseTo(fit.scale, 4);
        const box = await canvasFrame(page).boundingBox();
        expect(box?.width ?? 0).toBeCloseTo(frame * fit.scale, 0);
        const scroll = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(scroll, `${viewport.width} px, ${frame}`).toBeLessThanOrEqual(viewport.width);
      }
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await toolbarRadio(page, "Frame", "1280").check();
  });

  test("F-CANVAS-05 the density group sets --control-height and the kit's control heights", async () => {
    for (const [density, height] of [
      ["compact", 36],
      ["dense", 32],
      ["comfortable", 40],
    ] as const) {
      await toolbarRadio(page, "Density", density).check();
      await expect(canvasFrame(page)).toHaveAttribute("data-density", density);
      expect((await canvasVars(page))["--control-height"]).toBe(`${height}px`);
      for (const mode of MODES) {
        const heights = await canvasPane(page, mode).evaluate((pane) =>
          [
            '[data-kit="button"][data-variant="primary"][data-state="default"]',
            '[data-kit="input"][data-state="default"]',
            '[data-kit="select"][data-state="default"]',
          ].map((selector) => pane.querySelector<HTMLElement>(selector)?.offsetHeight),
        );
        expect(heights, `${density} ${mode}`).toEqual([height, height, height]);
      }
    }
  });

  test("F-CANVAS-06 the vision group recomputes every canvas color through simulate", async () => {
    const spec = first();
    for (const vision of ["protan", "deutan", "tritan"] as const) {
      await toolbarRadio(page, "Vision", vision).check();
      await expect(canvasFrame(page)).toHaveAttribute("data-vision", vision);
      const vars = await canvasVars(page);
      const stored = spec.color.roles.light.destructive;
      expect(vars["--destructive"]).toBe(toHex(simulate(hexToRgb(stored), vision)));
      expect(vars).toEqual({
        ...themeVars(spec, "light", { vision, units: "cqi" }),
        "--density-offset": "0px",
        "--control-height": "40px",
      });
      for (const mode of MODES) {
        const pane = await canvasVars(page, canvasPane(page, mode));
        expect(pane["--primary"], `${vision} ${mode}`).toBe(
          toHex(simulate(hexToRgb(spec.color.roles[mode].primary), vision)),
        );
      }
    }
    await toolbarRadio(page, "Vision", "none").check();
    expect(await canvasVars(page)).toEqual(expectedVars(spec, "light"));
  });

  test("F-CANVAS-04 the mode toggle switches the frame between the light and dark variables", async () => {
    const spec = first();
    await modeSwitch(page).click();
    await expect(canvasFrame(page)).toHaveAttribute("data-mode", "dark");
    expect(await canvasVars(page)).toEqual(expectedVars(spec, "dark"));
    // The panes keep one mode each, whatever the toggle says.
    await expect(canvasPane(page, "light")).toHaveAttribute("data-mode", "light");
    await focusBody(page);
    await page.keyboard.press("Alt+KeyT");
    await expect(canvasFrame(page)).toHaveAttribute("data-mode", "light");
    expect(await canvasVars(page)).toEqual(expectedVars(spec, "light"));
  });

  test("F-CANVAS-09 edge-case copy swaps in every edge case and nothing overflows its frame", async () => {
    await toolbarRadio(page, "Copy", "Edge-case copy").check();
    await expect(canvasFrame(page)).toHaveAttribute("data-copy", "edge");
    const edge = COPY.edge;
    for (const mode of MODES) {
      const pane = canvasPane(page, mode);
      for (const text of [edge.word, edge.title, edge.person, edge.amount]) {
        await expect(
          pane.getByText(text, { exact: false }).first(),
          `${mode} ${text}`,
        ).toBeVisible();
      }
      await expect(pane.locator("[data-copy-label]").first()).toHaveText(edge.label);
      const list = pane.locator("[data-list]");
      await expect(list).toHaveAttribute("data-empty", "");
      await expect(list.locator("[data-list-item]")).toHaveCount(0);
    }
    for (const frame of [360, 768, 1280] as const) {
      await toolbarRadio(page, "Frame", String(frame)).check();
      // A figure never breaks: each reading on screen holds its number on one line.
      const lines = await canvasFrame(page).evaluate((element) =>
        [...element.querySelectorAll('[aria-label="Sample readings"] :is(td, dd).kit-num')]
          .filter((cell) => cell.getBoundingClientRect().width > 0)
          .map((cell) => {
            const range = document.createRange();
            range.selectNodeContents(cell);
            return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size;
          }),
      );
      expect(lines.length, `${frame}`).toBeGreaterThan(0);
      expect(new Set(lines), `${frame}`).toEqual(new Set([1]));
      // A place or an observer breaks only between words: every word of 20 characters or fewer
      // (a hyphen ends a word) sits on one line. Only the 40-character word may break anywhere.
      const words = await canvasFrame(page).evaluate(
        (element, names) => {
          const broken: string[] = [];
          let checked = 0;
          for (const scope of element.querySelectorAll('[aria-label="Sample readings"]')) {
            if (scope.getBoundingClientRect().width === 0) continue;
            const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
            for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
              const text = node.textContent ?? "";
              if (!names.some((name) => text.includes(name))) continue;
              for (const match of text.matchAll(/[^\s-]+-?/g)) {
                if (match[0].length > 20) continue;
                const range = document.createRange();
                range.setStart(node, match.index);
                range.setEnd(node, match.index + match[0].length);
                const rects = [...range.getClientRects()].filter((rect) => rect.width > 0);
                checked++;
                if (rects.length !== 1) broken.push(`${match[0]} in ${rects.length} pieces`);
              }
            }
          }
          return { checked, broken };
        },
        [...SAMPLE_PLACES, edge.person],
      );
      expect(words.checked, `${frame}`).toBeGreaterThan(10);
      expect(words.broken, `${frame}`).toEqual([]);
      const overflow = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>("[data-canvas]")].map((element) => [
          element.scrollWidth,
          element.clientWidth,
        ]),
      );
      expect(overflow.length).toBe(3);
      for (const [scroll = 0, client = 0] of overflow) {
        expect(scroll, `${frame}`).toBeLessThanOrEqual(client);
      }
    }
    await toolbarRadio(page, "Copy", "Real copy").check();
    await expect(canvasPane(page, "light").locator("[data-list-item]").first()).toHaveText(
      COPY.real.items[0] ?? "",
    );
  });

  test("F-CANVAS-10 the template choice holds across edits and view changes", async () => {
    await expect(templateSelect(page).locator("option")).toHaveText([
      "landing",
      "dashboard",
      "settings",
      "mobile",
      "editorial",
      "kitchen sink",
    ]);
    await page.getByRole("button", { name: "Regenerate", exact: true }).click();
    await expect(lotId(page)).toHaveText(lotOf(designFor(FRESH, seedOf(2))));
    await settled(page);
    await modeSwitch(page).click();
    await toolbarRadio(page, "Frame", "768").check();
    await toolbarRadio(page, "Density", "compact").check();
    await expect(templateSelect(page)).toHaveValue("kitchen-sink");
    await expect(canvasFrame(page)).toHaveAttribute("data-template", "kitchen-sink");
    await expect(canvasPane(page, "dark")).toBeAttached();
  });
});

test("F-CANVAS-10 the template switcher shows each of the six templates", async ({ page }) => {
  await openStudio(page);
  await expect(canvasFrame(page)).toHaveAttribute("data-template", "landing");
  for (const id of ["dashboard", "settings", "mobile", "editorial", "kitchen-sink", "landing"]) {
    await templateSelect(page).selectOption(id);
    await expect(canvasFrame(page)).toHaveAttribute("data-template", id);
    await expect(canvasFrame(page).locator(`[data-template-root="${id}"]`)).toBeVisible();
  }
});

/** Every computed animation and transition inside the canvas frame, after a beat. */
function motionReport(page: Page) {
  return canvasFrame(page).evaluate((frame) => {
    const running: string[] = [];
    let elements = 0;
    for (const element of [frame, ...frame.querySelectorAll("*")]) {
      for (const pseudo of [null, "::before", "::after"]) {
        const style = getComputedStyle(element, pseudo);
        elements++;
        if (style.animationName !== "none")
          running.push(`${element.tagName}${pseudo ?? ""} ${style.animationName}`);
        for (const value of style.transitionDuration.split(",")) {
          const ms = Number.parseFloat(value) * (value.trim().endsWith("ms") ? 1 : 1000);
          if (ms > 0.01 + 1e-9)
            running.push(`${element.tagName}${pseudo ?? ""} transition ${value}`);
        }
      }
    }
    return { running, elements };
  });
}

/**
 * Toggles the light pane's interactive switch and samples its thumb's position (the translation of
 * its computed transform) on every frame for 400 ms: a running spring passes through positions
 * between its two ends, while a stopped one only shows the two ends.
 */
async function thumbPath(page: Page): Promise<number[]> {
  const control = canvasPane(page, "light").locator('[data-kit-demo="switch"]');
  const samples = control.evaluate(
    (element) =>
      new Promise<number[]>((resolve) => {
        const thumb = element.querySelector("[data-thumb]");
        const seen: number[] = [];
        const start = performance.now();
        const tick = () => {
          if (thumb !== null) {
            const x = new DOMMatrix(getComputedStyle(thumb).transform).m41;
            seen.push(Math.round(x * 100) / 100);
          }
          if (performance.now() - start < 400) requestAnimationFrame(tick);
          else resolve(seen);
        };
        requestAnimationFrame(tick);
      }),
  );
  await control.click();
  return [...new Set(await samples)];
}

test.describe("7.4 Motion on the canvas", () => {
  test("F-CANVAS-07 Reduce motion stops the kit's animations, transitions and springs", async ({
    page,
  }) => {
    await openSink(page);
    // Without the switch the spring runs: the thumb passes through values between its ends.
    expect((await thumbPath(page)).length).toBeGreaterThan(2);
    expect((await motionReport(page)).running.length).toBeGreaterThan(0);
    await reduceMotion(page).click();
    await expect(reduceMotion(page)).toHaveAttribute("aria-checked", "true");
    await expect(canvasFrame(page)).toHaveAttribute("data-reduced-motion", "true");
    const report = await motionReport(page);
    expect(report.elements).toBeGreaterThan(1000);
    expect(report.running).toEqual([]);
    expect((await thumbPath(page)).length).toBeLessThanOrEqual(2);
    // The one entrance does not run either: it is in place at once.
    await templateSelect(page).selectOption("landing");
    await templateSelect(page).selectOption("kitchen-sink");
    const entrance = canvasFrame(page).locator("[data-entrance]");
    await expect(canvasFrame(page).locator("[data-entrance]")).toHaveCount(1);
    expect(await entrance.evaluate((element) => getComputedStyle(element).transform)).toBe("none");
    // An indeterminate bar that stops still reads as indeterminate: a pattern, not a 40 % fill.
    const sweep = canvasPane(page, "light").locator(
      '[data-kit="progress"][data-state="indeterminate"] > *',
    );
    expect(await sweep.evaluate((fill) => getComputedStyle(fill).backgroundImage)).not.toBe("none");
    // The switch is a view setting: it keeps the preview's own state and never replays the entrance.
    const box = canvasPane(page, "light").locator('[data-kit="checkbox"][data-state="default"]');
    await box.check();
    await reduceMotion(page).click();
    await expect(reduceMotion(page)).toHaveAttribute("aria-checked", "false");
    const opacities = await entrance.evaluate(
      (element) =>
        new Promise<number[]>((resolve) => {
          const seen: number[] = [];
          const start = performance.now();
          const tick = () => {
            seen.push(Number(getComputedStyle(element).opacity));
            if (performance.now() - start < 300) requestAnimationFrame(tick);
            else resolve(seen);
          };
          tick();
        }),
    );
    expect(new Set(opacities)).toEqual(new Set([1]));
    await expect(box).toBeChecked();
    // The kit mounted while motion was reduced; with the switch off its springs run again.
    expect((await thumbPath(page)).length).toBeGreaterThan(2);
  });

  test("F-CANVAS-08 prefers-reduced-motion does the same without the switch", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openSink(page);
    await expect(reduceMotion(page)).toHaveAttribute("aria-checked", "false");
    await expect(canvasFrame(page)).toHaveAttribute("data-reduced-motion", "false");
    expect((await motionReport(page)).running).toEqual([]);
    expect((await thumbPath(page)).length).toBeLessThanOrEqual(2);
  });
});

test("F-CANVAS-14 the fluid display size follows the frame, not the window", async ({ page }) => {
  await stubSeeds(page);
  await openStudio(page);
  await page
    .getByRole("complementary", { name: "Inputs" })
    .getByRole("combobox", { name: "Type context", exact: true })
    .selectOption("marketing");
  await settled(page);
  await templateSelect(page).selectOption("kitchen-sink");
  const clamp = (await canvasVars(page))["--text-display"] ?? "";
  const parts = clamp.match(/^clamp\(([\d.]+)rem, ([-\d.]+)rem \+ ([\d.]+)cqi, ([\d.]+)rem\)$/);
  expect(parts, clamp).not.toBeNull();
  const [min, intercept, slope, max] = (parts ?? []).slice(1).map(Number) as [
    number,
    number,
    number,
    number,
  ];
  const at = (width: number) =>
    Math.min(max * 16, Math.max(min * 16, intercept * 16 + (slope * width) / 100));
  const display = canvasPane(page, "light").locator('[data-token="text-display"]');
  const sizes: number[] = [];
  for (const frame of [360, 1280] as const) {
    await toolbarRadio(page, "Frame", String(frame)).check();
    const size = await display.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize),
    );
    expect(size, `${frame}`).toBeCloseTo(at(frame), 1);
    sizes.push(size);
  }
  expect(sizes[0]).not.toBeCloseTo(sizes[1] ?? 0, 0);
  // The same frame in a narrower window keeps the same size.
  await page.setViewportSize({ width: 1100, height: 800 });
  expect(
    await display.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
  ).toBeCloseTo(sizes[1] ?? 0, 1);
});

test("F-CANVAS-16 the canvas loads the spec's three families from /fonts/<id>/ with the FontFace API", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(new URL(request.url()).pathname));
  await stubSeeds(page);
  await openStudio(page);
  const { display, body, mono } = first().type.families;
  await expect.poll(() => fontsLoaded(page, [display, body, mono])).toBe(true);
  for (const id of [display, body, mono]) {
    expect(
      requests.some((url) => url.startsWith(`/fonts/${id}/`)),
      id,
    ).toBe(true);
  }
  const other = PAIRINGS.find((pairing) => pairing.display !== display && pairing.mono !== mono);
  if (other === undefined) throw new Error("no other pairing");
  await page
    .getByRole("complementary", { name: "Inputs" })
    .getByRole("combobox", { name: "Pairing", exact: true })
    .selectOption(other.id);
  await settled(page);
  await expect.poll(() => fontsLoaded(page, [other.display, other.mono])).toBe(true);
  expect(requests.some((url) => url.startsWith(`/fonts/${other.display}/`))).toBe(true);
});

test("F-CANVAS-16 a family outside the catalog loads nothing and keeps its fallback stack", async ({
  page,
}) => {
  const errors: string[] = [];
  const requests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => requests.push(new URL(request.url()).pathname));
  const spec = structuredClone(designFor(FRESH, "e2e-fonts"));
  const custom = normalizeSpec({
    ...spec,
    type: { ...spec.type, families: { ...spec.type.families, display: "harbor-display" } },
  });
  await openStudio(page, writeHash(custom));
  expect((await canvasVars(page))["--font-display"]).toBe(expectedVars(custom)["--font-display"]);
  await expect.poll(() => fontsLoaded(page, [custom.type.families.body])).toBe(true);
  expect(requests.some((url) => url.startsWith("/fonts/harbor-display/"))).toBe(false);
  expect(errors).toEqual([]);
  await expect(canvasFrame(page).locator("[data-template-root]")).toBeVisible();
});

/**
 * The canvas toolbar's rows and height: its items are its children, and the children of a
 * `display: contents` group among them; a row is a run of items that share a vertical center.
 */
function toolbarRows(page: Page) {
  return toolbar(page).evaluate((bar) => {
    const items = [...bar.children].flatMap((child) =>
      getComputedStyle(child).display === "contents" ? [...child.children] : [child],
    );
    const centers = items
      .map((item) => item.getBoundingClientRect())
      .filter((box) => box.width > 0 && box.height > 0)
      .map((box) => box.top + box.height / 2)
      .sort((a, b) => a - b);
    let rows = 0;
    let last = Number.NEGATIVE_INFINITY;
    for (const center of centers) {
      if (center - last > 6) rows++;
      last = center;
    }
    return { rows, height: bar.getBoundingClientRect().height };
  });
}

/** The toolbar's visible targets narrower than 24 px or shorter than 28 px. */
function smallTargets(page: Page) {
  return toolbar(page).evaluate((bar) =>
    [...bar.querySelectorAll("button, select, input, summary")]
      .map((target) => ({ target, box: target.getBoundingClientRect() }))
      .filter(({ box }) => box.width > 0 && box.height > 0)
      .filter(({ box }) => box.height < 28 || box.width < 24)
      .map(({ target, box }) => `${target.outerHTML.slice(0, 60)} ${box.width}×${box.height}`),
  );
}

test("F-CANVAS-17 at 1280 × 800 the toolbar takes at most 3 rows and 150 px, and the frame group describes its fit", async ({
  page,
}) => {
  await openStudio(page);
  // The longest template label and a scaled frame: the widest the toolbar gets.
  await templateSelect(page).selectOption("kitchen-sink");
  const { rows, height } = await toolbarRows(page);
  expect(rows).toBeLessThanOrEqual(3);
  expect(height).toBeLessThanOrEqual(150);
  const frame = toolbar(page).getByRole("group", { name: "Frame", exact: true });
  await expect(frame).toHaveAccessibleDescription(/^fit \d+%$/);
  await expect(page.getByRole("button", { name: "View", exact: true })).toBeHidden();
});

test("F-CANVAS-18 every toolbar target is at least 28 px tall and 24 px wide", async ({ page }) => {
  await openStudio(page);
  expect(await smallTargets(page), "1280 × 800").toEqual([]);
  await page.setViewportSize(PHONE);
  await page.getByRole("button", { name: "View", exact: true }).click();
  await expect(modeSwitch(page)).toBeVisible();
  expect(await smallTargets(page), "360 × 740, View open").toEqual([]);
});

test("F-CANVAS-19 below 640 px the view controls sit in a View disclosure", async ({ page }) => {
  await stubSeeds(page);
  await page.setViewportSize(PHONE);
  await openStudio(page);
  const view = page.getByRole("button", { name: "View", exact: true });
  await expect(view).toHaveAttribute("aria-expanded", "false");
  const controls = await view.getAttribute("aria-controls");
  expect(controls).not.toBeNull();
  const group = page.locator(`[id="${controls}"]`);
  await expect(group).toBeHidden();
  await expect(modeSwitch(page)).toBeHidden();
  expect((await toolbarRows(page)).height).toBeLessThanOrEqual(170);
  // The closed disclosure keeps Alt+T.
  await focusBody(page);
  await page.keyboard.press("Alt+KeyT");
  await expect(canvasFrame(page)).toHaveAttribute("data-mode", "dark");
  // The Tab order: Inputs, Inspector, frame, template, View, then Undo, Redo, Copy link.
  await focusBody(page);
  const closed = [
    page.getByRole("button", { name: "Inputs", exact: true }),
    page.getByRole("button", { name: "Inspector", exact: true }),
    toolbarRadio(page, "Frame", "1280"),
    templateSelect(page),
    view,
    page.getByRole("button", { name: "Undo", exact: true }),
  ];
  await page.getByRole("link", { name: "dyelot", exact: true }).focus();
  for (const stop of closed) {
    await page.keyboard.press("Tab");
    await expect(stop).toBeFocused();
  }
  // Enter and Space open and close it, and focus stays on the button.
  await view.focus();
  await page.keyboard.press("Enter");
  await expect(view).toHaveAttribute("aria-expanded", "true");
  await expect(view).toBeFocused();
  await expect(group).toBeVisible();
  await page.keyboard.press("Space");
  await expect(view).toHaveAttribute("aria-expanded", "false");
  await expect(view).toBeFocused();
  await page.keyboard.press("Space");
  await expect(view).toHaveAttribute("aria-expanded", "true");
  // Open: the five view controls follow the button, then Undo, Redo and Copy link.
  for (const stop of [
    modeSwitch(page),
    toolbarRadio(page, "Density", "comfortable"),
    reduceMotion(page),
    toolbarRadio(page, "Copy", "Real copy"),
    toolbarRadio(page, "Vision", "none"),
    page.getByRole("button", { name: "Undo", exact: true }),
    page.getByRole("button", { name: "Redo", exact: true }),
    page.getByRole("button", { name: "Copy link", exact: true }),
  ]) {
    await page.keyboard.press("Tab");
    await expect(stop).toBeFocused();
  }
  // The open disclosure keeps Alt+T too.
  await focusBody(page);
  await page.keyboard.press("Alt+KeyT");
  await expect(canvasFrame(page)).toHaveAttribute("data-mode", "light");
  await expect(modeSwitch(page)).toHaveAttribute("aria-checked", "false");
});

/** The opacities of the canvas's one entrance on every frame for 300 ms. */
function entranceOpacities(page: Page): Promise<number[]> {
  return canvasFrame(page)
    .locator("[data-entrance]")
    .evaluate(
      (element) =>
        new Promise<number[]>((resolve) => {
          const seen: number[] = [];
          const start = performance.now();
          const tick = () => {
            seen.push(Number(getComputedStyle(element).opacity));
            if (performance.now() - start < 300) requestAnimationFrame(tick);
            else resolve(seen);
          };
          tick();
        }),
    );
}

test.describe("7.4 Motion on the page templates", () => {
  test("F-CANVAS-07 Reduce motion stops both templates, keeps the FAQ's state and never replays the entrance", async ({
    page,
  }) => {
    await stubSeeds(page);
    await openStudio(page);
    // The first load's entrance comes to rest first: its spring's tail must not read as a replay.
    const landing = await showTemplate(page, "landing");
    // Without the switch the template's parts transition.
    expect((await motionReport(page)).running.length).toBeGreaterThan(0);
    const second = landing.locator('[data-block="faq"] button[aria-expanded]').nth(1);
    await second.click();
    await expect(second).toHaveAttribute("aria-expanded", "true");
    await reduceMotion(page).click();
    await expect(canvasFrame(page)).toHaveAttribute("data-reduced-motion", "true");
    const report = await motionReport(page);
    expect(report.elements).toBeGreaterThan(300);
    expect(report.running).toEqual([]);
    // Off again: the FAQ keeps its open item and the entrance does not replay.
    await reduceMotion(page).click();
    await expect(reduceMotion(page)).toHaveAttribute("aria-checked", "false");
    expect(new Set(await entranceOpacities(page))).toEqual(new Set([1]));
    await expect(second).toHaveAttribute("aria-expanded", "true");
    // The editorial template, chosen while the switch is on, is in place from its first frame and
    // holds no animation: sampled from mount, not after the entrance has come to rest.
    await reduceMotion(page).click();
    await showTemplate(page, elsewhere("editorial"));
    const sampled = mountMotion(page, "editorial");
    await templateSelect(page).selectOption("editorial");
    const mounted = await sampled;
    expect(mounted.entrance).toEqual(["1 none"]);
    expect(mounted.moved).toEqual([]);
    expect(mounted.targets).toEqual([]);
    expect((await motionReport(page)).running).toEqual([]);
    await reduceMotion(page).click();
    expect(new Set(await entranceOpacities(page))).toEqual(new Set([1]));
  });

  test("F-CANVAS-08 prefers-reduced-motion stops the page templates without the switch", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await stubSeeds(page);
    await openStudio(page);
    await expect(canvasFrame(page)).toHaveAttribute("data-reduced-motion", "false");
    // Each template mounts under the preference: its entrance is in place from its first frame.
    for (const id of [...PAGES, "mobile"] as const) {
      await showTemplate(page, elsewhere(id));
      const sampled = mountMotion(page, id);
      await templateSelect(page).selectOption(id);
      const mounted = await sampled;
      expect(mounted.entrance, id).toEqual(["1 none"]);
      expect(mounted.moved, id).toEqual([]);
      expect(mounted.targets, id).toEqual([]);
      expect((await motionReport(page)).running, id).toEqual([]);
    }
  });

  test("F-CANVAS-07 Reduce motion stops the dashboard and settings, keeps their state and never replays the entrance", async ({
    page,
  }) => {
    await stubSeeds(page);
    await openStudio(page);
    const dashboard = await showTemplate(page, "dashboard");
    // Without the switch the template's parts transition.
    expect((await motionReport(page)).running.length).toBeGreaterThan(0);
    const chip = dashboard.getByRole("button", { name: "Late", exact: true });
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    const toast = dashboard.getByRole("status").filter({ hasText: "saved the alert rules" });
    await toast.getByRole("button", { name: "Dismiss", exact: true }).click();
    await expect(toast).toHaveCount(0);
    await reduceMotion(page).click();
    await expect(canvasFrame(page)).toHaveAttribute("data-reduced-motion", "true");
    const report = await motionReport(page);
    expect(report.elements).toBeGreaterThan(300);
    expect(report.running).toEqual([]);
    await reduceMotion(page).click();
    await expect(reduceMotion(page)).toHaveAttribute("aria-checked", "false");
    expect(new Set(await entranceOpacities(page))).toEqual(new Set([1]));
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await expect(toast).toHaveCount(0);
    // The settings, chosen while the switch is on, are in place from their first frame.
    await reduceMotion(page).click();
    await showTemplate(page, elsewhere("settings"));
    const sampled = mountMotion(page, "settings");
    await templateSelect(page).selectOption("settings");
    const mounted = await sampled;
    expect(mounted.entrance).toEqual(["1 none"]);
    expect(mounted.moved).toEqual([]);
    expect(mounted.targets).toEqual([]);
    expect((await motionReport(page)).running).toEqual([]);
    const settings = templateRoot(page, "settings");
    const quiet = settings.getByRole("switch", { name: "Quiet hours at night", exact: true });
    const before = await quiet.getAttribute("aria-checked");
    await quiet.click();
    await expect(quiet).not.toHaveAttribute("aria-checked", before ?? "");
    await reduceMotion(page).click();
    await expect(reduceMotion(page)).toHaveAttribute("aria-checked", "false");
    expect(new Set(await entranceOpacities(page))).toEqual(new Set([1]));
    await expect(quiet).not.toHaveAttribute("aria-checked", before ?? "");
  });

  test("F-CANVAS-07 Reduce motion stops the mobile template, keeps its tab and sheet and never replays the entrance", async ({
    page,
  }) => {
    await stubSeeds(page);
    await openStudio(page);
    const mobile = await showTemplate(page, "mobile");
    // Without the switch the template's parts transition.
    expect((await motionReport(page)).running.length).toBeGreaterThan(0);
    const bar = screenOf(mobile, "tabs").getByRole("tablist");
    const places = bar.getByRole("tab", { name: "Places", exact: true });
    await places.click();
    await expect(places).toHaveAttribute("aria-selected", "true");
    const detail = screenOf(mobile, "detail");
    await detail.getByRole("button", { name: "Set an alert", exact: true }).click();
    const sheet = detail.getByRole("dialog");
    await expect(sheet).toBeVisible();
    const hour = sheet.getByRole("radio", { name: "1 hour", exact: true });
    await hour.check();
    await sheet.evaluate((element) =>
      Promise.allSettled(element.getAnimations().map((animation) => animation.finished)),
    );
    await reduceMotion(page).click();
    await expect(canvasFrame(page)).toHaveAttribute("data-reduced-motion", "true");
    const report = await motionReport(page);
    expect(report.elements).toBeGreaterThan(300);
    expect(report.running).toEqual([]);
    // Off again: the tab, the open sheet and its pick hold, the entrance does not replay, and the
    // sheet does not rise again: every animation that starts in its layer from here on is counted,
    // so a rise that ends before the checks below still shows.
    await sheet.evaluate((element) => {
      const counted = window as unknown as { __rises: number };
      counted.__rises = 0;
      element.closest(".kit-sheet-layer")?.addEventListener("animationstart", () => {
        counted.__rises += 1;
      });
    });
    await reduceMotion(page).click();
    await expect(reduceMotion(page)).toHaveAttribute("aria-checked", "false");
    expect(new Set(await entranceOpacities(page))).toEqual(new Set([1]));
    await expect(places).toHaveAttribute("aria-selected", "true");
    await expect(sheet).toBeVisible();
    await expect(hour).toBeChecked();
    expect(await page.evaluate(() => (window as unknown as { __rises: number }).__rises)).toBe(0);
    expect(await sheet.evaluate((element) => element.getAnimations().length)).toBe(0);
    await sheet.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(sheet).toHaveCount(0);
    // Chosen while the switch is on, the template is in place from its first frame.
    await reduceMotion(page).click();
    await showTemplate(page, elsewhere("mobile"));
    const sampled = mountMotion(page, "mobile");
    await templateSelect(page).selectOption("mobile");
    const mounted = await sampled;
    expect(mounted.entrance).toEqual(["1 none"]);
    expect(mounted.moved).toEqual([]);
    expect(mounted.targets).toEqual([]);
    expect((await motionReport(page)).running).toEqual([]);
    await reduceMotion(page).click();
    expect(new Set(await entranceOpacities(page))).toEqual(new Set([1]));
  });
});

test("F-CANVAS-09 edge-case copy fills the page templates' slots, and nothing breaks or overflows", async ({
  page,
}) => {
  await stubSeeds(page);
  await openStudio(page);
  await page.evaluate(() => document.fonts.ready);
  await toolbarRadio(page, "Copy", "Edge-case copy").check();
  await expect(canvasFrame(page)).toHaveAttribute("data-copy", "edge");
  const edge = COPY.edge;
  for (const id of PAGES) {
    const root = await showTemplate(page, id);
    for (const text of [edge.word, edge.title, edge.person, edge.amount]) {
      await expect(root.getByText(text, { exact: false }).first(), `${id} ${text}`).toBeVisible();
    }
    await expect(root.locator("[data-copy-label]").first(), id).toHaveText(edge.label);
    const list = root.locator("[data-list]");
    await expect(list, id).toHaveAttribute("data-empty", "");
    await expect(root.locator("[data-list-item]"), id).toHaveCount(0);
    for (const frame of [360, 768, 1280] as const) {
      await setFrame(page, frame);
      const name = `${id} ${frame}`;
      // Every figure on screen keeps one line.
      const lines = await figureLines(root);
      expect(lines.length, name).toBeGreaterThan(0);
      expect(
        lines.filter((line) => !line.endsWith(" 1")),
        name,
      ).toEqual([]);
      // Every word of 20 characters or fewer (a hyphen ends a word) sits on one line.
      const words = await brokenWords(root);
      expect(words.checked, name).toBeGreaterThan(80);
      expect(words.broken, name).toEqual([]);
      const report = await overflow(root);
      expect(report.scroll, name).toBeLessThanOrEqual(report.client);
      expect(report.past, name).toEqual([]);
    }
    await setFrame(page, 1280);
  }
  // The mobile template's screens are 360 px whatever the switcher holds: measured once.
  const mobile = await showTemplate(page, "mobile");
  for (const text of [edge.word, edge.title, edge.person, edge.amount]) {
    await expect(mobile.getByText(text, { exact: false }).first(), `mobile ${text}`).toBeVisible();
  }
  await expect(mobile.locator("[data-copy-label]").first()).toHaveText(edge.label);
  await expect(mobile.locator("[data-list]")).toHaveAttribute("data-empty", "");
  await expect(mobile.locator("[data-list-item]")).toHaveCount(0);
  const lines = await figureLines(mobile);
  expect(lines.length, "mobile figures").toBeGreaterThan(0);
  expect(lines.filter((line) => !line.endsWith(" 1"))).toEqual([]);
  const words = await brokenWords(mobile);
  expect(words.checked, "mobile words").toBeGreaterThan(80);
  expect(words.broken).toEqual([]);
  expect(await mobileOverflow(mobile)).toEqual([]);
  await toolbarRadio(page, "Copy", "Real copy").check();
  for (const id of [...PAGES, "mobile"] as const) {
    const root = await showTemplate(page, id);
    expect(await root.locator("[data-list-item]").count(), id).toBeGreaterThan(1);
    await expect(root.locator("[data-copy-label]").first(), id).not.toHaveText(edge.label);
  }
});
