import { readFileSync } from "node:fs";
import path from "node:path";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  ANALYSIS_SIDE,
  fitWithin,
  IMAGE_MAX_BYTES,
  IMAGE_TYPES,
  imageAccepted,
  imageSize,
  JPEG_MAX_BYTES,
  MAX_PIXELS,
  parseImageReply,
  VIBE_SIDE,
} from "@/features/ai/image-protocol";
import { copyProblems } from "../../ai/copy-rules";
import { FOUR_COLORS } from "../../engine/image/support";

// C-IMG-09, C-IMG-10, C-IMG-11 and C-IMG-15 of docs/specs/04-ai.md, section 14.6 (R4-46, 5.6, 9.1):
// the limits checked before a file is read, the sizes for the worker's canvases, the worker's reply
// as the client reads it, and the header sizes read before any decode.

const FIXTURES = path.resolve(import.meta.dirname, "../../../fixtures/ai");
const fixture = (name: string): Uint8Array =>
  new Uint8Array(readFileSync(path.join(FIXTURES, name)));

/** Section 13.3's two messages. */
const TYPE_MESSAGE = "Choose a PNG, JPEG, WebP, GIF or AVIF image.";
const SIZE_MESSAGE = "That image is larger than 10 MB. Choose a smaller one.";

/** Expects `run` to throw `kind` with a message that starts with `name`. */
function expectThrow(run: () => unknown, kind: typeof TypeError | typeof RangeError, name: string) {
  let caught: unknown;
  try {
    run();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(kind);
  expect((caught as Error).message.startsWith(`${name}:`), (caught as Error).message).toBe(true);
}

describe("C-IMG-09 imageAccepted", () => {
  it("C-IMG-09 lists the five types and the 10 MB limit, frozen", () => {
    expect([...IMAGE_TYPES]).toEqual([
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/gif",
      "image/avif",
    ]);
    expect(Object.isFrozen(IMAGE_TYPES)).toBe(true);
    expect(IMAGE_MAX_BYTES).toBe(10_485_760);
  });

  it.each(IMAGE_TYPES)("C-IMG-09 accepts %s at 10,485,760 bytes", (type) => {
    expect(imageAccepted(type, 10_485_760)).toEqual({ ok: true });
    expect(imageAccepted(type, 0)).toEqual({ ok: true });
  });

  it("C-IMG-09 gives 13.3's size message at 10,485,761 bytes", () => {
    expect(imageAccepted("image/png", 10_485_761)).toEqual({ ok: false, message: SIZE_MESSAGE });
  });

  it.each(["image/svg+xml", "image/heic", "", "IMAGE/PNG", "image/png "])(
    "C-IMG-09 gives 13.3's type message for %j",
    (type) => {
      expect(imageAccepted(type, 1)).toEqual({ ok: false, message: TYPE_MESSAGE });
    },
  );

  it("C-IMG-09 names the type first when both the type and the size are wrong", () => {
    expect(imageAccepted("image/heic", 10_485_761)).toEqual({ ok: false, message: TYPE_MESSAGE });
  });

  it("C-IMG-09 writes both messages under the copy rules", () => {
    for (const message of [TYPE_MESSAGE, SIZE_MESSAGE]) {
      expect(copyProblems(message), message).toEqual([]);
    }
  });

  it("C-IMG-09 a size of -1, 1.5, NaN or Infinity is a RangeError naming imageAccepted", () => {
    for (const size of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53]) {
      expectThrow(() => imageAccepted("image/png", size), RangeError, "imageAccepted");
    }
  });

  it("C-IMG-09 a type of 5 or a size that is not a number is a TypeError naming imageAccepted", () => {
    expectThrow(() => imageAccepted(5 as never, 1), TypeError, "imageAccepted");
    expectThrow(() => imageAccepted(null as never, 1), TypeError, "imageAccepted");
    expectThrow(() => imageAccepted("image/png", "1" as never), TypeError, "imageAccepted");
    expectThrow(() => imageAccepted("image/png", undefined as never), TypeError, "imageAccepted");
  });
});

