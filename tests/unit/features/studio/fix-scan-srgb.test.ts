import { scanGamut } from "./fix-scan-support";

// C-INSPECT-16 (docs/specs/02-studio.md, section 6.8): the R2-10 scan, the srgb half.

scanGamut("srgb");
