import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `import text from "./file.mjs?raw"` is the file's text: the export layer ships the checker script
  // byte for byte and reads it through `CHECKER_SOURCE` (spec R3-39). The prompt files of src/ai/prompts are read the same way (R4-27, R4-51). Vitest handles `?raw` itself.
  turbopack: {
    rules: {
      "*.mjs": { condition: { query: /[?&]raw(?=&|$)/ }, type: "raw" },
      "*.md": { condition: { query: /[?&]raw(?=&|$)/ }, type: "raw" },
    },
  },
  // The headers every route shares, the house pattern from inkthread-frontend. The policy is not
  // here: the proxy (src/proxy.ts) sends it, with a fresh nonce per request, on every response but
  // Next's static files (docs/specs/04-ai.md, R4-25 and section 12.2). Permissions-Policy lets
  // dyelot's pages use the browser's language model and denies the camera, the microphone and
  // geolocation (R4-27).
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
      // The callback's address holds the sign-in's code and state, so no request it starts, not
      // even one the browser makes before it reads the page's meta tag, sends a Referer (R4-33).
      // When two rules set one header, the last wins (headers.md, "Header Overriding Behavior").
      {
        source: "/connect/callback",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },
};

export default nextConfig;
