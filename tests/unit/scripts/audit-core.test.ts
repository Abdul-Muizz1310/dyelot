import { readFileSync } from "node:fs";
import path from "node:path";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  A11Y_FLOOR,
  AUDIT_ROUTES,
  a11yFailures,
  a11yVerdict,
  auditPlan,
  auditRecord,
  auditTable,
  CATEGORIES,
  categoryScores,
  FORM_FACTORS,
  median,
  routeName,
  scriptTotals,
  ttfbPlan,
} from "../../../scripts/audit-core.mjs";

// C-AUD6-01 to C-AUD6-08 of docs/specs/06-gallery.md, section 14.10 (R6-44 to R6-48, R-05): the
// audit's pure arithmetic. The two fixtures are real Lighthouse 13.5.0 reports of two scratch pages,
// trimmed to the fields the audit reads, their URLs moved to localhost:3100. lhr-fail.json's
// accessibility score is set to the spec's 0.88 (the scratch page scored 0.76), and its
// `empty-heading` audit (weight 0) is set to fail, so a weight-0 failure is in the report.

type Report = {
  categories: Record<string, { score: number | null; auditRefs: { id: string; weight: number }[] }>;
  audits: Record<string, { score: number | null; numericValue?: number }>;
  [key: string]: unknown;
};

const read = (name: string): Report =>
  JSON.parse(readFileSync(path.join(import.meta.dirname, "fixtures", name), "utf8"));
const PASS = read("lhr-pass.json");
const FAIL = read("lhr-fail.json");

/** A value of the wrong type or domain, passed where the types forbid it. */
const bad = (value: unknown) => value as never;

