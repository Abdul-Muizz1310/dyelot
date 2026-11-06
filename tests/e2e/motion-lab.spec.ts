import { readFileSync } from "node:fs";
import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  MOTION_DURATION_NAMES,
  MOTION_EASING_NAMES,
  MOTION_PRESETS,
  MOTION_SPRING_NAMES,
  withMotion,
} from "@/engine";
import { lotTag } from "@/features/studio/lot";
import { motionLine, pageHref } from "@/features/studio/pages";
import { decodeSpec, encodeSpec, specId } from "@/spec";
import { SITE } from "../../src/lib/site/config";
import { CUSTOM_TOKENS } from "../unit/support/motion";
import { LINK as linkOf, SPEC } from "./export-support";
import { ABORT_CHUNK } from "./flavor-support";
import { inputsPanel, openStudio } from "./studio-support";

// Playwright does not read the `?raw` query some engine files import: the hook makes it the text.
await import("./raw-hooks.mjs");
const { defaultDesign } = await import("@/features/landing/heroes");
const { motionFiles } = await import("@/export");
const { editTokens, fieldText } = await import("@/features/motion/lab");

// F-LAB-01 to 10 and F-LAB-RF2 of docs/specs/05-motion-3d.md (R5-41 to R5-44, 9.1 to 9.6) and
// F-STUD5-01 and 02 (R5-45, 13.6).

test.use({ viewport: { width: 1280, height: 900 } });

const DEFAULT = defaultDesign();
const filesOf = (spec: typeof DEFAULT) =>
  motionFiles(spec, spec.meta.name, lotTag(specId(spec)), SITE.url);
const LOAD_FAILED = "This tool could not load. Reload the page to try again.";

const lab = (page: Page): Locator => page.locator("[data-lab]");
const field = (page: Page, name: string): Locator =>
  page.getByRole("textbox", { name, exact: true });
const preview = (page: Page, id: string): Locator => page.locator(`[data-preview="${id}"]`);
const reducedSwitch = (page: Page): Locator =>
  page.getByRole("switch", { name: "Reduced motion", exact: true });
const copyOf = (page: Page, path: string): Locator =>
  page.getByRole("button", { name: `Copy ${path}`, exact: true });
const downloadOf = (page: Page, path: string): Locator =>
  page.getByRole("button", { name: `Download ${path}`, exact: true });
const shownFile = (page: Page, path: string): Locator => page.locator(`[data-file="${path}"] pre`);
const notice = (page: Page): Locator => page.locator("[data-lab-notice]");
const filesStatus = (page: Page): Locator => page.locator("[data-lab-files-status]");
const hashOf = (page: Page): Promise<string> => page.evaluate(() => location.hash);

async function openLab(page: Page, hash = ""): Promise<void> {
  const response = await page.goto(`/motion${hash}`);
  expect(response?.status()).toBe(200);
  await expect(lab(page)).toBeAttached();
}

/** The spec the page's hash holds, polled until it exists. */
async function hashSpec(page: Page) {
  await expect.poll(async () => (await hashOf(page)).startsWith("#s=")).toBe(true);
  return decodeSpec((await hashOf(page)).slice(3));
}

const durationPath = (name: (typeof MOTION_DURATION_NAMES)[number]) =>
  ({ kind: "duration", name }) as const;

