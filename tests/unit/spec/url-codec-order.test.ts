import { beforeEach, describe, expect, it, vi } from "vitest";
import { decodeSpec, encodeSpec } from "@/spec/url-codec";
import { ALPHABET, decodeError, defaultSpec } from "./support";

// The decoder's order (spec 6.7, R-22) and its failure modes, seen through a spy on fflate.

const fflate = vi.hoisted(() => ({ inflaters: 0, failUtf8: false }));

vi.mock("fflate", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fflate")>();
  class CountingInflate extends actual.Inflate {
    constructor(...args: ConstructorParameters<typeof actual.Inflate>) {
      super(...args);
      fflate.inflaters += 1;
    }
  }
  return {
    ...actual,
    Inflate: CountingInflate,
    strFromU8: (...args: Parameters<typeof actual.strFromU8>) => {
      if (fflate.failUtf8) throw new TypeError("invalid utf-8 data");
      return actual.strFromU8(...args);
    },
  };
});

beforeEach(() => {
  fflate.inflaters = 0;
  fflate.failUtf8 = false;
});

const link = encodeSpec(defaultSpec());

describe("decodeSpec order", () => {
  it("C-URL-16 inflates a link whose trailer matches", () => {
    decodeSpec(link);
    expect(fflate.inflaters).toBe(1);
  });

  it("C-URL-16 checks the trailer before it inflates anything", () => {
    const last = link.length - 2;
    const swapped = ALPHABET[(ALPHABET.indexOf(link[last]) + 1) % 64];
    const tampered = `${link.slice(0, last)}${swapped}${link.slice(last + 1)}`;
    expect(decodeError(() => decodeSpec(tampered)).reason).toBe("corrupt");
    expect(fflate.inflaters).toBe(0);
  });

  it("C-URL-16 reports a UTF-8 decoder that throws as corrupt, never as another error", () => {
    fflate.failUtf8 = true;
    const failure = decodeError(() => decodeSpec(link));
    expect(failure.reason).toBe("corrupt");
    expect(failure.message).toMatch(/UTF-8/);
  });
});
