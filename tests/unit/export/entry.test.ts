import { describe, expect, expectTypeOf, it } from "vitest";
import * as entry from "@/export";
import { buildBundle } from "@/export/bundle";
import { RECEIPT_FORMAT } from "@/export/receipt";
import { sha256 } from "@/export/sha256";
import { zipBundle, zipName } from "@/export/zip";

// C-ENTRY3-02, the export part (R3-38) of docs/specs/03-export.md.

describe("C-ENTRY3-02 the export entry", () => {
  it("exports exactly buildBundle, zipBundle, zipName, sha256 and RECEIPT_FORMAT", () => {
    expect(Object.keys(entry).sort()).toEqual(
      ["RECEIPT_FORMAT", "buildBundle", "sha256", "zipBundle", "zipName"].sort(),
    );
    expect(entry.RECEIPT_FORMAT).toBe("dyelot.check/1");
    expect(entry.buildBundle).toBe(buildBundle);
    expect(entry.zipBundle).toBe(zipBundle);
    expect(entry.zipName).toBe(zipName);
    expect(entry.sha256).toBe(sha256);
    expect(entry.RECEIPT_FORMAT).toBe(RECEIPT_FORMAT);
  });

  it("types the bundle through the entry", () => {
    expectTypeOf<entry.Bundle["files"]>().toEqualTypeOf<readonly entry.BundleFile[]>();
    expectTypeOf<entry.BundleInput>().toHaveProperty("origin");
    expectTypeOf<entry.Bundle["receipt"]>().toEqualTypeOf<entry.Receipt>();
  });
});
