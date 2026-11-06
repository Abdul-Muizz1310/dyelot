import { describe, expect, expectTypeOf, it } from "vitest";
import * as entry from "@/export";
import { brandProps } from "@/export/brand";
import { buildBundle } from "@/export/bundle";
import { mediaName } from "@/export/media";
import { motionFiles } from "@/export/motion";
import { RECEIPT_FORMAT } from "@/export/receipt";
import { sha256 } from "@/export/sha256";
import { zipBundle, zipName } from "@/export/zip";

// C-ENTRY5-02 (R5-28) of docs/specs/05-motion-3d.md, which replaces C-ENTRY3-02's key list (R3-38).

describe("C-ENTRY5-02 the export entry", () => {
  it("C-ENTRY5-02 exports exactly M3's names plus motionFiles, brandProps and mediaName", () => {
    expect(Object.keys(entry).sort()).toEqual(
      [
        "RECEIPT_FORMAT",
        "brandProps",
        "buildBundle",
        "mediaName",
        "motionFiles",
        "sha256",
        "zipBundle",
        "zipName",
      ].sort(),
    );
    expect(entry.RECEIPT_FORMAT).toBe("dyelot.check/1");
    expect(entry.buildBundle).toBe(buildBundle);
    expect(entry.zipBundle).toBe(zipBundle);
    expect(entry.zipName).toBe(zipName);
    expect(entry.sha256).toBe(sha256);
    expect(entry.RECEIPT_FORMAT).toBe(RECEIPT_FORMAT);
    expect(entry.motionFiles).toBe(motionFiles);
    expect(entry.brandProps).toBe(brandProps);
    expect(entry.mediaName).toBe(mediaName);
  });

  it("C-ENTRY5-02 types the bundle and the brand props through the entry", () => {
    expectTypeOf<entry.Bundle["files"]>().toEqualTypeOf<readonly entry.BundleFile[]>();
    expectTypeOf<entry.BundleInput>().toHaveProperty("origin");
    expectTypeOf<entry.Bundle["receipt"]>().toEqualTypeOf<entry.Receipt>();
    expectTypeOf<entry.BrandProps>().toHaveProperty("lot");
  });
});
