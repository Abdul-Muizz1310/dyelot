import type { DesignSpec } from "@/spec";
import { SPEC } from "./golden-support";

// `ONE_FAIL` of docs/specs/03-export.md, section 4: `SPEC` with its light `secondary-foreground` set to
// `#858585` (C-RCPT-07's overlay). It has one C1 error, and regenerating it from its parameters gives
// `SPEC` again.

const OVERLAY: Record<string, string> = { "secondary-foreground": "#858585" };

export const ONE_FAIL: DesignSpec = {
  ...SPEC,
  color: {
    ...SPEC.color,
    roles: {
      ...SPEC.color.roles,
      light: { ...SPEC.color.roles.light, ...OVERLAY },
    },
  },
};
