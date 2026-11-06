import { readFileSync } from "node:fs";
import path from "node:path";
import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { buildBundle } from "@/export/bundle";
import { flavorFiles } from "@/export/flavor";
import { sha256 } from "@/export/sha256";
import { zipBundle } from "@/export/zip";
import { BUNDLE, FLAVOR_BUNDLE } from "./bundle-support";
import { GOLDENS, MANIFEST_GOLDENS, ORIGIN, SPEC } from "./golden-support";

// C-FEX-11 to 15 of docs/specs/05-motion-3d.md, section 14.4 (R5-24, R5-26, R5-27, R5-22).

const ROOT = path.resolve(import.meta.dirname, "../../..");
const encoder = new TextEncoder();
const paths = (bundle: { files: readonly { path: string }[] }) => bundle.files.map((f) => f.path);
const FLAVOR = flavorFiles(SPEC, ORIGIN);

type Entry = {
  specId: string;
  files: { path: string; bytes: number; sha256: string }[];
  zipSha256: string;
};
const MANIFEST = JSON.parse(
  readFileSync(path.join(ROOT, "tests/golden/export/manifest.json"), "utf8"),
) as Record<string, Entry>;

/** The files of `golden` as `golden.test.ts` builds them. */
function build(id: string) {
  const golden = MANIFEST_GOLDENS.find(
    (entry) => entry.id === id,
  ) as (typeof MANIFEST_GOLDENS)[number];
  return buildBundle({ spec: golden.spec, origin: ORIGIN, flavor: golden.flavor === true });
}

describe("buildBundle with flavor", () => {
  it("C-FEX-11 gives M4's bundle with the flag absent or false, and 29 files with it true", () => {
    expect(buildBundle({ spec: SPEC, origin: ORIGIN })).toEqual(BUNDLE);
    expect(buildBundle({ spec: SPEC, origin: ORIGIN, flavor: false })).toEqual(BUNDLE);
    expect(FLAVOR_BUNDLE.files).toHaveLength(29);
    const at = paths(BUNDLE).indexOf("motion/gsap.ts") + 1;
    const others = BUNDLE.files.filter((file) => file.path !== "receipt.json");
    expect(FLAVOR_BUNDLE.files.slice(0, -1)).toEqual([
      ...others.slice(0, at),
      ...FLAVOR,
      ...others.slice(at),
    ]);
    expect(paths(FLAVOR_BUNDLE).at(-1)).toBe("receipt.json");
    const listed = FLAVOR_BUNDLE.receipt.files;
    const expected = FLAVOR_BUNDLE.files
      .filter((file) => file.path !== "receipt.json")
      .map((file) => ({
        path: file.path,
        bytes: encoder.encode(file.text).length,
        sha256: sha256(file.text),
      }));
    expect(listed).toHaveLength(28);
    expect(listed).toEqual(expected);
  });

  it("C-FEX-13 throws TypeError naming buildBundle: input.flavor for a flag that is not a boolean", () => {
    for (const flavor of ["yes", 1, null]) {
      const input = { spec: SPEC, origin: ORIGIN, flavor } as never;
      expect(() => buildBundle(input)).toThrow(TypeError);
      expect(() => buildBundle(input)).toThrow(/buildBundle: input\.flavor/);
    }
  });
});

describe("the default-flavor golden", () => {
  const flavored = build("default-flavor");
  const plain = build("default");

  it("C-FEX-12 repeats brand.json in the repository byte for byte", () => {
    const file = flavored.files.find((entry) => entry.path === "flavor/remotion/brand.json");
    expect(readFileSync(path.join(ROOT, "src/flavor/remotion/brand.json"), "utf8")).toBe(
      file?.text,
    );
  });

  it("C-FEX-14 equals the manifest and the default golden but for the nine files and the receipt", () => {
    const entry = MANIFEST["default-flavor"] as Entry;
    expect(entry.files).toEqual(
      flavored.files.map((file) => ({
        path: file.path,
        bytes: encoder.encode(file.text).length,
        sha256: sha256(file.text),
      })),
    );
    expect(entry.zipSha256).toBe(sha256(zipBundle(flavored)));
    const defaults = (GOLDENS.find((g) => g.id === "default") as (typeof GOLDENS)[number]).spec;
    const at = paths(plain).indexOf("motion/gsap.ts") + 1;
    const base = plain.files.filter((file) => file.path !== "receipt.json");
    expect(flavored.files.filter((file) => file.path !== "receipt.json")).toEqual([
      ...base.slice(0, at),
      ...flavorFiles(defaults, ORIGIN),
      ...base.slice(at),
    ]);
    expect(Object.keys(MANIFEST)).toEqual(MANIFEST_GOLDENS.map((golden) => golden.id));
    for (const id of Object.keys(MANIFEST).filter((key) => key !== "default-flavor")) {
      const held = MANIFEST[id]?.files.some((file) => file.path.startsWith("flavor/"));
      expect(held, id).toBe(false);
    }
  });
});

describe("zipBundle with flavor", () => {
  it("C-FEX-15 accepts both READMEs, in bundle order, and still refuses other capitals", () => {
    const zip = unzipSync(zipBundle(FLAVOR_BUNDLE));
    expect(Object.keys(zip)).toEqual(paths(FLAVOR_BUNDLE));
    expect(Object.keys(zip)).toContain("flavor/README.md");
    expect(Object.keys(zip)).toContain("flavor/remotion/README.md");
    const bad = (file: string) => () =>
      zipBundle({ ...BUNDLE, files: [{ path: file, text: "a\n" }] } as never);
    for (const file of ["README.MD", "Readme.md", "docs/A.md"]) {
      expect(bad(file), file).toThrow(RangeError);
      expect(bad(file), file).toThrow(/zipBundle/);
    }
  });
});
