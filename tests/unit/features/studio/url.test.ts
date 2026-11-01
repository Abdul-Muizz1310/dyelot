import { describe, expect, it } from "vitest";
import { bannerFor, linkUrl, readHash, writeHash } from "@/features/studio/url";
import { encodeSpec } from "@/spec";
import { without, withValue } from "../../spec/support";
import { freshSpec, linkOfValue } from "./support";

// Cases are C-HASH-01 to C-HASH-10 of docs/specs/02-studio.md, section 6.7 (Review Focus 1). The
// store's hash cases (C-HASH-11 to C-HASH-17) live in store-persist.test.ts.

/** The link of `SPEC` with the character at `at` swapped for another of the alphabet. */
function changedAt(link: string, at: number): string {
  const swapped = link[at] === "A" ? "B" : "A";
  return link.slice(0, at) + swapped + link.slice(at + 1);
}

describe("readHash and writeHash", () => {
  it("C-HASH-01 round-trips a spec, and writeHash starts #s=", () => {
    const spec = freshSpec();
    const hash = writeHash(spec);
    expect(hash.startsWith("#s=")).toBe(true);
    expect(hash).toBe(`#s=${encodeSpec(spec)}`);
    const result = readHash(hash);
    expect(result.kind).toBe("spec");
    if (result.kind !== "spec") return;
    expect(result.spec).toEqual(spec);
  });

  it.each([[""], ["#"], ["#foo"], ["#S=abc"], ["#x=1&s=abc"], ["s=abc"]])(
    "C-HASH-02 reads %j as no link",
    (hash) => {
      expect(readHash(hash)).toEqual({ kind: "none" });
    },
  );

  it("C-HASH-03 gives corrupt for a link with one changed character in the middle", () => {
    const link = encodeSpec(freshSpec());
    expect(readHash(`#s=${changedAt(link, Math.floor(link.length / 2))}`)).toEqual({
      kind: "error",
      reason: "corrupt",
    });
  });

  it("C-HASH-04 gives corrupt for a link cut short by 40 characters", () => {
    const link = encodeSpec(freshSpec());
    expect(readHash(`#s=${link.slice(0, -40)}`)).toEqual({ kind: "error", reason: "corrupt" });
  });

  it("C-HASH-05 gives version for a payload of dyelot.spec/2 with a valid trailer", () => {
    const future = withValue(freshSpec(), ["version"], "dyelot.spec/2");
    expect(readHash(`#s=${linkOfValue(future)}`)).toEqual({ kind: "error", reason: "version" });
  });

  it("C-HASH-06 gives schema with the failing paths for a valid link that fails the schema", () => {
    let broken = without(freshSpec(), ["color", "roles", "light", "ring"]);
    broken = withValue(broken, ["shape", "radiusSet"], "blobby");
    const result = readHash(`#s=${linkOfValue(broken)}`);
    expect(result).toEqual({
      kind: "error",
      reason: "schema",
      issues: expect.arrayContaining(["color.roles.light.ring", "shape.radiusSet"]),
    });
    if (result.kind !== "error") return;
    expect(result.issues).toHaveLength(2);
  });

  it.each([["#s="], ["#s=abc&x=1"], ["#s=%20"]])("C-HASH-07 gives corrupt for %j", (hash) => {
    expect(readHash(hash)).toEqual({ kind: "error", reason: "corrupt" });
  });

  it.each([[undefined], [null], [42], [{}]])(
    "C-HASH-08 throws TypeError naming readHash for %j",
    (hash) => {
      expect(() => readHash(hash as unknown as string)).toThrow(TypeError);
      expect(() => readHash(hash as unknown as string)).toThrow(/^readHash: /);
    },
  );

  it("C-HASH-08 throws TypeError naming writeHash for a value that is not a spec", () => {
    expect(() => writeHash(null as never)).toThrow(TypeError);
    expect(() => writeHash(null as never)).toThrow(/^writeHash: /);
    const unwritable = withValue(freshSpec(), ["meta", "name"], BigInt(10));
    expect(() => writeHash(unwritable as never)).toThrow(TypeError);
    expect(() => writeHash(unwritable as never)).toThrow(/^writeHash: /);
  });

  it("throws RangeError naming writeHash for a spec that fails the schema", () => {
    const broken = withValue(freshSpec(), ["color", "roles", "light", "ring"], "#FFF");
    expect(() => writeHash(broken as never)).toThrow(RangeError);
    expect(() => writeHash(broken as never)).toThrow(/^writeHash: .*color\.roles\.light\.ring/);
  });
});

