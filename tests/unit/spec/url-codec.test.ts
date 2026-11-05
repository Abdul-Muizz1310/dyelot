import { deflateRawSync, inflateRawSync } from "node:zlib";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { generateSystem } from "@/engine/generate";
import { canonicalize } from "@/spec/canonical";
import { fnv1a64, specId } from "@/spec/hash";
import { type DesignSpec, DesignSpecSchema } from "@/spec/schema";
import { decodeSpec, encodeSpec, SpecDecodeError } from "@/spec/url-codec";
import {
  ALPHABET,
  anyDirection,
  anySeedText,
  DEFAULT_PARAMS,
  decodeError,
  defaultSpec,
  linkBytes,
  linkOfDeflated,
  linkOfJson,
  linkOfText,
  PROPERTY_TIMEOUT,
  richSpec,
  shuffled,
  storedBlock,
  without,
  withValue,
} from "./support";

// Cases are the C-URL-nn rows of docs/specs/01-color-engine.md, section 6.7, and R-22.

const as = (value: unknown): DesignSpec => value as DesignSpec;
const replaceAt = (text: string, at: number, char: string): string =>
  text.slice(0, at) + char + text.slice(at + 1);
const ONE_MIB = 1024 * 1024;
/** U+FEFF, built from its code so no invisible character sits in the source. */
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

/** Decodes each changed link and counts the reasons; anything but SpecDecodeError throws. */
function reasonsOf(
  links: Iterable<string>,
): Record<"accepted" | SpecDecodeError["reason"], number> {
  const counts = { accepted: 0, corrupt: 0, version: 0, schema: 0 };
  for (const link of links) {
    try {
      decodeSpec(link);
      counts.accepted++;
    } catch (error) {
      if (!(error instanceof SpecDecodeError)) throw error;
      counts[error.reason]++;
    }
  }
  return counts;
}

/**
 * C-URL-14: the characters that overlap the final deflate byte, from index
 * floor(8 × (d − 1) / 6) to floor((8 × d − 1) / 6), where d is the deflate length.
 */
