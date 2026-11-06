import { type DesignSpec, specId } from "@/spec";
import { slug } from "./text";

// The download names of the two videos (R5-28): `<slug>-<8 hex digits of the spec id>-<kind>.<container>`.

const KINDS = ["brand", "loop"] as const;
const CONTAINERS = ["mp4", "webm"] as const;

function describeType(value: unknown): string {
  if (value === null) return "null";
  return Array.isArray(value) ? "array" : typeof value;
}

/** The file name of the brand video or the background loop of a design. */
export function mediaName(
  spec: DesignSpec,
  kind: "brand" | "loop",
  container: "mp4" | "webm",
): string {
  if (typeof spec !== "object" || spec === null) {
    throw new TypeError(`mediaName: spec must be an object, got ${describeType(spec)}`);
  }
  if (typeof kind !== "string") {
    throw new TypeError(`mediaName: kind must be a string, got ${describeType(kind)}`);
  }
  if (typeof container !== "string") {
    throw new TypeError(`mediaName: container must be a string, got ${describeType(container)}`);
  }
  if (!KINDS.includes(kind)) {
    throw new RangeError(`mediaName: kind must be brand or loop, got ${JSON.stringify(kind)}`);
  }
  if (!CONTAINERS.includes(container)) {
    throw new RangeError(
      `mediaName: container must be mp4 or webm, got ${JSON.stringify(container)}`,
    );
  }
  return `${slug(spec.meta.name)}-${specId(spec).slice(0, 8)}-${kind}.${container}`;
}
