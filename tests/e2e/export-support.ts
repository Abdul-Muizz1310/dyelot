import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Locator, Page } from "@playwright/test";
import { unzipSync } from "fflate";
import { lintSpec } from "@/engine";
import { SITE } from "@/lib/site/config";
import { encodeSpec } from "@/spec";
import { GOLDENS, IMPORTED, ORIGIN, SPEC } from "../unit/export/golden-support";
import { ONE_FAIL } from "../unit/export/one-fail-support";

// Shared helpers for tests/e2e/export.spec.ts, the export flows of docs/specs/03-export.md, section
// 10.12 (Task 3.14). The test builds in Node, through the same entry the page loads, what the dialog
// must show and what the download must hold.

export { IMPORTED, ONE_FAIL, ORIGIN, SPEC };

// Playwright does not read the `?raw` query of the checker's source: the hook makes it the text.
await import("./raw-hooks.mjs");
const { buildBundle, zipBundle, zipName } = await import("@/export");
const { fmt4, trunc4 } = await import("@/export/format");

/** `LINK(spec)` of section 10.12: the studio opened on a design. */
export const LINK = (spec: typeof SPEC): string => `#s=${encodeSpec(spec)}`;
export const SPEC_LINK = LINK(SPEC);
export const IMPORTED_LINK = LINK(IMPORTED);
/** Fixable, with one error: `SPEC` with one failing pair. */
export const ONE_FAIL_LINK = LINK(ONE_FAIL);

const defaultGolden = GOLDENS.find((golden) => golden.id === "default");
if (defaultGolden === undefined) throw new Error("export-support: no default golden");
/** The `default` golden's spec and the link that opens it. */
export const GOLDEN: typeof SPEC = defaultGolden.spec;
export const GOLDEN_LINK = LINK(GOLDEN);

/** `LONG_NAME` of section 4: 80 characters with no space. */
export const LONG_NAME = `${"Saltmarsh".repeat(8)}${"Tidewater".slice(0, 8)}`;

type ManifestEntry = {
  specId: string;
  zipSha256: string;
  files: { path: string; bytes: number; sha256: string }[];
};
/** The golden manifest's `default` entry. */
export const MANIFEST: ManifestEntry = (
  JSON.parse(
    readFileSync(path.join(import.meta.dirname, "../golden/export/manifest.json"), "utf8"),
  ) as Record<string, ManifestEntry>
).default as ManifestEntry;

if (SITE.url !== ORIGIN) throw new Error("export-support: SITE.url is not the export origin");

/** The bundle the page must build for a spec. */
export const bundleOf = (spec: typeof SPEC) => buildBundle({ spec, origin: ORIGIN });
/** The bundle with the flavor files (R5-24): 29 files for `SPEC`. */
export const flavorBundleOf = (spec: typeof SPEC) =>
  buildBundle({ spec, origin: ORIGIN, flavor: true });
/** The zip name the page must offer for a spec. */
export const zipNameOf = (spec: typeof SPEC): string => zipName(bundleOf(spec));
/** The zip bytes the page must produce for a spec. */
export const zipOf = (spec: typeof SPEC): Uint8Array => zipBundle(bundleOf(spec));

export const sha256Hex = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

/** The entries of a downloaded zip, in the zip's order. */
export function entriesOf(zip: Uint8Array): { path: string; bytes: Uint8Array }[] {
  return Object.entries(unzipSync(zip)).map(([entryPath, bytes]) => ({ path: entryPath, bytes }));
}

export const exportButton = (page: Page): Locator =>
  page.getByRole("button", { name: "Export", exact: true });
export const exportDialog = (page: Page): Locator =>
  page.getByRole("dialog", { name: "Export", exact: true });
/** The dialog's polite status region. */
export const exportStatus = (page: Page): Locator => exportDialog(page).getByRole("status");
export const downloadButton = (page: Page): Locator =>
  exportDialog(page).getByRole("button", { name: /^Download /u });
