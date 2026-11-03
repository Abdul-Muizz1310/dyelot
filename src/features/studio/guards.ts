// Input checks shared by the studio's pure helpers (spec R-05): a value of the wrong type is a
// TypeError, a value outside its domain a RangeError, and both name the public function.

/** The type of `value` as an error message names it: `null` and arrays are not "object". */
export function describeType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

/** Whether `value` is a non-null object that is not an array. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A non-null object that is not an array, or a TypeError naming `name`. */
export function assertRecord(
  value: unknown,
  name: string,
): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    throw new TypeError(`${name} must be an object, got ${describeType(value)}`);
  }
}

/** A string, or a TypeError naming `name`. */
export function assertString(value: unknown, name: string): asserts value is string {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a string, got ${describeType(value)}`);
  }
}

/** One of `allowed`: another type is a TypeError, another string a RangeError. */
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

/** Whether `value` is one of `allowed`. */
export function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}