describe("C-IMG-10 fitWithin", () => {
  it("C-IMG-10 holds the two canvas sides", () => {
    expect(ANALYSIS_SIDE).toBe(256);
    expect(VIBE_SIDE).toBe(768);
  });

  it("C-IMG-10 scales the longest side to the limit and rounds the other", () => {
    expect(fitWithin(4000, 3000, 256)).toEqual({ width: 256, height: 192 });
    expect(fitWithin(3000, 4000, 768)).toEqual({ width: 576, height: 768 });
    expect(fitWithin(1000, 333, 256)).toEqual({ width: 256, height: 85 });
  });

  it("C-IMG-10 never upscales", () => {
    expect(fitWithin(100, 40, 256)).toEqual({ width: 100, height: 40 });
    expect(fitWithin(256, 256, 256)).toEqual({ width: 256, height: 256 });
  });

  it("C-IMG-10 keeps each side at least 1", () => {
    expect(fitWithin(1, 10000, 256)).toEqual({ width: 1, height: 256 });
    expect(fitWithin(10000, 1, 256)).toEqual({ width: 256, height: 1 });
  });

  it("C-IMG-10 the longest side is the limit and no side grows, for any sizes", () => {
    const side = fc.integer({ min: 1, max: 100_000 });
    fc.assert(
      fc.property(side, side, fc.integer({ min: 1, max: 2048 }), (width, height, max) => {
        const fitted = fitWithin(width, height, max);
        expect(Math.max(fitted.width, fitted.height)).toBe(Math.min(max, Math.max(width, height)));
        expect(fitted.width).toBeLessThanOrEqual(width);
        expect(fitted.height).toBeLessThanOrEqual(height);
        expect(fitted.width).toBeGreaterThanOrEqual(1);
        expect(fitted.height).toBeGreaterThanOrEqual(1);
      }),
      { numRuns: 500, seed: 4006 },
    );
  });

  it("C-IMG-10 a side of 0, NaN or 1.5 throws RangeError naming fitWithin", () => {
    for (const bad of [0, Number.NaN, 1.5, -4, Number.POSITIVE_INFINITY]) {
      expectThrow(() => fitWithin(bad, 10, 256), RangeError, "fitWithin");
      expectThrow(() => fitWithin(10, bad, 256), RangeError, "fitWithin");
      expectThrow(() => fitWithin(10, 10, bad), RangeError, "fitWithin");
    }
  });

  it("C-IMG-10 a side that is not a number throws TypeError naming fitWithin", () => {
    expectThrow(() => fitWithin("4000" as never, 10, 256), TypeError, "fitWithin");
    expectThrow(() => fitWithin(10, null as never, 256), TypeError, "fitWithin");
    expectThrow(() => fitWithin(10, 10, undefined as never), TypeError, "fitWithin");
  });
});

