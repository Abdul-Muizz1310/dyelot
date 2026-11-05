// C-SITE4-02 of docs/specs/04-ai.md, section 14.8 (R4-25, R4-27, R4-33, section 12.3).

import { AsyncLocalStorage } from "node:async_hooks";
import { describe, expect, it } from "vitest";
import nextConfig from "../../../next.config";

// Next's config resolver reads `AsyncLocalStorage` from the global scope, which its own server sets
// up and Vitest does not.
(globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage ??= AsyncLocalStorage;

/** The headers Next.js itself resolves from `next.config.ts` for a path, as a server sends them. */
async function resolved(path: string): Promise<Headers> {
  const { unstable_getResponseFromNextConfig } = await import("next/experimental/testing/server");
  const response = await unstable_getResponseFromNextConfig({
    url: new URL(path, "https://dyelot.vercel.app").href,
    nextConfig,
  });
  return response.headers;
}

describe("C-SITE4-02 next.config.ts sends the other headers and no policy", () => {
  it("C-SITE4-02 gives /:path* exactly 12.3's four headers", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const site = rules.filter((rule) => rule.source === "/:path*");
    expect(site).toHaveLength(1);
    expect(site[0]?.headers).toEqual([
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "language-model=(self), camera=(), microphone=(), geolocation=()",
      },
    ]);
  });

  it("C-SITE4-02 sets no Content-Security-Policy, which the proxy owns", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const keys = rules.flatMap((rule) => rule.headers.map((header) => header.key.toLowerCase()));
    expect(keys).not.toContain("content-security-policy");
    expect(keys).not.toContain("content-security-policy-report-only");
  });

  it("C-SITE4-02 gives /connect/callback no-referrer in a rule after /:path*", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    expect(rules.map((rule) => rule.source)).toEqual(["/:path*", "/connect/callback"]);
    expect(rules[1]?.headers).toEqual([{ key: "Referrer-Policy", value: "no-referrer" }]);
  });

  it.each([
    ["/connect/callback", "no-referrer"],
    ["/connect/callback?code=c&state=s", "no-referrer"],
    ["/connect", "strict-origin-when-cross-origin"],
    ["/connect/callbackx", "strict-origin-when-cross-origin"],
    ["/studio", "strict-origin-when-cross-origin"],
  ])("C-SITE4-02 Next.js resolves %s's Referrer-Policy to %s", async (path, policy) => {
    const headers = await resolved(path);
    expect(headers.get("referrer-policy")).toBe(policy);
    expect(headers.get("x-frame-options")).toBe("DENY");
    expect(headers.get("permissions-policy")).toBe(
      "language-model=(self), camera=(), microphone=(), geolocation=()",
    );
  });
});
