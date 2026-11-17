// Checks the export's generators share (R6-41, spec R-05). Pure.

/** The type of `value` as an error message names it: `null` and arrays are not "object". */
export function describeType(value: unknown): string {
  if (value === null) return "null";
  return Array.isArray(value) ? "array" : typeof value;
}

/**
 * `origin` when it is an `https` origin with no path; else a TypeError (not a string) or a
 * RangeError, each message starting with `caller`.
 */
export function httpsOrigin(origin: unknown, caller: string): string {
  if (typeof origin !== "string") {
    throw new TypeError(`${caller}: origin must be a string, got ${describeType(origin)}`);
  }
  let valid = false;
  try {
    const url = new URL(origin);
    valid = url.protocol === "https:" && url.origin === origin;
  } catch {
    valid = false;
  }
  if (!valid) {
    throw new RangeError(
      `${caller}: origin must be an https origin with no path, got ${JSON.stringify(origin)}`,
    );
  }
  return origin;
}
