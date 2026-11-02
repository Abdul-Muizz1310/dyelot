import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { hexToRgb, PRESET_IDS, ROLE_NAMES, wcagRatio } from "@/engine";
import { COPY } from "@/features/preview/copy";
import { BUTTON_VARIANTS, KIT_COMPONENTS, statesOf } from "@/features/preview/kit/states";
import { TEXT_PAIRS } from "@/features/preview/swatches";
import { clock, TIDE_EVENTS } from "@/features/preview/tide";
import { writeHash } from "@/features/studio/url";
import type { TemplateId } from "@/features/studio/view";
import { type DesignSpec, DesignSpecSchema } from "@/spec";
import { themeVars } from "@/theme/vars";
import {
  canvasFrame,
  canvasPane,
  canvasRegion,
  canvasVars,
  designFor,
  FRESH,
  lotId,
  openStudio,
  rgbToHex,
  seedOf,
  settled,
  stubSeeds,
} from "./studio-support";
import {
  antiSlop,
  brokenWords,
  controlLabels,
  eachTab,
  equalIconSiblings,
  figureLines,
  HERO_FIGURE,
  heroMetrics,
  mobileOverflow,
  mountMotion,
  openSheet,
  overflow,
  paintedContrast,
  pictographs,
  resolveColors,
  roleColor,
  SCREENS,
  screenOf,
  setFrame,
  showTemplate,
  slop,
  smallTargets,
  TABS,
  TYPE_STEPS,
  templateRoot,
  typeStepOf,
  typeTriples,
  unnamedPaint,
} from "./template-support";

// The template flows of docs/specs/02-studio.md: the kitchen sink of section 7.5 (Task 2.7, F-TPL-01
// to F-TPL-08 and F-TPL-38, and axe in both modes), the landing and editorial templates of section
// 7.6 (Task 2.8, F-TPL-09 to F-TPL-21 and F-TPL-38 to F-TPL-42) and the dashboard and settings
// templates of section 7.7 (Task 2.9, F-TPL-22 to F-TPL-31 and F-TPL-37), which also join the sweeps
// of section 7.6, and the mobile template of section 7.7 (Task 2.10a, F-TPL-32 to F-TPL-36), which joins
// the sweeps at its own three 360 px screens.

const MODES = ["light", "dark"] as const;
const RADII = ["sm", "md", "lg", "xl", "2xl", "full"];
const DURATIONS = ["instant", "fast", "quick", "base", "slow", "slower", "slowest"];
const EASINGS = ["standard", "decelerate", "accelerate", "emphasized"];

/** The design of the first load when `stubSeeds` draws the seeds. */
const first = () => designFor(FRESH, seedOf(1));
const vars = (mode: "light" | "dark") => themeVars(first(), mode, { units: "cqi" });

const templateSelect = (page: Page) =>
  page
    .getByRole("region", { name: "Canvas toolbar" })
    .getByRole("combobox", { name: "Template", exact: true });

/** `#rrggbb` as the browser computes it: `rgb(r, g, b)`. */
function rgbOf(hex: string): string {
  const channels = [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16));
  return `rgb(${channels.join(", ")})`;
}

/** A duration such as `200ms` or `0.2s` in milliseconds. */
function ms(value: string): number {
  return Number.parseFloat(value) * (value.trim().endsWith("ms") ? 1 : 1000);
}

/**
 * The computed style properties of every element matching `selector` inside `scope`, read on the
 * match itself or, for a motion demo, on its `[data-runner]`, the part that animates.
 */
function computed(scope: Locator, selector: string, properties: readonly string[]) {
  return scope.evaluate(
    (element, { selector, properties }) =>
      [...element.querySelectorAll<HTMLElement>(selector)].map((match) => {
        const style = getComputedStyle(match.querySelector("[data-runner]") ?? match);
        return {
          token: match.dataset.token ?? "",
          printed: match.querySelector("[data-printed]")?.textContent ?? "",
          ...Object.fromEntries(properties.map((name) => [name, style.getPropertyValue(name)])),
        } as Record<string, string>;
      }),
    { selector, properties },
  );
}

/**
 * The forced states of every kit component that do not paint differently from the component's
 * `default` specimen (F-TPL-03). Hover, pressed and selected must change a fill, an edge or a shadow
 * somewhere in the part (pressed may move it instead); focus-visible must draw the 2 px `--ring`
 * outline; disabled must dim or disable the part; any other state must change what the part shows.
 */
function stateDifferences(pane: Locator): Promise<string[]> {
  return pane.evaluate((element) => {
    const ring = (() => {
      const probe = document.createElement("span");
      probe.style.color = "var(--ring)";
      element.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    })();
    const paints = (part: Element, withTransform: boolean) => {
      const values = new Set<string>();
      for (const node of [part, ...part.querySelectorAll("*")]) {
        const style = getComputedStyle(node);
        const after = getComputedStyle(node, "::after");
        values.add(`bg ${style.backgroundColor}`);
        values.add(
          `edge ${style.borderTopColor} ${style.borderRightColor} ${style.borderBottomColor} ${style.borderLeftColor}`,
        );
        values.add(`shadow ${style.boxShadow}`);
        values.add(`underline ${style.textDecorationLine} ${style.textDecorationThickness}`);
        if (after.content !== "none") values.add(`after ${after.backgroundColor}`);
        if (withTransform) values.add(`move ${style.transform}`);
      }
      return values;
    };
    // What a part paints, and its structure: never its attributes, values or text (review R2-I3).
    // A field's text color is the placeholder's while it shows the placeholder, its own otherwise.
    const shows = (part: Element) =>
      [part, ...part.querySelectorAll("*")]
        .map((node) => {
          const style = getComputedStyle(node);
          const field = node as HTMLInputElement;
          const placeholder =
            (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) &&
            field.value === "" &&
            field.placeholder !== "";
          return [
            node.tagName,
            style.backgroundColor,
            style.backgroundImage,
            style.borderTopColor,
            style.borderRightColor,
            style.borderBottomColor,
            style.borderLeftColor,
            style.borderTopStyle,
            style.boxShadow,
            placeholder ? getComputedStyle(node, "::placeholder").color : style.color,
            style.opacity,
            style.animationName,
          ].join("|");
        })
        .join("\n");
    const differs = (a: Set<string>, b: Set<string>) =>
      [...a].some((value) => !b.has(value)) || [...b].some((value) => !a.has(value));
    const problems: string[] = [];
    // The parts on screen: a layout the frame hides (the readings' table or records) is not compared.
    const parts = [...element.querySelectorAll<HTMLElement>("[data-kit][data-state]")].filter(
      (part) => part.getBoundingClientRect().width > 0,
    );
    const key = (part: HTMLElement) => `${part.dataset.kit}|${part.dataset.variant ?? ""}`;
    const defaults = new Map<string, HTMLElement>();
    for (const part of parts) {
      if (part.dataset.state === "default" && !defaults.has(key(part)))
        defaults.set(key(part), part);
    }
    for (const part of parts) {
      const state = part.dataset.state ?? "";
      const base = defaults.get(key(part));
      if (state === "default" || base === undefined) continue;
      const name = `${key(part)} ${state}`;
      const style = getComputedStyle(part);
      if (state === "focus-visible") {
        const ok =
          style.outlineStyle === "solid" &&
          style.outlineWidth === "2px" &&
          style.outlineColor === ring;
        if (!ok) problems.push(name);
      } else if (state === "disabled") {
        const ok = Number.parseFloat(style.opacity) < 1 || part.matches(":disabled");
        if (!ok) problems.push(name);
      } else if (state === "hover" || state === "pressed" || state === "selected") {
        if (!differs(paints(part, state === "pressed"), paints(base, state === "pressed"))) {
          problems.push(name);
        }
      } else if (shows(part) === shows(base)) {
        problems.push(name);
      }
    }
    return problems;
  });
}

/** The Tab stops inside the canvas frame: focusable, not inert, one per radio group. */
function tabStops(page: Page): Promise<number> {
  return canvasFrame(page).evaluate((frame) => {
    const groups = new Set<string>();
    let stops = 0;
    for (const node of frame.querySelectorAll<HTMLElement>(
      "a[href], button, input, select, textarea, [tabindex]",
    )) {
      if (node.closest("[inert]") !== null || node.tabIndex < 0) continue;
      if ((node as HTMLInputElement).disabled) continue;
      const box = node.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) continue;
      const radio = node instanceof HTMLInputElement && node.type === "radio";
      if (radio && node.name !== "") {
        if (groups.has(node.name)) continue;
        groups.add(node.name);
      }
      stops++;
    }
    return stops;
  });
}

