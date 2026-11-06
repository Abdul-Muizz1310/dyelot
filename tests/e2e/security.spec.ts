import { expect, type Locator, type Page, test } from "@playwright/test";
import { button, openStudio, settled, stubSeeds } from "./studio-support";

// The security flows of docs/specs/04-ai.md, section 14.11 (Task 4.12b): F-SEC4-01 to 05, the nonce
// policy the proxy sends on every page (R4-25, 12.1, 12.2), the other headers of next.config.ts
// (R4-27, 12.3), robots and the connect pages' metadata (R4-22, 12.4, R4-33), and the dev-only eval
// page that a production build does not serve (R4-32). They run against the production build.
// Section 16 of docs/specs/05-motion-3d.md adds /explore and /motion to F-SEC4-01's and F-SEC4-02's
// pages and Remotion's host to `connect-src` (R5-58); F-SEC5-01 to 03 (Task 5.11a; R5-58, R5-59,
// I-M5-09) follow them.

test.use({ viewport: { width: 1280, height: 800 } });

const STRICT = "strict-origin-when-cross-origin";
const PERMISSIONS = "language-model=(self), camera=(), microphone=(), geolocation=()";
/**
 * 12.2's page policy for a production build, word for word from the spec with the response's nonce
 * put in: the flows' oracle is the spec's text, never the code that writes the header.
 */
const PAGE_POLICY = (nonce: string): string =>
  `default-src 'self'; base-uri 'self'; font-src 'self' data:; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'; worker-src 'self' blob:; connect-src 'self' https://openrouter.ai https://www.remotion.pro; frame-ancestors 'none'; object-src 'none'; form-action 'self';`;
/** R4-24's policy for every path under /api/, word for word from the spec. */
const API_POLICY = "default-src 'none'; frame-ancestors 'none';";
/** The nonce the proxy makes: the base64 of a UUID, 48 characters (C-PROXY-01). */
const NONCE_SOURCE = /'nonce-([A-Za-z0-9+/]{48})'/;
/** Chromium's own line for a document that answers 404 (Task 4.0's probe 2): not a policy error. */
const NOT_FOUND_LINE = "Failed to load resource: the server responded with a status of 404";

/** The nonce a page policy names; a policy without one fails the flow. */
function nonceOf(policy: string, path: string): string {
  const nonce = NONCE_SOURCE.exec(policy)?.[1];
  if (nonce === undefined) throw new Error(`${path}: the policy names no nonce: ${policy}`);
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

/**
 * A data block: a `<script>` whose type no browser runs (the home page's JSON-LD). A policy governs
 * only scripts that run, so it needs no nonce (Task 4.0's probe 2: it raises no violation).
 */
const isDataBlock = (tag: string): boolean => /\btype="application\/(?:ld\+)?json"/i.test(tag);

/**
 * 12.2: the files the proxy passes through (the metadata routes and the fonts) carry the page
 * policy too, with a nonce of their own.
 */
function expectPagePolicy(headers: Record<string, string>, path: string): void {
  const policy = headers["content-security-policy"] ?? "";
  expect(policy, path).toBe(PAGE_POLICY(nonceOf(policy, path)));
}

/** 12.3's four headers, from next.config.ts, with the route's Referrer-Policy. */
function expectOtherHeaders(headers: Record<string, string>, path: string, referrer: string) {
  expect(headers["x-frame-options"], path).toBe("DENY");
  expect(headers["x-content-type-options"], path).toBe("nosniff");
  expect(headers["referrer-policy"], path).toBe(referrer);
  expect(headers["permissions-policy"], path).toBe(PERMISSIONS);
}

/**
 * Records, before the page's scripts run, every policy violation the document reports and every
 * worker the page starts.
 */
async function watchPolicy(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const host = window as unknown as { __violations: string[]; __workers: number };
    host.__violations = [];
    host.__workers = 0;
    document.addEventListener(
      "securitypolicyviolation",
      (event) => host.__violations.push(`${event.violatedDirective} ${event.blockedURI}`),
      true,
    );
    const Real = window.Worker;
    window.Worker = class extends Real {
      constructor(...args: ConstructorParameters<typeof Worker>) {
        super(...args);
        host.__workers += 1;
      }
    };
  });
}

const violations = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as { __violations: string[] }).__violations);
const workers = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { __workers: number }).__workers);

