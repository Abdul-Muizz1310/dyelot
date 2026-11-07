// @ts-check
// Runs Lighthouse 13.5.0 on one URL in Playwright's bundled Chromium (docs/specs/06-gallery.md,
// R6-44 and 12.1): a persistent context opens a debugging port, whose number Chromium writes to
// <profile>/DevToolsActivePort, and Lighthouse's Node API drives the browser through it. Mobile is
// Lighthouse's default configuration, desktop its `desktopConfig`. Probe 1 (R6-57) ran it as written.
// In the test runner the launch takes the running project's `use`, so it runs from a project with
// no device options (the `lighthouse` project of playwright.config.ts).
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium } from "@playwright/test";
import lighthouse, { desktopConfig } from "lighthouse";
import { CATEGORIES, FORM_FACTORS } from "./audit-core.mjs";

/** How long Chromium has to write its debugging port, and how often the file is read. */
const PORT_WAIT_MS = 10_000;
const PORT_POLL_MS = 100;

/**
 * @typedef {{ headless: boolean, viewport: null, args: string[] }} LaunchOptions
 * @typedef {(dir: string, options: LaunchOptions) => Promise<{ close(): Promise<void> }>} Launch
 * @typedef {object} RunOptions
 * @property {number} [timeoutMs] How long the Lighthouse run may take; 120,000 by default.
 * @property {string[]} [args] Extra Chromium flags.
 * @property {Launch} [launch] Starts the browser; injectable so a test can see whether it ran.
 */

/**
 * The Lighthouse report (LHR) of `url` at `formFactor`. A non-string URL is a TypeError and a form
 * factor outside `FORM_FACTORS` a RangeError, both before any browser starts; the browser is closed
 * and its profile removed on every path.
 * @param {string} url
 * @param {import("./audit-core.mjs").FormFactor} formFactor
 * @param {RunOptions} [options]
 */
export async function runLighthouse(url, formFactor, options = {}) {
  const {
    timeoutMs = 120_000,
    args = [],
    launch = (dir, o) => chromium.launchPersistentContext(dir, o),
  } = options;
  if (typeof url !== "string") {
    throw new TypeError(`runLighthouse: the URL must be a string, not ${typeof url}`);
  }
  if (!FORM_FACTORS.includes(formFactor)) {
    throw new RangeError(
      `runLighthouse: the form factor must be one of ${FORM_FACTORS.join(", ")}, not ${String(formFactor)}`,
    );
  }
  const dir = mkdtempSync(join(tmpdir(), "dyelot-lh-"));
  try {
    const context = await launch(dir, {
      headless: true,
      viewport: null, // Playwright applies no viewport, so Lighthouse's own screen emulation holds
      args: ["--remote-debugging-port=0", ...args],
    });
    try {
      const port = await debuggingPort(dir);
      /** @type {import("lighthouse").Flags} */
      const flags = {
        port,
        output: "json",
        logLevel: "error",
        onlyCategories: [...CATEGORIES],
        maxWaitForLoad: 45_000,
      };
      const run = lighthouse(url, flags, formFactor === "desktop" ? desktopConfig : undefined);
      run.catch(() => {}); // a run that loses to the timeout rejects later; this keeps it from going unhandled
      const result = await withTimeout(run, timeoutMs);
      if (result === undefined) {
        throw new RangeError("runLighthouse: Lighthouse returned no result");
      }
      return result.lhr;
    } finally {
      await context.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * The debugging port Chromium wrote as the first line of `<dir>/DevToolsActivePort`, read until it
 * is there, for up to `PORT_WAIT_MS`.
 * @param {string} dir
 */
async function debuggingPort(dir) {
  const file = join(dir, "DevToolsActivePort");
  for (let waited = 0; waited <= PORT_WAIT_MS; waited += PORT_POLL_MS) {
    const port = existsSync(file) ? Number(readFileSync(file, "utf8").split("\n")[0]) : 0;
    if (Number.isInteger(port) && port > 0) return port;
    await sleep(PORT_POLL_MS);
  }
  throw new Error(`runLighthouse: Chromium wrote no debugging port in ${PORT_WAIT_MS} ms`);
}

/**
 * `promise`'s value, or a rejection once `ms` have passed without one.
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @returns {Promise<T>}
 */
async function withTimeout(promise, ms) {
  /** @type {NodeJS.Timeout | undefined} */
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`runLighthouse: Lighthouse took more than ${ms} ms`)),
      ms,
    );
  });
  try {
    return await Promise.race([promise, /** @type {Promise<never>} */ (timeout)]);
  } finally {
    clearTimeout(timer);
  }
}
