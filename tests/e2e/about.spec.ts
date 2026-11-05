import { expect, type Page, test } from "@playwright/test";
import { decodeSpec, encodeSpec, isPlainText } from "@/spec";
import { exportButton, exportDialog, lotLine } from "./export-support";
import {
  button,
  designFor,
  FRESH,
  inputsPanel,
  openStudio,
  seedOf,
  stubSeeds,
} from "./studio-support";

// The About flows of docs/specs/03-export.md, section 10.12 (Task 3.13): F-ABT-01 to F-ABT-04, on the
// fields of R3-33 and section 9.1, with the "Import…" button of F-ABT-01 (Task 3.16); the export
// dialog's lot line of F-ABT-02 is asserted here (Task 3.14).

test.use({ viewport: { width: 1280, height: 800 } });

const NAME_MAX = 80;
const ONE_LINER_MAX = 140;

const nameField = (page: Page) =>
  inputsPanel(page).getByRole("textbox", { name: "Name", exact: true });
const oneLineField = (page: Page) =>
  inputsPanel(page).getByRole("textbox", { name: "One line", exact: true });

/** The hash of the page now. */
const hashOf = (page: Page): Promise<string> => page.evaluate(() => window.location.hash);

/** The spec the hash holds, after the debounced write (the 300 ms persist). */
async function hashedSpec(page: Page) {
  await expect.poll(() => hashOf(page)).toMatch(/^#s=/);
  return decodeSpec((await hashOf(page)).slice(3));
}

/** Polls the hash until its spec's `meta.name` is `name`. */
async function expectHashedName(page: Page, name: string): Promise<void> {
  await expect
    .poll(async () => {
      const hash = await hashOf(page);
      return hash.startsWith("#s=") ? decodeSpec(hash.slice(3)).meta.name : null;
    })
    .toBe(name);
}

test.describe("9.1 About", () => {
  test.beforeEach(async ({ page }) => {
    await stubSeeds(page);
  });

  test("F-ABT-01 the inputs panel opens with About first, before Brief, and its two fields", async ({
    page,
  }) => {
    await openStudio(page);
    const panel = inputsPanel(page);
    const titles = await panel.locator("section > h3").allTextContents();
    // docs/specs/04-ai.md, section 16: About first, then Brief (R4-53); Task 4.10b adds Image.
    expect(titles.slice(0, 3)).toEqual(["About", "Brief", "Seeds"]);
    const about = panel.getByRole("region", { name: "About", exact: true });
    await expect(nameField(page)).toHaveAttribute("placeholder", "untitled");
    await expect(nameField(page)).toHaveAccessibleDescription("Up to 80 characters");
    await expect(oneLineField(page)).toHaveAccessibleDescription("Up to 140 characters");
    await expect(about.getByRole("textbox")).toHaveCount(2);
    await expect(about.getByRole("button", { name: "Import…", exact: true })).toHaveCount(1);
  });

  test("F-ABT-02 typing Saltmarsh at a steady pace is one history entry, and one Undo undoes it", async ({
    page,
  }) => {
    await openStudio(page);
    await nameField(page).pressSequentially("Saltmarsh", { delay: 60 });
    await expectHashedName(page, "Saltmarsh");
    // The export dialog's lot line names the design (R3-34, 9.2).
    await exportButton(page).click();
    await expect(lotLine(page)).toContainText(/^LOT [0-9a-f]{4}·[0-9a-f]{4} · Saltmarsh$/);
    await page.keyboard.press("Escape");
    await expect(exportDialog(page)).toHaveCount(0);
    await button(page, "Undo").click();
    await expectHashedName(page, "untitled");
    await expect(nameField(page)).toHaveValue("");
    await expect(button(page, "Undo")).toHaveAttribute("aria-disabled", "true");
  });

  test("F-ABT-03 the field keeps what was typed, and the name is plain text", async ({ page }) => {
    await openStudio(page);
    const field = nameField(page);
    await field.focus();
    let typed = "";
    for (const key of "Tide  app") {
      await page.keyboard.type(key);
      typed += key;
      await expect(field).toHaveValue(typed);
      expect(await field.evaluate((input: HTMLInputElement) => input.selectionStart)).toBe(
        typed.length,
      );
    }
    await expectHashedName(page, "Tide app");
    await page.keyboard.type(" ");
    await expect(field).toHaveValue("Tide  app ");
    expect(await field.evaluate((input: HTMLInputElement) => input.selectionStart)).toBe(10);
    await expectHashedName(page, "Tide app");

    await field.fill("a\u202Eb");
    await expectHashedName(page, "ab");
    const spec = await hashedSpec(page);
    expect(isPlainText(spec.meta.name)).toBe(true);
    expect(decodeURIComponent(await hashOf(page))).not.toContain("\u202e");
  });

  test("F-ABT-04 a long text is cut with a message, a cleared field shows its placeholder, a link fills it", async ({
    page,
  }) => {
    await openStudio(page);
    const long = "n".repeat(NAME_MAX + 1);
    await nameField(page).fill(long);
    await expect(
      inputsPanel(page).getByText("Cut to 80 characters.", { exact: true }),
    ).toBeVisible();
    await expectHashedName(page, long.slice(0, NAME_MAX));

    await oneLineField(page).fill("o".repeat(ONE_LINER_MAX + 1));
    await expect(
      inputsPanel(page).getByText("Cut to 140 characters.", { exact: true }),
    ).toBeVisible();
    await expect
      .poll(async () => (await hashedSpec(page)).meta.oneLiner)
      .toBe("o".repeat(ONE_LINER_MAX));

    await nameField(page).fill("");
    await expectHashedName(page, "untitled");
    await expect(nameField(page)).toHaveValue("");
    await expect(nameField(page)).toHaveAttribute("placeholder", "untitled");
    await expect(inputsPanel(page).getByText("Cut to 80 characters.")).toHaveCount(0);
  });

  test("F-ABT-04 opening a link of a design named Kelp fills Name with Kelp", async ({ page }) => {
    const kelp = encodeSpec(designFor({ ...FRESH, name: "Kelp" }, seedOf(1)));
    await openStudio(page, `#s=${kelp}`);
    await expect(nameField(page)).toHaveValue("Kelp");
  });
});