test.describe("12 security headers, robots and the connect pages", () => {
  test("F-SEC4-01 each page and HTML 404 carries 12.1's policy with a fresh nonce its scripts carry; /api/nope carries R4-24's", async ({
    request,
  }) => {
    const pages: ReadonlyArray<readonly [path: string, status: number]> = [
      ["/", 200],
      ["/studio", 200],
      ["/explore", 200],
      ["/motion", 200],
      ["/connect", 200],
      ["/connect/callback", 200],
      ["/no-such-page", 404],
      ["/robots.txtx", 404],
    ];
    for (const [path, status] of pages) {
      const nonces: string[] = [];
      for (const load of ["first", "second"]) {
        const where = `${path} (${load} load)`;
        const response = await request.get(path);
        expect(response.status(), where).toBe(status);
        const headers = response.headers();
        expect(headers["content-type"], where).toMatch(/^text\/html/);
        const policy = headers["content-security-policy"] ?? "";
        const nonce = nonceOf(policy, where);
        // Exactly 12.2's policy for this nonce, in a production build.
        expect(policy, where).toBe(PAGE_POLICY(nonce));
        const parts = directives(policy);
        expect(parts["script-src"], where).toEqual([
          "'self'",
          `'nonce-${nonce}'`,
          "'strict-dynamic'",
        ]);
        expect(parts["connect-src"], where).toEqual([
          "'self'",
          "https://openrouter.ai",
          "https://www.remotion.pro",
        ]);
        expect(parts["form-action"], where).toEqual(["'self'"]);
        // Every script the document runs carries the response's nonce.
        const tags = scriptTags(await response.text()).filter((tag) => !isDataBlock(tag));
        expect(tags.length, where).toBeGreaterThan(0);
        for (const tag of tags) expect(tag, where).toContain(`nonce="${nonce}"`);
        expectOtherHeaders(headers, where, path === "/connect/callback" ? "no-referrer" : STRICT);
        nonces.push(nonce);
      }
      expect(nonces[0], path).not.toBe(nonces[1]);
    }

    const api = await request.get("/api/nope");
    expect(api.status()).toBe(404);
    expect(api.headers()["content-type"]).toMatch(/^text\/html/);
    expect(api.headers()["content-security-policy"]).toBe(API_POLICY);
    expect(await api.text()).not.toContain("nonce=");
    expectOtherHeaders(api.headers(), "/api/nope", STRICT);
  });

  test("F-SEC4-02 /, /studio, /explore, /motion and /connect load under the policy with no console error, and the generate worker starts", async ({
    page,
  }) => {
    const problems: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        problems.push(`${page.url()}: ${message.text()} [${message.location().url}]`);
      }
    });
    page.on("pageerror", (error) => problems.push(`${page.url()}: ${error.message}`));
    await watchPolicy(page);

    for (const path of ["/", "/explore", "/motion", "/connect"]) {
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

    // The studio hydrates, and its generate worker starts and answers a change (F-STUDIO-21).
    const response = await openStudio(page);
    expect(response.headers()["content-security-policy"]).toMatch(/worker-src 'self' blob:/);
    const lot = await page.locator("[data-lot-id]").textContent();
    await page
      .getByRole("complementary", { name: "Inputs" })
      .getByRole("group", { name: "Chroma", exact: true })
      .getByRole("radio", { name: "vivid", exact: true })
      .check();
    await settled(page);
    await expect(page.locator("[data-lot-id]")).not.toHaveText(lot ?? "");
    expect(await workers(page)).toBe(1);
    expect(await violations(page), "/studio").toEqual([]);
    // Every line so far, a 404 of any resource included, is a problem on these five pages.
    expect(problems.splice(0)).toEqual([]);

    // The not-found page too, but for Chromium's own line about this document's 404 status.
    const missing = await page.goto("/no-such-page");
    expect(missing?.status()).toBe(404);
    await page.waitForFunction(() => "__next_f" in window);
    await page.waitForLoadState("networkidle");
    expect(await violations(page), "/no-such-page").toEqual([]);
    // Only the document's own 404, as Chromium reports it for the not-found page itself.
    const document404 = `${missing?.url()}: ${NOT_FOUND_LINE} (Not Found) [${missing?.url()}]`;
    expect(problems.filter((line) => line !== document404)).toEqual([]);
  });

  test("F-SEC4-03 the proxy passes the files through, and the API answers with R4-24's policy", async ({
    request,
  }) => {
    const robots = await request.get("/robots.txt");
    expect(robots.status()).toBe(200);
    expect(robots.headers()["content-type"]).toMatch(/^text\/plain/);
    expectPagePolicy(robots.headers(), "/robots.txt");
    const lines = (await robots.text())
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    expect(lines).toEqual([
      "User-Agent: *",
      "Allow: /",
      "Disallow: /api/",
      "Disallow: /connect/callback",
      "Sitemap: https://dyelot.vercel.app/sitemap.xml",
    ]);

    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.status()).toBe(200);
    expect(sitemap.headers()["content-type"]).toMatch(/^application\/xml/);
    expectPagePolicy(sitemap.headers(), "/sitemap.xml");
    const locations = [...(await sitemap.text()).matchAll(/<loc>([^<]*)<\/loc>/g)].map(
      (match) => match[1],
    );
    expect(locations).toEqual([
      "https://dyelot.vercel.app/",
      "https://dyelot.vercel.app/studio",
      "https://dyelot.vercel.app/explore",
      "https://dyelot.vercel.app/motion",
    ]);

    const font = await request.get("/fonts/geist/geist-latin-wght-normal.woff2");
    expect(font.status()).toBe(200);
    expect(font.headers()["content-type"]).toMatch(/^font\/woff2/);
    expectPagePolicy(font.headers(), "the font");

    const models = await request.get("/api/ai/models");
    expect(models.status()).toBe(200);
    expect(models.headers()["content-security-policy"]).toBe(API_POLICY);
    expect(models.headers()["cache-control"]).toBe("no-store");
    const missing = await request.get("/api/nope");
    expect(missing.status()).toBe(404);
    expect(missing.headers()["content-security-policy"]).toBe(API_POLICY);
  });

  test("F-SEC4-04 the connect pages stay out of search, and the callback sends no referrer", async ({
    page,
    request,
  }) => {
    for (const [path, referrer] of [
      ["/connect", STRICT],
      ["/connect/callback", "no-referrer"],
    ] as const) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
      expect(response?.headers()["referrer-policy"], path).toBe(referrer);
      const robots = page.locator('meta[name="robots"]');
      await expect(robots, path).toHaveCount(1);
      await expect(robots, path).toHaveAttribute("content", "noindex, nofollow");
      const meta = page.locator('meta[name="referrer"]');
      if (path === "/connect/callback") {
        await expect(meta, path).toHaveCount(1);
        await expect(meta, path).toHaveAttribute("content", "no-referrer");
      } else {
        await expect(meta, path).toHaveCount(0);
      }
    }
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).not.toContain("/connect");
  });

  test("F-SEC4-05 the on-device eval page answers 404 in the production build", async ({
    request,
  }) => {
    const response = await request.get("/dev/on-device-eval");
    expect(response.status()).toBe(404);
    expect(response.headers()["content-type"]).toMatch(/^text\/html/);
    const html = await response.text();
    expect(html).not.toContain("On-device evaluation");
    expect(html).not.toContain("Run the evaluation");
  });
});

