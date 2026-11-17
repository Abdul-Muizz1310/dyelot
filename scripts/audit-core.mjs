// @ts-check
// The audit's pure arithmetic (docs/specs/06-gallery.md, R6-44 to R6-48, 5.6 and 12): the routes
// and form factors, what a Lighthouse report records and whether it passes the accessibility floor,
// the interleaved plans of the site audit, its medians and sums, and the README's tables. It
// imports nothing and reads no clock, file, network, environment or randomness: the shells
// (scripts/lighthouse.mjs, scripts/audit-site.mjs and tests/e2e/lighthouse-m6.spec.ts) do.

/**
 * @typedef {"desktop" | "mobile"} FormFactor
 * @typedef {"performance" | "accessibility" | "best-practices" | "seo"} Category
 *
 * @typedef {object} Report The parts of a Lighthouse result the audit reads.
 * @property {Record<string, { score?: number | null, auditRefs?: { id: string, weight: number }[] } | undefined>} categories
 * @property {Record<string, { score?: number | null, numericValue?: number, details?: { items?: Record<string, unknown>[] } } | undefined>} [audits]
 * @property {string} [finalDisplayedUrl]
 * @property {{ formFactor?: string }} [configSettings]
 * @property {string} [lighthouseVersion]
 * @property {string} [fetchTime]
 *
 * @typedef {{ performance: number | null, accessibility: number, "best-practices": number | null, seo: number | null }} Scores
 * @typedef {{ fcp: number | null, lcp: number | null, tbt: number | null, cls: number | null, si: number | null }} Metrics
 *
 * @typedef {object} AuditRecord R6-45's record of one run (12.2); null where Lighthouse measured nothing.
 * @property {string | null} url
 * @property {string | null} formFactor
 * @property {string | null} lighthouseVersion
 * @property {string | null} fetchTime
 * @property {Scores} scores
 * @property {Metrics} metrics
 * @property {{ requests: number, transferSize: number } | null} scripts
 * @property {Record<string, unknown>[] | null} consoleErrors
 *
 * @typedef {{ table: "measured", date: string, base: string, load: { before: number, after: number } }} MeasuredRow
 * @typedef {{ table: "lighthouse", route: string, formFactor: string, scores: Record<Category, number | null>, lcp: number | null, tbt: number | null, cls: number | null }} LighthouseRow
 * @typedef {{ table: "first-byte", path: string, ms: number, over: number }} FirstByteRow
 * @typedef {{ table: "weight", route: string, scripts: number, scriptBytes: number, scriptTransferred: number, htmlBytes: number, htmlTransferred: number }} WeightRow
 * @typedef {MeasuredRow | LighthouseRow | FirstByteRow | WeightRow} AuditRow
 */

/** The routes the gate and the site audit visit, in the README's order (R6-44). */
export const AUDIT_ROUTES = Object.freeze([
  "/",
  "/gallery",
  "/gallery/madder",
  "/about",
  "/studio",
  "/explore",
  "/motion",
  "/connect",
]);

/** Lighthouse's two form factors, desktop first (R6-44). */
export const FORM_FACTORS = /** @type {readonly FormFactor[]} */ (
  Object.freeze(["desktop", "mobile"])
);

/** The accessibility score each route must reach (R6-44). */
export const A11Y_FLOOR = 0.95;

/** The four categories each run records (R6-45). */
export const CATEGORIES = /** @type {readonly Category[]} */ (
  Object.freeze(["performance", "accessibility", "best-practices", "seo"])
);

/** The five metrics of 12.2, by their key in the record and their audit's id. */
const METRICS = /** @type {const} */ ([
  ["fcp", "first-contentful-paint"],
  ["lcp", "largest-contentful-paint"],
  ["tbt", "total-blocking-time"],
  ["cls", "cumulative-layout-shift"],
  ["si", "speed-index"],
]);

/**
 * @typedef {"string" | "number" | "number?" | "load" | "scores"} FieldType A row field's type: a
 * number or null ("number?"), the measured row's two load averages, or a run's four scores.
 */

/**
 * The README's tables, by a row's `table`, each with its fields' types (auditTable checks them all
 * before any value).
 * @type {Readonly<Record<string, Readonly<Record<string, FieldType>>>>}
 */
