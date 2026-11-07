import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { normalizeSeed, parseColor } from "@/engine";
import { readEntry, readHash } from "@/features/studio/url";
import { encodeSpec, isPlainText } from "@/spec";
import { freshSpec } from "./support";

// Cases are C-HASH6-01 to 05 and C-HASH6-RF1 of docs/specs/06-gallery.md, section 14 (R6-23).

const seedOf = (hex: string) => normalizeSeed(parseColor(`#${hex}`));
const entry = (e: unknown) => ({ kind: "entry", entry: e });

describe("readEntry", () => {
  it("C-HASH6-01 reads the valid rows of 10.1", () => {
    expect(readEntry("#color=f66c6d")).toEqual(entry({ kind: "color", seed: seedOf("f66c6d") }));
    expect(readEntry("#color=F66C6D")).toEqual(entry({ kind: "color", seed: seedOf("f66c6d") }));
    expect(readEntry("#brief=A%20tea%20house%20at%20dusk")).toEqual(
      entry({ kind: "brief", text: "A tea house at dusk" }),
    );
    expect(readEntry("#brief=caf%C3%A9%20%26%20bar")).toEqual(
      entry({ kind: "brief", text: "café & bar" }),
    );
    expect(readEntry("#brief=tea+house")).toEqual(entry({ kind: "brief", text: "tea+house" }));
    expect(readEntry("#start=image")).toEqual(entry({ kind: "image" }));
  });

  it("C-HASH6-02 gives malformed for every malformed row", () => {
    const rows = [
      "#color=f66c6",
      "#color=f66c6d0",
      "#color=",
      "#color=gg6c6d",
      "#color=%23f66c6d",
      "#color=#f66c6d",
      "#brief=",
      "#brief=%20%20",
      "#brief=%E0%A4%A",
      `#brief=${"a".repeat(6001)}`,
      `#brief=${"a".repeat(501)}`,
      "#start=",
      "#start=Image",
      "#start=brief",
    ];
    for (const row of rows) expect(readEntry(row), row).toEqual({ kind: "malformed" });
  });

  it("C-HASH6-03 gives none for other hashes, and readHash still reads #s=", () => {
    const link = `#s=${encodeSpec(freshSpec())}`;
    for (const row of [link, "#top", "", "#colors=f66c6d"]) {
      expect(readEntry(row), row).toEqual({ kind: "none" });
    }
    expect(readHash(link).kind).toBe("spec");
  });

  it("C-HASH6-04 throws a TypeError naming readEntry for a non-string", () => {
    for (const value of [5, null]) {
      expect(() => readEntry(value as unknown as string)).toThrow(TypeError);
      expect(() => readEntry(value as unknown as string)).toThrow(/^readEntry/);
    }
  });

  it("C-HASH6-05 cleans the brief as the studio's box does", () => {
    expect(readEntry("#brief=%E2%80%AEA%20%20tea%0Ahouse")).toEqual(
      entry({ kind: "brief", text: "A tea house" }),
    );
    const text = "b".repeat(500);
    expect(readEntry(`#brief=${text}`)).toEqual(entry({ kind: "brief", text }));
  });

  it("C-HASH6-RF1 never throws and gives entry or malformed", () => {
    fc.assert(
      fc.property(fc.string({ unit: "binary" }), (s) => {
        for (const prefix of ["#brief=", "#color=", "#start="]) {
          const result = readEntry(prefix + s);
          expect(["entry", "malformed"]).toContain(result.kind);
          if (result.kind === "entry" && result.entry.kind === "brief") {
            expect(isPlainText(result.entry.text)).toBe(true);
            expect(result.entry.text.length).toBeLessThanOrEqual(500);
          }
        }
      }),
      { numRuns: 500, seed: 6005 },
    );
  });
});
