// C-PROXY-01 and C-PROXY-02 of docs/specs/04-ai.md, section 14.8 (R4-25, sections 12.1 and 12.2).

import { NextRequest, type NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cspHeader } from "@/lib/site/csp";
import { config, proxy } from "@/proxy";

const NONCE = /^[A-Za-z0-9+/]{48}$/;

/**
 * A request header the proxy forwards to the render. `NextResponse.next({ request: { headers } })`
 * carries each one to the server as `x-middleware-request-<name>`, listed in
 * `x-middleware-override-headers`; the server reads them there.
 */
function forwarded(response: NextResponse, name: string): string | null {
  const overridden = (response.headers.get("x-middleware-override-headers") ?? "").split(",");
  if (!overridden.includes(name)) return null;
  return response.headers.get(`x-middleware-request-${name}`);
}

function run(path = "/studio"): NextResponse {
  return proxy(new NextRequest(new URL(path, "http://localhost:3100")));
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("C-PROXY-01 the proxy puts one fresh nonce on the request and the response", () => {
  it("C-PROXY-01 forwards x-nonce and the policy, and sends the same policy back", () => {
    const response = run();
    const nonce = forwarded(response, "x-nonce");
    expect(nonce).toMatch(NONCE);
    const policy = cspHeader(nonce as string, { dev: false });
    expect(forwarded(response, "content-security-policy")).toBe(policy);
    expect(response.headers.get("content-security-policy")).toBe(policy);
  });

  it("C-PROXY-01 lets the request through to the page, with no redirect or rewrite", () => {
    const response = run("/connect");
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.headers.get("location")).toBeNull();
  });

  it("C-PROXY-01 makes a different nonce on each call", () => {
    const first = forwarded(run(), "x-nonce");
    const second = forwarded(run(), "x-nonce");
    expect(first).toMatch(NONCE);
    expect(second).toMatch(NONCE);
    expect(first).not.toBe(second);
  });

  it("C-PROXY-01 sends the development policy only when NODE_ENV is development", () => {
    vi.stubEnv("NODE_ENV", "development");
    const response = run();
    const nonce = forwarded(response, "x-nonce") as string;
    expect(response.headers.get("content-security-policy")).toBe(cspHeader(nonce, { dev: true }));
  });

  /** R4-24's policy, written out: what the proxy sends for every path under `/api/`. */
  const API_POLICY = "default-src 'none'; frame-ancestors 'none';";

  it.each(["/api/ai/brief", "/api/ai/models", "/api/nope", "/api/"])(
    "C-PROXY-01 sends R4-24's policy for %s and forwards no nonce",
    (path) => {
      const response = run(path);
      expect(response.headers.get("content-security-policy")).toBe(API_POLICY);
      expect(response.headers.get("x-middleware-override-headers")).toBeNull();
      expect(forwarded(response, "x-nonce")).toBeNull();
      expect(forwarded(response, "content-security-policy")).toBeNull();
      expect(response.headers.get("x-middleware-next")).toBe("1");
    },
  );

  it("C-PROXY-01 sends R4-24's policy under /api/ in development too", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(run("/api/ai/brief").headers.get("content-security-policy")).toBe(API_POLICY);
  });

  it.each(["/studio", "/robots.txtx", "/api", "/apix", "/x/api/y"])(
    "C-PROXY-01 sends the nonce page policy for %s, which is not under /api/",
    (path) => {
      const response = run(path);
      const nonce = forwarded(response, "x-nonce");
      expect(nonce).toMatch(NONCE);
      const policy = cspHeader(nonce as string, { dev: false });
      expect(forwarded(response, "content-security-policy")).toBe(policy);
      expect(response.headers.get("content-security-policy")).toBe(policy);
    },
  );
});

describe("C-PROXY-02 the matcher skips only Next's static files, its image optimizer and prefetches", () => {
  const [matcher] = config.matcher;
  const pattern = new RegExp(`^${matcher.source}$`);

  // Every HTML response carries the policy, a 404 under any path included (section 12.2). The
  // API's replies, the fonts and the metadata files carry it too, where it does no harm.
  it.each([
    "/",
    "/studio",
    "/connect",
    "/connect/callback",
    "/no-such-page",
    "/api/ai/brief",
    "/api/ai/models",
    "/api/nope",
    "/fonts/x.woff2",
    "/fonts/nope",
    "/favicon.ico",
    "/icon.svg",
    "/apple-icon.png",
    "/icon-192.png",
    "/icon-512.png",
    "/icon-maskable-512.png",
    "/opengraph-image",
    "/opengraph-image-abc",
    "/robots.txt",
    "/robots.txtx",
    "/sitemap.xml",
    "/manifest.webmanifest",
  ])("C-PROXY-02 matches %s", (path) => {
    expect(pattern.test(path)).toBe(true);
  });

  it.each(["/_next/static/a.js", "/_next/static/chunks/x.css", "/_next/image"])(
    "C-PROXY-02 skips %s",
    (path) => {
      expect(pattern.test(path)).toBe(false);
    },
  );

  it("C-PROXY-02 is section 12.2's matcher, missing both prefetch headers", () => {
    expect(config).toEqual({
      matcher: [
        {
          source: "/((?!_next/static/|_next/image).*)",
          missing: [
            { type: "header", key: "next-router-prefetch" },
            { type: "header", key: "purpose", value: "prefetch" },
          ],
        },
      ],
    });
  });
});