describe("C-IMG-11 parseImageReply", () => {
  const jpeg = () => ({ bytes: new ArrayBuffer(16), width: 100, height: 10 });
  const success = (over: Record<string, unknown> = {}) => ({
    id: 3,
    ok: true,
    clusters: FOUR_COLORS.map((cluster) => ({ ...cluster })),
    width: 100,
    height: 10,
    jpeg: jpeg(),
    ...over,
  });

  it("C-IMG-11 holds the JPEG limit", () => {
    expect(JPEG_MAX_BYTES).toBe(1_048_576);
  });

  it("C-IMG-11 reads a valid success, with its JPEG's very bytes", () => {
    const data = success();
    const reply = parseImageReply(data);
    expect(reply).toEqual(data);
    if (reply === null || !reply.ok || reply.jpeg === null) throw new Error("not a success");
    expect(reply.jpeg.bytes).toBe(data.jpeg.bytes);
  });

  it("C-IMG-11 reads a success without a JPEG, and an id of 0", () => {
    expect(parseImageReply(success({ jpeg: null }))).toEqual(success({ jpeg: null }));
    expect(parseImageReply(success({ id: 0 }))?.id).toBe(0);
  });

  it("C-IMG-11 reads one cluster and eight, and a JPEG at the limits", () => {
    const one = [{ hex: "#3a6ea5", share: 1 }];
    expect(parseImageReply(success({ clusters: one }))).toEqual(success({ clusters: one }));
    const eight = Array.from({ length: 8 }, (_, i) => ({ hex: `#00000${i}`, share: 0.125 }));
    expect(parseImageReply(success({ clusters: eight }))).toEqual(success({ clusters: eight }));
    const big = { bytes: new ArrayBuffer(JPEG_MAX_BYTES), width: 768, height: 1 };
    expect(parseImageReply(success({ jpeg: big }))).toEqual(success({ jpeg: big }));
  });

  it.each(["decode", "too-many-pixels", "quantize"])("C-IMG-11 reads the error %s", (error) => {
    expect(parseImageReply({ id: 7, ok: false, error })).toEqual({ id: 7, ok: false, error });
  });

  it("C-IMG-11 keeps only the reply's own fields", () => {
    const reply = parseImageReply({ ...success(), extra: 1, error: "decode" });
    expect(Object.keys(reply ?? {}).sort()).toEqual(
      ["clusters", "height", "id", "jpeg", "ok", "width"].sort(),
    );
    const failure = parseImageReply({ id: 1, ok: false, error: "decode", clusters: [] });
    expect(failure).toEqual({ id: 1, ok: false, error: "decode" });
    const cluster = parseImageReply(success({ clusters: [{ hex: "#3a6ea5", share: 1, x: 2 }] }));
    expect(cluster?.ok && cluster.clusters).toEqual([{ hex: "#3a6ea5", share: 1 }]);
  });

  const { id: _id, ...noId } = success();
  it.each<[string, unknown]>([
    ["a missing id", noId],
    ["an id of -1", success({ id: -1 })],
    ["an id of 1.5", success({ id: 1.5 })],
    ['an id of "1"', success({ id: "1" })],
    ["null", null],
    ["an array", [success()]],
    ["a string", "reply"],
    ["no ok", { ...success(), ok: undefined }],
    ['an ok of "true"', success({ ok: "true" })],
    ["a cluster with a bad hex", success({ clusters: [{ hex: "#ABC123", share: 1 }] })],
    ["a cluster with a hex of #ggg000", success({ clusters: [{ hex: "#ggg000", share: 1 }] })],
    ["a cluster with a short hex", success({ clusters: [{ hex: "#abc", share: 1 }] })],
    ["a cluster with a hex of 5", success({ clusters: [{ hex: 5, share: 1 }] })],
    [
      "9 clusters",
      success({ clusters: Array.from({ length: 9 }, () => ({ hex: "#000000", share: 0.1 })) }),
    ],
    ["no clusters", success({ clusters: [] })],
    ["clusters that are not an array", success({ clusters: { 0: FOUR_COLORS[0] } })],
    ["a cluster that is not an object", success({ clusters: [null] })],
    ["a share of 0", success({ clusters: [{ hex: "#3a6ea5", share: 0 }] })],
    ["a share of 1.5", success({ clusters: [{ hex: "#3a6ea5", share: 1.5 }] })],
    ["a share of NaN", success({ clusters: [{ hex: "#3a6ea5", share: Number.NaN }] })],
    ['a share of "0.4"', success({ clusters: [{ hex: "#3a6ea5", share: "0.4" }] })],
    [
      "shares summing to 1.01",
      success({
        clusters: [
          { hex: "#3a6ea5", share: 0.51 },
          { hex: "#b8422e", share: 0.5 },
        ],
      }),
    ],
    ["a width of 0", success({ width: 0 })],
    ["a height of 1.5", success({ height: 1.5 })],
    ['a width of "100"', success({ width: "100" })],
    [
      "jpeg bytes that are a Uint8Array",
      success({ jpeg: { ...jpeg(), bytes: new Uint8Array(16) } }),
    ],
    ["jpeg bytes that are an array", success({ jpeg: { ...jpeg(), bytes: [1, 2, 3] } })],
    ["empty jpeg bytes", success({ jpeg: { ...jpeg(), bytes: new ArrayBuffer(0) } })],
    [
      "jpeg bytes over the limit",
      success({ jpeg: { ...jpeg(), bytes: new ArrayBuffer(JPEG_MAX_BYTES + 1) } }),
    ],
    ["a jpeg width of 769", success({ jpeg: { ...jpeg(), width: 769 } })],
    ["a jpeg height of 0", success({ jpeg: { ...jpeg(), height: 0 } })],
    ["a jpeg that is a string", success({ jpeg: "jpeg" })],
    ["no jpeg key", { ...success(), jpeg: undefined }],
    ["an unknown error", { id: 1, ok: false, error: "boom" }],
    ["no error", { id: 1, ok: false }],
    ["an error that is not a string", { id: 1, ok: false, error: { name: "decode" } }],
  ])("C-IMG-11 gives null for %s", (_label, data) => {
    expect(parseImageReply(data)).toBeNull();
  });

  it("C-IMG-11 never throws, for any value", () => {
    fc.assert(
      fc.property(fc.anything(), (value) => {
        expect(() => parseImageReply(value)).not.toThrow();
      }),
      { numRuns: 500, seed: 4006 },
    );
  });
});

