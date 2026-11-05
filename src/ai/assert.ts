// The R-05 checks of the AI core (docs/specs/04-ai.md, section 2): a wrong type is a TypeError, an
// out-of-domain value a RangeError, each message starting with the caller's name, given in `name`
// (for example "cascadePlan: tiers.text"). The engine's own guards are internal to src/engine.

/** The type of `value` as an error message names it: `null` and an array are not "object". */
export function describeType(value: unknown): string {
  if (value === null) return "null";
  return Array.isArray(value) ? "array" : typeof value;
}

/** Whether `value` is an object that is neither `null` nor an array. */
export function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function assertRecord(
  value: unknown,
  name: string,
): asserts value is Readonly<Record<string, unknown>> {
  if (!isRecord(value)) {
    throw new TypeError(`${name} must be an object, got ${describeType(value)}`);
  }
}

export function assertString(value: unknown, name: string): asserts value is string {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a string, got ${describeType(value)}`);
  }
}

/** One of the listed strings: another type is a TypeError, another string a RangeError. */
export function assertOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  name: string,
): asserts value is T {
  assertString(value, name);
  if (!(allowed as readonly string[]).includes(value)) {
    const list = allowed.map((item) => JSON.stringify(item)).join(", ");
    throw new RangeError(`${name} must be one of ${list}, got ${JSON.stringify(value)}`);
  }
}

/** An integer from `min` to `max`: another type is a TypeError, any other number a RangeError. */
export function assertInteger(
  value: unknown,
  min: number,
  max: number,
  name: string,
): asserts value is number {
  if (typeof value !== "number") {
    throw new TypeError(`${name} must be a number, got ${describeType(value)}`);
  }
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} must be an integer from ${min} to ${max}, got ${value}`);
  }
}

/** The value at `path` inside `root` (a zod issue's path), or undefined where there is none. */
export function valueAt(root: unknown, path: readonly PropertyKey[]): unknown {
  let node = root;
  for (const key of path) {
    node =
      typeof node === "object" && node !== null
        ? (node as Record<PropertyKey, unknown>)[key]
        : undefined;
  }
  return node;
}
