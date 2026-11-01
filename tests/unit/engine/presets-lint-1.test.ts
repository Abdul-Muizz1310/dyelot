import { describePresetLint } from "./presets-support";

// C-PRESET-04 and C-PRESET-12, part 1 of 5 (spec section 6.3).
describePresetLint(["default", "minimal-swiss", "editorial"]);
