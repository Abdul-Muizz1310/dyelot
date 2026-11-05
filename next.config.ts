import type { NextConfig } from "next";

// Security headers, the house pattern from inkthread-frontend. dyelot calls no API yet, so
// `connect-src` stays on the page's own origin. `worker-src` and `img-src` allow `blob:` for the
// in-browser image and video work planned for later milestones. A later milestone replaces
// `'unsafe-inline'` with a nonce-based policy (design spec, section 10).
//
// In development React needs `'unsafe-eval'` to rebuild server stack traces in the browser, and
// hot reload needs a WebSocket to the dev server. A production build allows neither.
const isDev = process.env.NODE_ENV !== "production";

const policy = [
  "default-src 'self'",
  "base-uri 'self'",
  "font-src 'self' data:",
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "worker-src 'self' blob:",
  `connect-src 'self'${isDev ? " ws: http://localhost:*" : ""}`,
  "frame-ancestors 'none'",
  "object-src 'none'",
];

const contentSecurityPolicy = `${policy.join("; ")};`;

const nextConfig: NextConfig = {
  // `import text from "./file.mjs?raw"` is the file's text: the export layer ships the checker script
  // byte for byte and reads it through `CHECKER_SOURCE` (spec R3-39). Vitest handles `?raw` itself.
  turbopack: {
    rules: {
      "*.mjs": { condition: { query: /[?&]raw(?=&|$)/ }, type: "raw" },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
