import { lotTag, normalizeSpec, specId } from "@/spec";
import { agentsSnippet } from "./agents";
import { CHECKER_SOURCE } from "./checker/source";
import { designMd } from "./design-md";
import { dtcgFiles } from "./dtcg";
import { figmaFiles } from "./figma";
import { flavorFiles } from "./flavor";
import { motionFiles } from "./motion";
import { promptMd } from "./prompt";
import { receiptJson } from "./receipt";
import { registryItems } from "./registry";
import { skillFile } from "./skill";
import { editLink, slug } from "./text";
import { themeCss } from "./theme-css";
import { toonFile } from "./toon";
import type { Bundle, BundleFile, BundleInput, Receipt } from "./types";

// `buildBundle` (R3-12, section 6.8): the files of a design in a fixed order, the receipt last over
// the others. It reads no clock, locale or randomness, so one input gives one set of bytes.

function describeType(value: unknown): string {
  if (value === null) return "null";
  return Array.isArray(value) ? "array" : typeof value;
}

function checkOrigin(origin: unknown): string {
  if (typeof origin !== "string") {
    throw new TypeError(`buildBundle: origin must be a string, got ${describeType(origin)}`);
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
      `buildBundle: origin must be an https origin with no path, got ${JSON.stringify(origin)}`,
    );
  }
  return origin;
}

/** The 18 to 21 files of a design, 27 to 30 with the flavor files, `receipt.json` last (R3-12, R5-24). */
export function buildBundle(input: BundleInput): Bundle {
  if (typeof input !== "object" || input === null) {
    throw new TypeError(`buildBundle: input must be an object, got ${describeType(input)}`);
  }
  const origin = checkOrigin(input.origin);
  if (input.flavor !== undefined && typeof input.flavor !== "boolean") {
    throw new TypeError(
      `buildBundle: input.flavor must be a boolean, got ${describeType(input.flavor)}`,
    );
  }
  const spec = normalizeSpec(input.spec);
  const name = slug(spec.meta.name);
  const id = specId(spec);
  const lot = lotTag(id);
  const registry = registryItems(spec, name);
  const dtcg = dtcgFiles(spec, spec.meta.name, origin);
  const figma = figmaFiles(spec, spec.meta.name);

  const others: BundleFile[] = [
    { path: "DESIGN.md", text: designMd(spec, origin) },
    { path: "AGENTS.md.snippet", text: agentsSnippet(spec) },
    { path: "prompt.md", text: promptMd(spec, origin) },
    { path: "app/theme.css", text: themeCss(spec, origin) },
    ...registry,
    ...dtcg,
    ...figma,
    toonFile(spec),
    ...motionFiles(spec, spec.meta.name, lot, origin),
    ...(input.flavor === true ? flavorFiles(spec, origin) : []),
    skillFile(spec, name, origin),
    { path: "scripts/dyelot-check.mjs", text: CHECKER_SOURCE },
  ];
  const text = receiptJson(spec, others, origin);
  const receipt = JSON.parse(text) as Receipt;
  return {
    slug: name,
    specId: id,
    lot,
    link: editLink(spec, origin),
    files: [...others, { path: "receipt.json", text }],
    receipt,
    summary: receipt.summary,
  };
}
