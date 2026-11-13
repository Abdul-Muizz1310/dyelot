import { expect, type Page } from "@playwright/test";
import { GALLERY_DATA } from "../unit/support/gallery";
import { test } from "./flavor-support";

// The security flows of docs/specs/06-gallery.md, section 14.11 (R6-22, R6-49): F-SEC6-01 and
// F-SEC6-02 (Task 6.11a). The new pages render per request under the nonce policy of 12.2 of M5, the
// share card answers outside /api/, the open route sends a browser only to the studio, the explorer
// or the motion lab, and nothing a new page loads leaves the origin. They run against the production
// build. Every flow fails, through the watch of flavor-support's `test`, on a
// `securitypolicyviolation` event, a console error, a page error or an unhandled rejection in any
// document it visits.

test.use({ viewport: { width: 1280, height: 800 } });

/**
 * 12.2's page policy of M5 for a production build, word for word from the spec with the response's
 * nonce put in: the flows' oracle is the spec's text, never the code that writes the header.
 */
const PAGE_POLICY = (nonce: string): string =>
  `default-src 'self'; base-uri 'self'; font-src 'self' data:; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'; worker-src 'self' blob:; connect-src 'self' https://openrouter.ai https://www.remotion.pro; frame-ancestors 'none'; object-src 'none'; form-action 'self';`;
/** R4-24's policy for every path under /api/, word for word from the spec. */
const API_POLICY = "default-src 'none'; frame-ancestors 'none';";
/** The nonce the proxy makes: the base64 of a UUID, 48 characters (C-PROXY-01). */
const NONCE_SOURCE = /'nonce-([A-Za-z0-9+/]{48})'/;
/** R4-27's `Permissions-Policy`. */
const PERMISSIONS = "language-model=(self), camera=(), microphone=(), geolocation=()";
/** R5-58's `connect-src`, the only origins a page may reach (R6-22). */
const CONNECT_SRC = ["'self'", "https://openrouter.ai", "https://www.remotion.pro"];

/** The pages M6 adds (R6-49). */
const NEW_PAGES = ["/gallery", "/gallery/kermes", "/about"] as const;
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

/** The nonce a page policy names; a policy without one fails the flow. */
function nonceOf(policy: string, where: string): string {
  const nonce = NONCE_SOURCE.exec(policy)?.[1];
  if (nonce === undefined) throw new Error(`${where}: the policy names no nonce: ${policy}`);
  return nonce;
}

/** `a b; c d` becomes `{ a: ["b"], c: ["d"] }`, so a check reads one directive. */
function directives(policy: string): Record<string, string[]> {
  return Object.fromEntries(
    policy
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name = "", ...values] = part.split(/\s+/);
        return [name, values];
      }),
  );
}

/** The opening tag of every `<script>` in an HTML document. */
const scriptTags = (html: string): string[] => html.match(/<script\b[^>]*>/gi) ?? [];

/** A data block: a `<script>` whose type no browser runs, so the policy needs no nonce for it. */
const isDataBlock = (tag: string): boolean => /\btype="application\/(?:ld\+)?json"/i.test(tag);

/**
 * Records, before the page's scripts run, every policy violation each document reports, for the
 * flow to read per page.
 */
async function watchPolicy(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const host = window as unknown as { __violations: string[] };
    host.__violations = [];
    document.addEventListener(
      "securitypolicyviolation",
      (event) => host.__violations.push(`${event.violatedDirective} ${event.blockedURI}`),
      true,
    );
  });
}

const violations = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as { __violations: string[] }).__violations);

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

  // Breaks when the share card moves under /api/ or loses the page policy the proxy sends.
  test("F-SEC6-01 the madder card answers outside /api/'s policy", async ({ request }) => {
    const response = await request.get("/gallery/madder/opengraph-image");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
    const policy = response.headers()["content-security-policy"] ?? "";
    expect(policy).not.toBe(API_POLICY);
    expect(policy).toBe(PAGE_POLICY(nonceOf(policy, "the madder card")));
  });

  // Breaks when the open route sends a browser anywhere but the three pages, or answers a
  // malformed input with a redirect.
  test("F-SEC6-01 every Location the open route gives starts with /studio#s=, /explore#s= or /motion#s=", async ({
    request,
  }) => {
    const locations = new Map<string, string>();
    for (const { slug } of GALLERY_DATA.entries) {
      for (const page of OPEN_PAGES) {
        const path = `/gallery/${slug}/open/${page}`;
        const response = await request.get(path, { maxRedirects: 0 });
        expect(response.status(), path).toBe(307);
        const location = response.headers().location ?? "";
        expect(location.startsWith(`/${page}#s=`), `${path}: ${location.slice(0, 40)}`).toBe(true);
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
    ];
    expect(pages).toHaveLength(34);
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
    const origin = new URL(baseURL ?? "http://localhost").origin;
    // A data: or blob: URL is read in memory: only these schemes reach a server. A socket belongs to
    // the origin it upgrades from, so ws: and wss: compare as http: and https:.
    const SCHEMES: Readonly<Record<string, string>> = {
      "http:": "http:",
      "https:": "https:",
      "ws:": "http:",
      "wss:": "https:",
    };
    const leaves = (url: URL): boolean => {
      const scheme = SCHEMES[url.protocol];
      return scheme !== undefined && `${scheme}//${url.host}` !== origin;
    };
    const outside: string[] = [];
    const inside: string[] = [];
    page.on("request", (request) => {
      (leaves(new URL(request.url())) ? outside : inside).push(request.url());
    });
    // Playwright reports a WebSocket as a `websocket` event, never as a request.
    page.on("websocket", (socket) => {
      if (leaves(new URL(socket.url()))) outside.push(socket.url());
    });
    // A request or a socket that leaves anyway goes no further than the browser (R4-58), and the
    // list keeps it.
    await page.route(leaves, (route) => route.abort());
    await page.routeWebSocket(leaves, (socket) => {
      outside.push(socket.url());
      void socket.close();
    });
    for (const path of NEW_PAGES) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
      await page.waitForLoadState("networkidle");
    }
    expect(inside.length).toBeGreaterThan(NEW_PAGES.length);
    expect(outside).toEqual([]);
  });
});
