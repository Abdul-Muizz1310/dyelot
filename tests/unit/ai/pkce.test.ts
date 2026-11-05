import { describe, expect, it } from "vitest";
import { authorizeUrl, base64url, readCallback } from "@/ai/pkce";

// C-PKCE-01 and C-PKCE-02 of docs/specs/04-ai.md, section 14.9 (R4-33, section 10.4): the pure PKCE
// helpers. The shells make the random bytes and the digest; these only write and read text.

/** RFC 7636's example challenge: 43 base64url characters. */
const CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
const STATE = "abcdefghij0123456789_-";
const LOCAL = "http://localhost:3100/connect/callback";

/** Bytes that differ from one position to the next and cover every value of a byte. */
const bytesOf = (length: number) => Uint8Array.from({ length }, (_, i) => (i * 37 + 11) % 256);

describe("C-PKCE-01 base64url, authorizeUrl and readCallback", () => {
  it("C-PKCE-01 base64url writes no bytes as an empty string and [0xfb, 0xff] as -_8", () => {
    expect(base64url(new Uint8Array(0))).toBe("");
    expect(base64url(Uint8Array.of(0xfb, 0xff))).toBe("-_8");
  });

  it("C-PKCE-01 base64url writes 32 bytes in 43 characters and 16 in 22", () => {
    expect(base64url(bytesOf(32))).toHaveLength(43);
    expect(base64url(bytesOf(16))).toHaveLength(22);
    expect(base64url(new Uint8Array(32).fill(255))).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("C-PKCE-01 base64url agrees with Node's base64url (RFC 4648 section 5, no padding) for 0 to 64 bytes", () => {
    for (let length = 0; length <= 64; length += 1) {
      const bytes = bytesOf(length);
      expect(base64url(bytes), `${length} bytes`).toBe(Buffer.from(bytes).toString("base64url"));
    }
  });

  it("C-PKCE-01 authorizeUrl gives section 10.4's string for the local callback", () => {
    expect(authorizeUrl({ callbackUrl: LOCAL, challenge: CHALLENGE, state: STATE })).toBe(
      "https://openrouter.ai/auth?callback_url=http%3A%2F%2Flocalhost%3A3100%2Fconnect%2Fcallback" +
        `&code_challenge=${CHALLENGE}&code_challenge_method=S256&state=${STATE}&key_label=dyelot`,
    );
  });

  it.each([
    "https://dyelot.vercel.app/connect/callback",
    "http://127.0.0.1:3109/connect/callback",
    "http://localhost/connect/callback",
  ])("C-PKCE-01 authorizeUrl accepts the callback %s", (callbackUrl) => {
    const url = new URL(authorizeUrl({ callbackUrl, challenge: CHALLENGE, state: STATE }));
    expect(url.origin + url.pathname).toBe("https://openrouter.ai/auth");
    expect(url.searchParams.get("callback_url")).toBe(callbackUrl);
    expect([...url.searchParams.keys()]).toEqual([
      "callback_url",
      "code_challenge",
      "code_challenge_method",
      "state",
      "key_label",
    ]);
  });

  it("C-PKCE-01 readCallback reads the code and the state, with or without the question mark", () => {
    expect(readCallback("?code=C&state=S")).toEqual({ code: "C", state: "S" });
    expect(readCallback("code=C&state=S")).toEqual({ code: "C", state: "S" });
    expect(readCallback("?state=S&code=C%2BD")).toEqual({ code: "C+D", state: "S" });
  });

  it("C-PKCE-01 readCallback gives null for an absent, an empty and a 513-character value", () => {
    expect(readCallback("")).toEqual({ code: null, state: null });
    expect(readCallback("?other=1")).toEqual({ code: null, state: null });
    expect(readCallback("?code=&state=")).toEqual({ code: null, state: null });
    const long = "x".repeat(513);
    expect(readCallback(`?code=${long}&state=${long}`)).toEqual({ code: null, state: null });
    const edge = "y".repeat(512);
    expect(readCallback(`?code=${edge}&state=S`)).toEqual({ code: edge, state: "S" });
    expect(readCallback(`?code=C&state=${long}`)).toEqual({ code: "C", state: null });
  });
});

describe("C-PKCE-02 authorizeUrl refuses what it cannot send", () => {
  it.each([
    ["a host other than localhost over http", "http://example.com/connect/callback"],
    ["another path", "https://x/other"],
    ["a query", "https://x/connect/callback?next=1"],
    ["an empty query", "https://x/connect/callback?"],
    ["a hash", "https://x/connect/callback#top"],
    ["a trailing slash", "https://x/connect/callback/"],
    ["another protocol", "ftp://x/connect/callback"],
    ["credentials", "https://user:secret@x/connect/callback"],
    ["text that is not a URL", "connect/callback"],
    ["a URL not written as the browser writes it", "HTTPS://X/connect/callback"],
  ])("C-PKCE-02 throws RangeError naming itself for a callback with %s", (_, callbackUrl) => {
    expect(() => authorizeUrl({ callbackUrl, challenge: CHALLENGE, state: STATE })).toThrow(
      RangeError,
    );
    expect(() => authorizeUrl({ callbackUrl, challenge: CHALLENGE, state: STATE })).toThrow(
      /^authorizeUrl: /,
    );
  });

  it.each([
    ["a 42-character challenge", { challenge: CHALLENGE.slice(1) }],
    ["a 44-character challenge", { challenge: `${CHALLENGE}A` }],
    ["a challenge outside base64url", { challenge: `${CHALLENGE.slice(1)}+` }],
    ["a 21-character state", { state: STATE.slice(1) }],
    ["a 23-character state", { state: `${STATE}A` }],
    ["a state outside base64url", { state: `${STATE.slice(1)}=` }],
  ])("C-PKCE-02 throws RangeError naming itself for %s", (_, over) => {
    const args = { callbackUrl: LOCAL, challenge: CHALLENGE, state: STATE, ...over };
    expect(() => authorizeUrl(args)).toThrow(RangeError);
    expect(() => authorizeUrl(args)).toThrow(/^authorizeUrl: /);
  });

  it("C-PKCE-02 throws TypeError naming the function for arguments of the wrong type", () => {
    const wrong = (value: unknown) => value as never;
    expect(() => authorizeUrl(wrong(null))).toThrow(TypeError);
    expect(() =>
      authorizeUrl(wrong({ callbackUrl: 1, challenge: CHALLENGE, state: STATE })),
    ).toThrow(/^authorizeUrl: args\.callbackUrl must be a string/);
    expect(() =>
      authorizeUrl(wrong({ callbackUrl: LOCAL, challenge: null, state: STATE })),
    ).toThrow(TypeError);
    expect(() => authorizeUrl(wrong({ callbackUrl: LOCAL, challenge: CHALLENGE }))).toThrow(
      TypeError,
    );
    expect(() => base64url(wrong([1, 2]))).toThrow(/^base64url: bytes must be a Uint8Array/);
    expect(() => base64url(wrong(new ArrayBuffer(2)))).toThrow(TypeError);
    expect(() => readCallback(wrong(null))).toThrow(/^readCallback: search must be a string/);
  });
});
