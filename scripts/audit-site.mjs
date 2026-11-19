// @ts-check
// The deployed site's measures for the README (docs/specs/06-gallery.md, R6-46 to R6-48 and 12.4):
//   1. Lighthouse on every route at both form factors, `--runs` times, interleaved (auditPlan);
//   2. the first byte of `/`, `/robots.txt` and `/gallery`, ten interleaved rounds after one uncounted
//      request each (ttfbPlan), each from the request's start to its response headers;
//   3. each route's scripts and HTML document up to the `load` event, in a fresh Chromium context;
//   4. the machine's load average before and after, and the date.
// It writes test-results/audit-site/<YYYY-MM-DD>.json and prints auditTable's three tables. It is
// not a test, and it reaches the network: it measures the site it is given.
// Usage: node scripts/audit-site.mjs [--base <origin>] [--runs <n>]
import { mkdirSync, writeFileSync } from "node:fs";
import { loadavg } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { chromium } from "@playwright/test";
import {
  AUDIT_ROUTES,
  auditPlan,
  auditRecord,
  auditTable,
  baseOrigin,
  CATEGORIES,
  FORM_FACTORS,
  median,
  partialRecord,
  runPlan,
  scriptTotals,
  ttfbPlan,
} from "./audit-core.mjs";
import { runLighthouse } from "./lighthouse.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const USAGE = "usage: node scripts/audit-site.mjs [--base <origin>] [--runs <n>]";

/** The site and the number of Lighthouse runs per route and form factor (12.4). */
const DEFAULT_BASE = "https://dyelot.vercel.app";
const DEFAULT_RUNS = 3;

/** Two pages rendered per request and a static metadata route, in each round's order (R6-47). */
const FIRST_BYTE_PATHS = Object.freeze(["/", "/robots.txt", "/gallery"]);
/** The path whose first byte the pages' are measured against. */
const STATIC_PATH = "/robots.txt";
const FIRST_BYTE_ROUNDS = 10;

/**
 * @typedef {import("./audit-core.mjs").AuditRecord} AuditRecord
 * @typedef {import("./audit-core.mjs").AuditRow} AuditRow
 * @typedef {import("./audit-core.mjs").LighthouseRow} LighthouseRow
 * @typedef {import("./audit-core.mjs").WeightRow} WeightRow
 * @typedef {{ run: number, route: string, formFactor: string, record: AuditRecord }} LighthouseRun
 */

/**
 * Measures `base` and writes the record; returns the record's path and the README's tables, or
 * (R7-16) the partial record's path and the failure of a run that failed twice, before any other pass. The
 * routes and first-byte paths default to the spec's; each must answer 2xx, or the audit stops.
 * @param {{ base: string, runs: number, routes?: readonly string[], paths?: readonly string[] }} options
 */
export async function auditSite({ base, runs, routes = AUDIT_ROUTES, paths = FIRST_BYTE_PATHS }) {
  const date = localDate(new Date());
  const before = loadavg();
  const plan = auditPlan(routes, FORM_FACTORS, runs);
  const { records, failure, retried } = await runPlan(plan, (item) =>
    runLighthouse(new URL(item.route, base).href, item.formFactor).then((lhr) => {
      const record = auditRecord(lhr);
      console.error(
        `audit-site: run ${item.run}, ${item.route} at ${item.formFactor}, accessibility ${record.scores.accessibility}`,
      );
      return { ...item, record };
    }),
  );
  for (const { run, route, formFactor } of retried) {
    console.error(`audit-site: run ${run}, ${route} at ${formFactor} failed once; retrying`);
  }
  const directory = path.join(ROOT, "test-results", "audit-site");
  if (failure !== null) {
    mkdirSync(directory, { recursive: true });
    const file = path.join(directory, `${date}.partial.json`);
    const partial = partialRecord({
      date,
      base,
      runs,
      load: { before, after: loadavg() },
      records,
      failure,
    });
    writeFileSync(file, `${JSON.stringify(partial, null, 2)}\n`);
    return { file, table: null, failure };
  }
  const lighthouse = /** @type {LighthouseRun[]} */ (records);
  const firstByte = await firstBytes(base, paths);
  const weight = await pageWeights(base, routes);
  const after = loadavg();
  const medians = lighthouseMedians(lighthouse, routes);
  /** @type {AuditRow[]} */
  const rows = [
    { table: "measured", date, base, load: { before: before[0], after: after[0] } },
    ...medians,
    ...firstByte.medians.map(({ path: firstPath, ms, over }) => ({
      table: /** @type {const} */ ("first-byte"),
      path: firstPath,
      ms,
      over,
    })),
    ...weight,
  ];
  mkdirSync(directory, { recursive: true });
  const file = path.join(directory, `${date}.json`);
  const record = {
    date,
    base,
    runs,
    load: { before, after },
    lighthouse,
    medians,
    firstByte,
    weight,
  };
  writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
  return { file, table: auditTable(rows), failure: null };
}