// docs/specs/05-motion-3d.md, section 14.11 (Task 5.11a): the M5 pages under 12.2's policy.

/** Every console error and page error `page` reports from now on, with the page's address. */
function trackProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      problems.push(`${page.url()}: ${message.text()} [${message.location().url}]`);
    }
  });
  page.on("pageerror", (error) => problems.push(`${page.url()}: ${error.message}`));
  return problems;
}

/** What each M5 page shows once it has run: the hero's shader, the 3D view, the lab. */
const RUNNING: Readonly<Record<"/" | "/explore" | "/motion", (page: Page) => Promise<void>>> = {
  "/": (page) =>
    expect(page.locator("[data-hero] canvas")).toHaveAttribute("data-flavor", "running"),
  "/explore": async (page) => {
    const panel = page.locator("[data-explorer]");
    await expect(panel).toHaveAttribute("data-explorer-state", "3d");
    await expect(panel.locator("canvas")).toHaveCount(1);
  },
  "/motion": (page) => expect(page.locator("[data-lab]")).toBeAttached(),
};
const M5_PAGES = ["/", "/explore", "/motion"] as const;

const flavorDialog = (page: Page): Locator =>
  page.getByRole("dialog", { name: "Flavor", exact: true });

/** Opens the Flavor dialog over the studio and waits for its preview and its Player to run. */
async function openFlavorDialog(page: Page): Promise<void> {
  await button(page, "Flavor").click();
  const dialog = flavorDialog(page);
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("[data-flavor-preview] canvas")).toHaveAttribute(
    "data-flavor",
    "running",
  );
  await expect(dialog.locator("[data-brand-player]")).toHaveAttribute("data-playing", "true");
}

