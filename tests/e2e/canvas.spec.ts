import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  applyPreset,
  FONT_CATALOG,
  fontStack,
  hexToRgb,
  PAIRINGS,
  simulate,
  toHex,
  typeWeights,
} from "@/engine";
import { MODES } from "@/engine/color/guards";
import { COPY, SAMPLE_PLACES } from "@/features/preview/copy";
import { frameFit } from "@/features/preview/frame";
import { writeHash } from "@/features/studio/url";
import { TEMPLATE_IDS } from "@/features/studio/view";
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
  first,
  focusBody,
  lotId,
  lotOf,
  modeSwitch,
  openStudio,
  seedCalls,
  seedOf,
  settled,
  stubSeeds,
  toolbarRadio,
} from "./studio-support";
import {
  brokenWords,
  eachTab,
  elsewhere,
  figureLines,
  frameSwitch,
  installColorResolver,
  mobileOverflow,
  mountMotion,
  openSheet,
  overflow,
  reduceMotion,
  restoreCanvas,
  screenOf,
  setFrame,
  showTemplate,
  templateRoot,
  templateSelect,
} from "./template-support";

// The canvas flows of docs/specs/02-studio.md, section 7.4 (Task 2.7): F-CANVAS-01 to 10 and 12 to
// 19, with F-CANVAS-07 to 09 extended to the landing and editorial templates (Task 2.8), to the
// dashboard and settings templates (Task 2.9) and to the mobile template (Task 2.10a). F-CANVAS-11
// ("Show me") is driven from the inspector and lives in inspector.spec.ts (Task 2.10b); F-CANVAS-01 here
// runs once with its highlight shown. A flow that names no viewport runs at 1280 × 800.

test.use({ viewport: { width: 1280, height: 800 } });

const PHONE = { width: 360, height: 740 };
const ROOT = path.resolve(import.meta.dirname, "../..");

const toolbar = (page: Page) => page.getByRole("region", { name: "Canvas toolbar" });

/** The page templates of sections 7.6 and 7.7 (Tasks 2.8 and 2.9): they follow the frame switcher. */
const PAGES = ["landing", "editorial", "dashboard", "settings"] as const;

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

/**
 * F-CANVAS-01: walks every element of the canvas frame and reports each computed color equal to a
 * chrome color, and each outline that is not the canvas's `--ring`, read through the shared sRGB
 * resolver. A spec color that equals a chrome value by chance is skipped by value. With `highlighted`
 * roles, madder is allowed only as the `outline-color` of an element whose `data-roles` name one of
 * them (the "show me" overlay, R2-20); `exempted` counts those. A probe marked `data-probe` is named in
 * its hits.
 */
