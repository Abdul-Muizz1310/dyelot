import { expect, type Page } from "@playwright/test";

// The laziness flows' markers and response reader (R5-61, R5-64; R6-56), moved unchanged from
// tests/e2e/lazy-m5.spec.ts in Task 6.11a (D8), so the M6 flows' absence checks read the strings the
// M5 flows prove present: a marker that drifts fails F-LAZY5's positive checks, never passing
// F-LAZY6's in silence.

/**
 * R5-64's markers, each found in its library's chunk only (probes 1, 4 and 5), the engine's version
 * string (`ENGINE_VERSION`, src/engine/generate.ts) and the export's receipt format, the marker 14.11
 * of M5 gives `@/export` (F-EXP-15 in tests/e2e/export.spec.ts finds it in the export's chunk).
 */
export const MARKERS = {
  three: "THREE.WebGLRenderer",
  r3f: "R3F: Hooks can only be used within the Canvas component",
  player: "Some companies are required to obtain a license to use Remotion",
  remotion: "No video config found",
  renderer: "register-usage-point",
  mediabunny: "MediabunnyVideoHandler",
  engine: "dyelot.engine/1",
  export: "dyelot.check/1",
} as const;
export type Library = keyof typeof MARKERS;

/** Remotion's code: the Player, its core and the web renderer (R5-61). */
export const REMOTION: readonly Library[] = ["player", "remotion", "renderer"];

/** The text of every JavaScript response a page fetches, kept from the moment it is called. */
export type Scripts = {
  /**
   * Each response's URL and text, once every response so far has been read. A body that could not
   * be read is an error naming its URL: a chunk the flow cannot read is never counted as holding no
   * marker.
   */
  read(): Promise<readonly { readonly url: string; readonly text: string }[]>;
};

type Body =
  | { readonly url: string; readonly text: string }
  | { readonly url: string; readonly error: string };

export function recordScripts(page: Page): Scripts {
  // Each read settles into a body or its failure at once, so a failure waits for `read()` to report
  // it, never surfacing as an unhandled rejection in between.
  const bodies: Promise<Body>[] = [];
  page.on("response", (response) => {
    const type = response.headers()["content-type"] ?? "";
    if (!type.includes("javascript")) return;
    const url = response.url();
    bodies.push(
      response.text().then(
        (text) => ({ url, text }),
        (error: unknown) => ({
          url,
          error: error instanceof Error ? error.message : String(error),
        }),
      ),
    );
  });
  return {
    read: async () => {
      const read = await Promise.all(bodies);
      return read.map((body) => {
        if ("error" in body) {
          throw new Error(`recordScripts: could not read ${body.url}: ${body.error}`);
        }
        return body;
      });
    },
  };
}

/** The libraries of `libraries` whose marker some script so far holds. */
export async function loaded(scripts: Scripts, libraries: readonly Library[]): Promise<Library[]> {
  const texts = await scripts.read();
  return libraries.filter((library) => texts.some(({ text }) => text.includes(MARKERS[library])));
}

/** Waits until the page has loaded the marker of each of `libraries`, polling its scripts. */
export async function expectLoaded(scripts: Scripts, libraries: readonly Library[]): Promise<void> {
  await expect.poll(() => loaded(scripts, libraries)).toEqual(libraries);
}
