// C-CSP-01 and C-CSP-02 of docs/specs/04-ai.md, section 14.8 (R4-25, section 12.1, R-05).

import { describe, expect, it } from "vitest";
import { cspHeader } from "@/lib/site/csp";

const NONCE = "bm9uY2Utbm9uY2Utbm9uY2U=";

/** Section 12.1's string for `dev: false`, written out with its nonce. */
const PRODUCTION =
  "default-src 'self'; base-uri 'self'; font-src 'self' data:; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'nonce-bm9uY2Utbm9uY2Utbm9uY2U=' 'strict-dynamic'; worker-src 'self' blob:; connect-src 'self' https://openrouter.ai; frame-ancestors 'none'; object-src 'none'; form-action 'self';";

/** The same, with `'unsafe-eval'` after `'strict-dynamic'` and the development `connect-src`. */
const DEVELOPMENT =
  "default-src 'self'; base-uri 'self'; font-src 'self' data:; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'nonce-bm9uY2Utbm9uY2Utbm9uY2U=' 'strict-dynamic' 'unsafe-eval'; worker-src 'self' blob:; connect-src 'self' https://openrouter.ai ws: http://localhost:*; frame-ancestors 'none'; object-src 'none'; form-action 'self';";

describe("C-CSP-01 cspHeader writes section 12.1's policy", () => {
  it("C-CSP-01 gives 12.1's string exactly for dev: false", () => {
    expect(cspHeader(NONCE, { dev: false })).toBe(PRODUCTION);
  });

  it("C-CSP-01 adds 'unsafe-eval' and the development connect-src sources for dev: true", () => {
    expect(cspHeader(NONCE, { dev: true })).toBe(DEVELOPMENT);
  });

  it.each([
    ["the 16-character minimum", "abcdefghijklmnop"],
    ["one padding character", "abcdefghijklmnopq="],
    ["two padding characters", "abcdefghijklmnop=="],
    ["the proxy's 48-character shape", "MDEyMzQ1NjctODlhYi1jZGVmLTAxMjMtNDU2Nzg5YWJjZGVm"],
    ["+ and /", "ab+/cdefghijklmn"],
  ])("C-CSP-01 accepts a nonce at %s", (_, nonce) => {
    expect(cspHeader(nonce, { dev: false })).toContain(
      `script-src 'self' 'nonce-${nonce}' 'strict-dynamic';`,
    );
  });
});

describe("C-CSP-02 cspHeader rejects a bad nonce or option", () => {
  it.each([
    ["empty", ""],
    ["with a space", "a b"],
    ["too short", "abc"],
    ["one under the minimum", "abcdefghijklmno"],
    ["with a quote", "bm9uY2Utbm9uY2Utbm9u'Y2U="],
    ["with a semicolon", "bm9uY2Utbm9uY2U;script-src *"],
    ["with three padding characters", "abcdefghijklmnop==="],
    ["padded in the middle", "abcdefgh=ijklmnop"],
  ])("C-CSP-02 throws RangeError naming cspHeader for a nonce %s", (_, nonce) => {
    expect(() => cspHeader(nonce, { dev: false })).toThrow(RangeError);
    expect(() => cspHeader(nonce, { dev: false })).toThrow(/^cspHeader\b/);
  });

  it.each([
    ['dev of "yes"', NONCE, { dev: "yes" }],
    ["dev missing", NONCE, {}],
    ["options of null", NONCE, null],
    ["options of a string", NONCE, "dev"],
    ["a nonce that is not a string", 42, { dev: false }],
  ])("C-CSP-02 throws TypeError naming cspHeader for %s", (_, nonce, options) => {
    expect(() => cspHeader(nonce as never, options as never)).toThrow(TypeError);
    expect(() => cspHeader(nonce as never, options as never)).toThrow(/^cspHeader\b/);
  });
});