test.describe("7.5 The kitchen sink", () => {
  test.describe.configure({ mode: "serial" });
  test.use({ viewport: { width: 1280, height: 800 } });
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    // A page of its own context: axe's builder needs one.
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    page = await context.newPage();
    await stubSeeds(page);
    await openStudio(page);
    await templateSelect(page).selectOption("kitchen-sink");
    await expect(canvasPane(page, "dark")).toBeAttached();
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  test("F-TPL-01 every role, type step, radius, shadow and motion token, in both modes", async () => {
    for (const mode of MODES) {
      const pane = canvasPane(page, mode);
      const roles = await pane
        .locator("[data-swatch]")
        .evaluateAll((swatches) => swatches.map((swatch) => swatch.getAttribute("data-swatch")));
      expect(roles, mode).toEqual([...ROLE_NAMES]);
      const theme = vars(mode);

      const type = await computed(pane, '[data-token^="text-"]', ["font-size", "line-height"]);
      // The ramp runs largest first; every step is there once.
      expect(type.map((row) => row.token).sort()).toEqual(
        TYPE_STEPS.map((step) => `text-${step}`).sort(),
      );
      for (const row of type) {
        const step = row.token.slice("text-".length);
        expect(row["font-size"], `${mode} ${step}`).toBe(theme[`--text-${step}`]);
        expect(row["line-height"], `${mode} ${step}`).toBe(theme[`--leading-${step}`]);
      }

      const radii = await computed(pane, '[data-token^="radius-"]', ["border-top-left-radius"]);
      expect(radii.map((row) => row.token)).toEqual(RADII.map((name) => `radius-${name}`));
      for (const row of radii) {
        expect(row["border-top-left-radius"], `${mode} ${row.token}`).toBe(theme[`--${row.token}`]);
      }

      const shadows = await computed(pane, '[data-token^="shadow-"]', ["box-shadow"]);
      expect(shadows.map((row) => row.token)).toEqual([1, 2, 3, 4, 5].map((n) => `shadow-${n}`));
      // Each tile paints its own elevation: the shadow a probe styled with that variable gets.
      const probes = await pane.evaluate((element) =>
        [1, 2, 3, 4, 5].map((level) => {
          const probe = document.createElement("span");
          probe.style.boxShadow = `var(--shadow-${level})`;
          element.append(probe);
          const shadow = getComputedStyle(probe).boxShadow;
          probe.remove();
          return shadow;
        }),
      );
      expect(
        shadows.map((row) => row["box-shadow"]),
        mode,
      ).toEqual(probes);
      if (first().depth.style !== "flat") {
        expect(new Set(probes).size, `${mode} distinct elevations`).toBe(5);
      }

      const motion = await computed(pane, "[data-token^='duration-'], [data-token^='ease-']", []);
      expect(motion.map((row) => row.token)).toEqual([
        ...DURATIONS.map((name) => `duration-${name}`),
        ...EASINGS.map((name) => `ease-${name}`),
      ]);
    }
  });

  test("F-TPL-02 every printed hex is the stored hex and every ratio is wcagRatio to two decimals", async () => {
    const spec = first();
    for (const mode of MODES) {
      const printed = await canvasPane(page, mode)
        .locator("[data-swatch]")
        .evaluateAll((swatches) =>
          swatches.map((swatch) => ({
            role: swatch.getAttribute("data-swatch") ?? "",
            hex: swatch.querySelector("[data-hex]")?.textContent ?? "",
            ratio: swatch.querySelector("[data-ratio]")?.textContent ?? null,
          })),
        );
      const roles = spec.color.roles[mode];
      for (const { role, hex, ratio } of printed) {
        expect(hex, `${mode} ${role}`).toBe(roles[role as keyof typeof roles]);
        const fill = (TEXT_PAIRS as Record<string, keyof typeof roles | undefined>)[role];
        if (fill === undefined) {
          expect(ratio, `${mode} ${role}`).toBeNull();
          continue;
        }
        const expected = wcagRatio(
          hexToRgb(roles[role as keyof typeof roles]),
          hexToRgb(roles[fill]),
        ).toFixed(2);
        expect(ratio, `${mode} ${role}`).toBe(expected);
      }
      expect(printed.filter((row) => row.ratio !== null)).toHaveLength(18);
    }
  });

  test("F-TPL-03 every kit component renders in every state it supports, marked and labeled", async () => {
    for (const mode of MODES) {
      const found = await canvasPane(page, mode).evaluate((pane) =>
        [...pane.querySelectorAll<HTMLElement>("[data-kit][data-state]")].map((element) => {
          const box = element.getBoundingClientRect();
          const specimen = element.closest("[data-specimen]");
          return {
            kit: element.dataset.kit ?? "",
            variant: element.dataset.variant ?? "",
            state: element.dataset.state ?? "",
            label: specimen?.querySelector("[data-state-label]")?.textContent ?? null,
            shown: box.width > 0 && box.height > 0,
          };
        }),
      );
      for (const component of KIT_COMPONENTS) {
        const variants = component.id === "button" ? BUTTON_VARIANTS : [""];
        for (const variant of variants) {
          for (const state of component.states) {
            const hit = found.find(
              (item) =>
                item.kit === component.id &&
                item.state === state &&
                (variant === "" || item.variant === variant),
            );
            const name = `${mode} ${component.id} ${variant} ${state}`;
            expect(hit, name).toBeDefined();
            expect(hit?.shown, name).toBe(true);
            expect(hit?.label, name).toBe(state);
          }
        }
      }
      // A determinate progress bar fills to its value.
      const fills = await canvasPane(page, mode)
        .locator('[data-kit="progress"][aria-valuenow]')
        .evaluateAll((bars) =>
          bars.map((bar) => {
            const fill = bar.firstElementChild?.getBoundingClientRect().width ?? -1;
            return [
              Number(bar.getAttribute("aria-valuenow")),
              fill / bar.getBoundingClientRect().width,
            ];
          }),
        );
      expect(fills.length, mode).toBe(3);
      for (const [value = 0, share = 0] of fills)
        expect(share, `${mode} ${value}`).toBeCloseTo(value / 100, 2);
      // Each forced state paints differently from its component's default specimen.
      expect(await stateDifferences(canvasPane(page, mode)), mode).toEqual([]);
      // A field's messages speak of that field.
      const messages = await canvasPane(page, mode).evaluate((pane) =>
        [...pane.querySelectorAll(".kit-message")].map((message) => [
          message.closest(".kit-field")?.querySelector("label")?.textContent ?? "",
          message.getAttribute("data-tone") ?? "",
          message.textContent ?? "",
        ]),
      );
      expect(messages, mode).toEqual([
        ["Observer", "invalid", "Enter the observer's name."],
        ["Observer", "success", "Observer saved."],
        ["Notes", "invalid", "Write a note about the water."],
        ["Notes", "success", "Note saved."],
        ["Place", "invalid", "Choose a place for the reading."],
      ]);
      // The dialog and the sheet keep an edge on any stage, and name it.
      const edges = await canvasPane(page, mode).evaluate((pane) =>
        [".kit-dialog", ".kit-sheet"].map((selector) => {
          const surface = pane.querySelector(selector);
          return [
            surface === null ? "" : getComputedStyle(surface).borderTopWidth,
            surface?.getAttribute("data-roles")?.split(" ").includes("border") ?? false,
          ];
        }),
      );
      expect(edges, mode).toEqual([
        ["1px", true],
        ["1px", true],
      ]);
      // A switch's focus ring follows its rounded shape.
      const switchRadius = await canvasPane(page, mode)
        .locator('[data-kit="switch"][data-state="focus-visible"]')
        .evaluate((element) => Number.parseFloat(getComputedStyle(element).borderTopLeftRadius));
      expect(switchRadius, mode).toBeGreaterThan(0);
      // Only the default specimens and the live demos take focus: at most 60 Tab stops per frame.
    }
    expect(await tabStops(page)).toBeLessThanOrEqual(60);
    // The two readings tables share their columns: each header sits where the other's does.
    for (const mode of MODES) {
      const heads = await canvasPane(page, mode).evaluate((pane) =>
        [...pane.querySelectorAll(".kit-readings table")].map((table) =>
          // Layout pixels: the frame may be scaled to fit.
          [...table.querySelectorAll("th")].map((head) => head.offsetLeft),
        ),
      );
      expect(heads, mode).toHaveLength(2);
      const [first = [], second = []] = heads;
      expect(second.length, mode).toBe(first.length);
      for (const [index, left] of first.entries()) {
        expect(
          Math.abs(left - (second[index] ?? 0)),
          `${mode} column ${index}`,
        ).toBeLessThanOrEqual(1);
      }
    }
    // Under 480 px of frame the readings stack as records: the table leaves the accessibility
    // tree, every row keeps its state label on screen, and each forced state still paints.
    const frames = page
      .getByRole("region", { name: "Canvas toolbar" })
      .getByRole("group", { name: "Frame", exact: true });
    await frames.getByRole("radio", { name: "360", exact: true }).check();
    for (const mode of MODES) {
      const pane = canvasPane(page, mode);
      await expect(pane.getByRole("table", { name: "Sample readings", exact: true })).toHaveCount(
        0,
      );
      const labels = await pane.locator('[data-kit="table-row"]').evaluateAll((rows) =>
        rows
          .filter((row) => row.getBoundingClientRect().width > 0)
          .map((row) => {
            const label = row.querySelector("[data-state-label]");
            const box = label?.getBoundingClientRect();
            return [
              row.getAttribute("data-state"),
              label?.textContent ?? null,
              box !== undefined && box.width > 0 && box.height > 0,
            ];
          }),
      );
      expect(labels, mode).toEqual(statesOf("table-row").map((state) => [state, state, true]));
      // The empty record is two lines, the label and then the sentence, with no separator.
      const empty = await pane
        .locator('li[data-kit="table-row"][data-state="empty"]')
        .evaluate((record) => {
          const label = record.querySelector("[data-state-label]")?.getBoundingClientRect();
          const sentence = record.querySelector("[data-empty-text]")?.getBoundingClientRect();
          return {
            text: record.textContent ?? "",
            stacked: label !== undefined && sentence !== undefined && sentence.top >= label.bottom,
          };
        });
      expect(empty.text, mode).not.toContain("·");
      expect(empty.stacked, mode).toBe(true);
      expect(await stateDifferences(pane), `${mode} at 360`).toEqual([]);
    }
    await frames.getByRole("radio", { name: "1280", exact: true }).check();
  });

  test("F-TPL-38 every text in the kitchen sink sets one step's whole type triple", async () => {
    const frames = page
      .getByRole("region", { name: "Canvas toolbar" })
      .getByRole("group", { name: "Frame", exact: true });
    for (const frame of ["1280", "360"]) {
      await frames.getByRole("radio", { name: frame, exact: true }).check();
      for (const mode of MODES) {
        const report = await typeTriples(canvasPane(page, mode));
        expect(report.checked, `${frame} ${mode}`).toBeGreaterThan(150);
        expect(report.classes, `${frame} ${mode} classes`).toEqual([]);
        expect(report.off, `${frame} ${mode}`).toEqual([]);
      }
    }
    await frames.getByRole("radio", { name: "1280", exact: true }).check();
  });

  test("F-TPL-04 the five button variants paint with their roles and name them", async () => {
    for (const mode of MODES) {
      const roles = first().color.roles[mode];
      const pane = canvasPane(page, mode);
      const style = (variant: string, state = "default") =>
        pane
          .locator(`[data-kit="button"][data-variant="${variant}"][data-state="${state}"]`)
          .evaluate((button) => {
            const computed = getComputedStyle(button);
            return {
              background: computed.backgroundColor,
              color: computed.color,
              underline: computed.textDecorationLine,
              roles: button.getAttribute("data-roles") ?? "",
            };
          });
      const transparent = "rgba(0, 0, 0, 0)";
      const expected = {
        primary: [rgbOf(roles.primary), rgbOf(roles["primary-foreground"])],
        secondary: [rgbOf(roles.secondary), rgbOf(roles["secondary-foreground"])],
        ghost: [transparent, rgbOf(roles.foreground)],
        destructive: [rgbOf(roles.destructive), rgbOf(roles["destructive-foreground"])],
        link: [transparent, rgbOf(roles.primary)],
      } as const;
      for (const variant of BUTTON_VARIANTS) {
        const got = await style(variant);
        expect([got.background, got.color], `${mode} ${variant}`).toEqual([...expected[variant]]);
        expect(got.roles, `${mode} ${variant}`).not.toBe("");
      }
      // The label is set in the body face, so T4's "show me" finds it (Task 2.10b).
      expect((await style("primary")).roles).toBe("primary primary-foreground font-body");
      expect((await style("ghost", "hover")).background, `${mode} ghost hover`).toBe(
        rgbOf(roles.muted),
      );
      expect((await style("link")).underline, mode).toContain("underline");
    }
  });

  test("F-TPL-05 motion demos run at the printed duration and easing", async () => {
    for (const mode of MODES) {
      const theme = vars(mode);
      const pane = canvasPane(page, mode);
      const demos = await computed(pane, "[data-token^='duration-'], [data-token^='ease-']", [
        "animation-name",
        "animation-duration",
        "animation-timing-function",
      ]);
      for (const demo of demos) {
        expect(demo["animation-name"], demo.token).not.toBe("none");
        if (demo.token.startsWith("duration-")) {
          const value = theme[`--${demo.token}`] ?? "";
          expect(demo.printed, demo.token).toBe(value);
          expect(ms(demo["animation-duration"] ?? ""), demo.token).toBeCloseTo(ms(value), 3);
          expect(demo["animation-timing-function"]).toBe(theme["--ease-standard"]);
        } else {
          const value = theme[`--${demo.token}`] ?? "";
          expect(demo.printed, demo.token).toBe(value);
          expect(demo["animation-timing-function"], demo.token).toBe(value);
          expect(ms(demo["animation-duration"] ?? "")).toBeCloseTo(
            ms(theme["--duration-slow"] ?? ""),
            3,
          );
        }
      }
    }
    // Each runner spans its track, so a demo travels the track's width less the dot.
    const spans = await canvasPane(page, "light")
      .locator("[data-runner]")
      .evaluateAll((runners) =>
        runners.map((runner) => [
          (runner as HTMLElement).offsetWidth,
          (runner.parentElement as HTMLElement).clientWidth,
          (runner.firstElementChild as HTMLElement).offsetWidth,
        ]),
      );
    expect(spans).toHaveLength(11);
    for (const [runner = 0, track = 0, dot = 0] of spans) expect(runner).toBe(track - dot);
    // A replay restarts them; under reduced motion they stop (F-CANVAS-07 checks every element).
    const replay = canvasPane(page, "light").getByRole("button", { name: "Replay", exact: true });
    await replay.click();
    await page.getByRole("switch", { name: "Reduce motion", exact: true }).click();
    const stopped = await computed(canvasPane(page, "light"), "[data-token^='duration-']", [
      "animation-name",
    ]);
    expect(stopped.every((demo) => demo["animation-name"] === "none")).toBe(true);
    await page.getByRole("switch", { name: "Reduce motion", exact: true }).click();
  });

  test("F-TPL-07 icons are lucide SVGs drawn at the spec's stroke width", async () => {
    const stroke = vars("light")["--icon-stroke"];
    const icons = await canvasFrame(page).evaluate((frame) =>
      [...frame.querySelectorAll("svg")].map((svg) => ({
        lucide: svg.classList.contains("lucide"),
        stroke: getComputedStyle(svg).strokeWidth,
      })),
    );
    expect(icons.length).toBeGreaterThan(20);
    expect(icons.filter((icon) => !icon.lucide)).toEqual([]);
    expect(new Set(icons.map((icon) => icon.stroke))).toEqual(new Set([`${stroke}px`]));
    // A part's own icon size wins over the default icon size: 1.75rem in the card media.
    const media = await canvasPane(page, "light")
      .locator(".kit-card-media svg")
      .first()
      .evaluate((svg) => getComputedStyle(svg).width);
    expect(media).toBe("28px");
  });

  test("F-TPL-08 concentric radii hold for an image in a card and a segmented control", async () => {
    for (const mode of MODES) {
      const radii = await canvasPane(page, mode).evaluate((pane) => {
        const px = (value: string) => Number.parseFloat(value);
        const card = pane.querySelector('[data-concentric="card"]');
        const media = pane.querySelector('[data-concentric="media"]');
        const outer = pane.querySelector('[data-concentric="segmented"]');
        const inner = outer?.querySelector('[data-concentric="segment"]');
        if (!card || !media || !outer || !inner) return null;
        const c = getComputedStyle(card);
        const o = getComputedStyle(outer);
        return {
          card: px(c.borderTopLeftRadius),
          padding: px(c.paddingTop),
          media: px(getComputedStyle(media).borderTopLeftRadius),
          outer: px(o.borderTopLeftRadius),
          inner: px(getComputedStyle(inner).borderTopLeftRadius),
          gap: px(o.paddingTop),
        };
      });
      expect(radii, mode).not.toBeNull();
      if (radii === null) continue;
      expect(radii.media, mode).toBe(Math.max(0, radii.card - radii.padding));
      expect(radii.outer, mode).toBe(radii.inner + radii.gap);
      // The segmented control hugs its segments: its track ends at the last segment plus padding.
      const slack = await canvasPane(page, mode).evaluate((pane) => {
        const outer = pane.querySelector<HTMLElement>('[data-concentric="segmented"]');
        const last = outer?.querySelector<HTMLElement>('[data-concentric="segment"]:last-child');
        if (!outer || !last) return null;
        // The frame may be scaled to fit: boxes are scaled, padding is not.
        const box = outer.getBoundingClientRect();
        const scale = box.width / outer.offsetWidth;
        const style = getComputedStyle(outer);
        const end =
          last.getBoundingClientRect().right +
          (Number.parseFloat(style.paddingRight) + Number.parseFloat(style.borderRightWidth)) *
            scale;
        return (box.right - end) / scale;
      });
      expect(slack, mode).not.toBeNull();
      expect(Math.abs(slack ?? 99), mode).toBeLessThanOrEqual(1);
      // Type samples keep a reading measure of at most 65 characters.
      const measures = await canvasPane(page, mode).evaluate((pane) =>
        [...pane.querySelectorAll<HTMLElement>('[data-token^="text-"]')].map((sample) => {
          // The sample's own `ch`, read as a computed length (layout px, unscaled, exact).
          const probe = document.createElement("span");
          probe.style.position = "absolute";
          probe.style.width = "100ch";
          sample.append(probe);
          const ch = Number.parseFloat(getComputedStyle(probe).width) / 100;
          probe.remove();
          return Number.parseFloat(getComputedStyle(sample).maxWidth) / ch;
        }),
      );
      for (const measure of measures) expect(measure, mode).toBeLessThanOrEqual(65.5);
    }
  });

  test("F-TPL-06 the kitchen sink fits each frame without horizontal overflow", async () => {
    const frameGroup = page
      .getByRole("region", { name: "Canvas toolbar" })
      .getByRole("group", { name: "Frame", exact: true });
    for (const frame of ["360", "768", "1280"]) {
      await frameGroup.getByRole("radio", { name: frame, exact: true }).check();
      const widths = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>("[data-canvas]")].map((element) => [
          element.scrollWidth,
          element.clientWidth,
        ]),
      );
      expect(widths).toHaveLength(3);
      for (const [scroll = 0, client = 0] of widths)
        expect(scroll, frame).toBeLessThanOrEqual(client);
    }
  });

  test("axe finds no violation on /studio with the kitchen sink, in light and in dark", async () => {
    for (const mode of MODES) {
      if (mode === "dark")
        await page.getByRole("switch", { name: "Dark mode", exact: true }).click();
      await expect(canvasFrame(page)).toHaveAttribute("data-mode", mode);
      const results = await new AxeBuilder({ page }).analyze();
      expect(
        results.violations.map((violation) => ({
          id: violation.id,
          nodes: violation.nodes.slice(0, 5).map((node) => node.target.join(" ")),
        })),
        mode,
      ).toEqual([]);
    }
  });
});

/** The templates of section 7.6. */
const SECTION_76 = ["landing", "editorial"] as const satisfies readonly TemplateId[];
/** The page templates of section 7.7 (Task 2.9); the mobile template draws screens, not a page. */
const SECTION_77 = ["dashboard", "settings"] as const satisfies readonly TemplateId[];
/** The page templates of sections 7.6 and 7.7: they follow the frame switcher. */
const PAGES = [...SECTION_76, ...SECTION_77] as const;
/** The templates the shared sweeps run: the page templates and the mobile template (Task 2.10a). */
const SWEPT = [...PAGES, "mobile"] as const satisfies readonly TemplateId[];
/** Every template. */
const EVERY_TEMPLATE = [
  "landing",
  "editorial",
  "dashboard",
  "settings",
  "mobile",
  "kitchen-sink",
] as const satisfies readonly TemplateId[];

/** A template other than `id`, shown first so that `id` mounts afresh. */
const elsewhere = (id: TemplateId): TemplateId => (id === "landing" ? "editorial" : "landing");

