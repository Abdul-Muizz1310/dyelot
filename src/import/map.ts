// Maps CSS values onto the fields of an `ImportDraft` (R3-29, R3-31): font families to catalog
// ids, lengths to pixels and names to roles. Pure.

import { ROLE_NAMES, type RoleName } from "@/engine";

const ROLES: ReadonlySet<string> = new Set(ROLE_NAMES);

/** Whether a name is one of the 46 roles. */
export function isRole(name: string): name is RoleName {
  return ROLES.has(name);
}

/** The shape of a family id in a spec (the schema's `FAMILY_ID`). */
const FAMILY_ID = /^[a-z0-9-]{1,64}$/;

/** CSS generic and system families: they name no font to import. */
const GENERIC_FAMILIES: ReadonlySet<string> = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace",
  "ui-rounded",
  "emoji",
  "math",
  "fangsong",
  "-apple-system",
  "blinkmacsystemfont",
]);

/** The first family of a font stack, quotes off. */
function firstFamily(stack: string): string {
  let quote = "";
  let end = stack.length;
  for (let i = 0; i < stack.length; i += 1) {
    const char = stack.charAt(i);
    if (quote !== "") {
      if (char === "\\") i += 1;
      else if (char === quote) quote = "";
    } else if (char === '"' || char === "'") quote = char;
    else if (char === ",") {
      end = i;
      break;
    }
  }
  const head = stack.slice(0, end).trim();
  const first = head.charAt(0);
  return (first === '"' || first === "'") && head.endsWith(first) && head.length > 1
    ? head.slice(1, -1).trim()
    : head;
}

/**
 * The id of the first family of a font stack by R2-03's rule (lowercase, white space to `-`), or
 * `null` for a generic or system family, a `var()`, or a name that is no id.
 */
export function familyId(stack: string): string | null {
  const name = firstFamily(stack);
  if (GENERIC_FAMILIES.has(name.toLowerCase())) return null;
  const id = name.toLowerCase().replace(/\s+/g, "-");
  return FAMILY_ID.test(id) ? id : null;
}

const PX_PER_REM = 16;

/** A length of `px`, `rem` or `em` (or a bare 0) in pixels, or `null`. */
export function lengthPx(value: string): number | null {
  const match = /^(\d+\.?\d*|\.\d+)(px|rem|em)?$/i.exec(value.trim());
  if (match === null) return null;
  const amount = Number(match[1]);
  const unit = (match[2] ?? "").toLowerCase();
  if (unit === "" && amount !== 0) return null;
  const px = unit === "px" || unit === "" ? amount : amount * PX_PER_REM;
  return Number.isFinite(px) ? px : null;
}
