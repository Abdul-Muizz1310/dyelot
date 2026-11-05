// The number helpers of the export (R3-10). Every number a writer prints goes through one of
// them. They work on the decimal digits of `String(x)`, the shortest text that reads back as `x`,
// so 1.13 stays 1.13 and 0.00005 rounds up: no multiplication by a power of ten ever runs.

function describeType(value: unknown): string {
  return value === null ? "null" : typeof value;
}

function check(x: number, who: string): void {
  if (typeof x !== "number") {
    throw new TypeError(`${who}: x must be a number, got ${describeType(x)}`);
  }
  if (!Number.isFinite(x)) throw new RangeError(`${who}: x must be finite, got ${x}`);
}

/** `String(|x|)` written out in full: the integer digits and the fraction digits, no exponent. */
function expand(x: number): { negative: boolean; int: string; frac: string } {
  const text = String(Math.abs(x));
  const match = /^(\d+)(?:\.(\d+))?(?:e([+-]\d+))?$/.exec(text);
  /* c8 ignore next */
  if (match === null) throw new RangeError(`expand: cannot read ${text}`);
  const digits = `${match[1]}${match[2] ?? ""}`;
  const point = (match[1] as string).length + Number(match[3] ?? 0);
  const padded = point < 0 ? `${"0".repeat(-point)}${digits}` : digits;
  const at = Math.max(point, 0);
  const whole = padded.length >= at ? padded : `${padded}${"0".repeat(at - padded.length)}`;
  return {
    negative: x < 0,
    int: whole.slice(0, at).replace(/^0+(?=\d)/, "") || "0",
    frac: whole.slice(at),
  };
}

/** Add one unit in the last place to a string of digits. */
function increment(digits: string): string {
  return (BigInt(digits) + BigInt(1)).toString().padStart(digits.length, "0");
}

/** `x` cut or rounded at `places` decimals, as text with no trailing zeros. */
function cut(x: number, places: number, round: boolean): string {
  const { negative, int, frac } = expand(x);
  let kept = `${int}${frac.slice(0, places).padEnd(places, "0")}`;
  if (round && (frac[places] ?? "0") >= "5") kept = increment(kept);
  kept = kept.padStart(places + 1, "0");
  const whole = kept.slice(0, kept.length - places).replace(/^0+(?=\d)/, "");
  const fraction = kept.slice(kept.length - places).replace(/0+$/, "");
  const text = fraction === "" ? whole : `${whole}.${fraction}`;
  return negative && text !== "0" ? `-${text}` : text;
}

/** Rounds half away from zero to 4 decimals; no trailing zeros, no exponent, -0 as `0`. */
export function fmt4(x: number): string {
  check(x, "fmt4");
  return cut(x, 4, true);
}

/**
 * Cuts toward zero at 4 decimals, so a ratio of 4.49999 prints `4.4999` and never reads as
 * passing (R3-10). It cuts the digits of `String(x)`, never `Math.trunc(x * 10000) / 10000`.
 */
export function trunc4(x: number): string {
  check(x, "trunc4");
  return cut(x, 4, false);
}

/** Rounds half away from zero to 1 decimal and returns a number (never -0). */
export function round1(x: number): number {
  check(x, "round1");
  return Number(cut(x, 1, true));
}
