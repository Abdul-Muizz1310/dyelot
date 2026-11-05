import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `import text from "./file.mjs?raw"` is the file's text: the export layer ships the checker script
  // byte for byte and reads it through `CHECKER_SOURCE` (spec R3-39). Vitest handles `?raw` itself.
  turbopack: {
    rules: {
      "*.mjs": { condition: { query: /[?&]raw(?=&|$)/ }, type: "raw" },
    },
  },
  // The headers every route shares, the house pattern from inkthread-frontend. The page policy is
  // not here: the proxy (src/proxy.ts) sends it with a fresh nonce per request
  // (docs/specs/04-ai.md, R4-25), and the AI routes, which the proxy skips, set their own (R4-24).
  // Permissions-Policy lets dyelot's pages use the browser's language model and denies the camera,
  // the microphone and geolocation (R4-27).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "language-model=(self), camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