const ROW_FIELDS = Object.freeze({
  measured: { date: "string", base: "string", load: "load" },
  lighthouse: {
    route: "string",
    formFactor: "string",
    scores: "scores",
    lcp: "number?",
    tbt: "number?",
    cls: "number?",
  },
  "first-byte": { path: "string", ms: "number", over: "number" },
  weight: {
    route: "string",
    scripts: "number",
    scriptBytes: "number",
    scriptTransferred: "number",
    htmlBytes: "number",
    htmlTransferred: "number",
  },
});

/** Bytes in the README's KB. */
const KB = 1000;

/** A value's kind for an error message. */
function kind(/** @type {unknown} */ value) {
  if (value === null) return "null";
  return Array.isArray(value) ? "an array" : typeof value;
}

/**
 * The report `lhr` as a `Report`, or the error R-05 and 5.6 name: a TypeError for a value that is
 * not an object, a RangeError for a run that failed, a report without categories, or one without
 * an accessibility score and its audits.
 * @param {unknown} lhr
 * @param {string} caller
 * @returns {Report}
 */
function readReport(lhr, caller) {
  if (typeof lhr !== "object" || lhr === null || Array.isArray(lhr)) {
    throw new TypeError(`${caller}: the report must be an object, not ${kind(lhr)}`);
  }
  const { runtimeError, categories } = /** @type {Record<string, unknown>} */ (lhr);
  if (runtimeError !== undefined && runtimeError !== null) {
    const { code, message } = /** @type {{ code?: unknown, message?: unknown }} */ (runtimeError);
    throw new RangeError(`${caller}: Lighthouse reported a runtime error, ${code}: ${message}`);
  }
  if (typeof categories !== "object" || categories === null) {
    throw new RangeError(`${caller}: the report has no categories`);
  }
  const report = /** @type {Report} */ (lhr);
  const accessibility = report.categories.accessibility;
  if (typeof accessibility?.score !== "number" || !Array.isArray(accessibility.auditRefs)) {
    throw new RangeError(`${caller}: the report has no accessibility score and audits`);
  }
  return report;
}

/** The four category scores of `report`, null for a category it did not score. */
function scoresOf(/** @type {Report} */ report) {
  const score = (/** @type {Category} */ name) => report.categories[name]?.score ?? null;
  return {
    performance: score("performance"),
    accessibility: /** @type {number} */ (score("accessibility")),
    "best-practices": score("best-practices"),
    seo: score("seo"),
  };
}

/** The ids of the scored accessibility audits of `report` that fail, sorted. */
function failuresOf(/** @type {Report} */ report) {
  const refs = report.categories.accessibility?.auditRefs ?? [];
  return refs
    .filter(({ id, weight }) => {
      const score = report.audits?.[id]?.score;
      return weight > 0 && typeof score === "number" && score < 1;
    })
    .map(({ id }) => id)
    .sort();
}

/**
 * The route's name in a record's file name: "/" is "home", any other route its path without the
 * first slash, each further slash a hyphen ("/gallery/madder" is "gallery-madder").
 * @param {string} route
 */
export function routeName(route) {
  if (typeof route !== "string") {
    throw new TypeError(`routeName: the route must be a string, not ${kind(route)}`);
  }
  if (!route.startsWith("/")) {
    throw new RangeError(`routeName: the route "${route}" does not start with a slash`);
  }
  return route === "/" ? "home" : route.slice(1).replaceAll("/", "-");
}

/**
 * The four category scores of a Lighthouse report, each 0 to 1; accessibility is always a number,
 * another category Lighthouse could not score is null.
 * @param {unknown} lhr
 * @returns {Scores}
 */
export function categoryScores(lhr) {
  return scoresOf(readReport(lhr, "categoryScores"));
}

/**
 * R6-45's record of one run (12.2): the scores, the five metrics' `numericValue`s, the
 * `resource-summary` audit's script row and the `errors-in-console` audit's items. A metric, the
 * row or the list that Lighthouse did not produce is null, so a missing measure never reads as zero.
 * @param {unknown} lhr
 * @returns {AuditRecord}
 */
export function auditRecord(lhr) {
  const report = readReport(lhr, "auditRecord");
  const audits = report.audits ?? {};
  const metric = (/** @type {string} */ id) => {
    const value = audits[id]?.numericValue;
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  };
  const script = audits["resource-summary"]?.details?.items?.find(
    (item) => item.resourceType === "script",
  );
  const consoleErrors = audits["errors-in-console"]?.details?.items;
  return {
    url: report.finalDisplayedUrl ?? null,
    formFactor: report.configSettings?.formFactor ?? null,
    lighthouseVersion: report.lighthouseVersion ?? null,
    fetchTime: report.fetchTime ?? null,
    scores: scoresOf(report),
    metrics: /** @type {Metrics} */ (
      Object.fromEntries(METRICS.map(([key, id]) => [key, metric(id)]))
    ),
    scripts:
      script === undefined
        ? null
        : {
            requests: /** @type {number} */ (script.requestCount),
            transferSize: /** @type {number} */ (script.transferSize),
          },
    consoleErrors: Array.isArray(consoleErrors) ? [...consoleErrors] : null,
  };
}

