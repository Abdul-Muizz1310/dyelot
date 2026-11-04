import { isPlainText } from "@/spec";

// The input checks the token writers share (R-05): a wrong type is a TypeError and an
// out-of-domain value a RangeError, each message naming the function.

const HEX = /^#[0-9a-f]{6}$/;

function describeType(value: unknown): string {
  return value === null ? "null" : typeof value;
}

/** Checks that `spec` is an object and `name` plain text; the message names `who`. */
export function checkTokenInput(who: string, spec: unknown, name: unknown): void {
  if (typeof spec !== "object" || spec === null) {
    throw new TypeError(`${who}: spec must be an object, got ${describeType(spec)}`);
  }
  if (typeof name !== "string") {
    throw new TypeError(`${who}: name must be a string, got ${describeType(name)}`);
  }
  if (!isPlainText(name)) {
    throw new RangeError(`${who}: name must be plain text, got ${JSON.stringify(name)}`);
  }
}

type RoleMap = Readonly<Record<string, unknown>>;

/** Checks that every stored role of both modes is a lowercase `#rrggbb` hex. */
export function checkRoleHexes(who: string, spec: unknown): void {
  const roles = (spec as { color?: { roles?: Record<string, RoleMap> } }).color?.roles;
  for (const mode of ["light", "dark"]) {
    for (const [role, value] of Object.entries(roles?.[mode] ?? {})) {
      if (typeof value !== "string" || !HEX.test(value)) {
        throw new RangeError(
          `${who}: role ${role} (${mode}) must be a lowercase #rrggbb hex, got ${JSON.stringify(value)}`,
        );
      }
    }
  }
}
