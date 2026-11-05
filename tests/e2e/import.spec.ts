import { readFileSync } from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { lintSpec } from "@/engine";
import { blockReason } from "@/features/export/files";
import { decodeSpec, encodeSpec, specId } from "@/spec";
import {
  bundleOf,
  exportButton,
  exportDialog,
  GOLDEN,
  IMPORTED,
  SPEC_LINK,
} from "./export-support";
import {
  button,
  canvasRegion,
  canvasVars,
  expectedVars,
  inputsPanel,
  lotId,
  modeSwitch,
  openStudio,
  settled,
} from "./studio-support";

// Playwright does not read the `?raw` query of the checker's source: `export-support` loads the hook
// before this file asks `@/import` for what the page must show.
const { importDesignMd, importShadcnCss } = await import("@/import");

// The import flows of docs/specs/03-export.md, section 10.12 (Task 3.16): F-IMP-01 to 12, F-IMP-RF4,
// the import parts of F-A11Y3-01 to 03 and F-A11Y3-05, on the dialog of section 9.3 (R3-33, R3-34).

test.use({ viewport: { width: 1280, height: 800 } });

const PHONE = { width: 360, height: 740 };
const FIXTURES = path.join(import.meta.dirname, "../fixtures/import");
const readFixture = (name: string): string => readFileSync(path.join(FIXTURES, name), "utf8");
const SHADCN = readFixture("shadcn-neutral.css");
const README_MD = readFixture("design-md-readme.md");
const EMPTY_MESSAGE = "The import is empty. Paste a DESIGN.md or a shadcn theme, or choose a file.";
const TOO_LARGE =
  "That is larger than 256 KB. Import a DESIGN.md or a theme stylesheet of at most 256 KB.";

const importButton = (page: Page): Locator =>
  inputsPanel(page).getByRole("button", { name: "Import…", exact: true });
const dialog = (page: Page): Locator => page.getByRole("dialog", { name: "Import", exact: true });
const textarea = (page: Page): Locator =>
  dialog(page).getByLabel("Paste the text", { exact: true });
const fileInput = (page: Page): Locator =>
  dialog(page).getByLabel("Choose a file", { exact: true });
const formatGroup = (page: Page): Locator =>
  dialog(page).getByRole("group", { name: "Format", exact: true });
const formatRadio = (page: Page, name: string): Locator =>
  formatGroup(page).getByRole("radio", { name, exact: true });
const doImport = (page: Page): Locator =>
  dialog(page).getByRole("button", { name: "Import", exact: true });
const cancel = (page: Page): Locator =>
  dialog(page).getByRole("button", { name: "Cancel", exact: true });
const errorRegion = (page: Page): Locator => dialog(page).getByRole("alert");
/** The studio's notice, in the header. */
const notice = (page: Page): Locator => page.locator("header").getByRole("status");
const inspector = (page: Page) => page.locator("aside#studio-inspector");

/** Opens the dialog from "Import…" and waits until its form shows. */
async function openDialog(page: Page): Promise<void> {
  await importButton(page).click();
  await expect(textarea(page)).toBeVisible();
}

/** Pastes `text` into the textarea. */
const paste = (page: Page, text: string): Promise<void> => textarea(page).fill(text);

/** What the notice must read for an import, from the report (section 9.3). */
function noticeText(result: ReturnType<typeof importShadcnCss>): string {
  if (!result.ok) throw new Error("noticeText: the import failed");
  const { report } = result;
  if (report.exact)
    return "Imported the DESIGN.md exactly, from its edit link. Undo returns to the design before.";
  const count = (mode: "light" | "dark") =>
    report.mapped.filter((entry) => entry.mode === mode).length;
  const name = report.format === "design-md" ? "DESIGN.md" : "shadcn theme";
  const parts = [
    `Imported a ${name}: ${count("light")} of 46 light roles and ${count("dark")} of 46 dark roles came from the file.`,
  ];
  if (report.adjusted.length > 0) {
    parts.push(`${report.adjusted.length} colors were adjusted to fit sRGB or drop alpha.`);
  }
  if (report.inferred.customFonts) {
    parts.push("Its fonts are not in dyelot's catalog, so the canvas shows a fallback.");
  }
  parts.push("Undo returns to the design before.");
  return parts.join(" ");
}

