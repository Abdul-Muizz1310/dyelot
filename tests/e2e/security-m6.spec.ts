import { expect } from "@playwright/test";
import { entryHref } from "@/features/gallery/links";
import { GALLERY_DATA } from "../unit/support/gallery";
import { test } from "./flavor-support";
import {
  directives,
  isDataBlock,
  nonceOf,
  scriptTags,
  violations,
  watchOrigin,
  watchPolicy,
} from "./security-support";

// The security flows of docs/specs/06-gallery.md, section 14.11 (R6-22, R6-49): F-SEC6-01 and
// F-SEC6-02 (Task 6.11a). The new pages render per request under the nonce policy of 12.2 of M5, the
// share cards answer outside /api/, the open route sends a browser only to the studio, the explorer
// or the motion lab, and nothing a new page loads leaves the origin. They run against the production
// build. Every flow fails, through the watch of flavor-support's `test`, on a
// `securitypolicyviolation` event, a console error, a page error or an unhandled rejection in any
// document it visits.

test.use({ viewport: { width: 1280, height: 800 } });

/**
 * 12.2's page policy of M5 for a production build, word for word from the spec with the response's
 * nonce put in: the flows' oracle is the spec's text, never the code that writes the header.
 * tests/e2e/security.spec.ts pins the same literal (the owner's rule); this second exact pin fails on
 * any drift of the header or of either copy, and never passes in silence, so it stays written out.
 */
const PAGE_POLICY = (nonce: string): string =>
  `default-src 'self'; base-uri 'self'; font-src 'self' data:; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'; worker-src 'self' blob:; connect-src 'self' https://openrouter.ai https://www.remotion.pro; frame-ancestors 'none'; object-src 'none'; form-action 'self';`;
/** R4-24's policy for every path under /api/, word for word from the spec. */
const API_POLICY = "default-src 'none'; frame-ancestors 'none';";
/** R4-27's `Permissions-Policy`. */
const PERMISSIONS = "language-model=(self), camera=(), microphone=(), geolocation=()";
/** R5-58's `connect-src`, the only origins a page may reach (R6-22). */
const CONNECT_SRC = ["'self'", "https://openrouter.ai", "https://www.remotion.pro"];

/** The pages M6 adds (R6-49). */
const NEW_PAGES = ["/gallery", "/gallery/kermes", "/about"] as const;
/** The gallery's two image routes (R6-18, R6-19), which the proxy passes the page policy (12.2). */
const IMAGE_ROUTES = ["/gallery/madder/opengraph-image", "/gallery/opengraph-image"] as const;
/** The pages the open route sends a browser to (R6-15). */
const OPEN_PAGES = ["studio", "explore", "motion"] as const;
/** The only starts a `Location` of the open route may have (F-SEC6-01). */
const LOCATION_STARTS = OPEN_PAGES.map((page) => `/${page}#s=`);

/**
 * Inputs that must reach no page: case changes, prototype names, encoded slashes, backslashes, a
 * fragment, spaces, a parameter and a deeper path (the review probe of Task 6.2). Each answers 404
 * with no `Location`.
 */
const MALFORMED_OPEN = [
  "/gallery/nope/open/studio",
  "/gallery/Kermes/open/studio",
  "/gallery/__proto__/open/studio",
  "/gallery/constructor/open/studio",
  "/gallery/toString/open/studio",
  "/gallery/kermes%2Fopen/studio",
  "/gallery/kermes/open/lab",
  "/gallery/kermes/open/Studio",
  "/gallery/kermes/open/STUDIO",
  "/gallery/kermes/open/__proto__",
  "/gallery/kermes/open/includes",
  "/gallery/kermes/open/%2F%2Fevil.example",
  "/gallery/kermes/open/%2Fstudio",
  "/gallery/kermes/open/%5Cevil.example",
  "/gallery/kermes/open/studio%23x",
  "/gallery/kermes/open/studio%20",
  "/gallery/kermes/open/studio;x",
  "/gallery/kermes/open/studio/x",
] as const;

