import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { hexToRgb, ROLE_NAMES, wcagRatio } from "@/engine";
import { BUTTON_VARIANTS, KIT_COMPONENTS } from "@/features/preview/kit/states";
import { TEXT_PAIRS } from "@/features/preview/swatches";
import { themeVars } from "@/theme/vars";
import {
  canvasFrame,
  canvasPane,
  designFor,
  FRESH,
  openStudio,
  seedOf,
  stubSeeds,
} from "./studio-support";

// The kitchen-sink flows of docs/specs/02-studio.md, section 7.5 (Task 2.7): F-TPL-01 to F-TPL-08,
// and axe on /studio with the kitchen sink in both modes. The later templates join this file with
// Tasks 2.8 to 2.10.

const MODES = ["light", "dark"] as const;
const TYPE_STEPS = [
  "caption",
  "label",
  "body-sm",
  "body",
  "lead",
  "h4",
  "h3",
  "h2",
  "h1",
  "display",
];
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
      for (const row of shadows) expect(row["box-shadow"], row.token).not.toBe("none");

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
    }
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
