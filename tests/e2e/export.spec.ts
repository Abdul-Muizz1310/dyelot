import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { blockReason, formatBytes, summaryLines } from "@/features/export/files";
import { specId } from "@/spec";
import {
  bundleOf,
  closeButton,
  copyButton,
  download,
  downloadButton,
  echoNext,
  entriesOf,
  exportButton,
  exportDialog,
  exportStatus,
  failingRows,
  fileRows,
  GOLDEN,
  GOLDEN_LINK,
  IMPORTED,
  IMPORTED_LINK,
  LONG_NAME,
  lotLine,
  MANIFEST,
  ONE_FAIL,
  ONE_FAIL_LINK,
  openReady,
  previewOf,
  previewToggle,
  rawText,
  recordObjectUrls,
  SPEC,
  SPEC_LINK,
  sha256Hex,
  summaryItems,
  urlLog,
  zipNameOf,
  zipOf,
} from "./export-support";
import {
  button,
  canvasRegion,
  designFor,
  FRESH,
  failingWorker,
  focusBody,
  inputsPanel,
  lotId,
  lotOf,
  modeSwitch,
  openStudio,
  seedOf,
  settled,
  stubSeeds,
} from "./studio-support";

// The export flows of docs/specs/03-export.md, section 10.12 (Task 3.14): F-EXP-01 to 08, 10 to 15,
// 19, the Review Focus cases F-EXP-RF1 to RF3 and the export parts of F-A11Y3-01 to 04, and the
// blocked states of Task 3.15 (F-EXP-09, 16 to 18, 20).

test.use({ viewport: { width: 1280, height: 800 } });

const PHONE = { width: 360, height: 740 };
const THEME = "app/theme.css";

const findingsHeading = (page: Page) =>
  page.locator("aside#studio-inspector").getByRole("heading", { name: "Findings", exact: true });

const flavorSwitch = (page: Page) =>
  exportDialog(page).getByRole("switch", { name: "Include flavor files", exact: true });

const toolbar = (page: Page) => page.getByRole("region", { name: "Canvas toolbar" });

/** The dialog's name for the element that has focus, or "". */
const focusedName = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return "";
    return active.getAttribute("aria-label") ?? active.textContent?.trim() ?? "";
  });