async function chromeHits(page: Page, highlighted: readonly string[]) {
  await installColorResolver(page);
  const spec = first();
  const specColors: string[] = MODES.flatMap((mode) => [
    ...Object.values(spec.color.roles[mode]),
    ...Object.values(spec.color.palettes).flatMap((palette) =>
      palette[mode].map((step) => step.hex),
    ),
  ]);
  return canvasFrame(page).evaluate(
    (frame, { chrome, skip, highlighted }) => {
      const resolve = (window as unknown as { __dyelotRgba: (v: string) => number[] | null })
        .__dyelotRgba;
      // sRGB channels and alpha to two decimals: a chrome value with alpha matches only that alpha.
      const keys = new Map<string, string | null>();
      const key = (value: string): string | null => {
        const known = keys.get(value);
        if (known !== undefined) return known;
        const rgba = resolve(value);
        const found =
          rgba === null || rgba[3] === 0
            ? null
            : [...rgba.slice(0, 3), Number(rgba[3]?.toFixed(2))].join(",");
        keys.set(value, found);
        return found;
      };
      const hexKey = (hex: string) =>
        [...[1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16)), 1].join(",");
      const chromeKeys = new Set(chrome.map(key).filter((value) => value !== null));
      const skipKeys = new Set(skip.map(hexKey));
      const madder = "246,108,109,1";
      const rings = new Map<Element, string | null>();
      const ringOf = (element: Element) => {
        const canvas = element.closest("[data-pane]") ?? frame;
        const known = rings.get(canvas);
        if (known !== undefined) return known;
        const probe = document.createElement("span");
        probe.style.color = "var(--ring)";
        canvas.append(probe);
        const ring = key(getComputedStyle(probe).color);
        probe.remove();
        rings.set(canvas, ring);
        return ring;
      };
      const hits: string[] = [];
      let checked = 0;
      let exempted = 0;
      for (const element of [frame, ...frame.querySelectorAll("*")]) {
        const style = getComputedStyle(element);
        const probe = element.closest<HTMLElement>("[data-probe]")?.dataset.probe;
        const label = `${element.tagName}${probe === undefined ? "" : ` [probe ${probe}]`}`;
        const roles = (element.getAttribute("data-roles") ?? "").split(/\s+/);
        const lit = roles.some((role) => highlighted.includes(role));
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
        for (const match of style.boxShadow.matchAll(/(?:rgba?|oklab|oklch|color)\([^)]*\)/g)) {
          colors.push(["box-shadow", match[0]]);
        }
        for (const [property, value] of colors) {
          checked++;
          const found = key(value);
          if (found === null || skipKeys.has(found)) continue;
          if (lit && property === "outline-color" && found === madder) {
            exempted++;
            continue;
          }
          if (chromeKeys.has(found)) hits.push(`${label} ${property} ${value}`);
        }
        const outline = key(style.outlineColor);
        const exempt = lit && outline === madder;
        if (!exempt && outline !== ringOf(element)) {
          hits.push(`${label} outline-color ${style.outlineColor} is not --ring`);
        }
      }
      return { hits, checked, exempted };
    },
    { chrome: chromeColors(), skip: specColors, highlighted },
  );
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

  // Each flow ends where the next one starts, so a `-g` filter can run any of them (section 7).
  test.afterEach(async () => {
    await restoreCanvas(page, "kitchen-sink");
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  test("F-CANVAS-01 the frame and each pane carry exactly their variables", async () => {
    const spec = first();
    expect(await canvasVars(page)).toEqual(expectedVars(spec, "light"));
    expect(Object.keys(await canvasVars(page))).toHaveLength(209);
    for (const mode of MODES) {
      expect(await canvasVars(page, canvasPane(page, mode)), mode).toEqual(
        expectedVars(spec, mode),
      );
      await expect(canvasPane(page, mode)).toHaveAttribute("data-mode", mode);
    }
  });

  test("F-CANVAS-01 no computed color inside the canvas is a chrome color", async () => {
    const report = await chromeHits(page, []);
    expect(report.checked).toBeGreaterThan(5000);
    expect(report.hits).toEqual([]);
  });

  test("F-CANVAS-01 with a highlight shown, madder is only the outline of a highlighted part", async () => {
    const show = page
      .locator('aside#studio-inspector [data-finding="N3 light border/background"]')
      .getByRole("button", { name: "Show me", exact: true });
    await show.click();
    await expect(canvasRegion(page)).toHaveAttribute("data-show-me", "border background");
    try {
      const report = await chromeHits(page, ["border", "background"]);
      expect(report.checked).toBeGreaterThan(5000);
      expect(report.hits).toEqual([]);
      expect(report.exempted, "the walk saw outlined parts").toBeGreaterThan(0);
      // The exemption is that narrow: a madder text color on a highlighted part, and a madder
      // outline on a part that names no highlighted role, are each reported.
      const probes = await canvasFrame(page).evaluate((frame) => {
        const named = frame.querySelector<HTMLElement>('[data-roles~="border"]');
        const other = [...frame.querySelectorAll<HTMLElement>("[data-roles]")].find((element) => {
          const roles = (element.getAttribute("data-roles") ?? "").split(/\s+/);
          return !roles.includes("border") && !roles.includes("background");
        });
        if (named === null || other === undefined) return null;
        named.dataset.probe = "color";
        named.style.color = "#f66c6d";
        other.dataset.probe = "outline";
        other.style.outline = "2px dashed #f66c6d";
        return [named.tagName, other.tagName];
      });
      expect(probes, "two probe parts").not.toBeNull();
      const probed = await chromeHits(page, ["border", "background"]);
      expect(
        probed.hits.filter((hit) => hit.includes("[probe color]") && hit.includes(" color ")),
      ).not.toHaveLength(0);
      expect(
        probed.hits.filter(
          (hit) => hit.includes("[probe outline]") && hit.includes("outline-color"),
        ),
      ).not.toHaveLength(0);
      expect(probed.hits.every((hit) => hit.includes("[probe "))).toBe(true);
    } finally {
      await canvasFrame(page).evaluate((frame) => {
        for (const element of frame.querySelectorAll<HTMLElement>("[data-probe]")) {
          element.style.color = "";
          element.style.outline = "";
          delete element.dataset.probe;
        }
      });
      await show.click();
      await expect(canvasRegion(page)).not.toHaveAttribute("data-show-me", /.+/);
    }
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
function smallToolbarTargets(page: Page) {
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
  expect(await smallToolbarTargets(page), "1280 × 800").toEqual([]);
  await page.setViewportSize(PHONE);
  await page.getByRole("button", { name: "View", exact: true }).click();
  await expect(modeSwitch(page)).toBeVisible();
  expect(await smallToolbarTargets(page), "360 × 740, View open").toEqual([]);
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
  // The Tab order: Inputs, Inspector, frame, template, View, then Undo, Redo, Copy link, Export,
  // Flavor (section 16 of docs/specs/05-motion-3d.md, R5-51).
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
  // Open: the five view controls follow the button, then Undo, Redo, Copy link, Export and Flavor.
  for (const stop of [
    modeSwitch(page),
    toolbarRadio(page, "Density", "comfortable"),
    reduceMotion(page),
    toolbarRadio(page, "Copy", "Real copy"),
    toolbarRadio(page, "Vision", "none"),
    page.getByRole("button", { name: "Undo", exact: true }),
    page.getByRole("button", { name: "Redo", exact: true }),
    page.getByRole("button", { name: "Copy link", exact: true }),
    page.getByRole("button", { name: "Export", exact: true }),
    page.getByRole("button", { name: "Flavor", exact: true }),
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
    // Each page template also mounts from the mobile template, whose board takes another width: the
    // frame shows the held width from the first sampled frame, and nothing transitions.
    for (const id of PAGES) {
      await showTemplate(page, "mobile");
      const sampled = mountMotion(page, id);
      await templateSelect(page).selectOption(id);
      const mounted = await sampled;
      const name = `${id} from mobile`;
      expect(mounted.entrance, name).toEqual(["1 none"]);
      expect(mounted.moved, name).toEqual([]);
      expect(mounted.targets, name).toEqual([]);
      expect(mounted.widths, name).toEqual([1280]);
      expect((await motionReport(page)).running, name).toEqual([]);
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

  test("F-CANVAS-07 Reduce motion switched on during the sheet's rise leaves it settled, with no rise later", async ({
    page,
  }) => {
    await stubSeeds(page);
    await openStudio(page);
    const mobile = await showTemplate(page, "mobile");
    // Open the sheet and switch Reduce motion on 60 ms into its rise, in the page, so the timing holds;
    // the rise must still be running then, or the check proves nothing.
    const during = await page.evaluate(
      () =>
        new Promise<boolean>((resolve, reject) => {
          const opener = [
            ...document.querySelectorAll<HTMLButtonElement>('[data-phone="detail"] button'),
          ].find((button) => (button.textContent ?? "").includes("Set an alert"));
          const reduce = [...document.querySelectorAll<HTMLButtonElement>('[role="switch"]')].find(
            (button) => (button.textContent ?? "").trim() === "Reduce motion",
          );
          if (opener === undefined || reduce === undefined) {
            reject(new Error("no opener or Reduce motion switch"));
            return;
          }
          opener.click();
          setTimeout(() => {
            const sheet = document.querySelector(".kit-bottom-sheet");
            const running = sheet !== null && sheet.getAnimations().length > 0;
            reduce.click();
            resolve(running);
          }, 60);
        }),
    );
    expect(during, "the rise runs 60 ms in").toBe(true);
    await expect(canvasFrame(page)).toHaveAttribute("data-reduced-motion", "true");
    const sheet = screenOf(mobile, "detail").getByRole("dialog");
    await expect(sheet).toBeVisible();
    // From here every animation that starts in the sheet's layer is counted.
    await sheet.evaluate((element) => {
      const counted = window as unknown as { __rises: number };
      counted.__rises = 0;
      element.closest(".kit-sheet-layer")?.addEventListener("animationstart", () => {
        counted.__rises += 1;
      });
    });
    await reduceMotion(page).click();
    await expect(reduceMotion(page)).toHaveAttribute("aria-checked", "false");
    await expect(canvasFrame(page)).toHaveAttribute("data-reduced-motion", "false");
    // Longer than a rise: none starts, and the sheet holds no animation.
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => (window as unknown as { __rises: number }).__rises)).toBe(0);
    expect(await sheet.evaluate((element) => element.getAnimations().length)).toBe(0);
    await expect(sheet).toBeVisible();
  });

  test("F-CANVAS-07 Reduce motion toggled with the settings' confirm dialog open never replays its entrance", async ({
    page,
  }) => {
    await stubSeeds(page);
    await openStudio(page);
    const settings = await showTemplate(page, "settings");
    const opener = settings.getByRole("button", { name: "Delete console", exact: true });
    const dialog = settings.getByRole("alertdialog");
    const layer = settings.locator(".kit-confirm-layer");
    /** From now on, counts every animation that starts in the dialog's layer. */
    const countStarts = () =>
      layer.evaluate((element) => {
        const counted = window as unknown as { __starts: number };
        counted.__starts = 0;
        element.addEventListener("animationstart", () => {
          counted.__starts += 1;
        });
      });
    const starts = () => page.evaluate(() => (window as unknown as { __starts: number }).__starts);
    const running = () =>
      layer.evaluate((element) => element.getAnimations({ subtree: true }).length);
    /** Switches Reduce motion off, waits longer than an entrance, and checks nothing replayed. */
    const offAndQuiet = async (name: string) => {
      await reduceMotion(page).click();
      await expect(canvasFrame(page)).toHaveAttribute("data-reduced-motion", "false");
      await page.waitForTimeout(600);
      expect(await starts(), `${name}: animations started in the layer`).toBe(0);
      expect(await running(), `${name}: animations in the layer`).toBe(0);
      await expect(dialog, name).toBeVisible();
      await expect(layer, name).toHaveAttribute("data-settled", "");
    };
    // Opened at rest: the switch goes on and off while it stays open.
    await opener.click();
    await expect(dialog).toBeVisible();
    await layer.evaluate((element) =>
      Promise.allSettled(
        element.getAnimations({ subtree: true }).map((animation) => animation.finished),
      ),
    );
    await countStarts();
    await reduceMotion(page).click();
    await expect(canvasFrame(page)).toHaveAttribute("data-reduced-motion", "true");
    await offAndQuiet("at rest");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    // Switched on 60 ms into the entrance, in the page so the timing holds; the entrance must still
    // be running then, or the check proves nothing.
    const during = await page.evaluate(
      () =>
        new Promise<boolean>((resolve, reject) => {
          const opener = [
            ...document.querySelectorAll<HTMLButtonElement>(
              '[data-template-root="settings"] button',
            ),
          ].find((button) => (button.textContent ?? "").trim() === "Delete console");
          const reduce = [...document.querySelectorAll<HTMLButtonElement>('[role="switch"]')].find(
            (button) => (button.textContent ?? "").trim() === "Reduce motion",
          );
          if (opener === undefined || reduce === undefined) {
            reject(new Error("no opener or Reduce motion switch"));
            return;
          }
          opener.click();
          setTimeout(() => {
            const surface = document.querySelector(".kit-confirm");
            const moving = surface !== null && surface.getAnimations().length > 0;
            reduce.click();
            resolve(moving);
          }, 60);
        }),
    );
    expect(during, "the entrance runs 60 ms in").toBe(true);
    await expect(canvasFrame(page)).toHaveAttribute("data-reduced-motion", "true");
    await expect(dialog).toBeVisible();
    await countStarts();
    await offAndQuiet("during the entrance");
  });
});

test("F-CANVAS-20 under reduced motion a frame switch starts no transition and shows the new layout from its first frame", async ({
  page,
}) => {
  await stubSeeds(page);
  await openStudio(page);
  // Every switch is measured, and the failures are listed together, so each setting shows its own.
  const failures: string[] = [];
  try {
    for (const setting of ["switch", "system"] as const) {
      if (setting === "switch") {
        await reduceMotion(page).click();
        await expect(canvasFrame(page)).toHaveAttribute("data-reduced-motion", "true");
      } else {
        await reduceMotion(page).click();
        await expect(canvasFrame(page)).toHaveAttribute("data-reduced-motion", "false");
        await page.emulateMedia({ reducedMotion: "reduce" });
      }
      for (const id of ["kitchen-sink", ...PAGES] as const) {
        await showTemplate(page, id);
        await setFrame(page, 1280);
        for (const to of [768, 360, 1280] as const) {
          const report = await frameSwitch(page, to);
          const name = `${setting}: ${id} to ${to}`;
          if (report.width !== to) failures.push(`${name}: the first frame is ${report.width} px`);
          if (report.checked <= 50) failures.push(`${name}: only ${report.checked} elements`);
          if (report.animations.length > 0) {
            failures.push(`${name}: animations ${report.animations.join(", ")}`);
          }
          if (report.late.length > 0)
            failures.push(`${name}: a frame late ${report.late.join(", ")}`);
        }
      }
    }
  } finally {
    await page.emulateMedia({ reducedMotion: null });
  }
  expect(failures).toEqual([]);
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
  // Measured with each tab panel shown, then once with the sheet open.
  await eachTab(mobile, async (tab) => {
    const lines = await figureLines(mobile);
    expect(lines.length, `mobile ${tab} figures`).toBeGreaterThan(0);
    expect(
      lines.filter((line) => !line.endsWith(" 1")),
      `mobile ${tab}`,
    ).toEqual([]);
    const words = await brokenWords(mobile);
    expect(words.checked, `mobile ${tab} words`).toBeGreaterThan(80);
    expect(words.broken, `mobile ${tab}`).toEqual([]);
    expect(await mobileOverflow(mobile), `mobile ${tab}`).toEqual([]);
  });
  const sheet = await openSheet(mobile);
  const sheetWords = await brokenWords(sheet);
  expect(sheetWords.checked, "mobile sheet words").toBeGreaterThan(15);
  expect(sheetWords.broken, "mobile sheet").toEqual([]);
  expect(await mobileOverflow(mobile), "mobile sheet").toEqual([]);
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await toolbarRadio(page, "Copy", "Real copy").check();
  for (const id of [...PAGES, "mobile"] as const) {
    const root = await showTemplate(page, id);
    expect(await root.locator("[data-list-item]").count(), id).toBeGreaterThan(1);
    await expect(root.locator("[data-copy-label]").first(), id).not.toHaveText(edge.label);
  }
});

/** The designs F-WGT-01 walks: three presets, a static display pairing and the default pairing. */
const WEIGHT_DESIGNS = [
  ["maximalism", applyPreset(FRESH, "maximalism")],
  ["organic", applyPreset(FRESH, "organic")],
  ["dithering-pixel", applyPreset(FRESH, "dithering-pixel")],
  ["redaction-redhat", { ...FRESH, pairing: "redaction-redhat" }],
  ["host-grotesk", { ...FRESH, pairing: "host-grotesk" }],
] as const;

test.describe("F-WGT-01 weights on the canvas (R3-06)", () => {
  for (const [name, params] of WEIGHT_DESIGNS) {
    test(`F-WGT-01 no element asks ${name}'s faces for a weight they lack`, async ({ page }) => {
      const spec = designFor(params, seedOf(1));
      await openStudio(page, writeHash(spec));
      await page.evaluate(() => document.fonts.ready);
      const weights = typeWeights(spec);
      expect(await canvasVars(page)).toMatchObject({
        "--weight-heading": String(weights.heading),
        "--weight-label": String(weights.label),
        "--weight-body": String(weights.body),
      });
      const heaviest = Object.fromEntries(
        FONT_CATALOG.map((font) => [font.family, Math.max(...font.weights)]),
      );
      const failures: string[] = [];
      let checked = 0;
      for (const id of TEMPLATE_IDS) {
        const root = await showTemplate(page, id);
        const found = await root.evaluate((element, limits) => {
          const out: string[] = [];
          let count = 0;
          for (const node of [element, ...element.querySelectorAll("*")]) {
            const style = getComputedStyle(node);
            const family = (style.fontFamily.split(",")[0] ?? "")
              .trim()
              .replaceAll(/^["']|["']$/g, "");
            const limit = limits[family];
            if (limit === undefined) continue;
            count += 1;
            const weight = Number.parseInt(style.fontWeight, 10);
            if (weight >= 600 && limit < 600) {
              const label = `${node.tagName.toLowerCase()}.${[...node.classList].join(".")}`;
              out.push(`${label} is ${weight} in ${family} (heaviest ${limit})`);
            }
          }
          return { count, out: [...new Set(out)] };
        }, heaviest);
        checked += found.count;
        failures.push(...found.out.map((line) => `${id}: ${line}`));
      }
      expect(checked).toBeGreaterThan(1000);
      expect(failures).toEqual([]);
    });
  }
});
