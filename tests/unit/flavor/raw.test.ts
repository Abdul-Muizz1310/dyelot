import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import flavor from "../../../src/flavor/flavor.mjs?raw";
import flavorReact from "../../../src/flavor/flavor-react.tsx?raw";
import brandIntro from "../../../src/flavor/remotion/brand-intro.tsx?raw";
import root from "../../../src/flavor/remotion/root.tsx?raw";

// C-FLAV-20 of docs/specs/05-motion-3d.md, section 14.3 (R5-05, R5-23, probe 3): in the web
// project, `?raw` gives the four shipped sources byte for byte.

const SRC = path.resolve(import.meta.dirname, "../../../src/flavor");

describe("the shipped sources read through ?raw", () => {
  it.each([
    ["flavor.mjs", flavor],
    ["flavor-react.tsx", flavorReact],
    ["remotion/brand-intro.tsx", brandIntro],
    ["remotion/root.tsx", root],
  ])("C-FLAV-20 reads %s byte for byte", (file, text) => {
    expect(text).toBe(readFileSync(path.join(SRC, file), "utf8"));
  });
});
