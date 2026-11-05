import { getPalette } from "colorthief";
import type { RawCluster } from "@/engine";
import {
  ANALYSIS_SIDE,
  fitWithin,
  type ImageReply,
  imageSize,
  JPEG_MAX_BYTES,
  MAX_PIXELS,
  VIBE_SIDE,
} from "@/features/ai/image-protocol";
import { isRecord } from "@/features/studio/guards";

// The image worker (docs/specs/04-ai.md, 9.1, R4-46): it answers each request with one reply, off
// the main thread. It reads the size the header states and refuses a bomb before any decode; it
// decodes with the file's orientation and checks the decoded size too, always; it quantizes a copy
// of at most 256 px with colorthief, on an OffscreenCanvas (never an ImageBitmap, whose loader
// calls `document`), and flattens each color to plain data; and it encodes the JPEG "Read the
// vibe" may send, at most 768 px, whose bytes it transfers. Nothing here leaves the device.

type ImageFailure = Extract<ImageReply, { ok: false }>["error"];
type ImageJpeg = Extract<ImageReply, { ok: true }>["jpeg"];

/** The palette's size and its sampling: every pixel of the small copy, quantized in OKLCH. */
const PALETTE = { colorCount: 8, quality: 1, colorSpace: "oklch" } as const;
/** The JPEG's qualities, the second tried only when the first is over `JPEG_MAX_BYTES` (9.1 step 4). */
const JPEG_QUALITIES = [0.85, 0.6] as const;
const MAX_CLUSTERS = 8;

/** The bitmap drawn on a canvas whose longest side is at most `side`, never upscaled. */
function drawn(bitmap: ImageBitmap, side: number): OffscreenCanvas {
  const { width, height } = fitWithin(bitmap.width, bitmap.height, side);
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("image.worker: the canvas gave no 2D context");
  context.imageSmoothingQuality = "medium";
  context.drawImage(bitmap, 0, 0, width, height);
  return canvas;
}

/**
 * The palette of the 256-px copy (9.1 step 3): each color flattened to `{ hex, share }`, largest
 * share first, 1 to 8 of them. Null when colorthief throws or finds no color.
 */
async function clustersOf(bitmap: ImageBitmap): Promise<RawCluster[] | null> {
  let colors: Awaited<ReturnType<typeof getPalette>>;
  try {
    colors = await getPalette(drawn(bitmap, ANALYSIS_SIDE), PALETTE);
  } catch {
    return null;
  }
  if (!Array.isArray(colors)) return null;
  const clusters = colors
    .filter((color) => Number.isFinite(color.proportion) && color.proportion > 0)
    .map((color) => ({ hex: color.hex().toLowerCase(), share: color.proportion }))
    .sort((a, b) => b.share - a.share)
    .slice(0, MAX_CLUSTERS);
  return clusters.length > 0 ? clusters : null;
}

/**
 * The JPEG of the 768-px copy (9.1 step 4): at quality 0.85, else 0.6 when that is over
 * `JPEG_MAX_BYTES`; null when both are over, or when the browser cannot encode it.
 */
async function jpegOf(bitmap: ImageBitmap): Promise<ImageJpeg> {
  try {
    const canvas = drawn(bitmap, VIBE_SIDE);
    for (const quality of JPEG_QUALITIES) {
      const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
      if (blob.size <= JPEG_MAX_BYTES) {
        return { bytes: await blob.arrayBuffer(), width: canvas.width, height: canvas.height };
      }
    }
  } catch {
    // An encoder that fails leaves the image without a JPEG: its colors still apply.
  }
  return null;
}

/** One request's reply (9.1 steps 1 to 5). */
async function answer(id: number, file: Blob): Promise<ImageReply> {
  const refuse = (error: ImageFailure): ImageReply => ({ id, ok: false, error });
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return refuse("decode");
  }
  const stated = imageSize(bytes, file.type);
  if (stated !== null && stated.width * stated.height > MAX_PIXELS) {
    return refuse("too-many-pixels");
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return refuse("decode");
  }
  try {
    // A header can state fewer pixels than are decoded, or none: the decoded size decides, always.
    const { width, height } = bitmap;
    if (width * height > MAX_PIXELS) return refuse("too-many-pixels");
    const clusters = await clustersOf(bitmap);
    if (clusters === null) return refuse("quantize");
    const jpeg = await jpegOf(bitmap);
    return { id, ok: true, clusters, width, height, jpeg };
  } finally {
    bitmap.close();
  }
}

/** A request the client sent: a non-negative safe integer id and a Blob; anything else is dropped. */
function readRequest(data: unknown): { id: number; file: Blob } | null {
  if (!isRecord(data)) return null;
  const { id, file } = data;
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id < 0) return null;
  return file instanceof Blob ? { id, file } : null;
}

addEventListener("message", (event: MessageEvent<unknown>) => {
  const request = readRequest(event.data);
  if (request === null) return;
  void answer(request.id, request.file)
    // Every request gets its reply, so the client never waits on one that will not come.
    .catch((): ImageReply => ({ id: request.id, ok: false, error: "decode" }))
    .then((reply) => {
      const transfer = reply.ok && reply.jpeg !== null ? [reply.jpeg.bytes] : [];
      postMessage(reply, { transfer });
    });
});
