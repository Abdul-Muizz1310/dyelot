import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect } from "@playwright/test";
import {
  a11yFailures,
  auditRecord,
  type FormFactor,
  routeName,
} from "../../scripts/audit-core.mjs";
import { runLighthouse } from "../../scripts/lighthouse.mjs";
import { test } from "./flavor-support";

// The Lighthouse flows of docs/specs/06-gallery.md, section 14.10 (R6-44, 12.2), in the `lighthouse`
// project: it runs after every other flow, so no audit shares the CPU, with one retry, its tests in
// order and one at a time. The file sets no `use` (no device, no viewport): in the test runner a
// browser launch takes the running project's `use`, and Lighthouse's own screen emulation must hold
// (probe 1, R6-57).

test.setTimeout(180_000);

/** What `run` rejects with, or undefined when it resolves. */
async function rejection(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error;
  }
  return undefined;
}

/**
 * One audit (12.2): Lighthouse on the route at the form factor, the record written to
 * test-results/lighthouse/<routeName>-<formFactor>.json and attached, accessibility at least 0.95.
 */
async function auditRoute(
  route: string,
  formFactor: FormFactor,
  baseURL: string | undefined,
  testInfo: import("@playwright/test").TestInfo,
): Promise<void> {
  const lhr = await runLighthouse(new URL(route, baseURL).href, formFactor);
  const dir = path.join("test-results", "lighthouse");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${routeName(route)}-${formFactor}.json`);
  const body = JSON.stringify(auditRecord(lhr), null, 2);
  writeFileSync(file, body);
  await testInfo.attach(`${routeName(route)}-${formFactor}`, {
    body,
    contentType: "application/json",
  });
  expect(lhr.categories.accessibility.score, a11yFailures(lhr).join(", ")).toBeGreaterThanOrEqual(
    0.95,
  );
}

test("F-LH6-01 / at desktop: accessibility is at least 0.95", async ({ baseURL }, testInfo) => {
  await auditRoute("/", "desktop", baseURL, testInfo);
});

test("F-LH6-02 / at mobile: accessibility is at least 0.95", async ({ baseURL }, testInfo) => {
  await auditRoute("/", "mobile", baseURL, testInfo);
});

test("F-LH6-03 /gallery at desktop: accessibility is at least 0.95", async ({
  baseURL,
}, testInfo) => {
  await auditRoute("/gallery", "desktop", baseURL, testInfo);
});

test("F-LH6-04 /gallery at mobile: accessibility is at least 0.95", async ({
  baseURL,
}, testInfo) => {
  await auditRoute("/gallery", "mobile", baseURL, testInfo);
});

test("F-LH6-05 /gallery/madder at desktop: accessibility is at least 0.95", async ({
  baseURL,
}, testInfo) => {
  await auditRoute("/gallery/madder", "desktop", baseURL, testInfo);
});

test("F-LH6-06 /gallery/madder at mobile: accessibility is at least 0.95", async ({
  baseURL,
}, testInfo) => {
  await auditRoute("/gallery/madder", "mobile", baseURL, testInfo);
});

test("F-LH6-07 /about at desktop: accessibility is at least 0.95", async ({
  baseURL,
}, testInfo) => {
  await auditRoute("/about", "desktop", baseURL, testInfo);
});

test("F-LH6-08 /about at mobile: accessibility is at least 0.95", async ({ baseURL }, testInfo) => {
  await auditRoute("/about", "mobile", baseURL, testInfo);
});

test("F-LH6-09 /studio at desktop: accessibility is at least 0.95", async ({
  baseURL,
}, testInfo) => {
  await auditRoute("/studio", "desktop", baseURL, testInfo);
});

test("F-LH6-10 /studio at mobile: accessibility is at least 0.95", async ({
  baseURL,
}, testInfo) => {
  await auditRoute("/studio", "mobile", baseURL, testInfo);
});

test("F-LH6-11 /explore at desktop: accessibility is at least 0.95", async ({
  baseURL,
}, testInfo) => {
  await auditRoute("/explore", "desktop", baseURL, testInfo);
});

test("F-LH6-12 /explore at mobile: accessibility is at least 0.95", async ({
  baseURL,
}, testInfo) => {
  await auditRoute("/explore", "mobile", baseURL, testInfo);
});

test("F-LH6-13 /motion at desktop: accessibility is at least 0.95", async ({
  baseURL,
}, testInfo) => {
  await auditRoute("/motion", "desktop", baseURL, testInfo);
});

test("F-LH6-14 /motion at mobile: accessibility is at least 0.95", async ({
  baseURL,
}, testInfo) => {
  await auditRoute("/motion", "mobile", baseURL, testInfo);
});

test("F-LH6-15 /connect at desktop: accessibility is at least 0.95", async ({
  baseURL,
}, testInfo) => {
  await auditRoute("/connect", "desktop", baseURL, testInfo);
});

test("F-LH6-16 /connect at mobile: accessibility is at least 0.95", async ({
  baseURL,
}, testInfo) => {
  await auditRoute("/connect", "mobile", baseURL, testInfo);
});

test("F-LH6-17 refuses a form factor outside FORM_FACTORS and a non-string URL before any launch", async ({
  baseURL,
}) => {
  const launched: string[] = [];
  const launch = async (dir: string): Promise<never> => {
    launched.push(dir);
    throw new Error("the spy launches no browser");
  };
  const tablet = await rejection(() =>
    runLighthouse(new URL("/", baseURL).href, "tablet" as never, { launch }),
  );
  expect(tablet).toBeInstanceOf(RangeError);
  expect((tablet as Error).message).toMatch(/^runLighthouse: /);
  const number = await rejection(() => runLighthouse(5 as never, "desktop", { launch }));
  expect(number).toBeInstanceOf(TypeError);
  expect((number as Error).message).toMatch(/^runLighthouse: /);
  expect(launched).toEqual([]);
});

test("F-LH6-17 checks every option's type before any value, and both before any launch", async ({
  baseURL,
}) => {
  const launched: string[] = [];
  const launch = async (dir: string): Promise<never> => {
    launched.push(dir);
    throw new Error("the spy launches no browser");
  };
  const origin = new URL("/", baseURL).href;
  // Each bad type sits beside a bad value (the form factor "tablet"): the type is reported first.
  const typeCases: [string, unknown][] = [
    ["a timeout that is a string", { launch, timeoutMs: "60000" }],
    ["flags that are a string", { launch, args: "--force-prefers-reduced-motion" }],
    ["a flag that is not a string", { launch, args: [1] }],
    ["a launch that is not a function", { launch: "chromium" }],
    ["options that are null", null],
  ];
  for (const [what, options] of typeCases) {
    const error = await rejection(() => runLighthouse(origin, "tablet" as never, options as never));
    expect(error, what).toBeInstanceOf(TypeError);
    expect((error as Error).message, what).toMatch(/^runLighthouse: /);
  }
  for (const timeoutMs of [Number.NaN, 0, -1, Number.POSITIVE_INFINITY]) {
    const error = await rejection(() => runLighthouse(origin, "desktop", { launch, timeoutMs }));
    expect(error, String(timeoutMs)).toBeInstanceOf(RangeError);
    expect((error as Error).message, String(timeoutMs)).toMatch(/^runLighthouse: /);
  }
  expect(launched).toEqual([]);
});