test.describe("7.6 The landing and editorial templates", () => {
  test.describe.configure({ mode: "serial" });
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    // A page of its own context: axe's builder needs one.
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    page = await context.newPage();
    await stubSeeds(page);
    await openStudio(page);
    await page.evaluate(() => document.fonts.ready);
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  for (const [id, caseId] of [
    ["landing", "F-TPL-09"],
    ["editorial", "F-TPL-10"],
  ] as const) {
    test(`${caseId} the ${id} template renders in the 360, 768 and 1280 frames without overflow`, async () => {
      const root = await showTemplate(page, id);
      for (const frame of [360, 768, 1280] as const) {
        await setFrame(page, frame);
        const report = await overflow(root);
        expect(report.scroll, `${frame}`).toBeLessThanOrEqual(report.client);
        expect(report.past, `${frame}`).toEqual([]);
      }
    });
  }

  test("F-TPL-11 the editorial body keeps a 60 to 75 character measure", async () => {
    const root = await showTemplate(page, "editorial");
    // The body paragraphs: the direct paragraphs of the article's sections.
    const measures = await root.locator("[data-prose] > section > p").evaluateAll((paragraphs) =>
      paragraphs.map((paragraph) => {
        // The paragraph's own `ch`, read as a computed length (layout px, unscaled).
        const probe = document.createElement("span");
        probe.style.position = "absolute";
        probe.style.width = "100ch";
        paragraph.append(probe);
        const ch = Number.parseFloat(getComputedStyle(probe).width) / 100;
        probe.remove();
        return Number.parseFloat(getComputedStyle(paragraph).maxWidth) / ch;
      }),
    );
    expect(measures.length).toBeGreaterThan(5);
    for (const measure of measures) {
      expect(measure).toBeGreaterThanOrEqual(60);
      expect(measure).toBeLessThanOrEqual(75);
    }
    // At the 1280 frame the measure on screen holds too, and the figure, the code block and the quote
    // end where the text does: the column has one right edge.
    await setFrame(page, 1280);
    const laid = await root.evaluate((element) => {
      const frame = element.closest<HTMLElement>("[data-frame]");
      if (frame === null) throw new Error("no frame");
      const scale = frame.getBoundingClientRect().width / frame.offsetWidth;
      const paragraphs = [...element.querySelectorAll<HTMLElement>("[data-prose] > section > p")];
      const widths = paragraphs.map((paragraph) => {
        const probe = document.createElement("span");
        probe.style.position = "absolute";
        probe.style.width = "100ch";
        paragraph.append(probe);
        const ch = Number.parseFloat(getComputedStyle(probe).width) / 100;
        probe.remove();
        return paragraph.offsetWidth / ch;
      });
      const right = (node: Element) => node.getBoundingClientRect().right / scale;
      const text = Math.max(...paragraphs.map(right));
      const edges = [".ed-figure", ".ed-code", ".ed-quote"].map((selector) => {
        const node = element.querySelector(selector);
        return [selector, node === null ? Number.NaN : Math.round(right(node) - text)] as const;
      });
      return { widths, edges };
    });
    for (const width of laid.widths) {
      expect(width).toBeGreaterThanOrEqual(60);
      expect(width).toBeLessThanOrEqual(75);
    }
    for (const [selector, offset] of laid.edges)
      expect(Math.abs(offset), selector).toBeLessThanOrEqual(1);
  });

  test("F-TPL-13 the landing features are a list beside a product moment, with no equal icon cards", async () => {
    const root = await showTemplate(page, "landing");
    const block = root.locator('[data-block="features"]');
    for (const frame of [1280, 768] as const) {
      await setFrame(page, frame);
      const list = await block.locator("[data-feature-list]").boundingBox();
      const moment = await block.locator("[data-moment]").boundingBox();
      expect(list, `${frame}`).not.toBeNull();
      expect(moment, `${frame}`).not.toBeNull();
      if (list === null || moment === null) continue;
      // Beside: the boxes share a vertical span and do not overlap horizontally.
      expect(list.y < moment.y + moment.height && moment.y < list.y + list.height, `${frame}`).toBe(
        true,
      );
      expect(list.x + list.width <= moment.x || moment.x + moment.width <= list.x, `${frame}`).toBe(
        true,
      );
      await expect(block.locator("[data-feature-list]")).toHaveRole("list");
    }
    for (const frame of [1280, 768, 360] as const) {
      await setFrame(page, frame);
      expect(await equalIconSiblings(block), `${frame}`).toEqual([]);
    }
    await setFrame(page, 1280);
  });

  test("F-TPL-13 the dashboard's KPI row holds no three equal icon cards", async () => {
    const root = await showTemplate(page, "dashboard");
    const kpis = root.locator("[data-kpis]");
    await expect(kpis).toHaveCount(1);
    await expect(kpis.locator("[data-kpi-value]")).toHaveCount(4);
    for (const frame of [1280, 768, 360] as const) {
      await setFrame(page, frame);
      expect(await equalIconSiblings(kpis), `${frame}`).toEqual([]);
    }
    await setFrame(page, 1280);
  });

  test("F-TPL-14 neither template sets gradient text", async () => {
    for (const id of SECTION_76) {
      const root = await showTemplate(page, id);
      const clipped = await root.evaluate((element) =>
        [element, ...element.querySelectorAll("*")]
          .filter((node) => {
            const style = getComputedStyle(node);
            const clip = `${style.backgroundClip} ${style.getPropertyValue("-webkit-background-clip")}`;
            const fill = style.getPropertyValue("-webkit-text-fill-color");
            return (
              clip.includes("text") &&
              (fill === "rgba(0, 0, 0, 0)" || style.color === "rgba(0, 0, 0, 0)")
            );
          })
          .map((node) => node.tagName),
      );
      expect(clipped, id).toEqual([]);
    }
  });

  test("F-TPL-15 no template holds a pictograph, and every SVG is a lucide icon or a named figure", async () => {
    for (const id of EVERY_TEMPLATE) {
      const root = await showTemplate(page, id);
      const report = await pictographs(root);
      expect(report.texts, id).toEqual([]);
      expect(report.svgs, id).toEqual([]);
      expect(await root.locator("svg").count(), id).toBeGreaterThan(2);
    }
  });

  test("F-TPL-16 no logo row or trusted-by text, each template says sample, and the landing hero holds no hero metric", async () => {
    for (const id of EVERY_TEMPLATE) {
      const root = await showTemplate(page, id);
      const report = await slop(root);
      expect(report.logoRows, id).toEqual([]);
      expect(report.trusted, id).toBe(false);
      expect(report.sample, id).toBe(true);
    }
    const hero = (await showTemplate(page, "landing")).locator('[data-block="hero"]');
    await expect(hero).toHaveCount(1);
    const metrics = await heroMetrics(hero);
    expect(metrics).toEqual([]);
  });

  test("F-TPL-16 the hero-metric pattern catches the common forms and none of the hero's own strings", () => {
    const figures = [
      "4.1 m",
      "$6.50",
      "99.9%",
      "10K+",
      "50,000+",
      "3×",
      "2x",
      "10x faster",
      "24/7",
      "#1",
      "4.9/5",
      "1M+ readings",
      "+38%",
      "99.9% uptime",
      "12 ms",
      "1,234,567,890.12",
    ];
    const words = [
      "Read the water before you cast off.",
      "Spring tide at Samphire Bay",
      "Start a tide log",
      "06:42 High water at the quay",
      "Today, sample readings",
      "Neap",
      "N",
    ];
    expect(figures.filter((text) => !HERO_FIGURE.test(text))).toEqual([]);
    expect(words.filter((text) => HERO_FIGURE.test(text))).toEqual([]);
  });

  test("F-TPL-17 each template has one entrance, nothing else animates on mount, and reduced motion places it at once", async () => {
    for (const id of SWEPT) {
      // Another template first, so this one mounts afresh.
      await showTemplate(page, elsewhere(id));
      const sampled = mountMotion(page, id);
      await showTemplate(page, id);
      const report = await sampled;
      expect(report.entrances, id).toBe(1);
      expect(report.moved, id).toEqual([]);
      expect(report.targets, id).toEqual([]);
      // The entrance itself runs: it passes through more than one state.
      expect(report.entrance.length, id).toBeGreaterThan(1);
    }
    const reduce = page.getByRole("switch", { name: "Reduce motion", exact: true });
    await reduce.click();
    await expect(canvasFrame(page)).toHaveAttribute("data-reduced-motion", "true");
    for (const id of SWEPT) {
      await showTemplate(page, elsewhere(id));
      const sampled = mountMotion(page, id);
      await showTemplate(page, id);
      const report = await sampled;
      expect(report.entrances, id).toBe(1);
      expect(report.moved, id).toEqual([]);
      expect(report.targets, id).toEqual([]);
      expect(report.entrance, id).toEqual(["1 none"]);
    }
    /** Mounts each page template from the mobile template, whose board takes another width. */
    const fromMobile = async (setting: string) => {
      // The switcher waits while the mobile template shows: the frame is set on a page template.
      await showTemplate(page, "landing");
      await setFrame(page, 1280);
      for (const id of PAGES) {
        await showTemplate(page, "mobile");
        const sampled = mountMotion(page, id);
        await templateSelect(page).selectOption(id);
        const report = await sampled;
        const name = `${setting}: ${id} from mobile`;
        expect(report.entrances, name).toBe(1);
        expect(report.moved, name).toEqual([]);
        expect(report.targets, name).toEqual([]);
        expect(report.entrance, name).toEqual(["1 none"]);
        // The frame shows the held width from the first sampled frame, never the board's.
        expect(report.widths, name).toEqual([1280]);
      }
    };
    await fromMobile("switch");
    await reduce.click();
    await expect(canvasFrame(page)).toHaveAttribute("data-reduced-motion", "false");
    // The system's setting: the chrome's global rule gives every property a 0.01 ms transition.
    await page.emulateMedia({ reducedMotion: "reduce" });
    try {
      await fromMobile("system");
    } finally {
      await page.emulateMedia({ reducedMotion: null });
    }
  });

  test("F-TPL-18 one h1 on the landing page, headings without gaps, and the article's H1 to H4 in order", async () => {
    for (const id of SWEPT) {
      const root = await showTemplate(page, id);
      const levels = await root
        .locator("h1, h2, h3, h4, h5, h6")
        .evaluateAll((headings) => headings.map((heading) => Number(heading.tagName.slice(1))));
      expect(levels[0], id).toBe(1);
      expect(
        levels.filter((level) => level === 1),
        id,
      ).toHaveLength(1);
      for (const [index, level] of levels.entries()) {
        if (index > 0)
          expect(level, `${id} heading ${index}`).toBeLessThanOrEqual((levels[index - 1] ?? 0) + 1);
      }
      if (id === "editorial") {
        const firsts = [1, 2, 3, 4].map((level) => levels.indexOf(level));
        expect(firsts.every((at) => at >= 0)).toBe(true);
        expect([...firsts].sort((a, b) => a - b)).toEqual(firsts);
      } else {
        expect(levels.length, id).toBeGreaterThan(id === "landing" ? 6 : 3);
      }
    }
  });

  test("F-TPL-19 the landing page varies radius and spacing by hierarchy", async () => {
    const root = await showTemplate(page, "landing");
    const used = await root.evaluate((element) => {
      const probe = document.createElement("div");
      element.append(probe);
      const radii = new Map<string, string>();
      for (const name of ["sm", "md", "lg", "xl", "2xl", "full"]) {
        probe.style.borderTopLeftRadius = `var(--radius-${name})`;
        radii.set(getComputedStyle(probe).borderTopLeftRadius, name);
      }
      const spaces = new Map<string, string>();
      for (const unit of [1, 2, 3, 4, 6, 8, 12, 16, 20, 24, 32]) {
        probe.style.paddingTop = `var(--space-${unit})`;
        spaces.set(getComputedStyle(probe).paddingTop, String(unit));
      }
      probe.remove();
      radii.delete("0px");
      const radius = new Set<string>();
      const space = new Set<string>();
      for (const node of [element, ...element.querySelectorAll("*")]) {
        const style = getComputedStyle(node);
        for (const corner of [
          style.borderTopLeftRadius,
          style.borderTopRightRadius,
          style.borderBottomRightRadius,
          style.borderBottomLeftRadius,
        ]) {
          const name = radii.get(corner);
          if (name !== undefined) radius.add(name);
        }
        for (const length of [
          style.paddingTop,
          style.paddingRight,
          style.paddingBottom,
          style.paddingLeft,
          style.marginTop,
          style.marginBottom,
          style.rowGap,
          style.columnGap,
        ]) {
          const name = spaces.get(length);
          if (name !== undefined) space.add(name);
        }
      }
      return { radius: [...radius], space: [...space] };
    });
    expect(used.radius.length, used.radius.join(" ")).toBeGreaterThanOrEqual(3);
    expect(used.space.length, used.space.join(" ")).toBeGreaterThanOrEqual(3);
  });

  test("F-TPL-20 editorial links are primary and underlined, selection is the spec's, and in-page links keep the hash", async () => {
    await setFrame(page, 1280);
    for (const id of SWEPT) {
      const root = await showTemplate(page, id);
      // Every in-page link names a target inside the template.
      const missing = await root.evaluate((element) =>
        [...element.querySelectorAll<HTMLAnchorElement>("a[href]")]
          .map((link) => link.getAttribute("href") ?? "")
          .filter(
            (href) =>
              !href.startsWith("#") ||
              element.querySelector(`[id="${CSS.escape(href.slice(1))}"]`) === null,
          ),
      );
      expect(missing, id).toEqual([]);
      expect(await root.locator("a[href]").count(), id).toBeGreaterThan(2);
    }
    const root = await showTemplate(page, "editorial");
    const [primary, onPrimary] = await Promise.all([
      roleColor(root, "primary"),
      roleColor(root, "primary-foreground"),
    ]);
    const links = await root.locator("a[href]").evaluateAll((anchors) =>
      anchors.map((anchor) => {
        const style = getComputedStyle(anchor);
        return [anchor.textContent ?? "", style.color, style.textDecorationLine];
      }),
    );
    for (const [text, color, line] of links) {
      expect(color, text).toBe(primary);
      expect(line, text).toContain("underline");
    }
    const selection = await root
      .locator("[data-prose] > section > p")
      .first()
      .evaluate((paragraph) => {
        const style = getComputedStyle(paragraph, "::selection");
        return [style.backgroundColor, style.color];
      });
    expect(selection).toEqual([primary, onPrimary]);
    // Following a link moves focus to its target and leaves the address bar's hash alone.
    for (const [id, name] of [
      ["editorial", "Roots and reds"],
      ["landing", "Pricing"],
      ["dashboard", "Gauges"],
      ["settings", "Danger zone"],
      ["mobile", "Open Samphire Bay"],
    ] as const) {
      const scope = await showTemplate(page, id);
      const before = await page.evaluate(() => window.location.hash);
      const link = scope.getByRole("link", { name, exact: true }).first();
      const target = (await link.getAttribute("href"))?.slice(1) ?? "";
      await link.click();
      await expect(scope.locator(`[id="${target}"]`)).toBeFocused();
      expect(await page.evaluate(() => window.location.hash), id).toBe(before);
      // No link banner either: the studio read no new hash.
      await expect(page.getByText(/This link/)).toHaveCount(0);
    }
    // A note reference moves focus to its note, and the note's back link returns it.
    const article = await showTemplate(page, "editorial");
    const before = await page.evaluate(() => window.location.hash);
    await article.getByRole("link", { name: "Note 1", exact: true }).click();
    await expect(article.locator('[id="thread-note-1"]')).toBeFocused();
    expect(await page.evaluate(() => window.location.hash)).toBe(before);
    await article.getByRole("link", { name: "Back to the text, from note 1", exact: true }).click();
    await expect(article.locator('[id="thread-ref-1"]')).toBeFocused();
    expect(await page.evaluate(() => window.location.hash)).toBe(before);
  });

  test("F-TPL-21 the FAQ accordion opens and closes by keyboard", async () => {
    const root = await showTemplate(page, "landing");
    const triggers = root.locator('[data-block="faq"] button[aria-expanded]');
    expect(await triggers.count()).toBeGreaterThanOrEqual(3);
    const second = triggers.nth(1);
    const panel = root.locator(`[id="${await second.getAttribute("aria-controls")}"]`);
    await expect(second).toHaveAttribute("aria-expanded", "false");
    await expect(panel).toBeHidden();
    await second.focus();
    await page.keyboard.press("Enter");
    await expect(second).toHaveAttribute("aria-expanded", "true");
    await expect(panel).toBeVisible();
    await page.keyboard.press("Space");
    await expect(second).toHaveAttribute("aria-expanded", "false");
    await expect(panel).toBeHidden();
    await page.keyboard.press("Space");
    await expect(second).toHaveAttribute("aria-expanded", "true");
    // Shift+Tab reaches the first question, open by default, and Enter closes it.
    const first = triggers.first();
    await expect(first).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Shift+Tab");
    await expect(first).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(first).toHaveAttribute("aria-expanded", "false");
    await page.keyboard.press("Enter");
    await expect(first).toHaveAttribute("aria-expanded", "true");
  });

  test("F-TPL-38 every text in the four page templates sets one step's whole type triple", async () => {
    const check = async (label: string) => {
      for (const frame of [1280, 360] as const) {
        await setFrame(page, frame);
        for (const id of PAGES) {
          const report = await typeTriples(await showTemplate(page, id));
          expect(report.checked, `${label} ${frame} ${id}`).toBeGreaterThan(25);
          expect(report.classes, `${label} ${frame} ${id} classes`).toEqual([]);
          expect(report.off, `${label} ${frame} ${id}`).toEqual([]);
        }
      }
      // The mobile template once (its screens are 360 px whatever the switcher holds), with each tab
      // panel shown and once with the sheet open.
      const mobile = await showTemplate(page, "mobile");
      await eachTab(mobile, async (tab) => {
        const report = await typeTriples(mobile);
        expect(report.checked, `${label} mobile ${tab}`).toBeGreaterThan(25);
        expect(report.classes, `${label} mobile ${tab} classes`).toEqual([]);
        expect(report.off, `${label} mobile ${tab}`).toEqual([]);
      });
      const sheet = await openSheet(mobile);
      const open = await typeTriples(sheet);
      expect(open.checked, `${label} mobile sheet`).toBeGreaterThan(5);
      expect(open.off, `${label} mobile sheet`).toEqual([]);
      await page.keyboard.press("Escape");
      await expect(sheet).toHaveCount(0);
      await showTemplate(page, "landing");
    };
    await check("default");
    // Below 480 px of frame the headlines set h2 and the price h4; from 480 px, display and h3.
    for (const [frame, title, price] of [
      [360, "h2", "h4"],
      [1280, "display", "h3"],
    ] as const) {
      await setFrame(page, frame);
      const landing = await showTemplate(page, "landing");
      expect(await typeStepOf(landing, ".lp-title"), `${frame} landing title`).toBe(title);
      expect(await typeStepOf(landing, ".lp-price-figure"), `${frame} price`).toBe(price);
      const article = await showTemplate(page, "editorial");
      expect(await typeStepOf(article, ".ed-title"), `${frame} article title`).toBe(title);
      // The dashboard's lead KPI value: h2 below 480 px of frame, h1 from it.
      const dashboard = await showTemplate(page, "dashboard");
      expect(
        await typeStepOf(dashboard, "[data-kpi-lead] [data-kpi-value]"),
        `${frame} lead KPI`,
      ).toBe(frame === 360 ? "h2" : "h1");
    }
    // The editorial context sets a fluid display step: a `cqi` clamp that follows the frame.
    const context = page
      .getByRole("complementary", { name: "Inputs" })
      .getByRole("combobox", { name: "Type context", exact: true });
    const original = await context.inputValue();
    await context.selectOption("editorial");
    await settled(page);
    expect((await canvasVars(page))["--text-display"]).toMatch(/^clamp\(.*cqi/);
    await check("editorial context");
    await context.selectOption(original);
    await settled(page);
    await setFrame(page, 1280);
  });

  test("F-TPL-39 every painted color in the landing, editorial, dashboard and settings templates is named in data-roles", async () => {
    const dark = page.getByRole("switch", { name: "Dark mode", exact: true });
    for (const mode of MODES) {
      if (mode === "dark") await dark.click();
      await expect(canvasFrame(page)).toHaveAttribute("data-mode", mode);
      for (const id of PAGES) {
        const report = await unnamedPaint(await showTemplate(page, id));
        expect(report.checked, `${mode} ${id}`).toBeGreaterThan(60);
        expect(report.unnamed, `${mode} ${id}`).toEqual([]);
      }
      const mobile = await showTemplate(page, "mobile");
      await eachTab(mobile, async (tab) => {
        const report = await unnamedPaint(mobile);
        expect(report.checked, `${mode} mobile ${tab}`).toBeGreaterThan(60);
        expect(report.unnamed, `${mode} mobile ${tab}`).toEqual([]);
      });
    }
    await dark.click();
    await expect(canvasFrame(page)).toHaveAttribute("data-mode", "light");
  });

  test("F-TPL-41 the article's contents sit beside the body at 1280, do not stick, and move focus to each section", async () => {
    await setFrame(page, 1280);
    const article = await showTemplate(page, "editorial");
    const toc = article.getByRole("navigation", { name: "Contents", exact: true });
    const [contents, body] = await Promise.all([
      toc.boundingBox(),
      article.locator("[data-prose]").boundingBox(),
    ]);
    expect(contents).not.toBeNull();
    expect(body).not.toBeNull();
    if (contents !== null && body !== null) {
      expect(contents.y < body.y + body.height && body.y < contents.y + contents.height).toBe(true);
      expect(contents.x + contents.width <= body.x).toBe(true);
    }
    expect(await toc.evaluate((element) => getComputedStyle(element).position)).not.toBe("sticky");
    const before = await page.evaluate(() => window.location.hash);
    const links = toc.getByRole("link");
    expect(await links.count()).toBe(4);
    for (const link of await links.all()) {
      const target = (await link.getAttribute("href"))?.slice(1) ?? "";
      await link.click();
      await expect(article.locator(`[id="${target}"]`)).toBeFocused();
      await expect(article.locator(`[id="${target}"]`)).toHaveRole("heading");
    }
    expect(await page.evaluate(() => window.location.hash)).toBe(before);
  });

  test("F-TPL-42 the tide card's events, the figure's name and its now label come from one sample tide", async () => {
    const landing = await showTemplate(page, "landing");
    const card = landing.locator(".lp-today");
    const events = await card
      .locator(".lp-event")
      .evaluateAll((rows) =>
        rows.map((row) => [
          row.querySelector("dt")?.textContent ?? "",
          ...[...row.querySelectorAll("dd .kit-num")].map((value) => value.textContent ?? ""),
        ]),
      );
    expect(events).toEqual(
      TIDE_EVENTS.map((event) => [
        event.kind === "high" ? "High water" : "Low water",
        clock(event.hour),
        `${event.meters.toFixed(1)} m`,
      ]),
    );
    const name = (await card.locator("svg[data-figure]").getAttribute("aria-label")) ?? "";
    for (const event of TIDE_EVENTS) expect(name).toContain(clock(event.hour));
    expect(name).toContain("now 09:30");
    await expect(card.locator("[data-now-label]")).toBeVisible();
    await expect(card.locator("[data-now-label]")).toHaveText("now 09:30");
  });

  test("F-TPL-12 axe finds no violation in either template, in light and dark, at 360 and 1280", async () => {
    // Eight full axe runs, 9 to 16 s alone (Task 2.10b, C5).
    test.setTimeout(60_000);
    // The Frame group is disabled while the mobile template shows, as F-TPL-39 leaves it, so start on a
    // page template whatever ran before: `setFrame` would otherwise wait out the test (C5).
    await showTemplate(page, SECTION_76[0]);
    const dark = page.getByRole("switch", { name: "Dark mode", exact: true });
    for (const mode of MODES) {
      if (mode === "dark") await dark.click();
      await expect(canvasFrame(page)).toHaveAttribute("data-mode", mode);
      for (const frame of [360, 1280] as const) {
        await setFrame(page, frame);
        for (const id of SECTION_76) {
          await showTemplate(page, id);
          const results = await new AxeBuilder({ page })
            .include("[data-canvas][data-frame]")
            .analyze();
          expect(
            results.violations.map((violation) => ({
              id: violation.id,
              nodes: violation.nodes.slice(0, 5).map((node) => node.target.join(" ")),
            })),
            `${mode} ${frame} ${id}`,
          ).toEqual([]);
          // What axe cannot decide (text over the primary block) lies only in the tide card.
          const undecided = results.incomplete
            .filter((result) => result.id === "color-contrast")
            .flatMap((result) => result.nodes.map((node) => String(node.target[0])));
          const outside = await page.evaluate(
            (selectors) =>
              selectors.filter(
                (selector) => document.querySelector(selector)?.closest(".lp-today") == null,
              ),
            undecided,
          );
          expect(outside, `${mode} ${frame} ${id} undecided outside the tide card`).toEqual([]);
          // Each undecided text is measured as painted: its color against the fill behind it.
          for (const pair of await paintedContrast(page, undecided)) {
            expect(
              pair.ratio,
              `${mode} ${frame} ${id} ${pair.selector} ${pair.reason}`,
            ).toBeGreaterThanOrEqual(pair.threshold);
          }
        }
      }
    }
    await dark.click();
    await setFrame(page, 1280);
    await expect(templateRoot(page, "landing").or(templateRoot(page, "editorial"))).toBeVisible();
  });
});

/**
 * The test design with every repeated role color moved by a few codes in its blue channel, so the 46
 * roles are pairwise distinct in each mode (F-TPL-39): a part that names the wrong role of a set that
 * shares one color can no longer pass.
 */
function distinctRoles(spec: DesignSpec): DesignSpec {
  const shift = (hex: string, by: number) => {
    const blue = Number.parseInt(hex.slice(5, 7), 16);
    const next = blue + by <= 255 ? blue + by : blue - by;
    return `${hex.slice(0, 5)}${next.toString(16).padStart(2, "0")}`;
  };
  const roles = Object.fromEntries(
    MODES.map((mode) => {
      const seen = new Set<string>();
      const table: Record<string, string> = {};
      for (const role of ROLE_NAMES) {
        const stored = spec.color.roles[mode][role];
        let hex: string = stored;
        for (let by = 1; seen.has(hex); by++) hex = shift(stored, by);
        seen.add(hex);
        table[role] = hex;
      }
      return [mode, table];
    }),
  );
  return DesignSpecSchema.parse({ ...spec, color: { ...spec.color, roles } });
}

test("F-TPL-39 every painted color is named on a design whose 46 role colors are distinct", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const spec = distinctRoles(first());
  for (const mode of MODES) {
    expect(new Set(Object.values(spec.color.roles[mode])).size, mode).toBe(ROLE_NAMES.length);
  }
  await openStudio(page, writeHash(spec));
  const dark = page.getByRole("switch", { name: "Dark mode", exact: true });
  for (const mode of MODES) {
    if (mode === "dark") await dark.click();
    await expect(canvasFrame(page)).toHaveAttribute("data-mode", mode);
    const vars = await canvasVars(page);
    expect(new Set(ROLE_NAMES.map((role) => vars[`--${role}`])).size, mode).toBe(ROLE_NAMES.length);
    for (const id of PAGES) {
      const report = await unnamedPaint(await showTemplate(page, id));
      expect(report.checked, `${mode} ${id}`).toBeGreaterThan(60);
      expect(report.unnamed, `${mode} ${id}`).toEqual([]);
    }
    // Once more with the settings' confirm dialog open: its layer, surface, title and buttons.
    const settings = await showTemplate(page, "settings");
    await settings.getByRole("button", { name: "Delete console", exact: true }).click();
    const dialog = settings.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await dialog.evaluate((element) =>
      Promise.all(
        (element.closest(".kit-confirm-layer") ?? element)
          .getAnimations({ subtree: true })
          .map((animation) => animation.finished),
      ),
    );
    const open = await unnamedPaint(settings.locator(".kit-confirm-layer"));
    expect(open.checked, `${mode} dialog`).toBeGreaterThan(5);
    expect(open.unnamed, `${mode} dialog`).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    // The mobile template with each tab panel shown, then with its bottom sheet open.
    const mobile = await showTemplate(page, "mobile");
    await eachTab(mobile, async (tab) => {
      const report = await unnamedPaint(mobile);
      expect(report.checked, `${mode} mobile ${tab}`).toBeGreaterThan(60);
      expect(report.unnamed, `${mode} mobile ${tab}`).toEqual([]);
    });
    const sheet = await openSheet(mobile);
    const layer = await unnamedPaint(mobile.locator(".kit-sheet-layer"));
    expect(layer.checked, `${mode} sheet`).toBeGreaterThan(8);
    expect(layer.unnamed, `${mode} sheet`).toEqual([]);
    // The whole template with the sheet open: the inert screens and their dim layers too.
    const whole = await unnamedPaint(mobile);
    expect(whole.checked, `${mode} template with the sheet open`).toBeGreaterThan(60);
    expect(whole.unnamed, `${mode} template with the sheet open`).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
  }
});

