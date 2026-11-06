import { expect } from "@playwright/test";
import {
  closeButton,
  copyButton,
  download,
  entriesOf,
  exportButton,
  exportDialog,
  fileRows,
  flavorBundleOf,
  openReady,
  previewOf,
  previewToggle,
  rawText,
  SPEC,
  SPEC_LINK,
  zipNameOf,
} from "./export-support";
import { test } from "./flavor-support";
import { openStudio } from "./studio-support";

// The export dialog's "Include flavor files" flows of docs/specs/05-motion-3d.md, section 13.5 (Task
// 5.4c): F-FEX-01 to 04. Every flow fails, through the watch of flavor-support's `test`, on a
// `securitypolicyviolation` event, a console error, a page error or an unhandled rejection in any
// document it visits (14.11).

test.use({ viewport: { width: 1280, height: 800 } });

const FLAVOR_BUNDLE = flavorBundleOf(SPEC);
const FLAVOR_PATHS = FLAVOR_BUNDLE.files.map((file) => file.path);
const FLAVOR_ONLY = FLAVOR_PATHS.filter((each) => each.startsWith("flavor/"));
const DESCRIPTION =
  "Adds the animated background, its CSS fallback and the Remotion source of the brand video: nine text files.";

const flavorSwitch = (page: import("@playwright/test").Page) =>
  exportDialog(page).getByRole("switch", { name: "Include flavor files", exact: true });

const listed = (page: import("@playwright/test").Page): Promise<string[]> =>
  fileRows(page).evaluateAll((rows) =>
    rows.map((row) => row.querySelector("button")?.textContent?.trim() ?? ""),
  );

test.describe("the export dialog's flavor switch", () => {
  test("F-FEX-01 the dialog lists 20 files with the switch off and 29 with it on, focus on the switch", async ({
    page,
  }) => {
    expect(FLAVOR_ONLY).toHaveLength(9);
    await openStudio(page, SPEC_LINK);
    await openReady(page);
    const toggle = flavorSwitch(page);
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await expect(toggle).toHaveAccessibleDescription(DESCRIPTION);
    await expect(fileRows(page)).toHaveCount(20);
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await expect(fileRows(page)).toHaveCount(29);
    expect(await listed(page)).toEqual(FLAVOR_PATHS);
    const gsap = FLAVOR_PATHS.indexOf("motion/gsap.ts");
    expect(FLAVOR_PATHS.slice(gsap + 1, gsap + 10)).toEqual(FLAVOR_ONLY);
    await expect(toggle).toBeFocused();
    await toggle.click();
    await expect(fileRows(page)).toHaveCount(20);
    await expect(toggle).toBeFocused();
  });

  test("F-FEX-02 the zip with the switch on holds the bundle's paths, its receipt and its name", async ({
    page,
  }) => {
    await openStudio(page, SPEC_LINK);
    await openReady(page);
    await flavorSwitch(page).click();
    await expect(fileRows(page)).toHaveCount(29);
    const { name, bytes } = await download(page);
    expect(name).toBe(zipNameOf(SPEC));
    const entries = entriesOf(bytes);
    expect(entries.map((entry) => entry.path)).toEqual(FLAVOR_PATHS);
    const receipt = JSON.parse(
      new TextDecoder().decode(entries.find((entry) => entry.path === "receipt.json")?.bytes),
    ) as { files: { path: string }[] };
    const receiptPaths = receipt.files.map((file) => file.path);
    for (const each of FLAVOR_ONLY) expect(receiptPaths).toContain(each);
  });

  test("F-FEX-03 flavor.css previews R5-20's rule and Copy writes palette.json", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await openStudio(page, SPEC_LINK);
    await openReady(page);
    await flavorSwitch(page).click();
    await expect(fileRows(page)).toHaveCount(29);
    await previewToggle(page, "flavor/flavor.css").click();
    const css = FLAVOR_BUNDLE.files.find((file) => file.path === "flavor/flavor.css")?.text ?? "";
    expect(css).toContain("var(--neutral-100)");
    expect(await rawText(previewOf(page, "flavor/flavor.css"))).toContain(css.trimEnd());
    await copyButton(page, "flavor/palette.json").click();
    const palette =
      FLAVOR_BUNDLE.files.find((file) => file.path === "flavor/palette.json")?.text ?? "";
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(palette);
  });

  test("F-FEX-04 the switch stays on after closing and reopening, and is off after a reload", async ({
    page,
  }) => {
    await openStudio(page, SPEC_LINK);
    await openReady(page);
    await flavorSwitch(page).click();
    await expect(fileRows(page)).toHaveCount(29);
    await closeButton(page).click();
    await expect(exportDialog(page)).toHaveCount(0);
    await openReady(page);
    await expect(flavorSwitch(page)).toHaveAttribute("aria-checked", "true");
    await expect(fileRows(page)).toHaveCount(29);
    await page.reload();
    await exportButton(page).waitFor();
    await openReady(page);
    await expect(flavorSwitch(page)).toHaveAttribute("aria-checked", "false");
    await expect(fileRows(page)).toHaveCount(20);
  });
});