/**
 * The ids of the accessibility audits that fail (score below 1) and count toward the score (weight
 * above 0), sorted. An audit Lighthouse did not score (null) is not a failure.
 * @param {unknown} lhr
 * @returns {string[]}
 */
export function a11yFailures(lhr) {
  return failuresOf(readReport(lhr, "a11yFailures"));
}

/**
 * Whether a report reaches the accessibility floor, with its score and failing audits.
 * @param {unknown} lhr
 * @returns {{ pass: boolean, score: number, failures: string[] }}
 */
export function a11yVerdict(lhr) {
  const report = readReport(lhr, "a11yVerdict");
  const score = scoresOf(report).accessibility;
  return { pass: score >= A11Y_FLOOR, score, failures: failuresOf(report) };
}

/**
 * Checks a list argument and a whole-number count argument, types before values (R-05).
 * @param {string} caller
 * @param {[name: string, value: unknown][]} lists
 * @param {[name: string, value: unknown, max: number]} count
 */
function checkPlan(caller, lists, [countName, count, max]) {
  for (const [name, value] of lists) {
    if (!Array.isArray(value)) {
      throw new TypeError(`${caller}: ${name} must be an array, not ${kind(value)}`);
    }
  }
  if (typeof count !== "number") {
    throw new TypeError(`${caller}: ${countName} must be a number, not ${kind(count)}`);
  }
  for (const [name, value] of lists) {
    if (/** @type {unknown[]} */ (value).length === 0) {
      throw new RangeError(`${caller}: ${name} is empty`);
    }
  }
  if (!Number.isInteger(count) || count < 1 || count > max) {
    throw new RangeError(
      `${caller}: ${countName} must be a whole number from 1 to ${max}, not ${count}`,
    );
  }
}

/**
 * The site audit's Lighthouse runs, interleaved (R6-46): run 1 visits every route at every form
 * factor, routes then form factors, then run 2 does, and so on.
 * @param {readonly string[]} routes
 * @param {readonly FormFactor[]} formFactors
 * @param {number} runs 1 to 10
 * @returns {{ run: number, route: string, formFactor: FormFactor }[]}
 */
export function auditPlan(routes, formFactors, runs) {
  checkPlan(
    "auditPlan",
    [
      ["routes", routes],
      ["formFactors", formFactors],
    ],
    ["runs", runs, 10],
  );
  return Array.from({ length: runs }, (_, at) => at + 1).flatMap((run) =>
    routes.flatMap((route) => formFactors.map((formFactor) => ({ run, route, formFactor }))),
  );
}

/**
 * The first-byte requests, interleaved (R6-47): each round every path in order.
 * @param {readonly string[]} paths
 * @param {number} rounds 1 to 100
 * @returns {{ round: number, path: string }[]}
 */
export function ttfbPlan(paths, rounds) {
  checkPlan("ttfbPlan", [["paths", paths]], ["rounds", rounds, 100]);
  return Array.from({ length: rounds }, (_, at) => at + 1).flatMap((round) =>
    paths.map((path) => ({ round, path })),
  );
}

/**
 * The middle value of the sorted values, or the mean of the two middle ones for an even count (each
 * halved first when their sum would overflow).
 * @param {readonly number[]} values finite numbers, at least one
 */
export function median(values) {
  if (!Array.isArray(values)) {
    throw new TypeError(`median: the values must be an array, not ${kind(values)}`);
  }
  if (values.length === 0) throw new RangeError("median: there are no values");
  for (const value of values) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new RangeError(`median: ${String(value)} is not a finite number`);
    }
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return /** @type {number} */ (sorted[middle]);
  const low = /** @type {number} */ (sorted[middle - 1]);
  const high = /** @type {number} */ (sorted[middle]);
  return Number.isFinite(low + high) ? (low + high) / 2 : low / 2 + high / 2;
}

/**
 * The script responses of one page load summed (R6-48): how many, their decoded bytes and their
 * transferred bytes.
 * @param {readonly { bytes: number, transferred: number }[]} responses
 */
