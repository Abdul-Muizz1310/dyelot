import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { hexToRgb, ROLE_NAMES, wcagRatio } from "@/engine";
import { BUTTON_VARIANTS, KIT_COMPONENTS, statesOf } from "@/features/preview/kit/states";
import { TEXT_PAIRS } from "@/features/preview/swatches";
import type { TemplateId } from "@/features/studio/view";
import { themeVars } from "@/theme/vars";
import {
  canvasFrame,
  canvasPane,
  canvasVars,
  designFor,
  FRESH,
  openStudio,
  seedOf,
  settled,
  stubSeeds,
} from "./studio-support";
import {
  equalIconSiblings,
  overflow,
  pictographs,
  roleColor,
  setFrame,
  showTemplate,
  slop,
  TYPE_STEPS,
  templateRoot,
  typeTriples,
  unnamedPaint,
} from "./template-support";

// The template flows of docs/specs/02-studio.md: the kitchen sink of section 7.5 (Task 2.7, F-TPL-01
// to F-TPL-08 and F-TPL-38, and axe in both modes) and the landing and editorial templates of section
// 7.6 (Task 2.8, F-TPL-09 to F-TPL-21, F-TPL-38 and F-TPL-39). The dashboard, settings and mobile
// templates join this file with Tasks 2.9 and 2.10.

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
      expect((await style("primary")).roles).toBe("primary primary-foreground");
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
/** Every template built so far: the dashboard, settings and mobile join with Tasks 2.9 and 2.10. */
const EVERY_TEMPLATE = [
  "landing",
  "editorial",
  "kitchen-sink",
] as const satisfies readonly TemplateId[];

/**
 * Samples, on every frame for `ms` after the template `id` mounts, each element's opacity and
 * transform inside the frame: which elements other than the entrance changed, and the entrance's own
 * opacities and transforms. Start it before switching to the template.
 */
