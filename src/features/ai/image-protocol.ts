import type { RawCluster } from "@/engine";
import { assertString, describeType, isOneOf, isRecord } from "@/features/studio/guards";

// The image's limits and the worker's protocol (R4-46, sections 5.6 and 9.1 of
// docs/specs/04-ai.md): pure helpers the studio checks at first paint, before the AI layer loads,
// and the worker runs on the file's bytes. `imageSize` reads the width and height a header states
// without decoding a pixel, so the worker refuses a decompression bomb before `createImageBitmap`.

/** The file types the image input accepts. */
export const IMAGE_TYPES = Object.freeze([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
] as const);

/** The largest file the studio reads: 10 MB. */
export const IMAGE_MAX_BYTES = 10_485_760;
/** The longest side of the canvas the quantizer reads (9.1 step 3). */
export const ANALYSIS_SIDE = 256;
/** The longest side of the JPEG "Read the vibe" sends (9.1 step 4). */
export const VIBE_SIDE = 768;
/** The largest JPEG "Read the vibe" sends (9.1 step 4). */
export const JPEG_MAX_BYTES = 1_048_576;
/** The most pixels the worker decodes (9.1 steps 1 and 2). */
export const MAX_PIXELS = 50_000_000;

/** Section 13.3's messages for a file the input refuses. */
const TYPE_MESSAGE = "Choose a PNG, JPEG, WebP, GIF or AVIF image.";
const SIZE_MESSAGE = "That image is larger than 10 MB. Choose a smaller one.";

/** What the client posts to the worker: the newest request's id and the chosen file. */
export type ImageRequest = { readonly id: number; readonly file: Blob };

/** Why the worker could not read an image (9.1). */
const IMAGE_ERRORS = ["decode", "too-many-pixels", "quantize"] as const;

/** The worker's answer: the clusters, the decoded size and the JPEG for the vibe, or an error. */
export type ImageReply =
  | {
      readonly id: number;
      readonly ok: true;
      readonly clusters: readonly RawCluster[];
      readonly width: number;
      readonly height: number;
      readonly jpeg: {
        readonly bytes: ArrayBuffer;
        readonly width: number;
        readonly height: number;
      } | null;
    }
  | { readonly id: number; readonly ok: false; readonly error: (typeof IMAGE_ERRORS)[number] };

type ImageDimensions = { width: number; height: number };

/**
 * Whether the input takes a file of this type and size, checked before the file is read (R4-46):
 * one of `IMAGE_TYPES`, else 13.3's type message, and at most `IMAGE_MAX_BYTES`, else its size
 * message. The type is checked first. `size` is a byte count: a non-negative safe integer.
 */
export function imageAccepted(
  type: string,
  size: number,
): { readonly ok: true } | { readonly ok: false; readonly message: string } {
  assertString(type, "imageAccepted: type");
  if (typeof size !== "number") {
    throw new TypeError(`imageAccepted: size must be a number, got ${describeType(size)}`);
  }
  if (!Number.isSafeInteger(size) || size < 0) {
    throw new RangeError(`imageAccepted: size must be a whole number of bytes, got ${size}`);
  }
  if (!isOneOf(type, IMAGE_TYPES)) return { ok: false, message: TYPE_MESSAGE };
  if (size > IMAGE_MAX_BYTES) return { ok: false, message: SIZE_MESSAGE };
  return { ok: true };
}

