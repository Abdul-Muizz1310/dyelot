import { type NextRequest, NextResponse } from "next/server";
import { cspHeader } from "@/lib/site/csp";

/**
 * A nonce-based Content Security Policy for every page (docs/specs/04-ai.md, R4-25). Each request
 * gets a fresh nonce; the policy goes on the forwarded request, where Next.js reads the nonce for
 * its own scripts, and on the response, where the browser enforces it. `x-nonce` hands the nonce
 * to any server component that needs it. The root layout's `connection()` makes every page render
 * per request (R4-26), since a prerendered page has no request to take a nonce from.
 */
export function proxy(request: NextRequest): NextResponse {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = cspHeader(nonce, { dev: process.env.NODE_ENV === "development" });

  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", policy);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

// Section 12.2. The proxy skips only Next's static files, its image optimizer and prefetches, so
// every HTML response carries the policy, a 404 under any other path included; the API's replies,
// the fonts and the metadata files carry it too, where it does no harm. A 404 under
// `/_next/static/` is the one HTML response left without it. Next.js reads the matcher at build
// time, so it stays a literal.
export const config = {
  matcher: [
    {
      source: "/((?!_next/static/|_next/image).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
