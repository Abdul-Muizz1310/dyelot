// The public entry of the spec: the only way for code outside src/engine, src/spec and src/theme
// to reach it (spec R2-02). Internals (`canonicalJson`, `fnv1a64`, `SPEC_VERSION`) stay out.
export { canonicalize, normalizeSpec } from "./canonical";
export { specId } from "./hash";
export { lotTag } from "./lot";
export { type DesignSpec, DesignSpecSchema } from "./schema";
export { isPlainText, toPlainText } from "./text";
export { decodeSpec, encodeSpec, SpecDecodeError } from "./url-codec";