test.describe("R6-49 no new surface", () => {
  // Breaks when a new page loses 12.2's policy, reuses a nonce, runs a script without it, or drops
  // one of R4-27's headers.
  test("F-SEC6-01 /gallery, /gallery/kermes and /about answer with 12.2's policy, a fresh nonce per response and R4-27's headers", async ({
    request,
  }) => {
    for (const path of NEW_PAGES) {
      const nonces: string[] = [];
      for (const load of ["first", "second"]) {
        const where = `${path} (${load} load)`;
        const response = await request.get(path);
        expect(response.status(), where).toBe(200);
        const headers = response.headers();
        expect(headers["content-type"], where).toMatch(/^text\/html/);
        const policy = headers["content-security-policy"] ?? "";
        const nonce = nonceOf(policy, where);
        expect(policy, where).toBe(PAGE_POLICY(nonce));
        // Every script the document runs carries the response's nonce.
        const tags = scriptTags(await response.text()).filter((tag) => !isDataBlock(tag));
        expect(tags.length, where).toBeGreaterThan(0);
        for (const tag of tags) expect(tag, where).toContain(`nonce="${nonce}"`);
        expect(headers["x-frame-options"], where).toBe("DENY");
        expect(headers["x-content-type-options"], where).toBe("nosniff");
        expect(headers["referrer-policy"], where).toBe("strict-origin-when-cross-origin");
        expect(headers["permissions-policy"], where).toBe(PERMISSIONS);
        nonces.push(nonce);
      }
      expect(nonces[0], path).not.toBe(nonces[1]);
    }
  });

  // Breaks when a new page's markup, styles or scripts trip the policy as it loads.
  test("F-SEC6-01 /gallery, /gallery/kermes and /about load with no securitypolicyviolation", async ({
    page,
  }) => {
    await watchPolicy(page);
    for (const path of NEW_PAGES) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
      // The inline scripts that carry the nonce ran: Next.js's payload queue exists.
      await page.waitForFunction(() => "__next_f" in window);
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      await page.waitForLoadState("networkidle");
      expect(await violations(page), path).toEqual([]);
    }
  });

  // Breaks when a share card moves under /api/ or loses the page policy the proxy sends.
  test("F-SEC6-01 the madder card and the gallery's card answer outside /api/'s policy", async ({
    request,
  }) => {
    for (const path of IMAGE_ROUTES) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
      expect(response.headers()["content-type"], path).toBe("image/png");
      const policy = response.headers()["content-security-policy"] ?? "";
      expect(policy, path).not.toBe(API_POLICY);
      expect(policy, path).toBe(PAGE_POLICY(nonceOf(policy, path)));
    }
  });

  // Breaks when the open route sends a browser anywhere but the three pages, or answers a
  // malformed input with a redirect.
  test("F-SEC6-01 every Location the open route gives starts with /studio#s=, /explore#s= or /motion#s=", async ({
    request,
  }) => {
    const locations = new Map<string, string>();
    for (const { slug, link } of GALLERY_DATA.entries) {
      for (const page of OPEN_PAGES) {
        const path = `/gallery/${slug}/open/${page}`;
        const response = await request.get(path, { maxRedirects: 0 });
        expect(response.status(), path).toBe(307);
        const location = response.headers().location ?? "";
        expect(location, path).toBe(entryHref(page, link));
        locations.set(path, location);
      }
    }
    expect(locations.size).toBe(GALLERY_DATA.entries.length * OPEN_PAGES.length);
    const strays = [...locations].filter(
      ([, location]) => !LOCATION_STARTS.some((start) => location.startsWith(start)),
    );
    expect(strays).toEqual([]);
    // A query, a forwarded host and encoded letters reach the same fixed Location.
    const fixed = locations.get("/gallery/madder/open/studio");
    expect(fixed).toBeDefined();
    for (const [path, headers] of [
      ["/gallery/madder/open/studio?next=//evil.example", {}],
      ["/gallery/madder/open/studio", { "x-forwarded-host": "evil.example" }],
      ["/gallery/%6Dadder/open/st%75dio", {}],
    ] as const) {
      const response = await request.get(path, { maxRedirects: 0, headers });
      expect(response.status(), path).toBe(307);
      expect(response.headers().location, path).toBe(fixed);
    }
    for (const path of MALFORMED_OPEN) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(404);
      expect(response.headers().location, path).toBeUndefined();
    }
  });
});

test.describe("R6-22 no analytics, verified", () => {
  // Breaks when any page's `connect-src` gains or loses an origin.
  test("F-SEC6-02 connect-src on every page is exactly 'self' https://openrouter.ai https://www.remotion.pro", async ({
    request,
  }) => {
    const pages: ReadonlyArray<readonly [path: string, status: number]> = [
      ["/", 200],
      ["/studio", 200],
      ["/explore", 200],
      ["/motion", 200],
      ["/gallery", 200],
      ["/gallery?tag=calm", 200],
      ...GALLERY_DATA.entries.map(({ slug }) => [`/gallery/${slug}`, 200] as const),
      ["/about", 200],
      ["/connect", 200],
      ["/connect/callback", 200],
      ["/no-such-page", 404],
      // The two image routes carry the page policy too.
      ...IMAGE_ROUTES.map((path) => [path, 200] as const),
    ];
    expect(pages).toHaveLength(36);
    for (const [path, status] of pages) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(status);
      const policy = response.headers()["content-security-policy"] ?? "";
      expect(directives(policy)["connect-src"], path).toEqual(CONNECT_SRC);
    }
  });

  // Breaks when a new page fetches anything from another origin: a font, a script, an analytics
  // beacon or an image.
  test("F-SEC6-02 no request from /gallery, /gallery/kermes or /about leaves the origin", async ({
    page,
    baseURL,
  }) => {
    // Every request and socket that leaves the origin is kept, and stopped in the browser (R4-58).
    const { inside, outside } = await watchOrigin(
      page,
      new URL(baseURL ?? "http://localhost").origin,
    );
    for (const path of NEW_PAGES) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
      await page.waitForLoadState("networkidle");
    }
    expect(inside.length).toBeGreaterThan(NEW_PAGES.length);
    expect(outside).toEqual([]);
  });
});
