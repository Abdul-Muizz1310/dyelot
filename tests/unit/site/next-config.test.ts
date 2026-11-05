// C-SITE4-02 of docs/specs/04-ai.md, section 14.8 (R4-25, R4-27, section 12.3).

import { describe, expect, it } from "vitest";
import nextConfig from "../../../next.config";

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
    const site = rules.find((rule) => rule.source === "/:path*");
    const keys = (site?.headers ?? []).map((header) => header.key.toLowerCase());
    expect(keys).not.toContain("content-security-policy");
    expect(keys).not.toContain("content-security-policy-report-only");
  });
});
