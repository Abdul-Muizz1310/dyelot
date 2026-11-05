import { sha256 } from "@/export/sha256";
import { assertInteger, assertOneOf, assertRecord } from "./assert";
import { stableJson } from "./chat";
import { AI_FEATURES, type AiFeature, type FeatureInput, inputSchema } from "./features";

// The shared route's cache key (docs/specs/04-ai.md, R4-19 and section 11.5). The same input and
// prompt version give the same key whatever the order of its keys; a vibe's image counts by its
// bytes, through its data URL's SHA-256, so the key stays short.

/** A prompt's version (section 6.1). */
const MAX_VERSION = 9999;

/**
 * `<feature>:v<version>:<SHA-256 hex of stableJson(normalized input)>`. A vibe's normalized input is
 * `{ clusters, image: { sha256, width, height } }`, the data URL replaced by its own SHA-256.
 */
export function cacheKey<F extends AiFeature>(
  feature: F,
  input: FeatureInput[F],
  version: number,
): string {
  assertOneOf(feature, AI_FEATURES, "cacheKey: feature");
  assertRecord(input, "cacheKey: input");
  const result = inputSchema(feature).safeParse(input);
  if (!result.success) {
    throw new RangeError(
      `cacheKey: input is not a ${feature} input (${result.error.issues[0]?.message})`,
    );
  }
  assertInteger(version, 1, MAX_VERSION, "cacheKey: version");
  let normalized: unknown = input;
  if (feature === "vibe") {
    const { clusters, image } = input as FeatureInput["vibe"];
    normalized = {
      clusters,
      image: { sha256: sha256(image.dataUrl), width: image.width, height: image.height },
    };
  }
  return `${feature}:v${version}:${sha256(stableJson(normalized))}`;
}
