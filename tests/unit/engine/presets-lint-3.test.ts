import { describePresetLint, PRESET_LINT_GROUPS } from "./presets-support";

// C-PRESET-04 and C-PRESET-12, part 3 of 5 (spec section 6.3).
describePresetLint(PRESET_LINT_GROUPS[2] ?? []);
