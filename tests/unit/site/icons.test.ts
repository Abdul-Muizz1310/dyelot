import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SITE } from "@/lib/site/config";
import { icoSizes, pngSize } from "./image-headers";

describe("icon files (T-FE-26)", () => {
  it("draws the vector icon in the site's accent", () => {
    const svg = readFileSync("src/app/icon.svg", "utf8");
    expect(svg).toContain('viewBox="0 0 64 64"');
    expect(svg).toContain(`stroke="${SITE.accent}"`);
  });

  it("names itself for screen readers and draws the lucide swatch-book on the panel tile", () => {
    const svg = readFileSync("src/app/icon.svg", "utf8");
    expect(svg).toContain("<title>dyelot</title>");
    expect(svg).toContain('fill="#12121a"');
    expect(svg).toContain("M11 17a4 4 0 0 1-8 0V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2Z");
  });

  it("packs 16, 32 and 48 px frames into favicon.ico", () => {
    expect(icoSizes(readFileSync("src/app/favicon.ico"))).toEqual([16, 32, 48]);
  });

  it("ships a 180 px apple touch icon", () => {
    expect(pngSize(readFileSync("src/app/apple-icon.png"))).toBe("180x180");
  });
});
