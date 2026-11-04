import { deflateRawSync } from "node:zlib";
import { expect, type Locator, type Page, type Response } from "@playwright/test";
import {
  type Density,
  type DirectionParams,
  generateSystem,
  type Mode,
  ROLE_NAMES,
} from "@/engine";
import { lotTag } from "@/features/studio/lot";
import { freshParams, resolveParams } from "@/features/studio/params";
import { type DesignSpec, normalizeSpec, specId } from "@/spec";
import { fnv1a64 } from "@/spec/hash";
import { densityVars, themeVars } from "@/theme/vars";

// Shared helpers for tests/e2e/studio.spec.ts, the flows of docs/specs/02-studio.md, sections 7.1
// to 7.3 and 7.9. The test computes in Node what the page must show, through the same pure modules.

/** The parameters of a fresh design: the `default` preset's, sRGB, pairing auto. */
export const FRESH: DirectionParams = freshParams();

/** The seed of the n-th draw of `stubSeeds`: `n.toString(36) + "0"` (F-KEY-02). */
export const seedOf = (n: number): string => `${n.toString(36)}0`;

/**
 * Wraps `crypto.getRandomValues` (F-KEY-02): a call on a `Uint32Array` of length 2, the seed draw of
 * R2-13 item 5 and only that, fills `[start + n, 0]` for its n-th call and counts the calls in
 * `window.__seedCalls`; other calls pass through.
 */
export async function stubSeeds(page: Page, start = 0): Promise<void> {
  await page.addInitScript((offset) => {
    const original = crypto.getRandomValues.bind(crypto);
    const counted = window as unknown as { __seedCalls: number };
    counted.__seedCalls = 0;
    crypto.getRandomValues = <T extends ArrayBufferView | null>(array: T): T => {
      if (array instanceof Uint32Array && array.length === 2) {
        counted.__seedCalls += 1;
        array[0] = offset + counted.__seedCalls;
        array[1] = 0;
        return array;
      }
      return original(array as never) as T;
    };
  }, start);
}

/** How many seeds the page has drawn through `stubSeeds`. */
export const seedCalls = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { __seedCalls: number }).__seedCalls);

const designs = new Map<string, DesignSpec>();

/** The design the studio generates for `params` and `seed`, as its store holds it. */
export function designFor(params: DirectionParams, seed: string): DesignSpec {
  const key = JSON.stringify([params, seed]);
  const hit = designs.get(key);
  if (hit !== undefined) return hit;
  const spec = normalizeSpec(generateSystem(resolveParams(params, seed), seed));
  designs.set(key, spec);
  return spec;
}

/** The lot tag's id for a spec: `lotTag(specId(spec))`. */
export const lotOf = (spec: DesignSpec): string => lotTag(specId(spec));

/** The 206 properties the canvas frame carries for a spec, a mode and a density. */
export function expectedVars(
  spec: DesignSpec,
  mode: Mode = "light",
  density: Density = "comfortable",
): Record<string, string> {
  return { ...themeVars(spec, mode, { units: "cqi" }), ...densityVars(density) };
}

/** The role variables of a set of canvas variables (the 46 roles of R2-17's promise). */
export function roleVars(vars: Record<string, string>): Record<string, string> {
  return Object.fromEntries(ROLE_NAMES.map((role) => [`--${role}`, vars[`--${role}`] ?? ""]));
}

/** The design of the first load when `stubSeeds` draws the seeds. */
export const first = (): DesignSpec => designFor(FRESH, seedOf(1));

export const button = (page: Page, name: string): Locator =>
  page.getByRole("button", { name, exact: true });
export const modeSwitch = (page: Page): Locator =>
  page.getByRole("switch", { name: "Dark mode", exact: true });
/** A radio of the canvas toolbar (section 7.4); the inputs panel repeats some groups (Density). */
export const toolbarRadio = (page: Page, groupName: string, name: string): Locator =>
  page
    .getByRole("region", { name: "Canvas toolbar" })
    .getByRole("group", { name: groupName, exact: true })
    .getByRole("radio", { name, exact: true });

export const canvasRegion = (page: Page): Locator => page.getByRole("main", { name: "Canvas" });
export const inputsPanel = (page: Page): Locator =>
  page.getByRole("complementary", { name: "Inputs" });
export const inspectorPanel = (page: Page): Locator =>
  page.getByRole("complementary", { name: "Inspector" });
/** The two landmarks by their element, for states where a closed drawer leaves the tree. */
export const inputsAside = (page: Page): Locator => page.locator('aside[aria-label="Inputs"]');
export const inspectorAside = (page: Page): Locator =>
  page.locator('aside[aria-label="Inspector"]');
export const lotId = (page: Page): Locator => page.locator("[data-lot-id]");

/** Waits until no generation is in flight: the canvas region drops `aria-busy`. */
export async function settled(page: Page): Promise<void> {
  await expect(canvasRegion(page)).not.toHaveAttribute("aria-busy", "true");
}

/** Opens the studio, with an optional hash, and waits for the first design. */
export async function openStudio(page: Page, hash = ""): Promise<Response> {
  const response = await page.goto(`/studio${hash}`);
  if (response === null) throw new Error("openStudio: no response");
  expect(response.status()).toBe(200);
  await ready(page);
  return response;
}

/**
 * The canvas frame: the `[data-canvas]` that carries the view's mode (section 7.4). The kitchen
 * sink adds two more `[data-canvas]` panes inside it, one per mode (section 7.5).
 */