// The header builders of C-IMG-15: each sample records `need`, the bytes its header takes, so the
// cases can cut it one byte short.

const ascii = (text: string): number[] => [...text].map((char) => char.charCodeAt(0));
const be16 = (n: number): number[] => [(n >>> 8) & 0xff, n & 0xff];
const be32 = (n: number): number[] => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, ...be16(n)];
const le16 = (n: number): number[] => [n & 0xff, (n >>> 8) & 0xff];
const le24 = (n: number): number[] => [...le16(n), (n >>> 16) & 0xff];
const le32 = (n: number): number[] => [...le24(n), (n >>> 24) & 0xff];
const join = (...parts: readonly (readonly number[])[]): Uint8Array => new Uint8Array(parts.flat());

type Sample = { readonly bytes: Uint8Array; readonly need: number };

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function png(width: number, height: number, ihdr = "IHDR", length = 13): Sample {
  const head = [...PNG_SIGNATURE, ...be32(length), ...ascii(ihdr), ...be32(width), ...be32(height)];
  return { bytes: join(head, [8, 2, 0, 0, 0], [0, 0, 0, 0]), need: 24 };
}

function gif(width: number, height: number, version = "89a"): Sample {
  return { bytes: join(ascii(`GIF${version}`), le16(width), le16(height), [0xf7, 0, 0]), need: 10 };
}

/** A JPEG segment: FF, the marker, the length (counting itself) and the payload. */
const segment = (marker: number, payload: readonly number[]): number[] => [
  0xff,
  marker,
  ...be16(payload.length + 2),
  ...payload,
];

/** An EXIF segment whose payload holds bytes that look like an SOF0 marker, skipped by its length. */
const EXIF = segment(0xe1, [
  ...ascii("Exif\0\0MM"),
  0,
  42,
  ...be32(8),
  0,
  1,
  0xff,
  0xc0,
  0,
  17,
  8,
  0,
  9,
  0,
  9,
  0xff,
  0xd9,
]);
const DQT = segment(0xdb, [0, ...Array.from({ length: 64 }, (_, i) => i + 1)]);
const DHT = segment(0xc4, [0, ...Array.from({ length: 16 }, () => 0)]);
const JPG = segment(0xc8, [1, 2, 3]);
const DAC = segment(0xcc, [0, 0x11]);
const sofPayload = (width: number, height: number) => [
  8,
  ...be16(height),
  ...be16(width),
  3,
  1,
  0x22,
  0,
  2,
  0x11,
  1,
  3,
  0x11,
  1,
];

/** SOI, the EXIF segment first, then `before`, then the frame header `sof`, then a scan. */
function jpeg(
  sof: number,
  width: number,
  height: number,
  before: readonly (readonly number[])[] = [DQT],
): Sample {
  const head = [0xff, 0xd8, ...EXIF, ...before.flat()];
  const frame = segment(sof, sofPayload(width, height));
  const scan = [...segment(0xda, [1, 1, 0, 0, 0x3f, 0]), 0x12, 0x34, 0xff, 0xd9];
  return { bytes: join(head, frame, scan), need: head.length + 9 };
}

function riff(chunk: string, data: readonly number[]): Uint8Array {
  const body = [...ascii(chunk), ...le32(data.length), ...data];
  return join(ascii("RIFF"), le32(body.length + 4), ascii("WEBP"), body);
}

