import flavor from "../flavor/flavor.mjs?raw";
import flavorReact from "../flavor/flavor-react.tsx?raw";
import brandIntro from "../flavor/remotion/brand-intro.tsx?raw";
import root from "../flavor/remotion/root.tsx?raw";

// The shipped sources as text (R5-05, R5-23): the files under src/flavor/ go into the export byte
// for byte, the way the checker does (R3-39). Turbopack's `raw` rule serves the `?raw` imports.

/** The four texts of `flavor/`, keyed by their bundle paths. */
export const FLAVOR_SOURCES: Readonly<{
  "flavor/flavor.mjs": string;
  "flavor/flavor-react.tsx": string;
  "flavor/remotion/brand-intro.tsx": string;
  "flavor/remotion/root.tsx": string;
}> = {
  "flavor/flavor.mjs": flavor,
  "flavor/flavor-react.tsx": flavorReact,
  "flavor/remotion/brand-intro.tsx": brandIntro,
  "flavor/remotion/root.tsx": root,
};