export const canvasFrame = (page: Page): Locator => page.locator("[data-canvas][data-frame]");

/** A kitchen-sink pane, the `[data-canvas]` of one mode (section 7.5). */
export const canvasPane = (page: Page, mode: Mode): Locator =>
  page.locator(`[data-canvas][data-pane="${mode}"]`);

/** Waits until the studio shows its first design. */
export async function ready(page: Page): Promise<void> {
  await expect(canvasFrame(page)).toBeAttached();
  await expect(lotId(page)).toHaveText(/^[0-9a-f]{4}·[0-9a-f]{4}$/);
  await settled(page);
}

/** The custom properties set inline on the canvas frame, or on `target` (a kitchen-sink pane). */
export function canvasVars(
  page: Page,
  target: Locator = canvasFrame(page),
): Promise<Record<string, string>> {
  return target.evaluate((frame) => {
    const style = (frame as HTMLElement).style;
    const vars: Record<string, string> = {};
    for (let i = 0; i < style.length; i++) {
      const name = style.item(i);
      if (name.startsWith("--")) vars[name] = style.getPropertyValue(name).trim();
    }
    return vars;
  });
}

/** Takes focus off every control, so a key press targets the page body. */
export async function focusBody(page: Page): Promise<void> {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
}

/**
 * Sets a native color input the way its picker does: the value through the native setter, then an
 * `input` event, so React's change tracking sees a new value.
 */
export async function pickColor(input: Locator, hex: string): Promise<void> {
  await input.evaluate((element, value) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  }, hex);
}

/**
 * Replaces `window.Worker` with a subclass of the real worker (F-STUDIO-19, F-EXP-11):
 * - once the test sets `window.__dyelotFault`, every request is answered with a forced `RangeError`;
 *   until then the real worker answers;
 * - once the test sets `window.__dyelotEcho` to a spec, the next request is answered with `{ id, ok: true,
 *   spec }` of that spec, and every other request goes to the real worker (F-EXP-20);
 * - once the test sets `window.__dyelotHold` to true, the next reply, from this stub or from the real
 *   worker, is held until the test calls `window.__dyelotRelease()` (a release that comes first lets
 *   the reply through).
 */
export async function failingWorker(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const Real = window.Worker;
    const flags = window as unknown as {
      __dyelotFault: boolean;
      __dyelotEcho: unknown;
      __dyelotHold: boolean;
      __dyelotRelease(): void;
    };
    flags.__dyelotFault = false;
    flags.__dyelotEcho = null;
    flags.__dyelotHold = false;
    flags.__dyelotRelease = () => {};
    class FaultWorker extends Real {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        let held: MessageEvent | null = null;
        const released = new WeakSet<Event>();
        // First in line, so a held reply never reaches the client's own listener.
        this.addEventListener("message", (event) => {
          if (released.has(event) || !flags.__dyelotHold) return;
          flags.__dyelotHold = false;
          event.stopImmediatePropagation();
          held = event;
        });
        flags.__dyelotRelease = () => {
          // A release before the reply has arrived ends the hold: that reply passes.
          flags.__dyelotHold = false;
          if (held === null) return;
          const reply = new MessageEvent("message", { data: held.data });
          held = null;
          released.add(reply);
          this.dispatchEvent(reply);
        };
      }
      override postMessage(message: { id: number }, ...rest: never[]) {
        if (flags.__dyelotEcho !== null) {
          const data = { id: message.id, ok: true, spec: flags.__dyelotEcho };
          flags.__dyelotEcho = null;
          setTimeout(() => this.dispatchEvent(new MessageEvent("message", { data })), 0);
          return;
        }
        if (!flags.__dyelotFault) {
          super.postMessage(message, ...rest);
          return;
        }
        const data = {
          id: message.id,
          ok: false,
          error: { name: "RangeError", message: "forced" },
        };
        setTimeout(() => this.dispatchEvent(new MessageEvent("message", { data })), 0);
      }
    }
    window.Worker = FaultWorker;
  });
}

/** A link whose payload is any JSON value, with a valid trailer (deflate-raw, FNV-1a 64). */
export function linkOfValue(value: unknown): string {
  const deflated = new Uint8Array(
    deflateRawSync(Buffer.from(JSON.stringify(value), "utf8"), { level: 9 }),
  );
  const trailer = Buffer.from(fnv1a64(deflated), "hex");
  return Buffer.concat([deflated, trailer]).toString("base64url");
}

/** A link with one character changed in the middle (C-HASH-03). */
export function tampered(link: string): string {
  const at = Math.floor(link.length / 2);
  const swap = link[at] === "A" ? "B" : "A";
  return `${link.slice(0, at)}${swap}${link.slice(at + 1)}`;
}

/** sRGB `rgb(r, g, b)` as `#rrggbb`. */
export function rgbToHex(rgb: string): string {
  const parts = rgb.match(/\d+(\.\d+)?/g)?.slice(0, 3) ?? [];
  if (parts.length !== 3) throw new Error(`not an rgb color: ${rgb}`);
  return `#${parts.map((part) => Math.round(Number(part)).toString(16).padStart(2, "0")).join("")}`;
}

/** Whether two hexes are within one code per channel (the spec's tolerance). */
export function nearHex(a: string, b: string): boolean {
  const channels = (hex: string) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
  const [x, y] = [channels(a), channels(b)];
  return x.every((value, i) => Math.abs(value - (y[i] ?? Number.NaN)) <= 1);
}
