import { zipSync } from "fflate";
import type { Bundle } from "./types";

// `zipBundle` and `zipName` (R3-26). One object keyed by path in bundle order, the files' UTF-8 bytes
// and the global options of R3-26 only. The `mtime` string has no offset, so it reads as local
// midnight and fflate writes the same DOS date and time in every time zone.

// R3-09 allows `[a-z0-9._/-]`, yet R3-12 names DESIGN.md, AGENTS.md.snippet and SKILL.md, and R5-24
// adds README.md. Those four file names are the only capitals a path may hold, so `A.txt` stays a
// RangeError (C-ZIP-06).
const SEGMENT = /^[a-z0-9._-]+$/;
const FIXED_NAMES: ReadonlySet<string> = new Set([
  "DESIGN.md",
  "AGENTS.md.snippet",
  "SKILL.md",
  "README.md",
]);

function validPath(path: string): boolean {
  if (path === "" || path.startsWith("/") || path.startsWith(".") || path.includes("..")) {
    return false;
  }
  return path.split("/").every((part) => SEGMENT.test(part) || FIXED_NAMES.has(part));
}

function describeType(value: unknown): string {
  if (value === null) return "null";
  return Array.isArray(value) ? "array" : typeof value;
}

function checkBundle(bundle: unknown, who: string): Bundle {
  if (typeof bundle !== "object" || bundle === null) {
    throw new TypeError(`${who}: bundle must be an object, got ${describeType(bundle)}`);
  }
  const value = bundle as Partial<Bundle>;
  if (typeof value.slug !== "string" || typeof value.specId !== "string") {
    throw new TypeError(`${who}: bundle must hold a slug and a specId`);
  }
  return bundle as Bundle;
}

/** The zip of a bundle: the same bytes for the same bundle in every time zone. */
export function zipBundle(bundle: Bundle): Uint8Array {
  if (typeof bundle !== "object" || bundle === null || !Array.isArray(bundle.files)) {
    throw new TypeError(`zipBundle: bundle must hold a files array, got ${describeType(bundle)}`);
  }
  const entries: Record<string, Uint8Array> = {};
  const encoder = new TextEncoder();
  for (const file of bundle.files) {
    if (typeof file?.path !== "string" || typeof file.text !== "string") {
      throw new TypeError("zipBundle: each file must hold a path and a text");
    }
    const { path } = file;
    if (!validPath(path)) {
      throw new RangeError(`zipBundle: bad path ${JSON.stringify(path)}`);
    }
    if (Object.hasOwn(entries, path)) {
      throw new RangeError(`zipBundle: the path ${JSON.stringify(path)} appears twice`);
    }
    entries[path] = encoder.encode(file.text);
  }
  return zipSync(entries, { level: 6, mtime: "1980-01-01T00:00:00" });
}

/** `<slug>-<first 8 digits of the spec id>.zip`. */
export function zipName(bundle: Bundle): string {
  const { slug, specId } = checkBundle(bundle, "zipName");
  return `${slug}-${specId.slice(0, 8)}.zip`;
}