/** The local date as YYYY-MM-DD. */
function localDate(/** @type {Date} */ now) {
  const pad = (/** @type {number} */ value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Each route's medians at each form factor over its runs, null where no run measured a value.
 * @param {readonly LighthouseRun[]} results
 * @param {readonly string[]} routes
 * @returns {LighthouseRow[]}
 */
function lighthouseMedians(results, routes) {
  return routes.flatMap((route) =>
    FORM_FACTORS.map((formFactor) => {
      const records = results
        .filter((result) => result.route === route && result.formFactor === formFactor)
        .map((result) => result.record);
      /** @param {(record: AuditRecord) => number | null} read */
      const middle = (read) => {
        const values = records.map(read).filter((value) => value !== null);
        return values.length === 0 ? null : median(values);
      };
      return {
        table: /** @type {const} */ ("lighthouse"),
        route,
        formFactor,
        scores: /** @type {LighthouseRow["scores"]} */ (
          Object.fromEntries(
            CATEGORIES.map((name) => [name, middle((record) => record.scores[name])]),
          )
        ),
        lcp: middle((record) => record.metrics.lcp),
        tbt: middle((record) => record.metrics.tbt),
        cls: middle((record) => record.metrics.cls),
      };
    }),
  );
}

/**
 * The time from a request's start to its response headers, in milliseconds (`fetch` resolves on
 * the headers); the body is read to the end before the next request.
 * @param {string} url
 */
async function timeToHeaders(url) {
  const start = performance.now();
  const response = await fetch(url, { cache: "no-store", redirect: "manual" });
  const ms = performance.now() - start;
  await response.arrayBuffer();
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return ms;
}

/**
 * The first-byte samples of `paths` by `ttfbPlan`, after one uncounted request per path, and each
 * path's median with its difference from `STATIC_PATH`'s (R6-47).
 * @param {string} base
 * @param {readonly string[]} paths
 */
async function firstBytes(base, paths) {
  for (const warm of paths) await timeToHeaders(new URL(warm, base).href);
  /** @type {{ round: number, path: string, ms: number }[]} */
  const samples = [];
  for (const { round, path: sampled } of ttfbPlan(paths, FIRST_BYTE_ROUNDS)) {
    samples.push({ round, path: sampled, ms: await timeToHeaders(new URL(sampled, base).href) });
  }
  const middle = (/** @type {string} */ wanted) =>
    median(samples.filter((sample) => sample.path === wanted).map((sample) => sample.ms));
  const staticMs = middle(STATIC_PATH);
  return {
    samples,
    medians: paths.map((measured) => {
      const ms = middle(measured);
      return { path: measured, ms, over: ms - staticMs };
    }),
  };
}

/**
 * Each route's scripts and HTML document up to the `load` event (R6-48), each route in a fresh
 * Chromium context: decoded bytes (the body's length) and transferred bytes (the response body's
 * size on the wire, `request.sizes().responseBodySize`).
 * @param {string} base
 * @param {readonly string[]} routes
 * @returns {Promise<WeightRow[]>}
 */
async function pageWeights(base, routes) {
  const browser = await chromium.launch();
  try {
    /** @type {WeightRow[]} */
    const weights = [];
    for (const route of routes) {
      const context = await browser.newContext();
      try {
        const page = await context.newPage();
        /** @type {import("@playwright/test").Response[]} */
        const responses = [];
        page.on("response", (response) => responses.push(response));
        const url = new URL(route, base).href;
        const document = await page.goto(url, { waitUntil: "load" });
        const loaded = [...responses];
        if (document === null || !document.ok()) {
          throw new Error(`${url} answered ${document?.status() ?? "nothing"}`);
        }
        const sizes = async (/** @type {import("@playwright/test").Response} */ response) => ({
          bytes: (await response.body()).length,
          transferred: (await response.request().sizes()).responseBodySize,
        });
        const scripts = scriptTotals(
          await Promise.all(
            loaded.filter((response) => response.request().resourceType() === "script").map(sizes),
          ),
        );
        const html = await sizes(document);
        weights.push({
          table: "weight",
          route,
          scripts: scripts.files,
          scriptBytes: scripts.bytes,
          scriptTransferred: scripts.transferred,
          htmlBytes: html.bytes,
          htmlTransferred: html.transferred,
        });
      } finally {
        await context.close();
      }
    }
    return weights;
  } finally {
    await browser.close();
  }
}

/**
 * The base origin and the run count from the command line, or a usage error.
 * @param {string[]} argv
 */
function options(argv) {
  const { values } = parseArgs({
    args: argv,
    options: { base: { type: "string" }, runs: { type: "string" } },
    strict: true,
    allowPositionals: false,
  });
  const base = baseOrigin(values.base ?? DEFAULT_BASE);
  const runs = values.runs === undefined ? DEFAULT_RUNS : Number(values.runs);
  if (!Number.isInteger(runs) || runs < 1 || runs > 10) {
    throw new RangeError(`--runs needs a whole number from 1 to 10, not "${values.runs}"`);
  }
  return { base, runs };
}

/** An error's message, for the one line the script prints. */
const messageOf = (/** @type {unknown} */ error) =>
  error instanceof Error ? error.message : String(error);

/**
 * Runs the audit for the command line `argv`; the exit code.
 * @param {string[]} argv
 */
async function main(argv) {
  let parsed;
  try {
    parsed = options(argv);
  } catch (error) {
    console.error(`audit-site: ${messageOf(error)}; ${USAGE}`);
    return 1;
  }
  const { file, table, failure } = await auditSite(parsed);
  if (failure !== null) {
    console.error(
      `audit-site: run ${failure.run}, ${failure.route} at ${failure.formFactor} failed twice: ${failure.message}; wrote ${path.relative(ROOT, file)}`,
    );
    return 1;
  }
  console.error(`audit-site: wrote ${path.relative(ROOT, file)}`);
  console.log(table);
  return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2)).catch((error) => {
    console.error(`audit-site: ${messageOf(error)}`);
    return 1;
  });
}
