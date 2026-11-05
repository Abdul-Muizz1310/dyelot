import type { DesignSpec } from "../../spec/schema";
import { describeType } from "../color/guards";
import { FONT_CATALOG, type FontEntry } from "../fonts/catalog";

// The type weights of spec R3-05: derived from a spec and its catalog, never stored (R3-04).

export type TypeWeights = {
  readonly heading: number;
  readonly label: number;
  readonly body: number;
};

const HEADING = 650;
const LABEL = 500;
const BODY = 400;

/** The weight a family can render nearest to `base`; a tie goes to the heavier. */
function nearest(entry: FontEntry | undefined, base: number): number {
  if (entry === undefined || entry.weights.length === 0) return base;
  if (entry.variable) {
    const min = Math.min(...entry.weights);
    const max = Math.max(...entry.weights);
    return Math.min(Math.max(base, min), max);
  }
  let best = entry.weights[0] as number;
  for (const weight of entry.weights) {
    const gap = Math.abs(weight - base);
    const bestGap = Math.abs(best - base);
    if (gap < bestGap || (gap === bestGap && weight > best)) best = weight;
  }
  return best;
}

function family(families: Record<string, unknown>, name: string): string {
  const id = families[name];
  if (typeof id !== "string") {
    throw new TypeError(
      `typeWeights: spec.type.families.${name} must be a string, got ${describeType(id)}`,
    );
  }
  return id;
}

/**
 * The weights of a spec's type: 650 for `heading`, read on the display family, and 500 for `label`
 * and 400 for `body`, read on the body family, each fitted to what the family has. A family outside
 * the catalog keeps the base weight.
 */
export function typeWeights(
  spec: Pick<DesignSpec, "type">,
  catalog: readonly FontEntry[] = FONT_CATALOG,
): TypeWeights {
  if (typeof spec !== "object" || spec === null) {
    throw new TypeError(`typeWeights: spec must be an object, got ${describeType(spec)}`);
  }
  const type: unknown = (spec as { type?: unknown }).type;
  if (typeof type !== "object" || type === null) {
    throw new TypeError(`typeWeights: spec.type must be an object, got ${describeType(type)}`);
  }
  const families: unknown = (type as { families?: unknown }).families;
  if (typeof families !== "object" || families === null) {
    throw new TypeError(
      `typeWeights: spec.type.families must be an object, got ${describeType(families)}`,
    );
  }
  if (!Array.isArray(catalog as unknown)) {
    throw new TypeError(`typeWeights: catalog must be an array, got ${describeType(catalog)}`);
  }
  const record = families as Record<string, unknown>;
  const display = catalog.find((entry) => entry.id === family(record, "display"));
  const body = catalog.find((entry) => entry.id === family(record, "body"));
  return Object.freeze({
    heading: nearest(display, HEADING),
    label: nearest(body, LABEL),
    body: nearest(body, BODY),
  });
}
