/**
 * The page's Content Security Policy (docs/specs/04-ai.md, R4-25 and section 12.1). The proxy calls
 * this once per request with a fresh nonce; Next.js reads the nonce back from the request's policy
 * and puts it on its own scripts, and `'strict-dynamic'` lets those scripts load the rest.
 *
 * `style-src` keeps `'unsafe-inline'`: the canvas sets CSS variables in `style` attributes, which a
 * nonce cannot cover. Development adds `'unsafe-eval'` (React rebuilds server stack traces with it)
 * and the hot-reload WebSocket; a production build allows neither.
 */

/**
 * The API's policy (R4-24): a reply under `/api/` runs nothing and loads nothing, so it needs no
 * nonce. The proxy sends it for every path under `/api/`, a 404 page there included.
 */
export const API_CSP = "default-src 'none'; frame-ancestors 'none';";

/** Base64 of at least 16 characters, so a nonce cannot close its quote or start a directive. */
const NONCE = /^[A-Za-z0-9+/]{16,}={0,2}$/;

export type CspOptions = { dev: boolean };

function typeName(value: unknown): string {
  return value === null ? "null" : typeof value;
}

export function cspHeader(nonce: string, options: CspOptions): string {
  // Every argument's type before any value's domain (R-05), so a wrong type is always a TypeError.
  if (typeof nonce !== "string") {
    throw new TypeError(`cspHeader: nonce must be a string, got ${typeName(nonce)}`);
  }
  if (typeof options !== "object" || options === null) {
    throw new TypeError(`cspHeader: options must be an object, got ${typeName(options)}`);
  }
  const { dev } = options;
  if (typeof dev !== "boolean") {
    throw new TypeError(`cspHeader: options.dev must be a boolean, got ${typeName(dev)}`);
  }
  if (!NONCE.test(nonce)) {
    throw new RangeError(
      `cspHeader: nonce must be base64 of at least 16 characters, got ${JSON.stringify(nonce)}`,
    );
  }

  const policy = [
    "default-src 'self'",
    "base-uri 'self'",
    "font-src 'self' data:",
    "img-src 'self' data: blob:",
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "worker-src 'self' blob:",
    `connect-src 'self' https://openrouter.ai https://www.remotion.pro${dev ? " ws: http://localhost:*" : ""}`,
    "frame-ancestors 'none'",
    "object-src 'none'",
    "form-action 'self'",
  ];
  return `${policy.join("; ")};`;
}