function mountMotion(page: Page, id: TemplateId, ms = 600) {
  return canvasFrame(page).evaluate(
    (frame, { id, ms }) =>
      new Promise<{ entrances: number; moved: string[]; entrance: string[] }>((resolve) => {
        const seen = new Map<Element, Set<string>>();
        let start: number | null = null;
        const tick = () => {
          const root = frame.querySelector(`[data-template-root="${id}"]`);
          if (root !== null) {
            start ??= performance.now();
            for (const element of [root, ...root.querySelectorAll("*")]) {
              const style = getComputedStyle(element);
              const values = seen.get(element) ?? new Set<string>();
              values.add(`${style.opacity} ${style.transform}`);
              seen.set(element, values);
            }
          }
          if (start === null || performance.now() - start < ms) {
            requestAnimationFrame(tick);
            return;
          }
          const entrances = frame.querySelectorAll("[data-entrance]");
          const entrance = entrances[0];
          const moved = [...seen]
            .filter(([element, values]) => element !== entrance && values.size > 1)
            .map(
              ([element]) => `${element.tagName.toLowerCase()}.${[...element.classList].join(".")}`,
            );
          resolve({
            entrances: entrances.length,
            moved,
            entrance: entrance === undefined ? [] : [...(seen.get(entrance) ?? [])],
          });
        };
        tick();
      }),
    { id, ms },
  );
}

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

  test.fixme("F-TPL-13 the dashboard's KPI row holds no three equal icon cards (Task 2.9)", async () => {
    // Task 2.9 builds the dashboard: run `equalIconSiblings` on its KPI row here.
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
    const metrics = await hero.evaluate((element) => {
      const probe = document.createElement("span");
      probe.style.fontSize = "var(--text-h2)";
      element.append(probe);
      const h2 = Number.parseFloat(getComputedStyle(probe).fontSize);
      probe.remove();
      const figure = /^[$€£¥]?\s*[+−-]?\d[\d,.:\s]*(%|\s?[A-Za-z]{1,3})?$/;
      return [element, ...element.querySelectorAll("*")]
        .filter((node) => {
          const own = [...node.childNodes]
            .filter((child) => child.nodeType === Node.TEXT_NODE)
            .map((child) => child.textContent ?? "")
            .join("")
            .trim();
          return (
            figure.test(own) && Number.parseFloat(getComputedStyle(node).fontSize) >= h2 - 0.01
          );
        })
        .map((node) => node.textContent ?? "");
    });
    expect(metrics).toEqual([]);
  });

  test("F-TPL-17 each template has one entrance, nothing else animates on mount, and reduced motion places it at once", async () => {
    for (const id of SECTION_76) {
      // A stand-in first, so the template mounts afresh.
      await showTemplate(page, "dashboard");
      const sampled = mountMotion(page, id);
      await showTemplate(page, id);
      const report = await sampled;
      expect(report.entrances, id).toBe(1);
      expect(report.moved, id).toEqual([]);
      // The entrance itself runs: it passes through more than one state.
      expect(report.entrance.length, id).toBeGreaterThan(1);
    }
    const reduce = page.getByRole("switch", { name: "Reduce motion", exact: true });
    await reduce.click();
    await expect(canvasFrame(page)).toHaveAttribute("data-reduced-motion", "true");
    for (const id of SECTION_76) {
      await showTemplate(page, "dashboard");
      const sampled = mountMotion(page, id);
      await showTemplate(page, id);
      const report = await sampled;
      expect(report.entrances, id).toBe(1);
      expect(report.moved, id).toEqual([]);
      expect(report.entrance, id).toEqual(["1 none"]);
    }
    await reduce.click();
    await expect(canvasFrame(page)).toHaveAttribute("data-reduced-motion", "false");
  });

  test("F-TPL-18 one h1 on the landing page, headings without gaps, and the article's H1 to H4 in order", async () => {
    for (const id of SECTION_76) {
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
        expect(levels.length).toBeGreaterThan(6);
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
    for (const id of SECTION_76) {
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
    // Tab reaches the next question, and Enter closes the first, open by default.
    const first = triggers.first();
    await expect(first).toHaveAttribute("aria-expanded", "true");
    await first.focus();
    await page.keyboard.press("Enter");
    await expect(first).toHaveAttribute("aria-expanded", "false");
    await page.keyboard.press("Enter");
    await expect(first).toHaveAttribute("aria-expanded", "true");
  });

  test("F-TPL-38 every text in the landing and editorial templates sets one step's whole type triple", async () => {
    const check = async (label: string) => {
      for (const frame of [1280, 360] as const) {
        await setFrame(page, frame);
        for (const id of SECTION_76) {
          const report = await typeTriples(await showTemplate(page, id));
          expect(report.checked, `${label} ${frame} ${id}`).toBeGreaterThan(25);
          expect(report.classes, `${label} ${frame} ${id} classes`).toEqual([]);
          expect(report.off, `${label} ${frame} ${id}`).toEqual([]);
        }
      }
    };
    await check("default");
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

  test("F-TPL-39 every painted color in the landing and editorial templates is named in data-roles", async () => {
    const dark = page.getByRole("switch", { name: "Dark mode", exact: true });
    for (const mode of MODES) {
      if (mode === "dark") await dark.click();
      await expect(canvasFrame(page)).toHaveAttribute("data-mode", mode);
      for (const id of SECTION_76) {
        const report = await unnamedPaint(await showTemplate(page, id));
        expect(report.checked, `${mode} ${id}`).toBeGreaterThan(60);
        expect(report.unnamed, `${mode} ${id}`).toEqual([]);
      }
    }
    await dark.click();
    await expect(canvasFrame(page)).toHaveAttribute("data-mode", "light");
  });

  test("F-TPL-12 axe finds no violation in either template, in light and dark, at 360 and 1280", async () => {
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
        }
      }
    }
    await dark.click();
    await setFrame(page, 1280);
    await expect(templateRoot(page, "landing").or(templateRoot(page, "editorial"))).toBeVisible();
  });
});