/**
 * F-TPL-31: the save bar keeps one row, so its height is at most the room its scroll area keeps
 * below a focused target (the area's computed `scroll-padding-bottom`). Returns the failure, if any.
 */
async function barRoom(root: Locator, name: string): Promise<string[]> {
  const room = await root.evaluate((element) => {
    const area = element.querySelector<HTMLElement>("[data-scroll-area]");
    const bar = element.querySelector<HTMLElement>("[data-save-bar]");
    if (area === null || bar === null) return null;
    return {
      bar: bar.offsetHeight,
      padding: Number.parseFloat(getComputedStyle(area).scrollPaddingBottom),
    };
  });
  if (room === null) return [`${name}: no scroll area or save bar`];
  return room.bar <= room.padding
    ? []
    : [`${name}: the save bar is ${room.bar} px, its scroll padding ${room.padding} px`];
}

/** Waits until the canvas's three families have loaded, so text is measured in its own face. */
async function fontsReady(page: Page): Promise<void> {
  await expect
    .poll(() =>
      canvasFrame(page).evaluate((frame) => {
        const names = ["--font-display", "--font-body", "--font-mono"].map(
          (name) =>
            ((frame as HTMLElement).style.getPropertyValue(name).match(/^"([^"]+)"/) ?? [])[1],
        );
        return names.every((name) =>
          [...document.fonts].some(
            (face) => face.family.replaceAll('"', "") === name && face.status === "loaded",
          ),
        );
      }),
    )
    .toBe(true);
}