test.describe("the motion lab", () => {
  test("F-LAB-01 the default design's tokens, preset, line and files, with the page's metadata", async ({
    page,
  }) => {
    await openLab(page);
    await expect(page).toHaveTitle("Motion lab — dyelot");
    await expect(page.locator('head meta[name="description"]')).toHaveAttribute(
      "content",
      "Edit a design's motion: durations, easing curves and springs, with live previews and files for CSS, Motion and GSAP.",
    );
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
      "href",
      `${SITE.url}/motion`,
    );
    await expect(page.getByRole("heading", { level: 1, name: "The motion lab" })).toBeVisible();
    const tokens = DEFAULT.motion;
    for (const name of MOTION_DURATION_NAMES) {
      await expect(field(page, `${name} (ms)`)).toHaveValue(fieldText(tokens, durationPath(name)));
    }
    for (const name of MOTION_EASING_NAMES) {
      for (const [index, part] of ["x1", "y1", "x2", "y2"].entries()) {
        await expect(field(page, `${name} ${part}`)).toHaveValue(
          fieldText(tokens, { kind: "easing", name, index: index as 0 | 1 | 2 | 3 }),
        );
      }
    }
    for (const name of MOTION_SPRING_NAMES) {
      await expect(field(page, `${name} duration (s)`)).toHaveValue(
        fieldText(tokens, { kind: "spring", name, field: "visualDuration" }),
      );
      await expect(field(page, `${name} bounce`)).toHaveValue(
        fieldText(tokens, { kind: "spring", name, field: "bounce" }),
      );
    }
    await expect(page.getByRole("button", { name: "dyelot", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(lab(page)).toHaveAttribute("data-preset", "dyelot");
    await expect(page.locator("[data-preset-line]")).toHaveText(
      "These tokens match the dyelot preset. dyelot's default: 50 to 500 ms, standard curves and three springs.",
    );
    const list = page.getByRole("list", { name: "Files", exact: true });
    for (const path of ["motion/motion.css", "motion/motion.ts", "motion/gsap.ts"]) {
      await expect(list.getByText(path, { exact: true })).toBeVisible();
      await expect(copyOf(page, path)).not.toHaveAttribute("aria-disabled", "true");
      await expect(downloadOf(page, path)).not.toHaveAttribute("aria-disabled", "true");
    }
    await expect(lab(page)).toHaveAttribute("data-lab-reduced", "false");
  });

  test("F-LAB-02 a preset sets every field, the hash follows, and the studio shows the preset", async ({
    page,
  }) => {
    await openLab(page);
    await page.getByRole("button", { name: "Gentle", exact: true }).click();
    const gentle = MOTION_PRESETS.gentle.tokens;
    for (const name of MOTION_DURATION_NAMES) {
      await expect(field(page, `${name} (ms)`)).toHaveValue(fieldText(gentle, durationPath(name)));
    }
    await expect(lab(page)).toHaveAttribute("data-preset", "gentle");
    await expect(page.getByRole("button", { name: "Gentle", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const expected = withMotion(DEFAULT, gentle);
    expect(await hashSpec(page)).toEqual(expected);
    await page.getByRole("link", { name: "Open in the studio", exact: true }).click();
    await expect(page).toHaveURL(/\/studio#s=/);
    await expect(inputsPanel(page).getByText("Motion tokens: Gentle preset.")).toBeVisible();
  });

  test("F-LAB-03 an edited duration makes the tokens custom and reaches the ladder and motion.css", async ({
    page,
  }) => {
    await openLab(page);
    await field(page, "base (ms)").fill("160");
    await field(page, "base (ms)").blur();
    await expect(lab(page)).toHaveAttribute("data-preset", "custom");
    await expect(page.locator("[data-preset-line]")).toHaveText(
      "Custom tokens: no preset matches.",
    );
    await expect(page.getByText("base 160 ms", { exact: true })).toBeVisible();
    await expect(shownFile(page, "motion/motion.css")).toContainText("--duration-base: 160ms;");
    expect((await hashSpec(page)).motion.durations.base).toBe(160);
  });

  test("F-LAB-04 an invalid entry is marked, keeps the design and is restored on blur", async ({
    page,
  }) => {
    // The fake clock holds the 300 ms hash write until the flow runs it, so no real time passes.
    await page.clock.install();
    await openLab(page);
    await field(page, "base (ms)").fill("160");
    await page.clock.runFor(400);
    await hashSpec(page);
    const hash = await hashOf(page);
    const css = await shownFile(page, "motion/motion.css").textContent();
    const base = field(page, "base (ms)");
    for (const bad of ["abc", "600"]) {
      await base.fill(bad);
      await expect(base).toHaveAttribute("aria-invalid", "true");
      await expect(page.getByText("Enter a number of milliseconds from 0 to 500.")).toBeVisible();
      await page.clock.runFor(400);
      expect(await hashOf(page)).toBe(hash);
      expect(await shownFile(page, "motion/motion.css").textContent()).toBe(css);
      await base.blur();
      await expect(base).toHaveValue("160");
      await expect(base).not.toHaveAttribute("aria-invalid", "true");
    }
    await field(page, "standard x1").fill("1.5");
    await expect(field(page, "standard x1")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("Enter a number from 0 to 1.")).toBeVisible();
  });

  test.describe("copy and download", () => {
    test.use({ permissions: ["clipboard-read", "clipboard-write"] });

    test("F-LAB-05 Copy writes the file's text and says Copied; Download saves the file", async ({
      page,
    }) => {
      await openLab(page);
      const files = filesOf(DEFAULT);
      const copy = copyOf(page, "motion/motion.css");
      await copy.click();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(files[0]?.text);
      await expect(copy).toHaveText("Copied");
      const [event] = await Promise.all([
        page.waitForEvent("download"),
        downloadOf(page, "motion/gsap.ts").click(),
      ]);
      expect(event.suggestedFilename()).toBe("gsap.ts");
      expect(readFileSync(await event.path(), "utf8")).toBe(
        files.find((file) => file.path === "motion/gsap.ts")?.text,
      );
    });
  });

  test("F-LAB-06 a blocked copy opens the disclosure, selects the text and says so", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const refuse = () => Promise.reject(new DOMException("denied", "NotAllowedError"));
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: refuse, readText: refuse },
        configurable: true,
      });
    });
    await openLab(page);
    await copyOf(page, "motion/motion.css").click();
    await expect(page.locator('[data-file="motion/motion.css"] details')).toHaveAttribute(
      "open",
      "",
    );
    await expect(filesStatus(page)).toHaveText(
      "Copy is blocked here. The text is selected: press Ctrl+C or ⌘C.",
    );
    const selected = await page.evaluate(() => window.getSelection()?.toString() ?? "");
    expect(selected.trim()).toBe(filesOf(DEFAULT)[0]?.text.trim());
  });

  test("F-LAB-07 Reduced motion swaps every spring for a linear transition", async ({ page }) => {
    await openLab(page);
    const reduced = reducedSwitch(page);
    await expect(reduced).toHaveAttribute("aria-checked", "false");
    await expect(preview(page, "toast")).toHaveAttribute("data-transition", "spring:smooth");
    await reduced.click();
    await expect(lab(page)).toHaveAttribute("data-lab-reduced", "true");
    for (const id of ["toast", "switch", "tabs"]) {
      await expect(preview(page, id)).toHaveAttribute("data-transition", "linear:100");
    }
    await expect(preview(page, "dialog")).toHaveAttribute(
      "data-transition",
      "tween:300:decelerate",
    );
    await reduced.click();
    await expect(lab(page)).toHaveAttribute("data-lab-reduced", "false");
    await expect(preview(page, "toast")).toHaveAttribute("data-transition", "spring:smooth");
    await expect(preview(page, "switch")).toHaveAttribute("data-transition", "spring:snappy");
    await expect(preview(page, "tabs")).toHaveAttribute("data-transition", "spring:bouncy");
  });

  test("F-LAB-08 the OS reduced motion starts the switch on", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openLab(page);
    await expect(reducedSwitch(page)).toHaveAttribute("aria-checked", "true");
    await expect(lab(page)).toHaveAttribute("data-lab-reduced", "true");
  });

  test("F-LAB-09 a damaged link falls back to the default, or keeps the current design", async ({
    page,
  }) => {
    await openLab(page, "#s=garbage");
    await expect(notice(page)).toHaveText(
      "This link is damaged or cut short, so the studio cannot open it. The lab shows the default design instead.",
    );
    await expect(field(page, "base (ms)")).toHaveValue(
      fieldText(DEFAULT.motion, durationPath("base")),
    );
    const gentle = withMotion(DEFAULT, MOTION_PRESETS.gentle.tokens);
    await page.evaluate(
      (hash) => {
        location.hash = hash;
      },
      `#s=${encodeSpec(gentle)}`,
    );
    await expect(lab(page)).toHaveAttribute("data-preset", "gentle");
    await expect(notice(page)).toHaveText("");
    await page.evaluate(() => {
      location.hash = "#s=garbage";
    });
    await expect(notice(page)).toHaveText(
      "This link is damaged or cut short, so the studio cannot open it. The lab keeps the current design.",
    );
    await expect(lab(page)).toHaveAttribute("data-preset", "gentle");
    await expect(field(page, "base (ms)")).toHaveValue(
      fieldText(MOTION_PRESETS.gentle.tokens, durationPath("base")),
    );
  });

  test("F-LAB-10 with the export chunk aborted the files stay disabled and editing still works", async ({
    page,
  }) => {
    const marker = "dyelot.check/1";
    const errors: { text: string; source: string }[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        errors.push({ text: message.text(), source: message.location().url });
      }
    });
    page.on("pageerror", (error) => errors.push({ text: error.message, source: "page" }));
    const aborted: string[] = [];
    page.on("requestfailed", (request) => {
      if (request.failure()?.errorText === "net::ERR_FAILED") aborted.push(request.url());
    });
    await ABORT_CHUNK(page, marker);
    await openLab(page);
    await expect(filesStatus(page)).toHaveText(LOAD_FAILED);
    for (const path of ["motion/motion.css", "motion/motion.ts", "motion/gsap.ts"]) {
      await expect(copyOf(page, path)).toHaveAttribute("aria-disabled", "true");
      await expect(downloadOf(page, path)).toHaveAttribute("aria-disabled", "true");
    }
    await field(page, "base (ms)").fill("160");
    await expect(lab(page)).toHaveAttribute("data-preset", "custom");
    // 14.11's ABORT_CHUNK rule (recorded at Task 5.6b's review): the chunk that holds the marker
    // failed twice, its request and Turbopack's one retry, each with the browser's line, and nothing
    // else logged an error.
    await expect.poll(() => aborted.length).toBe(2);
    const [chunk = ""] = aborted;
    expect(aborted).toEqual([chunk, chunk]);
    expect(await (await page.request.get(chunk)).text()).toContain(marker);
    const failedLoad = { text: "Failed to load resource: net::ERR_FAILED", source: chunk };
    await expect.poll(() => errors).toEqual([failedLoad, failedLoad]);
  });

  test("F-LAB-RF2 a duration above the cap shows as stored and exports capped", async ({
    page,
  }) => {
    const tokens = editTokens(DEFAULT.motion, durationPath("slowest"), 900);
    const spec = withMotion(DEFAULT, tokens);
    await openLab(page, `#s=${encodeSpec(spec)}`);
    await expect(field(page, "slowest (ms)")).toHaveValue("900");
    await expect(
      page.getByText("slowest 900 ms, exported as 500 ms", { exact: true }),
    ).toBeVisible();
    await field(page, "base (ms)").fill("160");
    await expect
      .poll(async () => decodeSpec((await hashOf(page)).slice(3)).motion.durations)
      .toMatchObject({ slowest: 900, base: 160 });
  });
});