/** A lossy WebP: a key frame's tag, the start code, then 14-bit sides with 2 scale bits. */
function webpLossy(width: number, height: number, tag = 0x10, code = [0x9d, 0x01, 0x2a]): Sample {
  const data = [tag, 0x02, 0x00, ...code, ...le16(width | 0x4000), ...le16(height | 0x8000), 0, 0];
  return { bytes: riff("VP8 ", data), need: 30 };
}

/** A lossless WebP: the signature 0x2f, then width − 1 and height − 1 in 14 bits each. */
function webpLossless(width: number, height: number, signature = 0x2f, version = 0): Sample {
  const bits = ((width - 1) | ((height - 1) << 14) | (1 << 28) | (version << 29)) >>> 0;
  return { bytes: riff("VP8L", [signature, ...le32(bits), 0, 0, 0]), need: 25 };
}

/** An extended WebP: flags, three reserved bytes, then the canvas's width − 1 and height − 1. */
function webpExtended(width: number, height: number): Sample {
  return {
    bytes: riff("VP8X", [0x10, 0, 0, 0, ...le24(width - 1), ...le24(height - 1)]),
    need: 30,
  };
}

/** An ISO BMFF box: its size, its type and its payload; a full box starts with version and flags. */
const box = (type: string, payload: readonly number[]): number[] => [
  ...be32(payload.length + 8),
  ...ascii(type),
  ...payload,
];
const fullBox = (type: string, payload: readonly number[]): number[] =>
  box(type, [0, 0, 0, 0, ...payload]);
const ispe = (width: number, height: number) => fullBox("ispe", [...be32(width), ...be32(height)]);
const FTYP = box("ftyp", [...ascii("avif"), 0, 0, 0, 0, ...ascii("avifmif1miaf")]);
const HDLR = fullBox("hdlr", [
  0,
  0,
  0,
  0,
  ...ascii("pict"),
  ...Array.from({ length: 13 }, () => 0),
]);
const PITM = fullBox("pitm", [0, 1]);
const IPMA = fullBox("ipma", [0, 0, 0, 1, 0, 1, 2, 0x81, 0x02]);
const PIXI = fullBox("pixi", [3, 8, 8, 8]);

/** An AVIF of `ftyp`, then `meta` holding `hdlr`, `pitm` and `iprp` (`ipco` with `props`, `ipma`), then `mdat`. */
function avif(
  props: readonly (readonly number[])[],
  { ftyp = FTYP, before = [] as readonly number[] } = {},
): Sample {
  const ipco = box("ipco", props.flat());
  const meta = fullBox("meta", [...HDLR, ...PITM, ...box("iprp", [...ipco, ...IPMA])]);
  const bytes = join(ftyp, before, meta, box("mdat", [1, 2, 3, 4]));
  return { bytes, need: ftyp.length + before.length + meta.length };
}

const SAMPLES: readonly [string, Sample, string, { width: number; height: number }][] = [
  ["a PNG IHDR", png(640, 480), "image/png", { width: 640, height: 480 }],
  ["a GIF89a logical screen", gif(320, 200), "image/gif", { width: 320, height: 200 }],
  ["a GIF87a logical screen", gif(7, 9, "87a"), "image/gif", { width: 7, height: 9 }],
  ["a JPEG's SOF0 after EXIF", jpeg(0xc0, 4032, 3024), "image/jpeg", { width: 4032, height: 3024 }],
  ["a JPEG's SOF2 after EXIF", jpeg(0xc2, 9000, 6000), "image/jpeg", { width: 9000, height: 6000 }],
  [
    "a JPEG's SOF2 after DHT, JPG and DAC segments",
    jpeg(0xc2, 1200, 800, [DQT, DHT, JPG, DAC]),
    "image/jpeg",
    { width: 1200, height: 800 },
  ],
  ["a JPEG's SOF15", jpeg(0xcf, 33, 44), "image/jpeg", { width: 33, height: 44 }],
  [
    "a JPEG's SOF0 after fill bytes and the standalone RST0 and TEM markers",
    jpeg(0xc0, 50, 60, [DQT, [0xff, 0xff, 0xd0], [0xff, 0x01], [0xff, 0xff]]),
    "image/jpeg",
    { width: 50, height: 60 },
  ],
  [
    "an AVIF's ispe after a free box",
    avif([PIXI, ispe(640, 360)], { before: box("free", [0, 0]) }),
    "image/avif",
    { width: 640, height: 360 },
  ],
  ["a lossy WebP (VP8 )", webpLossy(16383, 300), "image/webp", { width: 16383, height: 300 }],
  [
    "a lossless WebP (VP8L)",
    webpLossless(16384, 9000),
    "image/webp",
    { width: 16384, height: 9000 },
  ],
  [
    "an extended WebP (VP8X)",
    webpExtended(16_777_216, 3),
    "image/webp",
    { width: 16_777_216, height: 3 },
  ],
  ["an AVIF's ispe", avif([ispe(1920, 1080), PIXI]), "image/avif", { width: 1920, height: 1080 }],
];