test("F-TPL-40 every preset fits the page templates at 360 and 768 and the mobile screens, with real and with edge copy", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await stubSeeds(page);
  await openStudio(page);
  const preset = page
    .getByRole("complementary", { name: "Inputs" })
    .getByRole("combobox", { name: "Preset", exact: true });
  const copies = page
    .getByRole("region", { name: "Canvas toolbar" })
    .getByRole("group", { name: "Copy", exact: true });
  const failures: string[] = [];
  let measured = 0;
  const started = Date.now();
  for (const id of PRESET_IDS) {
    await preset.selectOption(id);
    await settled(page);
    await fontsReady(page);
    for (const template of PAGES) {
      const root = await showTemplate(page, template);
      for (const copy of ["Real copy", "Edge-case copy"] as const) {
        await copies.getByRole("radio", { name: copy, exact: true }).check();
        for (const frame of [360, 768] as const) {
          await setFrame(page, frame);
          const name = `${id} ${template} ${frame} ${copy}`;
          const [report, words, figures] = await Promise.all([
            overflow(root),
            brokenWords(root),
            figureLines(root),
          ]);
          measured++;
          // Each view measures what it claims: the copy it names, the edge word under edge copy and
          // a page of words, so an empty or stale root cannot pass.
          const shown = await root.evaluate((element) => ({
            copy: element.closest("[data-canvas]")?.getAttribute("data-copy"),
            text: element.textContent ?? "",
          }));
          if (shown.copy !== (copy === "Real copy" ? "real" : "edge")) {
            failures.push(`${name}: the frame shows ${shown.copy} copy`);
          }
          if (copy === "Edge-case copy" && !shown.text.includes(COPY.edge.word)) {
            failures.push(`${name}: no edge word`);
          }
          if (words.checked < 50) failures.push(`${name}: only ${words.checked} words measured`);
          if (report.scroll > report.client || report.past.length > 0) {
            failures.push(
              `${name}: ${report.scroll - report.client} px over ${report.past.join(" ")}`,
            );
          }
          if (words.broken.length > 0) failures.push(`${name}: ${words.broken.join(", ")}`);
          const split = figures.filter((line) => !line.endsWith(" 1"));
          if (split.length > 0) failures.push(`${name}: figures ${split.join(", ")}`);
          if (template === "settings") failures.push(...(await barRoom(root, name)));
        }
      }
      // F-TPL-31: the settings' save bar at the 1280 frame as well.
      if (template === "settings") {
        await setFrame(page, 1280);
        failures.push(...(await barRoom(root, `${id} settings 1280`)));
      }
    }
    // The mobile template at its own three 360 px screens, with the sheet closed and then open.
    const mobile = await showTemplate(page, "mobile");
    for (const copy of ["Real copy", "Edge-case copy"] as const) {
      await copies.getByRole("radio", { name: copy, exact: true }).check();
      const name = `${id} mobile ${copy}`;
      measured++;
      const [over, words, figures] = await Promise.all([
        mobileOverflow(mobile),
        brokenWords(mobile),
        figureLines(mobile),
      ]);
      const shown = await mobile.evaluate((element) => ({
        copy: element.closest("[data-canvas]")?.getAttribute("data-copy"),
        text: element.textContent ?? "",
      }));
      if (shown.copy !== (copy === "Real copy" ? "real" : "edge")) {
        failures.push(`${name}: the frame shows ${shown.copy} copy`);
      }
      if (copy === "Edge-case copy" && !shown.text.includes(COPY.edge.word)) {
        failures.push(`${name}: no edge word`);
      }
      if (words.checked < 50) failures.push(`${name}: only ${words.checked} words measured`);
      failures.push(...over.map((part) => `${name}: ${part}`));
      if (words.broken.length > 0) failures.push(`${name}: ${words.broken.join(", ")}`);
      const split = figures.filter((line) => !line.endsWith(" 1"));
      if (split.length > 0) failures.push(`${name}: figures ${split.join(", ")}`);
      const sheet = await openSheet(mobile);
      const [open, sheetWords] = await Promise.all([mobileOverflow(mobile), brokenWords(sheet)]);
      if (sheetWords.checked < 15) {
        failures.push(`${name} sheet: only ${sheetWords.checked} words measured`);
      }
      failures.push(...open.map((part) => `${name} sheet: ${part}`));
      if (sheetWords.broken.length > 0) {
        failures.push(`${name} sheet: ${sheetWords.broken.join(", ")}`);
      }
      await page.keyboard.press("Escape");
      await expect(sheet).toHaveCount(0);
      // Under edge copy, the stress case, the three other tab panels too.
      if (copy === "Edge-case copy") {
        await eachTab(mobile, async (tab) => {
          if (tab === "Alerts") return;
          // Only the tab bar screen changes with its tab: measure it alone.
          const tabs = screenOf(mobile, "tabs");
          const [panel, panelWords] = await Promise.all([
            overflow(tabs, "[data-phone]"),
            brokenWords(tabs),
          ]);
          if (panelWords.checked < 10) {
            failures.push(`${name} ${tab}: only ${panelWords.checked} words measured`);
          }
          if (panel.scroll > panel.client) {
            failures.push(`${name} ${tab}: scroll ${panel.scroll} > ${panel.client}`);
          }
          failures.push(...panel.past.map((part) => `${name} ${tab}: past the screen: ${part}`));
          if (panelWords.broken.length > 0) {
            failures.push(`${name} ${tab}: ${panelWords.broken.join(", ")}`);
          }
        });
      }
    }
  }
  console.log(`F-TPL-40: ${measured} views in ${((Date.now() - started) / 1000).toFixed(1)} s`);
  expect(measured).toBe(PRESET_IDS.length * (PAGES.length * 4 + 2));
  expect(failures).toEqual([]);
});

/** The toolbar's radio `name` in its group `group` (the panel has a Density group too). */
const toolbarRadio = (page: Page, group: string, name: string) =>
  page
    .getByRole("region", { name: "Canvas toolbar" })
    .getByRole("group", { name: group, exact: true })
    .getByRole("radio", { name, exact: true });

/** The settings template's scroll area, its save bar and the canvas region, as boxes on screen. */
function saveBar(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector('[data-template-root="settings"]');
    const area = root?.querySelector<HTMLElement>("[data-scroll-area]");
    const bar = root?.querySelector<HTMLElement>("[data-save-bar]");
    const region = document.querySelector<HTMLElement>("[data-canvas-region]");
    if (!area || !bar || !region) return null;
    const inside = (inner: DOMRect, outer: DOMRect) =>
      inner.top >= outer.top - 0.5 &&
      inner.bottom <= outer.bottom + 0.5 &&
      inner.left >= outer.left - 0.5 &&
      inner.right <= outer.right + 0.5;
    const box = bar.getBoundingClientRect();
    return {
      inArea: inside(box, area.getBoundingClientRect()),
      inRegion: inside(box, region.getBoundingClientRect()),
      scrolls: area.scrollHeight > area.clientHeight + 1,
      overflowY: getComputedStyle(area).overflowY,
      position: getComputedStyle(bar).position,
      top: Math.round(area.scrollTop),
      end: area.scrollHeight - area.clientHeight,
    };
  });
}

