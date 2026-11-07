import { expect } from "@playwright/test";
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