export function scriptTotals(responses) {
  if (!Array.isArray(responses)) {
    throw new TypeError(`scriptTotals: the responses must be an array, not ${kind(responses)}`);
  }
  let bytes = 0;
  let transferred = 0;
  for (const response of responses) {
    const sizes = /** @type {Record<string, unknown> | null} */ (response);
    if (
      typeof sizes !== "object" ||
      sizes === null ||
      !isSize(sizes.bytes) ||
      !isSize(sizes.transferred)
    ) {
      throw new RangeError("scriptTotals: each response needs numeric bytes and transferred");
    }
    bytes += /** @type {number} */ (sizes.bytes);
    transferred += /** @type {number} */ (sizes.transferred);
  }
  return { files: responses.length, bytes, transferred };
}

/** Whether `value` is a byte count: a finite number, zero or more. */
function isSize(/** @type {unknown} */ value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/**
 * A finite number for a table cell, or the RangeError R-05 names.
 * @param {unknown} value
 * @param {string} what
 */
function finite(value, what) {
  if (typeof value !== "number") {
    throw new TypeError(`auditTable: ${what} must be a number, not ${kind(value)}`);
  }
  if (!Number.isFinite(value)) {
    throw new RangeError(`auditTable: ${what} is ${value}, not a finite number`);
  }
  return value;
}

/**
 * The TypeError R-05 names when a row's field `value` is not of `type`.
 * @param {unknown} value
 * @param {FieldType} type
 * @param {string} what
 */
function checkField(value, type, what) {
  /** @returns {never} */
  const wrong = (/** @type {string} */ wanted) => {
    throw new TypeError(`auditTable: ${what} must be ${wanted}, not ${kind(value)}`);
  };
  if (type === "string" && typeof value !== "string") wrong("a string");
  if (type === "number" && typeof value !== "number") wrong("a number");
  if (type === "number?" && value !== null && typeof value !== "number") wrong("a number or null");
  if (type === "load" || type === "scores") {
    if (typeof value !== "object" || value === null || Array.isArray(value)) wrong("an object");
    const fields = /** @type {Record<string, unknown>} */ (value);
    for (const key of type === "load" ? ["before", "after"] : CATEGORIES) {
      checkField(fields[key], type === "load" ? "number" : "number?", `${what}.${key}`);
    }
  }
}

/** A cell that may be null, which reads "n/a". */
function orNone(/** @type {unknown} */ value, /** @type {(value: unknown) => string} */ show) {
  return value === null ? "n/a" : show(value);
}

/**
 * 12.4's three Markdown tables for the README: Lighthouse medians, first-byte medians and page
 * weight, each headed "Measured on <date>" with the base and the load average. `rows` holds one
 * `measured` row and any number of the others. Scores are rounded to whole numbers from 0 to 100,
 * as Lighthouse shows them, times to whole milliseconds, CLS to three places and sizes to KB of
 * 1,000 bytes with one decimal, only here; the Lighthouse and weight rows follow `AUDIT_ROUTES` and
 * `FORM_FACTORS`, the first-byte rows keep their order.
 * @param {readonly AuditRow[]} rows
 */
export function auditTable(rows) {
  if (!Array.isArray(rows)) {
    throw new TypeError(`auditTable: the rows must be an array, not ${kind(rows)}`);
  }
  // Every row's types first (R-05), then any value.
  for (const row of rows) {
    if (typeof row !== "object" || row === null) {
      throw new TypeError(`auditTable: each row must be an object, not ${kind(row)}`);
    }
    if (typeof row.table !== "string") {
      throw new TypeError(`auditTable: a row's table must be a string, not ${kind(row.table)}`);
    }
    if (Object.hasOwn(ROW_FIELDS, row.table)) {
      const fields = /** @type {Record<string, unknown>} */ (row);
      for (const [field, type] of Object.entries(ROW_FIELDS[row.table] ?? {})) {
        checkField(fields[field], type, `the ${row.table} row's ${field}`);
      }
    }
  }
  const stray = rows.find((row) => !Object.hasOwn(ROW_FIELDS, row.table));
  if (stray !== undefined) {
    throw new RangeError(`auditTable: there is no table "${stray.table}"`);
  }
  const measured = /** @type {MeasuredRow[]} */ (rows.filter((row) => row.table === "measured"));
  if (measured.length !== 1) {
    throw new RangeError(`auditTable: the rows need one measured row, not ${measured.length}`);
  }
  const [{ date, base, load }] = /** @type {[MeasuredRow]} */ (measured);
  const before = finite(load.before, "the load before").toFixed(2);
  const after = finite(load.after, "the load after").toFixed(2);
  const context = `${base}, load average ${before} before and ${after} after.`;
  const heading = (/** @type {string} */ title) => [
    `#### Measured on ${date}: ${title}`,
    "",
    context,
    "",
  ];
  const lighthouse = ordered(
    /** @type {LighthouseRow[]} */ (rows.filter((row) => row.table === "lighthouse")),
    (row) => `${row.route} ${row.formFactor}`,
  );
  const weight = ordered(
    /** @type {WeightRow[]} */ (rows.filter((row) => row.table === "weight")),
    (row) => row.route,
  );
  const firstByte = /** @type {FirstByteRow[]} */ (
    rows.filter((row) => row.table === "first-byte")
  );
  const score = (/** @type {unknown} */ value) => {
    const number = finite(value, "a score");
    if (number < 0 || number > 1) {
      throw new RangeError(`auditTable: a score is ${number}, not 0 to 1`);
    }
    return String(Math.round(number * 100));
  };
  const ms = (/** @type {unknown} */ value) => String(Math.round(finite(value, "a time")));
  const kb = (/** @type {unknown} */ value) => (finite(value, "a size") / KB).toFixed(1);
  const line = (/** @type {string[]} */ cells) => `| ${cells.join(" | ")} |`;
  const rule = (/** @type {number} */ columns) => `|${"---|".repeat(columns)}`;
  return [
    ...heading("Lighthouse medians"),
    line([
      "Route",
      "Form factor",
      "Performance",
      "Accessibility",
      "Best practices",
      "SEO",
      "LCP (ms)",
      "TBT (ms)",
      "CLS",
    ]),
    rule(9),
    ...lighthouse.map((row) =>
      line([
        `\`${row.route}\``,
        row.formFactor,
        ...CATEGORIES.map((name) => orNone(row.scores[name], score)),
        orNone(row.lcp, ms),
        orNone(row.tbt, ms),
        orNone(row.cls, (value) => finite(value, "a CLS").toFixed(3)),
      ]),
    ),
    "",
    ...heading("first-byte medians"),
    line(["Path", "First byte (ms)", "Over `/robots.txt` (ms)"]),
    rule(3),
    ...firstByte.map((row) => line([`\`${row.path}\``, ms(row.ms), ms(row.over)])),
    "",
    ...heading("page weight up to the load event"),
    line([
      "Route",
      "Scripts",
      "Script KB decoded",
      "Script KB transferred",
      "HTML KB decoded",
      "HTML KB transferred",
    ]),
    rule(6),
    ...weight.map((row) =>
      line([
        `\`${row.route}\``,
        String(finite(row.scripts, "a script count")),
        kb(row.scriptBytes),
        kb(row.scriptTransferred),
        kb(row.htmlBytes),
        kb(row.htmlTransferred),
      ]),
    ),
  ].join("\n");
}

/**
 * `rows` in `AUDIT_ROUTES` order, then `FORM_FACTORS` order where a row has a form factor; a route or
 * form factor outside them, or two rows with one `key`, is a RangeError.
 * @template {{ route: string, formFactor?: string }} Row
 * @param {Row[]} rows
 * @param {(row: Row) => string} key
 * @returns {Row[]}
 */
function ordered(rows, key) {
  const seen = new Set();
  for (const row of rows) {
    if (!AUDIT_ROUTES.includes(row.route)) {
      throw new RangeError(`auditTable: "${String(row.route)}" is not one of AUDIT_ROUTES`);
    }
    if (
      row.formFactor !== undefined &&
      !FORM_FACTORS.includes(/** @type {FormFactor} */ (row.formFactor))
    ) {
      throw new RangeError(`auditTable: "${String(row.formFactor)}" is not one of FORM_FACTORS`);
    }
    if (seen.has(key(row))) throw new RangeError(`auditTable: two rows hold ${key(row)}`);
    seen.add(key(row));
  }
  const rank = (/** @type {Row} */ row) =>
    AUDIT_ROUTES.indexOf(row.route) * FORM_FACTORS.length +
    (row.formFactor === undefined
      ? 0
      : FORM_FACTORS.indexOf(/** @type {FormFactor} */ (row.formFactor)));
  return [...rows].sort((a, b) => rank(a) - rank(b));
}