describe("C-IMG-15 imageSize", () => {
  it("C-IMG-15 reads 8,000 x 8,000 from huge.png's IHDR, over MAX_PIXELS", () => {
    expect(MAX_PIXELS).toBe(50_000_000);
    const size = imageSize(fixture("odd/huge.png"), "image/png");
    expect(size).toEqual({ width: 8000, height: 8000 });
    expect((size?.width ?? 0) * (size?.height ?? 0)).toBeGreaterThan(MAX_PIXELS);
  });

  it("C-IMG-15 reads the logical screen of two-frames.gif", () => {
    expect(imageSize(fixture("odd/two-frames.gif"), "image/gif")).toEqual({ width: 8, height: 8 });
  });

  it("C-IMG-15 reads the other committed fixtures, a JPEG's stored size before its EXIF turn", () => {
    expect(imageSize(fixture("four-colors.png"), "image/png")).toEqual({ width: 100, height: 10 });
    expect(imageSize(fixture("odd/transparent.png"), "image/png")).toEqual({
      width: 64,
      height: 64,
    });
    expect(imageSize(fixture("tiny.jpg"), "image/jpeg")).toEqual({ width: 2, height: 2 });
    expect(imageSize(fixture("odd/rotated.jpg"), "image/jpeg")).toEqual({ width: 40, height: 20 });
  });

  it.each(SAMPLES)("C-IMG-15 reads %s", (_label, sample, type, size) => {
    expect(imageSize(sample.bytes, type)).toEqual(size);
  });

  it.each(SAMPLES)("C-IMG-15 gives null for %s cut short", (_label, sample, type, size) => {
    for (let length = 0; length < sample.need; length++) {
      expect(imageSize(sample.bytes.subarray(0, length), type), `${length} bytes`).toBeNull();
    }
    expect(imageSize(sample.bytes.subarray(0, sample.need), type)).toEqual(size);
  });

  it("C-IMG-15 reads the header the bytes hold whatever listed type the file claims, as the decoder does", () => {
    const huge = fixture("odd/huge.png");
    for (const type of IMAGE_TYPES)
      expect(imageSize(huge, type)).toEqual({ width: 8000, height: 8000 });
  });

  it("C-IMG-15 gives null for a type outside IMAGE_TYPES", () => {
    const huge = fixture("odd/huge.png");
    for (const type of ["image/svg+xml", "image/heic", "", "IMAGE/PNG", "text/plain"]) {
      expect(imageSize(huge, type), type).toBeNull();
    }
  });

  it("C-IMG-15 gives null for 10 random bytes of every listed type", () => {
    const random = new Uint8Array([0x13, 0x37, 0xc0, 0xff, 0xee, 0x42, 0x00, 0x99, 0x7a, 0x01]);
    for (const type of IMAGE_TYPES) expect(imageSize(random, type), type).toBeNull();
  });

  it("C-IMG-15 takes the largest ispe of an AVIF, a grid's over its tiles, the first of equals", () => {
    const grid = avif([ispe(512, 512), ispe(8000, 8000), ispe(512, 512), PIXI]);
    expect(imageSize(grid.bytes, "image/avif")).toEqual({ width: 8000, height: 8000 });
    const equal = avif([ispe(200, 50), ispe(100, 100)]);
    expect(imageSize(equal.bytes, "image/avif")).toEqual({ width: 200, height: 50 });
  });

  it("C-IMG-15 reads an AVIF whose boxes use a 64-bit size or run to the end, after an mdat", () => {
    const ipco = box("ipco", ispe(300, 200));
    const iprp = box("iprp", [...ipco, ...IPMA]);
    const metaPayload = [0, 0, 0, 0, ...HDLR, ...iprp];
    const large = [...be32(1), ...ascii("meta"), ...be32(0), ...be32(metaPayload.length + 16)];
    const first = join(FTYP, box("mdat", [9, 9]), large, metaPayload);
    expect(imageSize(first, "image/avif")).toEqual({ width: 300, height: 200 });
    const toEnd = join(FTYP, be32(0), ascii("meta"), metaPayload);
    expect(imageSize(toEnd, "image/avif")).toEqual({ width: 300, height: 200 });
    const avisOnly = box("ftyp", [...ascii("msf1"), 0, 0, 0, 0, ...ascii("avis")]);
    expect(imageSize(avif([ispe(5, 6)], { ftyp: avisOnly }).bytes, "image/avif")).toEqual({
      width: 5,
      height: 6,
    });
  });

  const heic = box("ftyp", [...ascii("heic"), 0, 0, 0, 0, ...ascii("mif1heic")]);
  const shortFtyp = box("ftyp", ascii("avi"));
  const noMeta = join(FTYP, box("mdat", [1, 2, 3]));
  const metaTooShort = join(FTYP, box("meta", [0, 0]));
  const noIprp = join(FTYP, fullBox("meta", HDLR));
  const noIpco = join(FTYP, fullBox("meta", box("iprp", IPMA)));
  const shortIspe = avif([box("ispe", [0, 0, 0, 0, ...be32(10)])]);
  const pastEnd = join(FTYP, [...be32(64), ...ascii("meta"), 0, 0, 0, 0]);
  const smallerThanHeader = join(FTYP, [...be32(4), ...ascii("free")]);
  const largeCut = join(FTYP, [...be32(1), ...ascii("meta"), 0, 0, 0]);

  it.each<[string, Uint8Array, string]>([
    ["a PNG whose first chunk is not IHDR", png(10, 10, "IDAT").bytes, "image/png"],
    ["a PNG whose IHDR length is not 13", png(10, 10, "IHDR", 12).bytes, "image/png"],
    ["a PNG of width 0", png(0, 10).bytes, "image/png"],
    ["a PNG of height 2^31", png(10, 2 ** 31).bytes, "image/png"],
    [
      "a PNG with a broken signature",
      join([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0], [...png(1, 1).bytes.subarray(8)]),
      "image/png",
    ],
    ["a GIF of height 0", gif(5, 0).bytes, "image/gif"],
    ["a GIF88a", gif(5, 5, "88a").bytes, "image/gif"],
    ["a JPEG without its SOI", jpeg(0xc0, 9, 9).bytes.subarray(2), "image/jpeg"],
    [
      "a JPEG whose scan starts before a frame header",
      join([0xff, 0xd8], segment(0xda, [0, 0]), segment(0xc0, sofPayload(9, 9))),
      "image/jpeg",
    ],
    [
      "a JPEG that ends before a frame header",
      join([0xff, 0xd8], EXIF, [0xff, 0xd9]),
      "image/jpeg",
    ],
    [
      "a JPEG with a byte that is not a marker",
      join([0xff, 0xd8], EXIF, [0x00, 0xc0]),
      "image/jpeg",
    ],
    ["a JPEG with a marker of 0x00", join([0xff, 0xd8, 0xff, 0x00, 0, 4, 0, 0]), "image/jpeg"],
    [
      "a JPEG with a segment length of 1",
      join([0xff, 0xd8, 0xff, 0xe0, 0, 1], segment(0xc0, sofPayload(9, 9))),
      "image/jpeg",
    ],
    [
      "a JPEG whose SOF is shorter than a frame header",
      join([0xff, 0xd8], segment(0xc0, [8, 0, 9, 0, 9])),
      "image/jpeg",
    ],
    ["a JPEG of height 0 (set by a DNL later)", jpeg(0xc0, 9, 0).bytes, "image/jpeg"],
    [
      "a JPEG with only DHT, JPG and DAC segments",
      join([0xff, 0xd8], DHT, JPG, DAC, [0xff, 0xd9]),
      "image/jpeg",
    ],
    [
      "a RIFF that is not a WebP",
      join(ascii("RIFF"), le32(20), ascii("WAVE"), ascii("fmt "), le32(0)),
      "image/webp",
    ],
    ["a lossy WebP that is not a key frame", webpLossy(10, 10, 0x11).bytes, "image/webp"],
    [
      "a lossy WebP with a bad start code",
      webpLossy(10, 10, 0x10, [0x9d, 0x01, 0x2b]).bytes,
      "image/webp",
    ],
    ["a lossy WebP of width 0", webpLossy(0, 10).bytes, "image/webp"],
    ["a lossless WebP with a bad signature", webpLossless(10, 10, 0x2e).bytes, "image/webp"],
    ["a lossless WebP of version 1", webpLossless(10, 10, 0x2f, 1).bytes, "image/webp"],
    [
      "a WebP whose first chunk is ALPH",
      riff(
        "ALPH",
        Array.from({ length: 20 }, () => 0),
      ),
      "image/webp",
    ],
    ["an ftyp that is not AVIF", avif([ispe(10, 10)], { ftyp: heic }).bytes, "image/avif"],
    [
      "an ftyp too short for its brands",
      avif([ispe(10, 10)], { ftyp: shortFtyp }).bytes,
      "image/avif",
    ],
    ["an AVIF without meta", noMeta, "image/avif"],
    ["an AVIF whose meta has no room for its version", metaTooShort, "image/avif"],
    ["an AVIF without iprp", noIprp, "image/avif"],
    ["an AVIF without ipco", noIpco, "image/avif"],
    ["an AVIF without ispe", avif([PIXI]).bytes, "image/avif"],
    ["an AVIF whose ispe is too short", shortIspe.bytes, "image/avif"],
    ["an AVIF with an ispe of width 0", avif([ispe(0, 10)]).bytes, "image/avif"],
    ["an AVIF whose box runs past the end", pastEnd, "image/avif"],
    ["an AVIF whose box is smaller than its header", smallerThanHeader, "image/avif"],
    ["an AVIF whose 64-bit size is cut", largeCut, "image/avif"],
    [
      "an AVIF whose child box runs past its parent",
      avif([[...be32(64), ...ascii("ispe"), 0, 0, 0, 0]]).bytes,
      "image/avif",
    ],
    ["no bytes", new Uint8Array(0), "image/png"],
  ])("C-IMG-15 gives null for %s", (_label, bytes, type) => {
    expect(imageSize(bytes, type)).toBeNull();
  });

  it("C-IMG-15 never throws for a Uint8Array: random bytes, and every header with bytes changed or cut", () => {
    const type = fc.oneof(fc.constantFrom(...IMAGE_TYPES), fc.string());
    const randomBytes = fc.uint8Array({ maxLength: 96 });
    const mutated = fc
      .tuple(
        fc.constantFrom(...SAMPLES.map(([, sample]) => sample.bytes)),
        fc.array(fc.tuple(fc.nat(), fc.integer({ min: 0, max: 255 })), { maxLength: 4 }),
        fc.nat(),
      )
      .map(([bytes, edits, cut]) => {
        const copy = Uint8Array.from(bytes);
        for (const [at, value] of edits) copy[at % copy.length] = value;
        return copy.subarray(0, cut % (copy.length + 1));
      });
    fc.assert(
      fc.property(fc.oneof(randomBytes, mutated), type, (bytes, kind) => {
        const size = imageSize(bytes, kind);
        if (size !== null) {
          expect(Number.isSafeInteger(size.width) && size.width >= 1).toBe(true);
          expect(Number.isSafeInteger(size.height) && size.height >= 1).toBe(true);
        }
      }),
      { numRuns: 2000, seed: 4006 },
    );
  });

  it('C-IMG-15 imageSize(5, "image/png") throws TypeError, as does a type that is not a string', () => {
    expectThrow(() => imageSize(5 as never, "image/png"), TypeError, "imageSize");
    expectThrow(() => imageSize([0x89, 0x50] as never, "image/png"), TypeError, "imageSize");
    expectThrow(() => imageSize(new ArrayBuffer(8) as never, "image/png"), TypeError, "imageSize");
    expectThrow(() => imageSize(new Uint8Array(8), 5 as never), TypeError, "imageSize");
  });
});