describe("linkUrl", () => {
  it("C-HASH-09 is the origin, /studio and the hash", () => {
    const spec = freshSpec();
    expect(linkUrl("https://dyelot.vercel.app", spec)).toBe(
      `https://dyelot.vercel.app/studio${writeHash(spec)}`,
    );
  });

  it.each([["https://dyelot.vercel.app/"], ["dyelot.vercel.app"], ["https://x.dev/studio"], [""]])(
    "rejects %j, which is not a bare origin, with RangeError naming linkUrl",
    (origin) => {
      expect(() => linkUrl(origin, freshSpec())).toThrow(RangeError);
      expect(() => linkUrl(origin, freshSpec())).toThrow(/^linkUrl: /);
    },
  );

  it("rejects a non-string origin with TypeError naming linkUrl", () => {
    expect(() => linkUrl(1 as unknown as string, freshSpec())).toThrow(TypeError);
    expect(() => linkUrl(1 as unknown as string, freshSpec())).toThrow(/^linkUrl: /);
  });
});

describe("bannerFor", () => {
  const FRESH_DETAIL = "The studio opened a fresh design instead.";
  const DRAFT_DETAIL = "The studio opened your last draft instead.";

  it("C-HASH-10 words a corrupt link", () => {
    expect(bannerFor({ kind: "link", reason: "corrupt", fallback: "fresh" })).toEqual({
      message: "This link is damaged or cut short, so the studio cannot open it.",
      detail: FRESH_DETAIL,
    });
  });

  it("C-HASH-10 words a link from another version", () => {
    expect(bannerFor({ kind: "link", reason: "version", fallback: "draft" })).toEqual({
      message:
        "This link comes from another version of the design format, so the studio cannot open it.",
      detail: DRAFT_DETAIL,
    });
  });

  it("C-HASH-10 counts the failing fields of a schema link, one and many", () => {
    const three = bannerFor({
      kind: "link",
      reason: "schema",
      issues: ["a", "b", "c"],
      fallback: "fresh",
    });
    expect(three.message).toBe(
      "This link holds a design the studio cannot read: 3 fields fail the format check.",
    );
    const one = bannerFor({ kind: "link", reason: "schema", issues: ["a"], fallback: "draft" });
    expect(one).toEqual({
      message: "This link holds a design the studio cannot read: 1 field fails the format check.",
      detail: DRAFT_DETAIL,
    });
  });

  it("C-HASH-10 never quotes the link or its payload", () => {
    const issues = ["color.roles.light.ring"];
    const banner = bannerFor({ kind: "link", reason: "schema", issues, fallback: "fresh" });
    expect(`${banner.message} ${banner.detail}`).not.toContain("color.roles");
    expect(`${banner.message} ${banner.detail}`).not.toContain("#s=");
  });

  it("words a bad link that arrives mid-session, when the studio keeps the current design", () => {
    expect(bannerFor({ kind: "link", reason: "corrupt", fallback: "current" }).detail).toBe(
      "The studio kept the current design.",
    );
  });

  it("words a schema link without issues without a count", () => {
    expect(bannerFor({ kind: "link", reason: "schema", fallback: "fresh" }).message).toBe(
      "This link holds a design the studio cannot read.",
    );
  });

  it("words every other notice without quoting an engine error (I-M2-03)", () => {
    const generation = bannerFor({
      kind: "generation",
      message: 'generateSystem: params.chroma must be one of "muted", got "loud"',
    });
    expect(generation).toEqual({
      message: "The studio could not generate this change.",
      detail: "Revert to return to the last design.",
    });
    expect(bannerFor({ kind: "custom-fonts" })).toEqual({
      message: "This design uses fonts outside the studio's pairings.",
      detail: "Editing it resets the fonts to the automatic pairing.",
    });
    expect(bannerFor({ kind: "draft-restored" })).toEqual({
      message: "Restored your last draft.",
      detail: "",
    });
    expect(bannerFor({ kind: "copy-blocked" })).toEqual({
      message: "Copy blocked. Select the link below.",
      detail: "",
    });
  });

  it("follows the house copy rules: no filler words, no exclamation marks", () => {
    const all = [
      bannerFor({ kind: "link", reason: "corrupt", fallback: "fresh" }),
      bannerFor({ kind: "link", reason: "version", fallback: "draft" }),
      bannerFor({ kind: "link", reason: "schema", issues: ["a"], fallback: "current" }),
      bannerFor({ kind: "generation", message: "x" }),
      bannerFor({ kind: "custom-fonts" }),
      bannerFor({ kind: "draft-restored" }),
      bannerFor({ kind: "copy-blocked" }),
    ];
    for (const { message, detail } of all) {
      expect(`${message} ${detail}`).not.toMatch(/\b(simply|just|easy|obviously|basically)\b|!/i);
    }
  });

  it("throws TypeError naming bannerFor for a notice that is not one", () => {
    expect(() => bannerFor(null as never)).toThrow(TypeError);
    expect(() => bannerFor({ kind: "shout" } as never)).toThrow(RangeError);
    expect(() => bannerFor({ kind: "shout" } as never)).toThrow(/^bannerFor: /);
    expect(() => bannerFor({ kind: "link", reason: "lost", fallback: "fresh" } as never)).toThrow(
      RangeError,
    );
    expect(() =>
      bannerFor({ kind: "link", reason: "corrupt", fallback: "nowhere" } as never),
    ).toThrow(RangeError);
  });
});
