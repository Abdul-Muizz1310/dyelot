import { assertString } from "./guards";

// The dye-lot tag of the studio header (spec section 5.7): the first eight hex digits of a spec id.

const SPEC_ID = /^[0-9a-f]{16}$/;

/** `"0123456789abcdef"` gives `"0123·4567"`, with U+00B7 between the groups (C-STORE-32). */
export function lotTag(id: string): string {
  assertString(id, "lotTag: id");
  if (!SPEC_ID.test(id)) {
    throw new RangeError(`lotTag: id must be 16 lowercase hex digits, got ${JSON.stringify(id)}`);
  }
  return `${id.slice(0, 4)}·${id.slice(4, 8)}`;
}
