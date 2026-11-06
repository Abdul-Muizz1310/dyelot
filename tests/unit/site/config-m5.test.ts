import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import nextConfig from "../../../next.config";

// C-SITE5-05 of docs/specs/05-motion-3d.md, section 14.5 (R5-23, R5-60, section 12.3): the build
// configuration M5 needs. Task 5.3a lands it (the plan's D3); probe 3 confirmed the *.tsx rule (R5-64).

const ROOT = path.resolve(import.meta.dirname, "../../..");
const read = (file: string): string => readFileSync(path.join(ROOT, file), "utf8");

const RAW = { condition: { query: /[?&]raw(?=&|$)/ }, type: "raw" };

describe("C-SITE5-05 the build configuration of section 12.3", () => {
  it("C-SITE5-05 next.config.ts holds the three raw rules and no experimental key", () => {
    expect(nextConfig.turbopack?.rules).toEqual({ "*.mjs": RAW, "*.md": RAW, "*.tsx": RAW });
    expect(Object.keys(nextConfig.turbopack ?? {})).toEqual(["rules"]);
    expect("experimental" in nextConfig).toBe(false);
    expect("cacheComponents" in nextConfig).toBe(false);
  });

  it.each(["mjs", "md", "tsx"])(
    "C-SITE5-05 src/types/raw.d.ts declares *.%s?raw as a string",
    (ext) => {
      const source = read("src/types/raw.d.ts");
      expect(source).toMatch(
        new RegExp(
          `declare module "\\*\\.${ext}\\?raw"\\s*\\{\\s*const text: string;\\s*export default text;\\s*\\}`,
        ),
      );
    },
  );

  it("C-SITE5-05 src/types/raw.d.ts declares exactly those three modules", () => {
    const modules = Array.from(
      read("src/types/raw.d.ts").matchAll(/declare module "([^"]+)"/g),
      (match) => match[1],
    );
    expect(modules).toEqual(["*.mjs?raw", "*.md?raw", "*.tsx?raw"]);
  });

  it("C-SITE5-05 tsconfig.json and biome.json include src/flavor/*.mjs beside the checker", () => {
    const tsconfig = JSON.parse(read("tsconfig.json")) as { include: string[] };
    expect(tsconfig.include).toContain("src/flavor/*.mjs");
    expect(tsconfig.include).toContain("src/export/checker/*.mjs");
    const biome = JSON.parse(read("biome.json")) as { files: { includes: string[] } };
    const includes = biome.files.includes;
    expect(includes).toContain("src/flavor/*.mjs");
    expect(includes.indexOf("src/flavor/*.mjs")).toBe(
      includes.indexOf("src/export/checker/*.mjs") + 1,
    );
  });

  it("C-SITE5-05 Dependabot groups remotion and three by exact names, beside react and playwright", () => {
    const config = parse(read(".github/dependabot.yml")) as {
      updates: { "package-ecosystem": string; groups?: Record<string, { patterns: string[] }> }[];
    };
    const npm = config.updates.filter((entry) => entry["package-ecosystem"] === "npm");
    expect(npm).toHaveLength(1);
    const groups = npm[0].groups ?? {};
    expect(Object.keys(groups)).toEqual(["react", "playwright", "remotion", "three"]);
    expect(groups.remotion.patterns).toEqual([
      "remotion",
      "@remotion/player",
      "@remotion/web-renderer",
      "mediabunny",
    ]);
    expect(groups.three.patterns).toEqual([
      "three",
      "@types/three",
      "@react-three/fiber",
      "@react-three/drei",
    ]);
    expect(groups.react.patterns).toEqual([
      "react",
      "react-dom",
      "@types/react",
      "@types/react-dom",
    ]);
    expect(groups.playwright.patterns).toEqual(["playwright", "@playwright/test"]);
  });
});