test.describe("the studio's motion line", () => {
  test("F-STUD5-01 the inputs panel names the preset and links to the lab", async ({ page }) => {
    await openStudio(page, linkOf(SPEC));
    const link = inputsPanel(page).getByRole("link", {
      name: "Edit in the motion lab",
      exact: true,
    });
    await expect(inputsPanel(page).getByText(motionLine(SPEC), { exact: true })).toBeVisible();
    expect(motionLine(SPEC)).toBe("Motion tokens: dyelot preset.");
    await expect(link).toHaveAttribute("href", pageHref("motion", SPEC));
    const checked = inputsPanel(page)
      .getByRole("group", { name: "Motion feel", exact: true })
      .getByRole("radio", { checked: true });
    await checked.focus();
    await page.keyboard.press("Tab");
    await expect(link).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Warmer", exact: true })).toBeFocused();
  });

  test("F-STUD5-02 custom tokens show as custom and survive a regenerate and a reload", async ({
    page,
  }) => {
    const custom = withMotion(SPEC, CUSTOM_TOKENS);
    await openStudio(page, linkOf(custom));
    await expect(
      inputsPanel(page).getByText("Motion tokens: custom.", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Regenerate", exact: true }).click();
    // The hash holds the regenerated design once its seed differs from the link's.
    await expect
      .poll(async () => {
        const next = decodeSpec((await hashOf(page)).slice(3));
        if (next.meta.seed === custom.meta.seed) return null;
        return {
          durations: next.motion.durations,
          easings: next.motion.easings,
          springs: next.motion.springs,
        };
      })
      .toEqual(CUSTOM_TOKENS);
    await page.goto("/studio");
    await expect(
      inputsPanel(page).getByText("Motion tokens: custom.", { exact: true }),
    ).toBeVisible();
  });
});
