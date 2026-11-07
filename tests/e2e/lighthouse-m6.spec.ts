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
