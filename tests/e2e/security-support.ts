import type { Page } from "@playwright/test";

// The security flows' readers (docs/specs/04-ai.md and 05-motion-3d.md, section 14.11; R6-49), moved
// unchanged from tests/e2e/security.spec.ts in Task 6.11a (D8) and read by security-m6.spec.ts too.
// The policy literals stay in the flow files, written from the spec: tests/e2e/security.spec.ts pins
// 12.2's policy (the owner's rule), and a file that writes it again pins it a second time.

/** The nonce the proxy makes: the base64 of a UUID, 48 characters (C-PROXY-01). */
export const NONCE_SOURCE = /'nonce-([A-Za-z0-9+/]{48})'/;

/** The nonce a page policy names; a policy without one fails the flow. */
export function nonceOf(policy: string, path: string): string {
  const nonce = NONCE_SOURCE.exec(policy)?.[1];
  if (nonce === undefined) throw new Error(`${path}: the policy names no nonce: ${policy}`);
  return nonce;
}

/** `a b; c d` becomes `{ a: ["b"], c: ["d"] }`, so a check reads one directive. */
export function directives(policy: string): Record<string, string[]> {
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
export const scriptTags = (html: string): string[] => html.match(/<script\b[^>]*>/gi) ?? [];

/**
 * A data block: a `<script>` whose type no browser runs (the home page's JSON-LD). A policy governs
 * only scripts that run, so it needs no nonce (Task 4.0's probe 2: it raises no violation).
 */
export const isDataBlock = (tag: string): boolean =>
  /\btype="application\/(?:ld\+)?json"/i.test(tag);

/**
 * Records, before the page's scripts run, every policy violation the document reports and every
 * worker the page starts.
 */
export async function watchPolicy(page: Page): Promise<void> {
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

export const violations = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as { __violations: string[] }).__violations);
export const workers = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { __workers: number }).__workers);

/** The requests and sockets of a page, split by whether they stay on its origin. */
export type OriginWatch = { readonly inside: string[]; readonly outside: string[] };

/**
 * Keeps every request and socket `page` makes from now on, split by whether it leaves `origin`, and
 * stops each one that leaves in the browser (R4-58), keeping it in `outside` all the same. F-SEC5-03's
 * block, moved here. `origin` is an http or https origin with no path.
 */
export async function watchOrigin(page: Page, origin: string): Promise<OriginWatch> {
  if (typeof page !== "object" || page === null) {
    throw new TypeError(
      `watchOrigin: page must be a Page, got ${page === null ? "null" : typeof page}`,
    );
  }
  if (typeof origin !== "string") {
    throw new TypeError(`watchOrigin: origin must be a string, got ${typeof origin}`);
  }
  if (!URL.canParse(origin) || new URL(origin).origin !== origin || !/^https?:/.test(origin)) {
    throw new RangeError(
      `watchOrigin: origin must be an http or https origin with no path, got ${JSON.stringify(origin)}`,
    );
  }
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
  const watch: OriginWatch = { inside: [], outside: [] };
  page.on("request", (request) => {
    (leaves(new URL(request.url())) ? watch.outside : watch.inside).push(request.url());
  });
  // Playwright reports a WebSocket as a `websocket` event, never as a request.
  page.on("websocket", (socket) => {
    if (leaves(new URL(socket.url()))) watch.outside.push(socket.url());
  });
  // A request or a socket that leaves anyway goes no further than the browser (R4-58), and the
  // list keeps it.
  await page.route(leaves, (route) => route.abort());
  await page.routeWebSocket(leaves, (socket) => {
    watch.outside.push(socket.url());
    void socket.close();
  });
  return watch;
}