/** Fails unless `run` throws `kind` with a message that starts with `name` and a colon. */
function expectThrow(run: () => unknown, kind: ErrorConstructor, name: string) {
  let caught: unknown;
  try {
    run();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(kind);
  expect((caught as Error).message).toMatch(new RegExp(`^${name}: `));
}

describe("the audit's constants and route names", () => {
  it("C-AUD6-01 holds R6-44's routes, form factors, floor and categories, frozen", () => {
    expect(AUDIT_ROUTES).toEqual([
      "/",
      "/gallery",
      "/gallery/madder",
      "/about",
      "/studio",
      "/explore",
      "/motion",
      "/connect",
    ]);
    expect(FORM_FACTORS).toEqual(["desktop", "mobile"]);
    expect(A11Y_FLOOR).toBe(0.95);
    expect(CATEGORIES).toEqual(["performance", "accessibility", "best-practices", "seo"]);
    for (const list of [AUDIT_ROUTES, FORM_FACTORS, CATEGORIES]) {
      expect(Object.isFrozen(list)).toBe(true);
    }
  });

  it("C-AUD6-01 names each route as its record file does", () => {
    expect(AUDIT_ROUTES.map((route) => routeName(route))).toEqual([
      "home",
      "gallery",
      "gallery-madder",
      "about",
      "studio",
      "explore",
      "motion",
      "connect",
    ]);
  });
});

describe("reading a passing report", () => {
  const SCORES = { performance: 1, accessibility: 1, "best-practices": 0.96, seo: 1 };

  it("C-AUD6-02 gives the four category scores", () => {
    expect(categoryScores(PASS)).toEqual(SCORES);
  });

  it("C-AUD6-02 gives 12.2's record: the five metrics, the script row and the console errors", () => {
    expect(auditRecord(PASS)).toEqual({
      url: "http://localhost:3100/",
      formFactor: "desktop",
      lighthouseVersion: "13.5.0",
      fetchTime: "2026-11-07T10:22:19.723Z",
      scores: SCORES,
      metrics: {
        fcp: 202.6355,
        lcp: 319.27099999999996,
        tbt: 28.5,
        cls: 0,
        si: 387.62100416597264,
      },
      scripts: { requests: 1, transferSize: 204 },
      consoleErrors: [
        {
          source: "console.error",
          description: "a test error",
          sourceLocation: {
            type: "source-location",
            url: "http://localhost:3100/app.js",
            urlProvider: "network",
            line: 0,
            column: 8,
          },
        },
      ],
    });
  });

  it("C-AUD6-02 records what Lighthouse could not measure as null, never as zero or none", () => {
    const report = structuredClone(PASS);
    delete report.audits["largest-contentful-paint"]?.numericValue;
    delete report.audits["resource-summary"];
    delete report.audits["errors-in-console"];
    report.categories.performance = { score: null, auditRefs: [] };
    const record = auditRecord(report);
    expect(record.scores.performance).toBeNull();
    expect(record.metrics.lcp).toBeNull();
    expect(record.metrics.fcp).toBe(202.6355);
    expect(record.scripts).toBeNull();
    expect(record.consoleErrors).toBeNull();
  });

  it("C-AUD6-02 finds no accessibility failure and passes the verdict", () => {
    expect(a11yFailures(PASS)).toEqual([]);
    expect(a11yVerdict(PASS)).toEqual({ pass: true, score: 1, failures: [] });
  });
});

describe("reading a failing report", () => {
  it("C-AUD6-03 fails the verdict at 0.88 with button-name and color-contrast", () => {
    expect(a11yVerdict(FAIL)).toEqual({
      pass: false,
      score: 0.88,
      failures: ["button-name", "color-contrast"],
    });
    expect(a11yFailures(FAIL)).toEqual(["button-name", "color-contrast"]);
  });

  it("C-AUD6-03 lists no failing audit of weight 0 and no audit without a score", () => {
    const refs = FAIL.categories.accessibility?.auditRefs ?? [];
    expect(refs.find((ref) => ref.id === "empty-heading")?.weight).toBe(0);
    expect(FAIL.audits["empty-heading"]?.score).toBe(0);
    expect(refs.filter((ref) => FAIL.audits[ref.id]?.score === null).length).toBeGreaterThan(0);
    expect(a11yFailures(FAIL)).not.toContain("empty-heading");
  });

  it("C-AUD6-03 passes at the floor and fails below it", () => {
    const at = (score: number) => {
      const report = structuredClone(FAIL);
      (report.categories.accessibility as { score: number }).score = score;
      return a11yVerdict(report).pass;
    };
    expect(at(A11Y_FLOOR)).toBe(true);
    expect(at(0.9499)).toBe(false);
  });
});

describe("refusing a report the audit cannot read", () => {
  const READERS = { categoryScores, auditRecord, a11yFailures, a11yVerdict } as const;
  const { categories: _categories, ...withoutCategories } = PASS;
  const withRuntimeError = {
    ...structuredClone(PASS),
    runtimeError: { code: "ERRORED_DOCUMENT_REQUEST", message: "The page answered 404." },
  };
  const nullAccessibility = structuredClone(PASS);
  (nullAccessibility.categories.accessibility as { score: number | null }).score = null;
  const noAccessibilityAudits = structuredClone(PASS);
  delete (noAccessibilityAudits.categories.accessibility as { auditRefs?: unknown }).auditRefs;

  for (const [name, reader] of Object.entries(READERS)) {
    it(`C-AUD6-04 ${name} is a TypeError for null and a report that is not an object`, () => {
      expectThrow(() => reader(bad(null)), TypeError, name);
      expectThrow(() => reader(bad("report")), TypeError, name);
      expectThrow(() => reader(bad([PASS])), TypeError, name);
    });

    it(`C-AUD6-04 ${name} is a RangeError without categories, with a runtimeError or a null accessibility score`, () => {
      expectThrow(() => reader(withoutCategories), RangeError, name);
      expectThrow(() => reader(withRuntimeError), RangeError, name);
      expectThrow(() => reader(nullAccessibility), RangeError, name);
      expectThrow(() => reader(noAccessibilityAudits), RangeError, name);
    });
  }
});

describe("the interleaved plans", () => {
  it("C-AUD6-05 auditPlan visits every route at both form factors per run, run by run", () => {
    const once = [
      { route: "/a", formFactor: "desktop" },
      { route: "/a", formFactor: "mobile" },
      { route: "/b", formFactor: "desktop" },
      { route: "/b", formFactor: "mobile" },
    ];
    const plan = auditPlan(["/a", "/b"], ["desktop", "mobile"], 3);
    expect(plan).toHaveLength(12);
    expect(plan).toEqual([1, 2, 3].flatMap((run) => once.map((item) => ({ run, ...item }))));
  });

  it("C-AUD6-05 ttfbPlan gives each round every path in order", () => {
    const plan = ttfbPlan(["/", "/r", "/g"], 10);
    expect(plan).toHaveLength(30);
    expect(plan.slice(0, 6)).toEqual([
      { round: 1, path: "/" },
      { round: 1, path: "/r" },
      { round: 1, path: "/g" },
      { round: 2, path: "/" },
      { round: 2, path: "/r" },
      { round: 2, path: "/g" },
    ]);
    expect(plan).toEqual(
      Array.from({ length: 10 }, (_, at) => at + 1).flatMap((round) =>
        ["/", "/r", "/g"].map((path) => ({ round, path })),
      ),
    );
  });
});

describe("refusing what the helpers cannot use", () => {
  it("C-AUD6-06 auditPlan refuses no routes or form factors and a runs outside 1 to 10", () => {
    expectThrow(() => auditPlan([], FORM_FACTORS, 3), RangeError, "auditPlan");
    expectThrow(() => auditPlan(AUDIT_ROUTES, [], 3), RangeError, "auditPlan");
    expectThrow(() => auditPlan(AUDIT_ROUTES, FORM_FACTORS, 0), RangeError, "auditPlan");
    expectThrow(() => auditPlan(AUDIT_ROUTES, FORM_FACTORS, 11), RangeError, "auditPlan");
    expectThrow(() => auditPlan(AUDIT_ROUTES, FORM_FACTORS, 1.5), RangeError, "auditPlan");
    expectThrow(() => auditPlan(bad("/"), FORM_FACTORS, 3), TypeError, "auditPlan");
    expectThrow(() => auditPlan(AUDIT_ROUTES, bad(null), 3), TypeError, "auditPlan");
    expectThrow(() => auditPlan(AUDIT_ROUTES, FORM_FACTORS, bad("3")), TypeError, "auditPlan");
  });

  it("C-AUD6-06 median refuses an empty list and a value that is not a finite number", () => {
    expectThrow(() => median([]), RangeError, "median");
    expectThrow(() => median([1, Number.NaN]), RangeError, "median");
    expectThrow(() => median([1, Number.POSITIVE_INFINITY]), RangeError, "median");
    expectThrow(() => median([bad("1")]), RangeError, "median");
    expectThrow(() => median(bad(null)), TypeError, "median");
  });

  it("C-AUD6-06 scriptTotals refuses a non-array and a response without numeric sizes", () => {
    expectThrow(() => scriptTotals(bad(null)), TypeError, "scriptTotals");
    expectThrow(
      () => scriptTotals([bad({ bytes: "1", transferred: 1 })]),
      RangeError,
      "scriptTotals",
    );
    expectThrow(() => scriptTotals([bad({ bytes: 1 })]), RangeError, "scriptTotals");
    expectThrow(() => scriptTotals([bad(null)]), RangeError, "scriptTotals");
  });

  it("C-AUD6-06 ttfbPlan refuses no paths and a rounds outside 1 to 100", () => {
    expectThrow(() => ttfbPlan([], 10), RangeError, "ttfbPlan");
    expectThrow(() => ttfbPlan(["/"], 0), RangeError, "ttfbPlan");
    expectThrow(() => ttfbPlan(["/"], 101), RangeError, "ttfbPlan");
    expectThrow(() => ttfbPlan(["/"], 2.5), RangeError, "ttfbPlan");
    expectThrow(() => ttfbPlan(bad("/"), 10), TypeError, "ttfbPlan");
    expectThrow(() => ttfbPlan(["/"], bad("10")), TypeError, "ttfbPlan");
  });

  it("C-AUD6-06 routeName refuses a non-string and a route without its leading slash", () => {
    expectThrow(() => routeName(bad(3)), TypeError, "routeName");
    expectThrow(() => routeName("gallery"), RangeError, "routeName");
  });

  it("C-AUD6-06 auditTable refuses a non-array, a row that is not one of its tables and a stray route", () => {
    const measured = {
      table: "measured",
      date: "2026-11-07",
      base: "https://dyelot.vercel.app",
      load: { before: 1, after: 2 },
    } as const;
    const weight = {
      table: "weight",
      route: "/",
      scripts: 1,
      scriptBytes: 1,
      scriptTransferred: 1,
      htmlBytes: 1,
      htmlTransferred: 1,
    } as const;
    expectThrow(() => auditTable(bad(null)), TypeError, "auditTable");
    expectThrow(() => auditTable([measured, bad(null)]), TypeError, "auditTable");
    expectThrow(() => auditTable([measured, bad({ table: "speed" })]), RangeError, "auditTable");
    expectThrow(() => auditTable([weight]), RangeError, "auditTable");
    expectThrow(() => auditTable([measured, measured, weight]), RangeError, "auditTable");
    expectThrow(() => auditTable([measured, { ...weight, route: "/x" }]), RangeError, "auditTable");
    expectThrow(() => auditTable([measured, weight, weight]), RangeError, "auditTable");
    expectThrow(
      () => auditTable([measured, { ...weight, scriptBytes: Number.NaN }]),
      RangeError,
      "auditTable",
    );
  });

  describe("auditTable's field types", () => {
    const measured = {
      table: "measured",
      date: "2026-11-07",
      base: "https://dyelot.vercel.app",
      load: { before: 1, after: 2 },
    } as const;
    const lighthouse = {
      table: "lighthouse",
      route: "/",
      formFactor: "desktop",
      scores: { performance: 1, accessibility: 1, "best-practices": 1, seo: null },
      lcp: 1,
      tbt: 1,
      cls: 0,
    } as const;
    const firstByte = { table: "first-byte", path: "/", ms: 1, over: 0 } as const;
    const weight = {
      table: "weight",
      route: "/",
      scripts: 1,
      scriptBytes: 1,
      scriptTransferred: 1,
      htmlBytes: 1,
      htmlTransferred: 1,
    } as const;

    it("C-AUD6-06 auditTable is a TypeError for a field of the wrong type in any table", () => {
      expect(auditTable([measured, lighthouse, firstByte, weight])).toContain("| `/` | desktop |");
      const cases: [string, unknown[]][] = [
        ["a table that is not a string", [measured, { table: 3 }]],
        ["a date that is not a string", [{ ...measured, date: 20261107 }]],
        ["a base that is not a string", [{ ...measured, base: null }]],
        ["a load that is not an object", [{ ...measured, load: "1.4" }]],
        ["a load average that is not a number", [{ ...measured, load: { before: "1", after: 2 } }]],
        ["no scores", [measured, { ...lighthouse, scores: undefined }]],
        [
          "a score that is a string",
          [measured, { ...lighthouse, scores: { ...lighthouse.scores, seo: "1" } }],
        ],
        ["a route that is not a string", [measured, { ...lighthouse, route: 1 }]],
        ["a form factor that is not a string", [measured, { ...lighthouse, formFactor: null }]],
        ["a metric that is a string", [measured, { ...lighthouse, lcp: "1" }]],
        ["a first byte that is not a number", [measured, { ...firstByte, ms: "1" }]],
        ["a size that is a string", [measured, { ...weight, scriptBytes: "1" }]],
        ["a script count that is missing", [measured, { ...weight, scripts: undefined }]],
      ];
      for (const [what, rows] of cases) {
        expect(() => auditTable(bad(rows)), what).toThrow(TypeError);
        expectThrow(() => auditTable(bad(rows)), TypeError, "auditTable");
      }
    });

    it("C-AUD6-06 auditTable checks every row's types before any row's values", () => {
      expectThrow(
        () =>
          auditTable([
            { ...weight, route: "/x" },
            { ...measured, load: bad("1.4") },
          ]),
        TypeError,
        "auditTable",
      );
      expectThrow(
        () => auditTable([bad({ table: "speed" }), { ...weight, scriptBytes: bad("1") }, measured]),
        TypeError,
        "auditTable",
      );
      expectThrow(
        () => auditTable([measured, measured, { ...lighthouse, scores: bad(null) }]),
        TypeError,
        "auditTable",
      );
    });
  });
});

describe("the medians, the totals and the README tables", () => {
  it("C-AUD6-07 median takes the middle value, or the mean of the two middle ones", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([7])).toBe(7);
  });

  it("C-AUD6-07 scriptTotals counts the files and sums the decoded and transferred bytes", () => {
    expect(
      scriptTotals([
        { bytes: 1000, transferred: 400 },
        { bytes: 2500, transferred: 900 },
        { bytes: 0, transferred: 0 },
      ]),
    ).toEqual({ files: 3, bytes: 3500, transferred: 1300 });
    expect(scriptTotals([])).toEqual({ files: 0, bytes: 0, transferred: 0 });
  });

  it("C-AUD6-07 auditTable gives 12.4's three tables, rounded only there, rows in AUDIT_ROUTES order", () => {
    const table = auditTable([
      {
        table: "weight",
        route: "/studio",
        scripts: 14,
        scriptBytes: 1_234_567,
        scriptTransferred: 345_678,
        htmlBytes: 45_678,
        htmlTransferred: 12_345,
      },
      {
        table: "lighthouse",
        route: "/studio",
        formFactor: "mobile",
        scores: { performance: 0.416, accessibility: 0.97, "best-practices": 1, seo: 1 },
        lcp: 5321.6,
        tbt: 812.49,
        cls: 0.0123,
      },
      { table: "first-byte", path: "/", ms: 212.6, over: 120.4 },
      {
        table: "measured",
        date: "2026-11-07",
        base: "https://dyelot.vercel.app",
        load: { before: 1.416, after: 2.834 },
      },
      {
        table: "lighthouse",
        route: "/",
        formFactor: "mobile",
        scores: { performance: 0.71, accessibility: 1, "best-practices": 0.96, seo: 1 },
        lcp: 2400.2,
        tbt: 150.7,
        cls: 0,
      },
      {
        table: "lighthouse",
        route: "/",
        formFactor: "desktop",
        scores: { performance: 0.987, accessibility: 1, "best-practices": 0.96, seo: null },
        lcp: 812.4,
        tbt: 0,
        cls: 0,
      },
      { table: "first-byte", path: "/robots.txt", ms: 92.2, over: 0 },
      { table: "first-byte", path: "/gallery", ms: 230.7, over: 138.3 },
      {
        table: "weight",
        route: "/",
        scripts: 9,
        scriptBytes: 512_000,
        scriptTransferred: 160_049,
        htmlBytes: 30_960,
        htmlTransferred: 8_049,
      },
    ]);
    const context = "https://dyelot.vercel.app, load average 1.42 before and 2.83 after.";
    expect(table).toBe(
      [
        "#### Measured on 2026-11-07: Lighthouse medians",
        "",
        context,
        "",
        "| Route | Form factor | Performance | Accessibility | Best practices | SEO | LCP (ms) | TBT (ms) | CLS |",
        "|---|---|---|---|---|---|---|---|---|",
        "| `/` | desktop | 99 | 100 | 96 | n/a | 812 | 0 | 0.000 |",
        "| `/` | mobile | 71 | 100 | 96 | 100 | 2400 | 151 | 0.000 |",
        "| `/studio` | mobile | 42 | 97 | 100 | 100 | 5322 | 812 | 0.012 |",
        "",
        "#### Measured on 2026-11-07: first-byte medians",
        "",
        context,
        "",
        "| Path | First byte (ms) | Over `/robots.txt` (ms) |",
        "|---|---|---|",
        "| `/` | 213 | 120 |",
        "| `/robots.txt` | 92 | 0 |",
        "| `/gallery` | 231 | 138 |",
        "",
        "#### Measured on 2026-11-07: page weight up to the load event",
        "",
        context,
        "",
        "| Route | Scripts | Script KB decoded | Script KB transferred | HTML KB decoded | HTML KB transferred |",
        "|---|---|---|---|---|---|",
        "| `/` | 9 | 512.0 | 160.0 | 31.0 | 8.0 |",
        "| `/studio` | 14 | 1234.6 | 345.7 | 45.7 | 12.3 |",
      ].join("\n"),
    );
  });
});

describe("the median's property", () => {
  /** The mean of two values, each halved first when their sum overflows. */
  const mean = (low: number, high: number) =>
    Number.isFinite(low + high) ? (low + high) / 2 : low / 2 + high / 2;

  it("C-AUD6-08 lies between the minimum and the maximum and is the sorted array's middle", () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ noNaN: true, noDefaultInfinity: true }), { minLength: 1 }),
        (values) => {
          const result = median(values);
          const sorted = [...values].sort((a, b) => a - b);
          const middle = Math.floor(sorted.length / 2);
          expect(result).toBeGreaterThanOrEqual(sorted[0] as number);
          expect(result).toBeLessThanOrEqual(sorted.at(-1) as number);
          expect(result).toBe(
            sorted.length % 2 === 1
              ? sorted[middle]
              : mean(sorted[middle - 1] as number, sorted[middle] as number),
          );
        },
      ),
      { numRuns: 500, seed: 6010 },
    );
    expect(median([Number.MAX_VALUE, Number.MAX_VALUE])).toBe(Number.MAX_VALUE);
  });
});