test.describe("the export dialog", () => {
  test("F-EXP-01 Export follows Copy link and opens a modal dialog with focus on its heading", async ({
    page,
  }) => {
    await openStudio(page, SPEC_LINK);
    const names = await toolbar(page)
      .getByRole("button")
      .evaluateAll((buttons) =>
        buttons.map((each) => each.getAttribute("aria-label") ?? each.textContent?.trim()),
      );
    expect(names.indexOf("Export")).toBe(names.indexOf("Copy link") + 1);
    await expect(exportButton(page)).toHaveAttribute("aria-keyshortcuts", "Control+E Meta+E");
    await exportButton(page).click();
    const dialog = exportDialog(page);
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(dialog.getByRole("heading", { name: "Export", exact: true })).toBeFocused();
    // Everything outside the dialog is inert: a focus call leaves focus in the dialog.
    await button(page, "Regenerate").evaluate((element) => element.focus());
    await expect(dialog.getByRole("heading", { name: "Export", exact: true })).toBeFocused();
    expect(
      await page.evaluate(() =>
        document.querySelector("[role=dialog]")?.contains(document.activeElement),
      ),
    ).toBe(true);
  });

  test("F-EXP-02 Ctrl+E opens one dialog, held or not, and Ctrl+S and Ctrl+E stay inside it", async ({
    page,
  }) => {
    await openStudio(page, SPEC_LINK);
    await button(page, "Regenerate").focus();
    await page.keyboard.down("Control");
    for (let press = 0; press < 4; press++) await page.keyboard.down("e");
    await page.keyboard.up("e");
    await page.keyboard.up("Control");
    await expect(exportDialog(page)).toHaveCount(1);
    expect(await page.evaluate(() => document.hasFocus())).toBe(true);
    await page.evaluate(() => {
      const seen: boolean[] = [];
      (window as unknown as { __seen: boolean[] }).__seen = seen;
      window.addEventListener("keydown", (event) => {
        if (event.key !== "Control") seen.push(event.defaultPrevented);
      });
    });
    await page.keyboard.press("Control+KeyS");
    await page.keyboard.press("Control+KeyE");
    expect(await page.evaluate(() => (window as unknown as { __seen: boolean[] }).__seen)).toEqual([
      true,
      true,
    ]);
    await expect(exportDialog(page)).toHaveCount(1);
    await expect(page.getByText("Link copied")).toHaveCount(0);
    await expect(exportStatus(page)).not.toContainText("Copied");
  });

  test("F-EXP-03 the ready dialog shows the lot line and the four summary lines", async ({
    page,
  }) => {
    await openStudio(page, SPEC_LINK);
    await openReady(page);
    const line = `LOT ${lotOf(SPEC)} · ${SPEC.meta.name}`;
    await expect(lotLine(page)).toHaveText(line);
    await expect(lotId(page)).toHaveText(lotOf(SPEC));
    expect(await summaryItems(page).allTextContents()).toEqual(
      summaryLines(bundleOf(SPEC).summary),
    );
  });

  test("F-EXP-05 the file list has one row per file, and the preview shows the selected file", async ({
    page,
  }) => {
    await openStudio(page, SPEC_LINK);
    await openReady(page);
    const { files } = bundleOf(SPEC);
    const rows = fileRows(page);
    await expect(rows).toHaveCount(files.length);
    for (const [index, file] of files.entries()) {
      const row = rows.nth(index);
      await expect(row).toContainText(file.path);
      await expect(row).toContainText(formatBytes(new TextEncoder().encode(file.text).length));
    }
    await expect(previewToggle(page, "DESIGN.md")).toHaveAttribute("aria-pressed", "true");
    const first = files[0];
    expect(await rawText(previewOf(page, "DESIGN.md"))).toBe(first?.text);
    await expect(previewOf(page, "DESIGN.md")).toHaveAttribute("tabindex", "0");
    await previewToggle(page, THEME).click();
    await expect(previewToggle(page, THEME)).toHaveAttribute("aria-pressed", "true");
    await expect(previewToggle(page, "DESIGN.md")).toHaveAttribute("aria-pressed", "false");
    expect(await rawText(previewOf(page, THEME))).toBe(
      files.find((file) => file.path === THEME)?.text,
    );
  });

  test.describe("copy", () => {
    test.use({ permissions: ["clipboard-read", "clipboard-write"] });

    test("F-EXP-06 Copy writes the file's text, says Copied for 2 seconds, and announces it", async ({
      page,
    }) => {
      await page.clock.install();
      await openStudio(page, SPEC_LINK);
      await openReady(page);
      const copy = copyButton(page, THEME);
      await copy.click();
      const text = bundleOf(SPEC).files.find((file) => file.path === THEME)?.text;
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(text);
      await expect(copy).toHaveText("Copied");
      await expect(exportStatus(page)).toHaveText("Copied app/theme.css.");
      await page.clock.runFor(2100);
      await expect(copy).toHaveText("Copy");
    });
  });

  test.describe("a blocked clipboard", () => {
    const fallback = "Copy is blocked here. The text is selected: press Ctrl+C or ⌘C.";

    for (const [name, script] of [
      [
        "missing",
        () => {
          Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
        },
      ],
      [
        "denied",
        () => {
          const refuse = () => Promise.reject(new DOMException("denied", "NotAllowedError"));
          Object.defineProperty(navigator, "clipboard", {
            value: { writeText: refuse, readText: refuse },
            configurable: true,
          });
        },
      ],
    ] as const) {
      test(`F-EXP-07 with the clipboard ${name}, Copy selects the file's text in the preview`, async ({
        page,
      }) => {
        await page.addInitScript(script);
        await openStudio(page, SPEC_LINK);
        await openReady(page);
        await copyButton(page, THEME).click();
        await expect(exportStatus(page)).toHaveText(fallback);
        await expect(previewToggle(page, THEME)).toHaveAttribute("aria-pressed", "true");
        const text = bundleOf(SPEC).files.find((file) => file.path === THEME)?.text;
        expect(await page.evaluate(() => getSelection()?.toString())).toBe(text);
        await expect(copyButton(page, THEME)).toHaveText("Copy");
      });
    }
  });

  test("F-EXP-08 Escape and Close return focus to the opener, and Ctrl+E to Regenerate", async ({
    page,
  }) => {
    await openStudio(page, SPEC_LINK);
    await exportButton(page).click();
    await expect(exportDialog(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(exportDialog(page)).toHaveCount(0);
    await expect(exportButton(page)).toBeFocused();
    await openReady(page);
    await closeButton(page).click();
    await expect(exportDialog(page)).toHaveCount(0);
    await expect(exportButton(page)).toBeFocused();
    await button(page, "Regenerate").focus();
    await page.keyboard.press("Control+KeyE");
    await expect(exportDialog(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(exportDialog(page)).toHaveCount(0);
    await expect(button(page, "Regenerate")).toBeFocused();
  });

  test("F-EXP-08 Ctrl+E with a drawer open closes it, opens the dialog, and Escape returns focus to the drawer's button", async ({
    page,
  }) => {
    await page.setViewportSize(PHONE);
    await openStudio(page, SPEC_LINK);
    await button(page, "Inputs").click();
    await expect(inputsPanel(page)).toBeVisible();
    await button(page, "Regenerate").focus();
    await page.keyboard.press("Control+KeyE");
    await expect(exportDialog(page)).toBeVisible();
    await expect(
      exportDialog(page).getByRole("heading", { name: "Export", exact: true }),
    ).toBeFocused();
    await expect(button(page, "Inputs")).toHaveAttribute("aria-expanded", "false");
    await page.keyboard.press("Escape");
    await expect(exportDialog(page)).toHaveCount(0);
    await expect(button(page, "Inputs")).toBeFocused();
  });

  test("F-EXP-10 the download says so, and the Blob URL is created, clicked and revoked in order", async ({
    page,
  }) => {
    await recordObjectUrls(page);
    await openStudio(page, SPEC_LINK);
    await openReady(page);
    const { name } = await download(page);
    await expect(exportStatus(page)).toHaveText(`Downloaded ${zipNameOf(SPEC)}.`);
    expect(name).toBe(zipNameOf(SPEC));
    await expect.poll(async () => (await urlLog(page)).length).toBe(3);
    const log = await urlLog(page);
    expect(log.map((entry) => entry.op)).toEqual(["create", "click", "revoke"]);
    expect(new Set(log.map((entry) => entry.url)).size).toBe(1);
    expect(log[2]?.afterTick).toBe(true);
  });

  test("F-EXP-11 a change that is still generating shows the waiting state, then the new design", async ({
    page,
  }) => {
    await failingWorker(page);
    await openStudio(page, SPEC_LINK);
    const before = await lotId(page).textContent();
    await page.evaluate(() => {
      (window as unknown as { __dyelotHold: boolean }).__dyelotHold = true;
    });
    await page
      .getByRole("group", { name: "Contrast level", exact: true })
      .first()
      .getByRole("radio", { name: "AAA", exact: true })
      .check();
    await page.keyboard.press("Control+KeyE");
    const dialog = exportDialog(page);
    await expect(dialog).toContainText("Waiting for the design to finish generating…");
    await expect(fileRows(page)).toHaveCount(0);
    await expect(downloadButton(page)).toHaveCount(0);
    await page.evaluate(() => (window as unknown as { __dyelotRelease(): void }).__dyelotRelease());
    await expect(fileRows(page).first()).toBeVisible();
    const after = (await lotId(page).textContent()) ?? "";
    expect(after).not.toBe(before);
    await expect(lotLine(page)).toContainText(`LOT ${after} · `);
  });

  test("F-EXP-12 when the export code does not load, Try again loads it; the studio keeps working", async ({
    page,
  }) => {
    await openStudio(page, SPEC_LINK);
    await page.route("**/*.js*", (route) => route.abort());
    await exportButton(page).click();
    await expect(exportDialog(page)).toContainText("The export code did not load.");
    await expect(fileRows(page)).toHaveCount(0);
    await closeButton(page).click();
    const before = await lotId(page).textContent();
    await button(page, "Regenerate").click();
    await expect(lotId(page)).not.toHaveText(before ?? "");
    await exportButton(page).click();
    await expect(exportDialog(page)).toContainText("The export code did not load.");
    await page.unroute("**/*.js*");
    await exportDialog(page).getByRole("button", { name: "Try again", exact: true }).click();
    await expect(fileRows(page).first()).toBeVisible();
    await closeButton(page).click();
    const next = await lotId(page).textContent();
    await button(page, "Regenerate").click();
    await expect(lotId(page)).not.toHaveText(next ?? "");
  });

  test("F-EXP-14 under reduced motion the dialog has no animation or transition, opening or closing", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openStudio(page, SPEC_LINK);
    const animations = () =>
      page.evaluate(
        () =>
          document
            .getAnimations()
            .filter((animation) =>
              (animation.effect as KeyframeEffect | null)?.target?.closest?.(
                "[data-export-overlay]",
              ),
            ).length,
      );
    await exportButton(page).click();
    await expect(exportDialog(page)).toBeVisible();
    expect(await animations()).toBe(0);
    await fileRows(page).first().waitFor();
    expect(await animations()).toBe(0);
    await closeButton(page).click();
    expect(await animations()).toBe(0);
    await expect(exportDialog(page)).toHaveCount(0);
  });

  test("F-EXP-14 without reduced motion the dialog fades over 150 ms of opacity", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await openStudio(page, SPEC_LINK);
    await exportButton(page).click();
    const overlay = page.locator("[data-export-overlay]");
    await expect(overlay).toBeVisible();
    expect(
      await overlay.evaluate((element) => {
        const style = getComputedStyle(element);
        return [style.transitionProperty, style.transitionDuration];
      }),
    ).toEqual(["opacity", "0.15s"]);
    await expect(overlay).toHaveCSS("opacity", "1");
    await page.keyboard.press("Escape");
    await expect(exportDialog(page)).toHaveCount(0);
  });

  test("F-EXP-15 the first load fetches no export code; opening Export fetches it", async ({
    page,
  }) => {
    const scripts: { url: string; text: string }[] = [];
    page.on("response", async (response) => {
      if (response.request().resourceType() !== "script") return;
      scripts.push({ url: response.url(), text: await response.text().catch(() => "") });
    });
    await openStudio(page, SPEC_LINK);
    await expect.poll(() => scripts.length).toBeGreaterThan(0);
    await page.waitForLoadState("networkidle");
    const first = scripts.length;
    for (const script of scripts) {
      expect(script.text, script.url).not.toContain("dyelot.check/1");
      expect(script.text, script.url).not.toContain("yaml-group-twice");
    }
    await exportButton(page).click();
    await fileRows(page).first().waitFor();
    expect(scripts.slice(first).some((script) => script.text.includes("dyelot.check/1"))).toBe(
      true,
    );
  });

  test("F-EXP-09 a design that fails a required check opens the blocked dialog: no file text, no download, no copy", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await recordObjectUrls(page);
    await openStudio(page, IMPORTED_LINK);
    await page.evaluate(() => navigator.clipboard.writeText("sentinel"));
    await exportButton(page).click();
    const dialog = exportDialog(page);
    await expect(lotLine(page)).toBeVisible();
    await expect(summaryItems(page)).toHaveCount(4);
    const errors = failingRows(IMPORTED);
    expect(errors.length).toBeGreaterThan(0);
    await expect(
      dialog.getByText(blockReason("fixable", errors.length), { exact: true }),
    ).toBeVisible();
    const rows = dialog
      .getByRole("list", { name: "Failing checks", exact: true })
      .getByRole("listitem");
    await expect(rows).toHaveText(errors);
    const paths = bundleOf(IMPORTED).files.map((file) => file.path);
    await expect(fileRows(page)).toHaveCount(paths.length);
    for (const [index, filePath] of paths.entries()) {
      const text = (await fileRows(page).nth(index).textContent()) ?? "";
      expect(text.startsWith(filePath), filePath).toBe(true);
      expect(text, filePath).not.toMatch(/\d (B|KB)/);
    }
    await expect(dialog.getByLabel(/^Preview of /)).toHaveCount(0);
    const blocked = dialog.getByRole("button", { name: /^(Download |Copy )/ });
    const count = await blocked.count();
    expect(count).toBe(paths.length + 1);
    for (let index = 0; index < count; index++) {
      const each = blocked.nth(index);
      await expect(each).toHaveAttribute("aria-disabled", "true");
      // Playwright waits for a button that is not aria-disabled; this one must stay put when clicked.
      await each.click({ force: true });
      await each.focus();
      await page.keyboard.press("Enter");
    }
    await page.waitForTimeout(2000);
    expect(await urlLog(page)).toEqual([]);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("sentinel");
    expect(await page.evaluate(() => document.body.textContent)).not.toContain("--primary:");
    await expect(dialog.locator("pre")).toHaveCount(0);
  });

  test("F-EXP-16 Fix in the inspector closes the dialog and focuses the Findings heading, in the drawer at 360 px", async ({
    page,
  }) => {
    await openStudio(page, ONE_FAIL_LINK);
    await exportButton(page).click();
    await exportDialog(page)
      .getByRole("button", { name: "Fix in the inspector", exact: true })
      .click();
    await expect(exportDialog(page)).toHaveCount(0);
    await expect(findingsHeading(page)).toBeFocused();
    await page.setViewportSize(PHONE);
    await page.goto("about:blank");
    await openStudio(page, ONE_FAIL_LINK);
    await exportButton(page).click();
    await exportDialog(page)
      .getByRole("button", { name: "Fix in the inspector", exact: true })
      .click();
    await expect(exportDialog(page)).toHaveCount(0);
    await expect(page.locator("aside#studio-inspector")).toHaveAttribute("data-open", "");
    await expect(findingsHeading(page)).toBeFocused();
  });

  test("F-EXP-17 Rebuild from the parameters commits the regenerated design; Export is ready, and Undo brings the blocked one back", async ({
    page,
  }) => {
    await openStudio(page, ONE_FAIL_LINK);
    await page.getByRole("button", { name: "Rebuild from the parameters", exact: true }).click();
    await settled(page);
    await expect(lotId(page)).toHaveText(lotOf(SPEC));
    await openReady(page);
    await expect(downloadButton(page)).not.toHaveAttribute("aria-disabled", "true");
    await closeButton(page).click();
    await button(page, "Undo").click();
    await settled(page);
    await expect(lotId(page)).toHaveText(lotOf(ONE_FAIL));
    await exportButton(page).click();
    await expect(
      exportDialog(page).getByText(blockReason("fixable", 1), { exact: true }),
    ).toBeVisible();
  });

  test("F-EXP-18 the fixable sentence reads in full, and M2's contrast fix leaves a ready dialog", async ({
    page,
  }) => {
    await openStudio(page, ONE_FAIL_LINK);
    await exportButton(page).click();
    await expect(
      exportDialog(page).getByText(
        "This design fails 1 required check. It came from a link or a file, and rebuilding it from its parameters makes every check pass.",
        { exact: true },
      ),
    ).toBeVisible();
    await closeButton(page).click();
    await page.getByRole("button", { name: "Raise contrast to AA+", exact: true }).click();
    await settled(page);
    await expect(
      page
        .getByRole("group", { name: "Contrast level", exact: true })
        .getByRole("radio", { name: "AA+", exact: true }),
    ).toBeChecked();
    await openReady(page);
    await expect(downloadButton(page)).not.toHaveAttribute("aria-disabled", "true");
  });

  test("F-EXP-20 a rebuild that gives a failing design is a fault: the sentence, Show the findings and no download", async ({
    page,
  }) => {
    await failingWorker(page);
    await openStudio(page, ONE_FAIL_LINK);
    await echoNext(page, ONE_FAIL);
    await page.getByRole("button", { name: "Rebuild from the parameters", exact: true }).click();
    await settled(page);
    const fault =
      "This design fails 1 required check although the studio generated it. That is a fault in dyelot: change any parameter to generate it again.";
    await expect(
      page.locator("aside#studio-inspector").getByText(fault, { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Rebuild from the parameters" })).toHaveCount(0);
    await exportButton(page).click();
    const dialog = exportDialog(page);
    await expect(dialog.getByText(fault, { exact: true })).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Show the findings", exact: true }),
    ).toBeVisible();
    await expect(downloadButton(page)).toHaveAttribute("aria-disabled", "true");
  });

  test("F-EXP-19 Export follows Copy link in the Tab order, at 1280 and at 360 with View closed and open", async ({
    page,
  }) => {
    await openStudio(page, SPEC_LINK);
    await button(page, "Copy link").focus();
    await page.keyboard.press("Tab");
    await expect(exportButton(page)).toBeFocused();
    await page.setViewportSize(PHONE);
    await button(page, "Copy link").focus();
    await page.keyboard.press("Tab");
    await expect(exportButton(page)).toBeFocused();
    await button(page, "View").click();
    await button(page, "Copy link").focus();
    await page.keyboard.press("Tab");
    await expect(exportButton(page)).toBeFocused();
    expect((await toolbar(page).boundingBox())?.height).toBeGreaterThan(0);
  });
});

test.describe("the download", () => {
  for (const timezoneId of [undefined, "Pacific/Kiritimati", "America/St_Johns"]) {
    test.describe(`in ${timezoneId ?? "the default time zone"}`, () => {
      test.use({ timezoneId });

      test("F-EXP-04 the zip holds the manifest's files, byte for byte", async ({ page }) => {
        await openStudio(page, GOLDEN_LINK);
        await openReady(page);
        const { name, bytes } = await download(page);
        expect(name).toBe(zipNameOf(GOLDEN));
        const entries = entriesOf(bytes);
        expect(entries.map((entry) => entry.path)).toEqual(MANIFEST.files.map((file) => file.path));
        for (const [index, entry] of entries.entries()) {
          expect(entry.bytes.length, entry.path).toBe(MANIFEST.files[index]?.bytes);
          expect(sha256Hex(entry.bytes), entry.path).toBe(MANIFEST.files[index]?.sha256);
        }
        expect(sha256Hex(bytes)).toBe(MANIFEST.zipSha256);
      });
    });
  }

  test("F-EXP-RF1 a design that changes while the dialog is open rebuilds the bundle", async ({
    page,
  }) => {
    await openStudio(page, SPEC_LINK);
    await page.evaluate((hash) => {
      window.location.hash = hash;
    }, GOLDEN_LINK);
    await expect(lotId(page)).toHaveText(lotOf(GOLDEN));
    await settled(page);
    await openReady(page);
    await expect(lotLine(page)).toContainText(`LOT ${lotOf(GOLDEN)} · `);
    await page.evaluate(() => window.history.back());
    await expect(lotLine(page)).toContainText(`LOT ${lotOf(SPEC)} · `);
    await expect(downloadButton(page)).toHaveText(`Download ${zipNameOf(SPEC)}`);
    const { bytes } = await download(page);
    const receipt = entriesOf(bytes).find((entry) => entry.path === "receipt.json");
    const parsed = JSON.parse(new TextDecoder().decode(receipt?.bytes)) as {
      design: { specId: string };
    };
    expect(parsed.design.specId).toBe(specId(SPEC));
    expect(sha256Hex(bytes)).toBe(sha256Hex(zipOf(SPEC)));
  });

  test("F-EXP-RF2 two downloads in a row, and one after a Copy, give the manifest's files", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await recordObjectUrls(page);
    await openStudio(page, GOLDEN_LINK);
    await openReady(page);
    const holds = async () => {
      const { bytes } = await download(page);
      expect(sha256Hex(bytes)).toBe(MANIFEST.zipSha256);
      expect(entriesOf(bytes).map((entry) => sha256Hex(entry.bytes))).toEqual(
        MANIFEST.files.map((file) => file.sha256),
      );
    };
    await holds();
    await holds();
    await copyButton(page, "DESIGN.md").click();
    await expect(exportStatus(page)).toHaveText("Copied DESIGN.md.");
    await holds();
    await expect.poll(async () => (await urlLog(page)).length).toBe(9);
    const log = await urlLog(page);
    for (const url of new Set(log.map((entry) => entry.url))) {
      const ops = log.filter((entry) => entry.url === url).map((entry) => entry.op);
      expect(ops).toEqual(["create", "click", "revoke"]);
    }
  });

  test("F-EXP-RF3 an 80-character name with no spaces fits 360 px, and the zip takes the 48-character slug", async ({
    page,
  }) => {
    await stubSeeds(page);
    await page.setViewportSize(PHONE);
    await openStudio(page);
    await button(page, "Inputs").click();
    await inputsPanel(page).getByRole("textbox", { name: "Name", exact: true }).fill(LONG_NAME);
    const panel = inputsPanel(page);
    expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
    await page.getByRole("button", { name: "Close inputs", exact: true }).click();
    await expect(lotId(page)).not.toHaveText(lotOf(designFor(FRESH, seedOf(1))));
    await settled(page);
    await exportButton(page).click();
    await expect(lotLine(page)).toContainText(LONG_NAME);
    await fileRows(page).first().waitFor();
    const fits = await page.evaluate(() => {
      const dialog = document.querySelector("[role=dialog]");
      const line = document.querySelector("[data-export-lot]");
      if (!(dialog instanceof HTMLElement) || !(line instanceof HTMLElement)) return null;
      return {
        page: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        dialog: dialog.scrollWidth <= dialog.clientWidth,
        line: line.scrollWidth <= line.clientWidth,
        rows: [...dialog.querySelectorAll("li")].every((row) => row.scrollWidth <= row.clientWidth),
      };
    });
    expect(fits).toEqual({ page: true, dialog: true, line: true, rows: true });
    const spec = designFor({ ...FRESH, name: LONG_NAME }, seedOf(1));
    const { name } = await download(page);
    expect(name).toBe(
      `saltmarshsaltmarshsaltmarshsaltmarshsaltmarshsal-${specId(spec).slice(0, 8)}.zip`,
    );
  });
});

test.describe("layout and accessibility", () => {
  test("F-EXP-13 at 360 × 740 the dialog fits, wraps, and every button is a 24 px target reachable by Tab", async ({
    page,
  }) => {
    await page.setViewportSize(PHONE);
    await openStudio(page, SPEC_LINK);
    await openReady(page);
    const fits = await page.evaluate(() => {
      const dialog = document.querySelector("[role=dialog]");
      if (!(dialog instanceof HTMLElement)) return null;
      return {
        page: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        dialog: dialog.scrollWidth <= dialog.clientWidth,
        rows: [...dialog.querySelectorAll("li, [data-export-lot]")].every(
          (row) => row.scrollWidth <= row.clientWidth,
        ),
      };
    });
    expect(fits).toEqual({ page: true, dialog: true, rows: true });
    const buttons = exportDialog(page).getByRole("button");
    const count = await buttons.count();
    expect(count).toBeGreaterThan(40);
    const reached = new Set<string>();
    await page.getByRole("heading", { name: "Export", exact: true }).focus();
    for (let step = 0; step < count + 2; step++) {
      await page.keyboard.press("Tab");
      reached.add(await focusedName(page));
    }
    for (let index = 0; index < count; index++) {
      const each = buttons.nth(index);
      const box = await each.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(24);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(24);
      const name = await each.evaluate(
        (element) => element.getAttribute("aria-label") ?? element.textContent?.trim() ?? "",
      );
      expect(reached.has(name), name).toBe(true);
    }
  });

  for (const viewport of [{ width: 1280, height: 800 }, PHONE]) {
    for (const mode of ["light", "dark"] as const) {
      test(`F-A11Y3-01 axe finds no violation in the ready dialog at ${viewport.width} px, canvas in ${mode}`, async ({
        page,
      }) => {
        await page.setViewportSize(viewport);
        await openStudio(page, SPEC_LINK);
        if (mode === "dark") {
          if (viewport.width < 640) await button(page, "View").click();
          await modeSwitch(page).click();
          await expect(modeSwitch(page)).toHaveAttribute("aria-checked", "true");
        }
        await openReady(page);
        await page.waitForTimeout(300);
        const result = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
          .analyze();
        expect(result.violations).toEqual([]);
      });
    }
  }

  test("F-A11Y3-02 Tab and Shift+Tab cycle through the dialog's controls, and a click behind keeps focus", async ({
    page,
  }) => {
    await openStudio(page, SPEC_LINK);
    await openReady(page);
    const heading = exportDialog(page).getByRole("heading", { name: "Export", exact: true });
    await expect(heading).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(closeButton(page)).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(flavorSwitch(page)).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(closeButton(page)).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(flavorSwitch(page)).toBeFocused();
    await page.mouse.click(3, 3);
    expect(
      await page.evaluate(() =>
        document.querySelector("[role=dialog]")?.contains(document.activeElement),
      ),
    ).toBe(true);
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() =>
        document.querySelector("[role=dialog]")?.contains(document.activeElement),
      ),
    ).toBe(true);
  });

  test("F-A11Y3-03 every control has a name and a 24 px target; the status region is role status", async ({
    page,
  }) => {
    await openStudio(page, SPEC_LINK);
    await openReady(page);
    await expect(exportDialog(page).getByRole("status")).toHaveCount(1);
    const controls = exportDialog(page).locator("button, [tabindex='0']");
    const count = await controls.count();
    for (let index = 0; index < count; index++) {
      const each = controls.nth(index);
      const info = await each.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return {
          name: element.getAttribute("aria-label") ?? element.textContent?.trim() ?? "",
          width: box.width,
          height: box.height,
        };
      });
      expect(info.name, `control ${index}`).not.toBe("");
      expect(info.width, info.name).toBeGreaterThanOrEqual(24);
      expect(info.height, info.name).toBeGreaterThanOrEqual(24);
    }
    for (const file of bundleOf(SPEC).files) {
      await expect(previewToggle(page, file.path)).toHaveCount(1);
      await expect(copyButton(page, file.path)).toHaveCount(1);
    }
  });

  test("F-A11Y3-04 the dialog works by keyboard alone, and Space and the arrows scroll the preview", async ({
    page,
  }) => {
    await openStudio(page, SPEC_LINK);
    await openReady(page);
    // The flavor switch (R5-29) follows the summary, before the file list.
    const expected: string[] = ["Include flavor files"];
    for (const file of bundleOf(SPEC).files)
      expected.push(`Preview ${file.path}`, `Copy ${file.path}`);
    expected.push("Preview of DESIGN.md", `Download ${zipNameOf(SPEC)}`, "Close");
    const seen: string[] = [];
    for (let step = 0; step < expected.length; step++) {
      await page.keyboard.press("Tab");
      seen.push(await focusedName(page));
    }
    expect(seen).toEqual(expected);
    const preview = previewOf(page, "DESIGN.md");
    await preview.focus();
    const top = () => preview.evaluate((element) => element.scrollTop);
    expect(await top()).toBe(0);
    // The scroll is smooth, so the offset settles after the key.
    await page.keyboard.press("Space");
    await expect.poll(top).toBeGreaterThan(0);
    await expect
      .poll(async () => {
        const settled = await top();
        await page.waitForTimeout(150);
        return (await top()) === settled ? settled : -1;
      })
      .toBeGreaterThan(0);
    const afterSpace = await top();
    await page.keyboard.press("ArrowDown");
    await expect.poll(top).toBeGreaterThan(afterSpace);
    await focusBody(page);
    await expect(canvasRegion(page)).toBeAttached();
  });
});
