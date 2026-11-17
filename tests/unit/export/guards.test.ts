import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildBundle } from "@/export/bundle";
import { flavorFiles } from "@/export/flavor";
import { describeType, httpsOrigin } from "@/export/guards";
import { SPEC } from "./golden-support";

// C-HYG6-05 and 06 of docs/specs/06-gallery.md, section 14 (R6-41).

const source = (file: string) =>
  readFileSync(path.join(import.meta.dirname, "../../../src/export", file), "utf8");

describe("the export's shared guards (R6-41)", () => {
  it("C-HYG6-05 names types, passes an https origin and is shared by bundle and flavor", () => {
    expect(describeType(null)).toBe("null");
    expect(describeType([])).toBe("array");
    expect(describeType(1)).toBe("number");
    expect(describeType({})).toBe("object");
    expect(httpsOrigin("https://a.test", "f")).toBe("https://a.test");
    for (const file of ["bundle.ts", "flavor.ts"]) {
      const text = source(file);
      expect(text).toMatch(/import \{[^}]*\bdescribeType\b[^}]*\} from "\.\/guards"/);
      expect(text).toMatch(/import \{[^}]*\bhttpsOrigin\b[^}]*\} from "\.\/guards"/);
      expect(text).not.toMatch(/function (describeType|checkOrigin)/);
    }
  });

  it("C-HYG6-06 throws R-05 errors that start with the caller", () => {
    expect(() => httpsOrigin(3, "buildBundle")).toThrow(
      new TypeError("buildBundle: origin must be a string, got number"),
    );
    for (const origin of ["http://a.test", "https://a.test/x"]) {
      expect(() => httpsOrigin(origin, "flavorFiles")).toThrow(
        new RangeError(
          `flavorFiles: origin must be an https origin with no path, got ${JSON.stringify(origin)}`,
        ),
      );
      expect(() => flavorFiles(SPEC, origin)).toThrow(
        `flavorFiles: origin must be an https origin with no path, got ${JSON.stringify(origin)}`,
      );
      expect(() => buildBundle({ spec: SPEC, origin })).toThrow(
        `buildBundle: origin must be an https origin with no path, got ${JSON.stringify(origin)}`,
      );
    }
    expect(() => buildBundle({ spec: SPEC, origin: 3 as unknown as string })).toThrow(
      "buildBundle: origin must be a string, got number",
    );
    expect(() => flavorFiles(SPEC, 3 as unknown as string)).toThrow(
      "flavorFiles: origin must be a string, got number",
    );
  });
});
