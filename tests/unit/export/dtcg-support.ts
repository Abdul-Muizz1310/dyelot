import { type Hex, hexToRgb, rgbToOklch, round6, roundHue } from "@/engine";
import { dtcgFiles } from "@/export/dtcg";
import type { DesignSpec } from "@/spec";
import { GOLDENS, ORIGIN, SPEC } from "./golden-support";

// Helpers shared by dtcg.test.ts and dtcg-property.test.ts (C-DTCG-01 to 14).

export type Json = Record<string, unknown>;
export const NAME = "Test Design";
export const PATHS = [
  "tokens/base.tokens.json",
  "tokens/light.tokens.json",
  "tokens/dark.tokens.json",
  "tokens/design.resolver.json",
];
export const NAME_PATTERN = /^[^${}.][^{}.]*$/;
export const INTEGERS = ["0", "1", "2", "3", "4", "6", "8", "12", "16", "20", "24", "32"];

export function filesOf(spec: DesignSpec = SPEC) {
  return dtcgFiles(spec, NAME, ORIGIN);
}
export function parsed(spec: DesignSpec = SPEC): Record<string, Json> {
  return Object.fromEntries(filesOf(spec).map((f) => [f.path, JSON.parse(f.text) as Json]));
}
export function group(root: Json, ...keys: string[]): Json {
  let node: unknown = root;
  for (const key of keys) node = (node as Json)[key];
  return node as Json;
}
export function goldenSpec(id: string): DesignSpec {
  const found = GOLDENS.find((g) => g.id === id);
  if (found === undefined) throw new Error(`no golden ${id}`);
  return found.spec;
}

export type Token = { path: string[]; node: Json };
/** Every token (an object with `$value`) and every group of a token file. */
export function walk(node: Json, trail: string[] = [], tokens: Token[] = [], groups: Json[] = []) {
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith("$") || typeof child !== "object" || child === null) continue;
    if ("$value" in child) tokens.push({ path: [...trail, key], node: child as Json });
    else {
      groups.push(child as Json);
      walk(child as Json, [...trail, key], tokens, groups);
    }
  }
  return { tokens, groups };
}

export function oklchOf(hex: string) {
  const { l, c, h } = rgbToOklch(hexToRgb(hex as Hex), "srgb");
  return [round6(l), round6(c), h === null ? "none" : roundHue(h)];
}