const hashOf = (page: Page): Promise<string> => page.evaluate(() => window.location.hash);

/** The spec the hash holds, once the debounced write (300 ms) has happened and differs from `before`. */
async function hashedSpec(page: Page) {
  await expect.poll(() => hashOf(page)).toMatch(/^#s=/);
  return decodeSpec((await hashOf(page)).slice(3));
}

/** The name of the focused element: its label, aria-label or text. */
const focusedName = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return "";
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
      return active.labels?.[0]?.textContent?.trim() ?? "";
    }
    return active.getAttribute("aria-label") ?? active.textContent?.trim() ?? "";
  });

test.describe("the import dialog", () => {
  test("F-IMP-01 Import… opens a modal dialog with focus on its heading and the Tab order of 9.3", async ({
    page,
  }) => {
    await openStudio(page, SPEC_LINK);
    await importButton(page).click();
    const modal = dialog(page);
    await expect(modal).toHaveAttribute("aria-modal", "true");
    await expect(modal.getByRole("heading", { name: "Import", exact: true })).toBeFocused();
    // Everything outside the dialog is inert: a focus call leaves focus in the dialog.
    await button(page, "Regenerate").evaluate((element) => element.focus());
    await expect(modal.getByRole("heading", { name: "Import", exact: true })).toBeFocused();
    await expect(formatGroup(page).getByRole("radio")).toHaveCount(2);
    await expect(formatRadio(page, "DESIGN.md")).toBeVisible();
    await expect(formatRadio(page, "shadcn theme CSS")).toBeVisible();
    const seen: string[] = [];
    for (let step = 0; step < 5; step++) {
      await page.keyboard.press("Tab");
      seen.push(await focusedName(page));
    }
    expect(seen).toEqual(["DESIGN.md", "Choose a file", "Paste the text", "Import", "Cancel"]);
    // A first radio holds the group's one Tab stop while none is checked.
    expect(await formatGroup(page).locator("input:checked").count()).toBe(0);
  });

  test("F-IMP-02 the format follows the pasted text until the visitor picks one", async ({
    page,
  }) => {
    await openStudio(page, SPEC_LINK);
    await openDialog(page);
    await paste(page, SHADCN);
    await expect(formatRadio(page, "shadcn theme CSS")).toBeChecked();
    await paste(page, README_MD);
    await expect(formatRadio(page, "DESIGN.md")).toBeChecked();
    await formatRadio(page, "shadcn theme CSS").check();
    await paste(page, README_MD);
    await expect(formatRadio(page, "shadcn theme CSS")).toBeChecked();
    await paste(page, SHADCN);
    await expect(formatRadio(page, "shadcn theme CSS")).toBeChecked();
    await expect(formatRadio(page, "DESIGN.md")).not.toBeChecked();
  });

  test("F-IMP-03 importing a shadcn theme closes the dialog and shows the notice, the link and the canvas", async ({
    page,
  }) => {
    await openStudio(page, SPEC_LINK);
    const before = await lotId(page).textContent();
    await openDialog(page);
    await paste(page, SHADCN);
    await doImport(page).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(notice(page)).toContainText(noticeText(importShadcnCss(SHADCN)));
    const text = (await notice(page).textContent()) ?? "";
    expect(text).toMatch(
      /^Imported a shadcn theme: \d+ of 46 light roles and \d+ of 46 dark roles came from the file\./,
    );
    await expect.poll(() => hashOf(page)).toBe(`#s=${encodeSpec(IMPORTED)}`);
    expect((await canvasVars(page))["--primary"]).toBe(
      expectedVars(IMPORTED, "light")["--primary"],
    );
    await expect(lotId(page)).not.toHaveText(before ?? "");
    await expect(canvasRegion(page)).toBeFocused();
  });

  test("F-IMP-04 Undo restores the design before and removes the notice; Redo brings both back", async ({
    page,
  }) => {
    await openStudio(page, SPEC_LINK);
    const before = await lotId(page).textContent();
    await openDialog(page);
    await paste(page, SHADCN);
    await doImport(page).click();
    const words = noticeText(importShadcnCss(SHADCN));
    await expect(notice(page)).toContainText(words);
    const imported = await lotId(page).textContent();
    await button(page, "Undo").click();
    await expect(lotId(page)).toHaveText(before ?? "");
    await expect(notice(page)).toHaveCount(0);
    await button(page, "Redo").click();
    await expect(lotId(page)).toHaveText(imported ?? "");
    await expect(notice(page)).toContainText(words);
  });

  test("F-IMP-05 a chosen file fills the textarea and checks DESIGN.md; Import holds its design", async ({
    page,
  }) => {
    await openStudio(page, SPEC_LINK);
    await openDialog(page);
    await fileInput(page).setInputFiles(path.join(FIXTURES, "design-md-readme.md"));
    await expect(textarea(page)).toHaveValue(README_MD);
    await expect(formatRadio(page, "DESIGN.md")).toBeChecked();
    await doImport(page).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(notice(page)).toContainText("Imported a DESIGN.md:");
    const expected = importDesignMd(README_MD);
    if (!expected.ok) throw new Error("the DESIGN.md fixture did not import");
    expect(specId(await hashedSpec(page))).toBe(specId(expected.spec));
  });

  test("F-IMP-06 the DESIGN.md of a golden bundle imports exactly, from its edit link", async ({
    page,
  }) => {
    const file = bundleOf(GOLDEN).files.find((each) => each.path === "DESIGN.md");
    if (file === undefined) throw new Error("the golden bundle has no DESIGN.md");
    await openStudio(page, SPEC_LINK);
    await openDialog(page);
    await paste(page, file.text);
    await doImport(page).click();
    await expect(notice(page)).toContainText(
      "Imported the DESIGN.md exactly, from its edit link. Undo returns to the design before.",
    );
    expect(specId(await hashedSpec(page))).toBe(specId(GOLDEN));
  });

  test("F-IMP-07 an empty import shows its message in the error region, with focus on the textarea", async ({
    page,
  }) => {
    await openStudio(page, SPEC_LINK);
    const before = await lotId(page).textContent();
    await openDialog(page);
    await doImport(page).click();
    await expect(errorRegion(page)).toHaveText(EMPTY_MESSAGE);
    await expect(textarea(page)).toHaveAccessibleDescription(EMPTY_MESSAGE);
    await expect(textarea(page)).toBeFocused();
    await expect(dialog(page)).toBeVisible();
    await expect(lotId(page)).toHaveText(before ?? "");
  });

  test("F-IMP-08 a refused file is never read and the textarea keeps its text", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const reads = { count: 0 };
      (window as unknown as { __reads: typeof reads }).__reads = reads;
      for (const name of [
        "readAsText",
        "readAsArrayBuffer",
        "readAsDataURL",
        "readAsBinaryString",
      ] as const) {
        const original = FileReader.prototype[name];
        FileReader.prototype[name] = function patched(this: FileReader, blob: Blob) {
          reads.count++;
          return original.call(this, blob);
        };
      }
      for (const name of ["text", "arrayBuffer", "stream", "slice"] as const) {
        const original = Blob.prototype[name] as (...args: unknown[]) => unknown;
        (Blob.prototype as unknown as Record<string, unknown>)[name] = function patched(
          this: Blob,
          ...args: unknown[]
        ) {
          reads.count++;
          return original.apply(this, args);
        };
      }
    });
    await openStudio(page, SPEC_LINK);
    await openDialog(page);
    await paste(page, "keep me");
    await fileInput(page).focus();
    await fileInput(page).setInputFiles({
      name: "a.json",
      mimeType: "application/json",
      buffer: Buffer.from("{}"),
    });
    await expect(errorRegion(page)).toHaveText("Choose a .md or a .css file.");
    await expect(textarea(page)).toHaveValue("keep me");
    await expect(textarea(page)).toBeFocused();
    await fileInput(page).focus();
    await fileInput(page).setInputFiles({
      name: "big.css",
      mimeType: "text/css",
      buffer: Buffer.alloc(262_145, "a"),
    });
    await expect(errorRegion(page)).toHaveText(TOO_LARGE);
    await expect(textarea(page)).toHaveValue("keep me");
    await expect(textarea(page)).toBeFocused();
    expect(
      await page.evaluate(
        () => (window as unknown as { __reads: { count: number } }).__reads.count,
      ),
    ).toBe(0);
  });

  test("F-IMP-09 a YAML fault names its line", async ({ page }) => {
    await openStudio(page, SPEC_LINK);
    await openDialog(page);
    await paste(page, '---\nname: X\ncolors:\n\tprimary: "#112233"\n---\n');
    await doImport(page).click();
    await expect(errorRegion(page)).toHaveText(
      "The YAML on line 4 could not be read. Check its indentation and quotes, then import again.",
    );
    await expect(textarea(page)).toBeFocused();
    await paste(
      page,
      '---\nname: X\ncolors:\n  primary: "#112233"\n  base: "#445566"\n  other: &a "#778899"\n---\n',
    );
    await doImport(page).click();
    await expect(errorRegion(page)).toHaveText(
      "The YAML uses an anchor or an alias on line 6. Write the values out in full, then import again.",
    );
    await expect(textarea(page)).toBeFocused();
    await expect(dialog(page)).toBeVisible();
  });

  test("F-IMP-10 text with no format asks for one; a picked format shows the importer's message", async ({
    page,
  }) => {
    await openStudio(page, SPEC_LINK);
    await openDialog(page);
    await paste(page, "hello");
    await doImport(page).click();
    await expect(errorRegion(page)).toHaveText("Choose DESIGN.md or shadcn theme CSS.");
    await expect(textarea(page)).toBeFocused();
    await formatRadio(page, "shadcn theme CSS").check();
    await doImport(page).click();
    const result = importShadcnCss("hello");
    if (result.ok) throw new Error("hello must not import");
    expect(result.error.code).toBe("no-roles");
    await expect(errorRegion(page)).toHaveText(result.error.message);
    await expect(textarea(page)).toBeFocused();
  });

  test("F-IMP-11 an imported theme that fails a check offers the rebuild and blocks export; Cancel and Escape return focus", async ({
    page,
  }) => {
    await openStudio(page, SPEC_LINK);
    await openDialog(page);
    await paste(page, SHADCN);
    await doImport(page).click();
    const errors = lintSpec(IMPORTED).filter((finding) => finding.severity === "error").length;
    expect(errors).toBeGreaterThan(0);
    await expect(
      inspector(page).getByRole("region", { name: "Receipt", exact: true }),
    ).toContainText(blockReason("fixable", errors));
    await expect(
      inspector(page).getByRole("button", { name: "Rebuild from the parameters", exact: true }),
    ).toBeVisible();
    await exportButton(page).click();
    await expect(exportDialog(page)).toContainText(blockReason("fixable", errors));
    await page.keyboard.press("Escape");
    await expect(exportDialog(page)).toHaveCount(0);

    await importButton(page).click();
    await expect(textarea(page)).toBeVisible();
    await cancel(page).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(importButton(page)).toBeFocused();
    await importButton(page).click();
    await expect(textarea(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);
    await expect(importButton(page)).toBeFocused();
  });

  test("F-IMP-12 when the import code does not load, Try again shows the form; the studio keeps working", async ({
    page,
  }) => {
    await openStudio(page, SPEC_LINK);
    await page.route("**/*.js*", (route) => route.abort());
    await importButton(page).click();
    await expect(dialog(page)).toContainText("The import code did not load.");
    await expect(textarea(page)).toHaveCount(0);
    await cancel(page).click();
    const before = await lotId(page).textContent();
    await button(page, "Regenerate").click();
    await expect(lotId(page)).not.toHaveText(before ?? "");
    await importButton(page).click();
    await expect(dialog(page)).toContainText("The import code did not load.");
    await page.unroute("**/*.js*");
    await dialog(page).getByRole("button", { name: "Try again", exact: true }).click();
    await expect(textarea(page)).toBeVisible();
    await expect(dialog(page)).not.toContainText("The import code did not load.");
    await cancel(page).click();
    const next = await lotId(page).textContent();
    await button(page, "Regenerate").click();
    await expect(lotId(page)).not.toHaveText(next ?? "");
  });
});