function finalBytePositions(link: string): number[] {
  const d = linkBytes(link).length - 8;
  const from = Math.floor((8 * (d - 1)) / 6);
  const to = Math.floor((8 * d - 1) / 6);
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

/** Whether Node's zlib inflates `deflated` to exactly `text`. */
function inflatesTo(deflated: Uint8Array, text: string): boolean {
  try {
    return inflateRawSync(deflated).toString("utf8") === text;
  } catch {
    return false;
  }
}

/** Every change of the characters at `positions` to each of the 63 other alphabet characters. */
function* changes(link: string, positions: Iterable<number>): Generator<string> {
  for (const at of positions) {
    for (const char of ALPHABET) if (char !== link[at]) yield replaceAt(link, at, char);
  }
}

describe("encodeSpec and decodeSpec", () => {
  it(
    "C-URL-01 round-trips any generated spec",
    () => {
      fc.assert(
        fc.property(anyDirection, anySeedText, (params, seed) => {
          const spec = generateSystem(params, seed);
          const decoded = decodeSpec(encodeSpec(spec));
          expect(decoded).toEqual(spec);
          expect(canonicalize(decoded)).toBe(canonicalize(spec));
        }),
        { numRuns: 50 },
      );
    },
    PROPERTY_TIMEOUT,
  );

  it("C-URL-01 round-trips names in any plain script and seeds in any script, lone surrogates in seeds only", () => {
    for (const name of [
      "Caf\u00e9 \u2211 \u8272 \u{1f3a8}",
      "plain high",
      'quote " and \\ slash',
    ]) {
      const spec = as(withValue(defaultSpec(), ["meta", "name"], name));
      expect(decodeSpec(encodeSpec(spec))).toEqual(spec);
    }
    for (const seed of ["seed \ud800 lone high", "seed \udc00 lone low", "\u8272 \u{1f3a8}"]) {
      const spec = as(withValue(defaultSpec(), ["meta", "seed"], seed));
      expect(decodeSpec(encodeSpec(spec))).toEqual(spec);
    }
  });

  it(
    "C-URL-02 rejects every one-character change at every 7th position and the last 12",
    () => {
      const link = encodeSpec(defaultSpec());
      const positions = new Set<number>();
      for (let at = 0; at < link.length; at += 7) positions.add(at);
      for (let at = Math.max(0, link.length - 12); at < link.length; at++) positions.add(at);
      const counts = reasonsOf(changes(link, positions));
      expect(counts).toEqual({ accepted: 0, corrupt: positions.size * 63, version: 0, schema: 0 });
    },
    PROPERTY_TIMEOUT,
  );

  it("C-URL-03 rejects a truncated link and the empty string as corrupt", () => {
    const link = encodeSpec(defaultSpec());
    const n = link.length;
    for (const length of [1, Math.floor(n / 2), n - 1]) {
      expect(decodeError(() => decodeSpec(link.slice(0, length))).reason).toBe("corrupt");
    }
    expect(decodeError(() => decodeSpec("")).reason).toBe("corrupt");
    // Every other prefix too (R-22 measured none of 18,904 decoding).
    const prefixes = Array.from({ length: n - 1 }, (_, i) => link.slice(0, i + 1));
    expect(reasonsOf(prefixes)).toEqual({ accepted: 0, corrupt: n - 1, version: 0, schema: 0 });
  });

  it("C-URL-04 rejects a valid payload of another version with reason version", () => {
    for (const version of ["dyelot.spec/2", "dyelot.spec/1.1", ""]) {
      const future = withValue(defaultSpec(), ["version"], version);
      const error = decodeError(() => decodeSpec(linkOfJson(future)));
      expect(error.reason).toBe("version");
      expect(error.issues).toBeUndefined();
    }
    // The version check runs before the schema: a future spec may change any other field.
    const reshaped = { version: "dyelot.spec/2", palette: ["#ffffff"] };
    expect(decodeError(() => decodeSpec(linkOfJson(reshaped))).reason).toBe("version");
  });

  it("C-URL-05 rejects JSON without a version string, or failing the schema, with its paths", () => {
    const cases: ReadonlyArray<readonly [unknown, string]> = [
      [without(defaultSpec(), ["version"]), "version"],
      [withValue(defaultSpec(), ["version"], 7), "version"],
      [withValue(defaultSpec(), ["version"], null), "version"],
      [
        withValue(defaultSpec(), ["color", "palettes", "primary", "hue"], 400),
        "color.palettes.primary.hue",
      ],
      [without(defaultSpec(), ["color", "roles", "light", "ring"]), "color.roles.light.ring"],
      [withValue(defaultSpec(), ["color", "extra"], 1), "color"],
      [[1, 2, 3], "(root)"],
      ["dyelot.spec/1", "(root)"],
      [null, "(root)"],
    ];
    for (const [payload, path] of cases) {
      const error = decodeError(() => decodeSpec(linkOfJson(payload)));
      expect(error.reason, path).toBe("schema");
      expect(error.issues, path).toContain(path);
      expect(error.message).toContain("1 path fails");
    }
  });

  it("C-URL-05 lists every failing path once, in order", () => {
    const hue = ["color", "palettes", "primary", "hue"];
    const broken = without(withValue(defaultSpec(), hue, 400), ["color", "roles", "light", "ring"]);
    const twice = withValue(broken, ["color", "palettes", "accent", "hue"], -1);
    const error = decodeError(() => decodeSpec(linkOfJson(twice)));
    expect(error.reason).toBe("schema");
    expect(error.issues).toEqual([
      "color.palettes.primary.hue",
      "color.palettes.accent.hue",
      "color.roles.light.ring",
    ]);
    expect(error.message).toContain("3 paths fail");
  });

  it("C-URL-06 rejects +, /, =, a space or % anywhere in the link", () => {
    const link = encodeSpec(defaultSpec());
    for (const char of ["+", "/", "=", " ", "%"]) {
      for (const at of [0, Math.floor(link.length / 2), link.length - 1]) {
        expect(decodeError(() => decodeSpec(replaceAt(link, at, char))).reason).toBe("corrupt");
      }
      const inserted = link.slice(0, 10) + char + link.slice(10);
      expect(decodeError(() => decodeSpec(inserted)).reason).toBe("corrupt");
    }
    for (const padded of [`${link}=`, `${link}==`, `${link}\n`, ` ${link}`]) {
      expect(decodeError(() => decodeSpec(padded)).reason).toBe("corrupt");
    }
  });

  it("C-URL-07 rejects a link over 65,536 characters before decoding it", () => {
    expect(decodeError(() => decodeSpec("A".repeat(65_537))).reason).toBe("corrupt");
    // A link that is valid in every other way: one stored deflate block of the canonical text,
    // padded with spaces (valid JSON), then the trailer. 49,152 bytes make 65,536 characters.
    const canonical = canonicalize(defaultSpec());
    const linkOfSize = (bytes: number): string => {
      const text = canonical + " ".repeat(bytes - 8 - 5 - canonical.length);
      return linkOfDeflated(storedBlock(Buffer.from(text, "utf8")));
    };
    const atLimit = linkOfSize(49_152);
    expect(atLimit).toHaveLength(65_536);
    expect(decodeSpec(atLimit)).toEqual(defaultSpec());
    const over = linkOfSize(49_153);
    expect(over).toHaveLength(65_538);
    expect(decodeError(() => decodeSpec(over)).reason).toBe("corrupt");
  });

  it("C-URL-07 stops inflating at 1 MiB", () => {
    const canonical = canonicalize(defaultSpec());
    const padded = (bytes: number) => linkOfText(canonical + " ".repeat(bytes - canonical.length));
    expect(decodeSpec(padded(ONE_MIB))).toEqual(defaultSpec());
    expect(decodeError(() => decodeSpec(padded(ONE_MIB + 1))).reason).toBe("corrupt");
    // A deflate bomb: 32 MiB of zeros in a link of a few hundred characters.
    const bomb = linkOfDeflated(deflateRawSync(new Uint8Array(32 * ONE_MIB), { level: 9 }));
    expect(bomb.length).toBeLessThan(65_536);
    expect(decodeError(() => decodeSpec(bomb)).reason).toBe("corrupt");
  });

  it(
    "C-URL-08 keeps the default spec's link under 12,000 characters, for 21 seeds",
    () => {
      const seeds = Array.from({ length: 21 }, (_, i) => `seed-${i + 1}`);
      for (const seed of seeds) {
        const length = encodeSpec(generateSystem(DEFAULT_PARAMS, seed)).length;
        expect(length, seed).toBeLessThan(12_000);
      }
    },
    PROPERTY_TIMEOUT,
  );

  it("C-URL-09 writes base64url without padding, the same for the same spec", () => {
    const link = encodeSpec(defaultSpec());
    expect(link).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(encodeSpec(defaultSpec())).toBe(link);
    expect(encodeSpec(as(shuffled(defaultSpec(), "another key order")))).toBe(link);
    expect(encodeSpec(structuredClone(defaultSpec()))).toBe(link);
  });

  it("C-URL-10 ends with FNV-1a 64 of the deflate-raw stream before it", () => {
    for (const spec of [defaultSpec(), richSpec()]) {
      const link = encodeSpec(spec);
      const bytes = linkBytes(link);
      const deflated = bytes.subarray(0, bytes.length - 8);
      expect(bytes.subarray(bytes.length - 8).toString("hex")).toBe(fnv1a64(deflated));
      // The stream is deflate-raw of the canonical text, as Node's zlib reads it.
      expect(inflateRawSync(deflated).toString("utf8")).toBe(canonicalize(spec));
      expect(specId(decodeSpec(link))).toBe(specId(spec));
    }
  });

  it("C-URL-11 names the reason in a SpecDecodeError and never echoes the payload", () => {
    const secret = "do-not-echo-this-name";
    const errors = [
      decodeError(() => decodeSpec(`${secret}+`)),
      decodeError(() => decodeSpec(linkOfText(`{"name":"${secret}"`))),
      decodeError(() => decodeSpec(linkOfJson({ version: secret }))),
      decodeError(() =>
        decodeSpec(
          linkOfJson(
            withValue(
              withValue(defaultSpec(), ["meta", "name"], secret),
              ["color", "palettes", "primary", "hue"],
              400,
            ),
          ),
        ),
      ),
    ];
    expect(errors.map((error) => error.reason)).toEqual([
      "corrupt",
      "corrupt",
      "version",
      "schema",
    ]);
    for (const error of errors) {
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("SpecDecodeError");
      expect(error.message).toContain(error.reason);
      expect(error.message).not.toContain(secret);
    }
    const link = encodeSpec(defaultSpec());
    const corrupt = decodeError(() => decodeSpec(link.slice(0, -1)));
    expect(corrupt.message).not.toContain(link.slice(0, 40));
    expect(corrupt.issues).toBeUndefined();
  });

  it("C-URL-12 returns a spec or throws SpecDecodeError for any string", () => {
    const anyText = fc.oneof(
      fc.string({ maxLength: 300 }),
      fc.string({ unit: "binary", maxLength: 100 }),
      fc.stringMatching(/^[A-Za-z0-9_-]{0,300}$/),
    );
    fc.assert(
      fc.property(anyText, (text) => {
        try {
          DesignSpecSchema.parse(decodeSpec(text));
        } catch (error) {
          expect(error).toBeInstanceOf(SpecDecodeError);
        }
      }),
      { numRuns: 500 },
    );
  });

  it("C-URL-12 rejects any single-character change to a valid link", () => {
    const link = encodeSpec(defaultSpec());
    fc.assert(
      fc.property(
        fc.nat({ max: link.length - 1 }),
        fc.string({ unit: "binary", minLength: 1, maxLength: 1 }),
        (at, char) => {
          const changed = replaceAt(link, at, char);
          if (changed === link) {
            expect(decodeSpec(changed)).toEqual(defaultSpec());
            return;
          }
          expect(decodeError(() => decodeSpec(changed)).reason).toBe("corrupt");
        },
      ),
      { numRuns: 500 },
    );
  });

  it("C-URL-13 decodes to a value that passes DesignSpecSchema", () => {
    for (const spec of [defaultSpec(), richSpec()]) {
      const decoded = decodeSpec(encodeSpec(spec));
      expect(DesignSpecSchema.parse(decoded)).toEqual(decoded);
    }
  });

  it("C-URL-15 normalizes a valid payload that is not in canonical form", () => {
    const spec = defaultSpec();
    const path = ["color", "palettes", "primary", "light", 6, "contrast"] as const;
    const contrast = spec.color.palettes.primary.light[6].contrast;
    // Shuffled keys, a number past 6 significant digits and a hue that rounds to 360 all pass the
    // schema; decodeSpec stores them as canonicalize would.
    const untidy = withValue(
      withValue(shuffled(spec, "order"), path, contrast + 1e-9),
      ["color", "palettes", "primary", "hue"],
      359.99999,
    );
    const decoded = decodeSpec(linkOfJson(untidy));
    expect(decoded.color.palettes.primary.light[6].contrast).toBe(contrast);
    expect(decoded.color.palettes.primary.hue).toBe(0);
    const expected = as(withValue(spec, ["color", "palettes", "primary", "hue"], 0));
    expect(decoded).toEqual(expected);
    expect(specId(decoded)).toBe(specId(expected));
    expect(canonicalize(decoded)).toBe(canonicalize(expected));
  });

  it("C-URL-15 refuses a payload whose canonical form fails the schema", () => {
    // A ratio of 1.0000001 lies in (1, 2] as given but rounds to 1, which the schema refuses.
    const spec = withValue(defaultSpec(), ["type", "ratio"], 1.0000001);
    expect(DesignSpecSchema.safeParse(spec).success).toBe(true);
    const failure = decodeError(() => decodeSpec(linkOfJson(spec)));
    expect(failure.reason).toBe("schema");
    expect(failure.issues).toEqual(["type.ratio"]);
  });

  it("C-URL-14 rejects a change that flips only padding bits of the final deflate byte", () => {
    const link = encodeSpec(defaultSpec());
    const positions = finalBytePositions(link);
    expect(positions.length).toBeGreaterThanOrEqual(2);
    const counts = reasonsOf(changes(link, positions));
    expect(counts).toEqual({ accepted: 0, corrupt: positions.length * 63, version: 0, schema: 0 });
  });

  it("C-URL-14 closes the hole that a trailer over the inflated text would leave", () => {
    // R-22: inflate ignores the padding bits of the stream's final byte, so some changes there
    // inflate to the identical text. A trailer over that text would accept them; this one rejects.
    let identical = 0;
    for (const name of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      const spec = as(withValue(defaultSpec(), ["meta", "name"], name));
      const link = encodeSpec(spec);
      const canonical = canonicalize(spec);
      for (const changed of changes(link, finalBytePositions(link))) {
        const bytes = linkBytes(changed);
        if (inflatesTo(bytes.subarray(0, bytes.length - 8), canonical)) {
          identical++;
          expect(decodeError(() => decodeSpec(changed)).reason).toBe("corrupt");
        }
      }
    }
    expect(identical).toBeGreaterThan(0);
  });

  it("rejects the last character's unused bits (the canonical base64url check)", () => {
    // A link whose byte count is not a multiple of 3 ends in a character with unused bits.
    const link = ["a", "ab", "abc", "abcd", "abcde"]
      .map((name) => encodeSpec(as(withValue(defaultSpec(), ["meta", "name"], name))))
      .find((candidate) => candidate.length % 4 !== 0);
    if (link === undefined) throw new Error("no link with a partial final group");
    const unused = link.length % 4 === 2 ? 4 : 2;
    const value = ALPHABET.indexOf(link[link.length - 1]);
    expect(value & ((1 << unused) - 1)).toBe(0);
    for (let bits = 1; bits < 1 << unused; bits++) {
      const sibling = replaceAt(link, link.length - 1, ALPHABET[value | bits]);
      expect(linkBytes(sibling).equals(linkBytes(link))).toBe(true);
      expect(decodeError(() => decodeSpec(sibling)).reason).toBe("corrupt");
    }
  });

  it("rejects a payload that does not inflate, is not UTF-8, or is not JSON", () => {
    const text = canonicalize(defaultSpec());
    const deflated = deflateRawSync(Buffer.from(text, "utf8"), { level: 9 });
    // Invalid UTF-8 inside a JSON string: a lenient decoder would read U+FFFD and accept the
    // spec, so only the strict UTF-8 step rejects it. A leading BOM is the same: a decoder
    // that drops it would hand JSON.parse valid text.
    const [before, after] = text.split('"name":"untitled"');
    const inName = (bad: Uint8Array): Buffer =>
      Buffer.concat([
        Buffer.from(`${before}"name":"untitled`, "utf8"),
        bad,
        Buffer.from(`"${after}`, "utf8"),
      ]);
    const payloads = [
      new Uint8Array(0),
      Uint8Array.of(0xff, 0xff, 0xff),
      deflated.subarray(0, deflated.length - 5),
      storedBlock(inName(Uint8Array.of(0xff))),
      // A truncated 4-byte sequence and a letter: its U+FFFD takes the same 3 bytes, so only a
      // byte-by-byte comparison tells the re-encoded text from the payload.
      storedBlock(inName(Uint8Array.of(0xf0, 0x9f, 0x98, 0x41))),
      storedBlock(Buffer.from(`${BYTE_ORDER_MARK}${text}`, "utf8")),
      storedBlock(Buffer.from("not json", "utf8")),
      storedBlock(Buffer.from(text.slice(0, -1), "utf8")),
    ];
    for (const payload of payloads) {
      expect(decodeError(() => decodeSpec(linkOfDeflated(payload))).reason).toBe("corrupt");
    }
    expect(decodeSpec(linkOfDeflated(storedBlock(Buffer.from(text, "utf8"))))).toEqual(
      defaultSpec(),
    );
  });

  it("decodes a hue that canonicalization wrapped from [359.9995, 360) to 0", () => {
    const path = ["color", "palettes", "primary", "hue"];
    const spec = as(withValue(defaultSpec(), path, 359.9997));
    expect(DesignSpecSchema.safeParse(spec).success).toBe(true);
    expect(decodeSpec(encodeSpec(spec)).color.palettes.primary.hue).toBe(0);
  });

  it("encodeSpec refuses a spec that would not decode", () => {
    expect(() => encodeSpec(as(null))).toThrow(TypeError);
    const cases: ReadonlyArray<readonly [unknown, string]> = [
      [
        withValue(defaultSpec(), ["color", "palettes", "primary", "hue"], 400),
        "color.palettes.primary.hue",
      ],
      [withValue(defaultSpec(), ["version"], "dyelot.spec/2"), "version"],
      // Canonical rounding writes 1.0000001 as 1, outside (1, 2].
      [withValue(defaultSpec(), ["type", "ratio"], 1.0000001), "type.ratio"],
    ];
    for (const [spec, path] of cases) {
      expect(() => encodeSpec(as(spec)), path).toThrow(RangeError);
      expect(() => encodeSpec(as(spec)), path).toThrow(path);
    }
  });

  it("decodeSpec throws TypeError for an argument that is not a string", () => {
    for (const value of [undefined, null, 42, ["AAAA"]]) {
      expect(() => decodeSpec(value as unknown as string), String(value)).toThrow(TypeError);
    }
  });
});