/** Scrolls the settings scroll area to `to` ("start" or "end") and waits a frame. */
function scrollArea(page: Page, to: "start" | "end"): Promise<void> {
  return page.evaluate(
    (to) =>
      new Promise<void>((resolve) => {
        const area = document.querySelector<HTMLElement>(
          '[data-template-root="settings"] [data-scroll-area]',
        );
        if (area) area.scrollTop = to === "start" ? 0 : area.scrollHeight;
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
    to,
  );
}

/** F-TPL-31: the save bar sits inside the scroll area and the canvas region, at the start and the end. */
async function expectBarStays(page: Page, name: string): Promise<void> {
  for (const to of ["start", "end"] as const) {
    await scrollArea(page, to);
    const bar = await saveBar(page);
    expect(bar, `${name} ${to}`).not.toBeNull();
    if (bar === null) continue;
    expect(bar.scrolls, `${name} the area scrolls`).toBe(true);
    expect(bar.overflowY, name).toBe("auto");
    expect(bar.position, name).toBe("sticky");
    if (to === "end") expect(bar.top, `${name} at the end`).toBeGreaterThanOrEqual(bar.end - 1);
    expect(bar.inArea, `${name} ${to}: inside the scroll area`).toBe(true);
    expect(bar.inRegion, `${name} ${to}: inside the canvas region`).toBe(true);
  }
}

/**
 * F-TPL-30: opens the settings' confirm dialog three times and clicks its description, its title and
 * then its scrim. After each click focus stays inside the dialog, and Escape closes it and gives
 * focus back to the opener. `held`, if given, runs while the dialog itself holds focus after the
 * click on its description: there no button keeps the arrows, only the canvas region's rule does.
 */
async function clickInsideDialog(
  page: Page,
  root: Locator,
  opener: Locator,
  held?: () => Promise<void>,
): Promise<void> {
  const inDialog = () =>
    page.evaluate(() => document.activeElement?.closest("[role='alertdialog']") != null);
  for (const where of ["description", "title", "scrim"] as const) {
    await opener.click();
    const dialog = root.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    if (where === "description") await dialog.getByText(/nothing is deleted/i).click();
    else if (where === "title") await dialog.getByRole("heading").click();
    else {
      // The scrim beside the dialog, halfway down: the frame's rounded corners clip the layer's own.
      const layer = root.locator(".kit-confirm-layer");
      const box = await layer.boundingBox();
      await layer.click({ position: { x: 6, y: (box?.height ?? 0) / 2 } });
    }
    expect(await inDialog(), `after a click on the ${where}`).toBe(true);
    if (where === "description" && held !== undefined) {
      await expect(dialog).toBeFocused();
      await held();
    }
    await page.keyboard.press("Escape");
    await expect(dialog, `Escape after a click on the ${where}`).toHaveCount(0);
    await expect(opener).toBeFocused();
  }
}

test.describe("7.7 The dashboard and settings templates", () => {
  test.describe.configure({ mode: "serial" });
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    // A page of its own context: axe's builder needs one.
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    page = await context.newPage();
    await stubSeeds(page);
    await openStudio(page);
    await page.evaluate(() => document.fonts.ready);
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  test("F-TPL-25 the dashboard fits each frame and its sidebar collapses to a rail below 768 px", async () => {
    const root = await showTemplate(page, "dashboard");
    const sidebar = root.locator("[data-sidebar]");
    await expect(sidebar).toHaveCount(1);
    for (const frame of [360, 768, 1280] as const) {
      await setFrame(page, frame);
      const report = await overflow(root);
      expect(report.scroll, `${frame}`).toBeLessThanOrEqual(report.client);
      expect(report.past, `${frame}`).toEqual([]);
      const shape = await sidebar.evaluate((element) => ({
        width: (element as HTMLElement).offsetWidth,
        labels: [...element.querySelectorAll("a[href] [data-label]")].map(
          (label) => (label as HTMLElement).offsetWidth,
        ),
      }));
      expect(shape.labels.length, `${frame} labels`).toBeGreaterThanOrEqual(4);
      if (frame === 360) {
        expect(shape.width, `${frame} rail`).toBeLessThanOrEqual(64);
        for (const width of shape.labels)
          expect(width, `${frame} hidden label`).toBeLessThanOrEqual(1);
      } else {
        expect(shape.width, `${frame} column`).toBeGreaterThanOrEqual(200);
        for (const width of shape.labels) expect(width, `${frame} label`).toBeGreaterThan(20);
      }
      // The KPI row stacks the lead card above the week's values below 1000 px of frame (M-5).
      const kpis = await root.locator("[data-kpis]").evaluate((element) => {
        const lead = element.querySelector("[data-kpi-lead]")?.getBoundingClientRect();
        const stats = element.querySelector(".db-stats")?.getBoundingClientRect();
        return lead === undefined || stats === undefined
          ? null
          : { stacked: stats.top >= lead.bottom - 0.5, beside: stats.left >= lead.right - 0.5 };
      });
      expect(kpis, `${frame} KPI row`).toEqual(
        frame === 1280 ? { stacked: false, beside: true } : { stacked: true, beside: false },
      );
      for (const name of ["Overview", "Alerts", "Gauges", "Exports"]) {
        await expect(
          sidebar.getByRole("link", { name, exact: true }),
          `${frame} ${name}`,
        ).toHaveCount(1);
      }
    }
    await setFrame(page, 1280);
    const roles = await Promise.all(
      ["sidebar", "sidebar-foreground", "sidebar-border"].map((role) => roleColor(root, role)),
    );
    const painted = await sidebar.evaluate((element) => {
      const style = getComputedStyle(element);
      return [style.backgroundColor, style.color, style.borderRightColor];
    });
    expect(painted).toEqual(roles);
  });

  test("F-TPL-23 KPI values and numeric cells set tabular numerals and keep one line", async () => {
    const root = await showTemplate(page, "dashboard");
    const values = await root.locator("[data-kpi-value], [data-numeric]").evaluateAll((elements) =>
      elements.map((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        const tops = new Set([...range.getClientRects()].map((rect) => Math.round(rect.top)));
        return {
          kpi: element.hasAttribute("data-kpi-value"),
          text: element.textContent ?? "",
          numeric: getComputedStyle(element).fontVariantNumeric,
          lines: tops.size,
        };
      }),
    );
    expect(values.filter((value) => value.kpi)).toHaveLength(4);
    expect(values.filter((value) => !value.kpi).length).toBeGreaterThanOrEqual(12);
    for (const value of values) {
      expect(value.numeric, value.text).toContain("tabular-nums");
      expect(value.lines, value.text).toBe(1);
    }
  });

  test("F-TPL-24 the dashboard's table rows follow --control-height in each density", async () => {
    const root = await showTemplate(page, "dashboard");
    const heights: number[] = [];
    for (const density of ["comfortable", "compact", "dense"] as const) {
      await toolbarRadio(page, "Density", density).check();
      await expect(canvasFrame(page)).toHaveAttribute("data-density", density);
      const control = Number.parseFloat((await canvasVars(page))["--control-height"] ?? "");
      const rows = await root
        .locator("[data-list] tbody tr")
        .evaluateAll((elements) => elements.map((row) => (row as HTMLElement).offsetHeight));
      expect(rows.length, density).toBeGreaterThan(1);
      for (const height of rows) expect(Math.abs(height - control), density).toBeLessThanOrEqual(1);
      heights.push(control);
    }
    expect(heights).toEqual([40, 36, 32]);
    await toolbarRadio(page, "Density", "comfortable").check();
  });

  test("F-TPL-26 the dashboard shows a toast in its root and an empty panel with one action", async () => {
    const root = await showTemplate(page, "dashboard");
    const toast = root.getByRole("status").filter({ hasText: "saved the alert rules" });
    await expect(toast).toHaveCount(1);
    await expect(toast).toBeVisible();
    const panel = root.locator("[data-empty-panel]");
    await expect(panel).toHaveCount(1);
    await expect(panel.getByRole("heading")).toHaveCount(1);
    await expect(panel.locator("p")).toHaveCount(1);
    await expect(panel.getByRole("button")).toHaveCount(1);
    // Dismissed, it stays dismissed across a view toggle: the state lives in the dashboard.
    await toast.getByRole("button", { name: "Dismiss", exact: true }).click();
    await expect(toast).toHaveCount(0);
    const dark = page.getByRole("switch", { name: "Dark mode", exact: true });
    await dark.click();
    await expect(canvasFrame(page)).toHaveAttribute("data-mode", "dark");
    await expect(root.getByRole("status").filter({ hasText: "saved the alert rules" })).toHaveCount(
      0,
    );
    await dark.click();
    await expect(canvasFrame(page)).toHaveAttribute("data-mode", "light");
  });

  test("F-TPL-28 the settings page renders every input type, each with a visible label", async () => {
    const root = await showTemplate(page, "settings");
    const controls = await controlLabels(root);
    // At least one radio group and one checkbox group show their legend.
    for (const kind of ["radio", "checkbox"]) {
      expect(
        controls.some((control) => control.kind === kind && control.legend === true),
        `${kind} group with a shown legend`,
      ).toBe(true);
    }
    // The color input shows the design's chart-1 and names it.
    const swatch = await root.locator('input[type="color"]').evaluate((input) => ({
      value: (input as HTMLInputElement).value,
      roles: (input.getAttribute("data-roles") ?? "").split(/\s+/),
    }));
    expect(rgbToHex(await roleColor(root, "chart-1"))).toBe(swatch.value);
    expect(swatch.roles).toContain("chart-1");
    const kinds = new Set(controls.map((control) => control.kind));
    for (const kind of [
      "text",
      "email",
      "password",
      "number",
      "range",
      "date",
      "color",
      "textarea",
      "select",
      "checkbox",
      "radio",
      "switch",
    ]) {
      expect(kinds.has(kind), kind).toBe(true);
    }
    expect(controls.filter((control) => !control.labeled)).toEqual([]);
  });

  test("F-TPL-29 the text input renders in all six validation states", async () => {
    const root = await showTemplate(page, "settings");
    const ring = await roleColor(root, "ring");
    const fields = await root.locator('input[type="text"][data-state]').evaluateAll((inputs) =>
      (inputs as HTMLInputElement[]).map((input) => {
        const ids = (input.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);
        const described = ids.map((id) => document.getElementById(id));
        const message = described.find((node) => node?.hasAttribute("data-tone"));
        const style = getComputedStyle(input);
        return {
          state: input.dataset.state ?? "",
          invalid: input.getAttribute("aria-invalid"),
          message: message?.textContent ?? null,
          below:
            message != null &&
            message.getBoundingClientRect().top >= input.getBoundingClientRect().bottom - 0.5,
          disabled: input.disabled,
          readOnly: input.readOnly,
          outline: `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`,
        };
      }),
    );
    const of = (state: string) => fields.find((field) => field.state === state);
    for (const state of [
      "default",
      "focus-visible",
      "invalid",
      "success",
      "disabled",
      "read-only",
    ]) {
      expect(of(state), state).toBeDefined();
    }
    expect(of("default")).toMatchObject({ invalid: null, disabled: false, readOnly: false });
    expect(of("focus-visible")?.outline).toBe(`solid 2px ${ring}`);
    expect(of("invalid")).toMatchObject({ invalid: "true", below: true, disabled: false });
    expect(of("invalid")?.message ?? "").not.toBe("");
    expect(of("success")).toMatchObject({ invalid: null, below: true });
    expect(of("success")?.message ?? "").not.toBe("");
    expect(of("disabled")).toMatchObject({ disabled: true });
    expect(of("read-only")).toMatchObject({ readOnly: true, disabled: false });
  });

  test("F-TPL-30 the danger zone's confirm dialog is contained, traps focus and closes by Escape and Cancel", async () => {
    await setFrame(page, 1280);
    const root = await showTemplate(page, "settings");
    const opener = root.getByRole("button", { name: "Delete console", exact: true });
    // One committed edit first, so undo has something to do if an arrow leaks out of the dialog.
    const first = await lotId(page).textContent();
    await page
      .getByRole("complementary", { name: "Inputs" })
      .getByRole("button", { name: "Regenerate", exact: true })
      .click();
    await expect(lotId(page)).not.toHaveText(first ?? "");
    await settled(page);
    const lot = await lotId(page).textContent();
    const toolbar = page.getByRole("region", { name: "Canvas toolbar" });
    const undo = toolbar.getByRole("button", { name: "Undo", exact: true });
    const redo = toolbar.getByRole("button", { name: "Redo", exact: true });
    await expect(undo).toHaveAttribute("aria-disabled", "false");
    await expect(redo).toHaveAttribute("aria-disabled", "true");
    await page.evaluate(() => {
      const counted = window as unknown as { __escapes: number };
      counted.__escapes = 0;
      window.addEventListener("keydown", (event) => {
        if (event.key === "Escape") counted.__escapes += 1;
      });
    });
    const inDialog = () =>
      page.evaluate(() => document.activeElement?.closest("[role='alertdialog']") != null);
    for (const close of ["Escape", "Cancel"] as const) {
      await opener.click();
      const dialog = root.getByRole("alertdialog");
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveAttribute("aria-modal", "true");
      await expect(dialog).toHaveAccessibleName(/delete this console/i);
      await expect(dialog).toHaveAccessibleDescription(/nothing is deleted/i);
      const placed = await dialog.evaluate((element) => ({
        modal: element.matches(":modal"),
        popover: element.matches(":popover-open"),
        positions: (() => {
          const found: string[] = [];
          for (let node: Element | null = element; node !== null; node = node.parentElement) {
            found.push(getComputedStyle(node).position);
            if (node.hasAttribute("data-template-root")) break;
          }
          return found;
        })(),
        rest: [
          ...(element.closest("[data-template-root]")?.querySelectorAll("[data-scroll-area]") ??
            []),
        ].every((area) => area.closest("[inert]") !== null),
      }));
      expect(placed.modal).toBe(false);
      expect(placed.popover).toBe(false);
      expect(placed.positions).toContain("absolute");
      expect(placed.positions).not.toContain("fixed");
      expect(placed.rest).toBe(true);
      const cancel = dialog.getByRole("button", { name: "Cancel", exact: true });
      await expect(cancel).toBeFocused();
      // Tab and Shift+Tab stay in the dialog.
      for (const key of ["Tab", "Tab", "Tab", "Shift+Tab", "Shift+Tab"]) {
        await page.keyboard.press(key);
        expect(await inDialog(), key).toBe(true);
      }
      await cancel.focus();
      if (close === "Escape") {
        const results = await new AxeBuilder({ page })
          .include("[data-canvas][data-frame]")
          .analyze();
        expect(results.violations.map((violation) => violation.id)).toEqual([]);
        await page.keyboard.press("Escape");
      } else {
        await page.keyboard.press("Space");
      }
      await expect(dialog).toHaveCount(0);
      await expect(opener).toBeFocused();
    }
    // A click on the dialog's text, on its title or on the scrim keeps focus inside it, so Escape
    // still closes it. With the dialog itself focused, the studio's keys do nothing: no undo or redo,
    // so the lot and the history hold.
    // Each key is checked on its own: an undo and a redo in a row would leave the lot as it was.
    await clickInsideDialog(page, root, opener, async () => {
      for (const key of ["ArrowLeft", "ArrowRight"]) {
        await page.keyboard.press(key);
        await expect(lotId(page), key).toHaveText(lot ?? "");
        await expect(undo, key).toHaveAttribute("aria-disabled", "false");
        await expect(redo, key).toHaveAttribute("aria-disabled", "true");
      }
    });
    expect(await page.evaluate(() => (window as unknown as { __escapes: number }).__escapes)).toBe(
      0,
    );
    await expect(lotId(page)).toHaveText(lot ?? "");
    // Back to the first design, for the flows that follow.
    await undo.click();
    await expect(lotId(page)).toHaveText(first ?? "");
    await settled(page);
  });

  test("F-TPL-31 the save bar sticks inside the settings scroll area at fit below 1 and at fit 1", async () => {
    await showTemplate(page, "settings");
    await setFrame(page, 1280);
    const fit = await canvasFrame(page).evaluate(
      (frame) => frame.getBoundingClientRect().width / (frame as HTMLElement).offsetWidth,
    );
    expect(fit).toBeLessThan(1);
    await expectBarStays(page, "1280 frame");
    await setFrame(page, 360);
    await expectBarStays(page, "360 frame");
    // A field focused under the bar scrolls clear of it.
    await scrollArea(page, "start");
    const root = templateRoot(page, "settings");
    await root.getByRole("button", { name: "Delete console", exact: true }).focus();
    const clear = await root.evaluate((element) => {
      const bar = element.querySelector("[data-save-bar]")?.getBoundingClientRect();
      const focused = document.activeElement?.getBoundingClientRect();
      return bar !== undefined && focused !== undefined && focused.bottom <= bar.top + 0.5;
    });
    expect(clear).toBe(true);
    await setFrame(page, 1280);
  });

  test("F-TPL-37 every template keeps clear of side stripes, clipped text, a second entrance and a second icon set", async () => {
    for (const id of EVERY_TEMPLATE) {
      const root = await showTemplate(page, id);
      const report = await antiSlop(root);
      expect(report.stripes, id).toEqual([]);
      expect(report.clipped, id).toEqual([]);
      expect(report.foreign, id).toEqual([]);
      expect(report.strokes, id).toHaveLength(1);
      await expect(canvasFrame(page).locator("[data-entrance]"), id).toHaveCount(1);
    }
  });

  test("F-TPL-27 axe finds no violation in the dashboard or settings, in light and dark, at 1280 and 360", async () => {
    const dark = page.getByRole("switch", { name: "Dark mode", exact: true });
    for (const mode of MODES) {
      if (mode === "dark") await dark.click();
      await expect(canvasFrame(page)).toHaveAttribute("data-mode", mode);
      for (const frame of [1280, 360] as const) {
        await setFrame(page, frame);
        for (const id of SECTION_77) {
          await showTemplate(page, id);
          const results = await new AxeBuilder({ page })
            .include("[data-canvas][data-frame]")
            .analyze();
          expect(
            results.violations.map((violation) => ({
              id: violation.id,
              nodes: violation.nodes.slice(0, 5).map((node) => node.target.join(" ")),
            })),
            `${mode} ${frame} ${id}`,
          ).toEqual([]);
          // What axe cannot decide is only the segmented control's labels, under their radios.
          const undecided = results.incomplete
            .filter((result) => result.id === "color-contrast")
            .flatMap((result) => result.nodes.map((node) => String(node.target[0])));
          const outside = await page.evaluate(
            (selectors) =>
              selectors.filter(
                (selector) => document.querySelector(selector)?.closest(".kit-segment") == null,
              ),
            undecided,
          );
          expect(outside, `${mode} ${frame} ${id} undecided outside the segmented control`).toEqual(
            [],
          );
          // Each undecided segment is measured as painted: its text against the fill behind it.
          for (const pair of await paintedContrast(page, undecided)) {
            expect(
              pair.ratio,
              `${mode} ${frame} ${id} ${pair.selector} ${pair.reason}`,
            ).toBeGreaterThanOrEqual(pair.threshold);
          }
        }
      }
    }
    await dark.click();
    await setFrame(page, 1280);
  });
});

test("F-TPL-22 the dashboard chart paints only with the five chart roles and neutral axes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const spec = distinctRoles(first());
  await openStudio(page, writeHash(spec));
  const dark = page.getByRole("switch", { name: "Dark mode", exact: true });
  for (const mode of MODES) {
    if (mode === "dark") await dark.click();
    await expect(canvasFrame(page)).toHaveAttribute("data-mode", mode);
    const root = await showTemplate(page, "dashboard");
    const chart = root.locator("[data-chart]");
    const svg = chart.locator("svg[data-figure]");
    await expect(svg).toHaveCount(1);
    const charts = [1, 2, 3, 4, 5].map((n) => `chart-${n}`);
    const colors = Object.fromEntries(
      await Promise.all(
        [...charts, "border", "muted-foreground", "foreground"].map(
          async (role) => [role, await roleColor(root, role)] as const,
        ),
      ),
    );
    const paints = await svg.evaluate((element) =>
      [element, ...element.querySelectorAll("*")].flatMap((node) => {
        const style = getComputedStyle(node);
        return [style.fill, style.stroke]
          .filter((value) => value.startsWith("rgb"))
          .map((value) => ({
            series: node.getAttribute("data-series"),
            value,
            tag: node.tagName.toLowerCase(),
          }));
      }),
    );
    const allowed = new Set(Object.values(colors));
    expect(
      paints.filter((paint) => !allowed.has(paint.value)),
      mode,
    ).toEqual([]);
    for (const paint of paints.filter((item) => item.series !== null)) {
      expect(paint.value, `${mode} series ${paint.series}`).toBe(colors[`chart-${paint.series}`]);
    }
    const used = new Set(
      paints.filter((paint) => paint.series !== null).map((paint) => paint.value),
    );
    expect(used.size, mode).toBe(5);
    // The visually hidden table holds every value the bars draw, and the name sums them up.
    const table = await chart.locator("table").evaluate((element) =>
      [...element.querySelectorAll("tbody tr")].map((row) => ({
        kind: row.querySelector("th")?.textContent ?? "",
        values: [...row.querySelectorAll("td")].map((cell) => Number(cell.textContent)),
      })),
    );
    expect(table).toHaveLength(5);
    const bars = await svg.locator("rect[data-series]").evaluateAll((rects) =>
      (rects as SVGRectElement[]).map((rect) => ({
        series: Number(rect.dataset.series),
        column: Number(rect.dataset.column),
        height: rect.height.baseVal.value,
      })),
    );
    const nonzero = table.flatMap((row) => row.values.filter((value) => value > 0));
    expect(bars).toHaveLength(nonzero.length);
    const per = bars.map(
      (bar) => bar.height / (table[bar.series - 1]?.values[bar.column] ?? Number.NaN),
    );
    for (const ratio of per) expect(ratio, mode).toBeCloseTo(per[0] ?? 0, 6);
    const name = (await svg.getAttribute("aria-label")) ?? "";
    const totals = table.map((row) => row.values.reduce((sum, value) => sum + value, 0));
    expect(name).toContain(String(totals.reduce((sum, value) => sum + value, 0)));
    for (const [index, row] of table.entries())
      expect(name).toContain(`${row.kind} ${totals[index]}`);
  }
});

test("F-TPL-30 Escape in the settings dialog never reaches a studio drawer at 360 × 740", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await stubSeeds(page);
  await openStudio(page);
  await showTemplate(page, "settings");
  await setFrame(page, 360);
  await page.evaluate(() => {
    const counted = window as unknown as { __escapes: number };
    counted.__escapes = 0;
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") counted.__escapes += 1;
    });
  });
  const root = templateRoot(page, "settings");
  const opener = root.getByRole("button", { name: "Delete console", exact: true });
  await opener.click();
  const dialog = root.getByRole("alertdialog");
  await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  await clickInsideDialog(page, root, opener);
  // The drawer check: a drawer closes on an Escape that reaches the window's key handler, and the
  // counter on the window shows that none did.
  expect(await page.evaluate(() => (window as unknown as { __escapes: number }).__escapes)).toBe(0);
});

test("F-TPL-31 the save bar stays inside the scroll area and the region after the region scrolls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await stubSeeds(page);
  await openStudio(page);
  await showTemplate(page, "settings");
  await setFrame(page, 768);
  const region = canvasRegion(page);
  const scrolled = await region.evaluate(
    (element) =>
      new Promise<number>((resolve) => {
        element.scrollTop = element.scrollHeight;
        requestAnimationFrame(() => resolve(element.scrollTop));
      }),
  );
  expect(scrolled).toBeGreaterThan(0);
  await expectBarStays(page, "768 frame at 1280 × 600");
});

