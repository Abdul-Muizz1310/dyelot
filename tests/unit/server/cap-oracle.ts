import { createHmac, hkdfSync } from "node:crypto";
import { TEST_SECRET } from "../ai/fixtures";

// The cap cookie's oracle (docs/specs/04-ai.md, C-CAP-01): node:crypto's HKDF and HMAC, apart from
// the Web Crypto that src/server/ai/cap.ts uses, so a test can sign a cookie without the code under
// test.

/** The secret's bytes, the base64 of section 4 decoded: the bytes 0 to 31. */
export const SECRET_BYTES = Uint8Array.from(Buffer.from(TEST_SECRET, "base64"));

/** The cap cookie's MAC: HKDF-SHA256 (empty salt, info `dyelot/ai-cap/v1`, 32 bytes), then HMAC-SHA256. */
export function oracleMac(day: string, count: number, secret: Uint8Array = SECRET_BYTES): string {
  const key = Buffer.from(hkdfSync("sha256", secret, new Uint8Array(0), "dyelot/ai-cap/v1", 32));
  return createHmac("sha256", key).update(`v1.${day}.${count}`).digest("base64url");
}
