// Makes the PNG fixtures of docs/specs/04-ai.md section 4 with node:zlib only. Run from the repo
// root: node tests/fixtures/ai/make-images.mjs. The GIF and the JPEGs come from ImageMagick; their
// commands are in sources.json. The test fixtures.test.ts checks every file's SHA-256.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { deflateSync } from "node:zlib";

const HERE = import.meta.dirname;

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes) {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function ihdr(width, height, depth, colorType) {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data[8] = depth;
  data[9] = colorType;
  return chunk("IHDR", data);
}

/** The bytes of `#rrggbb` as [r, g, b]. */
function rgb(hex) {
  return [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
}

/** A truecolor PNG whose column x has the color `columns[x]` (a hex), the same on every row. */
function columnsPng(width, height, columns) {
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x++) Buffer.from(rgb(columns[x])).copy(row, 1 + x * 3);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    SIGNATURE,
    ihdr(width, height, 8, 2),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Four bands of 40, 30, 20 and 10 columns, 100 x 10. */
function fourBands(colors) {
  const columns = [];
  for (const [i, count] of [40, 30, 20, 10].entries()) {
    for (let k = 0; k < count; k++) columns.push(colors[i]);
  }
  return columnsPng(100, 10, columns);
}

function transparentPng(size) {
  const raw = Buffer.alloc(size * (1 + size * 4)); // every pixel rgba(0, 0, 0, 0)
  return Buffer.concat([
    SIGNATURE,
    ihdr(size, size, 8, 6),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** One color at width x height, as a 1-bit palette image, so the raw data stays small. */
function hugePng(width, height, hex) {
  const rowBytes = Math.ceil(width / 8);
  const raw = Buffer.alloc(height * (1 + rowBytes)); // every index 0
  return Buffer.concat([
    SIGNATURE,
    ihdr(width, height, 1, 3),
    chunk("PLTE", Buffer.from([...rgb(hex), 0, 0, 0])),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** A valid signature and IHDR, then an IDAT that is not a zlib stream. */
function corruptPng() {
  const body = Buffer.from(Array.from({ length: 64 }, (_, i) => (i * 37 + 11) & 0xff));
  body[0] = 0xff;
  return Buffer.concat([
    SIGNATURE,
    ihdr(16, 16, 8, 2),
    chunk("IDAT", body),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function onePixelPng() {
  const raw = Buffer.from([0, 0xb8, 0x42, 0x2e]);
  return Buffer.concat([
    SIGNATURE,
    ihdr(1, 1, 8, 2),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * `node make-images.mjs orient6 <file.jpg>` inserts an EXIF APP1 segment with Orientation 6 (rotate
 * 90 degrees clockwise to display) right after the SOI marker of a JPEG, because ImageMagick does
 * not write one. A big-endian TIFF block with a single IFD0 entry.
 */
function setOrientation6(file) {
  const jpeg = readFileSync(file);
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new Error(`${file} is not a JPEG`);
  const tiff = Buffer.from([
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // "MM", 42, IFD0 at offset 8
    0x00, 0x01, // one entry
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, 0x06, 0x00, 0x00, // Orientation, SHORT, 1, 6
    0x00, 0x00, 0x00, 0x00, // no next IFD
  ]);
  const payload = Buffer.concat([Buffer.from("Exif\0\0", "latin1"), tiff]);
  const header = Buffer.from([0xff, 0xe1, 0, 0]);
  header.writeUInt16BE(payload.length + 2, 2);
  writeFileSync(file, Buffer.concat([jpeg.subarray(0, 2), header, payload, jpeg.subarray(2)]));
}

if (process.argv[2] === "orient6") {
  setOrientation6(process.argv[3]);
  process.exit(0);
}

mkdirSync(path.join(HERE, "odd"), { recursive: true });
const files = {
  "four-colors.png": fourBands(["#b8422e", "#3a6ea5", "#f2e6d0", "#1a1c1e"]),
  "gray.png": fourBands(["#202020", "#808080", "#c0c0c0", "#f0f0f0"]),
  "odd/one-pixel.png": onePixelPng(),
  "odd/transparent.png": transparentPng(64),
  "odd/corrupt.png": corruptPng(),
  "odd/huge.png": hugePng(8000, 8000, "#3a6ea5"),
};
for (const [name, bytes] of Object.entries(files)) writeFileSync(path.join(HERE, name), bytes);