test("F-TPL-31 a section heading focused from behind the save bar ends above it at 768 in the default design and in aurora", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await stubSeeds(page);
  await openStudio(page);
  const preset = page
    .getByRole("complementary", { name: "Inputs" })
    .getByRole("combobox", { name: "Preset", exact: true });
  /** Where a heading ends against the bar: its bottom and the bar's top, on screen. */
  const ends = (root: Locator, key: string) =>
    root.evaluate((element, key) => {
      const bar = element.querySelector("[data-save-bar]")?.getBoundingClientRect();
      const target = element.querySelector(`[id="settings-${key}"]`)?.getBoundingClientRect();
      return bar === undefined || target === undefined
        ? { bottom: Number.POSITIVE_INFINITY, barTop: 0 }
        : { bottom: target.bottom, barTop: bar.top };
    }, key);
  for (const id of ["default", "aurora"] as const) {
    await preset.selectOption(id);
    await settled(page);
    await fontsReady(page);
    const root = await showTemplate(page, "settings");
    await setFrame(page, 768);
    const links = root.getByRole("navigation", { name: "Settings sections", exact: true });
    // The real path: from the area's start, the "Boat" link focuses a heading near the bar.
    await scrollArea(page, "start");
    await links.getByRole("link", { name: "Boat", exact: true }).click();
    await expect(root.locator('[id="settings-boat"]')).toBeFocused();
    const boat = await ends(root, "boat");
    expect(boat.bottom, `${id} Boat from the start`).toBeLessThanOrEqual(boat.barTop + 0.5);
    // A heading scrolled entirely behind the bar, its top just under the bar's top, then focused.
    for (const [key, name] of [
      ["moorings", "Moorings"],
      ["alerts", "Alerts"],
      ["console", "Console"],
    ] as const) {
      const behind = await root.evaluate((element, key) => {
        const area = element.querySelector<HTMLElement>("[data-scroll-area]");
        const bar = element.querySelector("[data-save-bar]");
        const target = element.querySelector(`[id="settings-${key}"]`);
        if (!area || !bar || !target) return false;
        const scale = area.getBoundingClientRect().height / area.offsetHeight;
        const shift = target.getBoundingClientRect().top - bar.getBoundingClientRect().top - scale;
        area.scrollTop += shift / scale;
        const [b, h] = [bar.getBoundingClientRect(), target.getBoundingClientRect()];
        return h.top >= b.top && h.bottom <= b.bottom;
      }, key);
      expect(behind, `${id} ${name}: the heading lies behind the bar`).toBe(true);
      await links.getByRole("link", { name, exact: true }).click();
      await expect(root.locator(`[id="settings-${key}"]`)).toBeFocused();
      const end = await ends(root, key);
      expect(end.bottom, `${id} ${name}: the heading ends above the bar`).toBeLessThanOrEqual(
        end.barTop + 0.5,
      );
    }
  }
});

test("F-TPL-27 the shared color resolver reads every syntax the browser computes and refuses junk", async ({
  page,
}) => {
  await openStudio(page);
  const [rgb, half, oklab, oklch, srgb, mixed, clear, junk] = await resolveColors(page, [
    "rgb(10, 20, 30)",
    "rgba(10, 20, 30, 0.5)",
    "oklab(0.5 0.1 -0.1)",
    "oklch(0.6 0.1 200)",
    "color(srgb 1 0 0)",
    "color-mix(in oklab, rgb(255, 0, 0) 50%, rgb(0, 0, 255))",
    "transparent",
    "not-a-color",
  ]);
  expect(rgb).toEqual([10, 20, 30, 1]);
  expect(half?.[3]).toBeCloseTo(0.5, 1);
  for (const [name, value] of [
    ["oklab", oklab],
    ["oklch", oklch],
    ["color(srgb)", srgb],
    ["color-mix", mixed],
  ] as const) {
    expect(value, name).not.toBeNull();
    expect(value?.[3], name).toBe(1);
  }
  expect(srgb).toEqual([255, 0, 0, 1]);
  expect(clear?.[3]).toBe(0);
  expect(junk).toBeNull();
  // A computed oklab value reads as the same color its rgb serialization does.
  const computed = await page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.color = "color-mix(in oklab, rgb(200, 40, 60) 60%, rgb(20, 90, 200))";
    document.body.append(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  });
  expect(computed).toMatch(/^oklab\(/);
  const [fromComputed] = await resolveColors(page, [computed]);
  expect(fromComputed?.[3]).toBe(1);
});

/**
 * The parts where axe may leave color-contrast nodes undecided in the mobile template (F-TPL-36): the
 * open sheet's title and its sentence. Axe compares the stack of elements under each line of a text,
 * and the lines of each wrapped text lie over different parts of the inert screen beneath the sheet
 * ("partially overlaps other elements"), though the sheet's own opaque fill covers them all.
 */
const MOBILE_UNDECIDED: readonly string[] = [".kit-bottom-sheet-title", ".kit-bottom-sheet > p"];

/** The mobile board's shape: the fit, the canvas frame's and the area's widths, each screen. */
function boardShape(root: Locator) {
  return root.evaluate((element) => {
    const frame = element.closest<HTMLElement>("[data-canvas][data-frame]");
    const stage = element.closest<HTMLElement>("[data-canvas-stage]");
    if (frame === null || stage === null) throw new Error("no frame or stage");
    const outer = frame.getBoundingClientRect();
    const scale = outer.width / frame.offsetWidth;
    const probe = (host: Element) => {
      const span = document.createElement("span");
      span.className = "kit-sr-only-below-768";
      span.textContent = "A probe of the frame container";
      host.append(span);
      const width = span.getBoundingClientRect().width / scale;
      span.remove();
      return width;
    };
    // The body step as it shows: a mooring's name, its computed size times the fit.
    const body = element.querySelector(".mb-list-item > .kit-t-body");
    return {
      fit: scale,
      width: frame.offsetWidth,
      area: stage.clientWidth,
      bodyPx: body === null ? 0 : Number.parseFloat(getComputedStyle(body).fontSize) * scale,
      board: probe(element),
      screens: [...element.querySelectorAll<HTMLElement>("[data-phone]")].map((screen) => {
        const box = screen.getBoundingClientRect();
        const style = getComputedStyle(screen);
        return {
          name: screen.dataset.phone,
          width: screen.offsetWidth,
          container: `${style.containerType} ${style.containerName}`,
          top: Math.round((box.top - outer.top) / scale),
          inside: box.left >= outer.left - 0.5 && box.right <= outer.right + 0.5,
          probe: probe(screen),
        };
      }),
    };
  });
}

/** Shows the mobile template with the frame switcher holding `held`, chosen on the landing page first. */
async function showMobile(page: Page, held: 360 | 768 | 1280): Promise<Locator> {
  await showTemplate(page, "landing");
  await setFrame(page, held);
  const root = await showTemplate(page, "mobile");
  await expect(canvasFrame(page)).toHaveAttribute("data-frame", String(held));
  return root;
}

/**
 * F-TPL-34: each mobile screen's dim layer at rest, as "<screen> <opacity> <visibility>". The detail
 * screen has its sheet's own scrim, so its layer stays hidden. Waits for the transitions to end.
 */
function dims(root: Locator): Promise<string[]> {
  return root.evaluate(async (element) => {
    const layers = [...element.querySelectorAll<HTMLElement>("[data-phone] .kit-phone-dim")];
    await Promise.allSettled(
      layers.flatMap((layer) => layer.getAnimations().map((animation) => animation.finished)),
    );
    return layers.map((layer) => {
      const style = getComputedStyle(layer);
      const screen = layer.closest<HTMLElement>("[data-phone]")?.dataset.phone ?? "?";
      return `${screen} ${style.opacity} ${style.visibility}`;
    });
  });
}

/** Counts every Escape that reaches the window in `window.__escapes` (F-TPL-34). */
async function countEscapes(page: Page): Promise<() => Promise<number>> {
  await page.evaluate(() => {
    const counted = window as unknown as { __escapes: number };
    counted.__escapes = 0;
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") counted.__escapes += 1;
    });
  });
  return () => page.evaluate(() => (window as unknown as { __escapes: number }).__escapes);
}

