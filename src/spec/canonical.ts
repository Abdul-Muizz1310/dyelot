import { describeType } from "../engine/color/guards";
import { round6, roundHue } from "../engine/round";
import type { DesignSpec } from "./schema";

/**
 * Keys whose number is a hue. Their numbers go through `roundHue` rather than `round6`, so a hue
 * in [359.9995, 360) writes as 0 and an imported spec keeps passing the schema (spec R-02, R-21).
 */
const HUE_KEYS: ReadonlySet<string> = new Set(["h", "hue"]);

function writeNumber(value: number, path: string, hue: boolean): string {
  if (!Number.isFinite(value)) {
    throw new RangeError(`canonicalize: ${path} must be a finite number, got ${value}`);
  }
  // `String` writes the shortest text that reads back as the same double, as JSON does.
  return String(hue ? roundHue(value) : round6(value));
}

function writeObject(value: object, path: string, ancestors: object[]): string {
  if (ancestors.includes(value)) {
    throw new TypeError(`canonicalize: ${path} refers back to an object that contains it`);
  }
  ancestors.push(value);
  try {
    if (Array.isArray(value)) {
      // `Array.from` visits holes as undefined, which then throws like any undefined item.
      const items = Array.from(value, (item, i) => write(item, `${path}[${i}]`, false, ancestors));
      return `[${items.join(",")}]`;
    }
    const prototype: unknown = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(`canonicalize: ${path} must be a plain object or an array`);
    }
    const record = value as Record<string, unknown>;
    // The default sort compares UTF-16 code units, the same order on every platform.
    const members = Object.keys(record)
      .sort()
      .filter((key) => record[key] !== undefined)
      .map((key) => {
        const text = write(record[key], `${path}.${key}`, HUE_KEYS.has(key), ancestors);
        return `${JSON.stringify(key)}:${text}`;
      });
    return `{${members.join(",")}}`;
  } finally {
    ancestors.pop();
  }
}

function write(value: unknown, path: string, hue: boolean, ancestors: object[]): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "number":
      return writeNumber(value, path, hue);
    case "string":
      return JSON.stringify(value);
    case "boolean":
      return value ? "true" : "false";
    case "object":
      return writeObject(value, path, ancestors);
    default:
      throw new TypeError(`canonicalize: ${path} cannot be written as JSON, got ${typeof value}`);
  }
}

/**
 * The canonical JSON text of a JSON-like value (spec R-21): keys sorted at every level, array
 * order kept, undefined properties left out, `null` kept, strings escaped as `JSON.stringify`
 * escapes them, no whitespace, and every number through `round6`, or `roundHue` under the key
 * `h` or `hue`. A number that is not finite throws RangeError, where `JSON.stringify` would write
 * `null`. A value JSON cannot carry (a function, a symbol, a bigint, an undefined array item, an
 * object that is not plain) or a cycle throws TypeError. Errors name the path from `name`.
 */
export function canonicalJson(value: unknown, name = "value"): string {
  return write(value, name, false, []);
}

/**
 * The canonical string of a spec (spec R-21), the input of `specId` and of the share link. For a
 * generated spec, `JSON.parse(canonicalize(spec))` deep-equals the spec, because the engine
 * stores every number already rounded (R-02).
 */
export function canonicalize(spec: DesignSpec): string {
  if (typeof spec !== "object" || spec === null || Array.isArray(spec)) {
    const got = Array.isArray(spec) ? "array" : describeType(spec);
    throw new TypeError(`canonicalize: spec must be an object, got ${got}`);
  }
  return canonicalJson(spec, "spec");
}