test.describe("M5 pages under the policy (R5-58, R5-59)", () => {
  // Breaks when a page loses 12.2's policy or its fresh nonce, when `connect-src` gains or loses an
  // origin, or when the policy opens media or WebAssembly.
  test("F-SEC5-01 each page carries 12.2's policy with a fresh nonce, Remotion's host in connect-src, no media-src and no wasm-unsafe-eval", async ({
    request,
  }) => {
    const pages: ReadonlyArray<readonly [path: string, status: number]> = [
      ["/", 200],
      ["/studio", 200],
      ["/explore", 200],
      ["/motion", 200],
      ["/connect", 200],
      ["/connect/callback", 200],
      ["/no-such-page", 404],
    ];
    for (const [path, status] of pages) {
      const nonces: string[] = [];
      for (const load of ["first", "second"]) {
        const where = `${path} (${load} load)`;
        const response = await request.get(path);
        expect(response.status(), where).toBe(status);
        const policy = response.headers()["content-security-policy"] ?? "";
        const nonce = nonceOf(policy, where);
        expect(policy, where).toBe(PAGE_POLICY(nonce));
        const parts = directives(policy);
        expect(parts["connect-src"], where).toEqual([
          "'self'",
          "https://openrouter.ai",
          "https://www.remotion.pro",
        ]);
        expect(Object.keys(parts), where).not.toContain("media-src");
        expect(policy, where).not.toContain("'wasm-unsafe-eval'");
        nonces.push(nonce);
      }
      expect(nonces[0], path).not.toBe(nonces[1]);
    }
  });

  // Breaks when the hero, the explorer, the lab or the Flavor dialog trips the policy or logs an
  // error, or when the studio starts a second worker.
  test("F-SEC5-02 /, /explore, /motion and the studio with the Flavor dialog open run with no console error or violation, one worker before the dialog", async ({
    page,
  }) => {
    const problems = trackProblems(page);
    await watchPolicy(page);
    for (const path of M5_PAGES) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
      // The inline scripts that carry the nonce ran: Next.js's payload queue exists.
      await page.waitForFunction(() => "__next_f" in window);
      await RUNNING[path](page);
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      await page.waitForLoadState("networkidle");
      expect(await violations(page), path).toEqual([]);
    }

    await stubSeeds(page);
    await openStudio(page);
    await expect.poll(() => workers(page)).toBe(1);
    await page.waitForLoadState("networkidle");
    expect(await workers(page), "/studio before the dialog").toBe(1);
    await openFlavorDialog(page);
    await page.waitForLoadState("networkidle");
    expect(await violations(page), "/studio with the dialog open").toEqual([]);
    expect(problems).toEqual([]);
  });

  // Breaks when a page or the dialog fetches anything from another origin: a font, a CDN script, a
  // remote asset or an early usage event.
  test("F-SEC5-03 loading /, /explore in 3D, /motion and the open Flavor dialog requests nothing outside the page's origin", async ({
    page,
    baseURL,
  }) => {
    const origin = new URL(baseURL ?? "http://localhost").origin;
    // A data: or blob: URL is read in memory: only these schemes reach a server.
    const NETWORK = new Set(["http:", "https:", "ws:", "wss:"]);
    const leaves = (url: URL): boolean => NETWORK.has(url.protocol) && url.origin !== origin;
    const outside: string[] = [];
    page.on("request", (request) => {
      if (leaves(new URL(request.url()))) outside.push(request.url());
    });
    // A request that leaves anyway goes no further than the browser (R4-58), and the list keeps it.
    await page.route(leaves, (route) => route.abort());
    const problems = trackProblems(page);
    await watchPolicy(page);

    for (const path of M5_PAGES) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
      await RUNNING[path](page);
      await page.waitForLoadState("networkidle");
      expect(await violations(page), path).toEqual([]);
    }
    await stubSeeds(page);
    await openStudio(page);
    await openFlavorDialog(page);
    await page.waitForLoadState("networkidle");
    expect(await violations(page), "/studio with the dialog open").toEqual([]);
    expect(outside).toEqual([]);
    expect(problems).toEqual([]);
  });
});