/** A side in pixels: a positive safe integer, else a TypeError or RangeError naming `name`. */
function assertSide(value: unknown, name: string): asserts value is number {
  if (typeof value !== "number") {
    throw new TypeError(`${name} must be a number, got ${describeType(value)}`);
  }
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a whole number of pixels of at least 1, got ${value}`);
  }
}

/**
 * The size of a canvas whose longest side is at most `max` (9.1): both sides scaled by
 * `min(1, max / max(width, height))` and rounded, each at least 1. It never upscales.
 */
export function fitWithin(width: number, height: number, max: number): ImageDimensions {
  assertSide(width, "fitWithin: width");
  assertSide(height, "fitWithin: height");
  assertSide(max, "fitWithin: max");
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

// The header readers of 9.1 step 1. Each reads only the bytes it checks it has, so a short or
// malformed header gives null and nothing throws; each returns null when the bytes are not its
// format, so `imageSize` asks them in turn.

const be16 = (b: Uint8Array, at: number): number =>
  ((b[at] as number) << 8) | (b[at + 1] as number);
const be32 = (b: Uint8Array, at: number): number => be16(b, at) * 0x10000 + be16(b, at + 2);
const le16 = (b: Uint8Array, at: number): number =>
  (b[at] as number) | ((b[at + 1] as number) << 8);
const le24 = (b: Uint8Array, at: number): number => le16(b, at) + (b[at + 2] as number) * 0x10000;
const le32 = (b: Uint8Array, at: number): number => le16(b, at) + le16(b, at + 2) * 0x10000;
/** `length` bytes (four by default) as Latin-1 text: a chunk or box type, a brand, a signature. */
const tag = (b: Uint8Array, at: number, length = 4): string =>
  String.fromCharCode(...b.subarray(at, at + length));

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/** The largest side PNG allows (2^31 − 1). */
const PNG_SIDE_MAX = 0x7fffffff;

/** The PNG `IHDR`, the first chunk: its length 13, its type, then the width and height. */
function pngSize(b: Uint8Array): ImageDimensions | null {
  if (b.length < 24 || PNG_SIGNATURE.some((byte, i) => b[i] !== byte)) return null;
  if (be32(b, 8) !== 13 || tag(b, 12) !== "IHDR") return null;
  const width = be32(b, 16);
  const height = be32(b, 20);
  return width > PNG_SIDE_MAX || height > PNG_SIDE_MAX ? null : { width, height };
}

/** The GIF logical screen descriptor, right after the signature. */
function gifSize(b: Uint8Array): ImageDimensions | null {
  if (b.length < 10) return null;
  const signature = tag(b, 0, 6);
  if (signature !== "GIF87a" && signature !== "GIF89a") return null;
  return { width: le16(b, 6), height: le16(b, 8) };
}

/** A frame header: SOF0 to SOF15 other than DHT (C4), JPG (C8) and DAC (CC). */
const isFrameHeader = (code: number): boolean =>
  code >= 0xc0 && code <= 0xcf && code !== 0xc4 && code !== 0xc8 && code !== 0xcc;
/** Markers that carry no length: TEM, RST0 to RST7 and SOI. */
const isStandalone = (code: number): boolean => code === 0x01 || (code >= 0xd0 && code <= 0xd8);
const SOS = 0xda;
const EOI = 0xd9;
/** A frame header's length, without its components: Lf, P, Y, X and Nf. */
const FRAME_HEADER_MIN = 8;

/**
 * The first JPEG frame header's height and width: the segments after SOI are skipped by their
 * lengths (EXIF, tables, comments), fill bytes before a marker are skipped, and a scan or the end
 * before any frame header gives null.
 */
function jpegSize(b: Uint8Array): ImageDimensions | null {
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let at = 2;
  while (at < b.length) {
    if (b[at] !== 0xff) return null;
    while (b[at] === 0xff) at++;
    if (at >= b.length) return null;
    const code = b[at] as number;
    at++;
    if (code === SOS || code === EOI || code === 0x00) return null;
    if (isStandalone(code)) continue;
    if (at + 2 > b.length) return null;
    const length = be16(b, at);
    if (length < 2) return null;
    if (isFrameHeader(code)) {
      if (length < FRAME_HEADER_MIN || at + 7 > b.length) return null;
      return { width: be16(b, at + 5), height: be16(b, at + 3) };
    }
    at += length;
  }
  return null;
}

/** The WebP's first chunk: `VP8 ` (a lossy key frame), `VP8L` (lossless) or `VP8X` (the canvas). */
function webpSize(b: Uint8Array): ImageDimensions | null {
  if (b.length < 16 || tag(b, 0) !== "RIFF" || tag(b, 8) !== "WEBP") return null;
  const chunk = tag(b, 12);
  if (chunk === "VP8 ") {
    // A key frame (bit 0 of the frame tag clear), the start code, then 14-bit sides.
    if (b.length < 30 || ((b[20] as number) & 1) !== 0) return null;
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return { width: le16(b, 26) & 0x3fff, height: le16(b, 28) & 0x3fff };
  }
  if (chunk === "VP8L") {
    // The signature 0x2f, then width − 1 and height − 1 in 14 bits each and a version of 0.
    if (b.length < 25 || b[20] !== 0x2f) return null;
    const bits = le32(b, 21);
    if (bits >>> 29 !== 0) return null;
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X") {
    // Flags and three reserved bytes, then the canvas's width − 1 and height − 1 in 24 bits each.
    if (b.length < 30) return null;
    return { width: le24(b, 24) + 1, height: le24(b, 27) + 1 };
  }
  return null;
}

/** An ISO BMFF box: its type, where its payload starts and where it ends. */
type Box = { readonly type: string; readonly start: number; readonly end: number };

/** The box at `at` inside a container ending at `end`, or null when it is malformed or runs past. */
function readBox(b: Uint8Array, at: number, end: number): Box | null {
  if (at + 8 > end) return null;
  let size = be32(b, at);
  let header = 8;
  if (size === 1) {
    if (at + 16 > end) return null;
    size = be32(b, at + 8) * 2 ** 32 + be32(b, at + 12);
    header = 16;
  } else if (size === 0) {
    size = end - at;
  }
  if (size < header || at + size > end) return null;
  return { type: tag(b, at + 4), start: at + header, end: at + size };
}

/** Every box of a container's payload, or null when one is malformed. */
function children(b: Uint8Array, container: Box, skip = 0): Box[] | null {
  const boxes: Box[] = [];
  for (let at = container.start + skip; at < container.end; ) {
    const next = readBox(b, at, container.end);
    if (next === null) return null;
    boxes.push(next);
    at = next.end;
  }
  return boxes;
}

const AVIF_BRANDS = ["avif", "avis"];

/** Whether an `ftyp` box names AVIF as its major brand or a compatible one. */
function isAvif(b: Uint8Array, ftyp: Box): boolean {
  if (ftyp.end - ftyp.start < 8) return false;
  const brands = [tag(b, ftyp.start)];
  for (let at = ftyp.start + 8; at + 4 <= ftyp.end; at += 4) brands.push(tag(b, at));
  return brands.some((brand) => AVIF_BRANDS.includes(brand));
}

/**
 * The AVIF's `ispe` boxes, in `meta` › `iprp` › `ipco`, after an `ftyp` that names AVIF: the
 * largest by area, the first of equals. A grid image lists its tiles' `ispe` beside its own, and a
 * thumbnail or an alpha plane has one too, so the largest is the one that bounds the decode.
 */
function avifSize(b: Uint8Array): ImageDimensions | null {
  if (tag(b, 4) !== "ftyp") return null;
  const ftyp = readBox(b, 0, b.length);
  if (ftyp === null || !isAvif(b, ftyp)) return null;
  let meta = readBox(b, ftyp.end, b.length);
  while (meta !== null && meta.type !== "meta") meta = readBox(b, meta.end, b.length);
  if (meta === null) return null;
  // `meta` is a full box: four bytes of version and flags come before its children.
  if (meta.end - meta.start < 4) return null;
  const iprp = children(b, meta, 4)?.find((box) => box.type === "iprp");
  const ipco = iprp && children(b, iprp)?.find((box) => box.type === "ipco");
  const properties = ipco && children(b, ipco);
  if (!properties) return null;
  let largest: ImageDimensions | null = null;
  for (const box of properties) {
    if (box.type !== "ispe") continue;
    // A full box too: version and flags, then the width and the height.
    if (box.end - box.start < 12) return null;
    const size = { width: be32(b, box.start + 4), height: be32(b, box.start + 8) };
    if (largest === null || size.width * size.height > largest.width * largest.height) {
      largest = size;
    }
  }
  return largest;
}

/**
 * The width and height a file's header states (9.1 step 1), read before any decode: the PNG
 * `IHDR`, the GIF logical screen descriptor, the first JPEG frame header, the WebP `VP8 `, `VP8L` or
 * `VP8X` chunk, or the AVIF `ispe`. The reader follows the bytes' signature, as the browser's decoder
 * sniffs them, so a file that claims another listed type is still sized. Null for a type outside
 * `IMAGE_TYPES`, a header it cannot read, or a side of 0. It never throws for a `Uint8Array`.
 */
export function imageSize(bytes: Uint8Array, type: string): ImageDimensions | null {
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError(`imageSize: bytes must be a Uint8Array, got ${describeType(bytes)}`);
  }
  assertString(type, "imageSize: type");
  if (!isOneOf(type, IMAGE_TYPES)) return null;
  const size =
    pngSize(bytes) ?? gifSize(bytes) ?? jpegSize(bytes) ?? webpSize(bytes) ?? avifSize(bytes);
  return size !== null && size.width > 0 && size.height > 0 ? size : null;
}

// The reply as the client reads it: it arrives as `unknown`, so every field is checked, and a
// reply the studio could not use is null.

const HEX = /^#[0-9a-f]{6}$/;
/** The most clusters a reply holds, and the most their shares may sum to (as `imagePalette` takes them). */
const MAX_CLUSTERS = 8;
const SHARE_SUM_MAX = 1.000001;

const isId = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const isSide = (value: unknown, max = Number.MAX_SAFE_INTEGER): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value <= max;

/** The clusters as `imagePalette` takes them, copied, or null. */
function readClusters(value: unknown): RawCluster[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_CLUSTERS) return null;
  const clusters: RawCluster[] = [];
  let total = 0;
  for (const entry of value as unknown[]) {
    if (!isRecord(entry)) return null;
    const { hex, share } = entry;
    if (typeof hex !== "string" || !HEX.test(hex)) return null;
    if (typeof share !== "number" || !Number.isFinite(share) || share <= 0 || share > 1) {
      return null;
    }
    total += share;
    clusters.push({ hex, share });
  }
  return total <= SHARE_SUM_MAX ? clusters : null;
}

type ReplyJpeg = Extract<ImageReply, { ok: true }>["jpeg"];

/** The JPEG of a success: null, or its bytes (1 to `JPEG_MAX_BYTES`) and its sides (1 to `VIBE_SIDE`). */
function readJpeg(value: unknown): ReplyJpeg | undefined {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  const { bytes, width, height } = value;
  if (
    !(bytes instanceof ArrayBuffer) ||
    bytes.byteLength < 1 ||
    bytes.byteLength > JPEG_MAX_BYTES
  ) {
    return undefined;
  }
  if (!isSide(width, VIBE_SIDE) || !isSide(height, VIBE_SIDE)) return undefined;
  return { bytes, width, height };
}

/**
 * The worker's message as an `ImageReply`, or null when it is not one: an id (a non-negative safe
 * integer), then either an error of `IMAGE_ERRORS`, or 1 to 8 clusters that `imagePalette` takes,
 * the decoded width and height, and a JPEG or null. Only the reply's own fields are kept. It never
 * throws.
 */
export function parseImageReply(data: unknown): ImageReply | null {
  if (!isRecord(data) || !isId(data.id)) return null;
  const { id, ok } = data;
  if (ok === false) {
    return isOneOf(data.error, IMAGE_ERRORS) ? { id, ok: false, error: data.error } : null;
  }
  if (ok !== true) return null;
  const clusters = readClusters(data.clusters);
  const jpeg = readJpeg(data.jpeg);
  const { width, height } = data;
  if (clusters === null || jpeg === undefined || !isSide(width) || !isSide(height)) return null;
  return { id, ok: true, clusters, width, height, jpeg };
}