test.describe("the largest import (Review Focus 4)", () => {
  const LIMIT = 262_144;
  const cases: { name: string; text: () => string }[] = [
    {
      name: "a 256 KiB DESIGN.md",
      text: () => {
        // The readme's front matter (under the 64 KiB YAML limit), then prose up to the limit.
        const prose = "A line of prose that the importer reads and leaves alone.\n";
        let text = `${README_MD}\n`;
        text += prose.repeat(Math.floor((LIMIT - text.length) / prose.length));
        return text;
      },
    },
    {
      name: "a 256 KiB shadcn CSS",
      text: () => {
        const filler = "/* padding that a stylesheet carries and the importer skips over */\n";
        let text = `${SHADCN}\n`;
        text += filler.repeat(Math.floor((LIMIT - text.length) / filler.length));
        return text;
      },
    },
  ];
  for (const { name, text } of cases) {
    test(`F-IMP-RF4 ${name} imports within 2 s with no long task over 1 s`, async ({
      page,
      context,
    }) => {
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      const body = text();
      expect(Buffer.byteLength(body)).toBeLessThanOrEqual(LIMIT);
      expect(Buffer.byteLength(body)).toBeGreaterThan(LIMIT - 200);
      await page.addInitScript(() => {
        const tasks: number[] = [];
        (window as unknown as { __longTasks: number[] }).__longTasks = tasks;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) tasks.push(entry.duration);
        }).observe({ type: "longtask", buffered: true });
      });
      await openStudio(page, SPEC_LINK);
      await openDialog(page);
      // A real paste: Playwright's `fill` types 256 KiB through the editing commands, which takes
      // seconds in Chromium for any textarea and says nothing about the studio.
      await page.evaluate((text) => navigator.clipboard.writeText(text), body);
      await textarea(page).focus();
      await page.keyboard.press("ControlOrMeta+V");
      await expect
        .poll(() => textarea(page).evaluate((el: HTMLTextAreaElement) => el.value.length))
        .toBe(body.length);
      const started = Date.now();
      await doImport(page).click();
      await expect(notice(page)).toContainText("Imported", { timeout: 2000 });
      const elapsed = Date.now() - started;
      console.log(`F-IMP-RF4 ${name}: notice ${elapsed} ms after the click`);
      expect(elapsed).toBeLessThanOrEqual(2000);
      const tasks = await page.evaluate(
        () => (window as unknown as { __longTasks: number[] }).__longTasks,
      );
      console.log(`F-IMP-RF4 ${name}: long tasks ${JSON.stringify(tasks)}`);
      expect(tasks.filter((duration) => duration > 1000)).toEqual([]);
    });
  }
});

