/**
 * Whether this browser can make a WebGL2 context (R5-39). The canvas is only probed: a context
 * that cannot be made, or code that throws while making one, both read as "no".
 */
export function supportsWebgl2(
  create: () => HTMLCanvasElement = () => document.createElement("canvas"),
): boolean {
  try {
    return create().getContext("webgl2") != null;
  } catch {
    return false;
  }
}