test.describe("7.7 The mobile template", () => {
  test.describe.configure({ mode: "serial" });
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    // A page of its own context: axe's builder needs one.
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    page = await context.newPage();
    await stubSeeds(page);
    await openStudio(page);
    await page.evaluate(() => document.fonts.ready);
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  test("F-TPL-32 three 360 px screens at the canvas area's width, whatever the frame, and the switcher waits", async () => {
    const frames = page
      .getByRole("region", { name: "Canvas toolbar" })
      .getByRole("group", { name: "Frame", exact: true });
    /** Every screen is a 360 px size container named frame, inside the canvas frame. */
    const expectScreens = (shape: Awaited<ReturnType<typeof boardShape>>, name: string) => {
      expect(shape.screens.map((screen) => screen.name)).toEqual(["feed", "detail", "tabs"]);
      for (const screen of shape.screens) {
        const label = `${name} ${screen.name}`;
        expect(screen.width, label).toBe(360);
        expect(screen.container, label).toMatch(/^inline-size .*\bframe\b/);
        // At most 1 × 1 px, measured through the fit's scale (1.01 as the overflow measure allows).
        expect(screen.probe, `${label}: the probe is hidden inside the screen`).toBeLessThanOrEqual(
          1.01,
        );
        expect(screen.inside, `${label}: inside the canvas frame`).toBe(true);
      }
    };
    // Whatever frame the switcher held, the board takes the canvas area's width.
    for (const held of [360, 768, 1280] as const) {
      const root = await showMobile(page, held);
      const radios = frames.getByRole("radio");
      await expect(radios).toHaveCount(3);
      for (const radio of await radios.all()) await expect(radio, `${held}`).toBeDisabled();
      await expect(frames).toHaveAccessibleDescription("Three 360 px screens");
      const shape = await boardShape(root);
      expectScreens(shape, `held ${held}`);
      expect(shape.width, `held ${held}: the area's width`).toBe(
        Math.min(1280, Math.max(360, shape.area)),
      );
      expect(new Set(shape.screens.map((screen) => screen.top)).size, `held ${held} rows`).toBe(3);
      expect(await mobileOverflow(root), `held ${held}`).toEqual([]);
    }
    // With the 1280 frame held, at three windows: the screens read at full size.
    for (const [width, height, rows] of [
      [1280, 800, 3],
      [1440, 900, 3],
      [360, 740, 3],
      [1920, 1080, 1],
    ] as const) {
      await page.setViewportSize({ width, height });
      const root = templateRoot(page, "mobile");
      await expect(canvasFrame(page)).toHaveAttribute("data-frame", "1280");
      // The board follows the stage once its width is measured again.
      await expect
        .poll(async () => {
          const now = await boardShape(root);
          return now.width === Math.min(1280, Math.max(360, now.area));
        }, `${width}×${height}: the board takes the area's width`)
        .toBe(true);
      const shape = await boardShape(root);
      const name = `${width}×${height}`;
      expectScreens(shape, name);
      expect(shape.fit, `${name} fit`).toBeGreaterThanOrEqual(0.95);
      expect(shape.bodyPx, `${name} the body step on screen`).toBeGreaterThanOrEqual(14);
      expect(new Set(shape.screens.map((screen) => screen.top)).size, `${name} rows`).toBe(rows);
      if (width === 1920) {
        expect(shape.board, "the board's probe is laid out at 1920 × 1080").toBeGreaterThan(1);
      }
      expect(await mobileOverflow(root), name).toEqual([]);
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    // Another template brings the switcher back with the frame it held.
    await showTemplate(page, "landing");
    for (const radio of await frames.getByRole("radio").all()) await expect(radio).toBeEnabled();
    await expect(frames.getByRole("radio", { name: "1280", exact: true })).toBeChecked();
    await expect(canvasFrame(page)).toHaveAttribute("data-frame", "1280");
    await expect(frames).toHaveAccessibleDescription(/^fit \d+%$/);
    expect(
      await canvasFrame(page).evaluate((frame) => (frame as HTMLElement).offsetWidth),
      "the landing takes the held frame again",
    ).toBe(1280);
  });

  test("F-TPL-33 every button, link, tab and input in the screens has a 44 × 44 px hit area", async () => {
    const root = await showMobile(page, 1280);
    for (const density of ["comfortable", "dense"] as const) {
      // The density is set at 1280 × 800, where its group is in the toolbar, and holds at 360 × 740.
      await page.setViewportSize({ width: 1280, height: 800 });
      await toolbarRadio(page, "Density", density).check();
      await expect(canvasFrame(page)).toHaveAttribute("data-density", density);
      for (const [width, height] of [
        [1280, 800],
        [360, 740],
      ] as const) {
        await page.setViewportSize({ width, height });
        const name = `${width}×${height} ${density}`;
        const fit = await canvasFrame(page).evaluate(
          (frame) => frame.getBoundingClientRect().width / (frame as HTMLElement).offsetWidth,
        );
        if (width === 360) expect(fit, `${name}: fit below 1`).toBeLessThan(1);
        let checked = 0;
        for (const screen of SCREENS) {
          const report = await smallTargets(screenOf(root, screen));
          checked += report.checked;
          expect(report.small, `${name} ${screen}`).toEqual([]);
        }
        expect(checked, `${name} targets`).toBeGreaterThanOrEqual(12);
        // With the sheet open: its lead times and its two buttons.
        const sheet = await openSheet(root);
        const open = await smallTargets(sheet);
        expect(open.checked, `${name} sheet targets`).toBeGreaterThanOrEqual(6);
        expect(open.small, `${name} sheet`).toEqual([]);
        await page.keyboard.press("Escape");
        await expect(sheet).toHaveCount(0);
      }
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await toolbarRadio(page, "Density", "comfortable").check();
    await showTemplate(page, "landing");
    await setFrame(page, 1280);
  });

  test("F-TPL-34 the bottom sheet is contained, keeps focus and closes by Escape and Cancel", async () => {
    const root = await showMobile(page, 1280);
    const detail = screenOf(root, "detail");
    const opener = detail.getByRole("button", { name: "Set an alert", exact: true });
    const escapes = await countEscapes(page);
    const inSheet = () =>
      page.evaluate(() => document.activeElement?.closest("[role='dialog']") != null);
    for (const close of ["Escape", "Cancel"] as const) {
      const sheet = await openSheet(root);
      await expect(sheet).toHaveAttribute("aria-modal", "true");
      await expect(sheet).toHaveAccessibleName(/alert me before high water/i);
      await expect(sheet).toHaveAccessibleDescription(/nothing is sent/i);
      const placed = await sheet.evaluate((element) => {
        const screen = element.closest<HTMLElement>("[data-phone]");
        const layer = element.closest(".kit-sheet-layer");
        if (screen === null || layer === null) throw new Error("no screen or layer");
        const probe = document.createElement("span");
        probe.style.boxShadow = "var(--shadow-4)";
        probe.style.borderRadius = "var(--radius-2xl)";
        element.append(probe);
        const expected = getComputedStyle(probe);
        const [shadow, radius] = [expected.boxShadow, expected.borderTopLeftRadius];
        probe.remove();
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        const frame = screen.getBoundingClientRect();
        const positions: string[] = [];
        for (let node: Element | null = element; node !== null; node = node.parentElement) {
          positions.push(getComputedStyle(node).position);
          if (node.hasAttribute("data-template-root")) break;
        }
        return {
          modal: element.matches(":modal"),
          popover: element.matches(":popover-open"),
          positions,
          inside:
            box.left >= frame.left - 0.5 &&
            box.right <= frame.right + 0.5 &&
            box.top >= frame.top - 0.5,
          bottom: Math.abs(box.bottom - frame.bottom),
          shadow: style.boxShadow === shadow,
          corners: [
            style.borderTopLeftRadius,
            style.borderTopRightRadius,
            style.borderBottomRightRadius,
            style.borderBottomLeftRadius,
          ],
          radius,
          // The rest of the detail screen is inert, and so is every element of the other screens.
          rest: [...screen.querySelectorAll("*")]
            .filter((node) => !layer.contains(node))
            .every((node) => node.closest("[inert]") !== null),
          others: [...document.querySelectorAll("[data-phone]")]
            .filter((other) => other !== screen)
            .map((other) => [...other.querySelectorAll("*")])
            .every(
              (nodes) =>
                nodes.length > 10 && nodes.every((node) => node.closest("[inert]") !== null),
            ),
        };
      });
      expect(placed.modal).toBe(false);
      expect(placed.popover).toBe(false);
      expect(placed.positions).toContain("absolute");
      expect(placed.positions).not.toContain("fixed");
      expect(placed.inside, "inside the detail screen").toBe(true);
      expect(placed.bottom, "at the screen's bottom").toBeLessThanOrEqual(1);
      expect(placed.shadow, "--shadow-4").toBe(true);
      expect(placed.corners).toEqual([placed.radius, placed.radius, "0px", "0px"]);
      expect(placed.rest, "the rest of the detail screen is inert").toBe(true);
      expect(placed.others, "the other screens are inert too").toBe(true);
      // The lead times are a radio group whose legend shows, and each lead time's label shows.
      const radios = (await controlLabels(sheet)).filter((control) => control.kind === "radio");
      expect(radios, "four lead times").toHaveLength(4);
      for (const radio of radios) {
        expect(radio.legend, `"${radio.text}": the group's legend shows`).toBe(true);
        expect(radio.labeled, `"${radio.text}": its label shows`).toBe(true);
      }
      // The two other screens show their dim layer while the sheet is open.
      expect(await dims(root), "the feed and tab bar screens are dimmed").toEqual([
        "feed 1 visible",
        "detail 0 hidden",
        "tabs 1 visible",
      ]);
      await expect(sheet.getByRole("radio", { checked: true })).toBeFocused();
      for (const key of ["Tab", "Tab", "Tab", "Tab", "Shift+Tab", "Shift+Tab"]) {
        await page.keyboard.press(key);
        expect(await inSheet(), key).toBe(true);
      }
      if (close === "Escape") {
        await page.keyboard.press("Escape");
      } else {
        await sheet.getByRole("button", { name: "Cancel", exact: true }).focus();
        await page.keyboard.press("Space");
      }
      await expect(sheet, close).toHaveCount(0);
      await expect(opener, close).toBeFocused();
    }
    // Under the pointer: a click on the description, the title or the scrim keeps focus in the
    // sheet, and Escape still closes it.
    for (const where of ["description", "title", "scrim"] as const) {
      const sheet = await openSheet(root);
      if (where === "description") await sheet.getByText(/nothing is sent/i).click();
      else if (where === "title") await sheet.getByRole("heading").click();
      else {
        // The scrim at the top of the screen, above the sheet and clear of its rounded corners.
        const layer = root.locator(".kit-sheet-layer");
        const box = await layer.boundingBox();
        await layer.click({ position: { x: (box?.width ?? 0) / 2, y: 12 } });
      }
      expect(await inSheet(), `after a click on the ${where}`).toBe(true);
      await page.keyboard.press("Escape");
      await expect(sheet, `Escape after a click on the ${where}`).toHaveCount(0);
      await expect(opener).toBeFocused();
    }
    // Outside the sheet, at a window where the three screens share a row: a press on the feed screen,
    // on a tab of the tab bar screen or on the board between two screens keeps focus in the sheet.
    await page.setViewportSize({ width: 1920, height: 1080 });
    for (const where of ["feed", "tabs", "board"] as const) {
      const sheet = await openSheet(root);
      const target =
        where === "feed"
          ? screenOf(root, "feed").locator("h1")
          : where === "tabs"
            ? screenOf(root, "tabs").getByRole("tab", { name: "Places", exact: true })
            : screenOf(root, "feed");
      await target.scrollIntoViewIfNeeded();
      const box = await target.boundingBox();
      if (box === null) throw new Error(`no box for the ${where}`);
      if (where === "board") {
        // Between the feed and the detail screens, on the board itself.
        const detail = await screenOf(root, "detail").boundingBox();
        if (detail === null) throw new Error("no box for the detail screen");
        await page.mouse.click((box.x + box.width + detail.x) / 2, box.y + 120);
      } else {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      }
      expect(await inSheet(), `after a press on the ${where}`).toBe(true);
      await page.keyboard.press("Escape");
      await expect(sheet, `Escape after a press on the ${where}`).toHaveCount(0);
      await expect(opener).toBeFocused();
    }
    expect(await dims(root), "the dim layers are hidden once the sheet closes").toEqual([
      "feed 0 hidden",
      "detail 0 hidden",
      "tabs 0 hidden",
    ]);
    await page.setViewportSize({ width: 1280, height: 800 });
    expect(await escapes(), "Escapes that reached the window").toBe(0);
    // It rises over --duration-base with --ease-decelerate, read as the rise starts, so a busy runner
    // that reaches the sheet after it has settled cannot miss it; and not at all under reduced motion.
    type Rise = { name: string; duration: boolean; easing: boolean };
    await page.evaluate(() => {
      const host = window as unknown as { __rise: Rise | null; __riseListening?: boolean };
      host.__rise = null;
      if (host.__riseListening) return;
      host.__riseListening = true;
      document.addEventListener(
        "animationstart",
        (event) => {
          const target = event.target;
          if (!(target instanceof HTMLElement) || !target.classList.contains("kit-bottom-sheet")) {
            return;
          }
          if (host.__rise !== null) return;
          const probe = document.createElement("span");
          probe.style.animationDuration = "var(--duration-base)";
          probe.style.animationTimingFunction = "var(--ease-decelerate)";
          target.append(probe);
          const expected = getComputedStyle(probe);
          const own = getComputedStyle(target);
          host.__rise = {
            name: own.animationName,
            duration: own.animationDuration === expected.animationDuration,
            easing: own.animationTimingFunction === expected.animationTimingFunction,
          };
          probe.remove();
        },
        true,
      );
    });
    await opener.click();
    const sheet = detail.getByRole("dialog");
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __rise: Rise | null }).__rise))
      .not.toBeNull();
    const rise = await page.evaluate(
      () => (window as unknown as { __rise: Rise | null }).__rise ?? { name: "none" },
    );
    expect(rise.name).not.toBe("none");
    expect("duration" in rise && rise.duration, "--duration-base").toBe(true);
    expect("easing" in rise && rise.easing, "--ease-decelerate").toBe(true);
    await sheet.getByRole("button", { name: "Cancel", exact: true }).click();
    const reduce = page.getByRole("switch", { name: "Reduce motion", exact: true });
    await reduce.click();
    await expect(canvasFrame(page)).toHaveAttribute("data-reduced-motion", "true");
    await opener.click();
    expect(await sheet.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
    await sheet.getByRole("button", { name: "Cancel", exact: true }).click();
    await reduce.click();
    await expect(canvasFrame(page)).toHaveAttribute("data-reduced-motion", "false");
    // A lead time saved shows in the alert row; one picked and cancelled does not.
    const row = detail.locator("[data-alert-row]");
    await expect(row).toContainText("30 min");
    await openSheet(root);
    await sheet.getByRole("radio", { name: "1 hour", exact: true }).check();
    await sheet.getByRole("button", { name: "Save alert", exact: true }).click();
    await expect(sheet).toHaveCount(0);
    await expect(opener).toBeFocused();
    await expect(row).toContainText("1 hour");
    await openSheet(root);
    await expect(sheet.getByRole("radio", { name: "1 hour", exact: true })).toBeChecked();
    await sheet.getByRole("radio", { name: "15 min", exact: true }).check();
    await sheet.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(row).toContainText("1 hour");
    // Open, with a lead time picked, the sheet holds across a mode toggle: its state is the root's.
    await openSheet(root);
    await sheet.getByRole("radio", { name: "2 hours", exact: true }).check();
    const dark = page.getByRole("switch", { name: "Dark mode", exact: true });
    await dark.click();
    await expect(canvasFrame(page)).toHaveAttribute("data-mode", "dark");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("radio", { name: "2 hours", exact: true })).toBeChecked();
    await dark.click();
    await expect(canvasFrame(page)).toHaveAttribute("data-mode", "light");
    await sheet.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(row).toContainText("1 hour");
  });

  test("F-TPL-35 the tab bar is a tablist with a roving tab stop, arrows, Home and End", async () => {
    const root = await showMobile(page, 1280);
    const bar = screenOf(root, "tabs").getByRole("tablist");
    await expect(bar).toHaveAccessibleName("Saltmarsh, sample");
    await expect(bar.getByRole("tab")).toHaveCount(4);
    /** Each tab: its name, selection, tab stop and panel. */
    const tabs = () =>
      bar.evaluate((element) =>
        [...element.querySelectorAll<HTMLElement>("[role='tab']")].map((tab) => {
          const panel = document.getElementById(tab.getAttribute("aria-controls") ?? "");
          return {
            name: (tab.textContent ?? "").trim(),
            selected: tab.getAttribute("aria-selected"),
            stop: tab.tabIndex,
            panel:
              panel === null
                ? null
                : {
                    role: panel.getAttribute("role"),
                    labelled: panel.getAttribute("aria-labelledby") === tab.id,
                    shown: !panel.hidden && panel.getBoundingClientRect().height > 0,
                    stop: panel.tabIndex,
                  },
          };
        }),
      );
    const expectSelected = async (name: string, label: string) => {
      const now = await tabs();
      expect(
        now.map((tab) => tab.name),
        label,
      ).toEqual([...TABS]);
      for (const tab of now) {
        const on = tab.name === name;
        expect(tab.selected, `${label} ${tab.name}`).toBe(String(on));
        expect(tab.stop, `${label} ${tab.name} tab stop`).toBe(on ? 0 : -1);
        expect(tab.panel, `${label} ${tab.name} panel`).toMatchObject({
          role: "tabpanel",
          labelled: true,
          shown: on,
        });
        // The selected panel is a tab stop, so a keyboard reaches its text from the tab.
        if (on) expect(tab.panel?.stop, `${label} ${tab.name} panel stop`).toBe(0);
      }
    };
    await expectSelected("Alerts", "first");
    // One committed edit first, so undo has something to do if an arrow leaks.
    const first = await lotId(page).textContent();
    await page
      .getByRole("complementary", { name: "Inputs" })
      .getByRole("button", { name: "Regenerate", exact: true })
      .click();
    await expect(lotId(page)).not.toHaveText(first ?? "");
    await settled(page);
    const lot = await lotId(page).textContent();
    const toolbar = page.getByRole("region", { name: "Canvas toolbar" });
    const undo = toolbar.getByRole("button", { name: "Undo", exact: true });
    const redo = toolbar.getByRole("button", { name: "Redo", exact: true });
    await bar.getByRole("tab", { selected: true }).focus();
    for (const [key, name] of [
      ["ArrowRight", "Crew"],
      ["ArrowRight", "Today"],
      ["ArrowLeft", "Crew"],
      ["ArrowLeft", "Alerts"],
      ["Home", "Today"],
      ["ArrowLeft", "Crew"],
      ["End", "Crew"],
      ["Home", "Today"],
      ["End", "Crew"],
    ] as const) {
      await page.keyboard.press(key);
      await expectSelected(name, key);
      await expect(bar.getByRole("tab", { name, exact: true }), key).toBeFocused();
      // The arrows stay with the tab bar: no undo or redo, so the lot and the history hold.
      await expect(lotId(page), key).toHaveText(lot ?? "");
      await expect(undo, key).toHaveAttribute("aria-disabled", "false");
      await expect(redo, key).toHaveAttribute("aria-disabled", "true");
    }
    await bar.getByRole("tab", { name: "Places", exact: true }).click();
    await expectSelected("Places", "click");
    const dark = page.getByRole("switch", { name: "Dark mode", exact: true });
    await dark.click();
    await expect(canvasFrame(page)).toHaveAttribute("data-mode", "dark");
    await expectSelected("Places", "after a mode toggle");
    await dark.click();
    await bar.getByRole("tab", { name: "Alerts", exact: true }).click();
    await undo.click();
    await expect(lotId(page)).toHaveText(first ?? "");
    await settled(page);
  });

  test("F-TPL-36 axe finds no violation in the mobile template, in light and dark, at 1280 × 800 and 360 × 740, and with the sheet open", async () => {
    const dark = page.getByRole("switch", { name: "Dark mode", exact: true });
    /** Axe on the canvas frame: no violation, and each undecided node pinned and measured. */
    const scan = async (name: string) => {
      const results = await new AxeBuilder({ page }).include("[data-canvas][data-frame]").analyze();
      expect(
        results.violations.map((violation) => ({
          id: violation.id,
          nodes: violation.nodes.slice(0, 5).map((node) => node.target.join(" ")),
        })),
        name,
      ).toEqual([]);
      const undecided = results.incomplete
        .filter((result) => result.id === "color-contrast")
        .flatMap((result) => result.nodes.map((node) => String(node.target[0])));
      const outside = await page.evaluate(
        ({ selectors, parts }) =>
          selectors.filter(
            (selector) =>
              !parts.some((part) => document.querySelector(selector)?.closest(part) != null),
          ),
        { selectors: undecided, parts: [...MOBILE_UNDECIDED] },
      );
      expect(outside, `${name} undecided outside the pinned parts`).toEqual([]);
      for (const pair of await paintedContrast(page, undecided)) {
        expect(pair.ratio, `${name} ${pair.selector} ${pair.reason}`).toBeGreaterThanOrEqual(
          pair.threshold,
        );
      }
    };
    const root = await showMobile(page, 1280);
    for (const mode of MODES) {
      // The mode is set at 1280 × 800, where its switch is in the toolbar, and holds at 360 × 740.
      await page.setViewportSize({ width: 1280, height: 800 });
      if (mode === "dark") await dark.click();
      await expect(canvasFrame(page)).toHaveAttribute("data-mode", mode);
      for (const [width, height] of [
        [1280, 800],
        [360, 740],
      ] as const) {
        await page.setViewportSize({ width, height });
        const name = `${mode} ${width}×${height}`;
        await scan(name);
        const sheet = await openSheet(root);
        await scan(`${name} with the sheet open`);
        await page.keyboard.press("Escape");
        await expect(sheet).toHaveCount(0);
        // The other screens' dim layers fade out; the next scan reads the screens at rest.
        expect(await dims(root), `${name}: the dims at rest`).toEqual([
          "feed 0 hidden",
          "detail 0 hidden",
          "tabs 0 hidden",
        ]);
      }
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await dark.click();
    await expect(canvasFrame(page)).toHaveAttribute("data-mode", "light");
    await showTemplate(page, "landing");
    await setFrame(page, 1280);
  });
});