test.describe("accessibility of the import dialog", () => {
  for (const viewport of [{ width: 1280, height: 800 }, PHONE]) {
    for (const mode of ["light", "dark"] as const) {
      test(`F-A11Y3-01 axe finds no violation in the import dialog at ${viewport.width} px, canvas in ${mode}`, async ({
        page,
      }) => {
        await page.setViewportSize(viewport);
        await openStudio(page, SPEC_LINK);
        if (mode === "dark") {
          if (viewport.width < 640) await button(page, "View").click();
          await modeSwitch(page).click();
          await expect(modeSwitch(page)).toHaveAttribute("aria-checked", "true");
        }
        if (viewport.width < 1280) await button(page, "Inputs").click();
        await importButton(page).click();
        await expect(textarea(page)).toBeVisible();
        await page.waitForTimeout(300);
        const axe = () =>
          new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
            .analyze();
        expect((await axe()).violations).toEqual([]);
        await doImport(page).click();
        await expect(errorRegion(page)).toHaveText(EMPTY_MESSAGE);
        expect((await axe()).violations).toEqual([]);
      });
    }
  }

  test("F-A11Y3-02 Tab and Shift+Tab cycle through the dialog's controls, and a click behind keeps focus", async ({
    page,
  }) => {
    await openStudio(page, SPEC_LINK);
    await openDialog(page);
    await page
      .locator("#studio-inputs h2")
      .first()
      .evaluate(() => {});
    await dialog(page).getByRole("heading", { name: "Import", exact: true }).focus();
    await page.keyboard.press("Shift+Tab");
    await expect(cancel(page)).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(formatRadio(page, "DESIGN.md")).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(cancel(page)).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(formatRadio(page, "DESIGN.md")).toBeFocused();
    await page.mouse.click(3, 3);
    const inside = () =>
      page.evaluate(() =>
        document.querySelector("[role=dialog]")?.contains(document.activeElement),
      );
    expect(await inside()).toBe(true);
    await page.keyboard.press("Tab");
    expect(await inside()).toBe(true);
  });

  test("F-A11Y3-03 every control has a name and a 24 px target; the status region is role status", async ({
    page,
  }) => {
    await openStudio(page, SPEC_LINK);
    await openDialog(page);
    await expect(dialog(page).getByRole("status")).toHaveCount(1);
    const controls = dialog(page).locator("button, input, textarea");
    const count = await controls.count();
    expect(count).toBe(6);
    for (let index = 0; index < count; index++) {
      const info = await controls.nth(index).evaluate((element) => {
        const box = element.getBoundingClientRect();
        const labels = (element as HTMLInputElement).labels;
        return {
          name:
            element.getAttribute("aria-label") ??
            labels?.[0]?.textContent?.trim() ??
            element.textContent?.trim() ??
            "",
          width: box.width,
          height: box.height,
        };
      });
      expect(info.name, `control ${index}`).not.toBe("");
      expect(info.width, info.name).toBeGreaterThanOrEqual(24);
      expect(info.height, info.name).toBeGreaterThanOrEqual(24);
    }
  });

  test("F-A11Y3-05 the format is a fieldset with a legend, the file input is named, and an error is a described alert", async ({
    page,
  }) => {
    await openStudio(page, SPEC_LINK);
    await openDialog(page);
    const fieldset = dialog(page).locator("fieldset");
    await expect(fieldset).toHaveCount(1);
    await expect(fieldset.locator("legend")).toHaveText("Format");
    await expect(formatGroup(page)).toBeVisible();
    await expect(fileInput(page)).toHaveAttribute("type", "file");
    await expect(fileInput(page)).toHaveAttribute("accept", ".md,.markdown,.css,.txt");
    await doImport(page).click();
    const region = errorRegion(page);
    await expect(region).toHaveAttribute("role", "alert");
    await expect(region).toHaveText(EMPTY_MESSAGE);
    const describedBy = await textarea(page).getAttribute("aria-describedby");
    expect(describedBy).toBe(await region.getAttribute("id"));
    await settled(page);
  });
});
