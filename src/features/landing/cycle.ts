import { describeType } from "@/features/studio/guards";

// The hero's palette cycle (docs/specs/05-motion-3d.md, section 5.5; R5-32). Pure; the hero's
// client code imports it, so it reaches no engine, spec or export file (C-GUARD5-05).

/** A number of any value, or a TypeError naming `name`. */
function assertNumber(value: unknown, name: string): asserts value is number {
  if (typeof value !== "number") {
    throw new TypeError(`${name} must be a number, got ${describeType(value)}`);
  }
}

/**
 * A count of cards, a whole number of at least 1, and an index among them, a whole number from 0
 * to `count - 1`, or a RangeError naming `caller`.
 */
function checkPlace(index: number, count: number, caller: string): void {
  if (!(Number.isInteger(count) && count >= 1)) {
    throw new RangeError(`${caller}: count must be a whole number of at least 1, got ${count}`);
  }
  if (!(Number.isInteger(index) && index >= 0 && index < count)) {
    throw new RangeError(
      `${caller}: index must be a whole number from 0 to ${count - 1}, got ${index}`,
    );
  }
}

/** The card after `index` among `count`: the last wraps to the first. */
export function nextIndex(index: number, count: number): number {
  assertNumber(index, "nextIndex: index");
  assertNumber(count, "nextIndex: count");
  checkPlace(index, count, "nextIndex");
  return (index + 1) % count;
}

/** "Palette 2 of 6: Weld.": the card at `index` among `count`, by its place and its name. */
export function paletteLine(index: number, count: number, name: string): string {
  assertNumber(index, "paletteLine: index");
  assertNumber(count, "paletteLine: count");
  if (typeof name !== "string") {
    throw new TypeError(`paletteLine: name must be a string, got ${describeType(name)}`);
  }
  checkPlace(index, count, "paletteLine");
  if (name === "") throw new RangeError("paletteLine: name must not be empty");
  return `Palette ${index + 1} of ${count}: ${name}.`;
}
