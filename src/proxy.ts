import { type NextRequest, NextResponse } from "next/server";
import { API_CSP, cspHeader } from "@/lib/site/csp";

/**
 * A nonce-based Content Security Policy for every page (docs/specs/04-ai.md, R4-25). Each request
 * gets a fresh nonce; the policy goes on the forwarded request, where Next.js reads the nonce for
 * its own scripts, and on the response, where the browser enforces it. `x-nonce` hands the nonce
 * to any server component that needs it. The root layout's `connection()` makes every page render
 * per request (R4-26), since a prerendered page has no request to take a nonce from.
 *
 * Under `/api/` the response gets R4-24's policy instead, and the request no nonce: an API reply,
 * or a 404 page there, runs no script. Next.js sends a route handler's own policy only when the
 * proxy has set none, so this is the policy on the wire.
 */
export function proxy(request: NextRequest): NextResponse {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const response = NextResponse.next();
    response.headers.set("Content-Security-Policy", API_CSP);
    return response;
  }

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
// every HTML response carries a policy, a 404 under any other path included; the fonts and the
// metadata files carry the page policy too, where it does no harm. A 404 under `/_next/static/`
// or `/_next/image` has none, and Next.js answers it as plain text. Next.js reads the matcher at
// build time, so it stays a literal.
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