export const closeButton = (page: Page): Locator =>
  exportDialog(page).getByRole("button", { name: "Close", exact: true });
export const copyButton = (page: Page, filePath: string): Locator =>
  exportDialog(page).getByRole("button", { name: `Copy ${filePath}`, exact: true });
export const previewToggle = (page: Page, filePath: string): Locator =>
  exportDialog(page).getByRole("button", { name: `Preview ${filePath}`, exact: true });
export const previewOf = (page: Page, filePath: string): Locator =>
  exportDialog(page).getByLabel(`Preview of ${filePath}`, { exact: true });
export const fileRows = (page: Page): Locator =>
  exportDialog(page).getByRole("list", { name: "Files", exact: true }).getByRole("listitem");
export const summaryItems = (page: Page): Locator =>
  exportDialog(page).getByRole("list", { name: "Summary", exact: true }).getByRole("listitem");
/** The lot line: `LOT <lot> · <name>`. */
export const lotLine = (page: Page): Locator => exportDialog(page).locator("[data-export-lot]");

/** Opens the dialog with its button and waits until it is ready (the file list is there). */
export async function openReady(page: Page): Promise<void> {
  await exportButton(page).click();
  await fileRows(page).first().waitFor();
}

/** The text of an element exactly, with no whitespace normalizing. */
export const rawText = (locator: Locator): Promise<string> =>
  locator.evaluate((element) => element.textContent ?? "");

/**
 * Records, on `window.__urlLog`, the order of `URL.createObjectURL`, an anchor's `click` and
 * `URL.revokeObjectURL` (F-EXP-10, F-EXP-RF2). `afterTick` is true when the call came in a task after
 * the one of the click.
 */
export async function recordObjectUrls(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type Entry = { op: "create" | "click" | "revoke"; url: string; afterTick?: boolean };
    const log: Entry[] = [];
    (window as unknown as { __urlLog: Entry[] }).__urlLog = log;
    let ticked = true;
    const create = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (object: Blob | MediaSource) => {
      const url = create(object);
      log.push({ op: "create", url });
      return url;
    };
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function patched(this: HTMLAnchorElement) {
      log.push({ op: "click", url: this.href });
      ticked = false;
      setTimeout(() => {
        ticked = true;
      }, 0);
      click.call(this);
    };
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (url: string) => {
      log.push({ op: "revoke", url, afterTick: ticked });
      revoke(url);
    };
  });
}

/** The object-URL log of `recordObjectUrls`. */
export const urlLog = (
  page: Page,
): Promise<{ op: "create" | "click" | "revoke"; url: string; afterTick?: boolean }[]> =>
  page.evaluate(
    () => (window as unknown as { __urlLog: { op: "create"; url: string }[] }).__urlLog,
  ) as never;

/** What the blocked dialog lists for a spec: its error findings, measured through `trunc4` and `fmt4` (section 9.2). */
export function failingRows(spec: typeof SPEC): string[] {
  return lintSpec(spec)
    .filter((finding) => finding.severity === "error")
    .map(
      (finding) =>
        `${finding.subject}, ${finding.mode}: ${trunc4(finding.measured)} against ${fmt4(finding.threshold)}`,
    );
}

/** Sets the echo stub of `failingWorker`: the next request is answered with `spec`. */
export const echoNext = (page: Page, spec: typeof SPEC): Promise<void> =>
  page.evaluate((echo) => {
    (window as unknown as { __dyelotEcho: unknown }).__dyelotEcho = echo;
  }, spec);

/** Starts a download with the dialog's button and returns its file name and bytes. */
export async function download(page: Page): Promise<{ name: string; bytes: Uint8Array }> {
  const [event] = await Promise.all([page.waitForEvent("download"), downloadButton(page).click()]);
  const file = await event.path();
  return { name: event.suggestedFilename(), bytes: new Uint8Array(readFileSync(file)) };
}
