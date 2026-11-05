import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// The image fixtures of docs/specs/04-ai.md section 4: `sources.json` records each file's SHA-256 and
// how it was made, and these cases check the hashes and the facts the later tasks rely on.

const DIR = path.resolve(import.meta.dirname, "../../../fixtures/ai");
const SOURCES: Record<string, { sha256: string; command: string }> = JSON.parse(
  readFileSync(path.join(DIR, "sources.json"), "utf8"),
);
const bytesOf = (name: string): Buffer => readFileSync(path.join(DIR, name));
const FILES = [
  "four-colors.png",
  "gray.png",
  "tiny.jpg",
  "odd/one-pixel.png",
  "odd/transparent.png",
  "odd/two-frames.gif",
  "odd/rotated.jpg",
  "odd/corrupt.png",
  "odd/huge.png",
];

describe("the image fixtures", () => {
  it("C-FIXT4-IMG-01 records every fixture and no other file, with its command", () => {
    expect(Object.keys(SOURCES).sort()).toEqual([...FILES].sort());
    const onDisk = [
      ...readdirSync(DIR).filter((n) => /\.(png|jpg|gif)$/.test(n)),
      ...readdirSync(path.join(DIR, "odd")).map((n) => `odd/${n}`),
    ];
    expect(onDisk.sort()).toEqual([...FILES].sort());
    for (const entry of Object.values(SOURCES)) expect(entry.command.length).toBeGreaterThan(0);
  });

  it.each(FILES)("C-FIXT4-IMG-02 %s matches its recorded SHA-256", (name) => {
    const digest = createHash("sha256").update(bytesOf(name)).digest("hex");
    expect(digest).toBe(SOURCES[name]?.sha256);
  });

  it("C-FIXT4-IMG-03 sizes the PNGs by their IHDR", () => {
    const size = (name: string): [number, number] => {
      const b = bytesOf(name);
      return [b.readUInt32BE(16), b.readUInt32BE(20)];
    };
    expect(size("four-colors.png")).toEqual([100, 10]);
    expect(size("gray.png")).toEqual([100, 10]);
    expect(size("odd/one-pixel.png")).toEqual([1, 1]);
    expect(size("odd/transparent.png")).toEqual([64, 64]);
    expect(size("odd/huge.png")).toEqual([8000, 8000]);
    expect(size("odd/corrupt.png")).toEqual([16, 16]);
  });

  it("C-FIXT4-IMG-04 holds the stored size and the orientation of the JPEGs and the GIF", () => {
    const sof = (b: Buffer): [number, number] => {
      let i = 2;
      while (i < b.length) {
        const marker = b[i + 1] as number;
        if (marker >= 0xc0 && marker <= 0xc3) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
        i += 2 + b.readUInt16BE(i + 2);
      }
      throw new Error("no SOF marker");
    };
    expect(sof(bytesOf("tiny.jpg"))).toEqual([2, 2]);
    const rotated = bytesOf("odd/rotated.jpg");
    expect(sof(rotated)).toEqual([40, 20]);
    expect(rotated.subarray(2, 4)).toEqual(Buffer.from([0xff, 0xe1]));
    expect(rotated.subarray(6, 10).toString("latin1")).toBe("Exif");
    // Orientation entry: tag 0x0112, SHORT, one value, 6 (big-endian TIFF after the 6-byte Exif header, so the TIFF block starts at byte 12).
    expect(rotated.subarray(12 + 8 + 2, 12 + 8 + 2 + 10)).toEqual(
      Buffer.from([0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, 0x06]),
    );
    const gif = bytesOf("odd/two-frames.gif");
    expect(gif.subarray(0, 3).toString("latin1")).toBe("GIF");
    // One graphic control extension per frame.
    expect(gif.toString("latin1").split("\x21\xf9\x04").length - 1).toBe(2);
  });
});
