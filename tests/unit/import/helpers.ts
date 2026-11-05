import { readFileSync } from "node:fs";
import path from "node:path";
import type { ImportResult } from "@/import/report";

/** A fixture of tests/fixtures/import/ as text. */
export function readFixture(name: string): string {
  return readFileSync(path.join(import.meta.dirname, "../../fixtures/import", name), "utf8");
}

/** The result of an import that must have succeeded. */
export function okOf(result: ImportResult) {
  if (!result.ok) throw new Error(`expected ok, got ${result.error.code}`);
  return result;
}

/** The error of an import that must have failed. */
export function errorOf(result: ImportResult) {
  if (result.ok) throw new Error("expected an error, got ok");
  return result.error;
}

/** Whether two hexes agree within `tolerance` on each channel. */
export function hexNear(a: string, b: string, tolerance = 1): boolean {
  const channels = (hex: string) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
  const [ca, cb] = [channels(a), channels(b)];
  return ca.every((value, i) => Math.abs(value - (cb[i] as number)) <= tolerance);
}
